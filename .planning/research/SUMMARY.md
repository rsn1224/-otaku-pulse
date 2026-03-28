# Project Research Summary

**Project:** OtakuPulse v2.0 — Anime/Otaku-Rich Design Overhaul
**Domain:** Desktop UI/UX Design System Overhaul (Tauri v2 + React 19)
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

OtakuPulse v2.0 is a pure frontend design overhaul of an existing, fully functional Tauri v2 desktop news aggregator. The Rust 4-layer backend, all 68 Tauri commands, and all Zustand store interfaces remain completely untouched. The work transforms a Material Design 3 dark theme into an otaku-culture visual identity — deep void surfaces, neon-purple accent system, content-type color language, glassmorphism panels, and an integrated motion layer — without adding any new backend features. Research confirms the existing stack (React 19, Tailwind CSS 4, motion 12.x, Zustand 5) already covers approximately 80% of the design needs. The only new production packages required are six additions: `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, and two Fontsource variable font packages for self-hosted Japanese typography.

The recommended approach is a four-pass migration strategy: token values first (zero component breakage), legacy alias removal, component visual overhaul, then new decorative additions. This ordering is critical — architecture research confirms that attempting to overhaul components before establishing the new design token foundation produces unresolvable merge conflicts and silent visual regressions. The 3-tier token architecture (raw `@theme` palette, semantic `:root` aliases, per-component scoped tokens) preserves all existing semantic token names while replacing their underlying values, meaning no component file needs to change during Pass 1.

The dominant risks are not technical but disciplinary: functionality regression from structural DOM changes during visual reskins, contrast failures from neon colors used as body text, glassmorphism performance collapse from `backdrop-filter` overuse on Windows/WebView2, and "cheap anime" aesthetic from decoration overload. All four are preventable through upfront constraints — a test harness before any HTML is touched, token allowlists for text, blur budget limits, and a decoration budget per component. The competitive reference (AniList) succeeds not through maximum visual density but through 2-3 focused signature elements on a clean structural layout.

---

## Key Findings

### Recommended Stack

The existing stack requires no animation or state management additions. The six new packages serve purely as design system utilities: class composition (clsx + tailwind-merge), component variant management (class-variance-authority), iconography (lucide-react v1.7.0), and self-hosted CJK typography (Fontsource variable fonts). Tailwind CSS 4's `@theme` directive handles all design token work natively, eliminating any need for Style Dictionary or external token management tools. The `motion` 12.x library (already installed as the renamed Framer Motion fork) covers all interactive transitions and must not be duplicated with GSAP, anime.js, or react-spring.

**Core new additions:**
- `lucide-react ^1.7.0`: SVG icon library — tree-shakable per-icon imports, TypeScript-typed, zero runtime API calls (critical for offline desktop apps)
- `clsx ^2.1.1` + `tailwind-merge ^3.5.0`: Class composition — tailwind-merge v3 is mandatory for Tailwind 4 (v2 was Tailwind 3 only); enables safe `className` override props on all reusable components
- `class-variance-authority ^0.7.1`: Component variant system — declarative API for Button/Badge/Card variants; prevents ternary sprawl in component code
- `@fontsource-variable/noto-sans-jp` + `noto-serif-jp`: Self-hosted Japanese variable fonts — Tauri apps cannot fetch Google Fonts at runtime; variable fonts cover weights 100-900 in one file
- `motion 12.x` (already installed): All interactive animations — springs, keyframes, AnimatePresence, stagger, SVG path draw; no additions needed
- `tailwindcss 4.2.1` (already installed): Design token system via `@theme` — generates utility classes AND CSS variables from one source; no Style Dictionary needed

**What not to add:** `tsparticles` (1.54 MB + continuous canvas repaints collapse Tauri WebView2 frame rates), `gsap`/`anime.js`/`react-spring` (redundant with `motion`), `shadcn/ui` (conflicts with existing custom component system), `framer-motion` (same package as installed `motion` — do not install both).

### Expected Features

Research analyzed AniList, Crunchyroll, Taiga, and MAL as competitive references and surveyed 2026 anime/otaku design trends (Heisei retro, Y2K futurism, cybercore aesthetic).

**Must have (table stakes) — Phases 1 and 2:**
- Deep void dark surfaces (`#0a0a0f` base) — every serious anime app uses deeper darks; current `#0e0e13` is insufficient as a neon glow foundation
- Cover-art-forward card layout — poster-ratio (2:3) variant alongside current landscape thumbnail; competitor parity with AniList/Crunchyroll
- Content-type color language — four accent tokens (anime=purple, manga=pink, game=cyan, news=amber); makes content scannable without reading labels
- Genre/status badge redesign — colored semantic badges with glow dots for airing status (airing=green, upcoming=cyan, completed=muted, hiatus=amber)
- Neon glow accent system — `--glow-primary` CSS variables applied to active nav, focused inputs, CTA buttons (60-30-10 rule: max 10% of screen area)
- Navigation active state — "lit up" sidebar with accent glow and left border strip
- Hover depth feedback — `translateY(-2px)` + shadow lift on interactive cards; desktop-class interaction expectation
- Glassmorphism on overlay panels — `backdrop-filter: blur(12px)` on DeepDive panel and modals only; never on list items
- Smooth wing/tab transitions — `AnimatePresence` on wing switches; current snap-replace is below 2026 motion baseline

