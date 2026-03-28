---
phase: 03-performance-test-coverage
plan: 01
subsystem: rust-backend-performance
tags: [performance, tokio, rayon, sql, fts, scheduler, personal-scoring]
dependency_graph:
  requires: []
  provides: [parallel-digest-generation, single-cte-scoring, fts-pagination, rayon-normalization]
  affects: [scheduler.rs, personal_scoring.rs, fts_queries.rs, collector.rs, highlights_service.rs]
tech_stack:
  added: [rayon = "1"]
  patterns: [tokio::join!, CTE SQL, subquery pagination, rayon par_iter]
key_files:
  created: []
  modified:
    - src-tauri/src/services/scheduler.rs
    - src-tauri/src/services/personal_scoring.rs
    - src-tauri/src/services/fts_queries.rs
    - src-tauri/src/services/highlights_service.rs
    - src-tauri/src/commands/discover_ai.rs
    - src-tauri/Cargo.toml
    - src-tauri/src/services/collector.rs
decisions:
  - "build_scheduler_llm_client returns Arc<dyn LlmClient + Send + Sync> instead of Box to support tokio::join! across branches"
  - "DWELL_BONUS_CAP constant kept (with #[allow(dead_code)]) because value is documented and used in unit tests"
  - "search_discover command gains optional offset parameter — frontend can paginate without breaking existing callers"
  - "RAYON_THRESHOLD=50 prevents thread-pool overhead for small feeds typical of RSS/AniList batches"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-03-28"
  tasks_completed: 3
  files_modified: 7
---

# Phase 3 Plan 01: Rust Backend Performance Optimizations Summary

**One-liner:** Parallel digest generation via tokio::join!, 5-query-to-1-CTE personal scoring, FTS subquery pagination, and rayon URL normalization for feeds >= 50 articles.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Parallelize digest generation (PERF-02) | d5adb18 | scheduler.rs |
| 2 | Consolidate scoring queries + FTS pagination + highlights verify (PERF-03, PERF-04, PERF-05) | 8151910 | personal_scoring.rs, fts_queries.rs, highlights_service.rs, discover_ai.rs |
| 3 | Add rayon + parallelize URL normalization (PERF-06) | a0f2162 | Cargo.toml, collector.rs |

## What Was Built

### PERF-02: Parallel Digest Generation (scheduler.rs)

Replaced serial `for category in &["anime", "manga", "game", "pc"]` loop with `tokio::join!` dispatching all 4 categories concurrently. Each branch is wrapped in `tokio::time::timeout(120s)`. A helper `generate_and_save_digest` was extracted for clarity. The `build_scheduler_llm_client` return type changed from `Box<dyn LlmClient>` to `Arc<dyn LlmClient + Send + Sync>` to share the client across parallel branches without cloning.

Expected impact: ~4x reduction in digest generation wall-clock time when all 4 LLM calls complete concurrently. Failed/timed-out categories are logged and skipped — no cascade failure.

### PERF-03: Single CTE Query for personal_scoring (personal_scoring.rs)

Replaced `batch_interaction_bonuses`'s 5 sequential `sqlx::query_as` calls with a single CTE query joining bookmarks, deepdives, dwell_stats, and feed_engagement. The dwell bonus cap (2.0) is now enforced via `MIN()` directly in SQL. Result: 5 DB round-trips reduced to 1 per scoring cycle.

### PERF-04: FTS Pagination with Subquery (fts_queries.rs + discover_ai.rs)

Changed `search_articles` signature to accept `offset: i64`. The query now uses `WHERE a.id IN (SELECT rowid FROM articles_fts WHERE ... LIMIT ? OFFSET ?)` — the FTS scan is bounded before the JOIN, preventing full index loads into memory. Both call sites updated: `ai_search` uses `offset=0`, `search_discover` exposes `offset: Option<i64>` to the frontend.

### PERF-05: Highlights Verification (highlights_service.rs)

Confirmed `get_daily_highlights` already uses a single query (SELECT with JOIN + LEFT JOIN, LIMIT 5). Added `// PERF-05: Verified` comment. No functional changes needed.

### PERF-06: Rayon URL Normalization (collector.rs + Cargo.toml)

Added `rayon = "1"` to `[dependencies]`. In `collect_feed`, replaced the serial loop with a `par_iter` path gated by `RAYON_THRESHOLD = 50`. Feeds with < 50 articles use the original serial loop (avoids rayon thread-pool overhead for typical small batches). `normalize_url` and `generate_content_hash` are pure functions with no shared state — safe for rayon.

## Verification

```
cargo check      — PASSED (no errors)
cargo clippy -- -D warnings — PASSED (no warnings)
cargo test       — PASSED (139 tests)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Dead code warning from DWELL_BONUS_CAP**

- **Found during:** Task 2 verification (cargo check)
- **Issue:** After moving the dwell cap into SQL MIN(), the `DWELL_BONUS_CAP` constant produced a `dead_code` warning. clippy -D warnings would fail.
- **Fix:** Added `#[allow(dead_code)]` and updated doc comment to note the value is embedded in SQL and referenced in unit tests.
- **Files modified:** src-tauri/src/services/personal_scoring.rs
- **Commit:** 8151910

## Known Stubs

None — all changes are functional optimizations with no placeholder values or TODO paths.

## Self-Check: PASSED

Files confirmed present:
- src-tauri/src/services/scheduler.rs — contains `tokio::join!` and `DIGEST_TIMEOUT_SECS`
- src-tauri/src/services/personal_scoring.rs — `batch_interaction_bonuses` has single CTE query
- src-tauri/src/services/fts_queries.rs — `search_articles` signature includes `offset: i64`
- src-tauri/src/services/highlights_service.rs — contains `PERF-05: Verified` comment
- src-tauri/src/services/collector.rs — contains `RAYON_THRESHOLD` and `par_iter()`
- src-tauri/Cargo.toml — contains `rayon = "1"`

Commits confirmed:
- d5adb18 — Task 1 (PERF-02)
- 8151910 — Task 2 (PERF-03, PERF-04, PERF-05)
- a0f2162 — Task 3 (PERF-06)
