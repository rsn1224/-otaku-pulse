# Mutex<AppState> パターンは禁止

## 背景

nexus プロジェクトで `Mutex<AppState>` を使用した結果、以下の問題が発生した:

- **長時間ロック** — DB クエリ中に Mutex を保持し、他の全コマンドがブロックされた
- **デッドロック** — 複数コマンドが異なる順序で State にアクセスし、デッドロック発生

## 正しいパターン: 個別 manage()

各リソースを独立して `app.manage()` で登録し、Tauri の `State<T>` で個別に取得する。

```rust
// setup 時に個別登録
fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let db_pool = SqlitePool::connect("...").await?;
    let http_client = Arc::new(reqwest::Client::new());
    let scheduler = Arc::new(JobScheduler::new().await?);

    app.manage(db_pool);           // SqlitePool
    app.manage(http_client);       // Arc<reqwest::Client>
    app.manage(scheduler);         // Arc<JobScheduler>

    Ok(())
}
```

```rust
// コマンドで個別取得
#[tauri::command]
pub async fn get_feeds(
    db: State<'_, SqlitePool>,
    client: State<'_, Arc<reqwest::Client>>,
) -> Result<Vec<Feed>, AppError> {
    // db と client を個別に借用。互いにブロックしない
    services::feed::list_feeds(&db, &client).await
}
```

## 禁止パターン

```rust
// NG: 一括 Mutex
struct AppState {
    db: SqlitePool,
    client: reqwest::Client,
    scheduler: JobScheduler,
}
app.manage(Mutex::new(AppState { ... }));

// NG: コマンドで Mutex をロック
async fn get_feeds(state: State<'_, Mutex<AppState>>) -> Result<...> {
    let s = state.lock().await;  // 全フィールドがロックされる
    ...
}
```

## なぜ個別管理が安全か

- 各リソースが独立しているため、DB アクセス中でも HTTP クライアントは自由に使える
- `SqlitePool` は内部で接続プールを管理しており、外部 Mutex は不要
- `Arc<reqwest::Client>` はスレッドセーフで、クローンしても接続プールを共有する
- デッドロックの可能性がゼロになる
