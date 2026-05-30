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
    /// 構造化出力スキーマ (Ollama の `format` パラメータ)。`Some(json_schema)` で出力を
    /// JSON schema に拘束し、脆い文字列パースを排除する。`None` は自由文。
    /// (Perplexity は現状この指定を無視する — web レポート等の自由文用途のため)
    pub format: Option<serde_json::Value>,
}

impl LlmRequest {
    /// 後方互換: web_search=false, conversation=None, 構造化なしのシンプルなリクエスト
    pub fn simple(system_prompt: String, user_prompt: String, max_tokens: u32) -> Self {
        Self {
            system_prompt,
            user_prompt,
            max_tokens,
            web_search: false,
            conversation: None,
            format: None,
        }
    }

    /// 構造化出力リクエスト: `schema` (JSON schema) で出力を拘束する。
    pub fn structured(
        system_prompt: String,
        user_prompt: String,
        max_tokens: u32,
        schema: serde_json::Value,
    ) -> Self {
        Self {
            system_prompt,
            user_prompt,
            max_tokens,
            web_search: false,
            conversation: None,
            format: Some(schema),
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

    /// web 検索 (出典付き多源調査) に対応するか。
    /// サービス層はプロバイダ具象 (`PerplexitySonar`) を直接判定せず、この capability で分岐する。
    /// 既定は非対応。
    fn supports_web_search(&self) -> bool {
        false
    }
}
