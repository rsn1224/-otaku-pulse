# Phase 2: Resilience & Security - Research

**Researched:** 2026-03-28
**Domain:** Tokio cancellation / Tauri v2 lifecycle / SQLite WAL safety / API key log hygiene / OPML URL validation
**Confidence:** HIGH (codebase verified) / MEDIUM (Tauri shutdown API)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**グレースフルシャットダウン (RESL-01)**
- D-01: CancellationToken は collect_loop と digest_loop で共有する単一トークン。`tauri::State<CancellationToken>` として独立管理（AppState 内に入れない）
- D-02: 進行中の HTTP リクエスト（フィード収集）は CancellationToken 発火で即時キャンセルする。取得途中の記事は破棄（DB に未書き込みのためデータ破損なし）
- D-03: 進行中の DB 書き込み（insert_articles_batch）は完了まで待つ。WAL モードでもトランザクション完了を保証する
- D-04: シャットダウンシーケンス: CancellationToken 発火 → HTTP 即時中断 + DB 書き込み完了待ち → 5秒タイムアウト → tokio::runtime 強制終了（プロセスハング防止）
- D-05: Tauri の window close イベントからシャットダウンシーケンスを起動する

**設定ホットリロード (RESL-02)**
- D-06: SchedulerConfig を `Arc<RwLock<SchedulerConfig>>` でラップし、AppState と同じパターンで管理する
- D-07: 設定変更時に Tauri event（`scheduler-config-changed`）を emit し、稼働中の collect_loop / digest_loop がイベントを受信して動的に反映する

### Claude's Discretion

- ホットリロードの対象フィールド範囲（collect_interval, digest_hour, digest_minute, enabled の全フィールドを即時反映するか、一部は次回ループから反映するか）
- RSS パースエラーの可視化方法（RESL-03）: エラー粒度（フィード単位 vs 記事単位）、Settings 画面での表示形式、自動無効化ポリシー（consecutive_errors カラムは既存）
- LLM プロバイダー切り替え安全化（RESL-04）: 進行中の DeepDive 会話の保護方法
- オフラインモード（RESL-05）: ネットワークエラー検知方法、72h キャッシュからのフォールバック表示、ユーザーへの通知方法（バナー or トースト）、デグレード範囲、復帰検知の仕組み
- SEC-01: Perplexity API キーのログ漏洩テスト追加
- SEC-02: user profile JSON のサイズ制限値（DB CHECK 制約 + UI 入力制限の具体的な上限値）
- SEC-03: OPML インポートの URL バリデーション（http/https スキーム限定、長さ制限、悪意あるプロトコルブロック）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESL-01 | scheduler の collect_loop / digest_loop に CancellationToken を導入し、グレースフルシャットダウンを実装する | tokio-util 0.7.18 CancellationToken API verified; Tauri window close hook pattern documented |
| RESL-02 | SchedulerConfig を Arc\<RwLock\> でラップし、設定変更を Tauri event で稼働中ループに即時通知する | Arc\<RwLock\<SchedulerConfig\>\> パターンは AppState.llm で既存実績あり |
| RESL-03 | RSS パースエラーを (成功記事, 失敗記事, エラー) のタプルで返し、フィードエラーを可視化する | consecutive_errors / disabled_reason / last_error カラムが feeds テーブルに既存 |
| RESL-04 | LLM プロバイダー切り替え時に進行中の DeepDive 会話を保護する（プロバイダー ID 検証） | AppState.llm Arc\<RwLock\<LlmSettings\>\> で provider フィールドが既存 |
| RESL-05 | オフラインモード: API 不達時にキャッシュ済みコンテンツ（72h TTL）で動作する | rss_fetcher.rs の AppError::Network / Http が起点; articles テーブルに created_at あり |
| SEC-01 | Perplexity API キーがエラーログに出力されないことを監査し、テストで検証する | perplexity_client.rs 確認済み: reqwest::Error は生ヘッダーを露出しない |
| SEC-02 | user profile JSON に DB レベルのサイズ制限（CHECK 制約）と UI 入力制限を追加する | user_profile テーブルの favorite_* 列が TEXT 型で制約なし（migration 004 確認） |
| SEC-03 | OPML インポート時に URL バリデーション（http/https スキーム、有効なホスト名）を実施する | opml_service.rs の parse_opml() が URL をそのまま受け入れることを確認 |
</phase_requirements>

