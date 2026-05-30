//! AI 事前生成 (収集後バックグラウンド)
//!
//! 過去24h のスコア上位記事について `ai_summary` / context_memo を**逐次**生成・キャッシュする。
//! 目的は「UI ロード経路から LLM を外す」こと: フィード表示時はキャッシュ/RSS 抜粋を即返し、
//! 重い生成はここで先に済ませておく。LLM 呼び出しは Ollama gate (ollama_client) で律速され、
//! 本関数は scheduler から detached バックグラウンドタスクとして呼ばれるため UI を一切ブロックしない。
//!
//! `get_or_generate_*` は cache-aware なので、既に生成済みの記事は LLM を呼ばずに skip する。

use crate::infra::llm_client::LlmClient;
use crate::services::{context_memo_service, summary_service};
use sqlx::SqlitePool;
use tracing::{info, warn};

/// 過去24h スコア上位の記事 ID を取得する (summary 用に最大 `limit` 件)。
async fn recent_top_ids(db: &SqlitePool, limit: i64) -> Vec<i64> {
    match sqlx::query_scalar::<_, i64>(
        "SELECT a.id FROM articles a
         LEFT JOIN article_scores s ON a.id = s.article_id
         WHERE a.is_duplicate = 0 AND a.published_at >= datetime('now', '-24 hours')
         ORDER BY COALESCE(s.total_score, a.importance_score) DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(db)
    .await
    {
        Ok(ids) => ids,
        Err(e) => {
            warn!(error = %e, "AI 事前生成: 対象記事の取得に失敗");
            Vec::new()
        }
    }
}

/// 上位記事の summary を `summary_limit` 件、context_memo を `memo_limit` 件まで事前生成する。
/// context_memo は展開時のみ表示されるため summary より少なめでよい。
pub async fn pregenerate_recent(
    db: &SqlitePool,
    llm: &dyn LlmClient,
    summary_limit: i64,
    memo_limit: i64,
) {
    let ids = recent_top_ids(db, summary_limit).await;
    if ids.is_empty() {
        return;
    }

    let mut summaries = 0u32;
    let mut memos = 0u32;

    for (i, id) in ids.iter().enumerate() {
        // cache-aware: 生成済みは LLM を呼ばず即返る。未生成のみ gate 経由で生成。
        match summary_service::get_or_generate_summary(db, *id, llm).await {
            Ok(_) => summaries += 1,
            Err(e) => warn!(article_id = id, error = %e, "AI 事前生成: summary 失敗"),
        }

        if (i as i64) < memo_limit {
            match context_memo_service::get_or_generate_context_memo(db, llm, *id).await {
                Ok(_) => memos += 1,
                Err(e) => warn!(article_id = id, error = %e, "AI 事前生成: context_memo 失敗"),
            }
        }
    }

    info!(summaries, memos, "AI 事前生成完了");
}
