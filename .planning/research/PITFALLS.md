# Pitfalls Research

**Domain:** Anime-Themed UI/UX Overhaul — Tauri v2 Desktop App (OtakuPulse v2.0)
**Researched:** 2026-03-28
**Confidence:** HIGH (Tailwind v4, accessibility, motion), MEDIUM (anime-specific aesthetics, Tauri/WebView2 GPU), LOW (Stitch-specific workflow pitfalls)

---

## Critical Pitfalls

### Pitfall 1: Functionality Regression During Visual Reskin

**What goes wrong:**
68 Tauri commands continue to compile and pass tests, but interactive states break silently. Forms stop submitting, keyboard shortcuts detach from their handlers, modal focus traps disappear, toast notifications render off-screen, virtual scrolling loses its anchors. Everything "looks right" but nothing works.

**Why it happens:**
Developers change className strings and CSS custom properties during a component overhaul and inadvertently remove or rename HTML structure that JavaScript event delegation, Zustand selectors, or aria attributes depend on. A className swap on a container div can break a `closest('[data-tab]')` lookup. Removing a wrapper element can break a focus trap that relied on a specific DOM depth.

**How to avoid:**
- Lock all 157 existing tests green before touching any component
- Add interaction tests (click, keyboard, form submit) for every interactive component before beginning visual changes — these become the regression harness
- Separate the visual phase from the structural phase: first change only CSS custom properties and Tailwind classes; only restructure DOM when absolutely necessary, and when you do, update tests first
- Use the `data-testid` pattern rather than structural selectors in tests so DOM restructuring does not break tests silently

**Warning signs:**
- `npm run typecheck` passes but a component stops responding to keyboard events
- Zustand store actions fire but UI does not update (selector broke because wrapper element disappeared)
- Toast notifications fire (state updates) but do not render (portal target element renamed or removed)

**Phase to address:**
Phase 1 (Design Token Migration) — establish test-first discipline before any HTML is touched.

---

### Pitfall 2: Neon/Glow Contrast Failure on Text

**What goes wrong:**
`--primary: #bd9dff` (lavender) on `--surface: #0e0e13` passes WCAG AA at 7.2:1 — but the new palette introduces saturated neon cyan, hot pink `#ff97b2`, or bright amber for accent states, used as text color on dark backgrounds. These fail WCAG AA (4.5:1 minimum for normal text) despite looking vibrant. At 14px, `#ff6e84` on `#19191f` can drop to 3.8:1.

**Why it happens:**
Neon colors are defined for their visual impact (high chroma, high perceptual brightness), but WCAG contrast is calculated from relative luminance, which does not map linearly to perceived vibrancy. A color that "pops" on a dark background can still fail the luminance ratio. Designers verify by eye; developers trust the design; nobody measures.

**How to avoid:**
- Run every new color token through a contrast checker (WebAIM, Radix Colour) against all four surface levels before adding it to `globals.css`
- Neon colors are safe as decorative glows, borders, or icon fills — never as the only carrier of text information
- Maintain the existing `--on-surface: #f9f5fd` and `--on-surface-variant: #acaab1` as the exclusive body text tokens; use neon only for non-text accents
- Codify a "text token allowlist": only tokens on the list may be used for readable text

**Warning signs:**
- Any design that uses `--tertiary`, `--error`, `--secondary`, or a new neon token as the color of a sentence or label
- Stitch-generated code that assigns a vivid background color to a text element

**Phase to address:**
Phase 1 (Design Token Migration) — validate all new tokens before they ship.

---

### Pitfall 3: `backdrop-filter: blur()` Performance Collapse on Windows/WebView2

**What goes wrong:**
Glassmorphism panels that look silky in Chrome crash frame rate in the Tauri WebView2 renderer on Windows. A single `backdrop-filter: blur(12px)` covering more than ~30% of the viewport causes WebView2 to recomposite on every frame, pushing GPU usage above 80%. Multiple stacked blur layers (sidebar + modal + tooltip) can freeze the app. There is a documented Chromium issue where `backdrop-filter` triggers continuous pixel recalculation as content scrolls beneath the blurred layer.

**Why it happens:**
Tauri uses the system WebView2 (Chromium-based) on Windows, which shares the same GPU acceleration path as Edge but does not always benefit from the same driver optimisations as a standalone browser. Unlike Electron, Tauri cannot bundle a specific Chromium build, so the exact version and GPU code path varies by user machine. Blur effects require the browser to sample every pixel beneath the element on every repaint — expensive even in standalone Chrome, worse in an embedded WebView.

