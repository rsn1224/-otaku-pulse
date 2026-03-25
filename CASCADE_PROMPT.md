# Cascade 宛て — P6: リリース準備（ファイル分割 + clippy 修正）

## プロジェクトパス

**`c:\Users\rsn12\dev\otaku-pulse`**

**⚠️ 作業前に必ず確認: `cd c:\Users\rsn12\dev\otaku-pulse && ls src-tauri/Cargo.toml`**

## 品質ベースライン

- cargo test: 58/58 パス
- tsc --noEmit: 0 エラー
- biome: 0 エラー / 17 warnings
- cargo clippy: 62 warnings

**壊したら即停止。テストが減ったら即停止。**

## ルール

1. `unwrap()` 禁止（テストコード内は理由コメント付きで許可）
2. `any` 禁止、`console.log` / `console.error` 禁止
3. `<button type="button">` 必須、SVG に `aria-hidden="true"`
4. `sqlx::query!` マクロ禁止 → `sqlx::query` ランタイム版
5. 分割後の全ファイル 200 行以下（テスト含む `#[cfg(test)] mod tests` は例外）
6. 各 Step 後に品質ゲート実行
7. 既存の pub 関数シグネチャを変更しない（呼び出し元を壊さない）

---

## Step 1: `src-tauri/src/commands/articles.rs` 分割 (324行 → 2ファイル)

**現状:** コマンド6個 + 型定義3個が1ファイルに混在。

**分割方針:**

### `src-tauri/src/commands/articles.rs` に残すもの (記事表示系):
- `ArticleQuery` 構造体
- `ArticleListResult` 構造体
- `ArticleRow` 構造体
- `get_articles` コマンド
- `mark_read` コマンド
- `mark_all_read` コマンド

### `src-tauri/src/commands/collect.rs` (新規、収集+ダイジェスト系):
- `CollectResult` 構造体
- `run_collect_now` コマンド
- `init_default_feeds` コマンド
- `DigestResult` 構造体
- `generate_digest` コマンド

### `src-tauri/src/commands/mod.rs` に追加:
```rust
pub mod collect;
```

→ **品質ゲート**: `cargo check --manifest-path src-tauri/Cargo.toml`

---

## Step 2: `src-tauri/src/services/feed_queries.rs` 分割 (317行 → 2ファイル)

**現状:** フィード操作クエリ + FTS5検索が1ファイル。

**分割方針:**

### `src-tauri/src/services/feed_queries.rs` に残すもの:
- `list_feeds`
- `list_articles`
- `upsert_articles`
- `update_feed_success`
- `update_feed_failure`
- `recent_articles_for_dedup`
- `mark_all_as_read`
- `mark_as_read`
- `toggle_bookmark`
- `reenable`
- `get_article_detail`
- `get_unread_count`

### `src-tauri/src/services/fts_queries.rs` (新規):
- `search_articles` 関数を移動
- 必要な import を追加:
```rust
use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::ArticleDto;
```

### `src-tauri/src/services/mod.rs` に追加:
```rust
pub mod fts_queries;
```

### 呼び出し元の更新:
`src-tauri/src/commands/feed.rs` の `search_articles` コマンドで:
```rust
// 変更前
use crate::services::feed_queries;
// ...
feed_queries::search_articles(...)

// 変更後
use crate::services::fts_queries;
// ...
fts_queries::search_articles(...)
```

→ **品質ゲート**: `cargo check --manifest-path src-tauri/Cargo.toml` + `cargo test --manifest-path src-tauri/Cargo.toml`

---

## Step 3: `src/components/settings/SchedulerSection.tsx` 分割 (367行 → 2ファイル)

**現状:** メインコンポーネント + 4つのサブコンポーネントが1ファイル。

**分割方針:**

### `src/components/settings/SchedulerSection.tsx` に残すもの:
- `SchedulerSectionProps` インターフェース
- `COLLECT_INTERVALS` 定数
- ヘルパー関数: `formatTime`, `getNextCollectTime`, `getNextDigestTime`
- `SchedulerSection` コンポーネント（メイン）

### `src/components/settings/SchedulerControls.tsx` (新規):
以下の4コンポーネントを移動:
- `SchedulerToggle`
- `CollectInterval`
- `DigestTime`
- `SchedulerStatus`

全て `export` を付けて named export にする。

### `SchedulerSection.tsx` の import 更新:
```typescript
import { SchedulerToggle, CollectInterval, DigestTime, SchedulerStatus } from './SchedulerControls';
```

→ **品質ゲート**: `npx tsc --noEmit` + `npx biome check src/`

---

## Step 4: clippy 警告修正 (62 warnings → 0 目標)

### 4-A: 自動修正を適用

```bash
cargo clippy --fix --lib -p otaku-pulse --manifest-path src-tauri/Cargo.toml --allow-dirty
```

これで 32 件が自動修正される（unused imports, auto-deref 等）。

### 4-B: 未使用変数の修正

以下の未使用変数にプレフィックス `_` を付ける:

| ファイル | 変数 | 修正 |
|---------|------|------|
| 各所 | `state` (5箇所) | `_state` |
| 各所 | `app_handle` (2箇所) | `_app_handle` |
| `commands/*.rs` | `index`, `http_client`, `hours`, `db`, `db_pool`, `client`, `category`, `api_key` | `_` プレフィックスを付ける |

### 4-C: 未使用関数・構造体の対応

以下に `#[allow(dead_code)]` を付ける（将来使用予定のため削除しない）:

| ファイル | 対象 |
|---------|------|
| `parsers/graphql_parser.rs` | `PageInfo` 構造体、`FuzzyDate` の `month`/`day` フィールド、`MediaCoverImage` の `medium`/`color` フィールド、`Media` の `end_date`/`banner_image`/`synonyms` フィールド、`MediaTitle` の `user_preferred` フィールド、`parse_anime_schedule` 関数 |
| `infra/reddit_fetcher.rs` | `RedditFetcher` 構造体と impl 全体、`calculate_reddit_importance` 関数 |
| `infra/rate_limiter.rs` | `MAX_RETRIES` 定数、`INITIAL_RETRY_DELAY_MS` 定数、`execute_with_retry` 関数 |
| `services/dedup_service.rs` | `is_duplicate` 関数 |
| `services/digest_queries.rs` | `insert_digest` 関数 |

**`#[allow(dead_code)]` の付け方:**
```rust
// 構造体・関数に付ける場合
#[allow(dead_code)]
fn some_unused_function() { ... }

// フィールドに付ける場合
pub struct Foo {
    #[allow(dead_code)]
    pub unused_field: String,
}
```

### 4-D: collapsible if の修正

`src-tauri/src/services/opml_service.rs` の2箇所:
```rust
// 変更前
if condition1 {
    if condition2 {
        // ...
    }
}

// 変更後
if condition1 && condition2 {
    // ...
}
```

### 4-E: match 簡略化

clippy が指摘する `match` → `.is_ok()` や `.unwrap_or_default()` への変換を適用。

→ **品質ゲート**: `cargo clippy --manifest-path src-tauri/Cargo.toml 2>&1 | grep "warning"` で 0 件確認

---

## 最終チェック

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npx biome check src/
```

**全パス必須。テスト数が 58 未満になっていたら即報告。**

## 完了後

1. 全チェックパス
2. 作成・変更ファイル一覧を報告
3. 各ファイルの行数を報告（`wc -l` で確認）