---

## Summary

Phase 2 は 8 つの要件を 5 ドメインに分けて実装する。最も複雑な実装は RESL-01（グレースフルシャットダウン）で、`tokio-util` の `CancellationToken` を `tokio::select!` と組み合わせてスケジューラーループに組み込む必要がある。`tokio-util 0.7.18` はすでに推移的依存として存在しており、`Cargo.toml` に明示追加するだけで使える。

RESL-02（ホットリロード）は `AppState.llm` での `Arc<RwLock<LlmSettings>>` パターンと完全に同一構造であり、`SchedulerConfig` に同パターンを適用するだけで実装できる。`tokio::sync::watch` チャネルは「1 writer, N readers」型のブロードキャストに最適だが、D-07 の決定（Tauri event 経由）に従い、スケジューラーループ側で `tokio::sync::watch::Receiver` を購読するアプローチも有効。

Tauri v2 のウィンドウクローズ割り込みは `on_window_event(|event| ...)` の `WindowEvent::CloseRequested` で取得できるが、`api.prevent_close()` の同期制約のため、非同期シャットダウンシーケンスを起動したうえで `app_handle.exit(0)` を別タスクから呼ぶ必要がある。

**Primary recommendation:** CancellationToken は `tokio-util` から取り込み、`lib.rs` の `run_setup()` で生成・`app.manage()` し、scheduler の `start()` 関数に渡す。Tauri の `on_window_event` フックで `prevent_close()` → 非同期シャットダウンタスク起動 → 5 秒タイムアウト → `app_handle.exit(0)` の順で実装する。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio-util | 0.7.18 | CancellationToken（RESL-01） | 既に推移的依存; tokio 公式エコシステム |
| tokio::sync::watch | 1.x (tokio) | SchedulerConfig ホットリロード通知（RESL-02） | N readers へのブロードキャスト; tokio 同梱 |
| std::sync::Arc\<RwLock\> | stdlib | SchedulerConfig 共有状態（RESL-02） | AppState.llm と同一パターン |
| url (crate) | 2.5 | OPML URL バリデーション（SEC-03） | RFC 3986 準拠; reqwest も内部使用 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tokio::time::timeout | 1.x | 5 秒シャットダウンタイムアウト（RESL-01） | CancellationToken と組み合わせ |
| tokio::select! | 1.x | ループ内キャンセル選択（RESL-01） | `.cancelled()` future との併用 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tokio-util CancellationToken | tokio::sync::CancellationToken | 同等機能。tokio 1.36+ に実験的追加済みだが stable でない |
| watch チャネル for config | Tauri event のみ | Tauri event だと Rust 内部ループへの通知に marshal コストが発生する |
| url crate for validation | 手動 str 検査 | url crate は RFC 3986 準拠; 手動検査はバグリスクが高い |

**Installation:** Cargo.toml に以下を追加:
```toml
tokio-util = { version = "0.7", features = ["rt"] }
url = "2.5"
```

**Version verification:** `tokio-util 0.7.18` は `cargo tree` で確認済み（推移的依存）。`url` crate は現時点で未使用。

---

## Architecture Patterns

### Recommended Project Structure（変更対象のみ）

```
src-tauri/src/
├── lib.rs                    # CancellationToken 生成・manage() 追加、on_window_event フック
├── state.rs                  # AppState に SchedulerConfig Arc<RwLock> 追加
├── services/
│   └── scheduler.rs          # start() に CancellationToken + watch::Receiver 受け取り
│                             # collect_loop / digest_loop に tokio::select! 追加
│   └── collector.rs          # refresh_all() 戻り値変更: u32 → (u32, Vec<FeedError>)
├── commands/
│   └── scheduler.rs          # set_scheduler_config() に watch::Sender.send() 追加
│   └── feed.rs               # get_feeds() に last_error / consecutive_errors を返す
├── infra/
│   └── perplexity_client.rs  # SEC-01 テスト: API キーが error メッセージに含まれないこと
├── services/
│   └── opml_service.rs       # SEC-03: URL バリデーション追加
└── migrations/
    └── 009_phase2_resilience.sql  # SEC-02: user_profile CHECK 制約追加
```

### Pattern 1: CancellationToken — グレースフルシャットダウン