**How to avoid:**
- Limit `backdrop-filter` to elements that cover less than 15% of the viewport simultaneously (small pills, tooltips, narrow sidebars)
- Never stack more than two blurred layers visible at the same time
- For the sidebar and main panels, use solid `--surface-backdrop` (`rgba(14,14,19,0.97)`) instead of blur; the near-opaque value achieves the dark glass aesthetic without the GPU cost
- Test on a mid-tier Windows machine (not just a developer MacBook) before merging any component that uses blur
- Add `will-change: transform` only when the element is actively animating, remove it afterwards

**Warning signs:**
- Frame rate drops below 30fps when a modal is open on top of a scrolling card list
- GPU usage spike visible in Windows Task Manager when the sidebar is visible
- Jank on animated stagger lists when any blur layer is on screen

**Phase to address:**
Phase 3 (Motion and Interaction) — establish blur budget constraints before animation work begins.

---

### Pitfall 4: Excessive Animation Triggering Vestibular Disorder Symptoms

**What goes wrong:**
A redesign that introduces parallax backgrounds, card entrance stagger animations on every scroll position, rotation effects on hover, and continuous idle animations (floating particles, pulsing glows) collectively exceeds the threshold for vestibular disorder users. The existing `useMotionConfig` hook is correctly wired to `prefers-reduced-motion`, but Spring physics animations in `motion/react` bypass the CSS `@media (prefers-reduced-motion)` media query — they must be disabled explicitly in JavaScript.

**Why it happens:**
Anime aesthetic heavily uses motion as atmosphere (sakura falling, scan lines scrolling, blinking cursors). Developers add each effect individually; each seems minor in isolation. The cumulative effect is an app that constantly moves, which is disorienting for approximately 35% of adults who have some vestibular sensitivity.

**How to avoid:**
- The existing `useMotionConfig()` pattern is correct — extend it, do not bypass it. Every new animated component must use `const { variants, spring } = useMotionConfig()` rather than hard-coding Spring parameters
- Establish an animation budget per screen: at most one entrance animation playing at a time (no simultaneous stagger + slide-in + glow pulse)
- Idle/ambient animations (particles, scan lines, breathing effects) must be off by default and only trigger on opt-in, never on reduced-motion
- WCAG 2.3.3 (Animation from Interactions) Level AAA: any animation triggered by user interaction must be disable-able. Apply this as a hard rule, not aspirational
- Parallax is prohibited in desktop navigation; reserve it for decorative splash screens only

**Warning signs:**
- A component uses `<motion.div animate={{ rotate: [0, 5, -5, 0] }}` without checking `useMotionConfig`
- Any particle or ambient animation defined in CSS `@keyframes` without a `prefers-reduced-motion: reduce` counterpart
- More than two entrance animations playing simultaneously on first render

**Phase to address:**
Phase 3 (Motion and Interaction) — gate the entire phase on reduced-motion compliance being verified first.

---

### Pitfall 5: Japanese Font Loading Causing FOUT and Layout Shift

**What goes wrong:**
Noto Sans JP (used for Japanese UI text) ships as a 6–8 MB font family when fully loaded. On app startup, if the font is loaded via `@font-face` without `font-display: swap`, all Japanese text renders invisibly (FOIT) until the font loads — typically 200–600ms cold start on Windows from a local file. If swap is used without careful metric fallback, the layout shifts when the font swaps in, breaking the card grid layout and causing jarring reflow.

**Why it happens:**
CJK fonts have massive glyph counts (Noto Sans JP has 65,535 glyphs covering 44,806 characters). The full font file is unavoidably large. Developers reference the full font from Google Fonts or a local copy without subsetting. In a Tauri app, the font is served from the asset bundle, so it is local disk — but it still requires a font decode step that can block text rendering.

**How to avoid:**
- Use the `@fontsource/noto-sans-jp` package with `unicode-range` subsetting to load only the kanji ranges actually used — limit to JIS Level 1 (2,965 characters) for UI text, deferring Level 2+ kanji for article body text
- Set `font-display: optional` for the decorative/heading font (no FOUT), `font-display: swap` for body text only
- Bundle the font in the Tauri asset directory, not fetched from a CDN (avoid network dependency)
- Define a `font-family` fallback stack that closely matches Noto Sans JP metrics: `"Noto Sans JP", "Yu Gothic UI", "Meiryo", system-ui, sans-serif` — the close metric match reduces layout shift
- Test cold-start font rendering on first app launch specifically

