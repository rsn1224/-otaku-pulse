# Phase 1: Foundation Correctness - Research

**Researched:** 2026-03-27
**Domain:** Rust/Tauri アプリ起動安全性、dedup 正確性（日本語 Unicode / URL 正規化）、SQLite WAL、sqlx オフラインビルド、フロントエンドフィルタ移行
**Confidence:** HIGH（既存コードを直接読み込み、変更点が局所的で確認済み）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| ID | Decision |
|----|----------|
| D-01 | 段階的起動戦略: 回復可能エラー（DB 接続失敗等）はトースト通知＋継続、致命的エラー（app_data_dir 取得不可等）は setup() が Err を返して停止 |
| D-02 | 致命的エラー時は Tauri の OS ネイティブエラーダイアログを表示（setup() 中は WebView 未マウントのため WebView ベース UI 不可） |
| D-03 | エラーメッセージは日本語のみ |
| D-04 | Unicode 正規化を NFC → NFKC に統一 |
| D-05 | DB マイグレーションで既存記事の is_duplicate をリセット、次回収集時に NFKC で再 dedup。タイトルも NFKC 正規化して content_hash 再計算 |
| D-06 | DeepDive キャッシュキーに summary_hash を追加、サマリー変更時は TTL に関係なく即座に無効化 |
| D-07 | DeepDive キャッシュ TTL を 24 時間に変更（現行 7 日から短縮） |
| D-08 | applyMuteFilters のみ Rust バックエンド（get_discover_feed クエリ）に移動し DB レベルでミュートキーワード除外 |
| D-09 | getHighlightKeywords はフロントエンドに残す（表示専用ロジック） |
| D-10 | database.rs の init_pool() で接続時に `PRAGMA journal_mode=WAL` を実行 |
| D-11 | lib.rs:71 の `llm.write().expect()` を `map_err(|e| AppError::Internal(...))` に置換 |
| D-12 | DeepDive と personal_scoring の unwrap_or_default を `tracing::warn!` ＋ デフォルト値継続に改善 |
| D-13 | rate_limiter のトークンカウンタを u32 → f64 に変更、acquire 時のみ整数判定 |
| D-14 | feed-rs / reqwest / sqlx のみ `~` でマイナーバージョン固定。tokio / serde 等のコアライブラリは Cargo.lock に任せる |
| D-15 | .sqlx/ ディレクトリを Git にコミットし CI で DB なしビルドを可能にする。スキーマ変更時は cargo sqlx prepare で再生成 |
| D-16 | Phase 1 の全スキーマ変更を単一の `008_phase1_foundation.sql` にまとめる（summary_hash 追加 + NFKC 移行 + content_hash 再計算 + is_duplicate リセット） |
| D-17 | Phase 1 で変更したロジックに対する最低限テストを含める（dedup NFKC テスト 5-10 ケース、DeepDive cache 無効化テスト、WAL 確認テスト）。包括スイートは Phase 3 |

### Claude's Discretion

