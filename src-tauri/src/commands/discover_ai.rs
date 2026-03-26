use super::llm::{as_llm_client, build_llm_client, clone_llm_settings};
use crate::error::CmdResult;
use crate::models::DeepDiveResult;
use crate::services::{deepdive_service, fts_queries, highlights_service, summary_service};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// AI Summary
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_or_generate_summary(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> CmdResult<String> {
    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    summary_service::get_or_generate_summary(&state.db, article_id, as_llm_client(&client)).await
}

// ---------------------------------------------------------------------------
// Deep Dive
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_deepdive_questions(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> CmdResult<Vec<String>> {
    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    deepdive_service::generate_questions(&state.db, article_id, as_llm_client(&client)).await
}

#[tauri::command]
pub async fn ask_deepdive(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    question: String,
) -> CmdResult<DeepDiveResult> {
    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    deepdive_service::answer_question(&state.db, article_id, &question, as_llm_client(&client))
        .await
}

// ---------------------------------------------------------------------------
// Highlights + Batch Summary
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_daily_highlights(
    state: tauri::State<'_, AppState>,
) -> CmdResult<Vec<highlights_service::HighlightEntry>> {
    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    highlights_service::get_daily_highlights(&state.db, as_llm_client(&client)).await
}

#[tauri::command]
pub async fn batch_generate_summaries(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
) -> CmdResult<u32> {
    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;
    let limit = limit.unwrap_or(10);

    highlights_service::batch_generate_summaries(&state.db, as_llm_client(&client), limit).await
}

#[tauri::command]
pub async fn get_trending_keywords(
    state: tauri::State<'_, AppState>,
) -> CmdResult<Vec<highlights_service::TrendKeyword>> {
    highlights_service::get_trending_keywords(&state.db).await
}

// ---------------------------------------------------------------------------
// AI Search
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSearchResult {
    pub local_articles: Vec<crate::models::ArticleDto>,
    pub ai_answer: Option<String>,
    pub citations: Vec<crate::infra::llm_client::Citation>,
}

#[tauri::command]
pub async fn ai_search(
    state: tauri::State<'_, AppState>,
    query: String,
) -> CmdResult<AiSearchResult> {
    let local = fts_queries::search_articles(&state.db, &query, 20)
        .await
        .unwrap_or_else(|e| {
            tracing::warn!(error = %e, "FTS search failed, falling back to empty results");
            vec![]
        });

    let is_question =
        query.contains('\u{FF1F}') || query.contains('?') || query.ends_with("\u{3068}\u{306F}");
    let needs_ai = local.len() < 3 || is_question;

    if needs_ai {
        let settings = clone_llm_settings(&state)?;
        if settings.provider == crate::infra::llm_client::LlmProvider::PerplexitySonar {
            let client = build_llm_client(&settings, &state.http)?;
            let req = crate::infra::llm_client::LlmRequest {
                system_prompt: "あなたはアニメ・ゲーム・漫画に詳しいアシスタントです。\
                    質問に対して日本語で簡潔に回答してください。"
                    .to_string(),
                user_prompt: query,
                max_tokens: 400,
                web_search: true,
                conversation: None,
            };

            let response = as_llm_client(&client).complete(req).await;

            if let Ok(resp) = response {
                return Ok(AiSearchResult {
                    local_articles: local,
                    ai_answer: Some(resp.content),
                    citations: resp.citations,
                });
            }
        }
    }

    Ok(AiSearchResult {
        local_articles: local,
        ai_answer: None,
        citations: vec![],
    })
}

#[tauri::command]
pub async fn search_discover(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> CmdResult<Vec<crate::models::ArticleDto>> {
    fts_queries::search_articles(&state.db, &query, limit.unwrap_or(30)).await
}
