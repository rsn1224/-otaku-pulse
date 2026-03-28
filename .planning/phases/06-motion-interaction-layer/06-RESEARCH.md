# Phase 6: Motion & Interaction Layer — Research

**Researched:** 2026-03-28
**Domain:** motion/react v12.38.0, CSS micro-interactions, prefers-reduced-motion, retro CSS decoration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wing 遷移方向は Claude 裁量。ROADMAP「200ms fade-slide AnimatePresence transition; no snap-replace or layout flash」を満たすこと。
- **D-02:** Wing 遷移中スクロール位置リセット vs 復元は Claude 裁量。React.lazy re-mounts anyway。
- **D-03:** スタッガー演出スタイルは Claude 裁量。「~150ms intervals for first 10 visible items; items below fold load without animation」を満たすこと。
- **D-04:** 無限スクロール追加バッチへのスタッガー適用有無は Claude 裁量。
- **D-05:** レトロ装飾の適用範囲・密度は Claude 裁量。デコレーションバジェット遵守。「corner brackets, scan-line texture, dot grid visible on designated components; CSS ::before/::after only — no JavaScript」を満たすこと。
- **D-06:** レトロ装飾トーンは Claude 裁量。ダークテーマ・ネオングロー調和優先。
- **D-07:** ホバー深度フィードバック強度は Claude 裁量。「translateY(-2px) lift and shadow depth increase」を満たすこと。
- **D-08:** マイクロインタラクション種別は Claude 裁量。「bookmark and like actions trigger a visible micro-interaction keyframe」を満たすこと。
- **D-09:** 全モーションに `useMotionConfig` ガード適用（MOTN-06 要件）。既存 `motion-variants.ts` の `reduced` バリアントと `globals.css` の `@media (prefers-reduced-motion: reduce)` を組み合わせる。

### Claude's Discretion

全ディスカッション項目が Claude 裁量に委ねられた。制約：
- ROADMAP.md の 5 つの success criteria を全て満たすこと
- STATE.md のアニメーションバジェット（同時 1 エントランス、idle/ambient OFF by default、スタッガー先頭 10 のみ）
- STATE.md のデコレーションバジェット（1 animated + 1 gradient + 1 decorative icon per component max）
- 既存の motion-variants.ts / useMotionConfig パターンを拡張する形で実装

### Deferred Ideas (OUT OF SCOPE)

なし。
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOTN-01 | Wing 切り替え時に AnimatePresence トランジションを適用する | AnimatePresence + key={activeWing} pattern in AppShell.tsx §renderWing |
| MOTN-02 | フィードカードリストにスタッガーフェードイン（~150ms 間隔）を実装する | Extend staggerContainer.staggerChildren from 0.04 → 0.15 + index<10 guard in ArticleList.tsx |
| MOTN-03 | 平成/Y2K レトロ装飾（コーナーブラケット、スキャンライン、ドットグリッド）を CSS のみで実装する | Populate .retro-* empty classes in components.css via ::before/::after |
| MOTN-04 | ホバー深度フィードバック（translateY + shadow lift + glow）を全インタラクティブ要素に適用する | Unify discover-card hover + Card.tsx + Button.tsx neon glow; add transition spec |
| MOTN-05 | ブックマーク、いいね等のマイクロインタラクションアニメーションを実装する | Add bookmarkUnpop + likePop keyframes to animations.css; wire .just-bookmarked class |
| MOTN-06 | prefers-reduced-motion 完全対応（全モーションに useMotionConfig ガード適用） | useMotionConfig is defined but not yet used in any component — Phase 6 deploys it everywhere |
</phase_requirements>

---

## Summary

