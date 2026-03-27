# Phase 1: Foundation Correctness - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

アプリの起動信頼性、重複排除の正確性（日本語タイトル・URL バリアント対応）、SQLite WAL モードによる並行読み書き、CI のオフラインビルド対応を実現する。新機能追加は行わず、既存機能の正確性と堅牢性を底上げする。

</domain>

<decisions>
## Implementation Decisions

### 起動失敗時のユーザー体験 (SAFE-01)
- **D-01:** setup() は Err を返し、Tauri がエラーを受けた後、最小限の WebView でエラーページを表示する（WebView は setup() 中に未マウントのためダイアログは使えない）
- **D-02:** エラーページに「再試行」ボタンと「ログフォルダを開く」リンクを表示する
- **D-03:** エラーメッセージは日本語のみで表示する

### NFKC 移行と既存データ戦略 (BUG-03)
- **D-04:** Unicode 正規化を NFC → NFKC に統一する
- **D-05:** DB マイグレーションで既存記事の is_duplicate をリセットし、次回収集時に NFKC で再 dedup を実行する。既存記事のタイトルも NFKC 正規化して content_hash を再計算する

### DeepDive キャッシュ無効化ポリシー (BUG-02)
- **D-06:** キャッシュキーに summary_hash を追加し、サマリー変更時は TTL に関係なく即座にキャッシュを無効化する
- **D-07:** TTL は 24 時間に設定する

### フィルタ移行 (FRNT-01)
- **D-08:** applyMuteFilters のみ Rust バックエンド（get_discover_feed クエリ）に移動し、DB レベルでミュートキーワード除外を行う
- **D-09:** getHighlightKeywords はフロントエンドに残す（表示専用ロジックのため）

### WAL モード有効化 (PERF-01)
- **D-10:** database.rs の init_pool() で接続時に PRAGMA journal_mode=WAL を実行する（マイグレーションではなく接続時 PRAGMA）

### Lock Poisoning 対処 (SAFE-02)
- **D-11:** 全ての lock().expect() を lock().map_err(|e| AppError::Internal(...)) に置換し、? 演算子でエラーを伝搬する

### エラーハンドリング改善 (SAFE-03, SAFE-04)
- **D-12:** DeepDive と personal_scoring の unwrap_or_default を tracing::warn! でログ出力 + デフォルト値で継続に改善する（UX を壊さず問題を可視化）

### Rate Limiter 精度修正 (BUG-04)
- **D-13:** トークンカウンタを u32 → f64 に変更し、acquire 時にのみ整数判定する

### 依存ピンニング (DEP-01, DEP-02)
- **D-14:** feed-rs / reqwest / sqlx のバージョンを Cargo.toml で `~` (マイナーバージョン固定) にピンニングする。パッチは自動受入、メジャー更新は手動。代替クレート評価は Phase 1 では行わない

### sqlx オフラインモード (DEP-03)
- **D-15:** .sqlx/ ディレクトリを Git にコミットし、CI で DB なしビルドを可能にする。スキーマ変更時は cargo sqlx prepare で再生成する

### Claude's Discretion
- URL クエリパラメータのソートアルゴリズムの具体的実装（BUG-01）
- content_hash 再計算のバッチサイズとタイミング
- エラーページの具体的な HTML/CSS デザイン
- NFKC マイグレーション SQL の具体的な実装

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
- `src-tauri/src/services/dedup_service.rs` — normalize_title(), normalize_url(), generate_content_hash() が既存。NFKC 化はここを修正
- `src-tauri/src/infra/database.rs` — init_pool() が既存。WAL PRAGMA はここに追加
- `src-tauri/src/infra/rate_limiter.rs` — トークンバケットアルゴリズムが既存。f64 化はここを修正
- `src/lib/articleFilter.ts` — applyMuteFilters() と getHighlightKeywords() の2関数のみ。ミュートのみ Rust 移行対象

### Established Patterns
- エラー型: AppError enum（Database, Http, FeedParse, ..., Internal）で統一
- 状態管理: 個別 manage() パターン（Mutex<AppState> 禁止）
- ロギング: tracing（Rust）、pino（TypeScript）
- Tauri コマンド: commands/ は薄いラッパー、ロジックは services/ に委譲

### Integration Points
- `src-tauri/src/lib.rs` setup() — 起動エラー処理の改修ポイント
- `src-tauri/src/commands/discover_ai.rs` — ミュートフィルタの DB クエリ統合先
- `src-tauri/migrations/` — NFKC マイグレーション、.sqlx/ 生成の起点

</code_context>

<specifics>
## Specific Ideas

- エラーページは日本語 UI で統一（アプリ全体のターゲットが日本語話者）
- NFKC 移行はマイグレーションで一括処理し、漸進的移行はしない
- DeepDive キャッシュの TTL は REQUIREMENTS.md の BUG-02 で提案された 24h を採用

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-correctness*
*Context gathered: 2026-03-27*