**Should have (competitive differentiators) — Phase 3:**
- Heisei/Y2K retro decorative motifs — CSS-only corner brackets and scan-line textures; no character IP required
- Feed stagger reveal animations — `motion.div` with 80ms stagger on DiscoverCard list (first 10 items only); curated feed feel
- AI badge chip — gradient pill badge on cards with cached summaries; visual AI value communication
- Section header decoration — left-border accent lines and uppercase spaced labels throughout

**Defer (post-v2.0):**
- Cinematic article reader (drop caps, column layout, section decorators) — high value, high complexity; needs Phases 1-3 stable first
- Schedule Wing calendar grid (day-column airing guide with countdown timers) — significant ScheduleWing.tsx restructure
- Command palette (Cmd+K launcher with category grouping) — genuine differentiator but standalone feature; does not block core design
- Personalized gradient header — needs design system stability before dynamic CSS variable injection
- Animated empty states — CSS/SVG mascot placeholders; nice-to-have after functional states

**Anti-features to explicitly avoid:** particle effects and animated backgrounds (GPU destruction on WebView2), light mode toggle (doubles design maintenance surface; dark-only is explicit v2.0 scope), custom cursor overlays (rendering issues on high-DPI Windows), per-wing custom themes (multiplies CSS token surface by N).

### Architecture Approach

The design system sits in four interlocking layers: Design Token Layer (`globals.css @theme` + `:root`), Motion/Animation Layer (`motion-variants.ts` + CSS `@keyframes`), Component Layer (`ui/` primitives, `wings/` layouts, `common/` shared), and Accessibility Layer (`useAnnouncer`, `useFocusTrap`, `useFocusReturn`, `useScrollLock`). The critical architectural decision is a 3-tier token system: Tier 1 raw palette in `@theme` (generates Tailwind utilities), Tier 2 semantic aliases in `:root` (preserves all existing token names — zero component breakage during Pass 1), and Tier 3 per-component scoped tokens (safe local overrides). CSS `@container` queries replace viewport media queries for Wing content areas, making layouts reusable regardless of app shell width.

**Major components:**
1. `globals.css @theme` + `src/styles/tokens/palette.css`: Design token source of truth — raw color scale, animation timing, surface values; all Tailwind utility generation flows from here
2. `motion-variants.ts` + `useMotionConfig()`: Centralized animation system — every animated component must consume variants through `useMotionConfig()` to guarantee reduced-motion compliance; never import variants directly
3. `ui/` primitive components (Button, Card, Badge, Input, Modal, Spinner, ToggleGroup): Base visual building blocks — updated with new variants (`neon`, `glass`, `anime`) using additive extension; existing variants unchanged to preserve backward compatibility
4. `layout/AppShell` + new `SidebarNav`: Shell and navigation — SidebarNav extracted from AppShell for the overhaul; nav state remains local props (not Zustand — ephemeral)
5. New decorative components (`GlowBorder`, `ScanlineOverlay`, `AnimeTag`): Additive-only Pass 4 additions; applied to feature components as opt-in decorations

