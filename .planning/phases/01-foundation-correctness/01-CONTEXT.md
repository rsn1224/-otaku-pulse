# Phase 1: Foundation Correctness - Context

**Gathered:** 2026-03-27
**Updated:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

アプリの起動信頼性、重複排除の正確性（日本語タイトル・URL バリアント対応）、SQLite WAL モードによる並行読み書き、CI のオフラインビルド対応を実現する。新機能追加は行わず、既存機能の正確性と堅牢性を底上げする。

</domain>

<decisions>
## Implementation Decisions

### 起動失敗時のユーザー体験 (SAFE-01)
- **D-01:** 段階的起動戦略を採用する。回復可能なエラー（DB 接続失敗等）はトースト通知で表示しアプリを継続起動する。致命的エラー（app_data_dir 取得不可等）のみ setup() が Err を返してアプリを停止する
- **D-02:** 致命的エラー時は Tauri の OS ネイティブエラーダイアログを表示する（setup() 中に WebView は未マウントのため、WebView ベースのエラーページは使えない）
- **D-03:** エラーメッセージは日本語のみで表示する

### NFKC 移行と既存データ戦略 (BUG-03)
- **D-04:** Unicode 正規化を NFC → NFKC に統一する
- **D-05:** DB マイグレーションで既存記事の is_duplicate をリセットし、次回収集時に NFKC で再 dedup を実行する。既存記事のタイトルも NFKC 正規化して content_hash を再計算する

### DeepDive キャッシュ無効化ポリシー (BUG-02)
- **D-06:** キャッシュキーに summary_hash を追加し、サマリー変更時は TTL に関係なく即座にキャッシュを無効化する
- **D-07:** TTL は 24 時間に設定する（現行 7 日から短縮）

### フィルタ移行 (FRNT-01)
- **D-08:** applyMuteFilters のみ Rust バックエンド（get_discover_feed クエリ）に移動し、DB レベルでミュートキーワード除外を行う
- **D-09:** getHighlightKeywords はフロントエンドに残す（表示専用ロジックのため）

### WAL モード有効化 (PERF-01)
- **D-10:** database.rs の init_pool() で接続時に PRAGMA journal_mode=WAL を実行する（マイグレーションではなく接続時 PRAGMA）

### Lock Poisoning 対処 (SAFE-02)
- **D-11:** lib.rs:71 の `llm.write().expect()` を `map_err(|e| AppError::Internal(...))` に置換する。commands/ 層は既に安全なパターンを使用しているため変更不要

### エラーハンドリング改善 (SAFE-03, SAFE-04)
- **D-12:** DeepDive と personal_scoring の unwrap_or_default を tracing::warn! でログ出力 + デフォルト値で継続に改善する（UX を壊さず問題を可視化）

### Rate Limiter 精度修正 (BUG-04)
- **D-13:** トークンカウンタを u32 → f64 に変更し、acquire 時にのみ整数判定する

### 依存ピンニング (DEP-01, DEP-02)
- **D-14:** 外部 I/O に関わる feed-rs / reqwest / sqlx のみ `~`（マイナーバージョン固定）でピンニングする。tokio / serde / chrono 等のコアライブラリは Cargo.lock に任せる。代替クレート評価は Phase 1 では行わない

### sqlx オフラインモード (DEP-03)
- **D-15:** .sqlx/ ディレクトリを Git にコミットし、CI で DB なしビルドを可能にする。スキーマ変更時は cargo sqlx prepare で再生成する

### マイグレーション戦略
- **D-16:** Phase 1 の全スキーマ変更を単一の `008_phase1_foundation.sql` にまとめる（summary_hash 追加 + NFKC 移行 + content_hash 再計算 + is_duplicate リセット）。部分適用は不整合の原因になるため分割しない

### Phase 1 テスト方針
- **D-17:** Phase 1 で変更したロジックに対する最低限のテストを含める（dedup NFKC テスト 5-10 ケース、DeepDive cache 無効化テスト、WAL モード確認テスト）。包括テストスイート（20+ ケース）は Phase 3 の TEST-01〜07 で実施

