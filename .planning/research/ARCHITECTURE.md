# Architecture Research — OtakuPulse v2.0 Design System Overhaul

**Domain:** Anime/Otaku-Rich UI Design System — Tauri v2 Desktop App
**Researched:** 2026-03-28
**Confidence:** HIGH (direct codebase analysis + Tailwind 4 official docs + Framer Motion / motion library verified)

---

## System Overview

The v2.0 overhaul is a pure **frontend transformation** — the Rust 4-layer backend is untouched. The design system sits entirely within `src/` and is organized into four interlocking layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Design Token Layer                        │
│   globals.css (@theme + :root)  ←  Stitch palette source    │
│   animations.css · components.css                           │
├─────────────────────────────────────────────────────────────┤
│                  Motion / Animation Layer                    │
│   motion-variants.ts  ←  useMotionConfig()  ←  components   │
│   CSS @keyframes  ←  shimmer, scan, glow pulses             │
├─────────────────────────────────────────────────────────────┤
│                  Component Layer                             │
│  ui/ primitives   wings/ layouts   common/ shared           │
│  AppShell → Nav + TopBar + MainContent                      │
├─────────────────────────────────────────────────────────────┤
│                  Accessibility Layer                         │
│  useAnnouncer · useFocusTrap · useFocusReturn · useScrollLock│
│  useAnnouncerStore   prefers-reduced-motion guards           │
└─────────────────────────────────────────────────────────────┘
```

The Tauri IPC boundary (`invoke()`) is NOT changed. All Zustand stores (`useDiscoverStore`, `useArticleStore`, etc.) are also unchanged — only their consuming components get visual overhauls.

---

## Recommended Architecture

### 1. Design Token Architecture: Hybrid @theme + :root

**Decision: Use Tailwind 4 `@theme` for utility-generating tokens + `:root` for semantic tokens.**

Tailwind CSS 4's `@theme` directive auto-generates utility classes (`bg-otaku-purple`, `text-neon-pink`) from tokens AND exposes them as CSS variables. `:root` tokens are for semantic aliases and values that do NOT need utility class generation (shadow values, composite effects, glassmorphism recipes).

**Token Tier Structure:**

```
Tier 1 — Raw Palette (in @theme)
  --color-otaku-purple-*   (neon purple scale: 100–900)
  --color-neon-pink-*      (sakura/hot pink scale)
  --color-cyber-blue-*     (electric blue scale)
  --color-surface-*        (deep dark backgrounds)
  --color-ink-*            (text/content scale)

Tier 2 — Semantic Tokens (in :root, alias to Tier 1)
  --primary           → var(--color-otaku-purple-400)
  --primary-soft      → rgba-form of --color-otaku-purple-400 at 15%
  --tertiary          → var(--color-neon-pink-400)
  --surface           → var(--color-surface-950)
  --on-surface        → var(--color-ink-50)
  (etc. — same semantic names as today, different raw values)

Tier 3 — Component Tokens (in :root, per-component)
  --card-bg           → var(--surface-container)
  --card-border       → var(--outline-variant)
  --nav-glow          → composite box-shadow recipe
  --topbar-backdrop   → composite backdrop-filter recipe
