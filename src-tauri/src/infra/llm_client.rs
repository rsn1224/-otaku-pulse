use crate::error::AppError;
use async_trait::async_trait;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    PerplexitySonar,
    #[default]
    Ollama,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Citation {
    pub url: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct LlmRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: u32,
    pub web_search: bool,
    pub conversation: Option<Vec<ChatMessage>>,
}

impl LlmRequest {
    /// 後方互換: web_search=false, conversation=None のシンプルなリクエスト
    pub fn simple(system_prompt: String, user_prompt: String, max_tokens: u32) -> Self {
        Self {
            system_prompt,
            user_prompt,
            max_tokens,
            web_search: false,
            conversation: None,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LlmResponse {
    pub content: String,
    pub provider: LlmProvider,
    pub model: String,
    pub citations: Vec<Citation>,
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, AppError>;
    fn provider(&self) -> LlmProvider;
}