### Claude's Discretion
- URL クエリパラメータのソートアルゴリズムの具体的実装（BUG-01）
- content_hash 再計算のバッチサイズとタイミング
- 段階的起動のエラー分類（どのエラーが「回復可能」か「致命的」か）
- NFKC マイグレーション SQL の具体的な実装
- 最低限テストの具体的なテストケース選定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri State 管理
- `.claude/rules/state_no_mutex.md` — Mutex<AppState> 禁止パターンと個別 manage() の正しい実装

### Tauri v2 注意点
- `.claude/rules/tauri-v2-gotchas.md` — invoke() エラーの plain object 問題、snake_case → camelCase 変換

### Dedup 設計
- `.claude/rules/scoring_phase1.md` — dedup は Phase 1（収集時）実行、importance_score は Phase 2 以降
- `.claude/rules/content_hash_column.md` — content_hash は専用カラムに保存（JSON 内禁止）

### AniList API
- `.claude/rules/anilist_rate_limit.md` — 実測 30 req/min、2秒インターバル

### Rust パフォーマンス
- `.claude/rules/rust-perf.md` — プロファイリングファースト原則、メモリアロケーション最適化

### TypeScript 規約
- `.claude/rules/typescript.md` — invoke 集約ルール（tauri-commands.ts）、any 禁止

### コードベース懸念事項
- `.planning/codebase/CONCERNS.md` — Tech Debt、Known Bugs、Security Considerations の詳細

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/services/dedup_service.rs` — normalize_title(), normalize_url(), generate_content_hash() が既存。NFKC 化は normalize_title() の NFC 呼び出しを NFKC に変更
- `src-tauri/src/infra/database.rs` — init_pool() が既存。WAL PRAGMA はここに追加
- `src-tauri/src/infra/rate_limiter.rs` — TokenBucket（u32 トークン + f64 refill_rate）が既存。トークン型を f64 に変更
- `src/lib/articleFilter.ts` — applyMuteFilters() と getHighlightKeywords() の2関数。ミュートのみ Rust 移行対象
- `src-tauri/src/services/deepdive_service.rs` — CACHE_TTL_DAYS = 7（24h に変更対象）、cleanup_expired_cache() が既存

### Established Patterns
- エラー型: AppError enum（Database, Http, FeedParse, ..., Internal）で統一
- 状態管理: 個別 manage() パターン（Mutex<AppState> 禁止）
- ロギング: tracing（Rust）、pino（TypeScript）
- Tauri コマンド: commands/ は薄いラッパー、ロジックは services/ に委譲
- Lock 安全パターン: commands/ 層は既に `.read().map_err()` / `.write().map_err()` を使用

### Integration Points
- `src-tauri/src/lib.rs` setup() — 起動エラー処理の改修ポイント（現在 unwrap_or_else → panic）
- `src-tauri/src/lib.rs:71` — 唯一の lock poisoning サイト（`llm.write().expect()`）
- `src-tauri/src/commands/discover_ai.rs` — ミュートフィルタの DB クエリ統合先
- `src-tauri/migrations/` — 008_phase1_foundation.sql を追加（007 まで既存）
- `.sqlx/` — 新規作成（cargo sqlx prepare で生成）

</code_context>

<specifics>
## Specific Ideas

- エラーページは日本語 UI で統一（アプリ全体のターゲットが日本語話者）
- NFKC 移行はマイグレーションで一括処理し、漸進的移行はしない
- DeepDive キャッシュの TTL は REQUIREMENTS.md の BUG-02 で提案された 24h を採用（現行 7 日から短縮）
- 起動時の段階的エラーハンドリング: DB 失敗 → トースト＋継続、app_data_dir 失敗 → OS ダイアログ＋停止
- 依存ピンニングは外部 I/O クレートに限定し、コアライブラリは Cargo.lock に任せる

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-correctness*
*Context gathered: 2026-03-27*
*Context updated: 2026-03-27*