**What:** `tokio-util::sync::CancellationToken` を `tokio::select!` と組み合わせ、ループを即時中断する
**When to use:** 長時間実行される `loop { ... }` が外部シグナルで中断する必要があるとき

```rust
// Source: https://docs.rs/tokio-util/0.7.18/tokio_util/sync/struct.CancellationToken.html
use tokio_util::sync::CancellationToken;
use tokio::select;

async fn collect_loop(token: CancellationToken, /* ... */) {
    loop {
        select! {
            _ = token.cancelled() => { break; }
            _ = interval_timer.tick() => { /* collect */ }
        }
    }
}
```

### Pattern 2: watch チャネル — SchedulerConfig ホットリロード

**What:** `tokio::sync::watch` の sender/receiver ペアでループに設定変更を通知する
**When to use:** 1 writer (set_scheduler_config コマンド) → N readers (collect_loop, digest_loop)

```rust
// Source: https://docs.rs/tokio/latest/tokio/sync/watch/index.html
let (tx, rx) = tokio::sync::watch::channel(SchedulerConfig::default());
// set_scheduler_config() で tx.send(new_config) を呼ぶ
// collect_loop で rx.borrow_and_update() で最新設定を取得する
```

### Pattern 3: Tauri window close フック → 非同期シャットダウン

**What:** `on_window_event` で `CloseRequested` を傍受し、非同期シャットダウンタスクを起動する
**When to use:** Tauri v2 でウィンドウクローズ時にバックグラウンドタスクを安全に終了するとき

```rust
// Source: https://docs.rs/tauri/2.5.0/tauri/struct.Builder.html
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let handle = window.app_handle().clone();
        tauri::async_runtime::spawn(async move {
            // シャットダウンシーケンス実行
            handle.exit(0);
        });
    }
})
```

### Pattern 4: SEC-02 — SQLite CHECK 制約によるサイズ制限

**What:** `ALTER TABLE` で既存テーブルに CHECK 制約を追加する（SQLite は CHECK 追加をサポートしない）
**When to use:** 既存テーブルの TEXT 列にサイズ制限を後付けする場合

```sql
-- Source: SQLite ALTER TABLE docs (CHECK 制約は ALTER TABLE で追加不可)
-- 新テーブル作成 → データコピー → 旧テーブル削除 → リネーム が必要
-- 代替: アプリ層でバリデーション + トリガーで制限
```

**重要:** SQLite は `ALTER TABLE ADD COLUMN ... CHECK(...)` による CHECK 制約追加をサポートしない。移行は「テーブル再作成」か「アプリ層バリデーション + INSERT/UPDATE トリガー」の二択。

### Anti-Patterns to Avoid

- **ループ内で `.await` 中に Mutex を保持する:** Mutex ロックを `.await` にまたがせるとデッドロックリスク。`RwLock` の読み取りは `borrow_and_update()` で完結させること
- **`unwrap()` on `CancellationToken` manage:** `State<CancellationToken>` は `Arc<CancellationToken>` を `manage()` するとクローン渡しが容易
- **`prevent_close()` のみでシャットダウン完了を待つ:** `prevent_close()` はイベントループをブロックしない。必ず非同期タスクで完了を待ち `app_handle.exit(0)` で終了する

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| タスクキャンセル | 独自フラグ (AtomicBool ループ) | tokio-util CancellationToken | `.cancelled()` future が `select!` と綺麗に統合される |
| Config ブロードキャスト | Mutex<Vec<Box<dyn Fn>>> | tokio::sync::watch | 1-writer N-reader に最適化; `borrow_and_update()` で変更検知 |
| URL バリデーション | 正規表現 url 検査 | url crate (RFC 3986) | スキーム・ホスト・パス正規化を自動処理 |
| シャットダウンタイムアウト | sleep + AtomicBool | tokio::time::timeout | future の合成が宣言的; キャンセルも伝播する |

**Key insight:** Tokio エコシステムには非同期ライフサイクル管理のプリミティブが揃っている。独自実装は競合状態を生みやすく、`select!` との統合が難しい。

---

## Implementation Details by Requirement

### RESL-01: グレースフルシャットダウン

**変更ファイル:** `src-tauri/Cargo.toml`, `src/lib.rs`, `src/services/scheduler.rs`

