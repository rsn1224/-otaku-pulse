use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmProvider, LlmRequest, LlmResponse};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    num_predict: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
    model: String,
    done: bool,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

pub struct OllamaClient {
    base_url: String,
    model: String,
    http: Client,
}

impl OllamaClient {
    pub fn new(base_url: String, model: String, http: Client) -> Self {
        Self {
            base_url,
            model,
            http,
        }
    }
}

#[async_trait]
impl LlmClient for OllamaClient {
    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, AppError> {
        let prompt = format!("{}\n\n{}", req.system_prompt, req.user_prompt);

        let request_body = OllamaRequest {
            model: self.model.clone(),
            prompt,
            stream: false,
            options: OllamaOptions {
                num_predict: req.max_tokens,
                temperature: 0.2,
            },
        };

        let url = format!("{}/api/generate", self.base_url);

        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(120))
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() || e.is_timeout() {
                    AppError::Network(
                        "Ollama が起動していません。`ollama serve` を実行してください".to_string(),
                    )
                } else {
                    AppError::Network(format!("Ollama 接続エラー: {}", e))
                }
            })?;

        if !response.status().is_success() {
            return Err(AppError::Network(format!(
                "Ollama HTTP エラー: {}",
                response.status()
            )));
        }

        let ollama_response: OllamaResponse = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Ollama レスポンスのパースに失敗: {}", e)))?;

        if !ollama_response.done {
            return Err(AppError::Parse("Ollama レスポンスが不完全です".to_string()));
        }

        Ok(LlmResponse {
            content: ollama_response.response,
            provider: LlmProvider::Ollama,
            model: ollama_response.model,
            citations: vec![],
        })
    }

    fn provider(&self) -> LlmProvider {
        LlmProvider::Ollama
    }
}

/// Ollama の起動確認 + 利用可能モデル一覧取得
pub async fn check_status(http: &Client, base_url: &str) -> Result<Vec<String>, AppError> {
    let url = format!("{}/api/tags", base_url);

    let response = http.get(&url).send().await.map_err(|e| {
        if e.is_connect() || e.is_timeout() {
            AppError::Network("Ollama が起動していません".to_string())
        } else {
            AppError::Network(format!("Ollama ステータス確認エラー: {}", e))
        }
    })?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!(
            "Ollama ステータス確認 HTTP エラー: {}",
            response.status()
        )));
    }

    let tags_response: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|e| AppError::Parse(format!("Ollama タグレスポンスのパースに失敗: {}", e)))?;

    let models = tags_response
        .models
        .into_iter()
        .map(|model| model.name)
        .collect();

    Ok(models)
}
