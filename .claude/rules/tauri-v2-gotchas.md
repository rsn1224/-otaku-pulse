# Tauri v2 既知の落とし穴

## invoke() エラーは plain object

- `tauri::invoke()` が返すエラーは JavaScript の `Error` インスタンスではなく、**plain object** である
- `error instanceof Error` は常に `false` になる
- `error.stack` は存在しない

### 正しいハンドリング

```typescript
// OK: JSON.stringify で文字列化
try {
  await invoke("some_command");
} catch (error: unknown) {
  const message = typeof error === "object" && error !== null && "message" in error
    ? (error as { message: string }).message
    : JSON.stringify(error);
  logger.error({ error: message }, "Command failed");
}
```

```typescript
// NG: Error インスタンスとして扱う
try {
  await invoke("some_command");
} catch (error) {
  console.log(error.message); // undefined の可能性
  console.log(error.stack);   // 常に undefined
}
```

## invoke_handler 登録漏れ = サイレント失敗

- `#[tauri::command]` を定義しても、`invoke_handler` に登録しなければランタイムまでエラーが出ない
- コンパイルは通るが、フロントから invoke すると実行時エラーになる
- 新しいコマンドを追加したら、必ず `invoke_handler` への登録を確認する

## snake_case → camelCase 変換

- Rust の関数引数は `snake_case` で定義する
- TypeScript/JavaScript 側の `invoke()` 呼び出しでは `camelCase` に変換する

```rust
// Rust 側
#[tauri::command]
async fn get_feed_items(feed_id: i64, max_count: usize) -> Result<Vec<Item>, AppError> { ... }
```

```typescript
// TypeScript 側
await invoke("get_feed_items", { feedId: 1, maxCount: 50 });
```

## AppError のシリアライズ形式

- `AppError` は `serde::Serialize` を実装し、以下の形式でフロントに返す:

```json
{ "kind": "NotFound", "message": "Feed not found" }
```

- フロント側は `error.kind` と `error.message` で構造化アクセスする
- 全コマンドは `Result<T, AppError>`（型エイリアス: `CmdResult<T>`）を返す
- エラー種別: `Database`, `Http`, `FeedParse`, `Unauthorized`, `RateLimit`, `Network`, `Parse`, `InvalidInput`, `Llm`, `Scheduler`, `Keyring`, `Internal`

## `?` 演算子必須 / `unwrap()` 禁止

```rust
// OK
let data = fetch_feed(url).await?;

// NG — 本番コードでの unwrap() 禁止
let data = fetch_feed(url).await.unwrap();
```

## Mutex\<AppState\> パターンは禁止（otaku-pulse 固有）

nexus では `Mutex<AppState>` を採用しているが、otaku-pulse では **禁止**。

**理由**: DB クエリ中に Mutex を保持すると他コマンドがブロックされ、デッドロックが発生した（実績あり）。

### 正しいパターン: 個別 manage()

各リソースを独立して `app.manage()` で登録し、`State<T>` で個別に取得する。

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

**Why**: `SqlitePool` は内部で接続プールを管理しており外部 Mutex は不要。
`Arc<reqwest::Client>` はスレッドセーフ。個別管理でデッドロック可能性がゼロになる。
