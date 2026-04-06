/// コンテキスト AI メモサービス (v1.1 Phase F)
///
/// 記事ごとに過去の閲覧履歴を踏まえた1〜2文のコンテキストメモを LLM で生成し、
/// `article_context_memos` テーブルにキャッシュする。
/// キャッシュが存在する場合は再生成せず即返却する（明示的削除で再生成）。
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use sqlx::SqlitePool;
use tracing::{info, warn};

/// コンテキストメモを取得する。キャッシュがなければ生成してキャッシュする。
pub async fn get_or_generate_context_memo(
    db: &SqlitePool,
    llm: &dyn LlmClient,
    article_id: i64,
) -> Result<String, AppError> {
    // キャッシュ確認
    if let Some(cached) = get_cached_memo(db, article_id).await? {
        return Ok(cached);
    }

    // 記事タイトルを取得
    let title: Option<String> =
        sqlx::query_scalar("SELECT title FROM articles WHERE id = ?")
            .bind(article_id)
            .fetch_optional(db)
            .await?;

    let title = match title {
        Some(t) => t,
        None => return Err(AppError::InvalidInput(format!("article {article_id} not found"))),
    };

    // 過去5件の閲覧履歴（同カテゴリ or 全体）を取得
    let history: Vec<(String, String)> = sqlx::query_as(
        "SELECT a.title, ai.action
         FROM article_interactions ai
         JOIN articles a ON a.id = ai.article_id
         WHERE ai.article_id != ?
           AND ai.action IN ('open', 'bookmark', 'deepdive')
         ORDER BY ai.created_at DESC
         LIMIT 5",
    )
    .bind(article_id)
    .fetch_all(db)
    .await?;

    let memo = generate_memo(llm, &title, &history)
        .await
        .unwrap_or_else(|e| {
            warn!(article_id, error = %e, "コンテキストメモ生成失敗。フォールバックを使用");
            format!("「{title}」に関する記事です。")
        });

    // キャッシュに保存
    sqlx::query(
        "INSERT OR REPLACE INTO article_context_memos (article_id, memo, generated_at)
         VALUES (?1, ?2, datetime('now'))",
    )
    .bind(article_id)
    .bind(&memo)
    .execute(db)
    .await?;

    info!(article_id, "コンテキストメモ生成・キャッシュ完了");
    Ok(memo)
}

/// キャッシュされたメモを返す。存在しなければ None。
async fn get_cached_memo(db: &SqlitePool, article_id: i64) -> Result<Option<String>, AppError> {
    let memo: Option<String> =
        sqlx::query_scalar("SELECT memo FROM article_context_memos WHERE article_id = ?")
            .bind(article_id)
            .fetch_optional(db)
            .await?;
    Ok(memo)
}

/// LLM を使ってコンテキストメモを生成する。
async fn generate_memo(
    llm: &dyn LlmClient,
    title: &str,
    history: &[(String, String)],
) -> Result<String, AppError> {
    let history_text = if history.is_empty() {
        "（閲覧履歴なし）".to_string()
    } else {
        history
            .iter()
            .map(|(t, action)| {
                let action_label = match action.as_str() {
                    "bookmark" => "ブックマーク",
                    "deepdive" => "Deep Dive",
                    _ => "閲覧",
                };
                format!("・{action_label}: {t}")
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let system_prompt = "あなたはアニメ・マンガ・ゲームニュースのアシスタントです。\
        ユーザーの閲覧履歴を踏まえ、対象記事の文脈を1〜2文で簡潔に説明してください。\
        「前回は〜を確認済み」「継続して〜に関心を持っている」などの形式が適しています。"
        .to_string();

    let user_prompt = format!(
        "対象記事: {title}\n\n\
        最近の閲覧履歴:\n{history_text}\n\n\
        この記事の文脈メモを1〜2文で生成してください。"
    );

    let request = LlmRequest::simple(system_prompt, user_prompt, 150);
    let response = llm.complete(request).await?;

    // 余分な引用符・改行を除去
    let memo = response.content.trim().trim_matches('"').to_string();
    Ok(memo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    #[tokio::test]
    async fn get_cached_memo_returns_none_for_missing() {
        let db = setup_test_db().await;
        let result = get_cached_memo(&db, 9999).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn cached_memo_round_trip() {
        let db = setup_test_db().await;

        // article_context_memos テーブルに直接書き込んでキャッシュのラウンドトリップを検証
        // (外部キー制約は test_helpers では無効のため article_id=1 を直接使用)
        sqlx::query(
            "INSERT INTO article_context_memos (article_id, memo) VALUES (1, 'テストメモ')",
        )
        .execute(&db)
        .await
        .unwrap();

        let cached = get_cached_memo(&db, 1).await.unwrap();
        assert_eq!(cached, Some("テストメモ".to_string()));

        // 存在しない article_id は None
        let missing = get_cached_memo(&db, 999).await.unwrap();
        assert!(missing.is_none());
    }
}
