use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use sqlx::SqlitePool;

/// AI サマリーを取得（キャッシュあり）またはオンデマンド生成
pub async fn get_or_generate_summary(
    db: &SqlitePool,
    article_id: i64,
    llm: &dyn LlmClient,
) -> Result<String, AppError> {
    let cached: Option<(Option<String>,)> =
        sqlx::query_as("SELECT ai_summary FROM articles WHERE id = ?1")
            .bind(article_id)
            .fetch_optional(db)
            .await?;

    if let Some((Some(summary),)) = cached
        && !summary.is_empty()
    {
        return Ok(summary);
    }

    let row: (String, Option<String>, Option<String>) =
        sqlx::query_as("SELECT title, summary, content FROM articles WHERE id = ?1")
            .bind(article_id)
            .fetch_one(db)
            .await?;

    let (title, summary, content) = row;
    let source_text = content.as_deref().or(summary.as_deref()).unwrap_or("");

    if source_text.is_empty() {
        let fallback = format!("「{}」に関するニュース記事。", title);
        sqlx::query(
            "UPDATE articles SET ai_summary = ?1, ai_summary_generated_at = datetime('now')
             WHERE id = ?2",
        )
        .bind(&fallback)
        .bind(article_id)
        .execute(db)
        .await?;
        return Ok(fallback);
    }

    let req = LlmRequest::simple(
        "あなたはニュース記事の要約者です。\
            与えられたテキストの内容だけを要約すること。外部検索は使わないこと。\
            日本語で2〜3文の簡潔な要約を生成すること。\
            謝罪や注釈は絶対に書かないこと。"
            .to_string(),
        format!(
            "以下の記事を要約してください。\n\nタイトル: {}\n\n本文: {}",
            title,
            &source_text[..source_text.len().min(1500)]
        ),
        200,
    );

    let response = llm.complete(req).await?;
    let ai_summary = response.content.trim().to_string();

    sqlx::query(
        "UPDATE articles SET ai_summary = ?1, ai_summary_generated_at = datetime('now')
         WHERE id = ?2",
    )
    .bind(&ai_summary)
    .bind(article_id)
    .execute(db)
    .await?;

    Ok(ai_summary)
}