```

**Why this 3-tier approach:**
- Tier 1 gives Tailwind utility classes for one-off use in JSX (`bg-otaku-purple-400`)
- Tier 2 preserves ALL existing semantic token names — zero component changes needed for migration
- Tier 3 isolates component-specific composite values, making per-component theming safe

**Token File Organization:**

```
src/styles/
├── globals.css          — @import order + :root semantic tokens + @theme raw palette
├── tokens/
│   ├── palette.css      — @theme raw color/scale definitions (NEW)
│   ├── semantic.css     — :root semantic aliases (extracted from globals.css)
│   └── components.css   — per-component tokens (extracted from components.css)
├── animations.css       — @keyframes: existing + new otaku-specific
└── components.css       — component class recipes (existing, migrated)
```

**Migration path: zero-breakage token rename strategy.**

The existing semantic token names (`--primary`, `--surface`, `--on-surface`, `--surface-container`, etc.) are preserved exactly. Only their raw HEX values change. This means:
1. No component files need to be touched during token migration
2. Legacy aliases in `globals.css` can be removed in one clean-up commit after all components are confirmed working
3. Stitch → Figma generates a new palette; values flow into Tier 1 @theme only

### 2. Otaku-Rich Color Palette

**Direction: Neon-noir dark theme with anime/cyberpunk visual identity.**

Confirmed approach from research: neon purple primary (existing `--primary: #bd9dff` is a good anchor), deepened darks, added neon pink tertiary, electric cyan for interactive feedback, scanline/grid overlay effects via CSS only (no canvas).

**New palette values (to be confirmed from Stitch mockups):**

```css
@theme {
  /* Otaku Purple — primary accent */
  --color-otaku-purple-300: #d4baff;
  --color-otaku-purple-400: #bd9dff;   /* existing --primary anchor */
  --color-otaku-purple-500: #a07ae0;
  --color-otaku-purple-600: #7f5bbf;

  /* Neon Pink — tertiary, sakura accents */
  --color-neon-pink-300: #ffb3d0;
  --color-neon-pink-400: #ff79a8;
  --color-neon-pink-500: #e8527f;

  /* Cyber Blue — secondary, interactive */
  --color-cyber-blue-400: #699cff;     /* existing --secondary anchor */
  --color-cyber-blue-500: #4d7de0;

  /* Deep Surface — background layers */
  --color-surface-950: #09090f;        /* deeper than current #0e0e13 */
  --color-surface-900: #0e0e13;        /* current --surface */
  --color-surface-800: #14141b;
  --color-surface-700: #19191f;        /* current --surface-container */
  --color-surface-600: #1f1f28;
  --color-surface-500: #252530;

  /* Ink — text */
  --color-ink-50:  #f9f5fd;            /* current --on-surface */
  --color-ink-300: #c8c6cf;
  --color-ink-400: #acaab1;            /* current --on-surface-variant */
  --color-ink-600: #8a8890;            /* current --outline */
}
```

Note: Final values MUST come from Stitch mockups. The above are structural placeholders aligned to existing anchors.

### 3. Animation Architecture: Hybrid CSS + motion/react

**Decision: CSS for decorative/ambient effects, motion/react (Framer Motion) for interactive transitions.**

| Effect Type | Technology | Reason |
|-------------|-----------|--------|
| Shimmer/skeleton | CSS @keyframes | Pure performance, no JS |
| Neon glow pulse | CSS @keyframes | Ambient, runs unconditionally |
| Scanline overlay | CSS @keyframes | Decorative background |
| Card hover lift | CSS transition | No JS overhead, browser-optimized |
| Wing page transitions | motion/react AnimatePresence | Needs enter/exit coordination |
| Modal open/close | motion/react AnimatePresence | Already implemented |
| Nav active indicator | motion/react layoutId | Already implemented |
| Toast slide | motion/react | Already implemented |
| Card stagger reveal | motion/react staggerChildren | Already implemented |
| Sidebar slide-in | motion/react | Already implemented |

**Existing motion-variants.ts is already well-structured** — it only needs new variant additions for the overhaul (card flip, neon pulse entry, etc.). The `useMotionConfig()` hook correctly handles `prefers-reduced-motion` at the React level.

**New CSS @keyframes to add in animations.css:**

```css
/* Neon glow pulse for accent elements */
@keyframes neonPulse {
  0%, 100% { filter: drop-shadow(0 0 4px var(--primary)); }
  50%       { filter: drop-shadow(0 0 12px var(--primary)); }
}

/* Scanline overlay (decorative, not interactive) */
@keyframes scanlineScroll {
  from { background-position: 0 0; }
  to   { background-position: 0 8px; }
}

/* Card entrance with otaku flair */
@keyframes cardPop {
  0%   { opacity: 0; transform: scale(0.96) translateY(10px); }
  60%  { opacity: 1; transform: scale(1.01) translateY(-2px); }
  100% { transform: scale(1) translateY(0); }
}
```

