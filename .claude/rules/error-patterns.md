# エラー型パターン（AppError）

## AppError → { kind, message }

`AppError` は `serde::Serialize` を実装し、フロントエンドに以下の形式で返す:

```json
{ "kind": "NotFound", "message": "Feed not found" }
```

## エラーハンドリング: `?` 演算子必須

```rust
// OK
let data = fetch_feed(url).await?;

// NG — 本番コードでの unwrap() 禁止
let data = fetch_feed(url).await.unwrap();
```

## エラー種別

`Database`, `Http`, `FeedParse`, `Unauthorized`, `RateLimit`, `Network`, `Parse`, `InvalidInput`, `Llm`, `Scheduler`, `Keyring`, `Internal`

## Tauri コマンドの戻り値

全コマンドは `Result<T, AppError>`（型エイリアス: `CmdResult<T>`）を返す。

## フロントエンド側のハンドリング

```typescript
try {
  await invoke("some_command");
} catch (error: unknown) {
  const message = typeof error === "object" && error !== null && "message" in error
    ? (error as { message: string }).message
    : JSON.stringify(error);
  logger.error({ error: message }, "Command failed");
}
```

- `invoke()` のエラーは `Error` インスタンスではなく plain object
- `error.stack` は存在しない（Tauri v2 の仕様）