Phase 6 layers motion onto already-stable Phase 5 components. The codebase ships `motion/react` v12.38.0 (formerly framer-motion), a complete `motion-variants.ts` library, and a `useMotionConfig()` hook — but **none of these are wired into components yet** (only Toast, Modal, and DiscoverWing's ArticleReader panel use them). The entire motion system exists as infrastructure waiting to be activated.

The work breaks cleanly into five tracks: (1) Wing-level page transitions via `AnimatePresence` around `AppShell.tsx`'s `renderWing()`, (2) stagger tuning in `ArticleList.tsx` (staggerChildren: 0.04 → 0.15, index-guard to first 10), (3) CSS-only retro decoration by populating the three already-declared empty `.retro-*` classes in `components.css`, (4) hover depth standardisation across `discover-card`, `ui/Card`, and `ui/Button`, and (5) bookmark/like micro-interaction keyframes in `animations.css` plus the `useMotionConfig` guard rollout to every component that uses motion.

The `prefers-reduced-motion` CSS block (`@media (prefers-reduced-motion: reduce)`) already exists in `globals.css` and covers CSS animations. The JS side (`useMotionConfig`) needs to be imported and used in every component that calls `motion.div` with variants — this is the key deployment gap.

**Primary recommendation:** Treat this phase as infrastructure activation, not new feature building. Extend existing variants, populate existing CSS class stubs, and wire the already-built `useMotionConfig` guard everywhere motion is used.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion/react | 12.38.0 (installed) | AnimatePresence, motion.div, useReducedMotion | Already installed and in use (Toast, Modal, DiscoverWing) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS keyframes | — | bookmarkPop, shimmer, fadeSlideIn — in `animations.css` | Pure CSS actions where no JS state binding needed |
| Tailwind CSS v4 | 4.2.1 | hover: utility classes on Card + Button | Simple hover states with no JS |

### No New Packages Needed

All motion work uses existing installed dependencies. No new npm packages are required for Phase 6.

**Version verification (confirmed from installed node_modules):**
- `motion` package: 12.38.0 (confirmed via `node -e "require('./node_modules/motion/package.json').version"`)

---

## Architecture Patterns

### Recommended Project Structure for Phase 6 Changes

```
src/
├── lib/motion-variants.ts      # Add wingTransition, update staggerContainer.staggerChildren
├── hooks/useMotionConfig.ts    # UNCHANGED — deploy to consumers
├── styles/animations.css       # Add bookmarkUnpop, likePop keyframes
├── styles/components.css       # Populate .retro-decoration, .retro-corner-bracket, .retro-scanline
├── styles/globals.css          # prefers-reduced-motion block ALREADY EXISTS — no change
└── components/
    ├── layout/AppShell.tsx     # Add AnimatePresence + key={activeWing} around renderWing()
    ├── wings/ArticleList.tsx   # Add index<10 guard + update staggerChildren + useMotionConfig
    ├── discover/DiscoverCard.tsx  # Add hover depth transition + retro-corner-bracket class
    ├── ui/Card.tsx             # Standardise hover depth via CSS transition property
    └── ui/Button.tsx           # neon variant glow already present; add transition property
```

### Pattern 1: Wing Transition with AnimatePresence

**What:** Wrap `renderWing()` output in `AnimatePresence` + keyed `motion.div`. The key forces AnimatePresence to unmount/remount on wing change, triggering exit + enter animation.

**When to use:** Any conditional render where exit animation is needed.

**Critical detail from codebase:** `AppShell.tsx` already imports `motion` and `springTransition` (for the nav indicator). `AnimatePresence` is not yet imported. The `renderWing()` return value needs to be wrapped — not the entire `<main>` element — to avoid layout shifts.

```typescript
// Source: existing motion-variants.ts fadeSlideIn pattern + AnimatePresence from Toast.tsx
import { AnimatePresence, motion } from 'motion/react';

// In AppShell render:
<main id="main-content" className="flex-1 overflow-hidden">
  <React.Suspense fallback={<Spinner />}>
    <AnimatePresence mode="wait">
      <motion.div
        key={activeWing}
        variants={variants.fadeSlideIn}  // from useMotionConfig()
        initial="hidden"
        animate="visible"
        exit="exit"
        className="h-full"
      >
        {renderWing()}
      </motion.div>
    </AnimatePresence>
  </React.Suspense>
</main>
```

**`mode="wait"` is essential:** Without it, both wings animate simultaneously (outgoing exit + incoming enter). `mode="wait"` sequences them — exit completes before enter starts. This prevents the "snap-replace" the ROADMAP explicitly forbids.

**Existing `fadeSlideIn` variant already has the right values:**
- `hidden: { opacity: 0, y: 6 }` → entrance slides up 6px
- `exit: { opacity: 0, y: -4, transition: { duration: 0.15 } }` → faster exit

The UI-SPEC calls for `y: 8→0` entrance and `y: -4` exit. Update `fadeSlideIn` hidden `y` from 6 to 8 or create a named `wingTransition` variant — either works. Creating a separate `wingTransition` is cleaner to avoid affecting Toast/Modal which also use `fadeSlideIn`.

**React.Suspense interaction:** The Suspense fallback fires on first lazy-load of each Wing. Once loaded, Wings are cached by React's module registry — subsequent switches animate without the Suspense spinner. No conflict with AnimatePresence.

### Pattern 2: Stagger Reveal with Index Guard

**What:** Apply stagger variants to `ArticleList.tsx` with an `index < 10` guard so below-fold items never animate.

**Current state:** `ArticleList.tsx` already uses `staggerContainer` + `staggerItem` at lines 98–115. The `staggerChildren` value is 0.04 (40ms). The ROADMAP requires ~150ms. This is a one-line change to `motion-variants.ts`.

**Index guard pattern:**

```typescript
// Source: motion-variants.ts staggerItem + UI-SPEC MOTN-02
{filteredArticles.map((article, i) => (
  <motion.div
    key={article.id}
    variants={i < 10 ? variants.staggerItem : undefined}
    initial={i < 10 ? 'hidden' : false}
    animate={i < 10 ? 'visible' : undefined}
  >
    <DiscoverCard ... />
  </motion.div>
))}
```

**Alternative — simpler approach:** Only wrap first 10 items in `motion.div`, render the rest as plain `div`. Less JSX complexity, same visual result.

**Infinite scroll batches:** Items loaded via `loadMore()` should NOT stagger (UI-SPEC MOTN-02). Since `filteredArticles` grows in-place, new items arrive at index ≥ 10 and are naturally excluded by the index guard. No special handling needed.

**`useMotionConfig` integration:**

```typescript
const { variants } = useMotionConfig();
// Use variants.staggerContainer + variants.staggerItem
// Reduced motion: noStagger container + instant fade items (already in reduced map)
```

### Pattern 3: Retro CSS Decoration

**What:** Populate three empty CSS class stubs in `components.css` using `::before`/`::after` pseudo-elements. Zero JavaScript.

**Parent requirement:** Every element receiving a retro class must have `position: relative` set. Verify before adding classes.

**DiscoverCard (`discover-card` in `components.css`)** already has `position: relative` — confirmed at line 20.

**SectionHeader** uses Tailwind-only, no explicit `position: relative` class. Need to add `relative` to its wrapper `className`.

**EmptyState** uses `relative` in Tailwind — confirmed at line 53 of `EmptyState.tsx`.

```css
/* Source: UI-SPEC MOTN-03 visual spec */

/* Corner brackets — DiscoverCard poster mode, SectionHeader */
.retro-corner-bracket {
  position: relative; /* Ensure, even if parent has it */
}

.retro-corner-bracket::before,
.retro-corner-bracket::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: rgba(189, 147, 249, 0.4); /* --primary at 40% opacity */
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  z-index: 1;
}

.retro-corner-bracket::before {
  /* Top-left L-bracket */
  top: 6px;
  left: 6px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
}

.retro-corner-bracket::after {
  /* Bottom-right L-bracket */
  bottom: 6px;
  right: 6px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
}

/* Scanline overlay — DiscoverCard cover image area only */
.retro-scanline::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.08) 2px,
    rgba(0, 0, 0, 0.08) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* Dot grid — EmptyState background, SectionHeader bg */
.retro-decoration::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle,
    var(--primary-glow) 1px,
    transparent 1px
  );
  background-size: 16px 16px;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}
```

**Key constraint verified:** `--primary-glow` is `rgba(189, 147, 249, 0.06)` per `globals.css`. At 0.3 opacity on the dot grid pseudo-element, effective opacity = 0.018 — ambient, not dominant.

### Pattern 4: Hover Depth Feedback Unification

**Current state (confirmed from codebase):**
- `DiscoverCard` (`.discover-card:hover`): `transform: translateY(-2px) scale(1.01)` in `components.css` — ALREADY CORRECT but missing `transition` on the transform property. The transition is only on background/border/box-shadow.
- `ui/Card.tsx`: Tailwind `hover:-translate-y-0.5` (= -2px) — correct but no shadow depth change.
- `ui/Button.tsx` neon variant: `hover:shadow-[0_0_16px_var(--glow-primary)]` — no translateY.
- `SectionHeader`: no interactive hover state — correct (static element).

**Required changes:**
1. Add `transform 0.15s ease` to `.discover-card` transition (it currently lists background, border-color, box-shadow but not transform).
2. Add shadow depth to `ui/Card.tsx` hover: `hover:shadow-(--shadow-md)`.
3. Add `translateY(-1px)` to Button default hover: in the CVA variant definition.
4. Button neon variant: already has glow — add `hover:-translate-y-px` Tailwind class.

**Reduced motion:** The CSS `@media (prefers-reduced-motion: reduce)` block in `globals.css` already kills all CSS `transition-duration` to `0.01ms`. No additional CSS work needed for hover states.

### Pattern 5: Micro-interaction Keyframes

**What:** Add `bookmarkUnpop` and `likePop` keyframes to `animations.css`. Wire them to the bookmark toggle action in `CardHeader.tsx`.

**Existing infrastructure:**
- `bookmarkPop` keyframe: `0% scale(1)` → `50% scale(1.3)` → `100% scale(1)` already in `animations.css`.
- `.bookmark-btn.just-bookmarked svg { animation: bookmarkPop 0.3s ease }` already in `components.css` (line 188–190).
- **Gap:** The `just-bookmarked` CSS class is defined but **never applied in JSX**. `CardHeader.tsx` has no class toggling logic. This needs to be added.

**Implementation approach for `just-bookmarked` class toggling:**

```typescript
// In CardHeader.tsx (or DiscoverCard.tsx's handleBookmark)
const [bookmarkAnimating, setBookmarkAnimating] = useState(false);

const handleBookmarkWithAnimation = useCallback(() => {
  onBookmark();
  setBookmarkAnimating(true);
  // Remove class after animation duration (300ms for bookmarkPop)
  setTimeout(() => setBookmarkAnimating(false), 350);
}, [onBookmark]);

// In JSX:
<button
  className={cn('bookmark-btn', bookmarkAnimating && 'just-bookmarked')}
  onClick={handleBookmarkWithAnimation}
/>
```

**New keyframes to add:**

```css
/* Source: UI-SPEC MOTN-05 */
@keyframes bookmarkUnpop {
  0% { transform: scale(1); }
  40% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes likePop {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
```

**`useMotionConfig` interaction:** CSS keyframes are not controlled by motion/react. They are gated by the existing `@media (prefers-reduced-motion: reduce)` CSS block in `globals.css`, which already sets `animation-duration: 0.01ms !important`. No JS change needed.

### Pattern 6: `useMotionConfig` Rollout

**Current gap (confirmed):** `useMotionConfig` is defined in `src/hooks/useMotionConfig.ts` but appears in zero component files. The existing motion usage in `ArticleList.tsx` directly imports `staggerContainer`/`staggerItem` from `motion-variants.ts` without the reduced-motion guard.

**Components that need `useMotionConfig` wired in:**

| Component | Current motion usage | Required change |
|-----------|---------------------|-----------------|
| `AppShell.tsx` | `motion.span` (nav indicator, uses `springTransition`) | Add `useMotionConfig()`, use `variants.fadeSlideIn` for wing transition |
| `ArticleList.tsx` | `motion.div` with hard-coded `staggerContainer`/`staggerItem` | Replace with `variants.staggerContainer`/`variants.staggerItem` from `useMotionConfig()` |
| `Toast.tsx` | `motion.div` with hard-coded `toastSlideIn` | Replace with `variants.toastSlideIn` |
| `Modal.tsx` | `motion.div` with hard-coded `modalOverlay`/`modalContent` | Replace with `variants.modalOverlay`/`variants.modalContent` |

**`useMotionConfig` return type gap:** The hook returns `{ variants: MotionPresets; spring: typeof springTransition }`. `MotionPresets` is typed as `typeof full` which includes only the variants in the `full` object. When adding new variants (e.g., `wingTransition`), both `full` and `reduced` maps must be updated, and the `MotionPresets` type infers automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exit animation on Wing unmount | Custom CSS class swap on unmount | `AnimatePresence mode="wait"` | React unmounts synchronously; CSS classes are removed before animation plays |
| Detecting prefers-reduced-motion in JS | `window.matchMedia` listener | `useReducedMotion()` from motion/react | Already handles SSR, listener cleanup, and dynamic updates |
| Stagger delay calculation | Manual `animationDelay` style prop per item | `staggerChildren` in Framer/motion variants | `staggerChildren` handles ordering correctly even when items re-render |
| Keyframe animation with React state | Animating properties directly on mount/unmount | CSS `@keyframes` + class toggle | Simpler for one-shot actions; no spring physics needed for pop |
| Retro decoration images | SVG elements in JSX or img tags | CSS `::before`/`::after` with gradients | Zero JS, no DOM nodes, GPU-composited, fits decoration budget |

**Key insight:** Motion/react's `AnimatePresence` solves the hardest problem in exit animation — React unmounts children immediately, but `AnimatePresence` defers the DOM removal until the exit animation completes. Any custom approach requires intercepting the React tree, which is fragile.

---

## Common Pitfalls

### Pitfall 1: AnimatePresence Without `mode="wait"` Causes Overlap

**What goes wrong:** Without `mode="wait"`, the outgoing Wing and incoming Wing animate simultaneously. The outgoing Wing's exit (`opacity → 0, y → -4`) overlaps with the incoming Wing's entrance (`opacity → 1, y → 0`). This looks broken on a constrained viewport.

**Why it happens:** Default `AnimatePresence` mode (`sync`) runs all animations in parallel. Only `mode="wait"` sequences them.

**How to avoid:** Always use `mode="wait"` for page/view transitions where only one view should be visible.

**Warning signs:** During Wing switch, both Wings are briefly visible overlapping each other.

---

### Pitfall 2: `key` Prop Mismatch Means AnimatePresence Doesn't Detect Wing Change

**What goes wrong:** If `key` is missing or constant on the `motion.div` inside `AnimatePresence`, React reuses the same DOM node on Wing switch. AnimatePresence never sees a mount/unmount — the new Wing appears instantly with no animation.

**Why it happens:** React's reconciliation compares keys. Without a changing key, the component is updated (props change) not remounted.

**How to avoid:** Use `key={activeWing}` on the direct child of `AnimatePresence`.

**Warning signs:** Wing switch works (content changes) but no fade animation plays.

---

### Pitfall 3: React.Suspense Fallback Conflicts With AnimatePresence

**What goes wrong:** When a lazy-loaded Wing loads for the first time, Suspense replaces the `motion.div` with the fallback spinner. This can cause AnimatePresence to animate out the spinner and animate in the wing content after it loads, producing a double-animation flash.

**Why it happens:** Suspense's fallback replaces children, which AnimatePresence interprets as an unmount/remount.

**How to avoid:** Place `React.Suspense` as the parent of `AnimatePresence`, not inside it. The Suspense boundary should wrap the entire `AnimatePresence` block.

**Warning signs:** First-ever Wing load shows spinner → flash → Wing content with duplicate entrance animation.

**Correct nesting:**
```jsx
<React.Suspense fallback={<Spinner />}>
  <AnimatePresence mode="wait">
    <motion.div key={activeWing} ...>
      {renderWing()}
    </motion.div>
  </AnimatePresence>
</React.Suspense>
```

---

### Pitfall 4: CSS `::before`/`::after` Without `position: relative` on Parent

**What goes wrong:** Retro decoration pseudo-elements use `position: absolute`. Without `position: relative` on the parent, they position relative to the nearest positioned ancestor — potentially the viewport — and appear in the wrong location.

**Why it happens:** `position: absolute` escapes the normal flow until it finds a positioned ancestor.

**How to avoid:** Verify `position: relative` on every element that receives a `.retro-*` class before adding it.

**Affected components and status:**
- `.discover-card`: has `position: relative` — SAFE
- `EmptyState` wrapper div: has Tailwind `relative` class — SAFE
- `SectionHeader` outer div: NO explicit position set — must add `relative` Tailwind class

---

### Pitfall 5: Stagger Over the Entire `filteredArticles` Array Causes Jank

**What goes wrong:** Without the `index < 10` guard, all articles animate. On a fast machine with 200 articles, this means article #200 starts its entrance animation 200 × 0.15s = 30 seconds after mount. The list appears frozen. On a slow machine, this triggers hundreds of simultaneous RAF callbacks.

**Why it happens:** `staggerChildren` applies to every child of the container variant, regardless of scroll position.

**How to avoid:** Use `index < 10` guard to apply motion variants only to the first 10 items. Items 11+ render at full opacity instantly.

---

### Pitfall 6: `just-bookmarked` Class Never Removed

**What goes wrong:** If the `setTimeout` to remove the `just-bookmarked` class is not properly cleaned up on component unmount, it fires after unmount and attempts to call `setState` on a dead component. In React 18 this is a no-op but generates a warning.

**Why it happens:** `setTimeout` callbacks are unaffected by component unmount.

**How to avoid:** Use `useRef` to track the timeout and clear it in a cleanup function, or use `useEffect` cleanup.

---

### Pitfall 7: Spring Transitions Bypass CSS `prefers-reduced-motion`

**What goes wrong:** CSS `@media (prefers-reduced-motion: reduce)` only affects CSS animations and transitions. motion/react spring animations are computed in JavaScript and applied via inline `style` updates — they are completely invisible to CSS media queries. A user with reduced motion set sees full spring animations unless the JS layer explicitly handles it.

**Why it happens:** This is the fundamental reason `useMotionConfig` exists in this project. The hook wraps `useReducedMotion()` from motion/react, which reads the OS preference via `window.matchMedia`.

**How to avoid:** Every component using `motion.div` with variants MUST call `useMotionConfig()` and use `variants.X` from its return value, not the raw exports from `motion-variants.ts`.

---

## Code Examples

### Wing Transition (MOTN-01) — AppShell.tsx change

```typescript
// Source: motion-variants.ts existing fadeSlideIn + AppShell.tsx existing structure
// Add to existing imports in AppShell.tsx:
import { AnimatePresence, motion } from 'motion/react';
import { useMotionConfig } from '../../hooks/useMotionConfig';

// Inside AppShell() component body (before return):
const { variants, spring } = useMotionConfig();

// Replace the <React.Suspense> block in the return:
<React.Suspense fallback={<div className="flex items-center justify-center h-full bg-(--surface)"><Spinner /></div>}>
  <AnimatePresence mode="wait">
    <motion.div
      key={activeWing}
      variants={variants.fadeSlideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={spring}
      className="h-full"
    >
      {renderWing()}
    </motion.div>
  </AnimatePresence>
</React.Suspense>
```

Note: `transition={spring}` is overridden by per-variant transitions in `fadeSlideIn` — the visible state uses spring stiffness 300/damping 25, the exit uses `duration: 0.15`. The `spring` prop only serves as a fallback default.

### Stagger Guard (MOTN-02) — ArticleList.tsx change

```typescript
// Source: existing ArticleList.tsx motion.div at lines 98-115

// Step 1: import useMotionConfig instead of raw variants
import { useMotionConfig } from '../../hooks/useMotionConfig';
// Remove: import { staggerContainer, staggerItem } from '../../lib/motion-variants';

// Step 2: in component body:
const { variants } = useMotionConfig();

// Step 3: update the motion.div block:
<motion.div
  className="card-grid"
  role="feed"
  aria-label="Article feed"
  variants={variants.staggerContainer}
  initial="hidden"
  animate="visible"
>
  {filteredArticles.map((article, i) => (
    <motion.div
      key={article.id}
      variants={i < 10 ? variants.staggerItem : undefined}
      initial={i < 10 ? 'hidden' : false}
      animate={i < 10 ? 'visible' : undefined}
    >
      <DiscoverCard ... />
    </motion.div>
  ))}
</motion.div>
```

### motion-variants.ts — staggerChildren update

```typescript
// Source: motion-variants.ts line 66 — change staggerChildren from 0.04 to 0.15
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,  // was 0.04 — UI-SPEC requires ~150ms
    },
  },
};
```

### animations.css — new keyframes

```css
/* Source: UI-SPEC MOTN-05 */
@keyframes bookmarkUnpop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes likePop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}
```

### components.css — retro class population

```css
/* Source: UI-SPEC MOTN-03 */

.retro-corner-bracket::before,
.retro-corner-bracket::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: rgba(189, 147, 249, 0.4);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  z-index: 1;
}
.retro-corner-bracket::before {
  top: 6px; left: 6px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
}
.retro-corner-bracket::after {
  bottom: 6px; right: 6px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
}

.retro-scanline::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent, transparent 2px,
    rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px
  );
  pointer-events: none;
  z-index: 1;
}

.retro-decoration::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, var(--primary-glow) 1px, transparent 1px);
  background-size: 16px 16px;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}
```

### globals.css — prefers-reduced-motion (ALREADY EXISTS — no change needed)

```css
/* Source: src/styles/globals.css lines 107-116 — ALREADY IMPLEMENTED */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Critical Pre-existing Code Gaps

These are gaps discovered during codebase research that the plan MUST address:

### Gap 1: `useMotionConfig` Not Used Anywhere

**Location:** `src/hooks/useMotionConfig.ts` exists and is correct, but no component imports or uses it.

**Affected components using raw variant imports:**
- `src/components/wings/ArticleList.tsx` (lines 4, 104, 107) — imports `staggerContainer`, `staggerItem` directly
- `src/components/common/Toast.tsx` (line 5) — imports `toastSlideIn` directly
- `src/components/ui/Modal.tsx` (line 7) — imports `modalContent`, `modalOverlay` directly
- `src/components/layout/AppShell.tsx` (line 9) — imports `springTransition` directly

**Scope decision for Phase 6:** The UI-SPEC and CONTEXT.md require `useMotionConfig` guard on all motion. Phase 6 should wire it in ALL four components above, not just the new Wing transition. Toast and Modal are pre-existing gaps but fixing them is in scope as MOTN-06 requires "全モーション."

### Gap 2: `just-bookmarked` CSS Class Never Applied

**Location:** `.bookmark-btn.just-bookmarked svg { animation: bookmarkPop 0.3s ease }` is defined in `components.css` (line 188–190), but `CardHeader.tsx` has no state or logic that ever adds `just-bookmarked` to the className.

**Required addition:** Transient state (`useState<boolean>`) in `CardHeader.tsx` (or lifted to `DiscoverCard.tsx`'s `handleBookmark`) that adds then removes the class after 350ms.

### Gap 3: DiscoverCard `.discover-card` Hover Missing Transform Transition

**Location:** `src/styles/components.css` line 22-32: `.discover-card { transition: background 0.2s, border-color 0.2s, box-shadow 0.25s }` — no `transform` in transition list.

**Result:** The `transform: translateY(-2px) scale(1.01)` on hover (line 37) snaps instantly with no easing.

**Fix:** Add `transform 0.15s ease` to the transition declaration.

### Gap 4: `SectionHeader` Missing `position: relative` for Retro Classes

**Location:** `src/components/common/SectionHeader.tsx` line 29-35. The outer `div` uses only Tailwind layout classes (`border-l-4 pl-3`) with no `relative` class.

**Result:** Adding `.retro-corner-bracket` or `.retro-decoration` will cause pseudo-elements to escape the component's bounds.

**Fix:** Add `relative` to the `SectionHeader` outer div `cn()` call, or add `position: relative` to the component's CSS if it gets a CSS class.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package name | `motion/react` import path | framer-motion v11+ | Import path changed; existing code in this project already uses `motion/react` correctly |
| `useAnimation()` hook for imperative control | `useAnimate()` or variants | Framer Motion v10 | `useAnimation` still works but variants + AnimatePresence is the declarative standard |
| `AnimatePresence exitBeforeEnter` prop | `AnimatePresence mode="wait"` | framer-motion v7 | Old prop name deprecated; `mode="wait"` is the current API |
| `initial={false}` to disable mount animation | `initial="hidden"` with variant | — | `initial={false}` skips the initial animation entirely (useful for hydration); for stagger, use variant |

**Deprecated/outdated:**
- `exitBeforeEnter` prop on AnimatePresence: replaced by `mode="wait"` since framer-motion v7. The installed v12.38.0 uses `mode`.
- `useViewportScroll`: replaced by `useScroll` in newer framer-motion. Not applicable to this phase.

---

## Open Questions

1. **Wing transition `y` delta — 6px vs 8px**
   - What we know: Existing `fadeSlideIn.hidden.y = 6`. UI-SPEC says `y: 8→0` for Wing entrance.
   - What's unclear: Whether to update `fadeSlideIn` (affects Toast/Modal which also use it) or create a separate `wingTransition` variant.
   - Recommendation: Create `wingTransition` variant in `motion-variants.ts` with `y: 8`. Keep `fadeSlideIn` at `y: 6` for backward compatibility. Add `wingTransition` to both `full` and `reduced` maps in `motion-variants.ts` and update `MotionPresets` type via inference.

2. **Toast and Modal — `useMotionConfig` scope**
   - What we know: MOTN-06 says "全モーションに useMotionConfig ガード適用". Toast and Modal use raw variants.
   - What's unclear: Are Toast/Modal in scope for Phase 6 changes or deferred to Phase 7?
   - Recommendation: Include them in Phase 6. They are simple one-line changes (swap hardcoded import for `variants.X`) and MOTN-06 is explicit.

3. **`just-bookmarked` class placement — CardHeader vs DiscoverCard**
   - What we know: `toggleBookmark` is called via `handleBookmark` in `DiscoverCard.tsx`. `CardHeader.tsx` receives `onBookmark` callback and renders the button.
   - What's unclear: Whether the animation state should live in `CardHeader` (self-contained) or `DiscoverCard` (has bookmark state access).
   - Recommendation: Add `bookmarkAnimating` state in `DiscoverCard.tsx`'s `handleBookmark` and pass the animated class down to `CardHeader` via a prop (or pass the full `className` to the bookmark button). This keeps `CardHeader` as a pure presentational component.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely CSS and TypeScript changes. No external tools, databases, CLIs, or services are required beyond the existing project dev stack (`npm run dev`, `npm run check`, `npm run typecheck`).

---

## Validation Architecture

`nyquist_validation` is explicitly set to `false` in `.planning/config.json`. Section skipped per instructions.

---

## Project Constraints (from CLAUDE.md)

These directives from `CLAUDE.md` are binding for Phase 6 implementation:

| Directive | Applies To Phase 6 |
|-----------|-------------------|
| `any` 型禁止 | TypeScript changes in AppShell, ArticleList, CardHeader |
| `console.log` 禁止 → pino | Any debug logging during implementation |
| インラインスタイル禁止 → Tailwind CSS のみ | Hover state additions — use Tailwind classes or CSS classes only |
| `React.FC` 禁止 | Any new component additions (none expected) |
| named export のみ | Any new exports from motion-variants.ts |
| Biome フォーマット: `npx biome check --apply .` | Must pass before completion |
| TypeScript: `npm run typecheck` must pass | Must pass before completion |
| デザインシステム: CSS 変数ベース、HEX 値禁止 | CSS additions in components.css must use `var(--*)` tokens, not hardcoded HEX |
| ファイル 300 行以下原則 | `motion-variants.ts` is 128 lines — safe to add ~20 more lines |

**One known exception:** The CSS `prefers-reduced-motion` block in `globals.css` uses `!important` — this is explicitly permitted per `design.md` (confirmed in UI-SPEC MOTN-06 note).

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read: `src/lib/motion-variants.ts` — all existing variant definitions confirmed
- Codebase direct read: `src/hooks/useMotionConfig.ts` — hook implementation and usage gap confirmed
- Codebase direct read: `src/styles/animations.css` — existing keyframes confirmed
- Codebase direct read: `src/styles/components.css` — retro class stubs confirmed, hover transition gap confirmed
- Codebase direct read: `src/styles/globals.css` — prefers-reduced-motion block confirmed as already implemented
- Codebase direct read: `src/components/layout/AppShell.tsx` — renderWing() pattern confirmed, AnimatePresence absent confirmed
- Codebase direct read: `src/components/wings/ArticleList.tsx` — staggerChildren: 0.04 confirmed, raw import usage confirmed
- Codebase direct read: `src/components/discover/CardHeader.tsx` — just-bookmarked wiring gap confirmed
- Codebase direct read: `src/components/common/EmptyState.tsx` — retro class pre-applied confirmed
- Codebase direct read: `src/components/common/SectionHeader.tsx` — missing `position: relative` confirmed
- npm package: `motion` version 12.38.0 — confirmed via node_modules
- `.planning/phases/06-motion-interaction-layer/06-CONTEXT.md` — all decisions
- `.planning/phases/06-motion-interaction-layer/06-UI-SPEC.md` — visual + motion contract

### Secondary (MEDIUM confidence)

- motion/react v12 changelog and API: `AnimatePresence mode="wait"` replaced `exitBeforeEnter` — confirmed by tracking package naming history; `useReducedMotion` confirmed as exported from `motion/react` in installed package
- CSS `prefers-reduced-motion` universal selector pattern: widely documented W3C / MDN pattern; matches what is already in `globals.css`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — motion package installed, versions confirmed from node_modules
- Architecture patterns: HIGH — all patterns derived from direct codebase reads
- Pitfalls: HIGH — pitfalls derived from codebase gaps confirmed by grep/read, not speculation
- CSS retro decoration: HIGH — all CSS values from UI-SPEC + design tokens from globals.css

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable — motion/react v12 API is stable; no fast-moving dependencies)
