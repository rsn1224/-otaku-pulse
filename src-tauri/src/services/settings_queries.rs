use crate::error::AppError;
use sqlx::SqlitePool;
use std::collections::HashMap;

const MAX_KEY_LENGTH: usize = 100;
const MAX_VALUE_LENGTH: usize = 10_000;

pub async fn load_settings(db: &SqlitePool) -> Result<HashMap<String, String>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;

    Ok(rows.into_iter().collect())
}

pub async fn upsert_setting(
    db: &SqlitePool,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let key = key.trim().to_string();
    if key.is_empty() || key.len() > MAX_KEY_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "設定キーは1〜{}文字で入力してください",
            MAX_KEY_LENGTH
        )));
    }
    if value.len() > MAX_VALUE_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "設定値が長すぎます（最大{}文字）",
            MAX_VALUE_LENGTH
        )));
    }

    sqlx::query(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(&key)
    .bind(&value)
    .execute(db)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    #[tokio::test]
    async fn test_upsert_and_load() {
        let db = setup_test_db().await;

        upsert_setting(&db, "theme".into(), "dark".into())
            .await
            .unwrap();

        let settings = load_settings(&db).await.unwrap();
        assert_eq!(settings.get("theme").unwrap(), "dark");
    }

    #[tokio::test]
    async fn test_upsert_overwrites() {
        let db = setup_test_db().await;

        upsert_setting(&db, "lang".into(), "en".into())
            .await
            .unwrap();
        upsert_setting(&db, "lang".into(), "ja".into())
            .await
            .unwrap();

        let settings = load_settings(&db).await.unwrap();
        assert_eq!(settings.get("lang").unwrap(), "ja");
        assert_eq!(settings.len(), 1);
    }

    #[tokio::test]
    async fn test_empty_settings() {
        let db = setup_test_db().await;

        let settings = load_settings(&db).await.unwrap();
        assert!(settings.is_empty());
    }

    #[tokio::test]
    async fn test_reject_empty_key() {
        let db = setup_test_db().await;

        let err = upsert_setting(&db, "".into(), "v".into())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_whitespace_key() {
        let db = setup_test_db().await;

        let err = upsert_setting(&db, "   ".into(), "v".into())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_too_long_key() {
        let db = setup_test_db().await;

        let long_key = "k".repeat(MAX_KEY_LENGTH + 1);
        let err = upsert_setting(&db, long_key, "v".into())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_reject_too_long_value() {
        let db = setup_test_db().await;

        let long_val = "v".repeat(MAX_VALUE_LENGTH + 1);
        let err = upsert_setting(&db, "key".into(), long_val)
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn test_key_is_trimmed() {
        let db = setup_test_db().await;

        upsert_setting(&db, "  trimmed  ".into(), "val".into())
            .await
            .unwrap();

        let settings = load_settings(&db).await.unwrap();
        assert!(settings.contains_key("trimmed"));
        assert!(!settings.contains_key("  trimmed  "));
    }
}