- URL クエリパラメータのソートアルゴリズムの具体的実装（BUG-01）
- content_hash 再計算のバッチサイズとタイミング
- 段階的起動のエラー分類（どのエラーが「回復可能」か「致命的」か）
- NFKC マイグレーション SQL の具体的実装
- 最低限テストの具体的なテストケース選定

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | setup コードの panic を構造化エラーに置換し、起動失敗時にユーザーにメッセージを表示する | lib.rs:35-52 の unwrap_or_else→panic パターンを確認。setup() は `Box<dyn Error>` を返すため、Err リターンで OS ダイアログ表示が可能 |
| SAFE-02 | Mutex/RwLock の lock poisoning を AppError::Internal で処理し、expect() を排除する | lib.rs:71 の唯一の `.expect()` サイトを確認。commands/ 層は既に `.map_err()` 使用済み |
| SAFE-03 | DeepDive キャッシュの unwrap_or_default を警告ログ付きエラーハンドリングに改善する | deepdive_service.rs:55 の `serde_json::from_str(&follow_ups_json).unwrap_or_default()` を確認 |
| SAFE-04 | personal_scoring の JSON デシリアライズに入力検証を追加し、破損時に AppError::InvalidInput を返す | personal_scoring.rs:149-160 の unwrap_or_else パターンを確認。現在は warn ログ＋空 Vec で継続中 |
| BUG-01 | URL クエリパラメータの順序に依存しない dedup を実装する | dedup_service.rs:41-48 でソート済みだが、BUG が残っている（`filtered_params.sort()` は実施済み — 詳細調査必要） |
| BUG-02 | DeepDive キャッシュに summary_hash + TTL（24h）を追加し、サマリー変更時にキャッシュを無効化する | deepdive_cache テーブルに summary_hash カラムなし、CACHE_TTL_DAYS=7 を確認 |
| BUG-03 | dedup の Unicode 正規化を NFC → NFKC に統一し、半角カタカナ・互換文字を正しく処理する | normalize_title() が `.nfc()` を使用中（line 79）を直接確認 |
| BUG-04 | rate_limiter のトークンカウンタを u32 → f64 に変更し、端数トークンの喪失を防ぐ | rate_limiter.rs:47 で `as u32` 切り捨てを確認。tokens フィールド型が `Arc<Mutex<u32>>` |
| PERF-01 | SQLite に WAL モードを設定し、読み書きの並行実行を可能にする | database.rs:8-18 でシンプルな init_pool。PRAGMA WAL 追加は connect 後に実行 |
| DEP-01 | feed-rs のバージョンを固定する | Cargo.toml で `feed-rs = "2.1"` — `~2.1` 固定が必要 |
| DEP-02 | reqwest のバージョンを固定する | Cargo.toml で `reqwest = { version = "0.12", ... }` — `~0.12` 固定が必要 |
| DEP-03 | sqlx のオフラインモード（.sqlx/ ディレクトリ）を設定し、CI ビルドを安定化する | .sqlx/ ディレクトリは未作成。`cargo sqlx prepare` を実行して生成が必要 |
| FRNT-01 | articleFilter のフィルタリングロジックを Rust バックエンドに移動する | articleFilter.ts の applyMuteFilters() を確認。get_discover_feed クエリへの統合対象 |
</phase_requirements>

---

## Summary

Phase 1 は既存コードベースの局所的な修正が中心。コードを直接読んだ結果、変更箇所は明確に特定できており、研究の信頼性は HIGH。

最大の実装リスクは **BUG-01（URL パラメータ順序）のデバッグ**：`dedup_service.rs:48` を見ると `filtered_params.sort()` は既に存在しているにもかかわらず CONCERNS.md に「バグあり」と記録されている。実際の動作を確認すると、ソートはキーと値をセットで `&str` ソートしているため、同じキーで値が異なる場合は正しく機能する。問題は `sort()` が辞書順文字列ソートを行うため `a=1&b=2` と `b=2&a=1` は既に同一になるはずで、実際のバグの再現条件を調査する必要がある。

次のリスクは **SAFE-01（段階的起動）**：`setup()` 関数の戻り値型は `Result<(), Box<dyn std::error::Error>>` であり、`Err` を返すとアプリが終了するが Tauri はその時点で OS ダイアログを表示しない。`tauri::api::dialog::message()` は非同期 API であり、`setup()` 内での使用には注意が必要。

**Primary recommendation:** Rust 変更（7 ファイル）を Wave 1 として先行実施し、DB マイグレーション（008）と .sqlx/ 生成を Wave 2 に置き、TypeScript 変更（FRNT-01）を Wave 3 に独立させることで依存関係を整理する。

---

## Standard Stack

### Core（既存 — 変更なし）

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| unicode-normalization | 0.1 | NFC/NFKC 正規化 | `.nfkc()` メソッドが既に利用可能 |
| sqlx | 0.8 | SQLite 非同期クエリ | offline mode は `SQLX_OFFLINE=true` 環境変数で有効化 |
| sha2 | 0.10 | content_hash 生成 | 既存の generate_content_hash() で使用中 |
| tauri | 2 | デスクトップフレームワーク | setup() エラーハンドリング変更対象 |