**Build dependency order within the component phase:** Badge → Spinner → Button → Input → ToggleGroup → Card → Modal (primitives, fewest dependents first), then SidebarNav + TopBarSearch (layout), then Wings and feature components (DiscoverCard, AiringCard, DeepDivePanel) last.

**Token flow:** Stitch mockup → Figma (annotated with CSS variable names) → Figma MCP → `palette.css @theme` → `:root` semantic aliases → Tailwind utilities + CSS variables → component JSX.

### Critical Pitfalls

1. **Functionality regression during visual reskin** — Changing className strings can break DOM-dependent event delegation, Zustand selectors, focus traps, and ARIA attributes with no compile error and no test failure unless interaction tests exist beforehand. Prevention: lock all 157 existing tests green, add interaction tests for every interactive component before touching any HTML structure, separate CSS-only changes from structural DOM changes across different commits.

2. **Neon color contrast failure** — Saturated neon colors (`#ff97b2` pink, `#4dd9e0` cyan) visually pop but fail WCAG AA (4.5:1 minimum) when used as text. Prevention: treat `--on-surface` and `--on-surface-variant` as the exclusive body text tokens; run every new color token through a contrast checker against all four surface levels before adding to `globals.css`; document ratios in `design.md`.

3. **`backdrop-filter: blur()` GPU collapse on Windows/WebView2** — A single blur covering more than approximately 30% viewport causes Tauri's WebView2 to recomposite on every frame (confirmed Chromium bug #497522). Prevention: limit blur to elements covering less than 15% viewport simultaneously, maximum two blurred layers visible at once; use solid near-opaque `rgba(14,14,19,0.97)` for sidebars and main panels; test on mid-tier Windows hardware in `tauri dev`.

4. **Design token migration breaking existing components** — CSS custom property fallback degrades silently to `transparent` when a token is removed, not to a visible error. Prevention: remove legacy aliases one at a time with a full visual regression check between each; run `grep -r` for every alias name before removal; Biome does not catch missing CSS variable references.

5. **Stitch-generated code bypassing the design system** — Stitch outputs hardcoded HEX values and Tailwind palette classes (`bg-purple-600`) that bypass the CSS variable system entirely. Prevention: treat all Stitch output as wireframe reference only; every Stitch color must be translated through the `design.md` Stitch Token Mapping table; run a grep for raw hex and palette classes as a pre-commit check.

---

## Implications for Roadmap

Based on combined research, the migration has three natural phases matching the zero-breakage build order from ARCHITECTURE.md. The feature MVP structure from FEATURES.md maps directly onto these phases. Phase ordering is strictly dependency-driven: tokens before components, components before motion, all three before decorative additions.

### Phase 1: Design Token Foundation

**Rationale:** All visual layers — components, animations, decorative elements — depend on a stable token system. Attempting component work before establishing the new palette creates unresolvable conflicts and unresolvable visual regression. This phase has the highest pitfall density (token migration breakage, contrast failures, Tailwind v4 syntax issues, Stitch bypass patterns) and must be completed correctly before anything else can be verified visually.

**Delivers:** New 3-tier token architecture live in `globals.css` and `palette.css`; all 14 legacy aliases removed and confirmed zero references in codebase; new color palette visible app-wide with zero component code changes; contrast ratios for all new tokens documented in `design.md`; Stitch Token Mapping table complete; font loading strategy defined.

**Addresses features:** Deep void dark surfaces, content-type accent palette (four accent tokens defined), neon glow variable system (`--glow-primary`, `--glow-secondary`, `--glow-subtle`), animation timing tokens, typography hierarchy tokens.

**Avoids pitfalls:** Token migration breakage (one-at-a-time removal with grep verification), Tailwind v4 syntax regressions (CSS-variable utilities `bg-(--primary)` over palette utilities `bg-purple-600`), Stitch bypass (translation table before any code), contrast failures (pre-validate all new tokens at 4.5:1 minimum).

