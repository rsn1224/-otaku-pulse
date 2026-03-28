# OtakuPulse

## What This Is

AI パワードのオタクニュースアグリゲーター（Tauri v2 デスクトップアプリ）。RSS/Atom、AniList GraphQL、Steam、Reddit、RAWG からコンテンツを収集し、AI（Ollama / Perplexity）で要約・ダイジェスト・DeepDive Q&A を提供する。v1.0 で安定化・最適化を完了し、信頼性の高いコードベースが確立された。

## Core Value

**既存機能が正しく・速く・安全に動作すること。** ユーザーが気づかないバグや性能問題をゼロに近づけ、今後の機能追加に耐えるコードベースにする。

## Current State (v1.0 shipped 2026-03-28)

- **Codebase:** Rust + TypeScript, 65+ files modified, +9,151 lines
- **Test suite:** 120+ tests (Rust: dedup 28, rate limiter 9, scheduler 3, scoring 7; TS: hooks 9, components 12)
- **Coverage infra:** cargo-llvm-cov (Rust) + @vitest/coverage-v8 (TS)
- **Migrations:** 009 (latest: profile size limit triggers)
- **Performance:** Parallel digest (tokio::join!), CTE query consolidation, FTS pagination, rayon URL normalization
- **Resilience:** Graceful shutdown (CancellationToken), config hot-reload (watch channel), offline mode, provider guard
- **Security:** API key log audit, OPML URL validation, profile size limits (defense-in-depth)

## Requirements

### Validated

- ✓ Panic-free startup with OS native error dialog (SAFE-01) -- v1.0
- ✓ Lock poisoning handled as AppError::Internal (SAFE-02) -- v1.0
- ✓ DeepDive cache error handling improved (SAFE-03) -- v1.0
- ✓ personal_scoring JSON validation (SAFE-04) -- v1.0
- ✓ URL query param order-independent dedup (BUG-01) -- v1.0
- ✓ DeepDive cache invalidation via summary_hash + TTL (BUG-02) -- v1.0
- ✓ NFKC Unicode normalization for dedup (BUG-03) -- v1.0
- ✓ Rate limiter f64 token precision (BUG-04) -- v1.0
- ✓ API key log leak prevention (SEC-01) -- v1.0
- ✓ Profile size limits with DB triggers (SEC-02) -- v1.0
- ✓ OPML URL validation (SEC-03) -- v1.0
- ✓ SQLite WAL mode (PERF-01) -- v1.0
- ✓ Parallel digest generation (PERF-02) -- v1.0
- ✓ Personal scoring query consolidation (PERF-03) -- v1.0
- ✓ FTS pagination (PERF-04) -- v1.0
- ✓ Highlights N+1 query fix (PERF-05) -- v1.0
- ✓ Rayon URL normalization (PERF-06) -- v1.0
- ✓ CancellationToken graceful shutdown (RESL-01) -- v1.0
- ✓ Config hot-reload via watch channel (RESL-02) -- v1.0
- ✓ RSS error surfacing (RESL-03) -- v1.0
- ✓ LLM provider switch guard (RESL-04) -- v1.0
- ✓ Offline mode with 72h TTL (RESL-05) -- v1.0
- ✓ Dedup test suite 28 cases (TEST-01) -- v1.0
- ✓ Rate limiter stress tests (TEST-02) -- v1.0
- ✓ Scheduler shutdown tests (TEST-03) -- v1.0
- ✓ Personal scoring edge case tests (TEST-04) -- v1.0
- ✓ TS hook error handling tests (TEST-05) -- v1.0
- ✓ Component partial data tests (TEST-06) -- v1.0
- ✓ Coverage infrastructure (TEST-07) -- v1.0
- ✓ Dependency version pinning (DEP-01, DEP-02, DEP-03) -- v1.0
- ✓ Mute filter migration to SQL (FRNT-01) -- v1.0

### Active

(Next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope

- 新規 Wing の追加 -- 安定化マイルストーンのため
- 新しい API ソースの追加 -- 既存ソースの安定化が優先
- UI デザインの大幅変更 -- 機能的改善のみ
- circuit breaker ライブラリ導入 -- 4 API ソースではオーバーエンジニアリング
- テレメトリ / Sentry 導入 -- デスクトップアプリのプライバシー懸念
- OAuth / ユーザー認証 -- デスクトップアプリで不要

## Constraints

- **Tech stack**: 既存スタック維持（Tauri v2, Rust, React 19, TypeScript, SQLite）
- **Architecture**: 4層アーキテクチャを崩さない
- **Compatibility**: 既存の DB スキーマとの後方互換性を維持
- **Testing**: 変更には必ず対応テストを追加

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 新機能なし、安定化のみ | 既存機能の品質が今後の拡張の土台 | ✓ 33要件すべて完了 |
| CONCERNS.md 全項目対応 | 部分対応では技術的負債が蓄積 | ✓ 全項目対処済み |
| バランス型最適化 | 特定領域に偏らず全面的に底上げ | ✓ Safety/Perf/Security/Test均等 |
| rfd for OS dialog | tauri-plugin-dialog not in Cargo.toml | ✓ rfd 0.15 adopted |
| watch::channel for config | Reactive push vs Arc<RwLock> polling | ✓ Clean hot-reload |
| CancellationToken as independent State | Avoids circular Arc in AppState | ✓ Clean shutdown |
| Provider guard at command layer | Keeps deepdive_service pure | ✓ Clean separation |
| Defense-in-depth profile limits | App + DB trigger dual validation | ✓ SEC-02 complete |
| Arc<dyn LlmClient> for tokio::join! | Box doesn't support sharing across tasks | ✓ Parallel digest works |
| RAYON_THRESHOLD=50 | Avoids thread-pool overhead for small feeds | ✓ Balanced perf |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after v1.0 milestone*
