# Design System v2.0 -- OtakuPulse

Void-black cyberpunk dark theme with neon glow accents. Optimized for anime/otaku culture content on desktop.

Source of truth: `src/styles/globals.css` `:root`. All values below must match globals.css exactly.

## 1. Brand Identity

- **Theme:** Dark-only (no light mode)
- **Tone:** Void-black cyberpunk with neon purple glow accents
- **App type:** Tauri v2 desktop app (1100x700, min 900x600)
- **Target:** Anime, manga, game news aggregation for otaku users
- **Color distribution:** 60-30-10 rule (surface / containers / accent)

## 2. Color Tokens

All CSS variables defined in `src/styles/globals.css` `:root`.
Reference via Tailwind arbitrary syntax: `bg-(--surface-container)`, `text-(--on-surface)`.

### Surface Hierarchy (5 layers + base)

| Layer | Token | HEX | Semantic Role |
|-------|-------|-----|---------------|
| 0 | `--surface-base` | `#0a0a0f` | Absolute void base (deepest black) |
| 1 | `--surface` | `#14141a` | Page background |
| 2 | `--surface-container` | `#1c1c24` | Card / panel background |
| 3 | `--surface-container-high` | `#252530` | Hovered card state |
| 4 | `--surface-container-highest` | `#2e2e3b` | Border / divider |
| 5 | `--surface-elevated` | `#3b3b4a` | Floating elements (deepdive drawer, secondary panel) |

### Content (text / outline)

| Token | Value | Usage |
|-------|-------|-------|
| `--on-surface` | `#f9f5fd` | Primary text |
| `--on-surface-variant` | `#acaab1` | Secondary text, labels, metadata |
| `--outline` | `#8a8890` | Placeholder, disabled state |
| `--outline-variant` | `#48474d` | Border hover, divider |

### Accent

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#bd93f9` | CTA, active state, links, neon purple |
| `--primary-soft` | `rgba(189, 147, 249, 0.15)` | Active tab bg, focus ring fill |
| `--primary-glow` | `rgba(189, 147, 249, 0.06)` | Badge bg, glass effect |
| `--primary-hover` | `#a980e0` | Primary button hover |
| `--on-primary` | `#ffffff` | Text on primary background |
| `--secondary` | `#699cff` | "New" badge, secondary accent |
| `--tertiary` | `#ff97b2` | Pink decoration (limited use) |
| `--error` | `#ff6e84` | Error, "Hot" badge, danger |

### Neon Glow System (60-30-10)

RGB base: `189, 147, 249` (derived from `--primary`).

| Token | Value | Usage |
|-------|-------|-------|
| `--glow-primary` | `rgba(189, 147, 249, 0.12)` | 60% dominant -- primary interactive glow, active states |
| `--glow-secondary` | `rgba(189, 147, 249, 0.08)` | 30% supporting -- secondary accents, nav hover |
| `--glow-subtle` | `rgba(189, 147, 249, 0.04)` | 10% ambient -- background shimmer, card atmosphere |

### Content-Type Accents

All pass WCAG AA 4.5:1 contrast against `--surface-container` (`#1c1c24`).

| Token | HEX | Hue | Contrast vs L2 | Usage |
|-------|-----|-----|-----------------|-------|
| `--accent-anime` | `#bd93f9` | Purple | 7.01:1 | Anime content cards |
| `--accent-manga` | `#f48fb1` | Pink | 7.58:1 | Manga content cards |
| `--accent-game` | `#40e0d0` | Cyan | 10.31:1 | Game content cards |
| `--accent-news` | `#ffb86c` | Amber | 9.93:1 | News content cards |

Phase 5 applies these as card left borders and badge backgrounds.

### Surface Overlays

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-hover` | `rgba(255, 255, 255, 0.04)` | Light hover overlay |
| `--surface-hover-strong` | `rgba(255, 255, 255, 0.06)` | Strong hover overlay |
| `--surface-active` | `rgba(255, 255, 255, 0.08)` | Press / active state |
| `--surface-glass` | `rgba(255, 255, 255, 0.03)` | Glassmorphism base |
| `--surface-backdrop` | `rgba(14, 14, 19, 0.97)` | Sticky header backdrop |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-md` | `0 8px 32px rgba(0,0,0,0.25)` | Card hover, dropdowns |
| `--shadow-lg` | `0 12px 40px rgba(0,0,0,0.4)` | Modals, overlays |

### Focus Ring

| Token | Value |
|-------|-------|
| `--focus-ring` | `0 0 0 2px var(--surface), 0 0 0 4px var(--primary)` |

## 3. Typography

Font: **Noto Sans JP Variable** (`@fontsource-variable/noto-sans-jp`). 3-weight system.

### Font Family

```css
--font-jp: "Noto Sans JP Variable", system-ui, sans-serif;
```

Critical: Font name is `"Noto Sans JP Variable"` (not `"Noto Sans JP"`). Mismatch causes silent FOIT.