**All new CSS animations must check `prefers-reduced-motion`** — the existing global rule in globals.css (`animation-duration: 0.01ms`) covers this automatically. For motion/react variants, `useMotionConfig()` must be used (already enforced by WIP architecture).

### 4. Component Architecture: Modify Existing, Add New

**Component change classification:**

| Component | Action | What Changes |
|-----------|--------|-------------|
| `ui/Button` | MODIFY | New variant `neon` + `ghost-neon`; updated border-radius to CSS var; glow states |
| `ui/Badge` | MODIFY | New variant `anime`, `manga`, `game` for content-type; otaku color assignments |
| `ui/Card` | MODIFY | Glassmorphism option prop; neon border-top accent; hover shadow with glow |
| `ui/Input` | MODIFY | Neon focus glow instead of simple ring; match new token names |
| `ui/Modal` | MODIFY | Backdrop more dramatic (stronger blur); border glow accent; entrance animation update |
| `ui/Spinner` | MODIFY | Dual-ring neon variant; existing stays as fallback |
| `ui/ToggleGroup` | MODIFY | Active state neon underline/glow; smoother transition |
| `layout/AppShell` | MODIFY | Sidebar width 60px → configurable; top bar height token; brand logo area |
| `layout/TopBarSearch` | MODIFY | Expanded search with neon focus; possible command palette (future) |
| `wings/*.tsx` | MODIFY | Background patterns, section headers, spacing updates |
| `discover/DiscoverCard` | MODIFY | Image aspect ratio standardized; category badge visual; neon hover |
| `discover/DeepDivePanel` | MODIFY | Chat bubble style; AI label redesign |
| `schedule/AiringCard` | MODIFY | Anime thumbnail aspect ratio; countdown timer visual |

**New components needed:**

| Component | Purpose | Location |
|-----------|---------|----------|
| `ui/GlowBorder` | Reusable neon border effect wrapper | `src/components/ui/` |
| `ui/ScanlineOverlay` | Optional decorative scanline texture | `src/components/ui/` |
| `ui/AnimeTag` | Styled content-type tag (anime/manga/game/news) | `src/components/ui/` |
| `layout/SidebarNav` | Extracted from AppShell; wider variant support | `src/components/layout/` |
| `common/HeroSection` | Featured content hero with large artwork support | `src/components/common/` |

**Zero new Tauri commands needed** — this milestone is frontend-only.

### 5. Responsive Layout Patterns for Desktop

The app is fixed at 1100×700 min (Tauri window). Layout strategy differs from web responsive:

**Desktop-specific layout tiers (not media queries — use CSS container queries):**

```
Narrow (900–1100px)  → Sidebar icon-only (60px), content single-column
Standard (1100–1400px) → Sidebar icon+label (80px), content 2–3 column masonry
Wide (1400px+)        → Sidebar with mini-preview (120px), content 3–4 column
```

**Use CSS container queries (`@container`) instead of viewport media queries** for Wing content areas — this makes Wings reusable independently of the app shell width.

```css
.wing-content { container-type: inline-size; container-name: wing; }

@container wing (width < 500px)  { .card-grid { columns: 1; } }
@container wing (width >= 700px) { .card-grid { columns: 2; } }
@container wing (width >= 900px) { .card-grid { columns: 3; } }
```

**Tailwind 4 supports `@container` natively** — use `@lg:` prefix within the container context.

### 6. AppShell Navigation Overhaul

**Current:** 60px icon-only vertical sidebar with layout motion indicator.
**Target:** Visually enriched sidebar with neon indicator, brand logo, possible category groupings.

The sidebar is currently inlined in `AppShell.tsx`. For the overhaul, extract it to `SidebarNav` component:

