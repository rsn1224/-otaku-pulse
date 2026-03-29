---
phase: 06-motion-interaction-layer
plan: 02
subsystem: ui
tags: [css, animations, tailwind, react, micro-interactions, retro-design]

# Dependency graph
requires:
  - phase: 06-01
    provides: AnimatePresence wing transitions + useMotionConfig rollout
provides:
  - Retro CSS decoration motifs (corner brackets, scanlines, dot grid) via ::before/::after pseudo-elements
  - Consistent hover depth feedback on DiscoverCard, highlight-card, and Button variants
  - Bookmark/like micro-interaction keyframes wired to UI toggle actions
  - bookmarkUnpop/likePop keyframes in animations.css
  - retro-corner-bracket, retro-scanline, retro-decoration CSS classes in components.css
affects:
  - 06-03
  - any future component using retro decoration classes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retro decoration via CSS ::before/::after only — no JavaScript"
    - "Micro-interaction animation via className toggling (just-bookmarked / just-unbookmarked)"
    - "Hover depth unification: all interactive cards use translateY(-2px), buttons use translateY(-1px)"
    - "Animation state held in parent (DiscoverCard), passed as prop to child (CardHeader)"

key-files:
  created: []
  modified:
    - src/styles/components.css
    - src/styles/animations.css
    - src/components/common/SectionHeader.tsx
    - src/components/discover/DiscoverCard.tsx
    - src/components/discover/CardHeader.tsx
    - src/components/ui/Button.tsx

key-decisions:
  - "Corner bracket decoration uses ::before (top-left) + ::after (bottom-right) on a single element — avoids extra DOM nodes"
  - "Bookmark animation state (bookmarkAnimClass) owned by DiscoverCard, not CardHeader — keeps CardHeader stateless and reusable"
  - "ghost and danger Button variants excluded from hover translateY — ghost is inline text action, danger lift would feel playful for destructive actions"
  - "retro-scanline applied to non-compact thumbnail only — compact mode skips scanlines to preserve readability at small size"

patterns-established:
  - "Retro CSS decorations pattern: add retro-* class to element, CSS ::before/::after handles all visual decoration"
  - "Micro-interaction pattern: parent holds animation state string, passes to child as className prop, setTimeout clears state after animation duration"

requirements-completed:
  - MOTN-03
  - MOTN-04
  - MOTN-05

# Metrics
duration: ~15min
completed: 2026-03-29
---

# Phase 06 Plan 02: Retro CSS Decorations + Hover Depth + Bookmark Micro-interactions Summary

**CSS-only retro decorations (corner brackets, scanlines, dot grid) + unified hover lift (translateY) on all interactive elements + bookmarkPop/unpop micro-interaction keyframes wired to DiscoverCard bookmark toggle**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-29T01:22:00Z (estimated)
- **Completed:** 2026-03-29T01:37:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Populated three retro decoration CSS classes (retro-corner-bracket, retro-scanline, retro-decoration) using pure CSS ::before/::after pseudo-elements — zero JavaScript
- Fixed DiscoverCard and highlight-card hover to include smooth `transform 0.15s ease` transition (was missing from discover-card, causing snap instead of smooth lift)
- Added bookmarkUnpop and likePop keyframes to animations.css; wired bookmark animation state through DiscoverCard → CardHeader prop chain
- Unified Button hover depth: primary, outline, neon variants all get `hover:-translate-y-px` with `transition-transform duration-150`

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate retro CSS decorations + fix hover transitions + add micro-interaction keyframes** - `289f136` (feat)
2. **Task 2: Apply retro classes to components + wire bookmark animation + unify Button hover depth** - `289f136` (feat)

Both tasks were committed together in a single atomic commit.

**Plan metadata:** to be committed with this SUMMARY.

## Files Created/Modified

- `src/styles/components.css` - Added retro-corner-bracket, retro-scanline, retro-decoration CSS classes; fixed discover-card transition to include transform; added just-unbookmarked animation class
- `src/styles/animations.css` - Added bookmarkUnpop and likePop keyframes
- `src/components/common/SectionHeader.tsx` - Added `relative retro-decoration` to outer div className
- `src/components/discover/DiscoverCard.tsx` - Added retro-corner-bracket to card className; retro-scanline to non-compact thumbnail; bookmarkAnimClass state + handleBookmark animation trigger; passed bookmarkAnimClass prop to CardHeader
- `src/components/discover/CardHeader.tsx` - Added bookmarkAnimClass?: string prop; imported cn; applied cn('bookmark-btn', bookmarkAnimClass) to bookmark button
- `src/components/ui/Button.tsx` - Added hover:-translate-y-px to primary, neon variants; transition-transform to base classes

## Decisions Made

- Corner bracket uses single element's ::before (top-left) and ::after (bottom-right) — avoids extra DOM nodes while achieving bracket decoration
- Bookmark animation state owned by DiscoverCard (parent), not CardHeader (child) — keeps CardHeader stateless and easier to test
- ghost and danger Button variants excluded from translateY — ghost is inline text, danger lifting feels wrong for destructive actions
- retro-scanline on non-compact thumbnail only — compact mode (small icon) skips scanlines to preserve clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — all retro CSS classes are fully implemented with pseudo-elements. Bookmark animation is wired end-to-end. No placeholder values or empty stubs.

## Next Phase Readiness

- Retro decoration classes (retro-corner-bracket, retro-scanline, retro-decoration) are reusable across any future component
- Hover depth is unified: cards use translateY(-2px), buttons use translateY(-1px)
- Bookmark micro-interaction pattern established and ready to extend to like/share actions in 06-03
- No blockers for Phase 06 Plan 03

## Self-Check: PASSED

- `src/styles/components.css` — contains `.retro-corner-bracket::before` (line 857), `transform 0.15s ease` (line 30), `.bookmark-btn.just-unbookmarked svg` (line 193)
- `src/styles/animations.css` — contains `@keyframes bookmarkUnpop` (line 26), `@keyframes likePop` (line 38)
- `src/components/discover/DiscoverCard.tsx` — contains `retro-corner-bracket` (line 160), `retro-scanline` (line 136), `setBookmarkAnimClass` (line 43)
- `src/components/common/SectionHeader.tsx` — contains `retro-decoration` (line 31)
- `src/components/discover/CardHeader.tsx` — contains `bookmarkAnimClass` prop (line 36, 42, 61)
- `src/components/ui/Button.tsx` — contains `hover:-translate-y-px` (lines 16, 21), `transition-transform` (line 9)
- Commit 289f136 exists in git log

---
*Phase: 06-motion-interaction-layer*
*Completed: 2026-03-29*
