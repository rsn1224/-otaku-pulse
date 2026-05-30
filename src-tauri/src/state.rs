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
            ollama_base_url: "http://127.0.0.1:11434".to_string(),
            ollama_model: "qwen3:14b".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub http: Arc<Client>,
    pub llm: Arc<RwLock<LlmSettings>>,
}

/// Serializes feed collection so a scheduler tick, the boot-time collect, and a
/// manual collect never run concurrently. Holders use `try_lock`: if a collection
/// is already in flight the new request is skipped rather than queued, which avoids
/// the transient "database is locked (code 5)" seen when two `refresh_all` cycles
/// overlap at startup (React StrictMode double-invokes the boot effect in dev).
#[derive(Clone, Default)]
pub struct CollectLock(pub Arc<tokio::sync::Mutex<()>>);

impl AppState {
    pub fn new(db: Arc<SqlitePool>, http: Arc<Client>) -> Self {
        Self {
            db,
            http,
            llm: Arc::new(RwLock::new(LlmSettings::default())),
        }
    }
}
