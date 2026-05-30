use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

const MAX_CONNECTIONS: u32 = 5;
/// 並列書き込み (P1-4 の並列収集) で SQLITE_BUSY を即時エラーにせず待機させる。
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// Initialize the SQLite connection pool.
/// Runs migrations on first connect.
pub async fn init_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let url = format!("sqlite:{}?mode=rwc", db_path.display());

    // D-10: WAL + synchronous=NORMAL + busy_timeout を **全接続** に適用する。
    // 旧実装は接続後 PRAGMA を 1 接続にしか流せていなかった。connect_with で
    // プール内の全コネクションに設定が行き渡り、並列収集時の書き込み競合に耐える。
    let opts = SqliteConnectOptions::from_str(&url)?
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(BUSY_TIMEOUT);

    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect_with(opts)
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
