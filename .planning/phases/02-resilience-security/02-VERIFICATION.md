---
phase: 02-resilience-security
verified: 2026-03-28T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 2: Resilience & Security Verification Report

**Phase Goal:** The scheduler shuts down cleanly without risking DB corruption, Settings changes take effect immediately, the app serves cached content when offline, and no API key leaks into logs.
**Verified:** 2026-03-28
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Closing the app window flushes in-flight DB writes and exits within 5 seconds | VERIFIED | `lib.rs:142-158` -- `CloseRequested` handler calls `api.prevent_close()`, fires `token.cancel()`, waits 5s timeout via `tokio::time::timeout`, then `handle.exit(0)`. `scheduler.rs:83-85,184-186` -- both `collect_loop` and `digest_loop` use `tokio::select!` with `token.cancelled()` branch to break immediately. |
| 2 | Changing the collection interval in Settings takes effect on the running scheduler without restarting the app | VERIFIED | `lib.rs:93` -- `watch::channel(initial_scheduler_config)` created at setup. `commands/scheduler.rs:86` -- `tx.send(scheduler_config)` pushes new config. `scheduler.rs:88-89,189-190` -- both loops react via `config_rx.changed()` branch in `select!`, rebuild interval timer with new duration. |
| 3 | When all external APIs are unreachable, the Feed shows articles from the last 72 hours rather than an empty screen | VERIFIED | `scheduler.rs:118` -- emits `collect-failed` event when all feeds fail. `useSchedulerStore.ts:98-100` -- listens for `collect-failed`, sets `isOffline: true`. `DiscoverWing.tsx:105-108` -- renders amber "Network unavailable -- showing cached articles" banner. `useSchedulerStore.ts:91` -- `collect-completed` resets `isOffline: false` (auto-recovery). Backend `get_discover_feed` reads from DB cache regardless. |
| 4 | A Perplexity API key cannot be reconstructed from the application log files | VERIFIED | `perplexity_client.rs:173-232` -- two wiremock-based tests (`test_api_key_not_leaked_in_error`, `test_api_key_not_leaked_in_network_error`) assert the secret key string never appears in `AppError` `.to_string()` output. All 139 Rust tests pass including these. |
| 5 | Broken RSS feeds surface a visible error in Settings rather than silently disappearing from the feed | VERIFIED | `collector.rs:16-18` -- `FeedError` struct captures per-feed errors. `collector.rs:29` -- `refresh_all()` returns `(u32, u32, Vec<FeedError>)`. `commands/feed.rs:36` -- query selects `consecutive_errors` and `last_error`. `types/index.ts:24,26` -- `FeedDto` has `consecutiveErrors` and `lastError` fields. `FeedsSection.tsx:125-157` -- renders error count badge and `lastError` text for each broken feed. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/services/scheduler.rs` | `select!` with CancellationToken + watch channel | VERIFIED | Both loops use `tokio::select!` with `token.cancelled()` and `config_rx.changed()` branches |
| `src-tauri/src/lib.rs` | CancellationToken creation, manage(), shutdown hook, watch channel | VERIFIED | Token created line 88, managed, `on_window_event` handler with prevent_close + cancel + timeout + exit |
| `src-tauri/src/commands/scheduler.rs` | watch::Sender config broadcast | VERIFIED | `tx.send()` on line 86 after saving config to DB |
| `src-tauri/src/services/collector.rs` | `FeedError` struct, tuple return type | VERIFIED | Struct at line 16, return type `(u32, u32, Vec<FeedError>)` at line 29 |
| `src-tauri/src/commands/discover_ai.rs` | Provider consistency guard | VERIFIED | `check_deepdive_provider_consistency()` called before `ask_deepdive` and `ask_deepdive_followup`, compares current provider against DB-stored provider |
| `src/stores/useSchedulerStore.ts` | `isOffline` state + event listeners | VERIFIED | `isOffline` state at line 43, `collect-failed` listener at line 98, auto-recovery at line 91 |
| `src-tauri/src/infra/perplexity_client.rs` | API key non-leakage tests | VERIFIED | Two test functions asserting secret key absence from error strings |
| `src-tauri/migrations/009_phase2_resilience.sql` | Profile size limit triggers | VERIFIED | `check_profile_size_update` and `check_profile_size_insert` triggers with 6000/1000/6000 limits |
| `src-tauri/src/services/profile_service.rs` | App-layer size validation | VERIFIED | `validate_profile_sizes()` called at line 57 before DB write in `update_profile()` |
| `src-tauri/src/services/opml_service.rs` | URL scheme validation | VERIFIED | `validate_feed_url()` at line 9, called for each OPML entry at line 94, rejects non-http/https schemes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib.rs` setup | `scheduler::start()` | CancellationToken + watch::Receiver args | VERIFIED | Token cloned and config_rx passed at line 104 |
| `lib.rs` on_window_event | CancellationToken::cancel() | try_state + cancel() | VERIFIED | `token.cancel()` at line 148 inside CloseRequested handler |
| `commands/scheduler.rs` | watch::Sender | tx.send() | VERIFIED | Line 86 sends new config through watch channel |
| `collector.rs refresh_all()` | `scheduler.rs collect_loop` | Return type (u32, u32, Vec\<FeedError\>) | VERIFIED | Scheduler destructures result and emits collect-completed/collect-failed events |
| `useSchedulerStore.ts` | `DiscoverWing.tsx` | isOffline state | VERIFIED | Store listened at DiscoverWing line 30, rendered at line 105 |
| `opml_service.rs validate_feed_url()` | `parse_opml()` | Called per xmlUrl | VERIFIED | Line 94 calls validate for each extracted URL |
| `profile_service.rs validate_profile_sizes()` | `update_profile()` | Called before DB write | VERIFIED | Line 57 validates before sqlx query execution |
| `discover_ai.rs check_deepdive_provider_consistency()` | `ask_deepdive` + `ask_deepdive_followup` | Called before LLM invocation | VERIFIED | Lines 78 and 97 call guard function |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Rust tests pass | `cargo test` | 139 passed, 0 failed | PASS |
| URL validation tests included | grep in opml_service.rs | 6 test functions found (https, http, javascript, file, data, too_long) | PASS |
| API key leak tests included | grep in perplexity_client.rs | 2 test functions (401 error, network error) | PASS |
| Profile size limit tests | grep in profile_service.rs | 3 test functions (titles, genres, creators exceeding limits) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RESL-01 | 02-01 | CancellationToken-based graceful shutdown | SATISFIED | scheduler.rs select! + lib.rs shutdown hook |
| RESL-02 | 02-01 | Config hot-reload via watch channel | SATISFIED | watch::channel + config_rx.changed() in loops |
| RESL-03 | 02-02 | RSS error visibility with FeedError tuple | SATISFIED | FeedError struct, FeedDto fields, FeedsSection UI |
| RESL-04 | 02-02 | DeepDive provider switch guard | SATISFIED | check_deepdive_provider_consistency() in discover_ai.rs |
| RESL-05 | 02-02 | Offline mode with cached content | SATISFIED | collect-failed event, isOffline state, banner in DiscoverWing |
| SEC-01 | 02-03 | API key log audit test | SATISFIED | Two wiremock tests proving key absence from errors |
| SEC-02 | 02-03 | Profile field size limits | SATISFIED | DB triggers (migration 009) + app-layer validation (profile_service.rs) |
| SEC-03 | 02-03 | OPML URL scheme validation | SATISFIED | validate_feed_url() rejects non-http/https, 6 unit tests |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, or stubs found in phase 02 artifacts |

