---
phase: 05-ui-primitive-component-overhaul
plan: "03"
subsystem: ui
tags: [cover-art, poster-mode, badge, discover-card, lucide-react, cva, tailwind]

dependency_graph:
  requires:
    - phase: 05-01
      provides: Badge ai variant, cn utility, lucide-react installed
  provides:
    - CoverArtFallback component with content-type gradient + icon
    - DiscoverCard 2:3 poster thumbnail (compact left-side in collapsed, full-width in expanded)
    - Content-type left border accent on all cards (border-l-[3px])
    - AI badge chip in CardSummary using Badge variant=ai + Sparkles icon
  affects: [discover-feed, card-rendering, phase-05-remaining]

tech-stack:
  added: []
  patterns:
    - "deriveContentType() helper: maps article.category to ContentType union"
    - "renderThumbnail(isCompact) inner function: single source for compact vs expanded thumbnail"
    - "Split-element text in tests: use querySelector('.ai-summary-label').textContent instead of getByText"

key-files:
  created:
    - src/components/discover/CoverArtFallback.tsx
  modified:
    - src/components/discover/DiscoverCard.tsx
    - src/components/discover/CardHeader.tsx
    - src/components/discover/CardSummary.tsx
    - src/test/components/CardSummary.test.tsx

key-decisions:
  - "CardSummary test updated to use querySelector('.ai-summary-label').textContent — getByText cannot match text split across Badge span and sibling text node"
  - "ContentType derived from article.category (not a new field) — 'pc' maps to 'game' for icon/gradient purposes"
  - "deepdive branch kept inside expanded (non-collapsed) JSX block to preserve state machine structure"

patterns-established:
  - "Split-element label pattern: when Badge splits text, test with container.querySelector + textContent"
  - "renderThumbnail inner function: compact (w-14 aspect-[2/3]) vs expanded (w-full max-h-[200px] aspect-[2/3])"

requirements-completed: [COMP-02, COMP-05]

duration: 6min
completed: "2026-03-28"
---

# Phase 05 Plan 03: DiscoverCard Poster Mode + AI Badge Summary

**2:3 poster thumbnail in DiscoverCard (compact left-side in collapsed, full-width in expanded) with CoverArtFallback gradient fallback, content-type left border accent, and AI badge chip in CardSummary using Badge variant=ai**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-28T12:06:00Z
- **Completed:** 2026-03-28T12:12:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `CoverArtFallback` component: content-type gradient (bg-linear-to-br) + lucide icon (Tv/BookOpen/Gamepad2/Newspaper) for articles without cover art
- Updated `DiscoverCard` to show 2:3 poster thumbnail left-side (w-14, compact) in collapsed state and full-width (max-h-[200px]) in summary/deepdive state, with dynamic `border-l-[3px] border-l-(--accent-{contentType})` accent
- Replaced inline SVG AI label in `CardSummary` with `Badge variant="ai"` + Sparkles icon, converted to function declaration
- Converted `CardHeader` to function declaration

## Task Commits

1. **Task 1: CoverArtFallback + DiscoverCard poster mode** - `8763244` (feat)
2. **Task 2: AI badge chip in CardSummary** - `ac8ee8d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/discover/CoverArtFallback.tsx` - New component: content-type gradient fallback with lucide icons
- `src/components/discover/DiscoverCard.tsx` - Poster mode thumbnails, content-type border, cn() import, function declaration
- `src/components/discover/CardHeader.tsx` - Converted from React.FC to function declaration
- `src/components/discover/CardSummary.tsx` - Badge ai variant replaces inline SVG, function declaration
- `src/test/components/CardSummary.test.tsx` - Tests updated for split-element label text matching

## Decisions Made

- `getByText(/AI Summary/i)` breaks when "AI" is inside a Badge `<span>` and " Summary" is a sibling text node — updated tests to use `container.querySelector('.ai-summary-label').textContent` per plan guidance
- `contentType` derived from `article.category` field (already in `DiscoverArticleDto`); 'pc' maps to 'game'
- deepdive questions block placed inside the expanded (non-collapsed) branch to preserve state machine structure without duplication

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test matcher updated for split-element text**
- **Found during:** Task 2 (AI badge in CardSummary)
- **Issue:** `screen.getByText(/AI Summary/i)` cannot find text split across Badge `<span>` ("AI") and sibling text node (" Summary") — Testing Library matches single node text content
- **Fix:** Updated 2 test cases to use `container.querySelector('.ai-summary-label')?.textContent` which reads the full concatenated text of the container
- **Files modified:** src/test/components/CardSummary.test.tsx
- **Verification:** `npx vitest run src/test/components/CardSummary.test.tsx` — 5/5 pass
- **Committed in:** ac8ee8d

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test matcher caused by structural change)
**Impact on plan:** Plan explicitly anticipated this and listed test update as acceptable. No scope creep.

## Issues Encountered

- Biome `--apply` flag removed in v2 — used `--write` instead. Pre-existing 17 warnings (not introduced by this plan).
- `aria-label` on a `<div>` flagged as a11y error by IDE diagnostic — removed it; test compatibility handled via `querySelector` instead.

## Known Stubs

None — thumbnail URL and content type are wired from live `DiscoverArticleDto` data. No hardcoded empty values blocking the plan's goal.

## Next Phase Readiness

- CoverArtFallback ready for reuse in any component needing content-type visual fallback
- Badge ai variant wired end-to-end in production component
- All 102 TS tests green; Biome clean; tsc clean
- Plan 04 (CardActions + skeleton improvements) can proceed

---
*Phase: 05-ui-primitive-component-overhaul*
*Completed: 2026-03-28*
