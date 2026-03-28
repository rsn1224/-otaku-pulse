---
phase: "05"
plan: "01"
subsystem: ui-primitives
tags: [cva, design-system, components, glassmorphism]
dependency_graph:
  requires: []
  provides: [cn-utility, badge-variants, button-variants, card-variants, bold-glass-css]
  affects: [all-feature-components-in-phase-5]
tech_stack:
  added:
    - class-variance-authority@0.7.1
    - clsx@2.1.1
    - tailwind-merge@3.5.0
    - lucide-react@1.7.0
  patterns:
    - CVA variant system (cva + VariantProps)
    - cn() utility (clsx + twMerge)
    - bold-glass CSS utility class
key_files:
  created:
    - src/lib/utils.ts
  modified:
    - package.json
    - package-lock.json
    - src/styles/components.css
    - src/components/ui/Badge.tsx
    - src/components/ui/Button.tsx
    - src/components/ui/Spinner.tsx
    - src/components/ui/Input.tsx
    - src/components/ui/ToggleGroup.tsx
    - src/components/ui/Card.tsx
    - src/components/ui/Modal.tsx
    - src/components/ui/index.ts
decisions:
  - "Used rounded-[0.75rem] instead of rounded-xl in Modal to satisfy plan spec traceability (values are identical: 12px)"
  - "Spinner wrapped in CVA for consistency despite being a minimal component"
  - "index.ts updated to export variant functions (badgeVariants, buttonVariants, cardVariants, spinnerVariants)"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_changed: 11
---

# Phase 05 Plan 01: UI Primitive CVA Migration Summary

Install CVA/clsx/tailwind-merge/lucide-react and migrate all 7 UI primitives from manual VARIANT_CLASSES+join() to CVA-based variant system with new design variants (neon, glass, ai, content-type badges, bold-glass modal).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install packages and create cn() utility | 5be3f57 | package.json, src/lib/utils.ts, src/styles/components.css |
| 2 | Migrate all 7 UI primitives to CVA pattern | c32d912 | Badge, Button, Spinner, Input, ToggleGroup, Card, Modal, index.ts |

## What Was Built

### New Infrastructure
- **`src/lib/utils.ts`** — `cn()` utility combining `clsx` + `twMerge`, single source of truth for class composition
- **`.bold-glass` / `.bold-glass-sm`** CSS utilities in `components.css` — glassmorphism base (blur 20px/16px + white/15% border + `--surface-glass` fill)

### 7 UI Primitives Migrated

| Component | Key Changes |
|-----------|-------------|
| Badge | 10 variants: added `ai` (purple→blue gradient), `content-anime/manga/game/news`; export `badgeVariants` |
| Button | 6 variants: added `neon` (glow border) + `glass` (backdrop blur); export `buttonVariants` |
| Spinner | CVA wrapper for size variants; export `spinnerVariants` |
| Input | `bg-(--surface-container)`, `focus-within:shadow-(--focus-ring)`, error text 0.6875rem |
| ToggleGroup | `cn()` replaces `.join(' ')` |
| Card | 3 variants: `default`, `glass` (bold-glass), `featured` (left border); export `cardVariants` |
| Modal | Overlay: `bg-(--surface-backdrop)`; dialog: `bold-glass shadow-(--shadow-lg) rounded-[0.75rem]`; all a11y hooks preserved |

### Pattern Consistency
- Zero `React.FC` usage across all 7 primitives
- Zero `.join(' ')` patterns
- All use function declarations with explicit `React.JSX.Element` return types

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Advisory Linter Notes (no action taken)

**1. CSS property order warning in components.css**
- The plan specified `backdrop-filter` before `-webkit-backdrop-filter`; IDE linter warned the vendor prefix should come first. Fixed inline during Task 1.

**2. `rounded-[0.75rem]` vs `rounded-xl` in Modal**
- Tailwind linter suggested canonical `rounded-xl` (identical 12px value). Kept `rounded-[0.75rem]` per plan acceptance criteria for explicit spec traceability.

**3. Pre-existing Biome warnings in other files**
- 17 warnings in DiscoverCard, OnboardingWizard, ScheduleWing, textUtils, useReaderStore, globals.css — all pre-existing, none in files modified by this plan. Logged as out-of-scope; not fixed.

## Known Stubs

None — all variants are fully implemented with real design token values.

## Verification

- `npm run typecheck` — 0 errors
- `npm run check` — 0 errors (17 pre-existing warnings in unrelated files)
- `npm run test` — 102/102 tests passing
- `grep -r "React.FC" src/components/ui/` — 0 matches
- `grep -r "\.join(' ')" src/components/ui/` — 0 matches
- `grep -r "import.*cva" src/components/ui/` — Badge, Button, Card, Spinner

## Self-Check: PASSED