```
AppShell.tsx
├── SidebarNav (NEW — extracted from AppShell)
│   ├── BrandLogo
│   ├── NavItem × 5 (with motion layoutId indicator)
│   └── CollectButton
├── TopBarSearch (MODIFY)
├── WindowControls (unchanged)
└── MainContent (React.Suspense wrapper — unchanged)
```

**No state changes** — `activeWing` remains in `AppShell` and passed via props or a lightweight context. Do NOT move to Zustand; navigation state is ephemeral.

### 7. Stitch → Figma → Code Pipeline

**Step-by-step workflow for this milestone:**

```
Phase A: Stitch Mockup Generation
  1. Write descriptive prompts per screen (Discover, Library, Schedule, Profile, Reader)
  2. Include brand description: "dark cyberpunk anime news aggregator, neon purple #bd9dff accent,
     deep dark backgrounds, scanline texture, neon glow effects, Japanese otaku aesthetic"
  3. Use image input mode: upload reference screenshots of current app + anime design inspiration
  4. Generate 2–3 variants per screen; keep best composition
  5. Export to Figma via "Paste to Figma" button (standard mode)

Phase B: Figma Refinement
  1. In Figma: verify exported components map to existing component names
  2. Create/update Figma design tokens matching the CSS @theme names exactly
     (--color-otaku-purple-400, --surface-container, etc.)
  3. Annotate each component with CSS variable names from design.md
  4. Use Figma MCP to read component tokens into Claude Code context

Phase C: Token Extraction
  1. From Figma MCP: extract all color values as @theme palette entries
  2. Map Figma tokens → Tier 1 @theme CSS vars (palette.css)
  3. Verify Tier 2 semantic aliases still hold (--primary points to correct Tier 1 var)
  4. Update design.md Stitch Token Mapping table with new values

Phase D: Component Implementation
  1. Read Figma component specs via Figma MCP (border-radius, spacing, shadow values)
  2. Implement ui/ primitives first (they have no dependencies)
  3. Implement layout/ components second
  4. Implement wings/ and feature components last
  5. Each component: implement → visual check → biome lint → typecheck
```

**Critical rule from design-workflow.md:** Never copy Stitch-generated HTML/CSS directly. Always translate to CSS variables and Tailwind classes aligned with design.md.

### 8. Migration Strategy: MD3 → Otaku Theme

**Zero-breakage migration in 4 sequential passes:**

```
Pass 1 — Token Values Only (all CSS, no TSX changes)
  - Add @theme palette.css with new raw values
  - Update :root semantic tokens to point to new Tier 1 values
  - All components continue working — same semantic names, new visual values
  - Verify with: npm run dev → visual check all 5 wings

Pass 2 — Remove Legacy Aliases (CSS only)
  - Delete legacy alias block from globals.css
  - Search-replace all components using legacy names (--bg-card, --text-primary, etc.)
  - Use biome to ensure no regressions
  - This is safe because all components should already use new semantic names

Pass 3 — Component Visual Overhaul (TSX + CSS changes)
  - Update ui/ primitives with new variants and visual treatments
  - Update AppShell → SidebarNav extraction
  - Update wings/ visual treatments
  - Component-by-component, no bulk changes

Pass 4 — New Decorative Layer (additive only)
  - Add GlowBorder, ScanlineOverlay, AnimeTag components
  - Add new CSS @keyframes in animations.css
  - Add new motion variants in motion-variants.ts
  - Integrate into feature components where appropriate
```