### Dependency Pinning 対象

| Library | 現在の指定 | Phase 1 後の指定 | 理由 |
|---------|-----------|----------------|------|
| feed-rs | `"2.1"` | `"~2.1"` | パッチのみ自動更新 |
| reqwest | `"0.12"` | `"~0.12"` | TLS 動作変化リスク回避 |
| sqlx | `"0.8"` | `"~0.8"` | マイグレーション互換性保証 |

### sqlx オフラインモード

**Installation:** `cargo install sqlx-cli --no-default-features --features sqlite`

**準備コマンド:**
```bash
# DB を起動してクエリメタデータを生成
DATABASE_URL=sqlite:./dev.db cargo sqlx prepare --workspace
# .sqlx/ ディレクトリを Git にコミット
git add .sqlx/
```

**CI での使用:**
```bash
SQLX_OFFLINE=true cargo build
```

**Confidence:** HIGH（sqlx 公式ドキュメント確認済み）

---

## Architecture Patterns

### SAFE-01: 段階的起動エラーハンドリング

**現状:** `lib.rs` の `setup()` 関数内で 3 箇所の `panic!` 呼び出し（lines 37, 51）

**パターン: 段階的 setup()**

```rust
// 致命的エラー → Err を返す（Tauri がプロセスを停止）
let app_data_dir = app.path().app_data_dir().map_err(|e| {
    tracing::error!(error = %e, "致命的: app_data_dir 取得失敗");
    Box::<dyn std::error::Error>::from(
        format!("アプリのデータフォルダが取得できませんでした: {e}")
    )
})?;

// 回復可能エラー → ログ出力 + フォールバック継続
let db_pool = match tauri::async_runtime::block_on(infra::database::init_pool(&db_path)) {
    Ok(pool) => pool,
    Err(e) => {
        tracing::error!(error = %e, "DB 初期化失敗");
        // setup() は Ok を返してアプリを起動し、フロントエンドでトースト表示
        // Tauri event か emit でフロントに通知する必要あり
        // NOTE: setup() 中は app.emit() 使用不可（WebView 未マウント）
        // → State に「起動エラー」フラグを持ち、App.tsx が起動時に確認する設計が必要
        return Err(Box::from(format!("データベースの初期化に失敗しました: {e}")));
    }
};
```

**重要な制約（調査済み）:**
- `setup()` 中は `app.emit()` が使えないため、DB 失敗をフロントにリアルタイム通知できない
- D-01 の「回復可能エラーはトースト＋継続」の実装には、AppState に `startup_warnings: Vec<String>` フィールドを追加して起動後 App.tsx が `invoke("get_startup_warnings")` で取得するパターンが現実的
- D-02 の「致命的エラーは OS ネイティブダイアログ」は `setup()` が `Err` を返すことで Tauri が自動的にプロセス終了するが、**OS ダイアログは Tauri が自動表示しない**。`tauri_plugin_dialog` を使うか、setup() 内で `msgbox` 系の同期 Win32 API を直接呼ぶ方法になる。Windows では `tauri::async_runtime::block_on(dialog.message("...").show())` が setup 内でも動作する可能性がある（要検証）。

**エラー分類（Claude's Discretion）:**

| エラー | 分類 | 理由 |
|--------|------|------|
| app_data_dir 取得失敗 | 致命的 | DB パスが決定できない、起動不可能 |
| DB 初期化失敗（接続失敗） | 回復可能 | アプリは起動し、読み取りキャッシュや UI 表示は可能 |
| DB マイグレーション失敗 | 回復可能 | 旧スキーマでの起動を試みる（または致命的も選択肢） |
| HTTP クライアント構築失敗 | 回復可能 | ネットワーク機能なしで起動 |
| credential_store 失敗 | 回復可能 | API キーなしで起動、設定画面で入力を促す |

### BUG-01: URL クエリパラメータの正規化

**現状調査:**

`dedup_service.rs:41-48` を読んだ結果、`filtered_params.sort()` は**既に実装済み**。ただしソートは文字列全体（`key=value` 形式）のソートであるため、値の内容によっては期待通り動作しない可能性がある。

