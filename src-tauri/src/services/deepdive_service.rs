use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::DeepDiveResult;
use sqlx::SqlitePool;

use super::deepdive_helpers::{parse_answer_with_followups, parse_question_array};

pub async fn generate_questions(
    db: &SqlitePool,
    article_id: i64,
    llm: &dyn LlmClient,
) -> Result<Vec<String>, AppError> {
    let row: (String, Option<String>) =
        sqlx::query_as("SELECT title, summary FROM articles WHERE id = ?1")
            .bind(article_id)
            .fetch_one(db)
            .await?;

    let (title, summary) = row;
    let context = summary.as_deref().unwrap_or("");

    let req = LlmRequest::simple(
        "あなたはオタク向けニュースの質問生成AIです。\
            記事について、ユーザーが気になりそうな質問を3つ生成してください。\
            各質問は25文字以内で、具体的にしてください。\
            JSON配列で返してください: [\"質問1\", \"質問2\", \"質問3\"]"
            .to_string(),
        format!("タイトル: {}\nサマリー: {}", title, context),
        200,
    );

    let response = llm.complete(req).await?;
    let questions = parse_question_array(&response.content);

    Ok(questions)
}

pub async fn answer_question(
    db: &SqlitePool,
    article_id: i64,
    question: &str,
    llm: &dyn LlmClient,
) -> Result<DeepDiveResult, AppError> {
    // キャッシュチェック
    let cached: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT answer, follow_ups, provider FROM deepdive_cache
         WHERE article_id = ?1 AND question = ?2",
    )
    .bind(article_id)
    .bind(question)
    .fetch_optional(db)
    .await?;

    if let Some((answer, follow_ups_json, provider)) = cached {
        let follow_ups: Vec<String> = serde_json::from_str(&follow_ups_json).unwrap_or_default();
        return Ok(DeepDiveResult {
            question: question.to_string(),
            answer,
            follow_up_questions: follow_ups,
            provider: provider.unwrap_or_default(),
            citations: vec![],
        });
    }

    let row: (String, Option<String>) =
        sqlx::query_as("SELECT title, summary FROM articles WHERE id = ?1")
            .bind(article_id)
            .fetch_one(db)
            .await?;

    let (title, summary) = row;
    let context = summary.as_deref().unwrap_or("");

    let req = LlmRequest {
        system_prompt: "あなたはアニメ・ゲーム・漫画に詳しい情報アシスタントです。\
            質問に対して、正確で簡潔な回答を日本語で提供してください。\
            回答はMarkdown形式で、200文字以内にしてください。\
            回答の最後に、関連する追加質問を2つ提案してください。\
            形式:\n回答本文\n\n---FOLLOWUP---\n[\"追加質問1\", \"追加質問2\"]"
            .to_string(),
        user_prompt: format!(
            "元の記事:\nタイトル: {}\nサマリー: {}\n\n質問: {}",
            title, context, question
        ),
        max_tokens: 400,
        web_search: true,
        conversation: None,
    };

    let response = llm.complete(req).await?;
    let (answer, follow_ups) = parse_answer_with_followups(&response.content);
    let provider_str = format!("{:?}", llm.provider());

    // キャッシュに保存
    let follow_ups_json = serde_json::to_string(&follow_ups).unwrap_or_default();
    if let Err(e) = sqlx::query(
        "INSERT OR REPLACE INTO deepdive_cache (article_id, question, answer, follow_ups, provider)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(article_id)
    .bind(question)
    .bind(&answer)
    .bind(&follow_ups_json)
    .bind(&provider_str)
    .execute(db)
    .await
    {
        tracing::warn!(article_id, error = %e, "deepdive cache write failed");
    }

    Ok(DeepDiveResult {
        question: question.to_string(),
        answer,
        follow_up_questions: follow_ups,
        provider: provider_str,
        citations: response.citations,
    })
}
