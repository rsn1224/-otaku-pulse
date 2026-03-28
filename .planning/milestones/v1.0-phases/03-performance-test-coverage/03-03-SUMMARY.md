---
phase: 03-performance-test-coverage
plan: 03
subsystem: rust-backend-tests
tags: [testing, scheduler, personal-scoring, cancellation-token, edge-cases]
dependency_graph:
  requires: [03-01]
  provides: [scheduler-cancellation-tests, personal-scoring-edge-case-tests]
  affects: [scheduler.rs, personal_scoring.rs]
tech_stack:
  added: []
  patterns: [tokio::select! CancellationToken, watch::channel config update, in-memory SQLite, #[tokio::test]]
key_files:
  created: []
  modified:
    - src-tauri/src/services/scheduler.rs
    - src-tauri/src/services/personal_scoring.rs
decisions:
  - "Scheduler CancellationToken tests isolate the tokio::select! pattern without requiring AppHandle/AppState construction"
  - "personal_scoring tests use crate::services::test_helpers::setup_test_db() for in-memory SQLite"
  - "calc_base_score signature is &Option<String> — plan template adapted accordingly"
  - "rescore_all empty DB test valid because setup_test_db seeds user_profile with id=1 row"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 03: Scheduler and personal_scoring Tests Summary

**One-liner:** 3 CancellationToken shutdown tests proving collect_loop/digest_loop patterns exit within 1s, plus 7 edge case tests for personal_scoring covering empty profiles, stale articles, unparseable dates, dwell cap, and empty DB CTE queries.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add scheduler CancellationToken shutdown tests (TEST-03) | 7e0bb9d | scheduler.rs |
| 2 | Add personal_scoring edge case tests (TEST-04) | 87f824c | personal_scoring.rs |

## What Was Built

### TEST-03: Scheduler CancellationToken Tests (scheduler.rs)

Added `#[cfg(test)] mod tests` block with 3 tests isolating the `tokio::select!` + `CancellationToken` pattern used by both `collect_loop` and `digest_loop`. Since the actual loops require `AppHandle` and `AppState`, the tests replicate the cancellation pattern directly, proving correctness of the mechanism independently:

- `test_cancellation_token_exits_loop_immediately`: Spawns a loop with a 3600s sleep inside `tokio::select!`, cancels immediately — asserts exit within 1s.
- `test_cancellation_during_sleep_exits_promptly`: Cancels after 50ms delay — asserts the active sleep is interrupted and "cancelled" is returned.
- `test_config_change_interrupts_sleep`: Verifies that `watch::channel` config update breaks a 3600s sleep, matching the `digest_loop` config hot-reload pattern.

All 3 tests pass in 0.06s.

### TEST-04: personal_scoring Edge Case Tests (personal_scoring.rs)

Added 7 new tests to the existing `#[cfg(test)]` block (was 5 tests, now 13 total):

- `test_calc_personal_score_empty_favorites`: Empty title/genre/creator slices produce score 0.0.
- `test_calc_base_score_none_published_at`: `None` date returns fallback 0.3 (existing codebase behavior confirmed).
- `test_calc_base_score_73h_old_article`: 73h-old article (beyond 72h boundary) scores lower than fresh article.
- `test_calc_base_score_unparseable_date`: `"not-a-date"` string does not panic and returns valid fallback in [0.0, 1.0].
- `test_dwell_bonus_cap`: Excess dwell of 1000s is capped at `DWELL_BONUS_CAP` (2.0), validating the constant embedded in PERF-03's SQL `MIN()` expression.
- `test_batch_interaction_bonuses_empty_db`: PERF-03's CTE query returns empty `HashMap` on empty DB — proves the single-CTE refactor handles zero-data case correctly.
- `test_rescore_all_empty_db`: `rescore_all` on empty DB returns 0 without panicking (user_profile row seeded by `setup_test_db`).

All 13 tests pass in 0.01s.

## Verification

```
cargo test --lib scheduler     — 3/3 passed
cargo test --lib personal_scoring — 13/13 passed
ALL TESTS PASS
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] calc_base_score signature mismatch in plan template**

- **Found during:** Task 2 implementation
- **Issue:** Plan template used `calc_base_score(Some("date"))` (takes `Option<&str>`), but actual function signature is `calc_base_score(&Option<String>)`.
- **Fix:** Tests written with correct `&Some("date".to_string())` / `&None` syntax matching actual API.
- **Files modified:** src-tauri/src/services/personal_scoring.rs
- **Commit:** 87f824c

**2. [Rule 1 - Bug] calc_personal_score has no `category` or `creator` parameters**

- **Found during:** Task 2 implementation
- **Issue:** Plan template included `category` and `creator` as separate parameters, but actual function is `calc_personal_score(title, favorite_titles, favorite_genres, favorite_creators)`.
- **Fix:** Test written with correct 4-parameter signature.
- **Files modified:** src-tauri/src/services/personal_scoring.rs
- **Commit:** 87f824c

## Known Stubs

None — all changes are pure test additions with no placeholder values.

## Self-Check: PASSED