**Warning signs:**
- Invisible text on app startup (blank card titles for 200–400ms)
- Card layout shifts when the heading font swaps in (changes from bold fallback to the custom display font)
- App bundle size grows by more than 3 MB due to font assets

**Phase to address:**
Phase 2 (Component Overhaul) — establish font loading strategy before any component uses a custom typeface.

---

### Pitfall 6: Design Token Migration Breaking Existing Components

**What goes wrong:**
The current system has 56 CSS custom properties plus 14 legacy aliases scheduled for removal in Phase 3. During migration, components that still reference legacy aliases (`--bg-card`, `--text-primary`, `--border`) break visually as soon as the legacy section is removed. The breakage is often invisible during development (the variable falls back to `transparent` or `inherit`, not an error) and only noticed in manual testing.

**Why it happens:**
CSS custom property fallback silently degrades — `color: var(--text-primary)` renders as `transparent` rather than throwing an error when `--text-primary` is removed. A grep for the old token name will catch most cases but misses cases where the token is composed dynamically or referenced in third-party component classes. The migration scope is larger than it appears.

**How to avoid:**
- Before removing any legacy alias from `globals.css`, run a codebase-wide grep for every alias name and ensure zero matches in `*.tsx`, `*.ts`, `*.css` files
- Remove legacy aliases one at a time with a full visual regression check between each removal, not in a batch
- Add a CSS lint rule (Stylelint `no-unknown-custom-properties` or a Biome custom rule) to detect any reference to removed tokens
- Keep the legacy aliases in a separate `legacy-tokens.css` import that can be toggled during migration, making it easy to isolate which components still depend on them

**Warning signs:**
- Components rendered transparently (invisible text, invisible borders)
- Stitch-generated code that uses `--accent` instead of `--primary`, or `--bg-card` instead of `--surface-container`
- `npx biome check` passes (biome does not validate CSS variable existence by default)

**Phase to address:**
Phase 1 (Design Token Migration) — the entire point of this phase is controlled token migration.

---

### Pitfall 7: Stitch-Generated Code Bypassing the Design System

**What goes wrong:**
Stitch outputs production-ready HTML with Tailwind classes and inline color values. When copy-pasted into the codebase, it introduces hardcoded HEX values (`#7c3aed`, `#1e293b`), Tailwind palette classes (`bg-purple-600`, `text-slate-200`), and inline `style` attributes — all three of which are explicitly prohibited by the design system. These bypass the CSS variable system entirely, making future token updates ineffective and creating dark theme inconsistencies.

**Why it happens:**
Stitch generates self-contained code that works standalone. It has no awareness of the project's `globals.css` token system. Developers use Stitch for rapid ideation, which is correct, but then paste its output directly without translation.

**How to avoid:**
- Treat all Stitch output as a wireframe/reference, never as production code
- The mandatory translation step is defined in `~/.claude/rules/design-workflow.md`: every Stitch color token must be mapped to a CSS variable via the `design.md` Stitch Token Mapping table before writing to a file
- When Stitch generates `bg-purple-600`, the mapping is `--primary`; when it generates `text-gray-300`, the mapping is `--on-surface-variant`
- Extend `design.md` with a comprehensive Stitch-to-token mapping table before Phase 2 begins
- Run `grep -r 'bg-purple\|bg-slate\|text-gray\|text-slate\|style={{' src/` as a pre-commit check

**Warning signs:**
- Any Tailwind default color class (anything with a numeric suffix like `-500`, `-600`) in a new component
- Any `style={{ ... }}` attribute in a new component
- Hardcoded HEX values in any `.tsx` or `.css` file outside `globals.css`

**Phase to address:**
Phase 1 (Design Token Migration) and Phase 2 (Component Overhaul) — enforce at every phase.

---

### Pitfall 8: "Cheap Anime" Aesthetic from Decoration Overload

**What goes wrong:**
The design feels amateurish despite high visual effort. Symptoms: every card has a rainbow gradient border, every heading uses a stroke outline font, every section has cherry blossom particles, every button pulses on hover, every status indicator has a blinking glow. The individual elements each look fine in isolation; together they create visual noise that overwhelms content. The app stops feeling like a polished news aggregator and starts feeling like a fan wiki from 2009.

