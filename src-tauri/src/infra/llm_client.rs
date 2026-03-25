use async_trait::async_trait;
use crate::error::AppError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    PerplexitySonar,
    #[default]
    Ollama,
}

#[derive(Debug, Clone)]
pub struct LlmRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LlmResponse {
    pub content: String,
    pub provider: LlmProvider,
    pub model: String,
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, AppError>;
    #[allow(dead_code)]
    fn provider(&self) -> LlmProvider;
}
