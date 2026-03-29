---
phase: 06-motion-interaction-layer
plan: 01
subsystem: frontend-motion
tags: [motion, animation, accessibility, react, framer-motion]
dependency_graph:
  requires: []
  provides: [wing-transitions, stagger-reveal, reduced-motion-guard]
  affects: [AppShell, ArticleList, Toast, Modal, ArticleReader]
tech_stack:
  added: []
  patterns: [AnimatePresence-mode-wait, useMotionConfig-reduced-motion, index-guard-stagger]
key_files:
  created: []
  modified:
    - src/lib/motion-variants.ts
    - src/components/layout/AppShell.tsx
    - src/components/wings/ArticleList.tsx
    - src/components/common/Toast.tsx
    - src/components/ui/Modal.tsx
    - src/components/common/ArticleReader.tsx
decisions:
  - "Dedicated wingTransition variant avoids affecting Toast/Modal which use fadeSlideIn"
  - "Index guard i<10 limits stagger animation to above-fold cards, preserving performance budget"
  - "useMotionConfig centralization means all motion respects prefers-reduced-motion without per-component media queries"
metrics:
  duration: pre-committed
  completed: "2026-03-29"
  tasks: 2
  files: 6
requirements:
  - MOTN-01
  - MOTN-02
  - MOTN-06
---

# Phase 06 Plan 01: Wing Transitions + useMotionConfig Rollout Summary

**One-liner:** AnimatePresence mode="wait" wing transitions with 150ms stagger reveal and prefers-reduced-motion guard deployed to all 5 motion-using components via useMotionConfig.

## What Was Built

Activated the existing WIP motion infrastructure (motion-variants.ts, useMotionConfig) by wiring it into all components that use motion.div. Two tasks completed:

### Task 1: wingTransition Variant + Stagger Interval Update

Added a dedicated `wingTransition` variant to `src/lib/motion-variants.ts` separate from `fadeSlideIn`, preventing Wing transition changes from affecting Toast/Modal animations. Updated stagger interval from 40ms to 150ms to match the v2.0 animation budget spec. Both `full` and `reduced` preset maps updated with the new variant.

**Changes to `src/lib/motion-variants.ts`:**
- Added `export const wingTransition` (y:8 entrance, y:-4 exit, 0.15s exit duration)
- Updated `staggerContainer.staggerChildren` from `0.04` to `0.15`
- Added `wingTransition: fade` to `reduced` map
- Added `wingTransition` to `full` map

### Task 2: AnimatePresence in AppShell + Stagger Guard in ArticleList + useMotionConfig Rollout

**AppShell.tsx (MOTN-01):**
- Imported `AnimatePresence` from motion/react
- Imported `useMotionConfig` and destructured `{ variants, spring }`
- Removed direct `springTransition` import from motion-variants
- Wrapped `renderWing()` in `<AnimatePresence mode="wait"><motion.div key={activeWing} variants={variants.wingTransition} ...>`
- Updated nav indicator `motion.span` transition to use `spring` from useMotionConfig

**ArticleList.tsx (MOTN-02 + MOTN-06):**
- Replaced direct staggerContainer/staggerItem imports with `useMotionConfig`
- Added `index < 10` guard: items at i>=10 render with `variants={undefined}` and `initial={false}` for instant render

**Toast.tsx, Modal.tsx, ArticleReader.tsx (MOTN-06):**
- Replaced direct variant imports with `useMotionConfig` in all 3 components
- Each component calls `const { variants } = useMotionConfig()` and uses `variants.*` notation

## Verification Results

All plan verification criteria passed:

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 errors |
| `npm run check` (Biome) | 17 pre-existing warnings only (unrelated to this plan) |
| No direct variant imports in components | PASS - grep returned 0 lines |
| `useMotionConfig` in all 5 components | PASS - confirmed in AppShell, ArticleList, Toast, Modal, ArticleReader |
| `AnimatePresence mode="wait"` in AppShell | PASS |
| `key={activeWing}` in wing motion.div | PASS |
| `staggerChildren: 0.15` in motion-variants | PASS |
| `wingTransition` in full and reduced maps | PASS |
| `i < 10 ? variants.staggerItem : undefined` in ArticleList | PASS |

## Deviations from Plan

None - plan executed exactly as written. The implementation commit `d0547d2` contains all 6 files with changes matching the plan's acceptance criteria precisely.

## Known Stubs

None - all motion wiring is fully implemented. No placeholder or stub patterns detected.

## Self-Check: PASSED

- Implementation commit `d0547d2` verified present in git log
- All 6 modified files verified with correct content
- TypeScript compiles clean (0 errors)
- Biome check passes (17 pre-existing warnings, none introduced by this plan)
- All acceptance criteria verified via grep and file inspection