**Why it happens:**
Otaku culture is genuinely associated with high visual density (manga layouts, anime OP sequences, game menus). Developers apply cultural references without editorial restraint. There is no design authority saying "stop; this element has enough decoration." Polished anime-themed products (AniList, MyAnimeList, Crunchyroll) succeed by applying anime identity through 2–3 focused signature elements (a custom typeface, a specific color palette, carefully chosen iconography) and keeping the structural layout clean.

**How to avoid:**
- Establish a decoration budget per component: maximum one animated element, one glow/gradient, and one decorative icon
- Reserve the "signature effect" (neon border glow, sakura particle, scan line overlay) for one primary focal point per screen — not applied globally
- The AniList reference model: dark background, clean typography, restrained purple accent, anime cover images carry the visual weight — not the chrome
- All ambient/idle animations must be optional and off by default
- Review each design phase output with the question: "If I remove all decorative effects, does the layout still communicate clearly?" If not, the information hierarchy is broken

**Warning signs:**
- More than two glowing or animated elements visible simultaneously in the default, non-hovered state
- Users cannot locate the primary action on a screen because decorative elements have equal visual weight
- Gradient applied to more than one surface layer simultaneously (gradient card background + gradient title text + gradient border = three competing gradients)

**Phase to address:**
Phase 2 (Component Overhaul) — establish decoration constraints in the design spec before any component is styled.

---

### Pitfall 9: Accessibility Regression During Navigation and Shell Overhaul

**What goes wrong:**
The existing app has a working `useFocusTrap`, `useFocusReturn`, `useAnnouncer`, and skip-link infrastructure (confirmed in the WIP hooks). A redesign that replaces the AppShell, modal system, or Wing navigation can silently break: focus trap escapes (`Escape` closes but focus goes to `document.body` instead of the trigger), focus is not restored after modal close, screen reader announcements stop firing because the `useAnnouncerStore` is not wired to the new component, and the tab order becomes illogical with the new layout.

**Why it happens:**
Accessibility infrastructure is invisible — it has no visual representation. During a visual overhaul, developers naturally focus on what they can see. The WIP hooks exist but are not yet widely adopted; a redesign might rebuild components from scratch without connecting to these hooks.

**How to avoid:**
- Before the overhaul: audit every interactive component and document which accessibility hook it uses — this creates an explicit checklist
- Use the existing WIP hooks as the mandatory baseline: no new component is complete without `useFocusTrap` (modals/drawers), `useFocusReturn` (modal close), and `useAnnouncer` calls for dynamic content
- Test keyboard-only navigation for every Wing after every phase, not just at the end
- Test with a screen reader (NVDA on Windows, which is free) at Phase 3 completion

**Warning signs:**
- After closing a modal, focus goes to `document.body` instead of the element that opened it
- Tab order skips the sidebar Wing selector
- Screen reader does not announce the article count after a filter change
- `Escape` key closes a modal but also triggers the parent component's keyboard shortcut

**Phase to address:**
Phase 2 (Component Overhaul) — link accessibility hooks to every component being rebuilt.

---

### Pitfall 10: Tailwind v4 Class Syntax Used as v3 — Silent Visual Breaks

**What goes wrong:**
The project is already on Tailwind v4 (`tailwindcss: ^4.2.1`), but documentation, tutorials, and AI completions often reference v3 class names. Using v3 names in new code produces no error — Tailwind simply ignores unknown classes, so the visual style disappears silently. The most impactful defaults that changed: ring width 3px became 1px, ring color from blue-500 to currentColor, border color from gray-200 to currentColor. Gradient utilities renamed from `bg-gradient-to-*` to `bg-linear-to-*`.

**Why it happens:**
LLM assistants and most tutorials still use v3 syntax. Stitch generates code that may target v3. A developer copying from Stack Overflow or GitHub Copilot gets v3 class names. Tailwind silently ignores unknown utilities rather than throwing an error.

**How to avoid:**
- Always use the official Tailwind v4 docs as reference — never v3 tutorials
- Prefer CSS custom property utilities (`bg-(--primary)`) over Tailwind palette utilities (`bg-purple-600`) — these are immune to version renames because they reference the design system directly
- When writing gradient utilities, verify against the v4 changelog: `bg-linear-to-r` not `bg-gradient-to-r`
- The `bg-(--token)` parentheses syntax is v4-native; the `bg-[var(--token)]` brackets syntax is v3 legacy — use parentheses exclusively