**Cargo.toml 追加:**
```toml
tokio-util = { version = "0.7", features = ["rt"] }
```

**lib.rs の変更:**
1. `run_setup()` 内で `CancellationToken::new()` を生成
2. `app.manage(token.clone())` で State として登録
3. `scheduler::start()` に `token` を渡す
4. `.on_window_event(...)` で `CloseRequested` を傍受:
   - `api.prevent_close()`
   - `tauri::async_runtime::spawn()` でシャットダウンタスク起動
   - タスク内: `token.cancel()` → `tokio::time::timeout(5s, join_all(handles))` → `app_handle.exit(0)`

**scheduler.rs の変更:**
- `start()` シグネチャ: `token: CancellationToken` を受け取る
- `collect_loop()` と `digest_loop()` に `token: CancellationToken` を渡す
- 各ループで `select! { _ = token.cancelled() => break, _ = ... => ... }` に変更
- `start()` が `JoinHandle` のペアを返すように変更（タイムアウト待機用）

**シャットダウンシーケンス（D-04 実装）:**
```
1. on_window_event で CloseRequested を検知
2. api.prevent_close() でウィンドウクローズを一時停止
3. async タスクで token.cancel() を呼ぶ
4. collect_loop は select! で cancelled() を受信し break → HTTP リクエストは tokio 側で abort
5. digest_loop は同様に break
6. tokio::time::timeout(Duration::from_secs(5), join_all) で完了を待つ
7. タイムアウト or 完了後に app_handle.exit(0)
```

**WAL 安全性（D-03）:** Phase 1 で WAL モードが設定済み（PERF-01 完了）。SQLite WAL では読み取りと書き込みが並行でき、`insert_articles_batch` のトランザクションは中断されない。CancellationToken 発火後も進行中の DB トランザクションは完了まで実行される（HTTP 中断 + DB 完了待ちの分離）。

### RESL-02: 設定ホットリロード

**変更ファイル:** `src/state.rs`, `src/lib.rs`, `src/services/scheduler.rs`, `src/commands/scheduler.rs`

**2 つの実装アプローチ（Claude's Discretion）:**

**Option A: tokio::sync::watch チャネル（推奨）**
- `lib.rs` で `watch::channel(SchedulerConfig::default())` 生成
- `app.manage(tx)` で sender を State として登録
- `scheduler::start()` に `rx: watch::Receiver<SchedulerConfig>` を渡す
- `collect_loop` で `rx.borrow_and_update()` して現在設定を取得
- `set_scheduler_config` コマンドで `tx.send(new_config)` を呼ぶ

**Option B: Arc<RwLock<SchedulerConfig>>（既存パターン踏襲）**
- `AppState` に `scheduler_config: Arc<RwLock<SchedulerConfig>>` を追加
- Tauri event（`scheduler-config-changed`）で通知し、ループ側でポーリング
- D-07 決定に沿うが、Rust 内部ループへの通知に event 経由は間接的

**推奨: Option A（watch チャネル）**
- Tauri event は JS ↔ Rust 通信用。Rust 内部ループ間の通知には watch チャネルが直接的
- `borrow_and_update()` は変更があった場合のみ処理を実行できる（効率的）
- D-07 の「イベントを受信して動的に反映」の精神は保ちつつ、実装は Rust ネイティブ

**ホットリロード対象フィールド（Claude's Discretion 解決）:**
- `collect_interval_minutes`: 次の `interval_timer.tick()` タイミングで反映（即時変更不可 — interval を再生成するには現在の tick を捨てる必要あり）
- `digest_hour` / `digest_minute`: 次の `seconds_until()` 計算タイミングで反映
- `enabled`: ループ先頭で毎回チェック（即時反映）

collect_interval の即時反映が必要な場合: 現在の `interval_timer` を破棄して新しい `interval` を生成する（`select!` 内で設定変更検知時に再生成）。

### RESL-03: RSS パースエラー可視化

**変更ファイル:** `src/services/collector.rs`

**現状:** `refresh_all()` はフィードエラーを `feed_queries::update_feed_failure()` に記録するが、戻り値は `u32`（成功記事数）のみ。フロントエンドはエラー詳細を知れない。

**変更:** `refresh_all()` の戻り値を `Result<(u32, Vec<FeedError>), AppError>` に変更
```rust
pub struct FeedError {
    pub feed_id: i64,
    pub feed_name: String,
    pub error_message: String,
    pub consecutive_errors: i64,
}
```

