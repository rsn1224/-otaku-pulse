use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::Path;

const MAX_CONNECTIONS: u32 = 5;

/// Initialize the SQLite connection pool.
/// Runs migrations on first connect.
pub async fn init_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect(&url)
        .await?;

    // D-10: WAL モードを有効化（マイグレーション実行前に設定する）
    // WAL モードにより並列読み取り性能が向上し、クラッシュ耐性も改善する
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA synchronous=NORMAL")
        .execute(&pool)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// @AC PERF-01: init_pool() 後に WAL モードが有効化されていることを確認
    #[tokio::test]
    async fn test_wal_mode_enabled() {
        let tmp_dir = std::env::temp_dir().join("otaku_test_wal");
        std::fs::create_dir_all(&tmp_dir).unwrap(); // テストコード: unwrap 許可
        let db_path = tmp_dir.join("test.db");

        // 既存テスト DB があれば削除して再作成
        let _ = std::fs::remove_file(&db_path);

        let pool = init_pool(&db_path).await.unwrap(); // テストコード: unwrap 許可

        let row: (String,) = sqlx::query_as("PRAGMA journal_mode")
            .fetch_one(&pool)
            .await
            .unwrap(); // テストコード: unwrap 許可

        assert_eq!(row.0, "wal", "journal_mode should be WAL after init_pool()");

        pool.close().await;
        std::fs::remove_dir_all(&tmp_dir).ok();
    }
}