**Warning signs:**
- Focus rings appear as 1px instead of the intended 2px
- Gradient utilities produce no output
- Border colors appear as the text color instead of the intended outline color

**Phase to address:**
Phase 1 (Design Token Migration) — establish v4-native class conventions before any component work.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode HEX in one component "for now" | Faster iteration on that component | Breaks when tokens change; invisible in design-system audits | Never |
| Keep all legacy aliases indefinitely | Zero migration work | Token namespace grows; design system becomes unmaintainable | Never — schedule removal per phase |
| `backdrop-filter: blur()` on the whole app sidebar | Beautiful frosted glass look | GPU performance collapse on Windows mid-tier hardware | Only if limited to narrow sidebar + profiled |
| Animate everything on first render | Dramatic entrance feels polished | Cumulative stagger delay means content hidden for 600ms+; motion sick users suffer | Never — entrance animations should be off after first load |
| Copy Stitch output verbatim | Rapid prototyping | Design system bypass; hardcoded values proliferate | Only in throwaway prototypes, never in `src/` |
| Add new CSS class to components.css instead of using token | One-off fix feels clean | Grows the CSS bundle; creates shadow design system | Never for color/spacing; sometimes acceptable for one-off layout utilities |
| Skip reduced-motion check for "subtle" animations | Saves one hook call | Vestibular users harmed; WCAG 2.3.3 violation | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stitch output | Pasting generated HTML directly into components | Treat as wireframe only; map all colors to CSS variables via `design.md` Stitch Token Mapping table |
| Figma MCP | Trusting auto-generated CSS color properties | Verify every color maps to a design system token; override Figma output where it uses raw values |
| `motion/react` + reduced motion | Using CSS `@media (prefers-reduced-motion)` to disable Spring animations | Spring physics bypass CSS media queries — must use `useMotionConfig()` hook explicitly |
| Tailwind v4 + CSS variables | Writing `bg-[var(--primary)]` (v3 bracket syntax) | Use `bg-(--primary)` (v4 parentheses syntax) |
| Google Fonts / external CDN + Tauri | Fetching fonts from network URLs | Bundle fonts in `src-tauri/` assets or reference from Vite assets; CSP blocks external font fetches |
| Legacy alias removal + Biome | Assuming Biome catches broken CSS variable references | Biome does not validate CSS custom property existence — use manual grep or Stylelint |
| Windows WebView2 + `backdrop-filter` | Assuming Chrome DevTools performance reflects Tauri performance | Test animations in `tauri dev` on Windows; Chrome standalone does not reproduce WebView2 GPU issues |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Stagger animation on 30+ card list | 600ms delay before all cards visible; janky scroll | Limit stagger to first 10 items; disable for off-screen items | List > 10 items with `staggerChildren: 0.04` |
| `backdrop-filter: blur()` on scroll container | 15fps while scrolling; GPU spike | Use solid near-opaque backgrounds for scrollable containers | Any element scrolling under a blurred overlay |
| `box-shadow` with spread on every card in default state | Composite layer explosion | Apply shadow on hover state only, not default state | More than 30 cards simultaneously rendered |
| Multiple `AnimatePresence` nested in same tree | Layout thrash during exit animations | Wrap only top-level transitions; do not nest AnimatePresence | More than 2 simultaneous exit animations |
| Font loading without `size-adjust` fallback | CLS layout shift when font swaps | Add `size-adjust` to fallback `@font-face`; use `font-display: optional` for headings | Cold-start app launch with uncached font |
| Particle / ambient animation CSS loop | Continuous GPU/CPU wakeup | Replace with `IntersectionObserver`-paused animations; `will-change: none` when off-screen | Any always-on ambient animation in default state |
| `filter: drop-shadow()` on SVG icons | Far more expensive than `box-shadow` | Use `box-shadow` on the icon container instead | More than 5 drop-shadow SVGs simultaneously visible |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loading external font CDN (Google Fonts) from Tauri | Violates existing CSP; font requests blocked or CSP must be loosened | Bundle fonts in assets; never fetch from external CDN in desktop app |
| Inline `style` with user-controlled string | XSS via style injection if article metadata is unsanitized | Never interpolate user strings into `style` attributes; use CSS variable assignments only |
| Dynamic `className` from untrusted API data | Class names constructed from response data could expose layout side-channels | Never construct class names from API responses; use a safe mapping function |
| Inlining designer-provided SVG with `dangerouslySetInnerHTML` | Inline SVG from design tools may contain `<script>` or `javascript:` URIs | Sanitize all SVG assets with `svgo` before committing; never inject SVG strings directly |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Anime aesthetic applied to information density — every card has 4+ visual accents | Users cannot determine what is actionable vs. decorative; fatigue after 5 minutes | Clean card structure with one accent per card; use anime cover images as the primary visual element (AniList model) |
| Navigation icons without labels ("too anime" custom silhouettes) | Users do not know which Wing they are in; no discoverability | Keep icon+label pairs for the Wing selector; icons alone work only after meaning is established over many sessions |
| Over-animated onboarding wizard | Users feel impatient; cannot proceed quickly | Animate entrance once; subsequent screens in the same flow appear instantly (`initial={false}` on subsequent AnimatePresence children) |
| Custom cursor or parallax scrolling | Disorienting on desktop; cursor lag on Windows with high DPI | Prohibited — no custom cursor or parallax on the main content area |
| Dark theme neon colors on low-contrast surface | Text readable in a dark room but fails in daylight on laptop screen | Verify 4.5:1 on `--surface-container` and `--surface-container-high` surfaces, not just the base surface |
| Japanese text in decorative display font for functional labels | Readability collapses below 14px for kanji in display fonts | Use Noto Sans JP for all functional text; decorative fonts only for headings larger than 20px |
| Wing content unmounted immediately during tab-switch animation | Users lose context; jarring | Defer unmount until exit animation completes; never unmount before `onExitComplete` fires |

