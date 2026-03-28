use crate::error::AppError;
use crate::infra::llm_client::{Citation, LlmClient, LlmProvider, LlmRequest, LlmResponse};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct PerplexityRequest {
    model: String,
    messages: Vec<ApiMessage>,
    max_tokens: u32,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    search_recency_filter: Option<String>,
}

#[derive(Serialize)]
struct ApiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct PerplexityResponse {
    choices: Vec<Choice>,
    model: String,
    #[serde(default)]
    citations: Vec<String>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

pub struct PerplexitySonarClient {
    api_key: String,
    http: Client,
    base_url: String,
}

const DEFAULT_BASE_URL: &str = "https://api.perplexity.ai";

impl PerplexitySonarClient {
    pub fn new(api_key: String, http: Client) -> Self {
        Self {
            api_key,
            http,
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }

    #[cfg(test)]
    fn with_base_url(api_key: String, http: Client, base_url: String) -> Self {
        Self {
            api_key,
            http,
            base_url,
        }
    }
}

#[async_trait]
impl LlmClient for PerplexitySonarClient {
    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, AppError> {
        // メッセージ構築: 会話履歴があればそれを使う
        let mut messages = vec![ApiMessage {
            role: "system".to_string(),
            content: req.system_prompt,
        }];

        if let Some(conversation) = &req.conversation {
            for msg in conversation {
                messages.push(ApiMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                });
            }
        }

        messages.push(ApiMessage {
            role: "user".to_string(),
            content: req.user_prompt,
        });

        let request_body = PerplexityRequest {
            model: "sonar".to_string(),
            messages,
            max_tokens: req.max_tokens,
            temperature: 0.2,
            search_recency_filter: if req.web_search {
                Some("week".to_string())
            } else {
                None
            },
        };

        let url = format!("{}/chat/completions", self.base_url);
        let response = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(60))
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        match status.as_u16() {
            401 => {
                return Err(AppError::Unauthorized(
                    "Perplexity API キーが無効です".to_string(),
                ));
            }
            429 => {
                return Err(AppError::RateLimit(
                    "レート制限中です。しばらく待ってください".to_string(),
                ));
            }
            200..=299 => {}
            _ => {
                return Err(AppError::Network(format!(
                    "HTTP {}: {}",
                    status,
                    response.text().await?
                )));
            }
        }

        let perplexity_response: PerplexityResponse = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Perplexity レスポンスのパースに失敗: {}", e)))?;

        if perplexity_response.choices.is_empty() {
            return Err(AppError::Parse("Perplexity レスポンスが空です".to_string()));
        }

        let content = perplexity_response.choices[0].message.content.clone();

        // citations を構造化
        let citations: Vec<Citation> = perplexity_response
            .citations
            .into_iter()
            .map(|url| Citation { url, title: None })
            .collect();

        Ok(LlmResponse {
            content,
            provider: LlmProvider::PerplexitySonar,
            model: perplexity_response.model,
            citations,
        })
    }

    fn provider(&self) -> LlmProvider {
        LlmProvider::PerplexitySonar
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::llm_client::LlmRequest;

    #[tokio::test]
    async fn test_api_key_not_leaked_in_error() {
        let mock_server = wiremock::MockServer::start().await;
        wiremock::Mock::given(wiremock::matchers::any())
            .respond_with(
                wiremock::ResponseTemplate::new(401).set_body_string("Unauthorized"),
            )
            .mount(&mock_server)
            .await;

        let secret_key = "sk-test-SUPER-SECRET-KEY-12345";
        let client = PerplexitySonarClient::with_base_url(
            secret_key.to_string(),
            Client::new(),
            mock_server.uri(),
        );

        let req = LlmRequest::simple(
            "system".to_string(),
            "user prompt".to_string(),
            100,
        );

        let result = client.complete(req).await;
        assert!(result.is_err());

        let err = result.unwrap_err();
        let err_string = err.to_string();
        assert!(
            !err_string.contains(secret_key),
            "API key leaked in error message: {err_string}"
        );
        assert!(
            !err_string.contains("SUPER-SECRET"),
            "Partial API key leaked in error message: {err_string}"
        );
    }

    #[tokio::test]
    async fn test_api_key_not_leaked_in_network_error() {
        let secret_key = "sk-test-MEGA-SECRET-KEY-67890";
        let client = PerplexitySonarClient::with_base_url(
            secret_key.to_string(),
            Client::new(),
            "http://127.0.0.1:1".to_string(), // connection refused
        );

        let req = LlmRequest::simple(
            "system".to_string(),
            "user prompt".to_string(),
            100,
        );

        let result = client.complete(req).await;
        assert!(result.is_err());

        let err = result.unwrap_err();
        let err_string = err.to_string();
        assert!(
            !err_string.contains(secret_key),
            "API key leaked in network error: {err_string}"
        );
    }
}
