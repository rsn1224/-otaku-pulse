---
phase: 01-foundation-correctness
plan: 03
subsystem: infra
tags: [sqlx, cargo, dependency-pinning, mute-filter, sql, typescript, rust]

requires:
  - phase: 01-02
    provides: Migration 008 applied (content_hash, summary_hash columns) — needed for cargo sqlx migrate run

provides:
  - Cargo.toml pins feed-rs ~2.1, reqwest ~0.12, sqlx ~0.8 to prevent silent patch breakage
  - .sqlx/ directory established for sqlx offline mode CI builds
  - Mute keyword filtering moved from TypeScript useMemo to SQL NOT EXISTS subquery in all 5 discover_queries.rs fetch functions
  - applyMuteFilters removed from frontend codebase entirely

affects:
  - Phase 2 performance work: SQL-level mute filter affects query complexity
  - CI pipeline: SQLX_OFFLINE=true cargo check now confirmed working
  - Any future discover query additions: must include NOT EXISTS mute filter subquery pattern

tech-stack:
  added: [sqlx-cli v0.8.6]
  patterns:
    - SQL NOT EXISTS subquery for mute keyword filtering (title, summary, ai_summary columns)
    - Tilde (~) prefix version pinning for I/O-critical crates in Cargo.toml
    - .sqlx/ directory for sqlx offline mode (empty when project uses runtime queries only)

key-files:
  created:
    - src-tauri/.sqlx/.gitkeep
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/services/discover_queries.rs
    - src/lib/articleFilter.ts
    - src/components/wings/DiscoverWing.tsx
    - src/test/lib/articleFilter.test.ts

key-decisions:
  - "Project uses sqlx::query() runtime queries, not sqlx::query!() macros — .sqlx/ directory is empty but SQLX_OFFLINE=true still works"
  - "ai_summary column included in mute filter SQL (matching original TS applyMuteFilters behavior)"
  - "useFilterStore retained — muteKeywords state still needed for getHighlightKeywords display logic"
  - "Test suite updated to remove applyMuteFilters tests; getHighlightKeywords tests retained"

patterns-established:
  - "SQL mute filter: NOT EXISTS (SELECT 1 FROM keyword_filters kf WHERE kf.filter_type = 'mute' AND (LOWER(a.title) LIKE ... OR LOWER(COALESCE(a.summary,'')) LIKE ... OR LOWER(COALESCE(a.ai_summary,'')) LIKE ...))"
  - "Dependency pinning: use ~ prefix for feed-rs, reqwest, sqlx to allow patch updates only"

requirements-completed: [DEP-01, DEP-02, DEP-03, FRNT-01]

duration: 10min
completed: 2026-03-28
---

# Phase 01 Plan 03: Dependency Pinning & Mute Filter Migration Summary

**Tilde-pinned feed-rs/reqwest/sqlx in Cargo.toml, established .sqlx/ offline directory, and moved mute keyword filtering from TypeScript useMemo to SQL NOT EXISTS subquery across all 5 discover_queries.rs fetch functions**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-28T01:15:00Z
- **Completed:** 2026-03-28T01:25:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Pinned feed-rs = "~2.1", reqwest = "~0.12", sqlx = "~0.8" — prevents silent breakage from future patch versions
- All 5 discover query functions (get_for_you, get_trending, get_by_category, get_popular, get_most_viewed) now filter muted keywords at SQL level, checking title, summary, and ai_summary columns
- Removed applyMuteFilters from frontend entirely — no more client/server filter duplication
- Established .sqlx/ directory; confirmed SQLX_OFFLINE=true cargo check passes (runtime queries, no compile-time macros)
- Updated test suite: removed applyMuteFilters tests (logic moved to Rust), retained getHighlightKeywords tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin dependency versions + mute filter migration to Rust** - `ca21881` (feat)
2. **Task 2: Generate sqlx offline metadata** - `3b04c76` (chore)

## Files Created/Modified

- `src-tauri/Cargo.toml` — feed-rs, reqwest, sqlx pinned with ~ prefix
- `src-tauri/src/services/discover_queries.rs` — NOT EXISTS mute filter added to all 5 fetch functions
- `src/lib/articleFilter.ts` — applyMuteFilters removed, getHighlightKeywords retained
- `src/components/wings/DiscoverWing.tsx` — removed applyMuteFilters import/useMemo call; articles passed directly
- `src/test/lib/articleFilter.test.ts` — removed applyMuteFilters test suite
- `src-tauri/.sqlx/.gitkeep` — preserves empty .sqlx/ directory for future macros

## Decisions Made

- Project uses `sqlx::query()` (runtime) rather than `sqlx::query!()` (compile-time) — so `cargo sqlx prepare` produces no JSON files. The `.sqlx/` directory is empty but SQLX_OFFLINE=true cargo check still passes correctly. This is not a problem.
- `useFilterStore` and its `muteKeywords` state are retained — needed for `getHighlightKeywords` display logic (highlight keywords still read from the same store).
- The mute filter SQL checks `ai_summary` column to match the original TypeScript behavior exactly.
- `DiscoverWing.tsx` now passes `articles` directly to `ArticleList` instead of `filteredArticles` (computed via useMemo) since the backend filters at query time.

## Deviations from Plan

None — plan executed exactly as written. The "no queries found" warning from `cargo sqlx prepare` was expected behavior (runtime queries, not macros) and does not affect correctness.

## Issues Encountered

- `cargo sqlx prepare` warning "no queries found" — resolved by confirming project uses runtime `sqlx::query()` calls rather than compile-time `sqlx::query!()` macros. SQLX_OFFLINE=true still functions correctly.
- Biome v2 does not accept `--apply` flag (changed to `--write`) — minor CLI difference, fixed immediately.

## Known Stubs

None — all changes wire real functionality.

## Next Phase Readiness

- Phase 01 plan 03 complete — all 3 plans in phase 01-foundation-correctness are now done
- Dependencies pinned, offline builds confirmed, mute filtering consolidated to SQL layer
- Phase 02 (performance) work on discover queries should account for the NOT EXISTS subquery when benchmarking

## Self-Check: PASSED

- FOUND: src-tauri/.sqlx/.gitkeep
- FOUND: src-tauri/src/services/discover_queries.rs (mute filter added)
- FOUND: src/lib/articleFilter.ts (applyMuteFilters removed)
- FOUND: .planning/phases/01-foundation-correctness/01-03-SUMMARY.md
- FOUND commit: ca21881 (Task 1)
- FOUND commit: 3b04c76 (Task 2)

---
*Phase: 01-foundation-correctness*
*Completed: 2026-03-28*
