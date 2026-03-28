# Roadmap: OtakuPulse

## Milestones

- [x] **v1.0 Stabilization & Optimization** — Phases 1-3, 10 plans (shipped 2026-03-28) | [Archive](milestones/v1.0-ROADMAP.md)
- [ ] **v2.0 Otaku-Rich Design Overhaul** — Phases 4-7 (active)

## Phases

<details>
<summary>v1.0 Stabilization & Optimization (Phases 1-3) — SHIPPED 2026-03-28</summary>

- [x] Phase 1: Foundation Correctness (3/3 plans) — Safety fixes, dedup correctness, dependency pinning
- [x] Phase 2: Resilience & Security (3/3 plans) — Graceful shutdown, offline mode, security hardening
- [x] Phase 3: Performance & Test Coverage (4/4 plans) — Parallel digest, query optimization, 120+ tests

</details>

### v2.0 Otaku-Rich Design Overhaul

- [ ] **Phase 4: Design Token Foundation** — 3-tier token architecture, new palette, legacy alias removal, CJK fonts
- [x] **Phase 5: UI Primitive & Component Overhaul** — All 7 UI primitives, feature components, glassmorphism, a11y wiring (completed 2026-03-28)
- [ ] **Phase 6: Motion & Interaction Layer** — AnimatePresence transitions, stagger reveals, micro-interactions, retro motifs
- [ ] **Phase 7: Accessibility, Performance & Polish** — A11y integration, virtual scroll, store split, blur budget validation

## Phase Details

### Phase 4: Design Token Foundation

**Goal**: The app's visual language is rebuilt from the ground up — every surface, glow, accent, and typeface is defined as a stable CSS variable before a single component is touched.

**Depends on**: Nothing (builds on v1.0 shipped codebase)

**Requirements**: DTKN-01, DTKN-02, DTKN-03, DTKN-04, DTKN-05, DTKN-06, DTKN-07

**Success Criteria** (what must be TRUE):
  1. The app renders with void-black (`#0a0a0f`) base surfaces and five visually distinct surface layers visible across all Wings — without changing any component JSX.
  2. Neon glow variables (`--glow-primary`, `--glow-secondary`, `--glow-subtle`) are defined and the app compiles with zero TypeScript or Biome errors.
  3. Content-type accent colors (anime=purple, manga=pink, game=cyan, news=amber) appear correctly on their respective content cards with no contrast failures below 4.5:1.
  4. Japanese text (CJK) in article titles and metadata renders in Noto Sans JP with no FOIT flash visible on cold launch.
  5. Running `grep -r` for all 16 legacy aliases returns zero matches in `src/` and `src-tauri/` source files.

**Plans**: 3 plans in 2 waves
  - Plan 01 (Wave 1): CJK font installation + typography hierarchy (DTKN-04, DTKN-05)
  - Plan 02 (Wave 1): Legacy alias batch replacement + deletion (DTKN-06)
  - Plan 03 (Wave 2): Stitch palette session + surface/glow/accent tokens + design.md rewrite (DTKN-01, DTKN-02, DTKN-03, DTKN-07)

**UI hint**: yes

---

### Phase 5: UI Primitive & Component Overhaul

**Goal**: Every user-facing UI element — from the smallest badge to the full DiscoverCard — is visually rebuilt in the new design language, with accessibility hooks wired in during the rebuild.

**Depends on**: Phase 4 (stable token system required before component work)

**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, PERF-03

**Success Criteria** (what must be TRUE):
  1. All 7 UI primitives (Badge, Button, Spinner, Input, ToggleGroup, Card, Modal) render with new neon/glass variants and the existing test suite remains fully green.
  2. The sidebar navigation shows a lit-up active state with neon glow and left-border accent on the current Wing; lucide-react icons replace the previous icon set.
  3. DiscoverCard renders in poster-ratio (2:3) cover-art mode; DeepDive panel and modals display glassmorphism blur that does not exceed the blur budget (max 2 blurred layers, each under 15% viewport).
  4. AI-processed cards show a purple-to-blue gradient AI badge chip; section headers show decorative left-border accents; empty states display anime-culture motifs.
  5. Every rebuilt modal and panel passes manual focus-trap verification: Tab key cycles within the overlay and Escape closes it without stranding keyboard focus.

**Plans**: 5 plans in 3 waves