### Weight Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-weight-light` | `300` | Meta text, labels, timestamps |
| `--font-weight-regular` | `400` | Body text, UI text |
| `--font-weight-semibold` | `600` | Card titles, headings, active tabs |

### Type Scale

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Meta / label | 11px (0.6875rem) | 300 | 1.4 |
| Body / UI text | 13px (0.8125rem) | 400 | 1.5 |
| Card title | 15px (0.9375rem) | 600 | 1.3 |
| Heading / modal | 18px (1.125rem) | 600 | 1.2 |

## 4. Spacing & Layout

8px grid system. All values on 4px sub-grid.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px (0.25rem) | Minimum gaps, icon-to-text |
| sm | 8px (0.5rem) | Tab gaps, icon spacing |
| md | 12px (0.75rem) | Component internal padding |
| lg | 16px (1rem) | Card gaps, section spacing |
| xl | 24px (1.5rem) | Card padding, feed column padding |
| 2xl | 32px (2rem) | Featured card padding |
| 3xl | 48px (3rem) | Section-level gaps |

Exception: `md` (12px) is a 3x base-unit half-step retained from v1.0.

### Layout Constants

| Element | Value |
|---------|-------|
| Feed column max-width | 1400px |
| TopBar height | 2.75rem (44px) |
| Masonry columns | 3 (>1100px) / 2 (>700px) / 1 |
| Masonry column-gap | 1rem |
| Search bar min-width | 280px |

## 5. Design Rules

### Color Distribution (60-30-10)

| Budget | Tokens | Usage |
|--------|--------|-------|
| 60% Dominant | `--surface-base`, `--surface` | Page background |
| 30% Secondary | `--surface-container` through `--surface-elevated` | Cards, panels, nav |
| 10% Accent | `--primary`, `--accent-*` | CTA, active states, content-type badges |

### Contrast

- All accent text: WCAG AA 4.5:1 minimum against `--surface-container`
- Primary text (`--on-surface`): 15.2:1 against `--surface-container`

### Forbidden Patterns

| Forbidden | Use Instead |
|-----------|-------------|
| Hardcoded HEX/RGB (`#bd93f9`, `rgba(...)`) | CSS variable (`--primary`) |
| Tailwind default colors (`blue-500`, `gray-200`) | CSS variable via `bg-(--var)` |
| Inline styles (`style={{ }}`) | Tailwind classes |
| `!important` (except `prefers-reduced-motion`) | Specificity management |
| Light mode branches (`dark:`, `@media (prefers-color-scheme)`) | Dark-only `:root` |

### Performance Budgets

| Budget | Limit |
|--------|-------|
| Blur | Max 2 blurred elements, each under 15% viewport |
| Decoration | 1 animated + 1 gradient + 1 decorative icon per component |
| Animation | 1 entrance animation at a time; ambient off by default |
| Stagger | First 10 items only; below-fold items skip |

## 6. Stitch Token Mapping

Convert Stitch output to project tokens before committing any HEX values.

| Stitch Token | CSS Variable | Tailwind Syntax |
|-------------|-------------|-----------------|
| (void black) | `--surface-base` | `bg-(--surface-base)` |
| brand-background | `--surface` | `bg-(--surface)` |
| brand-surface | `--surface-container` | `bg-(--surface-container)` |
| brand-surface-hover | `--surface-container-high` | `bg-(--surface-container-high)` |
| brand-border | `--surface-container-highest` | `border-(--surface-container-highest)` |
| brand-elevated | `--surface-elevated` | `bg-(--surface-elevated)` |
| brand-primary | `--primary` | `bg-(--primary)` |
| brand-text | `--on-surface` | `text-(--on-surface)` |
| brand-text-secondary | `--on-surface-variant` | `text-(--on-surface-variant)` |
| brand-error | `--error` | `text-(--error)` |
| glow-60 | `--glow-primary` | `bg-(--glow-primary)` |
| glow-30 | `--glow-secondary` | `bg-(--glow-secondary)` |
| glow-10 | `--glow-subtle` | `bg-(--glow-subtle)` |
| accent-anime | `--accent-anime` | `border-(--accent-anime)` |
| accent-manga | `--accent-manga` | `border-(--accent-manga)` |
| accent-game | `--accent-game` | `border-(--accent-game)` |
| accent-news | `--accent-news` | `border-(--accent-news)` |

## 7. Legacy Alias Status

All 16 legacy aliases (--bg-card, --text-primary, etc.) removed in Phase 4 Plan 02 (v2.0).
212 occurrences across 28 files batch-replaced with canonical MD3 tokens.
No migration needed for new code -- use only the tokens documented above.

## 8. Component Rules

See `src/components/ui/` for implementation. Key patterns:

| Element | Border Radius |
|---------|--------------|
| Card | 0.875rem (14px) |
| Modal | 0.75rem (12px) |
| Button / Input | 0.5rem (8px) |
| Badge / Tab (pill) | 9999px |

---

*Design System v2.0 -- Phase 4 Design Token Foundation*
*Last updated: 2026-03-28*