**Research flag:** Standard patterns. Tailwind 4 `@theme` is fully documented; 3-tier token migration strategy is established. Skip phase research.

---

### Phase 2: Component Visual Overhaul

**Rationale:** With tokens established and visually verified on all 5 Wings, component work proceeds in dependency order (primitives before layouts before feature components). Font loading strategy must be resolved before any component renders a custom typeface. Accessibility hooks must be wired during this phase — retrofitting focus traps and announcer calls after visual work is finished is expensive and error-prone. The "cheap anime" decoration budget (1 animated element + 1 gradient + 1 decorative icon per component) must be established before components are styled.

**Delivers:** All 7 UI primitives updated with new variants using additive extension; `AppShell` → `SidebarNav` extraction complete; Wings visual treatment (backgrounds, section headers, badge redesign, cover-art card variant, hover depth feedback, navigation active state); font loading with FOUT/FOIT prevention; glassmorphism applied to DeepDive panel and modals; every rebuilt component verified for `useFocusTrap`/`useFocusReturn`/`useAnnouncer` wiring.

**Uses:** `lucide-react` (icon replacements), `class-variance-authority` (variant system for Button/Card/Badge), `clsx` + `tailwind-merge` (`cn()` helper in `src/lib/utils.ts`), `@fontsource-variable/noto-sans-jp` (body text), `@fontsource-variable/noto-serif-jp` (display headings).

**Implements:** Build order Badge → Spinner → Button → Input → ToggleGroup → Card → Modal, then SidebarNav + TopBarSearch, then Wings and feature components.

**Avoids pitfalls:** Functionality regression (interaction tests required before Phase 2 begins; separate CSS changes from structural DOM changes), accessibility regression (audit checklist per component), font FOIT (Fontsource with `unicode-range` subsetting; `font-display: optional` for headings, `font-display: swap` + `size-adjust` for body), decoration overload (decoration budget enforced per component), glassmorphism performance collapse (blur limited to elements under 15% viewport; no blur on list items ever).

**Research flag:** Glassmorphism performance on specific Windows hardware configurations is MEDIUM confidence. Establish blur budget and test on mid-tier Windows machine before committing to any glassmorphism treatment. Noto Sans JP CJK font bundle size impact on Tauri binary needs validation — import Latin + JIS Level 1 subset only initially.

---

### Phase 3: Motion Integration and Polish

**Rationale:** Motion work happens last because it depends on the component structure being stable (wing transitions require AppShell/SidebarNav to be finalized from Phase 2) and because reduced-motion compliance must be verified against the complete component set. The animation budget and blur budget constraints are defined in Phase 1 and enforced throughout Phase 2; Phase 3 activates the motion layer within those constraints.

**Delivers:** Wing transition animations via `AnimatePresence` (200ms fade-slide); feed stagger reveals on DiscoverCard list (80ms stagger, first 10 items only, disabled for subsequent scroll); AI badge chip on cards with cached summaries (purple-blue gradient pill); Heisei decorative touches (CSS-only corner brackets on featured cards via `::before`/`::after`, scan-line texture on section headers); new CSS `@keyframes` in `animations.css` (neonPulse, scanlineScroll, cardPop); new motion variants in `motion-variants.ts`; full `useMotionConfig()` audit via grep — zero animated components without reduced-motion guard.

**Implements:** New decorative components (`GlowBorder`, `ScanlineOverlay`, `AnimeTag`) added as Pass 4 — additive only, integrated into feature components as opt-in; `AnimatePresence` integrated at Wing level in AppShell; stagger variants in `motion-variants.ts`.

**Avoids pitfalls:** Excessive animation causing vestibular symptoms (zero `motion/react` components without `useMotionConfig`; animation budget: one entrance animation at a time maximum; all ambient/idle animations off by default; WCAG 2.3.3 manual test at phase end), glassmorphism performance from combined blur + animation (GPU profiling in `tauri dev` on Windows before merge), stagger performance on large lists (limit to first 10 items; off-screen items skip animation).

