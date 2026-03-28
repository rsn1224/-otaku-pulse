# Technology Stack — v2.0 Otaku-Rich Design Overhaul

**Project:** OtakuPulse
**Researched:** 2026-03-28
**Milestone:** v2.0 UI/UX Design Overhaul (subsequent to v1.0 Stabilization)
**Mode:** Ecosystem — what NEW packages are needed for anime/otaku visual identity overhaul

---

## Executive Summary

The existing stack (React 19 + Tailwind CSS 4 + motion 12 + Zustand 5) already covers 80% of the design overhaul needs. The key additions are: a utility-first class composition layer (clsx + tailwind-merge) to handle variant logic cleanly, an icon library (lucide-react), self-hosted Japanese variable fonts (@fontsource-variable/noto-sans-jp), and a lightweight class-variance component pattern (class-variance-authority). Particle effects and heavy animation libraries are explicitly NOT recommended — they destroy Tauri desktop performance. All neon, glassmorphism, and gradient effects are achievable with pure CSS custom properties on top of the existing Tailwind 4 @theme system. The existing `motion` library (Framer Motion fork) is already installed and sufficient for all UI animation needs.

**Zero new animation libraries are needed.** `motion` 12.x already provides springs, keyframes, gestures, SVG path drawing, and scroll-linked animations. Adding GSAP, anime.js, react-spring, or tsParticles on top would create redundancy and bloat.

---

## What Is Already Sufficient (Do Not Re-Add)

These are confirmed installed and cover the stated design needs without additions:

| Package | Version | Covers |
|---------|---------|--------|
| `motion` | 12.38.0 | Spring physics, keyframes, SVG draw, scroll-linked, gestures, exit animations |
| `tailwindcss` | 4.2.1 | @theme design tokens, backdrop-blur, gradients, arbitrary values |
| `@tanstack/react-virtual` | 3.13.23 | Virtualized card lists (already installed, unused — activate it) |
| `zustand` | 5.0.11 | Animation state (reduced motion preference, panel open/close) |

---

## Recommended Stack Additions (New Packages Only)

### Priority 1 — Required for Design System

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `lucide-react` | `^1.7.0` | SVG icon library | v1.0 released 2026. 1400+ icons, tree-shakable (each icon is a separate import), pure inline SVG, TypeScript-typed. Zero runtime API calls unlike Iconify. Matches the existing design language (clean lines, adjustable stroke). Install: `npm i lucide-react`. Use: `import { Flame, Star, Bookmark } from 'lucide-react'`. |
| `clsx` | `^2.1.1` | Conditional className construction | 239 bytes gzipped. Replaces ad-hoc string concatenation in components. Pairs with tailwind-merge for safe class overriding. Pattern: `cn(base, conditional, override)`. No dependencies. |
| `tailwind-merge` | `^3.5.0` | Conflict-safe Tailwind class merging | v3.5.0 explicitly supports Tailwind CSS 4.x (v2.x was for Tailwind 3 only — do not use v2 here). Prevents class conflicts in component `className` props. Required for any reusable component that accepts a `className` override prop. |
| `class-variance-authority` | `^0.7.1` | Component variant system | Declarative API for Button sizes/variants, Badge colors, Card states. Avoids sprawling ternary expressions in JSX. Works with any class string — not Tailwind-specific. Last published ~1 year ago but stable/maintained. Alternative: `tailwind-variants` (newer, Tailwind-native) — see Alternatives below. |

**Combined install:**
```bash
npm i lucide-react clsx tailwind-merge class-variance-authority
```