---

## "Looks Done But Isn't" Checklist

- [ ] **Design token migration:** All 14 legacy aliases removed from `globals.css` AND confirmed zero references in codebase — verify with `grep -r '\-\-bg-\|\-\-text-\|\-\-border\|\-\-accent-soft\|\-\-accent-glow\|\-\-badge-' src/`
- [ ] **Reduced motion:** Every component that uses `motion/react` imports and calls `useMotionConfig()` — verify with `grep -rL 'useMotionConfig' src/components/**/*.tsx` (any result is a miss)
- [ ] **Font FOIT:** App renders visible text within 100ms of launch without a font-dependent flash — verify by watching startup in `tauri dev` on first cold launch
- [ ] **Focus restoration:** After every modal closes, focus returns to the triggering element — verify by tabbing to a button, pressing Enter, pressing Escape, and confirming focus is back on that button
- [ ] **Stitch origin code:** Zero hardcoded HEX values and zero Tailwind palette classes in production components — verify with `grep -r '#[0-9a-fA-F]\{6\}\|bg-[a-z]*-[0-9]\{3\}' src/components/`
- [ ] **backdrop-filter budget:** At most two blurred elements visible simultaneously — verify by opening any modal over the main content area and measuring GPU usage in Windows Task Manager
- [ ] **Contrast compliance:** All new color tokens verified at 4.5:1 against their most common background — document the ratio for each token in `design.md`
- [ ] **Keyboard navigation:** Tab through each Wing without a mouse and confirm all interactive elements are reachable in a logical order — test after every component overhaul phase

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Legacy alias removal breaks components | LOW (if one-at-a-time) / HIGH (if batch) | Re-add the removed alias as a temporary re-export pointing to the new token; audit all broken components; remove alias again after all components updated |
| Functionality regression discovered late | HIGH | `git bisect` from the last green test run to identify the exact commit; revert the structural change; redo it with a DOM-preserving approach |
| Performance collapse from blur effects | MEDIUM | Replace `backdrop-filter: blur()` with `background: var(--surface-backdrop)` on the affected component; no API or state change needed |
| Accessibility regression (broken focus trap) | MEDIUM | Identify the component that lost the hook; re-wire `useFocusTrap` per WIP hook documentation; verify with keyboard-only walkthrough |
| Font FOIT on cold start | LOW | Add `font-display: optional` to heading font; add `font-display: swap` with `size-adjust` to body font; no component changes needed |
| "Cheap anime" aesthetic in production | HIGH (taste is hard to undo) | Remove all idle animations; reduce gradient usage to one per screen; audit decoration budget per the "1 animated + 1 gradient + 1 icon" rule; requires full visual review pass |
| Stitch code polluted codebase | MEDIUM | Global find-replace for each Tailwind palette class; each replacement requires verifying the correct CSS variable; tedious at scale — prevention is essential |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Functionality regression during reskin | Phase 1 (Design Token Migration) | All 157 tests green after every commit; interaction tests added before Phase 2 |
| Neon contrast failure | Phase 1 (Design Token Migration) | Contrast ratios documented in `design.md` for every new token |
| `backdrop-filter` performance collapse | Phase 3 (Motion and Interaction) | GPU profiling on Windows in `tauri dev`; blur budget defined in Phase 1 design spec |
| Excessive animation / motion sickness | Phase 3 (Motion and Interaction) | Zero `motion/react` components without `useMotionConfig`; WCAG 2.3.3 manual test |
| Japanese font FOUT/FOIT | Phase 2 (Component Overhaul) | Cold-start test: text visible within 100ms; font bundle size tracked |
| Design token migration breakage | Phase 1 (Design Token Migration) | Zero legacy alias references before phase end; CSS variable grep check |
| Stitch output bypassing design system | Phase 1 and Phase 2 | grep check for raw HEX and palette classes on every PR |
| "Cheap anime" decoration overload | Phase 2 (Component Overhaul) | Decoration budget audit per screen before merge |
| Accessibility regression | Phase 2 (Component Overhaul) | Keyboard-only walkthrough and `useFocusTrap`/`useFocusReturn` audit per component |
| Tailwind v4 class syntax renames | Phase 1 (Design Token Migration) | Prefer CSS-variable utilities over palette utilities; v4 docs as sole reference |

