use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::models::DeepDiveResult;
use sqlx::SqlitePool;

/// 記事から深堀り質問を3件生成
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

/// 深堀り質問に回答（キャッシュ付き）
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
    let _ = sqlx::query(
        "INSERT OR REPLACE INTO deepdive_cache (article_id, question, answer, follow_ups, provider)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(article_id)
    .bind(question)
    .bind(&answer)
    .bind(&follow_ups_json)
    .bind(&provider_str)
    .execute(db)
    .await;

    Ok(DeepDiveResult {
        question: question.to_string(),
        answer,
        follow_up_questions: follow_ups,
        provider: provider_str,
        citations: response.citations,
    })
}

/// JSON配列のパース（エラー耐性あり）
fn parse_question_array(raw: &str) -> Vec<String> {
    // まず JSON として直接パース
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(raw) {
        return arr;
    }
    // JSON 部分を抽出
    if let Some(start) = raw.find('[')
        && let Some(end) = raw.rfind(']')
        && let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw[start..=end])
    {
        return arr;
    }
    // フォールバック: 行分割
    raw.lines()
        .filter(|l| !l.trim().is_empty())
        .take(3)
        .map(|l| {
            l.trim()
                .trim_matches(|c: char| c == '"' || c == '[' || c == ']' || c == ',')
                .to_string()
        })
        .collect()
}

/// 回答 + フォローアップ質問をパース
fn parse_answer_with_followups(raw: &str) -> (String, Vec<String>) {
    if let Some(idx) = raw.find("---FOLLOWUP---") {
        let answer = raw[..idx].trim().to_string();
        let followup_part = &raw[idx + 14..];
        let follow_ups = parse_question_array(followup_part);
        (answer, follow_ups)
    } else {
        (raw.trim().to_string(), vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_question_array_valid() {
        let input = r#"["質問1", "質問2", "質問3"]"#;
        let result = parse_question_array(input);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], "質問1");
    }

    #[test]
    fn test_parse_question_array_embedded() {
        let input = "Here are questions:\n[\"Q1\", \"Q2\", \"Q3\"]\nDone.";
        let result = parse_question_array(input);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_parse_answer_with_followups() {
        let input = "回答です。\n\n---FOLLOWUP---\n[\"追加1\", \"追加2\"]";
        let (answer, follow_ups) = parse_answer_with_followups(input);
        assert_eq!(answer, "回答です。");
        assert_eq!(follow_ups.len(), 2);
    }

    #[test]
    fn test_parse_answer_no_followups() {
        let input = "回答のみです。フォローアップなし。";
        let (answer, follow_ups) = parse_answer_with_followups(input);
        assert_eq!(answer, "回答のみです。フォローアップなし。");
        assert!(follow_ups.is_empty());
    }

    #[test]
    fn test_parse_question_array_malformed() {
        let input = "not json at all";
        let result = parse_question_array(input);
        assert!(!result.is_empty()); // fallback to line split
    }

    #[test]
    fn test_parse_question_array_empty() {
        let input = "";
        let result = parse_question_array(input);
        assert!(result.is_empty());
    }
}