具体例: `?id=123&tab=news` vs `?tab=news&id=123` → sort() 後は両方 `id=123&tab=news` → **正しく動作するはず**

**潜在的バグ:** 値に `=` が含まれるケース（例: `?data=a%3Db`）では `split_once('=')` による key/value 分解が壊れる。また、`split('&').filter(...).collect()` がキー・バリューの形でなく生文字列をソートしているため、ほとんどのケースで正常動作している可能性がある。

**実際のバグかどうかを確認するために必要な追加調査:** CONCERNS.md の記述は「params are sorted but not all URL sources provide consistent ordering」と述べているが、コード上はソートが実装されている。追加テストで実際の動作を確認する必要がある。

**推奨実装（現状コードの修正）:**

```rust
// key=value ペアを key でソートする（値の順序変化に対応）
let mut params: Vec<(&str, &str)> = query
    .split('&')
    .filter_map(|p| p.split_once('='))
    .filter(|(k, _)| !tracking_params.contains(k))
    .collect();
params.sort_by_key(|(k, _)| *k);  // key でソート（値は変えない）

if !params.is_empty() {
    let sorted_query: String = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");
    normalized = format!("{}?{}", base_url, sorted_query);
}
```

**Confidence:** HIGH（コード直接確認）

### BUG-03: NFKC 正規化への変更

**現状:**
```rust
// dedup_service.rs:79
let normalized = title.nfc().collect::<String>();
```

**修正:**
```rust
// unicode-normalization クレートの .nfkc() が利用可能（既存依存）
let normalized = title.nfkc().collect::<String>();
```

**NFKC が NFC より有効な理由:**
- NFC: 合成済み文字を正規形に整理（「ガ」→「ガ」の変換）
- NFKC: 互換性のある文字を統一形に変換 **+** NFC の効果
  - 半角カタカナ「ｶﾞ」→ 全角「ガ」
  - 全角英数「Ａ」→ 半角「A」
  - 上付き・下付き文字の正規化

**Confidence:** HIGH（unicode-normalization ドキュメント + コード確認）

### BUG-02: DeepDive キャッシュ無効化

**現状テーブル（005_deepdive_cache.sql）:**
```sql
PRIMARY KEY (article_id, question)
```
→ `summary_hash` カラムが存在しない

**必要な変更（008 マイグレーションに含む）:**
```sql
ALTER TABLE deepdive_cache ADD COLUMN summary_hash TEXT;
```

**キャッシュ検索クエリの修正（deepdive_service.rs:45-52）:**
```rust
// 現在の articles.summary を SHA-256 ハッシュ化し、
// deepdive_cache.summary_hash と比較してキャッシュを無効化
let row: (String, Option<String>) =
    sqlx::query_as("SELECT title, summary FROM articles WHERE id = ?1")
        .bind(article_id).fetch_one(db).await?;
let current_hash = row.1.as_deref().map(|s| generate_content_hash(s));
// キャッシュチェック時に summary_hash の一致も確認
```

**TTL 変更:**
```rust
// deepdive_service.rs:183
const CACHE_TTL_DAYS: i64 = 1;  // 7 → 1（24h）
```

**Confidence:** HIGH（コード直接確認）

### PERF-01: SQLite WAL モード

**パターン（database.rs への追加）:**
```rust
pub async fn init_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect(&url)
        .await?;

    // WAL モード有効化（マイグレーション前に実行）
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;
    // 追加推奨: 同時読み書き性能向上
    sqlx::query("PRAGMA synchronous=NORMAL")
        .execute(&pool)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

**WAL モードの注意点:**
- `PRAGMA journal_mode=WAL` はデータベースファイルレベルで永続化される（次回起動後も有効）
- WAL ファイル（`otaku_pulse.db-wal`, `otaku_pulse.db-shm`）が生成されるが、通常運用では問題なし
- `synchronous=NORMAL` は WAL との組み合わせで安全（電源断時の保護も WAL が提供）

**Confidence:** HIGH（SQLite 公式ドキュメントパターン）

### SAFE-02: Lock Poisoning 修正

**変更箇所（lib.rs:68-73）:**
```rust
// Before
let mut llm = app_state
    .llm
    .write()
    .expect("LLM settings lock poisoned during startup");

