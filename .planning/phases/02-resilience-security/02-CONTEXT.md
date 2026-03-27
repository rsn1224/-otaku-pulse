# Phase 2: Resilience & Security - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

スケジューラのグレースフルシャットダウン、設定ホットリロード、オフラインモード、セキュリティ硬化を実現する。アプリが「安全に止まり」「動的に設定変更でき」「ネットワーク不安定でも動作し」「秘密情報を漏らさない」状態にする。新機能追加は行わない。

**対象要件:** RESL-01, RESL-02, RESL-03, RESL-04, RESL-05, SEC-01, SEC-02, SEC-03

</domain>

<decisions>
## Implementation Decisions

### グレースフルシャットダウン (RESL-01)
- **D-01:** CancellationToken は collect_loop と digest_loop で共有する単一トークン。`tauri::State<CancellationToken>` として独立管理（AppState 内に入れない — Phase 1 STATE.md メモ引き継ぎ）
- **D-02:** 進行中の HTTP リクエスト（フィード収集）は CancellationToken 発火で即時キャンセルする。取得途中の記事は破棄（DB に未書き込みのためデータ破損なし）
- **D-03:** 進行中の DB 書き込み（insert_articles_batch）は完了まで待つ。WAL モードでもトランザクション完了を保証する
- **D-04:** シャットダウンシーケンス: CancellationToken 発火 → HTTP 即時中断 + DB 書き込み完了待ち → 5秒タイムアウト → tokio::runtime 強制終了（プロセスハング防止）
- **D-05:** Tauri の window close イベントからシャットダウンシーケンスを起動する

### 設定ホットリロード (RESL-02)
- **D-06:** SchedulerConfig を `Arc<RwLock<SchedulerConfig>>` でラップし、AppState と同じパターンで管理する
- **D-07:** 設定変更時に Tauri event（`scheduler-config-changed`）を emit し、稼働中の collect_loop / digest_loop がイベントを受信して動的に反映する

### Claude's Discretion
- ホットリロードの対象フィールド範囲（collect_interval, digest_hour, digest_minute, enabled の全フィールドを即時反映するか、一部は次回ループから反映するか）
- RSS パースエラーの可視化方法（RESL-03）: エラー粒度（フィード単位 vs 記事単位）、Settings 画面での表示形式、自動無効化ポリシー（consecutive_errors カラムは既存）
- LLM プロバイダー切り替え安全化（RESL-04）: 進行中の DeepDive 会話の保護方法（現在のスナップショット分離パターンを拡張）
- オフラインモード（RESL-05）: ネットワークエラー検知方法、72h キャッシュからのフォールバック表示、ユーザーへの通知方法（バナー or トースト）、デグレード範囲（Feed 表示 OK / AI 要約停止）、復帰検知の仕組み
- SEC-01: Perplexity API キーのログ漏洩テスト追加（コードスカウトで漏洩なし確認済み — テストによる継続的検証のみ）
- SEC-02: user profile JSON のサイズ制限値（DB CHECK 制約 + UI 入力制限の具体的な上限値）
- SEC-03: OPML インポートの URL バリデーション（http/https スキーム限定、長さ制限、悪意あるプロトコルブロック）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri State 管理
- `.claude/rules/state_no_mutex.md` — Mutex<AppState> 禁止パターンと個別 manage() の正しい実装。CancellationToken も同パターンで独立管理

### Tauri v2 注意点
- `.claude/rules/tauri-v2-gotchas.md` — invoke() エラーの plain object 問題、snake_case → camelCase 変換、AppError シリアライズ形式

### コードベース懸念事項
- `.planning/codebase/CONCERNS.md` — Tech Debt、Known Bugs、Security Considerations の詳細。Phase 2 対象項目の背景情報

### Rust パフォーマンス
- `.claude/rules/rust-perf.md` — Mutex ロック中の .await 禁止、parking_lot::RwLock 検討基準

### Phase 1 コンテキスト
- `.planning/phases/01-foundation-correctness/01-CONTEXT.md` — Phase 1 の決定事項（lock poisoning パターン、エラーメッセージ日本語統一等）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/state.rs` — AppState に Arc<RwLock<LlmSettings>> パターンが既存。SchedulerConfig も同パターンで追加可能
- `src-tauri/src/services/scheduler.rs` — start() 関数、collect_loop()、digest_loop() が既存。CancellationToken パラメータを追加
- `src-tauri/src/infra/rss_fetcher.rs` — FeedCache struct（etag/last_modified）が既存。オフラインモードの HTTP エラーハンドリング拡張ポイント
- `src-tauri/src/commands/scheduler.rs` — get/set_scheduler_config コマンドが既存。ホットリロードの event emit を追加
- `src-tauri/src/services/collector.rs` — refresh_all() が既存。返り値を (u32, u32, Vec<FeedError>) タプルに変更
- `src-tauri/src/infra/credential_store.rs` — OS クレデンシャルストア（keyring）が既存。API キーは安全に保管済み

### Established Patterns
- エラー型: AppError enum で統一（Database, Http, FeedParse, Network, etc.）
- 状態管理: 個別 manage() パターン（Mutex<AppState> 禁止）
- ロギング: tracing（Rust）、pino（TypeScript）
- Tauri event: `app_handle.emit("event-name", &payload)` パターンが scheduler.rs で既に使用中
- Lock 安全パターン: `read()/write().map_err(|e| AppError::Internal(...))` が commands/ 層で確立済み

### Integration Points
- `src-tauri/src/lib.rs` setup() — CancellationToken の生成と manage() 登録ポイント
- `src-tauri/src/lib.rs` — Tauri の `on_window_event(WindowEvent::CloseRequested)` でシャットダウンシーケンス起動
- `src-tauri/src/services/scheduler.rs` start() — CancellationToken を受け取り、各 loop に渡す
- `src-tauri/src/commands/scheduler.rs` set_scheduler_config() — 設定保存後に Tauri event を emit
- feeds テーブル — `consecutive_errors`, `disabled_reason`, `last_error` カラムが既存（RSS エラー可視化で活用）
- user_profile テーブル — `favorite_titles`, `favorite_genres`, `favorite_creators` が TEXT 型（CHECK 制約追加ポイント）
- `src-tauri/src/services/opml_service.rs` parse_opml() — URL バリデーション追加ポイント

</code_context>

<specifics>
## Specific Ideas

- シャットダウンは「HTTP 即時中断 + DB 完了待ち + 5秒タイムアウト + 強制終了」の 4 段階
- CancellationToken は単一で全ループ共有（collect_loop + digest_loop）
- SEC-01 はコードスカウトで既にクリア確認済み（API キーがログに含まれていない）。テスト追加で継続的に保証する

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-resilience-security*
*Context gathered: 2026-03-28*