---

## Sources

- [WCAG 2.3.3 Animation from Interactions — W3C](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html) — HIGH confidence
- [CSS prefers-reduced-motion technique — W3C WAI](https://www.w3.org/WAI/WCAG21/Techniques/css/C39) — HIGH confidence
- [WCAG 1.4.3 Contrast Minimum — W3C](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) — HIGH confidence
- [Color contrast is #1 accessibility violation — WebAIM Million 2024](https://webaim.org/articles/contrast/) — HIGH confidence
- [Tailwind CSS v4 Upgrade Guide — Official](https://tailwindcss.com/docs/upgrade-guide) — HIGH confidence
- [Tailwind v4 Migration: CSS-First in 2025 — Medium/Better Dev](https://medium.com/better-dev-nextjs-react/tailwind-v4-migration-from-javascript-config-to-css-first-in-2025-ff3f59b215ca) — MEDIUM confidence
- [CSS backdrop-filter GPU performance — Chromium Issue #497522](https://bugs.chromium.org/p/chromium/issues/detail?id=497522) — HIGH confidence
- [Glassmorphism performance implementation guide](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) — MEDIUM confidence
- [Tauri hardware acceleration issue — GitHub #4891](https://github.com/tauri-apps/tauri/issues/4891) — MEDIUM confidence
- [The Gap Between Figma and Production — DEV Community](https://dev.to/lewisnewman24/the-gap-between-figma-and-production-why-handoff-fails-and-how-design-systems-fix-it-4ma9) — MEDIUM confidence
- [Noto Sans JP unicode-range subsetting](https://transang.me/unicode-range-and-font-slicing/) — MEDIUM confidence
- [Fontsource: Noto Sans JP](https://fontsource.org/fonts/noto-sans-jp) — HIGH confidence
- [User Interface Anti-Patterns — UI Patterns](https://ui-patterns.com/blog/User-Interface-AntiPatterns) — MEDIUM confidence
- [Visual Regression Testing — Ranorex](https://www.ranorex.com/blog/visual-regression-testing/) — MEDIUM confidence
- [Anime to UI/UX Design lessons — Medium](https://medium.com/@s.prabhu.sow/anime-to-ui-ux-design-lessons-in-eye-catching-aesthetics-a34516620de1) — LOW confidence
- Direct codebase analysis: `globals.css`, `motion-variants.ts`, `useMotionConfig.ts`, `design.md`, `.claude/rules/design-system.md` — HIGH confidence

---
*Pitfalls research for: Anime-Themed UI/UX Overhaul — OtakuPulse v2.0 (Tauri v2 Desktop App)*
*Researched: 2026-03-28*