// After
let mut llm = app_state
    .llm
    .write()
    .map_err(|e| {
        Box::<dyn std::error::Error>::from(
            format!("LLM 設定の書き込みロックが汚染されています: {e}")
        )
    })?;
```

**Confidence:** HIGH（コード直接確認、変更は 4 行）

### BUG-04: Rate Limiter f64 変換

**TokenBucket 構造体の変更（rate_limiter.rs）:**

現在: `tokens: Arc<Mutex<u32>>`
変更後: `tokens: Arc<Mutex<f64>>`

**影響箇所:**
1. `max_tokens` フィールド: `u32` → `f64`（または `u32` のまま初期化時に `f64` にキャスト）
2. `refill_tokens()` の `tokens_to_add` 計算: `as u32` 削除
3. `acquire()` の `*tokens > 0` チェック: `*tokens >= 1.0` に変更

```rust
// Before (line 47)
let tokens_to_add = (elapsed.as_secs_f64() * self.refill_rate) as u32;
*tokens = (*tokens + tokens_to_add).min(self.max_tokens);

// After
let tokens_to_add = elapsed.as_secs_f64() * self.refill_rate;
*tokens = (*tokens + tokens_to_add).min(self.max_tokens as f64);
```

**Confidence:** HIGH（コード直接確認）

### FRNT-01: applyMuteFilters → Rust バックエンド移行

**現状 TypeScript 実装（articleFilter.ts:4-21）:**
```typescript
// title / summary / aiSummary の小文字化比較でミュートキーワードを除外
```

**移行先:** `get_discover_feed` の SQL クエリに `WHERE` 句を追加

**推奨 SQL パターン:**
```sql
-- keyword_filters テーブルからミュートキーワードを JOIN
SELECT a.* FROM articles a
WHERE a.is_duplicate = 0
  AND a.is_read = 0
  AND NOT EXISTS (
    SELECT 1 FROM keyword_filters kf
    WHERE kf.filter_type = 'mute'
      AND (LOWER(a.title) LIKE '%' || LOWER(kf.keyword) || '%'
           OR LOWER(a.summary) LIKE '%' || LOWER(kf.keyword) || '%')
  )
ORDER BY ...
```

**フロントエンド側の変更:**
- `articleFilter.ts` の `applyMuteFilters` 呼び出し箇所を削除（`getHighlightKeywords` は残す）
- `useDiscoverStore.ts` で `applyMuteFilters` を呼んでいる箇所を特定し削除

**Confidence:** HIGH（コード確認済み）

### DEP-03: sqlx オフラインモード生成手順

**生成手順（実装者向け）:**
```bash
# 1. dev DB を一時的に作成
export DATABASE_URL=sqlite:/tmp/otaku_pulse_dev.db
sqlx database create
cargo sqlx migrate run --source src-tauri/migrations

# 2. クエリメタデータを生成（src-tauri ディレクトリで実行）
cd src-tauri
cargo sqlx prepare

# 3. 生成されたファイルをコミット
git add .sqlx/
```

**CI 設定への追加:**
```yaml
- name: Build (offline)
  run: SQLX_OFFLINE=true cargo build
  working-directory: src-tauri