**Standard `cn()` helper to add to `src/lib/utils.ts`:**
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### Priority 2 — Typography (Japanese Font Support)

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@fontsource-variable/noto-sans-jp` | `^5.x` | Self-hosted Japanese variable font (UI body/labels) | Tauri desktop apps cannot reliably load Google Fonts at runtime. Fontsource bundles font files as npm assets, loaded by Vite at build time. Variable font means one file covers weights 100–900. Noto Sans JP is the standard for legible Japanese text UI. The `@fontsource-variable` variant uses a single wght axis file rather than 7 separate weight files — critical for Tauri bundle size. Import: `import "@fontsource-variable/noto-sans-jp"` in `main.tsx`. |
| `@fontsource-variable/noto-serif-jp` | `^5.x` | Self-hosted Japanese serif variable font (display headings) | Optional but recommended for anime aesthetic headings. Noto Serif JP variable gives the editorial, manga-adjacent look suitable for article titles and section headers. Only import specific weights (ExtraBold/Black) to minimize bundle: `import "@fontsource-variable/noto-serif-jp/wght-italic.css"`. |

**Install:**
```bash
npm i @fontsource-variable/noto-sans-jp @fontsource-variable/noto-serif-jp
```

**CSS integration in `globals.css` @theme:**
```css
@theme {
  --font-sans: "Noto Sans JP Variable", system-ui, sans-serif;
  --font-display: "Noto Serif JP Variable", Georgia, serif;
}
```

**Confidence:** MEDIUM — Fontsource self-hosting is verified as the correct approach for Tauri (no external network access during app use), but exact bundle impact on a Tauri binary has not been measured. CJK fonts are large; lazy-loading specific subsets via Vite is recommended.

### Priority 3 — Optional Utility Enhancements

| Package | Version | Purpose | Why | Threshold |
|---------|---------|---------|-----|-----------|
| `@tauri-apps/plugin-window-state` | already installed | Persist custom titlebar state | Already in package.json. Enabling `decorations: false` in tauri.conf.json + `data-tauri-drag-region` on custom titlebar element is sufficient for anime-styled window chrome — no new package needed. | Use existing |

---

## CSS-Only Techniques (No New Packages Needed)

These effects are achievable with Tailwind 4 + CSS custom properties alone. Adding a library for these would be bloat.

### Neon Glow Effects

Pure `box-shadow` and `text-shadow` with CSS custom property colors:

```css
/* Add to globals.css — neon glow utilities */
@utility neon-primary {
  box-shadow:
    0 0 8px var(--primary),
    0 0 24px rgba(189, 157, 255, 0.4),
    0 0 48px rgba(189, 157, 255, 0.2);
}

@utility neon-text {
  text-shadow:
    0 0 8px var(--primary),
    0 0 20px rgba(189, 157, 255, 0.6);
}
```

**Performance note:** Animating `box-shadow` triggers GPU compositing but causes repaints on Chromium. Limit to `:hover` and entry animations only — not continuous CSS `@keyframes` loops. Use `will-change: filter` on the parent instead of box-shadow for continuous glows (uses filter: drop-shadow which composites on the GPU without repaint).

### Glassmorphism Panels

Tailwind 4 utilities are sufficient:
```html
<!-- Glass card pattern -->
<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg">
```

The existing `--surface-glass: rgba(255,255,255,0.03)` token in `globals.css` is the correct base value. Add a `--surface-glass-border: rgba(255,255,255,0.08)` token for the border.

### Gradient Conic/Radial for Anime Color Palettes

Tailwind 4 supports `bg-[conic-gradient(...)]` arbitrary values. For the anime cyberpunk aesthetic, add named gradient utilities to `globals.css`:

```css
@utility gradient-anime-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, var(--tertiary) 100%);
}

@utility gradient-radial-glow {
  background: radial-gradient(ellipse at center, rgba(189,157,255,0.15) 0%, transparent 70%);
}
```

### SVG Path Draw Animation (motion — already installed)

The existing `motion` library supports `pathLength`, `pathOffset`, and `pathSpacing` on SVG elements. No additional library needed:

```tsx
import { motion } from "motion/react";