### Human Verification Required

### 1. Graceful Shutdown Timing
**Test:** Close the app window during an active feed collection. Check that the process exits within 5 seconds and no WAL corruption occurs.
**Expected:** App closes cleanly, DB file is intact on next launch.
**Why human:** Requires running the full Tauri app and observing process lifecycle behavior.

### 2. Config Hot-Reload UX
**Test:** While the app is running, change the collection interval in Settings from 30 minutes to 5 minutes. Observe that the next collection happens after 5 minutes (not 30).
**Expected:** Timer resets to new interval immediately without app restart.
**Why human:** Requires observing real-time scheduler behavior in a running app.

### 3. Offline Banner Appearance
**Test:** Disconnect network, wait for a collection cycle to fail. Verify the amber banner appears in the Discover wing.
**Expected:** "Network unavailable -- showing cached articles" banner visible, cached articles still displayed.
**Why human:** Visual verification of banner styling and cached content display.

### 4. Feed Error Visibility in Settings
**Test:** Add a feed with an intentionally broken URL. Navigate to Settings and verify the error badge and message appear.
**Expected:** Warning icon with error count and last error text visible for the broken feed.
**Why human:** Visual verification of error indicator styling and positioning.

### Gaps Summary

No gaps found. All 8 requirement IDs (RESL-01 through RESL-05, SEC-01 through SEC-03) are accounted for and satisfied by verified artifacts. All 5 success criteria from the ROADMAP are verified with concrete code evidence. 139 Rust tests pass, including targeted tests for URL validation, API key non-leakage, and profile size limits. No anti-patterns or stubs detected.

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_
