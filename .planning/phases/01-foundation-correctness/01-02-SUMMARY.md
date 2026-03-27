---
phase: 01-foundation-correctness
plan: 02
subsystem: database
tags: [rust, sqlite, dedup, unicode, nfkc, sha256, cache-invalidation, migration]

# Dependency graph
requires:
  - phase: 01-foundation-correctness/01-01
    provides: warn-logged fallbacks and f64 token precision fixes
provides:
  - NFKC Unicode normalization in dedup_service (normalize_title, generate_content_hash)
  - URL query parameter key-based sorting in normalize_url
  - DeepDive cache summary_hash invalidation (BUG-02)
  - DeepDive CACHE_TTL_DAYS reduced to 1 (24h)
  - Migration 008 resetting is_duplicate and content_hash for NFKC re-dedup
affects:
  - collector (uses dedup_service::generate_content_hash)
  - deepdive_service (cache lookup now validates summary_hash)
  - migrations (008_phase1_foundation.sql must run before next app start)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NFKC normalization via .nfkc().collect::<String>() for Japanese text dedup"
    - "Key-based URL param sort via sort_by_key(|(k,_)| *k) instead of raw string sort"
    - "Summary-hash cache invalidation: compute SHA-256 of current summary, compare with cached hash"

key-files:
  created:
    - src-tauri/migrations/008_phase1_foundation.sql
  modified:
    - src-tauri/src/services/dedup_service.rs
    - src-tauri/src/services/deepdive_service.rs
    - src-tauri/src/services/test_helpers.rs

key-decisions:
  - "generate_content_hash applies NFKC to content (not title+url) because its signature takes raw content; NFKC ensures half-width/full-width variants hash identically"
  - "Migration 008 clears content_hash and resets is_duplicate rather than recalculating in SQL -- SQLite cannot run Rust NFKC, so re-dedup happens on next collection cycle"
  - "DeepDive cache summary_hash stored as Optional<String>; NULL hash treated as cache miss to handle rows inserted before this migration"
  - "test_helpers.rs deepdive_cache schema updated to include summary_hash column to match migration 008"

patterns-established:
  - "Cache invalidation pattern: store hash of source data alongside cache entry, recompute on lookup, delete stale entry if mismatch"
  - "NFKC normalization should be applied at the earliest transformation point (normalize_title and generate_content_hash)"

requirements-completed: [BUG-01, BUG-02, BUG-03]

# Metrics
duration: 15min
completed: 2026-03-27
---

# Phase 1 Plan 02: Dedup Correctness + DeepDive Cache Invalidation Summary

**NFKC Unicode normalization for Japanese dedup, key-sorted URL params, and SHA-256 summary-hash cache invalidation for DeepDive — with migration 008 resetting dedup state**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T16:10:00Z
- **Completed:** 2026-03-27T16:25:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Fixed BUG-03: `normalize_title()` now uses `.nfkc()` instead of `.nfc()` — half-width katakana (e.g., ｶﾞﾝﾀﾞﾑ) now normalizes to full-width (ガンダム) before comparison
- Fixed BUG-01: `normalize_url()` now sorts query params by key name via `sort_by_key` — `?b=2&a=1` and `?a=1&b=2` produce identical normalized URLs
- Fixed BUG-02: DeepDive cache lookup now validates `summary_hash`; stale entries (summary changed) are deleted and regenerated
- Applied NFKC to `generate_content_hash()` so identical content in different Unicode forms produces identical SHA-256 hashes
- Reduced `CACHE_TTL_DAYS` from 7 to 1 (24-hour TTL)
- Created migration 008 to reset `is_duplicate` and clear `content_hash` for NFKC re-dedup on next collection

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix dedup normalization (NFKC + URL key-sort + content_hash propagation)** - `1d6aba4` (fix)
2. **Task 2: DeepDive cache invalidation + migration 008** - `6271336` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src-tauri/src/services/dedup_service.rs` - NFKC in normalize_title + generate_content_hash, key-sort in normalize_url, 5 new tests
- `src-tauri/src/services/deepdive_service.rs` - summary_hash cache validation, CACHE_TTL_DAYS=1, cache invalidation test
- `src-tauri/migrations/008_phase1_foundation.sql` - New: adds summary_hash column, resets is_duplicate, clears content_hash
- `src-tauri/src/services/test_helpers.rs` - Added summary_hash column to deepdive_cache test schema

## Decisions Made

- `generate_content_hash` takes `content: &str` (not `title + url` as described in plan interfaces) — applied NFKC to the content string directly, which achieves the same goal without changing the function signature that `collector.rs` relies on
- Migration 008 clears `content_hash = NULL` rather than trying to recalculate via SQL (SQLite has no NFKC support); collector will regenerate hashes with NFKC on next run
- `test_helpers.rs` needed updating to add `summary_hash` to the in-memory test schema so the new cache invalidation test could run

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated test_helpers.rs deepdive_cache schema**
- **Found during:** Task 2 (DeepDive cache invalidation)
- **Issue:** `test_helpers.rs` creates deepdive_cache without `summary_hash` column; the new cache invalidation test would fail because INSERT requires the column
- **Fix:** Added `summary_hash TEXT` to the deepdive_cache CREATE TABLE in test_helpers.rs
- **Files modified:** `src-tauri/src/services/test_helpers.rs`
- **Verification:** All deepdive tests pass including `test_cache_invalidated_on_summary_change`
- **Committed in:** `6271336` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — test schema update)
**Impact on plan:** Essential for test correctness. No scope creep.

## Issues Encountered

The plan described `generate_content_hash(title: &str, url: &str)` but the actual implementation has `generate_content_hash(content: &str)`. Applied NFKC to the content parameter instead of changing the signature (which would break `collector.rs`). The plan's intent — NFKC propagates to content hash — is fully achieved.

## Next Phase Readiness

- Dedup service is now NFKC-correct and URL-param-order-independent
- DeepDive cache will invalidate when article summaries are updated
- Migration 008 ready to run; existing dedup state will be cleared and rebuilt on next collection
- Plan 03 can proceed (final plan in Phase 1)

## Known Stubs

None — all changes are functional with real logic.

---
*Phase: 01-foundation-correctness*
*Completed: 2026-03-27*
