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