<motion.path
  d="M..."
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 1.5, ease: "easeInOut" }}
/>
```

---

## What NOT to Add (Bloat Prevention)

| Library | Why Avoid |
|---------|-----------|
| `@tsparticles/react` / `tsparticles` | Bundle: 1.54 MB uncompressed. Continuous particle rendering tanks frame rates in Tauri's Chromium WebView. Anime aesthetic ambient particles can be replicated with 3–5 absolutely-positioned `motion.div` blurred orbs at near-zero cost. |
| `gsap` (GreenSock) | 23KB gzipped core, but adds a second animation runtime alongside `motion`. GSAP excels at timeline orchestration; `motion` already covers this use case. GSAP's license (Standard License) also limits redistribution in software sold commercially. |
| `animejs` v4 | Lightweight (under 10KB) but redundant with `motion`. Would create split animation responsibilities across the codebase. |
| `react-spring` | Physics-based springs — exactly what `motion` already provides. Adding it creates two physics engines. |
| `lottie-react` | Appropriate for complex multi-frame character animations (e.g., loading mascots). Only add if the design spec calls for Lottie files specifically. At 43KB gzipped for the player, it's acceptable if needed but not a default add. |
| `three` / `@react-three/fiber` | 3D rendering is outside scope. WebGL context in Tauri has known initialization quirks on Windows. |
| `iconify` (`@iconify/react`) | API-fetches icons at runtime by default (network call from desktop app). Offline bundle mode requires per-icon-set packages. Lucide is simpler for a defined icon set. |
| `react-icons` | Bundles ALL icons from a set — no tree-shaking at the set level. Large bundle vs lucide's per-icon imports. |
| `style-dictionary` | Token transformation tool for multi-platform. This project uses CSS variables directly in `globals.css` with Tailwind 4 @theme. No additional transformation layer is needed. |
| `shadcn/ui` | Component-copy system. The project already has custom `src/components/ui/` components. Adding shadcn would conflict with the existing design system and create parallel component hierarchies. |
| `framer-motion` | Same package as the already-installed `motion`. `motion` is the renamed package. Do not install both. |

---

## Tailwind CSS 4 @theme Integration (Design Token Strategy)

Tailwind 4's `@theme` directive eliminates the need for any external design token management tool. All tokens defined in `@theme` are automatically:
1. Available as CSS variables (`var(--color-primary)`)
2. Used by Tailwind utilities (`bg-(--primary)`, `text-(--on-surface)`)

**Recommended token expansion for anime aesthetic in `globals.css`:**

```css
@theme {
  /* Existing tokens carry over */

  /* New: Neon glow intensity levels */
  --glow-xs: 0 0 4px var(--primary);
  --glow-sm: 0 0 8px var(--primary), 0 0 16px rgba(189,157,255,0.3);
  --glow-md: 0 0 12px var(--primary), 0 0 32px rgba(189,157,255,0.4);

  /* New: Animation timing tokens (used in motion variants) */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

  /* New: Anime-themed surface variants */
  --surface-frosted: rgba(25, 25, 31, 0.85);
  --surface-glass-border: rgba(255, 255, 255, 0.08);
  --gradient-primary: linear-gradient(135deg, var(--primary), var(--secondary));
}
```

**Confidence:** HIGH — verified against Tailwind CSS 4 official documentation on `@theme` and custom utilities.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Icon library | `lucide-react` | `@iconify/react` | Iconify fetches at runtime by default; offline bundle requires per-set packages; more complex setup for a fixed icon vocabulary |
| Icon library | `lucide-react` | `react-icons` | No tree-shaking at icon-set level; bundle includes entire sets |
| Variant system | `class-variance-authority` | `tailwind-variants` | `tailwind-variants` 0.3.x is Tailwind 4 native and slightly newer, but CVA 0.7.1 is stable and widely adopted; either is acceptable — CVA is the safer choice given its ecosystem maturity |
| Variant system | `class-variance-authority` | Manual ternary expressions | Ternaries scale poorly beyond 2–3 variants; CVA is the standard solution |
| Font delivery | `@fontsource-variable/noto-sans-jp` | Google Fonts CDN | Tauri desktop apps run offline; external CDN fonts fail silently without network |
| Font delivery | `@fontsource-variable/noto-sans-jp` | Bundled `.ttf` files in `public/` | Fontsource handles unicode-range subsetting and `@font-face` generation automatically; manual bundling requires maintaining these manually |
| Class merging | `tailwind-merge` | `classnames` | `classnames` has no awareness of Tailwind specificity conflicts — `tailwind-merge` resolves e.g. `p-4` vs `p-6` correctly |
| Particle effects | CSS motion.div orbs | `tsparticles` | 1.54 MB bundle + continuous canvas repaints at 60fps destroy Tauri WebView performance |
| Animation | `motion` (already installed) | `gsap` | Redundant runtime; `motion` already provides timeline, spring, scroll APIs |
| Custom titlebar | `data-tauri-drag-region` + CSS | `tauri-plugin-decorum` | The project's `decorations: false` is already set in `tauri.conf.json`; custom CSS titlebar with drag region is sufficient; decorum adds dependency without material benefit for this design direction |

---

## Installation Commands (Complete New Additions)

```bash
# Priority 1: Design system utilities
npm i lucide-react clsx tailwind-merge class-variance-authority

