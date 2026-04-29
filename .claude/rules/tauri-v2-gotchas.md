---
description: otaku-pulse 固有の Tauri v2 補足（Mutex 禁止・個別 manage パターン）
globs: "src-tauri/**/*.rs"
---

# Tauri v2 注意点（otaku-pulse 固有）

共通の Tauri v2 落とし穴はグローバル `.claude/rules/tauri-v2-gotchas.md` を参照。
以下は otaku-pulse 固有のルール。

## Mutex\<AppState\> パターンは禁止

nexus では `Mutex<AppState>` を採用しているが、otaku-pulse では **禁止**。

**理由**: DB クエリ中に Mutex を保持すると他コマンドがブロックされ、デッドロックが発生した（実績あり）。

### 正しいパターン: 個別 manage()

```rust
// setup 時に個別登録
app.manage(db_pool);           // SqlitePool
app.manage(http_client);       // Arc<reqwest::Client>
app.manage(scheduler);         // Arc<JobScheduler>

// コマンドで個別取得
#[tauri::command]
pub async fn get_feeds(
    db: State<'_, SqlitePool>,
    client: State<'_, Arc<reqwest::Client>>,
) -> Result<Vec<Feed>, AppError> { ... }
```

### 禁止パターン

```rust
// NG: 一括 Mutex — 全フィールドがロックされてブロッキングが起きる
app.manage(Mutex::new(AppState { db, client, scheduler }));
```

`SqlitePool` は内部で接続プールを管理しており外部 Mutex は不要。
`Arc<reqwest::Client>` はスレッドセーフ。個別管理でデッドロック可能性がゼロになる。
