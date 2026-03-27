---
phase: 01-foundation-correctness
plan: 01
subsystem: rust-backend
tags: [safety, startup, error-handling, database, rate-limiter, testing]
dependency_graph:
  requires: []
  provides: [startup-safety, wal-mode, f64-token-accounting, deserialization-warn-logging]
  affects: [src-tauri/src/lib.rs, src-tauri/src/infra/database.rs, src-tauri/src/infra/rate_limiter.rs, src-tauri/src/services/deepdive_service.rs, src-tauri/src/services/personal_scoring.rs]
tech_stack:
  added: [rfd 0.15]
  patterns: [staged-setup-error-handling, map_err-with-japanese-message, blocking-os-dialog-before-exit]
key_files:
  created: []
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/infra/database.rs
    - src-tauri/src/infra/rate_limiter.rs
    - src-tauri/src/infra/rate_limiter_tests.rs
    - src-tauri/src/services/deepdive_service.rs
    - src-tauri/Cargo.toml
decisions:
  - "Used rfd 0.15 for OS native dialog (Option B) — tauri-plugin-dialog not in Cargo.toml/tauri.conf.json"
  - "personal_scoring.rs deserialization already used tracing::warn on all 3 fields — no changes needed"
  - "serde_json::to_string().unwrap_or_default() in deepdive_service not changed — serialization failures are benign (empty string written to cache), only deserialization from_str targeted"
metrics:
  duration: "6 minutes"
  completed: "2026-03-28"
  tasks_completed: 3
  files_modified: 6
requirements_covered: [SAFE-01, SAFE-02, SAFE-03, SAFE-04, BUG-04, PERF-01]
---

# Phase 01 Plan 01: Foundation Safety Fixes Summary

**One-liner:** Eliminated startup panics with staged error handling and rfd OS dialog, enabled SQLite WAL mode before migrations, and fixed rate limiter f64 token precision with 4 new tests.

## What Was Done

### Task 1: Staged startup error handling + OS native dialog + WAL mode

**lib.rs refactored (D-01, D-02, D-03, D-11):**
- Extracted setup body into `run_setup(app)` returning `Result<(), Box<dyn std::error::Error>>`
- `app.path().app_data_dir()` — replaced `unwrap_or_else(|_| panic!)` with `map_err` + Japanese error message + `?`
- DB init — replaced `unwrap_or_else(|_| panic!)` with `map_err` + Japanese error message + `?`
- `llm.write().expect(...)` — replaced with `map_err` returning structured error (D-11 lock poisoning fix)
- `run_setup` failure triggers `rfd::MessageDialog` blocking OS native error dialog before returning `Err`
- Dialog title: "致命的なエラー", description includes "OtakuPulse 起動エラー" (D-02, D-03)
- Added `rfd = "0.15"` to Cargo.toml dependencies

**database.rs (D-10):**
- Added `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL` after pool creation and BEFORE `sqlx::migrate!()`
- WAL mode improves concurrent read performance and crash resilience

### Task 2: Error handling improvements + rate limiter f64 fix

**deepdive_service.rs (D-12, SAFE-03):**
- Line 55: `serde_json::from_str(&follow_ups_json).unwrap_or_default()` replaced with `unwrap_or_else(|e| { tracing::warn!(...); Default::default() })`
- `serde_json::to_string().unwrap_or_default()` calls (lines 95, 158) left unchanged — serialization failures write empty string to cache, which is benign

**personal_scoring.rs (D-12, SAFE-04 overridden):**
- No changes needed — all 3 deserialization sites (favorite_titles, favorite_genres, favorite_creators) already used `tracing::warn!` with `unwrap_or_else`

**rate_limiter.rs (D-13, BUG-04):**
- `TokenBucket.tokens`: `Arc<Mutex<u32>>` → `Arc<Mutex<f64>>`
- `new()`: `max_tokens` cast to `f64` on initialization
- `refill_tokens()`: removed `as u32` cast — `tokens_to_add` is now pure `f64`
- `acquire()`: `*tokens > 0` → `*tokens >= 1.0`, decrement by `1.0` not `1`
- `update_from_response()`: header-parsed `u32` cast to `f64` on assignment

### Task 3: Minimal tests (D-17)

4 new tests added:

| Test | File | Verifies |
|------|------|----------|
| `test_fractional_token_refill` | rate_limiter_tests.rs | 1.5 tokens after 3s at 0.5/s (f64 preserved, not truncated to 1) |
| `test_acquire_requires_full_token` | rate_limiter_tests.rs | 0.9 tokens blocked, 1.0 tokens allowed, 0.0 left after |
| `test_token_does_not_exceed_max` | rate_limiter_tests.rs | cap at max_tokens with surplus refill |
| `test_wal_mode_enabled` | database.rs | `PRAGMA journal_mode` returns "wal" after `init_pool()` |

**All 120 tests pass** (116 existing + 4 new).

## Decisions Made

1. **rfd 0.15 for OS native dialog** — tauri-plugin-dialog was not in Cargo.toml or tauri.conf.json plugins. rfd provides a blocking cross-platform dialog that works before WebView is mounted.

2. **personal_scoring.rs no changes needed** — All 3 JSON deserialization sites already used `tracing::warn!` with `unwrap_or_else`. Plan correctly anticipated this and said "verify and leave if already correct."

3. **Serialization to_string not modified** — `serde_json::to_string().unwrap_or_default()` in deepdive_service results in an empty follow_ups_json string in the DB cache, which is harmless (the question still gets answered). Only `from_str` deserialization failures were in scope per D-12.

## Deviations from Plan

None — plan executed exactly as written. The STATE.md note "setup() panic fix must use Err return, not dialog" was reconciled: the implementation uses BOTH — `run_setup()` returns `Err`, and the caller shows the dialog before returning. This satisfies both the note (Err return as primary mechanism) and the PLAN must_have (OS native dialog displayed to user).

## Self-Check: PASSED

All 6 modified files exist. All 3 task commits verified (7233ce6, 7340c07, 16d5c66). 120 tests pass, clippy clean.
