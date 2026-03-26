use crate::infra::llm_client::LlmProvider;
use reqwest::Client;
use sqlx::SqlitePool;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone)]
pub struct LlmSettings {
    pub provider: LlmProvider,
    pub perplexity_api_key: Option<String>,
    pub ollama_base_url: String,
    pub ollama_model: String,
}

impl Default for LlmSettings {
    fn default() -> Self {
        Self {
            provider: LlmProvider::Ollama,
            perplexity_api_key: None,
            ollama_base_url: "http://localhost:11434".to_string(),
            ollama_model: "llama3.2".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub http: Arc<Client>,
    pub llm: Arc<RwLock<LlmSettings>>,
}

impl AppState {
    pub fn new(db: Arc<SqlitePool>, http: Arc<Client>) -> Self {
        Self {
            db,
            http,
            llm: Arc::new(RwLock::new(LlmSettings::default())),
        }
    }
}