Plans:
- [x] 05-01-PLAN.md — CVA package install + cn() utility + 7 UI primitives migration + bold-glass CSS (COMP-01)
- [x] 05-02-PLAN.md — Sidebar lucide-react icons + neon active state + SectionHeader + EmptyState (COMP-04, COMP-06, COMP-07)
- [x] 05-03-PLAN.md — DiscoverCard poster mode + CoverArtFallback + AI badge chip (COMP-02, COMP-05)
- [x] 05-04-PLAN.md — DeepDive/Toast glassmorphism + blur budget validation (COMP-03, PERF-03)
- [x] 05-05-PLAN.md — Automated verification + human visual checkpoint (all requirements)

**UI hint**: yes

---

### Phase 6: Motion & Interaction Layer

**Goal**: The app feels alive — Wing transitions, feed reveals, hover states, and micro-interactions follow a coherent motion language that degrades gracefully for users who prefer reduced motion.

**Depends on**: Phase 5 (component structure must be stable before animation is layered on top)

**Requirements**: MOTN-01, MOTN-02, MOTN-03, MOTN-04, MOTN-05, MOTN-06

**Success Criteria** (what must be TRUE):
  1. Switching between Wings plays a 200ms fade-slide AnimatePresence transition; there is no snap-replace or layout flash during the switch.
  2. The DiscoverCard list entrance animation staggers at ~150ms intervals for the first 10 visible items; items below the fold load without animation.
  3. Every interactive card and button responds to hover with a `translateY(-2px)` lift and shadow depth increase; bookmark and like actions trigger a visible micro-interaction keyframe.
  4. Decorative retro motifs (corner brackets, scan-line texture, dot grid) are visible on designated components and are implemented using CSS `::before`/`::after` only — no JavaScript.
  5. Enabling the OS "Reduce Motion" accessibility setting (or `prefers-reduced-motion: reduce`) removes all entrance and transition animations app-wide with no visible glitches or broken layouts.

**Plans**: 3 plans in 2 waves

Plans:
- [ ] 06-01-PLAN.md — Wing AnimatePresence transition + stagger interval + useMotionConfig rollout (MOTN-01, MOTN-02, MOTN-06)
- [ ] 06-02-PLAN.md — Retro CSS decorations + hover depth unification + micro-interaction keyframes (MOTN-03, MOTN-04, MOTN-05)
- [ ] 06-03-PLAN.md — Automated verification + human visual checkpoint (all requirements)

**UI hint**: yes

---

### Phase 7: Accessibility, Performance & Polish

**Goal**: The redesigned app is verifiably accessible, performs well on mid-tier Windows hardware, and the codebase is clean — legacy patterns removed, stores properly split, and all quality gates green.

**Depends on**: Phase 6 (full visual + motion layer must be complete before final verification pass)

**Requirements**: A11Y-01, A11Y-02, A11Y-03, PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
  1. Scrolling a list of 1,000+ articles in the Discover Wing maintains 60fps; only visible items are in the DOM (verifiable via browser DevTools element count).
  2. All neon accent colors pass WCAG AA 4.5:1 contrast ratio when used as text, confirmed by automated contrast check against all four surface levels.
  3. Heading levels (h1 → h2 → h3) are sequential with no skips across all Wings; every form input has an associated label (verifiable via axe DevTools or manual audit).
  4. `useArticleStore` is split into focused slices (feed / highlights / counts / scroll position) with no cross-slice state leakage — existing Zustand selectors continue to work.
  5. WIP accessibility hooks (announcer, focusTrap, focusReturn, scrollLock) are active in every modal, panel, and overlay; a screen reader announces modal open/close events.

**Plans**: TBD

**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation Correctness | v1.0 | 3/3 | Complete | 2026-03-28 |
| 2. Resilience & Security | v1.0 | 3/3 | Complete | 2026-03-28 |
| 3. Performance & Test Coverage | v1.0 | 4/4 | Complete | 2026-03-28 |
| 4. Design Token Foundation | v2.0 | 0/3 | Planned | - |
| 5. UI Primitive & Component Overhaul | v2.0 | 5/5 | Complete   | 2026-03-28 |
| 6. Motion & Interaction Layer | v2.0 | 0/3 | Planned | - |
| 7. Accessibility, Performance & Polish | v2.0 | 0/- | Not started | - |