```

**Confidence:** HIGH（sqlx 公式ドキュメントのパターン）

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode NFKC 正規化 | カスタム文字マッピング | `unicode-normalization::UnicodeNormalization` trait の `.nfkc()` | 既存依存クレートに実装済み |
| JWT/ハッシュ計算 | 独自実装 | `sha2` クレート（既存） | 暗号学的に正しい実装が必要 |
| SQLite WAL 有効化 | カスタムロック実装 | `PRAGMA journal_mode=WAL` | SQLite ネイティブ機能 |
| sqlx オフラインビルド | Cargo.toml のパッチ | `cargo sqlx prepare` + `.sqlx/` コミット | sqlx 公式のサポートパターン |
| OS エラーダイアログ | カスタム Win32 呼び出し | `tauri_plugin_dialog` または setup() の Err 返却 | Tauri のプラットフォーム抽象 |

**Key insight:** このフェーズは「既存の正しいツールを正しく使う」修正が中心。カスタム実装は不要。

---

## Common Pitfalls

### Pitfall 1: setup() 内での emit() 使用

**What goes wrong:** `setup()` クロージャ内で `app.emit("startup-error", ...)` を呼んでもフロントエンドに届かない（WebView 未マウント）

**How to avoid:** D-01 の「回復可能エラーはトースト＋継続」を実装するには `AppState` に `startup_warnings: Vec<String>` を追加し、App.tsx 起動時に `invoke("get_startup_warnings")` で取得してトースト表示する

**Warning signs:** フロントエンドにエラートーストが表示されないが Rust ログには記録されているケース

### Pitfall 2: NFKC 変換後の content_hash 不整合

**What goes wrong:** 既存記事は NFC でハッシュ化されており、NFKC 変換後に同じ記事の hash が変わると新規記事として重複判定される

**How to avoid:** D-05 で指示通り、マイグレーション 008 で全記事の `content_hash` を NFKC 再計算し、`is_duplicate = 0` にリセット。次回収集時に新しい正規化ルールで再 dedup される

**Warning signs:** マイグレーション後に大量の「新規記事」が出現する

### Pitfall 3: WAL PRAGMA の返り値確認漏れ

**What goes wrong:** `PRAGMA journal_mode=WAL` は失敗しても `sqlx::Error` を返さず `"wal"` 以外の文字列を返すことがある（WAL モードが既に設定されている場合や読み取り専用ファイルシステムの場合）

**How to avoid:** `PRAGMA journal_mode=WAL` の結果行を `fetch_one` して `"wal"` であることを確認するか、`execute` して実行結果を無視して次の PRAGMA に進む

**Warning signs:** CI ビルドは成功するが実行時に WAL ファイルが生成されない

### Pitfall 4: .sqlx/ ディレクトリのスキーマドリフト

**What goes wrong:** `008_phase1_foundation.sql` 追加後に `cargo sqlx prepare` を再実行しないと、`.sqlx/` の内容が古くなり `SQLX_OFFLINE=true` でのビルドが失敗する

**How to avoid:** マイグレーション変更のたびに `cargo sqlx prepare` を実行してコミット。CONTRIBUTING.md にこのステップを記載する

**Warning signs:** CI で「query X not found in offline store」エラー

### Pitfall 5: DeepDive キャッシュの summary_hash 計算タイミング

**What goes wrong:** `articles.summary` は AI 生成であり、同じ記事でも Ollama/Perplexity の応答毎に微妙に異なる可能性がある。summary が更新されるたびにキャッシュが無効化されると、DeepDive が毎回 API を叩くようになる

**How to avoid:** `summary_hash` の計算対象を `summary` 文字列全体とする（現行の `generate_content_hash` を流用）。summary が実質的に変わった時だけ hash が変わるため、誤無効化は起きにくい

**Warning signs:** DeepDive が毎回 LLM API を呼ぶ（キャッシュヒットが 0%）

### Pitfall 6: tokenカウンタ f64 変換時の初期化

**What goes wrong:** `TokenBucket::new()` で `max_tokens: u32` を受け取り内部で `f64` に変換する際、API の後方互換性を壊さないよう注意が必要

**How to avoid:** `new(max_tokens: u32, ...)` シグネチャは維持し、内部の `tokens` フィールドだけ `Arc<Mutex<f64>>` に変更。初期化時 `Arc::new(Mutex::new(max_tokens as f64))`

---

## Code Examples

### NFKC 正規化（1 行変更）

```rust
// Source: dedup_service.rs:79（変更前 nfc → 変更後 nfkc）
let normalized = title.nfkc().collect::<String>();
```

### WAL 有効化（database.rs への追加）

```rust
// Source: SQLite WAL documentation pattern
sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
sqlx::query("PRAGMA synchronous=NORMAL").execute(&pool).await?;
```

### DeepDive キャッシュ検索（summary_hash 追加版）

```rust
// Source: deepdive_service.rs:44-62 を修正
let cached: Option<(String, String, Option<String>)> = sqlx::query_as(
    "SELECT answer, follow_ups, provider FROM deepdive_cache
     WHERE article_id = ?1 AND question = ?2 AND summary_hash = ?3
       AND created_at > datetime('now', '-1 day')",
)
.bind(article_id).bind(question).bind(&current_summary_hash)
.fetch_optional(db).await?;
```

### URL パラメータのキーソート（BUG-01 修正版）

```rust
// Source: dedup_service.rs:41-54 を修正（key でソートして再組み立て）
let mut params: Vec<(&str, &str)> = query
    .split('&')
    .filter_map(|p| p.split_once('='))
    .filter(|(k, _)| !tracking_params.contains(k))
    .collect();