# Priority 2: Japanese typography (variable font)
npm i @fontsource-variable/noto-sans-jp @fontsource-variable/noto-serif-jp
```

**Total new production dependencies: 6 packages**
**Total new devDependencies: 0**
**Estimated bundle impact:** lucide-react (tree-shaken, ~2KB per icon × N used), clsx (0.24KB), tailwind-merge (3KB), cva (5KB), fonts (CJK variable fonts are large — ~500KB each for the full Unicode range; mitigate with Vite font subsetting or import only Latin+Japanese subsets explicitly).

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| lucide-react recommendation | HIGH | v1.7.0 confirmed current from web search; tree-shaking architecture verified from official docs |
| tailwind-merge v3 for Tailwind 4 | HIGH | Explicit v3 = Tailwind 4, v2 = Tailwind 3 confirmed from maintainer's own release notes and GitHub discussion |
| @fontsource-variable packages | HIGH | Fontsource is the established standard for self-hosted fonts; variable font NPM packages confirmed from npm registry |
| class-variance-authority | MEDIUM | v0.7.1 stable, last published ~1 year ago — no active development; functional for stated use case; `tailwind-variants` is an alternative if CVA shows staleness issues |
| CSS neon/glassmorphism techniques | HIGH | Pure CSS; verified against MDN, Tailwind docs, and multiple implementations |
| motion SVG path animation | HIGH | Verified from official motion.dev documentation |
| tsParticles avoidance | HIGH | Bundle size confirmed from bundlephobia; performance concern is established for WebView-based desktop apps |
| Noto Sans JP CJK font sizes | MEDIUM | CJK font files are known to be large; exact Vite subsetting behavior in Tauri needs validation during implementation |

---

## Sources

- [lucide-react npm — v1.7.0](https://www.npmjs.com/package/lucide-react) (2026-03-28)
- [Lucide official docs — React package](https://lucide.dev/guide/packages/lucide-react)
- [tailwind-merge GitHub releases](https://github.com/dcastil/tailwind-merge/releases) — v3.5.0 supports Tailwind 4.0–4.2
- [class-variance-authority — cva.style docs](https://cva.style/docs)
- [clsx GitHub — 239B utility](https://github.com/lukeed/clsx) — v2.1.1
- [@fontsource-variable/noto-sans-jp — npm](https://www.npmjs.com/package/@fontsource-variable/noto-sans-jp)
- [Fontsource docs — Vite/React install](https://fontsource.org/docs/getting-started/install)
- [Tailwind CSS 4 @theme — official docs](https://tailwindcss.com/docs/theme)
- [motion.dev — SVG animation docs](https://motion.dev/docs/react-svg-animation)
- [tsparticles npm — bundle sizes](https://www.npmjs.com/package/tsparticles) — 1.54 MB for full package
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) — drag region, no-decoration pattern
- [Dark Glassmorphism in 2026 — Medium](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Tailwind CSS 4 @theme design tokens guide](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)
