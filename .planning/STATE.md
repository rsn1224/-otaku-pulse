---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Otaku-Rich Design Overhaul
status: verifying
last_updated: "2026-03-28T12:20:57.386Z"
last_activity: 2026-03-28
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** アニメ・オタク文化を体現するリッチなビジュアルデザインで UI/UX を全面刷新する
**Current focus:** Phase 05 — ui-primitive-component-overhaul

## Current Position

Phase: 05 (ui-primitive-component-overhaul) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-03-28

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases defined | 4 (Phases 4-7) |
| Requirements mapped | 26/26 |
| Plans complete | 0 |
| Tests added this milestone | 0 |
| Phase 04 P01 | 2min | 2 tasks | 4 files |
| Phase 04 P02 | 3min | 2 tasks | 42 files |
| Phase 04 P03 | 4min | 3 tasks | 2 files |
| Phase 05 P01 | 4min | 2 tasks | 11 files |
| Phase 05 P02 | 4min | 2 tasks | 4 files |
| Phase 05 P03 | 6min | 2 tasks | 5 files |
| Phase 05 P04 | 8min | 2 tasks | 2 files |
| Phase 05 P05 | 8min | 1 tasks | 1 files |

## Accumulated Context

### From v1.0 (carried forward)

- 68 Tauri commands fully aligned with frontend — backend untouched in v2.0
- 157 tests passing (81 Rust + 76 JS) — must stay green throughout v2.0
- WIP accessibility hooks (announcer, focusTrap, focusReturn, scrollLock) production-ready but not integrated — wired in Phase 5
- WIP motion system (motion-variants.ts, useMotionConfig) complete but not deployed to all components — activated in Phase 6
- @tanstack/react-virtual in dependencies but unused — implemented in Phase 7 (PERF-01)
- useArticleStore needs splitting (feeds/highlights/counts/scroll mixed) — split in Phase 7 (PERF-02)
- Design system: Material Design 3 dark theme with purple accent — fully replaced in Phase 4

### v2.0 Design Constraints

- Blur budget: max 2 blurred elements simultaneously, each under 15% viewport — never on scrollable list items
- Decoration budget: 1 animated element + 1 gradient + 1 decorative icon per component maximum
- Animation budget: 1 entrance animation at a time; all ambient/idle animations off by default
- Stagger limit: first 10 items only; items below fold skip animation
- No light mode — dark-only for v2.0 scope
- All Stitch-generated HEX values must be translated through design.md Stitch Token Mapping before committing

### New Packages (Phase 4-5)

- `lucide-react ^1.7.0` — icon library (Phase 5)
- `clsx ^2.1.1` + `tailwind-merge ^3.5.0` — class composition (Phase 5)
- `class-variance-authority ^0.7.1` — component variant system (Phase 5)
- `@fontsource-variable/noto-sans-jp` — CJK body font (Phase 4)
- `@fontsource-variable/noto-serif-jp` — CJK display font (Phase 4, bundle size TBD)

### Known Risks

- Glassmorphism GPU collapse on Windows/WebView2: must validate on mid-tier hardware before Phase 5 complete
- Noto Sans JP bundle size: validate Tauri binary delta before committing both JP font packages
- CVA vs tailwind-variants: if CVA shows Tailwind 4 incompatibility in Phase 5, switch to tailwind-variants without architecture impact
- Stitch palette values are provisional: final HEX values come from Stitch mockup session + Figma MCP before Phase 4 palette.css is committed

## Key Decisions (Phase 05)

- Toast semantic differentiation via border-l-2 accent token (not background color): bold-glass provides neutral glass base
- DeepDivePanel drops deepdive-panel CSS class — glassmorphism expressed directly in Tailwind utilities via bold-glass-sm
- Last session: Checkpoint at 05-05-PLAN.md Task 2 — human visual verification pending (2026-03-28)
- 17 pre-existing Biome warnings (style/unsafe, unrelated to Phase 5 scope)
- 102 tests passing (grew from prior phases)

## Session Continuity

To resume: run `/gsd:plan-phase 4`

Phase 4 kickoff requires a Stitch mockup session to finalize palette HEX values before any CSS is committed.
All 157 existing tests must pass before Phase 5 begins.