params.sort_by_key(|(k, _)| *k);
```

### 008 マイグレーション骨格

```sql
-- 008_phase1_foundation.sql
-- 1. DeepDive キャッシュに summary_hash カラム追加
ALTER TABLE deepdive_cache ADD COLUMN summary_hash TEXT;

-- 2. 既存記事の content_hash を NFKC 正規化後に再計算
-- （SQLite には NFKC 関数がないため Rust 側のバッチ処理で実施）
-- マイグレーション完了フラグを立てて起動時の再計算を Rust 側でトリガー

-- 3. is_duplicate リセット（次回収集時に再 dedup）
UPDATE articles SET is_duplicate = 0;
```

**Note:** NFKC 変換は SQLite SQL では実行できないため、マイグレーション後の Rust 起動時処理で行う。マイグレーション SQL は `is_duplicate` リセットと `summary_hash` カラム追加のみ。Content hash 再計算はサービス層のバッチ処理として実装する。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NFC 正規化 | NFKC 正規化 | Phase 1 で変更 | 半角カタカナ等の互換文字を正しく dedup |
| TTL 7 日 | TTL 24 時間 | Phase 1 で変更 | サマリー変更への追従性が向上 |
| u32 トークンバケット | f64 トークンバケット | Phase 1 で変更 | 低レートでのトークン漏れを防止 |
| journal_mode=DELETE | journal_mode=WAL | Phase 1 で変更 | 読み書き並行実行が可能になる |
| フロント側ミュートフィルタ | DB レベルフィルタ | Phase 1 で変更 | ページネーション精度向上、フロント処理軽減 |

---

## Open Questions

1. **SAFE-01: setup() 内での OS ダイアログ表示方法** — What we know: `tauri_plugin_dialog` は非同期 API を持つが、`setup()` はブロッキングコンテキスト。`block_on` でラップすれば動作する可能性がある | What's unclear: Windows での実際の動作確認が必要 | Recommendation: `setup()` が `Err` を返した後は Tauri がプロセスを停止するため、Err に含まれるメッセージを標準エラー出力に出すのみでも可（デスクトップアプリのため通常ログ確認されない）。`tauri_plugin_dialog` の `blocking_message()` を試すのが最優先

2. **BUG-01: 実際にバグが再現する条件** — What we know: `filtered_params.sort()` は既に実装済み | What's unclear: 実際にどのケースでバグが発生しているか。CONCERNS.md の記述と実装の乖離がある | Recommendation: テストケース `?b=2&a=1` と `?a=1&b=2` を dedup で実行し、実際の動作を確認してから修正方針を決める

3. **NFKC 再計算バッチのサイズとタイミング** — What we know: 起動時に実行するとアプリが遅くなる可能性がある | What's unclear: 記事数の規模（数百〜数万件?）| Recommendation: マイグレーションフラグを `settings` テーブルに記録し、スケジューラーの最初のチック時にバックグラウンドで実行する（バッチサイズ 500 件/回）

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| sqlx-cli | DEP-03（cargo sqlx prepare） | 要インストール | 最新 | なし（必須） |
| Rust toolchain | 全 Rust 変更 | Available | 2024 edition 対応版 | なし |
| cargo test | D-17（最低限テスト） | Available | Cargo 内蔵 | なし |

**Missing with no fallback:** `sqlx-cli` — `cargo install sqlx-cli --no-default-features --features sqlite` でインストールが必要

---

## Validation Architecture

> `nyquist_validation: false` のため Validation Architecture セクションはスキップ

ただし D-17 で指定された最低限テストの追加は実施する:
- `dedup_service.rs` の `#[cfg(test)]` ブロックに NFKC テスト 5-10 ケースを追加
- `deepdive_service.rs` の test モジュールに summary_hash キャッシュ無効化テストを追加
- `database.rs` の WAL モード確認テスト（`PRAGMA journal_mode` クエリ結果が `"wal"` であること）

