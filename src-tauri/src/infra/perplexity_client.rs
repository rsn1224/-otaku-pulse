use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest, LlmResponse, LlmProvider};

#[derive(Serialize)]
struct PerplexityRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct PerplexityResponse {
    choices: Vec<Choice>,
    model: String,
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
        let request_body = PerplexityRequest {
            model: "sonar".to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: req.system_prompt,
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: req.user_prompt,
                },
            ],
            max_tokens: req.max_tokens,
            temperature: 0.2,
        };

        let response = self.http
            .post("https://api.perplexity.ai/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        match status.as_u16() {
            401 => {
                return Err(AppError::Unauthorized("Perplexity API キーが無効です".to_string()));
            }
            429 => {
                return Err(AppError::RateLimit("レート制限中です。しばらく待ってください".to_string()));
            }
            200..=299 => {
                // 成功
            }
            _ => {
                return Err(AppError::Network(format!("HTTP {}: {}", status, response.text().await?)));
            }
        }

        let perplexity_response: PerplexityResponse = response.json().await
            .map_err(|e| AppError::Parse(format!("Perplexity レスポンスのパースに失敗: {}", e)))?;

        if perplexity_response.choices.is_empty() {
            return Err(AppError::Parse("Perplexity レスポンスが空です".to_string()));
        }

        let content = perplexity_response.choices[0].message.content.clone();

        Ok(LlmResponse {
            content,
            provider: LlmProvider::PerplexitySonar,
            model: perplexity_response.model,
        })
    }

    fn provider(&self) -> LlmProvider {
        LlmProvider::PerplexitySonar
    }
}
