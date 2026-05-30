use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmProvider, LlmRequest, LlmResponse};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::Duration;
use tokio::sync::Semaphore;

/// ローカル Ollama は単一モデルプロセスのため、アプリ側で同時呼び出し数を制限する。
/// 制限が無いと記事カードや背景生成のバーストが Ollama を飽和させ、全リクエストが
/// timeout して「読み込みが完了しない」状態を招く。permits=2 とし、背景生成 (逐次・1 permit)
/// と並行してもユーザー操作 (deepdive 等) 用に 1 permit 残るようにする。
static OLLAMA_GATE: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(2));

/// モデルをメモリに常駐させる時間。未指定だと既定 5 分でアンロードされ、次回 +30-60s の
/// 再ロードが発生する。
const KEEP_ALIVE: &str = "15m";

// ── Chat API 用の構造体 ──

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaChatMessage>,
    stream: bool,
    /// Ollama API の top-level パラメータ (options 内ではない)。
    keep_alive: &'static str,
    /// 構造化出力スキーマ。指定時は出力が JSON schema に拘束される。
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<serde_json::Value>,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OllamaOptions {
    num_predict: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaChatResponseMessage,
    model: String,
    done: bool,
}

#[derive(Deserialize)]
struct OllamaChatResponseMessage {
    content: String,
}

// ── Tags API 用の構造体 ──

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
        // 同時呼び出しをアプリ側で制限 (バースト飽和防止)。permit は complete 終了で解放。
        let _permit = OLLAMA_GATE
            .acquire()
            .await
            .map_err(|_| AppError::Internal("LLM ゲートが閉じています".to_string()))?;

        // 生成量に応じた段階 timeout (小さい要約はすぐ諦め、長文生成のみ長く待つ)。
        let timeout = match req.max_tokens {
            0..=300 => Duration::from_secs(30),
            301..=600 => Duration::from_secs(60),
            _ => Duration::from_secs(120),
        };

        let mut messages = vec![OllamaChatMessage {
            role: "system".to_string(),
            content: req.system_prompt,
        }];

        // 会話履歴を挿入（マルチターン DeepDive 等で使用）
        if let Some(conversation) = &req.conversation {
            for msg in conversation {
                messages.push(OllamaChatMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                });
            }
        }

        messages.push(OllamaChatMessage {
            role: "user".to_string(),
            content: req.user_prompt,
        });

        // 構造化出力時は決定性を上げるため温度を 0 にする (schema 遵守を最大化)。
        let temperature = if req.format.is_some() { 0.0 } else { 0.2 };

        let request_body = OllamaChatRequest {
            model: self.model.clone(),
            messages,
            stream: false,
            keep_alive: KEEP_ALIVE,
            format: req.format,
            options: OllamaOptions {
                num_predict: req.max_tokens,
                temperature,
            },
        };

        let url = format!("{}/api/chat", self.base_url);

        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .timeout(timeout)
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

        let chat_response: OllamaChatResponse = response
            .json()
            .await
            .map_err(|e| AppError::Parse(format!("Ollama レスポンスのパースに失敗: {}", e)))?;

        if !chat_response.done {
            return Err(AppError::Parse("Ollama レスポンスが不完全です".to_string()));
        }

        Ok(LlmResponse {
            content: chat_response.message.content,
            provider: LlmProvider::Ollama,
            model: chat_response.model,
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