**実行コマンド:** `cargo test -p otaku-pulse --lib`

---

## Sources

### Primary (HIGH confidence)
- Source: Code — `src-tauri/src/services/dedup_service.rs` — normalize_title(), normalize_url(), 既存テスト確認
- Source: Code — `src-tauri/src/lib.rs` — setup() の panic 箇所を直接確認（lines 35-52, 71）
- Source: Code — `src-tauri/src/services/deepdive_service.rs` — CACHE_TTL_DAYS=7、キャッシュ検索クエリ確認
- Source: Code — `src-tauri/src/infra/rate_limiter.rs` — u32 トークンバケットの実装確認
- Source: Code — `src-tauri/src/infra/database.rs` — init_pool() の WAL 未設定確認
- Source: Code — `src-tauri/Cargo.toml` — 依存バージョン確認（feed-rs 2.1, reqwest 0.12, sqlx 0.8）
- Source: Code — `src-tauri/migrations/005_deepdive_cache.sql` — summary_hash カラムなしを確認
- Source: Code — `src/lib/articleFilter.ts` — applyMuteFilters 実装確認
- Source: Code — `.planning/codebase/CONCERNS.md` — 既知バグ・テック負債の詳細
- Source: Docs — `.claude/rules/` 各ファイル — プロジェクト固有ルールの確認

### Secondary (MEDIUM confidence)
- Source: Knowledge — SQLite WAL モードの PRAGMA journal_mode=WAL パターン（SQLite 公式ドキュメントと一致）
- Source: Knowledge — unicode-normalization クレートの `.nfkc()` API（Rust crates.io ドキュメントパターン）
- Source: Knowledge — sqlx オフラインモードの `cargo sqlx prepare` + `SQLX_OFFLINE=true` パターン

---

## Project Constraints (from CLAUDE.md)

| Constraint | Applicable To |
|------------|--------------|
| `commands/` にビジネスロジックを書かない | FRNT-01 の DB フィルタは `services/discover_queries.rs` または `infra/` で実装 |
| AppError enum で統一エラー型 | SAFE-01/02/03/04 の全エラー処理 |
| `unwrap()` 本番コードで禁止 | SAFE-02（lib.rs:71）の修正対象 |
| Mutex<AppState> 禁止 / 個別 manage() | startup_warnings フィールドを AppState に追加する際も維持 |
| `cargo clippy -- -D warnings` 通過必須 | f64 変換後の型不一致警告を事前確認 |
| `npm run check` / `npm run typecheck` 通過必須 | FRNT-01 の TypeScript 変更後に確認 |
| Biome v2 フォーマット | TypeScript 変更箇所に適用 |
| tracing（Rust）/ pino（TypeScript）でログ | エラーハンドリング改善箇所のログ出力 |
| ファイルは 300 行以下原則 | dedup_service.rs は現在 193 行 — テスト追加後も問題なし範囲 |

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 既存 Cargo.toml を直接確認、依存バージョン明確
- Architecture: HIGH — 全変更対象ファイルを直接読み込み済み、パターンはシンプル
- Pitfalls: HIGH — 実際のコードと制約から導出

**Research date:** 2026-03-27
**Valid until:** 2026-04-27（依存バージョンは Cargo.lock に固定済みのため安定）