**Settings 表示（Claude's Discretion 解決）:**
- フィード単位でエラーを表示（記事単位は粒度が細かすぎる）
- `consecutive_errors >= 1` のフィードを Settings の Feed 一覧で警告アイコン付き表示
- `consecutive_errors >= 3` で自動無効化（既存ロジック: `update_feed_failure()` が 3 回で disabled）
- `last_error` テキストをツールチップで表示
- 既存の `reenable_feed` コマンドでユーザーが手動で再有効化できる（実装済み）

### RESL-04: LLM プロバイダー切り替え安全化

**変更ファイル:** `src/services/deepdive_service.rs`（推定）

**現状確認:** `AppState.llm: Arc<RwLock<LlmSettings>>` に `provider` フィールドあり。DeepDive 会話はセッション単位でメモリに保持されている（推定）。

**保護戦略（Claude's Discretion 解決）:**
- DeepDive セッション開始時に `llm.read()?.provider` をスナップショットとしてメモリに保存
- 次の質問送信時に現在の `provider` と比較
- 不一致の場合: エラーを返し「プロバイダーが変更されました。会話を再開してください」を表示
- 進行中の HTTP リクエストは中断しない（既存 `reqwest::Client` はタイムアウトで自然終了）

### RESL-05: オフラインモード

**変更ファイル:** `src/services/collector.rs`, `src/infra/rss_fetcher.rs`, `src/commands/discover.rs`（推定）

**ネットワークエラー検知（Claude's Discretion 解決）:**
- `AppError::Network` または `AppError::Http` が全フィードで連続発生した場合をオフライン判定
- 専用の「オフライン状態」フラグ不要 — 収集失敗時に既存キャッシュから表示

**フォールバック（Claude's Discretion 解決）:**
- `get_discover_feed` コマンドは既に DB からデータを取得している（API 直接参照なし）
- `articles` テーブルの `created_at >= datetime('now', '-72 hours')` で 72h 以内の記事を返す
- 追加実装: 収集失敗時に Tauri event `collect-failed` を emit → フロントでオフラインバナー表示

**復帰検知（Claude's Discretion 解決）:**
- 次の定期収集（`collect_interval_minutes` 毎）で成功すれば自動復帰
- バナーは `collect-completed` event 受信で非表示に切り替え

**AI 要約停止（Claude's Discretion 解決）:**
- Perplexity / Ollama への HTTP リクエストはそのまま失敗 → AppError::Network で UI にエラー表示
- 追加実装不要（既存エラーハンドリングで対応済み）

### SEC-01: API キーログ漏洩防止

**コードスカウト結果（perplexity_client.rs 確認済み）:**
- `api_key` フィールドは `PerplexitySonarClient` struct に格納
- HTTP リクエスト送信後、`response.status()` と `response.text()` のみログ記録
- `reqwest::Error` は内部的に生ヘッダーを `Display` に含めない
- `format!("HTTP {}: {}", status, response.text().await?)` は Authorization ヘッダーを含まない

**追加すべきテスト（Claude's Discretion 解決）:**
- `wiremock` で 401 レスポンスを返すモックサーバーを用意
- `PerplexitySonarClient::complete()` を呼び出し、返ってくる `AppError::Unauthorized` の `to_string()` に API キー文字列が含まれないことをアサート
- `tracing_subscriber` の test subscriber でログメッセージ取得 → API キー文字列が含まれないことをアサート

### SEC-02: user_profile サイズ制限

**SQLite CHECK 制約の制限（検証済み）:**
SQLite は `ALTER TABLE ... ADD COLUMN` で CHECK 制約を追加できない。また、既存列への CHECK 追加も不可。

**実装方針（Claude's Discretion 解決）:**

**上限値の設定:**
- `favorite_titles`: JSON 配列で最大 50 エントリ、各エントリ最大 100 文字 → 上限 6,000 bytes
- `favorite_genres`: JSON 配列で最大 20 エントリ → 上限 1,000 bytes
- `favorite_creators`: JSON 配列で最大 50 エントリ → 上限 6,000 bytes

