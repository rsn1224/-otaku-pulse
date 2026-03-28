---
phase: 04-design-token-foundation
plan: 02
subsystem: ui
tags: [css, design-tokens, tailwind, legacy-migration, material-design-3]

# Dependency graph
requires:
  - phase: 04-design-token-foundation/01
    provides: MD3 token definitions in globals.css :root
provides:
  - Zero legacy CSS alias references in src/
  - Clean :root without Legacy aliases section
  - --surface-elevated token for D-12 absorption
affects: [04-design-token-foundation/03, 05-component-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns: [direct-token-reference, no-alias-indirection]

key-files:
  created: []
  modified:
    - src/styles/globals.css
    - src/styles/components.css
    - src/components/**/*.tsx (39 files)

key-decisions:
  - "Added --surface-elevated: #131319 to preserve exact visual for --bg-secondary/--bg-deepdive (D-12 absorption, Plan 03 will update HEX)"
  - "StepGenres.tsx included in migration (inline style var(--accent) -> var(--primary)) though not in original file list"

patterns-established:
  - "All CSS references use canonical MD3 token names directly (no alias indirection)"
  - "grep-then-replace workflow validated for batch token migrations"

requirements-completed: [DTKN-06]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 04 Plan 02: Legacy Alias Migration Summary

**Batch-replaced 212 legacy CSS alias references across 41 files with canonical MD3 tokens and deleted the Legacy aliases section from globals.css**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T08:12:57Z
- **Completed:** 2026-03-28T08:16:01Z
- **Tasks:** 2
- **Files modified:** 42

## Accomplishments
- All 16 legacy CSS aliases (--bg-primary, --bg-card, --text-primary, --accent, --border, etc.) fully replaced with canonical MD3 token names across 41 source files
- Legacy aliases section completely removed from globals.css -- zero indirection remains
- --surface-elevated: #131319 added to :root as D-12 absorption target (preserves exact visual for --bg-secondary/--bg-deepdive)
- All quality gates pass: Biome (0 errors), TypeScript (0 errors), Vitest (102 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Batch replace all legacy alias references across src/** - `87a2cd1` (feat)
2. **Task 2: Delete Legacy aliases section from globals.css** - `5255e80` (refactor)

## Files Created/Modified
- `src/styles/globals.css` - Added --surface-elevated token, removed Legacy aliases section (16 aliases + comment)
- `src/styles/components.css` - 30+ var(--legacy) replaced with var(--canonical-token)
- `src/components/common/*.tsx` (4 files) - Tailwind arbitrary syntax updated
- `src/components/discover/*.tsx` (6 files) - Tailwind arbitrary syntax updated
- `src/components/layout/*.tsx` (2 files) - Tailwind arbitrary syntax updated
- `src/components/onboarding/*.tsx` (4 files) - Tailwind arbitrary syntax + inline style vars updated
- `src/components/profile/*.tsx` (3 files) - Tailwind arbitrary syntax updated
- `src/components/reader/*.tsx` (2 files) - Tailwind arbitrary syntax updated
- `src/components/schedule/*.tsx` (5 files) - Tailwind arbitrary syntax updated
- `src/components/ui/*.tsx` (7 files) - Tailwind arbitrary syntax updated
- `src/components/wings/*.tsx` (6 files) - Tailwind arbitrary syntax updated

## Decisions Made
- Added --surface-elevated: #131319 as a provisional token to preserve exact visual appearance of --bg-secondary and --bg-deepdive areas. Plan 03 will update this HEX value after Stitch session confirmation.
- Included StepGenres.tsx in migration (had inline style references to var(--accent)) even though it was not in the plan's files_modified list -- auto-discovered via grep audit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] StepGenres.tsx not in plan file list but contained legacy aliases**
- **Found during:** Task 1 (grep audit step)
- **Issue:** StepGenres.tsx had `borderColor: 'var(--accent)'` and `color: 'var(--accent)'` inline styles not listed in plan
- **Fix:** Included in batch sed replacement (--accent -> --primary)
- **Files modified:** src/components/onboarding/StepGenres.tsx
- **Verification:** grep confirms zero legacy references
- **Committed in:** 87a2cd1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing file in plan scope)
**Impact on plan:** Necessary for complete migration. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all replacements are direct token name swaps with identical visual values.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All legacy aliases eliminated -- Plan 03 can safely commit Stitch palette values
- --surface-elevated exists at #131319 -- Plan 03 Task 1 will update this HEX value
- globals.css :root is clean and ready for new token additions
- All 102 Vitest tests + Biome + TypeScript gates green

---
*Phase: 04-design-token-foundation*
*Completed: 2026-03-28*
