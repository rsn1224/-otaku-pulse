---
phase: 02-resilience-security
plan: 02
subsystem: resilience
tags: [error-handling, offline-mode, llm-guard, tauri-events, zustand]

# Dependency graph
requires:
  - phase: 01-foundation-correctness
    provides: "Stable collector, dedup, and deepdive services"
provides:
  - "FeedError struct with per-feed error details in collector::refresh_all()"
  - "collect-failed Tauri event when all feeds fail"
  - "DeepDive LLM provider consistency guard"
  - "Frontend isOffline state and offline banner"
affects: [02-03, settings-ui, feed-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tuple return type for multi-signal results (saved, processed, errors)"
    - "Provider consistency check via cached provider comparison"
    - "Event-driven offline state management (collect-failed / collect-completed toggle)"

key-files:
  created: []
  modified:
    - "src-tauri/src/services/collector.rs"
    - "src-tauri/src/services/scheduler.rs"
    - "src-tauri/src/commands/discover_ai.rs"
    - "src/stores/useSchedulerStore.ts"
    - "src/components/wings/DiscoverWing.tsx"

key-decisions:
  - "Provider guard at command layer (discover_ai.rs) not service layer -- keeps deepdive_service pure"
  - "Offline state driven by Tauri events, not polling -- auto-recovery on next successful collection"
  - "No DB migration needed for provider guard -- deepdive_cache already has provider column"

patterns-established:
  - "FeedError struct pattern: collect per-feed errors into Vec instead of only logging"
  - "Event-driven offline toggle: collect-failed sets isOffline, collect-completed clears it"

requirements-completed: [RESL-03, RESL-04, RESL-05]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 02 Plan 02: Error Visibility + Provider Guard + Offline Mode Summary

**RSS feed error surfacing via FeedError tuples, DeepDive LLM provider switch guard, and event-driven offline banner**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T17:07:33Z
- **Completed:** 2026-03-27T17:13:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- RSS feed errors captured in FeedError structs and forwarded to frontend via events and get_feeds command
- DeepDive provider guard prevents mixed-provider conversations with clear error message
- Frontend tracks offline state via collect-failed / collect-completed events with auto-recovery
- Offline banner displays in DiscoverWing when all feeds fail

## Task Commits

Each task was committed atomically:

1. **Task 1: RSS error surfacing and collector return type change** - `c8b9e59` (feat)
2. **Task 2: LLM provider switch guard and offline mode** - `ceb67e5` (feat)

## Files Created/Modified
- `src-tauri/src/services/collector.rs` - Added FeedError struct, changed refresh_all return to (u32, u32, Vec<FeedError>)
- `src-tauri/src/services/scheduler.rs` - Updated collect_loop for new return type, emit collect-failed event
- `src-tauri/src/commands/discover_ai.rs` - Added provider consistency check for ask_deepdive and ask_deepdive_followup
- `src/stores/useSchedulerStore.ts` - Added isOffline state, setOffline action, collect-failed listener
- `src/components/wings/DiscoverWing.tsx` - Added offline banner conditional rendering

## Decisions Made
- Provider guard implemented at command layer (discover_ai.rs) rather than service layer to keep deepdive_service pure and testable
- No DB migration needed -- deepdive_cache already has provider column from Phase 1 work
- Offline state is event-driven (not polling) with automatic recovery when collection succeeds
- Clippy collapsible-if suggestion adopted: combined nested if into single condition with let-chain

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed clippy collapsible-if warning in scheduler.rs**
- **Found during:** Task 2 (verification)
- **Issue:** Nested `if` blocks in collect-failed emission triggered clippy::collapsible_if
- **Fix:** Combined into single if condition with let-chain pattern
- **Files modified:** src-tauri/src/services/scheduler.rs
- **Verification:** cargo clippy -- -D warnings passes
- **Committed in:** ceb67e5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor style fix required by clippy. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all data paths are wired to real sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error visibility infrastructure ready for Settings UI to display feed error indicators
- Offline banner functional; future plans can enhance with retry button or detailed error list
- Provider guard active; frontend could add UX to prompt user when provider mismatch detected

---
*Phase: 02-resilience-security*
*Completed: 2026-03-27*