**Research flag:** Combined performance of `backdrop-filter` + `AnimatePresence` + stagger animations on Windows WebView2 is the highest-risk integration point. Cannot be simulated in Chrome DevTools — requires hardware profiling on mid-tier Windows in `tauri dev`. If frame rate drops below 30fps with any modal open, fall back from blur to solid near-opaque backgrounds on the affected element.

---

### Phase Ordering Rationale

- **Tokens before components:** CSS variable cascade means wrong values propagate everywhere. Correcting tokens after components are built requires retesting every component again. Pass 1 is intentionally designed to be reversible with a two-file revert.
- **Accessibility hooks during Phase 2, not Phase 3:** WIP hooks (`useFocusTrap`, `useFocusReturn`, `useAnnouncer`) exist but are not yet universally applied. Wiring them during the visual rebuild is the natural moment — the component is already being touched. Retrofitting after Phase 3 means touching every component twice.
- **Motion last:** `AnimatePresence` wing transitions require `AppShell`/`SidebarNav` to be finalized; feed stagger requires `DiscoverCard` layout to be stable; reduced-motion audit must cover the complete component set. None of these preconditions exist before Phase 2 completes.
- **Decorative layer additive-only (Pass 4 within Phase 3):** `GlowBorder`, `ScanlineOverlay`, `AnimeTag` add otaku flair without altering existing component APIs. They can be reverted without breaking functionality, making them safe to add at the end.
- **Final palette values depend on Stitch session:** ARCHITECTURE.md provides structural placeholder palette values. The Phase 1 kickoff requires a Stitch mockup session and Figma MCP token extraction before any CSS values are committed.

### Research Flags

Phases needing attention during planning:

- **Phase 2 (Component Overhaul):** Glassmorphism performance on specific Windows hardware is MEDIUM confidence. Establish blur budget explicitly in the phase spec — not more than two blurred elements simultaneously, none on scrollable list items. Test on Windows before any component with blur is considered complete.
- **Phase 3 (Motion + Polish):** Combined `backdrop-filter` + `AnimatePresence` + stagger on WebView2 is the single highest-risk integration. Add a hardware profiling checkpoint in the phase definition — GPU usage in Windows Task Manager must be below 50% with any modal open over a scrolling list.
- **Phase 1 (Token Foundation):** Noto Sans JP full CJK variable font is approximately 500KB per weight range. Validate actual Tauri binary bundle size impact before committing to both Noto Sans JP and Noto Serif JP. If bundle size is unacceptable, Noto Serif JP (display headings only) is the candidate to drop.

Standard patterns (skip phase research):

- **Phase 1 — Tailwind 4 @theme token architecture:** Fully documented in official Tailwind 4 docs. 3-tier approach is established; tailwind-merge v3 / Tailwind 4 compatibility is explicitly confirmed in maintainer release notes. No research needed.
- **Phase 2 — lucide-react, CVA, clsx/tailwind-merge:** All three are well-documented utilities with clear npm-install-and-use setup. No research needed.
- **Phase 3 — motion/react AnimatePresence + useMotionConfig:** Existing WIP hooks are correctly structured; only need new variant additions in `motion-variants.ts`. Official motion.dev docs cover all patterns needed. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All six new packages confirmed from official docs and npm registry. tailwind-merge v3 / Tailwind 4 compatibility explicitly verified from maintainer release notes. Fontsource self-hosting for Tauri confirmed as standard approach. No speculation. |
| Features | MEDIUM-HIGH | Visual patterns from live competitor sites (AniList, Crunchyroll, Taiga): HIGH. Design trend research (Heisei retro, Y2K futurism as 2026 dominant aesthetic): MEDIUM — multiple sources agree but subject to taste. Anti-feature recommendations: HIGH based on technical constraints. |
| Architecture | HIGH | 3-tier token system and 4-pass migration strategy derived from direct codebase analysis plus Tailwind 4 official docs. Component dependency order verified from existing file structure. Stitch → Figma → Code pipeline from official Google/Figma documentation. CSS @container query approach from Tailwind 4 official docs. |
| Pitfalls | HIGH | backdrop-filter GPU issue confirmed from Chromium bug tracker #497522. WCAG contrast and motion requirements from W3C specs. Tailwind v4 breaking changes from official upgrade guide. Token migration silent CSS fallback is well-documented CSS behavior. Stitch bypass risk inferred from design-workflow.md rules and Stitch's documented behavior. |