**Pass 1 is reversible** — if the new palette looks wrong, you revert 2 CSS files only, nothing breaks.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `AppShell` | App skeleton, wing routing, event listeners | All wings (via lazy import), Zustand `useArticleStore`, `useFilterStore` |
| `SidebarNav` (new) | Navigation items, active indicator, brand logo | AppShell (props: activeWing, onNavigate) |
| `ui/Button` | Interactive click target, all button variants | Consumers via props |
| `ui/Card` | Container surface, hover states, glassmorphism option | Consumers via props + className |
| `ui/Badge` | Categorical label, content-type indicator | Content-aware (passes variant based on category) |
| `motion-variants.ts` | Centralized animation definitions | All animated components via `useMotionConfig()` |
| `useMotionConfig()` | Reduced-motion-aware variant selection | Any component using motion/react |
| `globals.css @theme` | Design token source of truth | Tailwind utility generation + all CSS var consumers |
| `design.md` | Human-readable token documentation | Claude Code context, Figma MCP |

---

## Data Flow

### Token Flow (Design → Code)

```
Stitch Prompt / Image
    ↓  (export / paste)
Figma (design tokens, component specs)
    ↓  (Figma MCP read)
Claude Code context
    ↓  (implement)
globals.css @theme → Tailwind utility classes
globals.css :root  → CSS variables
    ↓
components.css (recipes using var())
    ↓
*.tsx components (Tailwind classes + var() references)
```

### Animation Flow (Interaction → Effect)

```
User Action / State Change
    ↓
React component render
    ↓
useMotionConfig() → returns full OR reduced variants
    ↓
motion.div variants={variants.fadeSlideIn}
    ↓
motion/react → Web Animations API (respects reduced motion at React level)
```

### Component Theme Flow

```
@theme palette.css
    ↓  (CSS var generation)
:root semantic tokens
    ↓  (var() aliases)
Tailwind utility classes at build time
    ↓
component JSX: bg-(--surface-container) text-(--on-surface)
                ↕                              ↕
            resolved at runtime via CSS cascade
```

---

## Patterns to Follow

### Pattern 1: Token-First Component Design

**What:** All visual properties reference CSS variables, never hardcoded values.
**When:** Every component, every property (color, shadow, border-radius, spacing).
**Why:** Token changes propagate app-wide in one CSS edit; Stitch/Figma values flow directly.

```tsx
// CORRECT
<div className="bg-(--surface-container) border border-(--outline-variant) rounded-[var(--radius-card)]">

// WRONG
<div style={{ background: '#19191f', border: '1px solid #48474d' }}>
```

### Pattern 2: Motion Variant Indirection via useMotionConfig

**What:** Never import motion variants directly; always go through `useMotionConfig()`.
**When:** Every component using `motion.div` or any motion component.
**Why:** Single switch handles `prefers-reduced-motion` for all animated components.

```tsx
// CORRECT
const { variants, spring } = useMotionConfig();
<motion.div variants={variants.fadeSlideIn} initial="hidden" animate="visible">

// WRONG
import { fadeSlideIn } from '../../lib/motion-variants';
<motion.div variants={fadeSlideIn} initial="hidden" animate="visible">
```

### Pattern 3: Additive Variant Extension

**What:** New visual variants added to existing components via `variant` prop; existing props unchanged.
**When:** Adding `neon`, `glass`, `anime` variants to Button, Card, Badge.
**Why:** Zero breakage to existing usage; new features opt-in.

```tsx
// Adding 'neon' variant to Button — existing 'primary' usage unchanged
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'neon'; // neon added
}
```

### Pattern 4: Component Token Scoping

**What:** Per-component CSS variables scoped to the component's root class.
**When:** Complex components with multiple internal states (card, modal, sidebar).
**Why:** Overridable per-context without affecting other components using the same semantic tokens.

```css
.discover-card {
  --card-bg: var(--surface-container);
  --card-border: var(--outline-variant);
  --card-glow: var(--primary-glow);
  background: var(--card-bg);  /* component-scoped, overridable */
}
.discover-card.featured {
  --card-bg: var(--surface-container-high);  /* local override */
}
```

### Pattern 5: Stitch Token Mapping Discipline

**What:** Every Stitch-generated color → CSS variable translation is documented in `design.md`.
**When:** After every Stitch session before implementing any code.
**Why:** Prevents Stitch HEX values from leaking into code; maintains single source of truth.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Stitch HTML Copy-Paste