**実装方法:**
1. **移行 (009):** `CREATE TRIGGER` でサイズ違反を ABORT させる（SQLite の代替手段）
2. **アプリ層:** `update_user_profile` コマンドで長さチェック → `AppError::InvalidInput` 返却
3. **UI 層:** テキスト入力の maxLength 属性 or Zustand ストアでバリデーション

Migration SQL（SQLite トリガー方式）:
```sql
CREATE TRIGGER IF NOT EXISTS check_profile_size
BEFORE UPDATE ON user_profile
BEGIN
    SELECT CASE
        WHEN length(NEW.favorite_titles) > 6000 THEN RAISE(ABORT, 'favorite_titles size limit exceeded')
        WHEN length(NEW.favorite_genres) > 1000 THEN RAISE(ABORT, 'favorite_genres size limit exceeded')
        WHEN length(NEW.favorite_creators) > 6000 THEN RAISE(ABORT, 'favorite_creators size limit exceeded')
    END;
END;
```

### SEC-03: OPML URL バリデーション

**現状:** `opml_service.rs` の `parse_opml()` は `xmlUrl` 属性値をそのまま `(name, url, category)` タプルに入れる。`file://`, `javascript:`, `data:` スキームや過度に長い URL がそのまま feeds テーブルに挿入される。

**実装（Claude's Discretion 解決）:**
```rust
// url crate を使用 (Cargo.toml に追加)
use url::Url;

fn validate_feed_url(raw: &str) -> Result<String, AppError> {
    // 長さチェック
    if raw.len() > 2048 {
        return Err(AppError::InvalidInput("URL is too long (max 2048 chars)".to_string()));
    }
    let parsed = Url::parse(raw)
        .map_err(|e| AppError::InvalidInput(format!("Invalid URL: {e}")))?;
    // スキーム制限
    match parsed.scheme() {
        "http" | "https" => Ok(raw.to_string()),
        other => Err(AppError::InvalidInput(format!("Unsupported scheme: {other}"))),
    }
}
```

`parse_opml()` の戻り値は `Result<Vec<(String, String, String)>, AppError>` のまま変更せず、内部で URL バリデーションを実施して無効な行をスキップ or エラーとして返す。

---

## Common Pitfalls

### Pitfall 1: on_window_event は同期コールバック

**What goes wrong:** `api.prevent_close()` の後に `async` 処理を直接書けない（クロージャーは同期）
**How to avoid:** `tauri::async_runtime::spawn()` で別タスクを起動し、完了後に `app_handle.exit(0)` を呼ぶ
**Warning signs:** コンパイルエラー「cannot use .await in non-async context」

### Pitfall 2: CancellationToken を AppState に入れると Arc 循環

**What goes wrong:** `AppState` が `CancellationToken` を持ち、`State<AppState>` がコマンドで借用されると、シャットダウン時に AppState を mutably borrow できない
**How to avoid:** D-01 の決定通り、`CancellationToken` は独立した `app.manage(token)` で管理する (`State<CancellationToken>` として取得)
**Warning signs:** borrow checker エラー、または `app_state.llm` と同じコンポーネントにシャットダウンロジックが混在

### Pitfall 3: interval_timer 再生成でスキップ問題

**What goes wrong:** `collect_interval_minutes` 変更後に新しい `interval()` を生成すると、最初の tick が即時発火する（`interval` の初期動作: 作成直後に 1 tick 済み）
**How to avoid:** `tokio::time::interval()` の代わりに `interval_at(Instant::now() + duration, duration)` を使う
**Warning signs:** 設定変更直後に意図せず収集が実行される

### Pitfall 4: SQLite ALTER TABLE で CHECK 制約追加不可

**What goes wrong:** `ALTER TABLE user_profile ADD CHECK(length(favorite_titles) < 6000)` は SQLite でエラーになる
**How to avoid:** BEFORE UPDATE トリガー + アプリ層バリデーションの二重実装
**Warning signs:** Migration が SQLite エラーで失敗する

### Pitfall 5: tokio-util の features 指定

**What goes wrong:** `tokio-util = "0.7"` だけでは `CancellationToken` が使えない場合がある（feature flag "sync" が必要）
**How to avoid:** `tokio-util = { version = "0.7", features = ["sync"] }` と明示する（"rt" でも可）
**Warning signs:** コンパイルエラー「module sync not found」

### Pitfall 6: seconds_until() が OS ローカルタイムを使用