**Overall confidence:** HIGH

### Gaps to Address

- **Final palette HEX values are provisional:** ARCHITECTURE.md provides structurally correct placeholder values anchored to existing tokens. Actual leaf values must come from a Stitch mockup session and confirmed via Figma MCP before Phase 1 `palette.css` is committed. The token architecture and semantic names are confirmed; only the raw color values need final sign-off.
- **Noto Sans JP actual Tauri bundle size:** CJK variable fonts are large. Fontsource with `unicode-range` subsetting reduces this, but exact Vite/Tauri build output size has not been measured. Plan: import Latin + JIS Level 1 subset only initially; measure binary delta; add Level 2 kanji only if article body text requires it.
- **WebView2 glassmorphism performance on target hardware:** Cannot be simulated in Chrome DevTools or on macOS. Must be validated in `tauri dev` on a mid-tier Windows machine (e.g., Intel UHD or AMD Radeon integrated graphics) before any component using blur is considered shippable.
- **CVA vs. tailwind-variants:** `class-variance-authority` 0.7.1 has had approximately one year without active development. `tailwind-variants` 0.3.x is the newer Tailwind 4-native alternative. Either is architecturally interchangeable. If CVA shows any Tailwind 4 incompatibility during Phase 2, switch to tailwind-variants without architectural impact.

---

## Sources

### Primary (HIGH confidence)
- Tailwind CSS 4 official docs — `@theme` directive, `@container` queries, v4 upgrade guide, gradient utility renames (`bg-linear-to-*` not `bg-gradient-to-*`)
- motion.dev official docs — AnimatePresence, SVG animation, spring physics, scroll-linked animations
- W3C WCAG 2.1 — contrast minimum (1.4.3, 4.5:1), animation from interactions (2.3.3)
- Chromium bug tracker issue #497522 — `backdrop-filter` continuous GPU recomposition
- Fontsource official docs — variable font npm packages, Vite integration, unicode-range subsetting
- lucide-react npm registry v1.7.0 + lucide.dev official docs
- tailwind-merge GitHub releases — v3.5.0 = Tailwind 4, v2.x = Tailwind 3 (maintainer confirmation)
- Direct codebase analysis: `src/styles/globals.css`, `src/lib/motion-variants.ts`, `src/hooks/useMotionConfig.ts`, `design.md`, `.claude/rules/design-system.md`, `src/components/layout/AppShell.tsx`

### Secondary (MEDIUM confidence)
- AniList.co live CSS inspection — competitor surface values (`#13161d`), card patterns, accent color usage, poster-ratio cards
- Crunchyroll and Taiga desktop app analysis — competitor navigation patterns, motion baseline expectations
- CyberCore CSS framework — neon glow variable pattern documentation
- "Aesthetics in the AI era: Visual Trends 2026" (aigoodies.beehiiv.com, Nov 2025) — Heisei retro, PC-98, Y2K futurism as 2026 dominant otaku aesthetic
- "Web Design Trends 2025: Insights from Japan" (netwise.jp, Jul 2025) — bento layouts, Y2K gradients, pixel fonts confirmed
- Glassmorphism performance implementation guide — backdrop-filter budget recommendations; "complementary not dominant" usage rule
- Tauri GitHub issue #4891 — hardware acceleration in WebView2 (community-reported)
- Google Stitch workflow documentation (nxcode.io Vibe Design guide) — Stitch → Figma export pipeline

### Tertiary (LOW confidence)
- "Anime to UI/UX Design lessons" (Medium) — design philosophy inspiration only; not a technical reference
- Heisei retro aesthetic documentation (aesthetics.fandom.com) — cultural context for design direction; taste-dependent

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
