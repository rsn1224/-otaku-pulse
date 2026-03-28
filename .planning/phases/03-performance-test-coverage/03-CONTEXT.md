# Phase 3: Performance & Test Coverage - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

ダイジェスト生成の並列化、DB クエリ統合（personal_scoring, highlights, FTS）、URL 正規化の並列化によるパフォーマンス最適化と、Phase 1-2 で実装した全機能を守る包括テストスイートの構築。新機能追加は行わない。

**対象要件:** PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**追加スコープ:** Phase 2 成果物（CancellationToken シャットダウン、ホットリロード、オフラインモード、セキュリティ硬化）のユニットテスト

</domain>

<decisions>
## Implementation Decisions

### テスト戦略と優先順位
- **D-01:** Rust バックエンド優先で実装する。コアロジック（dedup, rate_limiter, scheduler, personal_scoring）のテストを先に固め、TS hook/コンポーネントテストは後半で実施
- **D-02:** Phase 2 成果物もテスト対象に含める。ユニットテスト中心で、CancellationToken 発火テスト、ホットリロード event テスト、オフラインフォールバックテストなどを追加

### dedup テストスイート (TEST-01)
- **D-03:** 20+ ケースの包括的テストスイートを作成。Unicode 正規化エッジケース（絵文字、CJK 互換文字、ゼロ幅スペース）、URL バリエーション、content_hash 衝突、Jaccard 類似度境界値を全てカバー

### TypeScript コンポーネントテスト (TEST-06)
- **D-04:** アサーションベースのアプローチを採用。Testing Library で「エラーメッセージが表示される」「画像が fallback になる」など振る舞いを検証。スナップショットテストは使用しない

### カバレッジインフラ (TEST-07)
- **D-05:** cargo-llvm-cov と @vitest/coverage-v8 を導入し、ローカルでレポート生成可能にする。閾値設定や CI 連携は本フェーズでは行わない（将来フェーズで対応）

### ダイジェスト並列化 (PERF-02)
- **D-06:** tokio::join! で4カテゴリを並列実行する。1カテゴリが失敗した場合は部分成功を許容し、失敗カテゴリはログしてスキップ、他カテゴリは正常にダイジェスト生成を続行
- **D-07:** カテゴリ毎にタイムアウトを設定する（値は Claude 裁量）

### パフォーマンス検証方法
- **D-08:** ベンチマークツール（criterion 等）は導入しない。テスト内アサーションで「N+1 が解消された」「並列実行された」ことを検証する

### Claude's Discretion
- PERF-03: personal_scoring の LEFT JOIN クエリの具体的な SQL 設計
- PERF-04: FTS サブクエリ内 LIMIT/OFFSET の実装方式
- PERF-05: highlights の GROUP BY クエリ設計
- PERF-06: rayon 並列化のバッチサイズと適用閾値
- PERF-02: カテゴリ毎タイムアウト値
- Phase 2 テストの具体的なテストケース設計

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### テストパターン
- `.planning/codebase/TESTING.md` — 既存テスト構造（Vitest + cargo test）、ファイル配置規約、テストパターン

### コードベース懸念事項
- `.planning/codebase/CONCERNS.md` — パフォーマンスボトルネック（digest_loop, personal_scoring, FTS, highlights）の詳細分析。テストカバレッジギャップの一覧

### Phase 1 コンテキスト
- `.planning/phases/01-foundation-correctness/01-CONTEXT.md` — NFKC 移行決定（D-04, D-05）、dedup 基本テスト方針（D-17）

### Phase 2 コンテキスト
- `.planning/phases/02-resilience-security/02-CONTEXT.md` — CancellationToken 設計（D-01〜D-05）、ホットリロード設計（D-06, D-07）

### Rust パフォーマンス
- `.claude/rules/rust-perf.md` — プロファイリングファースト原則、非同期とスレッドのルール（spawn_blocking, Mutex + await 禁止）

### Tauri State 管理
- `.claude/rules/state_no_mutex.md` — 個別 manage() パターン。テスト設計時の State モック方針に影響

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/parsers/rss_parser_tests.rs` — 既存 Rust テストファイルのパターン参考（#[tokio::test] マクロ使用）
- `src/test/` — TS テストディレクトリ構造（lib/, stores/, hooks/ サブディレクトリ）
- `vitest.config.ts` — Vitest 設定ファイル（カバレッジ追加設定先）
- `wiremock` 0.6 — HTTP モッキング（rate_limiter テスト、外部 API テストで使用可能）

### Established Patterns
- Rust テスト: `#[cfg(test)] mod tests` パターン + 別ファイル `{module}_tests.rs`
- TS テスト: `src/test/{module}.test.ts` + Vitest `describe/it/expect`
- async テスト: `#[tokio::test]` マクロ
- HTTP モック: `wiremock::MockServer` パターン

### Integration Points
- `src-tauri/src/services/scheduler.rs` — digest_loop 並列化の変更先（lines 136-167）
- `src-tauri/src/services/personal_scoring.rs` — 3クエリ→1クエリ統合先（lines 74-81）
- `src-tauri/src/services/fts_queries.rs` — FTS ページネーション最適化先
- `src-tauri/src/services/highlights_service.rs` — N+1 クエリ解消先
- `src-tauri/src/services/dedup_service.rs` — 包括テスト追加先
- `src-tauri/Cargo.toml` — cargo-llvm-cov dev-dependency 追加先

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-performance-test-coverage*
*Context gathered: 2026-03-28*