**What goes wrong:** `seconds_until()` は `Local::now()` を使用しており、JST 以外のタイムゾーンのユーザーでは `digest_hour: 8` が UTC 8 時になる
**How to avoid:** STATE.md に「Clarify seconds_until JST vs OS local time」として記録済み。Phase 2 では現状維持（OS local time = ユーザーの現地時間）として実装し、仕様コメントを追加する
**Warning signs:** 国際ユーザーがダイジェスト生成時刻がずれると報告する

---

## Code Examples

### CancellationToken — ループへの組み込み

```rust
// Source: https://docs.rs/tokio-util/0.7.18/tokio_util/sync/struct.CancellationToken.html
use tokio_util::sync::CancellationToken;
use tokio::{select, time::{interval, Duration}};

async fn collect_loop(token: CancellationToken, config_rx: watch::Receiver<SchedulerConfig>, /* ... */) {
    let mut timer = interval(Duration::from_secs(60 * 60));
    loop {
        select! {
            _ = token.cancelled() => {
                tracing::info!("collect_loop: CancellationToken 受信、終了");
                break;
            }
            _ = timer.tick() => {
                // collect 処理
            }
        }
    }
}
```

### watch チャネル — 設定ホットリロード

```rust
// Source: https://docs.rs/tokio/latest/tokio/sync/watch/index.html
// lib.rs: セットアップ時
let (config_tx, config_rx) = tokio::sync::watch::channel(SchedulerConfig::default());
app.manage(config_tx);  // State<watch::Sender<SchedulerConfig>>

// commands/scheduler.rs: 設定保存時
pub async fn set_scheduler_config(
    tx: State<'_, watch::Sender<SchedulerConfig>>,
    config: SchedulerSettings,
) -> Result<(), AppError> {
    tx.send(config.into()).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

// scheduler.rs: ループ内
let current_config = config_rx.borrow();
```

### OPML URL バリデーション

```rust
// Source: https://docs.rs/url/2.5.0/url/struct.Url.html
use url::Url;
fn validate_feed_url(raw: &str) -> Result<(), AppError> {
    if raw.len() > 2048 { return Err(AppError::InvalidInput("URL too long".into())); }
    let u = Url::parse(raw).map_err(|e| AppError::InvalidInput(format!("Invalid URL: {e}")))?;
    if !matches!(u.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(format!("Unsupported scheme: {}", u.scheme())));
    }
    Ok(())
}
```

### シャットダウンシーケンス — on_window_event

