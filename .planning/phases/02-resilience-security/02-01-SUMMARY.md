---
phase: 02-resilience-security
plan: 01
subsystem: infra
tags: [tokio, cancellation-token, watch-channel, tauri-lifecycle, graceful-shutdown, hot-reload]

# Dependency graph
requires:
  - phase: 01-foundation-correctness
    provides: "4-layer architecture, AppState pattern, scheduler infrastructure"
provides:
  - "CancellationToken-based graceful shutdown for scheduler loops"
  - "watch::channel-based SchedulerConfig hot-reload without restart"
  - "Window close event handler with 5s timeout safety net"
affects: [02-02, 02-03, 03-performance-testing]

# Tech tracking
tech-stack:
  added: [tokio-util 0.7 (CancellationToken), url 2.5 (for Plan 03)]
  patterns: [tokio::select! multi-branch loop, watch channel for config broadcast, prevent_close + async spawn shutdown]

key-files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/src/services/scheduler.rs
    - src-tauri/src/commands/scheduler.rs

key-decisions:
  - "watch::channel over Arc<RwLock> for SchedulerConfig hot-reload (reactive push vs polling)"
  - "Fixed 5s grace period instead of JoinHandle tracking (simpler, loops break nearly instantly on cancel)"
  - "CancellationToken managed independently via app.manage(), not inside AppState (per state_no_mutex.md)"

patterns-established:
  - "tokio::select! with CancellationToken + watch::Receiver for cancellable background loops"
  - "on_window_event CloseRequested -> prevent_close -> async spawn -> cancel + timeout -> exit(0)"
  - "watch::Sender as Arc in Tauri State for command-to-loop config broadcast"

requirements-completed: [RESL-01, RESL-02]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 02 Plan 01: Graceful Scheduler Shutdown + Config Hot-Reload Summary

**CancellationToken-based graceful shutdown with 5s timeout and watch-channel config hot-reload for collect_loop and digest_loop**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T17:01:37Z
- **Completed:** 2026-03-27T17:05:56Z
- **Tasks:** 1
- **Files modified:** 5 (including Cargo.lock)

## Accomplishments

- collect_loop and digest_loop now use tokio::select! with CancellationToken for clean shutdown on window close
- Window close triggers prevent_close -> async CancellationToken.cancel() -> 5s grace period -> exit(0)
- SchedulerConfig changes broadcast via watch channel to running loops without app restart
- set_scheduler_config command sends new config via watch::Sender and emits Tauri event for frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CancellationToken + watch channel to scheduler lifecycle** - `9fcaf3c` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added tokio-util 0.7 (CancellationToken) and url 2.5 dependencies
- `src-tauri/src/lib.rs` - CancellationToken creation, watch channel setup, on_window_event shutdown handler
- `src-tauri/src/services/scheduler.rs` - tokio::select! loops with cancel + config_rx branches in both collect_loop and digest_loop
- `src-tauri/src/commands/scheduler.rs` - watch::Sender integration + Tauri event emit in set_scheduler_config

## Decisions Made

- Used watch::channel instead of Arc<RwLock<SchedulerConfig>> for config hot-reload -- watch provides reactive push notification to loops, eliminating need for polling or Tauri event listeners inside Rust loops
- Fixed 5s grace period via tokio::time::timeout instead of tracking JoinHandles -- loops break on CancellationToken nearly instantly, the timeout is a safety net for in-flight DB writes
- CancellationToken stored as independent tauri::State, not inside AppState (follows state_no_mutex.md pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data paths are fully wired.

## Next Phase Readiness

- Graceful shutdown and config hot-reload infrastructure ready
- Plan 02 (RSS parse error visibility) and Plan 03 (OPML URL validation) can proceed independently

---
*Phase: 02-resilience-security*
*Completed: 2026-03-28*

## Self-Check: PASSED