**What people do:** Copy Stitch-generated JSX/HTML verbatim into component files.
**Why it's wrong:** Stitch uses hardcoded HEX values (`#bd9dff`) and arbitrary Tailwind classes that bypass the design token system. It also doesn't know about the existing component API.
**Do this instead:** Use Stitch output as a visual reference only. Implement from scratch using CSS variables and existing component primitives.

### Anti-Pattern 2: Introducing Motion at the CSS + JS Level for the Same Property

**What people do:** Add CSS `transition: transform 0.3s` AND `motion.div` animate={{ scale: ... }} on the same element.
**Why it's wrong:** Browser handles both, creating unpredictable layering. CSS transition wins on paint but JS overrides can conflict.
**Do this instead:** If motion/react owns an element's animation, remove the CSS transition for that property.

### Anti-Pattern 3: Adding New @theme Tokens That Shadow :root Variables

**What people do:** Define `@theme { --surface: #xxx }` thinking it overrides the `:root { --surface }`.
**Why it's wrong:** `@theme` generates `--color-surface` (namespaced) AND a CSS variable, but `:root` declaration takes precedence for the non-namespaced name. This creates confusing dual sources.
**Do this instead:** Keep `@theme` for raw palette (namespaced: `--color-*`, `--shadow-*`) and `:root` for semantic aliases. Never put semantic names in `@theme`.

### Anti-Pattern 4: Bulk Component Overhaul in One Commit

**What people do:** Rewrite all 7 UI primitives at once to verify the palette looks correct.
**Why it's wrong:** If the palette is wrong (it will be on first attempt), you can't isolate which component broke what. Rollback is a full revert.
**Do this instead:** Token migration first (Pass 1), visual check, then component-by-component.

### Anti-Pattern 5: Glassmorphism on Performance-Sensitive List Items

**What people do:** Add `backdrop-filter: blur(12px)` to every DiscoverCard in a virtualised list.
**Why it's wrong:** `backdrop-filter` triggers a compositing layer per element. 30+ cards with blur = severe GPU pressure in Tauri's Chromium view.
**Do this instead:** Reserve glassmorphism for fixed/sticky elements (TopBar, Modal, Sidebar) — never list items. For cards, use `--surface-glass` (opacity-only) without blur.

---

## Build Order (Minimises Breakage Risk)

The key constraint is that token changes are backward-compatible, but component overhauls are not. Build in this order:

```
Step 1 — Stitch Mockup Session
  Create prompts, generate designs, identify final palette
  Output: approved Figma file with annotated tokens

Step 2 — Design Token Update (Pass 1)
  - Create src/styles/tokens/palette.css with @theme entries
  - Update :root semantic tokens in globals.css to new values
  - Update design.md Stitch Token Mapping table
  - Verify: npm run dev, visual check 5 wings, npm run check, npm run typecheck
  Output: new palette visible everywhere, zero broken components

Step 3 — Legacy Alias Removal (Pass 2)
  - Search-replace legacy var names across all .tsx and .css files
  - Delete legacy aliases block from globals.css
  - Verify: same checks as Step 2
  Output: clean token reference tree

Step 4 — UI Primitives Overhaul (Pass 3, top-down by dependency)
  Order: Badge → Spinner → Button → Input → ToggleGroup → Card → Modal
  (Badge has no dependents among primitives; Modal depends on all others)
  - For each: implement → visual check → biome → typecheck
  Output: 7 primitives with new visual + new variants

Step 5 — Layout Overhaul
  - Extract SidebarNav from AppShell
  - Update AppShell with new layout tokens
  - Update TopBarSearch neon focus
  Output: new navigation visual identity

Step 6 — Feature Components
  - Wings visual treatment (backgrounds, section headers)
  - DiscoverCard, AiringCard, ArticleReader overhaul
  - HighlightsSection hero treatment
  Output: content areas match design spec

Step 7 — New Decorative Components (Pass 4, additive)
  - Add GlowBorder, ScanlineOverlay, AnimeTag
  - Add new CSS @keyframes
  - Integrate into feature components
  Output: optional otaku flair layer active

Step 8 — Motion Enhancements
  - Add new variants to motion-variants.ts
  - Integrate wing transitions via AnimatePresence
  - Verify useMotionConfig() reduced-motion path
  Output: polished interaction transitions
```

