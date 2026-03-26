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
}

impl PerplexitySonarClient {
    pub fn new(api_key: String, http: Client) -> Self {
        Self { api_key, http }
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

        let response = self
            .http
            .post("https://api.perplexity.ai/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
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
