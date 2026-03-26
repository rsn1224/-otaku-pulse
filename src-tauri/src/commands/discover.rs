#![allow(dead_code)]
use crate::error::CmdResult;
use crate::infra::llm_client::{LlmClient, LlmProvider};
use crate::infra::ollama_client::OllamaClient;
use crate::infra::perplexity_client::PerplexitySonarClient;
use crate::models::{DeepDiveResult, DiscoverFeedResult, UserProfileDto};
use crate::services::{
    deepdive_service, discover_queries, fts_queries, highlights_service, personal_scoring,
    profile_service, summary_service,
};
use crate::state::{AppState, LlmSettings};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_user_profile(state: tauri::State<'_, AppState>) -> CmdResult<UserProfileDto> {
    profile_service::get_profile(&state.db).await
}

#[tauri::command]
pub async fn update_user_profile(
    state: tauri::State<'_, AppState>,
    profile: UserProfileDto,
) -> CmdResult<()> {
    profile_service::update_profile(&state.db, &profile).await?;
    personal_scoring::rescore_all(&state.db).await?;
    Ok(())
}

#[tauri::command]
pub async fn reset_learning_data(state: tauri::State<'_, AppState>) -> CmdResult<()> {
    profile_service::reset_learning_data(&state.db).await
}

// ---------------------------------------------------------------------------
// Discover Feed
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_discover_feed(
    state: tauri::State<'_, AppState>,
    tab: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_discover_feed(&state.db, &tab, limit, offset).await
}

