---
description: otaku-pulse Rust コマンドボイラープレートと登録手順
globs: "src-tauri/**/*.rs"
---

# otaku-pulse Rust 実装規約

汎用ルールはグローバル `.claude/rules/tauri-v2-gotchas.md` を参照。
Mutex 禁止・状態管理は `.claude/rules/tauri-v2-gotchas.md`（otaku-pulse 固有）参照。
AniList・Reddit・DB パターンは `.claude/rules/api-data-sources.md` / `db-patterns.md` 参照。

## 絶対ルール

- `unwrap()` 禁止（本番コード）→ `?` 演算子または `AppError` に変換
- `unsafe` 禁止
- `println!` / `dbg!` 禁止 → `tracing::info!` / `tracing::error!`
- エラー型は `src-tauri/src/error.rs` の `AppError` のみ
- `commands/` にビジネスロジックを書かない → `services/` に委譲

## コマンドボイラープレート

```rust
use crate::error::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeedItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub published_at: Option<String>,
}

#[tauri::command]
pub async fn fetch_feeds(
    db: tauri::State<'_, sqlx::SqlitePool>,
) -> Result<Vec<FeedItem>, AppError> {
    // services/ に委譲
    crate::services::feed::get_feeds(&db).await
}
```

登録: `src-tauri/src/lib.rs` の `invoke_handler![]` に追加すること。
権限: `src-tauri/capabilities/default.json` に `network:fetch` 等が必要な場合は追加。

## 4層アーキテクチャ

```
commands/  → Tauri ハンドラー（薄いラッパー、ロジック禁止）
services/  → ビジネスロジック（テスト可能な純粋関数中心）
infra/     → 外部 I/O（HTTP, DB, ファイルシステム）
parsers/   → フィード・BBCode パーサー（ステートレス変換のみ）
```

依存方向: `commands → services → infra / parsers`（逆方向禁止）

## 品質ゲート

```bash
cd src-tauri
cargo test
cargo clippy -- -D warnings
cargo fmt -- --check
```