---

## Scaling Considerations

| Concern | Current (1 user, desktop) | Future (if web/mobile added) |
|---------|--------------------------|------------------------------|
| Token complexity | Flat 3-tier is sufficient | Consider Style Dictionary for multi-platform output |
| Animation perf | motion/react + CSS hybrid fine for Chromium | Web: same. Mobile Tauri: GPU budget tighter |
| Component library | Local primitives sufficient | Could extract to separate package |
| Dark-only theme | No light mode needed | If added: wrap semantic tokens in `color-scheme` queries |

---

## Integration Points

### Stitch Integration

| Integration | Method | Notes |
|-------------|--------|-------|
| Stitch → Figma | "Paste to Figma" export (standard mode) | Use standard mode; experimental mode layouts may not match Tauri window constraints |
| Figma → Code | Figma MCP + manual token extraction | Read component tokens directly into Claude Code context for accurate implementation |
| Design values → CSS | design.md Stitch Token Mapping table | All Stitch HEX values MUST be translated to CSS variables via this table before use |

### Internal Architecture Boundaries

| Boundary | Communication | Notes |
|----------|--------------|-------|
| AppShell ↔ SidebarNav | Props (activeWing, onNavigate) | No Zustand for nav state — ephemeral, local to AppShell |
| Component ↔ Design Tokens | CSS variables via Tailwind classes | Never bypass token system with inline styles |
| Animated component ↔ motion-variants | useMotionConfig() hook only | Direct import of variants bypasses reduced-motion guard |
| Wings ↔ Zustand stores | Unchanged — stores are backend-facing, not design-coupled | Visual overhaul does not touch store interfaces |
| CSS @theme ↔ :root | @theme for raw palette; :root for semantic | Never duplicate a name across both (causes specificity confusion) |
| components.css ↔ Tailwind classes | components.css uses CSS var() only; no Tailwind in .css | Keep concerns separated: Tailwind in JSX, var() in .css |

---

## Sources

- Tailwind CSS 4 `@theme` directive documentation: https://tailwindcss.com/docs/theme (HIGH confidence — official docs)
- Tailwind CSS 4 release blog: https://tailwindcss.com/blog/tailwindcss-v4 (HIGH confidence — official)
- Google Stitch announcement and workflow: https://developers.googleblog.com/stitch-a-new-way-to-design-uis/ (HIGH confidence — official Google Developers Blog)
- Google Stitch 2026 guide (Vibe Design, export pipeline): https://www.nxcode.io/resources/news/google-stitch-complete-guide-vibe-design-2026 (MEDIUM confidence — third-party)
- motion/react (Framer Motion) animation library: https://motion.dev/ (HIGH confidence — official)
- Existing codebase analysis: `src/lib/motion-variants.ts`, `src/hooks/useMotionConfig.ts`, `src/styles/globals.css`, `src/styles/animations.css`, `src/components/layout/AppShell.tsx`, `design.md` (HIGH confidence — direct code analysis)
- Cyberpunk CSS design patterns: https://www.cssscript.com/cyberpunk-css-framework-cybercore/ (MEDIUM confidence — reference only)
- Design token migration strategies: https://medium.com/@stevedodierlazaro/automate-design-token-migrations-with-codemods-a21cf8bbd53b (MEDIUM confidence — community)

---

*Architecture research for: OtakuPulse v2.0 — Anime/Otaku-Rich Design System Overhaul*
*Researched: 2026-03-28*