```rust
// Source: https://docs.rs/tauri/2.5.0/tauri/struct.Builder.html (on_window_event)
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let handle = window.app_handle().clone();
        tauri::async_runtime::spawn(async move {
            if let Some(token) = handle.try_state::<CancellationToken>() {
                token.cancel();
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    /* JoinHandle 群の await */
                ).await;
            }
            handle.exit(0);
        });
    }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AtomicBool フラグでループ中断 | tokio-util CancellationToken | tokio-util 0.7 (2022) | select! との統合、子トークン生成、future 合成が可能 |
| Mutex<Config> 共有 | watch チャネル | tokio 1.x | Lock フリーな 1-writer N-reader、変更検知が組み込み |
| 正規表現で URL 検査 | url crate | url 2.x | RFC 3986 完全準拠、IDN 対応 |

**Deprecated/outdated:** `tokio-cron-scheduler`: プロジェクトの `Cargo.toml` に依存として記載されているが、scheduler.rs は使用していない。代わりに tokio の `interval()` と `sleep()` で実装している。不要な依存として整理候補。

---

## Open Questions

1. **JoinHandle の管理方法** — What we know: `tauri::async_runtime::spawn()` は `JoinHandle<T>` を返す。シャットダウンタイムアウトで `join_all(handles)` を使うには handles をどこかに保持する必要がある | What's unclear: `State<Vec<JoinHandle>>` は `JoinHandle` が `Send + Sync` でないため manage() できない | Recommendation: `Arc<Mutex<Option<JoinHandle>>>` per loop を `State` として manage() するか、ループ内で `token.cancelled()` だけに頼り JoinHandle を保持しない（5 秒タイムアウトが保証）

2. **watch::Sender の State 型** — What we know: `tokio::sync::watch::Sender<T>` は `Clone` でない | What's unclear: `app.manage(tx)` できるか、または `Arc<watch::Sender<T>>` でラップが必要か | Recommendation: `Arc<watch::Sender<SchedulerConfig>>` でラップして manage()

3. **RESL-04 の DeepDive 会話保護スコープ** — What we know: DeepDive は `src/services/deepdive_service.rs` で管理されているが、ファイル内容を完全には確認していない | What's unclear: 会話履歴がメモリのみか DB にも保存されているか | Recommendation: 実装前に deepdive_service.rs の会話管理部分を確認する

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| tokio-util | RESL-01 | Yes (transitive) | 0.7.18 | なし（Cargo.toml に明示追加が必要） |
| url crate | SEC-03 | No (未使用) | 2.5.x | 手動正規表現（非推奨） |
| tokio::sync::watch | RESL-02 | Yes (tokio features: sync) | 1.x | なし |

**Missing with no fallback:** `url` crate — `Cargo.toml` への明示追加が必要
**Missing with fallback:** なし

---

## Project Constraints (from CLAUDE.md)

**コーディング規約（必須）:**
- Rust: `cargo clippy -- -D warnings` + `cargo fmt` を全変更に適用
- `unwrap()` は本番コードで禁止。`?` 演算子または `.expect("明確な理由")` を使用
- `commands/` にビジネスロジックを書かない — `services/` に委譲する
- 個別 `app.manage()` パターン維持（`Mutex<AppState>` 禁止）
- ログ: `tracing::info!/warn!/error!` 使用（`println!` 禁止）

**完了要件（全変更後に確認）:**
- `npm run check` — Biome lint/format エラーなし
- `npm run typecheck` — TypeScript 型エラーなし
- `cargo clippy -- -D warnings` — Clippy 警告なし
- `cargo test` — 全テストグリーン

**アーキテクチャ制約:**
- 4 層アーキテクチャ維持（Commands → Services → Infra → Parsers）
- 既存 DB スキーマとの後方互換性維持

**Phase 2 固有決定（STATE.md より):**
- CancellationToken は `tauri::State<CancellationToken>` として独立管理（AppState 内に入れない）
- `seconds_until()` の JST vs OS local time は国際ユーザーに影響するが Phase 2 ではスコープ外

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read — `src-tauri/src/services/scheduler.rs`, `state.rs`, `lib.rs`, `commands/scheduler.rs`, `infra/perplexity_client.rs`, `services/opml_service.rs`, `services/collector.rs`, migrations 001-008
- [tokio-util 0.7.18 CancellationToken docs](https://docs.rs/tokio-util/0.7.18/tokio_util/sync/struct.CancellationToken.html) — CancellationToken API, cancelled(), cancel(), child_token()
- `.planning/phases/02-resilience-security/02-CONTEXT.md` — 全 Locked Decisions (D-01〜D-07)
- `.planning/codebase/CONCERNS.md` — Fragile Areas, Security Considerations, Tech Debt の詳細

### Secondary (MEDIUM confidence)

- [Tauri v2 RunEvent docs](https://docs.rs/tauri/2.5.0/tauri/enum.RunEvent.html) — ExitRequested, WindowEvent::CloseRequested の構造
- [tokio::sync::watch docs](https://docs.rs/tokio/latest/tokio/sync/watch/index.html) — 1-writer N-reader パターン
- `cargo tree` 実行結果 — tokio-util 0.7.18 が推移的依存として存在することを確認

### Tertiary (LOW confidence)

- WebSearch: Tauri v2 on_window_event CloseRequested パターン — `prevent_close()` の async 制約はコミュニティ報告から。公式ドキュメントで完全検証はしていない

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Cargo.toml と cargo tree で直接確認
- Architecture: HIGH — コードベース全ファイル直接確認; 既存パターンの拡張のみ
- Tauri shutdown: MEDIUM — API 構造は docs.rs で確認; 非同期シャットダウンの詳細は WebSearch（コミュニティ報告）
- SEC-02 SQLite: HIGH — SQLite ALTER TABLE 制約はドキュメント確認済み; トリガー方式は標準的回避策
- Pitfalls: MEDIUM-HIGH — コードベース直接確認 + 既知のプロジェクトの教訓（STATE.md）

**Research date:** 2026-03-28
**Valid until:** 2026-04-28（Tauri v2 API は stable、tokio は LTS、30 日間有効）