#[tauri::command]
pub async fn get_library_articles(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> CmdResult<DiscoverFeedResult> {
    discover_queries::get_library_articles(&state.db, limit.unwrap_or(30), offset.unwrap_or(0))
        .await
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn record_interaction(
    state: tauri::State<'_, AppState>,
    article_id: i64,
    action: String,
    dwell_seconds: Option<i64>,
) -> CmdResult<()> {
    discover_queries::record_interaction(
        &state.db,
        article_id,
        &action,
        dwell_seconds.unwrap_or(0),
    )
    .await?;

    if action == "open" {
        profile_service::increment_read_count(&state.db).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn rescore_articles(state: tauri::State<'_, AppState>) -> CmdResult<u64> {
    personal_scoring::rescore_all(&state.db).await
}

// ---------------------------------------------------------------------------
// LLM helper
// ---------------------------------------------------------------------------

fn clone_llm_settings(state: &AppState) -> CmdResult<LlmSettings> {
    let guard = state
        .llm
        .read()
        .map_err(|e| crate::error::AppError::Internal(format!("LLM settings lock: {e}")))?;
    Ok(guard.clone())
}

enum LlmBox {
    Perplexity(PerplexitySonarClient),
    Ollama(OllamaClient),
}

fn build_llm_client(settings: &LlmSettings, http: &reqwest::Client) -> CmdResult<LlmBox> {
    match settings.provider {
        LlmProvider::PerplexitySonar => {
            let api_key = settings.perplexity_api_key.clone().ok_or_else(|| {
                crate::error::AppError::Llm("Perplexity API キーが未設定です".into())
            })?;
            Ok(LlmBox::Perplexity(PerplexitySonarClient::new(
                api_key,
                http.clone(),
            )))
        }
        LlmProvider::Ollama => Ok(LlmBox::Ollama(OllamaClient::new(
            settings.ollama_base_url.clone(),
            settings.ollama_model.clone(),
            http.clone(),
        ))),
    }
}

/// LlmBox から &dyn LlmClient を取得するヘルパー
fn as_llm_client(client: &LlmBox) -> &dyn LlmClient {
    match client {
        LlmBox::Perplexity(c) => c,
        LlmBox::Ollama(c) => c,
    }
}

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
// Highlights + Batch Summary + Search
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnreadCounts {
    pub for_you: i64,
    pub trending: i64,
    pub anime: i64,
    pub game: i64,
    pub manga: i64,
    pub hardware: i64,
}

#[tauri::command]
pub async fn get_unread_counts(state: tauri::State<'_, AppState>) -> CmdResult<UnreadCounts> {
    // 1 クエリで全カテゴリの未読数を取得
    let row: (i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN a.published_at >= datetime('now', '-12 hours') THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'anime' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'game' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'manga' THEN 1 ELSE 0 END),
           SUM(CASE WHEN f.category = 'pc' THEN 1 ELSE 0 END)
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.is_read = 0",
    )
    .fetch_one(&*state.db)
    .await?;

    Ok(UnreadCounts {
        for_you: row.0,
        trending: row.1,
        anime: row.2,
        game: row.3,
        manga: row.4,
        hardware: row.5,
    })
}

#[tauri::command]
pub async fn mark_all_read_category(
    state: tauri::State<'_, AppState>,
    category: String,
) -> CmdResult<i64> {
    let result = if category == "for_you" || category == "all" {
        sqlx::query("UPDATE articles SET is_read = 1 WHERE is_read = 0")
            .execute(&*state.db)
            .await?
    } else if category == "trending" {
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND published_at >= datetime('now', '-12 hours')",
        )
        .execute(&*state.db)
        .await?
    } else {
        let cat = if category == "hardware" {
            "pc"
        } else {
            &category
        };
        sqlx::query(
            "UPDATE articles SET is_read = 1
             WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE category = ?1)",
        )
        .bind(cat)
        .execute(&*state.db)
        .await?
    };

    Ok(result.rows_affected() as i64)
}

#[tauri::command]
pub async fn get_related_articles(
    state: tauri::State<'_, AppState>,
    article_id: i64,
) -> CmdResult<Vec<crate::models::DiscoverArticleDto>> {
    let articles = sqlx::query_as::<_, crate::models::DiscoverArticleDto>(
        "SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
                a.published_at, a.is_read, a.is_bookmarked, a.language,
                a.thumbnail_url, a.ai_summary,
                f.name AS feed_name, f.category AS category,
                a.importance_score AS total_score
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         WHERE a.is_duplicate = 0 AND a.id != ?1
           AND f.category = (SELECT f2.category FROM articles a2 JOIN feeds f2 ON a2.feed_id = f2.id WHERE a2.id = ?1)
         ORDER BY a.published_at DESC
         LIMIT 3",
    )
    .bind(article_id)
    .fetch_all(&*state.db)
    .await?;

    Ok(articles)
}

#[tauri::command]
pub async fn adjust_feed_preference(
    state: tauri::State<'_, AppState>,
    feed_id: i64,
    delta: f64,
) -> CmdResult<()> {
    // フィード配下の全記事のスコアを調整
    sqlx::query(
        "UPDATE article_scores SET
           personal_score = personal_score + ?1,
           total_score = base_score * 0.3 + (personal_score + ?1) * 0.4 + (total_score - base_score * 0.3 - personal_score * 0.4) * 1.0
         WHERE article_id IN (SELECT id FROM articles WHERE feed_id = ?2)",
    )
    .bind(delta)
    .bind(feed_id)
    .execute(&*state.db)
    .await?;

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferenceSuggestion {
    pub suggested_titles: Vec<String>,
    pub suggested_genres: Vec<String>,
    pub suggested_creators: Vec<String>,
    pub reason: String,
}

#[tauri::command]
pub async fn suggest_preferences(
    state: tauri::State<'_, AppState>,
) -> CmdResult<PreferenceSuggestion> {
    // 行動データ集計
    let stats: Vec<(String, i64)> = sqlx::query_as(
        "SELECT f.category, COUNT(*) as cnt
         FROM article_interactions ai
         JOIN articles a ON ai.article_id = a.id
         JOIN feeds f ON a.feed_id = f.id
         WHERE ai.action IN ('open', 'bookmark', 'deepdive')
         GROUP BY f.category
         ORDER BY cnt DESC",
    )
    .fetch_all(&*state.db)
    .await?;

    // よく読まれた記事タイトル
    let top_titles: Vec<(String,)> = sqlx::query_as(
        "SELECT a.title FROM article_interactions ai
         JOIN articles a ON ai.article_id = a.id
         WHERE ai.action IN ('bookmark', 'deepdive')
         ORDER BY ai.created_at DESC
         LIMIT 20",
    )
    .fetch_all(&*state.db)
    .await?;

    if top_titles.is_empty() {
        return Ok(PreferenceSuggestion {
            suggested_titles: vec![],
            suggested_genres: vec![],
            suggested_creators: vec![],
            reason: "まだ十分な閲覧データがありません".to_string(),
        });
    }

    let stats_text = stats
        .iter()
        .map(|(cat, cnt)| format!("{}: {}件", cat, cnt))
        .collect::<Vec<_>>()
        .join(", ");

    let titles_text = top_titles
        .iter()
        .map(|(t,)| t.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    let req = crate::infra::llm_client::LlmRequest::simple(
        "ユーザーの閲覧行動データから趣味嗜好を推定してください。\
         JSON形式で返してください:\n\
         {\"titles\": [\"作品名1\", \"作品名2\"], \"genres\": [\"ジャンル1\"], \"creators\": [\"クリエイター名1\"], \"reason\": \"推定理由\"}\n\
         各配列は3件以内。reason は20文字以内。"
            .to_string(),
        format!(
            "カテゴリ別閲覧数: {}\n\nブックマーク/深堀りした記事:\n{}",
            stats_text, titles_text
        ),
        300,
    );

    let response = as_llm_client(&client).complete(req).await;

    match response {
        Ok(resp) => {
            // JSON パース
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&resp.content) {
                let titles = parsed["titles"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let genres = parsed["genres"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let creators = parsed["creators"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let reason = parsed["reason"]
                    .as_str()
                    .unwrap_or("行動パターンから推定")
                    .to_string();

                return Ok(PreferenceSuggestion {
                    suggested_titles: titles,
                    suggested_genres: genres,
                    suggested_creators: creators,
                    reason,
                });
            }
            Ok(PreferenceSuggestion {
                suggested_titles: vec![],
                suggested_genres: vec![],
                suggested_creators: vec![],
                reason: "推定に失敗しました".to_string(),
            })
        }
        Err(_) => Ok(PreferenceSuggestion {
            suggested_titles: vec![],
            suggested_genres: vec![],
            suggested_creators: vec![],
            reason: "AI 接続エラー".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn get_trending_keywords(
    state: tauri::State<'_, AppState>,
) -> CmdResult<Vec<highlights_service::TrendKeyword>> {
    highlights_service::get_trending_keywords(&state.db).await
}

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
    // 1. ローカル FTS 検索
    let local = fts_queries::search_articles(&state.db, &query, 20)
        .await
        .unwrap_or_else(|e| {
            tracing::warn!(error = %e, "FTS search failed, falling back to empty results");
            vec![]
        });

    // 2. ローカル結果が少ない or 質問形式 → AI 検索
    let is_question = query.contains('？') || query.contains('?') || query.ends_with("とは");
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
