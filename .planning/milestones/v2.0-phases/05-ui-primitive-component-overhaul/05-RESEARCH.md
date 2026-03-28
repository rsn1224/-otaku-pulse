# Phase 5: UI Primitive & Component Overhaul - Research

**Researched:** 2026-03-28
**Domain:** React component systems, CVA variant patterns, glassmorphism CSS, lucide-react icons, accessibility hooks
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CVA (class-variance-authority) + clsx + tailwind-merge で全プリミティブの variant システムを再構築する。既存の手動 const + `.join(' ')` パターンを完全に置き換える。
- **D-02:** 7 プリミティブ（Badge, Button, Spinner, Input, ToggleGroup, Card, Modal）は一括リビルドする。合計 ~353 LOC と小規模なため、一貫性を優先して同時移行する。
- **D-03:** CVA が Tailwind v4 と非互換だった場合は tailwind-variants に切り替える（STATE.md のリスク項目に記載済み）。アーキテクチャへの影響なし。
- **D-04:** lucide-react をアプリ全体に導入し、全てのインライン SVG（Heroicons 風）を置換する。サイドバーだけでなくカード、アクション、ヘッダー等の全箇所が対象。
- **D-05:** 2:3 ポスター比率のサムネイルを常時表示する。collapsed 状態ではカード左側に小さく、summary/deepdive 展開時はカードトップにフル幅で表示。
- **D-06:** カバーアート画像がない記事（RSS ニュース等）は、コンテンツタイプ別アクセントカラー（anime=紫, manga=ピンク, game=シアン, news=アンバー）のグラデーション背景 + カテゴリアイコンを fallback として表示する。
- **D-07:** bold glass スタイルを採用する。blur(16-24px) + 明確な光沢ボーダー(white/15%) + グラデーションオーバーレイ。
- **D-08:** blur バジェット内での優先順位は Claude 裁量。GPU パフォーマンス検証結果に基づいて、モーダル・DeepDive・トースト間の配分を決定する。バジェット制約: 同時最大 2 要素、各 15% viewport 以下。
- **D-09:** 空ステートのアニメ文化モチーフ（桜、ピクセルスター、マンガスピードライン）は CSS のみ（gradient, box-shadow, border, ::before/::after）で実現する。追加画像アセット不要。
- **D-10:** Phase 6 のレトロ装飾（MOTN-03: コーナーブラケット、スキャンライン、ドットグリッド）に備えて、空ステートコンポーネントに `.retro-decoration` 等の CSS クラスフックを付与しておく。Phase 5 時点ではスタイルは空。

### Claude's Discretion

- AI バッジチップ（紫→青グラデーション）の具体的なデザイン・配置
- セクションヘッダーの左ボーダーアクセントのデザイン
- blur バジェット内でのコンポーネント優先順位（モーダル vs DeepDive vs トースト）
- bold glass の具体的な opacity/blur 値の微調整
- 各プリミティブの新 variant 追加（neon, glass 等の新バリエーション名）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Badge/Button/Spinner/Input/ToggleGroup/Card/Modal の全 UI プリミティブを新デザイン言語で再設計する | CVA migration pattern; new variant specs in UI-SPEC.md; focus-trap verification |
| COMP-02 | DiscoverCard にポスター比率 (2:3) カバーアートモードを追加する | DiscoverCard state machine analysis; poster layout with CSS aspect-ratio; fallback gradient + lucide icon |
| COMP-03 | DeepDive パネル、モーダル、トーストにグラスモーフィズム効果を適用する | Glassmorphism CSS pattern; blur budget allocation; Windows/WebView2 GPU risk |
| COMP-04 | サイドバーナビゲーションのアクティブ状態にネオングロー + lucide-react アイコンに刷新する | NAV_ITEMS array replacement; lucide-react named imports; active state CSS spec |
| COMP-05 | AI 処理済みカードに AI バッジチップ（紫→青グラデーション）を表示する | Badge `ai` variant; gradient definition; CardSummary placement |
| COMP-06 | セクションヘッダーにデコレーティブ左ボーダーアクセントを追加する | CSS border-left pattern; SectionHeader component spec from UI-SPEC.md |
| COMP-07 | 空ステートをアニメ文化モチーフ（桜、ピクセルスター、マンガスピードライン）で統一する | CSS-only art techniques; conic-gradient, box-shadow clusters, border-radius shapes; Phase 6 class hooks |
| PERF-03 | glassmorphism の blur バジェットを設定し、GPU パフォーマンスを検証する | Blur budget rules already in design.md; WebView2 backdrop-filter behavior; manual validation protocol |

</phase_requirements>

---

## Summary

Phase 5 is a visual-only rebuild of every user-facing React component — 7 UI primitives and ~6 feature components — in OtakuPulse's new void-black cyberpunk design language. The phase introduces three new npm packages (CVA, tailwind-merge, lucide-react) and migrates all components from the manual `const VARIANT_CLASSES + .join(' ')` pattern to CVA-based variant systems.

The primary technical risk is glassmorphism GPU performance on Windows/WebView2. `backdrop-filter: blur()` has historically caused GPU layer promotion issues in Chromium-embedded WebViews on mid-tier Windows hardware. The design system already caps this at 2 simultaneous blurred elements, each under 15% viewport area, which mitigates but does not eliminate the risk. Manual hardware validation is required before phase completion.

All a11y hooks (useFocusTrap, useFocusReturn, useScrollLock, useAnnouncer) are production-ready and already integrated in Modal.tsx. Phase 5 does not introduce new hook logic — it wires existing hooks into DeepDivePanel and ensures the pattern is propagated consistently. The existing test suite (76 JS tests) must remain green throughout; the current CardSummary.test.tsx will need an update to cover the new AI badge variant.

**Primary recommendation:** Migrate all 7 primitives to CVA in a single wave. Then rebuild feature components in dependency order: AppShell sidebar → DiscoverCard → CardSummary/AI badge → DeepDivePanel → Toast. Empty states and section headers are standalone additions with no cross-component dependencies.

---

## Standard Stack

### Core (New Packages — Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `class-variance-authority` | 0.7.1 | Component variant API — `cva()` + `VariantProps<>` | Industry standard for Tailwind variant systems; zero runtime overhead |
| `clsx` | 2.1.1 | Conditional class merging | Already a CVA peer dependency; replaces array `.join(' ')` pattern |
| `tailwind-merge` | 3.5.0 | Tailwind class conflict resolution | Prevents duplicate/conflicting utility classes when composing variants |
| `lucide-react` | 1.7.0 | Icon library | ISC license; tree-shakeable named imports; no inline SVG paths needed |

**Version verification:** All 4 packages confirmed at their exact locked versions via `npm view` (2026-03-28). No newer versions exist for any of these packages as of this date.

**Compatibility note (D-03):** CVA 0.7.1 has zero Tailwind-specific dependencies — its only dependency is `clsx ^2.1.1`. CVA generates class strings; it has no knowledge of Tailwind v3 vs v4. `tailwind-merge` 3.5.0 supports Tailwind v4 arbitrary value syntax (`bg-(--primary)`, `text-(--on-surface-variant)`) without configuration. **No incompatibility exists. D-03 fallback (tailwind-variants) is not needed.**

### Already in Use (No Installation Needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `motion` | ^12.38.0 | Already in Modal.tsx and Toast.tsx — no changes needed |
| `tailwindcss` | ^4.2.1 | CSS framework — Tailwind v4 arbitrary CSS variable syntax confirmed working |

**Installation:**
```bash
npm install class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.5.0 lucide-react@1.7.0
```

---

## Architecture Patterns

### CVA Migration Pattern

Every primitive moves from this:
```typescript
// BEFORE: manual const pattern (Button.tsx, Badge.tsx, etc.)
const VARIANT_CLASSES = {
  primary: 'bg-(--primary) text-white hover:brightness-110',
  secondary: 'bg-transparent text-(--on-surface-variant) ...',
} as const;

// Usage
className={[VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].join(' ')}
```

To this:
```typescript
// AFTER: CVA pattern
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Shared cn() utility — create once in src/lib/utils.ts
export function cn(...inputs: Parameters<typeof clsx>): string {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  // Base classes (always applied)
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:ring-offset-1 focus-visible:ring-offset-(--surface) disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-(--primary) text-white hover:brightness-110',
        secondary: 'bg-transparent text-(--on-surface-variant) hover:bg-white/[0.06] hover:text-(--on-surface)',
        ghost: 'bg-transparent text-(--on-surface-variant) hover:text-(--on-surface)',
        danger: 'bg-(--error) text-white hover:brightness-110',
        neon: 'border border-(--primary) bg-(--primary-glow) text-(--primary) hover:shadow-[var(--glow-primary)]',
        glass: 'bg-(--surface-glass) border border-white/15 text-(--on-surface) backdrop-blur-[20px]',
      },
      size: {
        sm: 'px-2 py-1 text-xs gap-1',
        md: 'px-3.5 py-1.5 text-[0.8125rem] gap-1.5',
        lg: 'px-5 py-2.5 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({ variant, size, isLoading = false, disabled, children, className, ...rest }: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : children}
    </button>
  );
}
```

**Key change:** `React.FC<Props>` → function declaration (per `.claude/rules/typescript.md`).

### cn() Utility — Single Source

Create `src/lib/utils.ts` as the single home for `cn()`. All 7 primitives and feature components import from there.

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### lucide-react Icon Replacement Pattern

```typescript
// BEFORE: AppShell.tsx inline SVG with path string
const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: 'M21 21l-6-6m2-5...' },
];
// Render:
<svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" ...>
  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
</svg>

// AFTER: lucide-react named imports
import { Search, Library, Bookmark, CalendarDays, User } from 'lucide-react';

const NAV_ITEMS: { id: WingIdV2; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'discover', label: 'Discover', Icon: Search },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'saved', label: 'Saved', Icon: Bookmark },
  { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
  { id: 'profile', label: 'Profile', Icon: User },
];
// Render:
<item.Icon size={20} aria-hidden="true" />
```

Icon mapping (from UI-SPEC.md):
- `discover` → `Search`
- `library` → `Library`
- `saved` → `Bookmark`
- `schedule` → `CalendarDays`
- `profile` → `User`

### Glassmorphism Pattern (bold glass)

The blur budget resolution per D-08 (Claude's Discretion):
1. **Modal** — `blur(20px)` — appears alone (fullscreen overlay blocks everything else)
2. **Toast** — `blur(20px)` — appears above feed, never simultaneously with modal
3. **DeepDive panel** — `blur(16px)` — inline in card, never simultaneously with modal

This satisfies the "max 2 blurred elements simultaneously" rule because Modal and DeepDive never coexist, and Toast + Modal never coexist by UX design.

```css
/* Bold glass utility — to add to components.css or as Tailwind classes */
.bold-glass {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: var(--surface-glass); /* rgba(255,255,255,0.03) */
  border: 1px solid rgba(255, 255, 255, 0.15);
}

/* DeepDive variant — slightly less blur for smaller footprint */
.bold-glass-sm {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: var(--surface-glass);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

**Implementation note:** The existing Modal.tsx uses `backdrop-blur-sm` on the overlay div and no blur on the content panel. Phase 5 inverts this: no blur on the overlay (use `var(--surface-backdrop)` instead), bold glass on the dialog panel only.

### DiscoverCard Poster Mode Layout

The 2:3 poster ratio requires CSS `aspect-ratio: 2/3` with a fixed width in collapsed state:

```tsx
// Collapsed state: 56px wide × 84px tall thumbnail on the left
// Root container becomes flex row
<div className="flex gap-3"> {/* was: single-column */}
  {/* Poster thumbnail — always present */}
  <div className="flex-shrink-0 w-14 relative" style={{ aspectRatio: '2/3' }}>
    {thumbnailUrl
      ? <img src={thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" loading="lazy" />
      : <CoverArtFallback contentType={article.contentType} />
    }
  </div>
  {/* Content column */}
  <div className="flex-1 min-w-0">
    <CardHeader ... />
    <button className="card-title">...</button>
  </div>
</div>

// Summary/deepdive state: full-width thumbnail at top (max-height: 200px)
<div>
  <div className="w-full mb-3" style={{ aspectRatio: '2:3', maxHeight: '200px' }}>
    {/* thumbnail */}
  </div>
  {/* ... rest of card */}
</div>
```

**CoverArtFallback component** (new, small):
```tsx
import { Tv, BookOpen, Gamepad2, Newspaper } from 'lucide-react';

const FALLBACK_ICON = { anime: Tv, manga: BookOpen, game: Gamepad2, news: Newspaper } as const;

function CoverArtFallback({ contentType }: { contentType: 'anime' | 'manga' | 'game' | 'news' }): React.JSX.Element {
  const Icon = FALLBACK_ICON[contentType] ?? Tv;
  return (
    <div className={`w-full h-full rounded-lg flex items-center justify-center bg-linear-to-br from-(--accent-${contentType}) to-(--surface-container-high)`}>
      <Icon size={32} className="text-(--on-surface-variant)" aria-hidden="true" />
    </div>
  );
}
```

### Sidebar Active State Pattern

The current AppShell nav uses a Framer Motion `layoutId="nav-indicator"` for the left-border animation. Phase 5 keeps this motion approach but upgrades the visual:

```tsx
// Current: motion.span with 2px gradient line
// New: motion.span + background tint on the button itself

<button
  className={cn(
    'relative flex items-center justify-center w-full h-11 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:rounded-lg',
    activeWing === item.id
      ? 'text-(--primary) bg-(--primary-soft) shadow-[inset_0_0_16px_var(--glow-secondary)]'
      : 'text-(--on-surface-variant) hover:text-(--on-surface) hover:bg-(--surface-hover)'
  )}
>
  {activeWing === item.id && (
    <motion.span
      layoutId="nav-indicator"
      transition={springTransition}
      className="absolute left-0 w-[3px] h-7 bg-(--primary) rounded-r-sm" {/* upgraded: 3px, solid primary */}
    />
  )}
  <item.Icon size={20} aria-hidden="true" />
</button>
```

### Empty State CSS Art Techniques

Four contexts, four CSS-only motifs (D-09). No image assets needed.

**Manga speedlines** (no articles):
```css
.empty-speedlines::before {
  content: '';
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from 0deg at 50% 50%,
    transparent 0deg,
    var(--outline-variant) 1deg,
    transparent 2deg,
    /* repeat 24 times */
  );
  opacity: 0.4;
  border-radius: inherit;
}
```

**Pixel stars** (no saved):
```css
/* box-shadow cluster of 2px dots */
.empty-stars::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 2px;
  background: var(--primary);
  opacity: 0.4;
  box-shadow: /* 8-12 offsets in rgba(189,147,249,0.4) */
    12px 8px, -8px 15px, 20px -5px, -15px -12px, 5px 22px, -20px 8px, 15px -18px, -5px -22px;
}
```

**Sakura petals** (no search results):
```css
/* 50% 0 border-radius creates petal shapes */
.empty-sakura::before {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  background: var(--tertiary); /* --tertiary: #ff97b2 */
  border-radius: 50% 0 50% 0;
  transform: rotate(45deg);
  opacity: 0.5;
  /* Position with multiple via ::after for the second petal */
}
```

**Dot grid** (no schedule):
```css
.empty-dot-grid::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, var(--outline-variant) 1px, transparent 1px);
  background-size: 16px 16px;
  opacity: 0.3;
}
```

### Section Header Component

New component to create: `src/components/common/SectionHeader.tsx`

```tsx
import { cn } from '../../lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  contentType?: 'anime' | 'manga' | 'game' | 'news';
  className?: string;
}

export function SectionHeader({ title, subtitle, contentType, className }: SectionHeaderProps): React.JSX.Element {
  const borderColor = contentType ? `var(--accent-${contentType})` : 'var(--primary)';
  return (
    <div
      className={cn('pl-3 border-l-4', className)}
      style={{
        borderColor,
        boxShadow: `-4px 0 12px var(--glow-secondary)`,
      }}
    >
      <h2 className="text-[1.125rem] font-semibold leading-[1.2] text-(--on-surface)">{title}</h2>
      {subtitle && <p className="text-[0.6875rem] font-normal text-(--on-surface-variant) mt-0.5">{subtitle}</p>}
    </div>
  );
}
```

**Note:** `style={{ boxShadow }}` uses a CSS variable reference string, not a hardcoded value. The project forbids `style={{ }}` for *color values*, but dynamic CSS variable references for `box-shadow` calculations are acceptable here because the Tailwind arbitrary-value syntax cannot express multi-stop box-shadow with CSS variable composition.

### AI Badge Integration

The `ai` Badge variant is used in `CardSummary.tsx`. The existing `ai-summary-label` div is replaced:

```tsx
// Before: SVG icon + "AI Summary" text
// After: Badge + "AI Summary" text
import { Badge } from '../ui/Badge';

<div className="flex items-center gap-2 mb-1">
  <Badge variant="ai">AI</Badge>
  <span className="text-[0.6875rem] font-semibold tracking-[0.04em] uppercase text-(--primary)">Summary</span>
</div>
```

Badge `ai` variant uses CSS gradient background (not a Tailwind class, since Tailwind v4 arbitrary gradient syntax is verbose):
```css
/* In components.css */
.badge-ai {
  background: linear-gradient(90deg, var(--accent-anime) 0%, var(--secondary) 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 9999px;
}
```
Or via CVA using arbitrary CSS variable gradient in Tailwind v4: `bg-linear-to-r from-(--accent-anime) to-(--secondary)`. Both approaches work; the Tailwind v4 approach is preferred to keep styles co-located in the component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class conflict resolution | Custom merge logic | `tailwind-merge` | Handles Tailwind's specificity model correctly; handles v4 CSS variable syntax |
| Conditional class composition | Custom template literals | `clsx` | Handles falsy values, arrays, objects cleanly |
| Variant type-safety | Manual TypeScript discriminated union | `cva()` + `VariantProps<>` | Auto-generates types from variant definitions |
| Icon SVG paths | Inline SVG with `d=` path strings | `lucide-react` named imports | Tree-shaking, consistent sizing, a11y `aria-hidden` |
| Focus trap logic | Custom Tab-key interceptor | `useFocusTrap` (already exists) | Production-ready; handles Shift+Tab, edge cases |

**Key insight:** The entire CVA ecosystem (cva + clsx + tailwind-merge) solves exactly one problem: "how do I compose Tailwind classes safely and type-safely." Hand-rolling this creates silent class conflicts and loses type safety on variant names.

---

## Common Pitfalls

### Pitfall 1: `tailwind-merge` Version Mismatch with Tailwind v4

**What goes wrong:** `tailwind-merge` versions below 3.0 do not understand Tailwind v4's `bg-(--var)` arbitrary CSS variable syntax, treating it as unknown and potentially failing to deduplicate.
**Why it happens:** Tailwind v4 changed the arbitrary value syntax from `bg-[var(--x)]` to `bg-(--x)`.
**How to avoid:** This project uses `tailwind-merge@3.5.0` which supports v4. Confirmed via `npm view tailwind-merge@3.5.0` — no Tailwind peer dependency declared, meaning it handles class strings generically. The key is the installed version is 3.x.
**Warning signs:** If seeing duplicate `bg-` classes in rendered HTML, check tailwind-merge version.

### Pitfall 2: `React.FC<Props>` Anti-Pattern in New Components

**What goes wrong:** New components written with `React.FC<Props>` violate project coding standards and will be flagged by the ts-reviewer agent.
**Why it happens:** Old React patterns persist; CVA examples online often use React.FC.
**How to avoid:** All components in this phase MUST use function declarations with explicit return type `React.JSX.Element`. The existing `Badge.tsx` and `Button.tsx` use `React.FC` — these must be fixed during the CVA migration.
**Warning signs:** Any `const ComponentName: React.FC<Props>` pattern.

### Pitfall 3: `backdrop-filter` on List Items / Scrollable Containers

**What goes wrong:** Applying `backdrop-filter: blur()` to `.discover-card` or `.card-grid` items causes every card in the visible list to create a GPU compositing layer, leading to severe performance degradation (scroll lag, fan spin) on Windows/WebView2.
**Why it happens:** Glassmorphism looks good in mockups; easy to copy the CSS pattern to all cards.
**How to avoid:** Blur is strictly limited to: Modal dialog panel, Toast items, DeepDive panel. NEVER on list items, card grid items, or `.discover-card`. This is enforced in the Forbidden Patterns table in UI-SPEC.md.
**Warning signs:** `backdrop-filter` appearing in `.discover-card`, `.highlight-card`, or any card-grid child.

### Pitfall 4: Hardcoded Gradient Colors in CSS

**What goes wrong:** Writing `linear-gradient(135deg, #bd93f9, #1c1c24)` instead of `linear-gradient(135deg, var(--accent-anime), var(--surface-container-high))`.
**Why it happens:** CSS gradients with CSS variables require slightly more verbose syntax; copy-paste from mockups contains raw HEX.
**How to avoid:** Every gradient MUST use CSS variables. The `CoverArtFallback` gradient uses `--accent-{type}` and `--surface-container-high`. The AI badge gradient uses `--accent-anime` and `--secondary`.
**Warning signs:** Any HEX or `rgba()` literal in a `linear-gradient()` or `background` rule.

### Pitfall 5: DeepDivePanel Has Inline `style={{ }}` Violations

**What goes wrong:** `DeepDivePanel.tsx` line 74-83 uses `style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}` for the selected question button state. This violates the project's inline-style ban.
**Why it happens:** The current implementation pre-dates the style enforcement.
**How to avoid:** During Phase 5 rebuild of DeepDivePanel, replace the `style` prop with Tailwind classes or a CVA variant. The selected state should be handled via `cn()` conditional.
**Warning signs:** Any `style={{ }}` on elements that can be expressed with Tailwind classes.

### Pitfall 6: Toast Icons Using Emoji Characters

**What goes wrong:** Current `Toast.tsx` uses emoji characters (`✨`, `⚠️`, `📰`) as icons — these are not consistent with the lucide-react system and may render inconsistently across Windows font sets.
**Why it happens:** Quick implementation shortcut.
**How to avoid:** Replace emoji with lucide-react icons (`CheckCircle`, `AlertTriangle`, `Info`) during the Toast glassmorphism rebuild. Also replace the hardcoded Tailwind default colors (`bg-green-600`, `bg-red-600`, `bg-blue-600`) with semantic CSS variables.
**Warning signs:** Emoji in JSX, Tailwind default color classes in Toast.

### Pitfall 7: Modal Overlay Blur (Currently Incorrect)

**What goes wrong:** The current `Modal.tsx` applies `backdrop-blur-sm` to the overlay `motion.div` (the full-screen backdrop), not to the dialog panel. According to the bold glass spec, the **backdrop** should use `--surface-backdrop` solid color (no blur), and the **dialog panel** should get the bold glass treatment.
**Why it happens:** Common misunderstanding of the glassmorphism pattern.
**How to avoid:** In Phase 5 Modal rebuild: overlay div uses `bg-(--surface-backdrop)` with NO `backdrop-blur`; the inner `motion.div` (dialog panel) gets `backdrop-blur-[20px]` + `bg-(--surface-glass)` + `border border-white/15`.
**Warning signs:** `backdrop-blur` on the overlay/backdrop element rather than the content panel.

### Pitfall 8: DiscoverCard State Machine — Only Visual Changes

**What goes wrong:** Accidentally changing the `collapsed → summary → deepdive` state machine logic, dwell-tracking IntersectionObserver, or `React.memo` comparator while editing the visual layout.
**Why it happens:** Phase 5 requires restructuring the JSX layout (adding poster thumbnail, changing flex direction), which makes it tempting to refactor the logic too.
**How to avoid:** Treat `DiscoverCard.tsx` logic as read-only. Only modify: className strings, JSX structure around the thumbnail area, import of lucide icons. The `useEffect`, `useState`, `useCallback` hooks and `DiscoverCard` memo comparator must remain unchanged.
**Warning signs:** Any change to `dwellStart`, `IntersectionObserver`, `summaryAttempted`, or the memo comparator.

---

## Code Examples

### Badge CVA Migration with New Variants

```typescript
// src/components/ui/Badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 border rounded-full font-medium tracking-wide',
  {
    variants: {
      variant: {
        default: 'px-2.5 py-0.5 text-[0.6875rem] bg-white/[0.04] text-(--on-surface-variant) border-(--surface-container-highest)',
        category: 'px-2.5 py-0.5 text-[0.6875rem] bg-(--primary-glow) text-(--primary) border-[rgba(189,147,249,0.15)]',
        hot: 'px-2.5 py-0.5 text-[0.6875rem] bg-(--error)/10 text-(--error) border-(--error)/20',
        new: 'px-2.5 py-0.5 text-[0.6875rem] bg-(--secondary)/10 text-(--secondary) border-(--secondary)/20',
        count: 'px-1.5 text-[0.625rem] min-w-[1.125rem] h-[1.125rem] justify-center bg-(--primary) text-white border-transparent',
        // New Phase 5 variants:
        ai: 'px-2 py-0.5 text-[0.625rem] bg-linear-to-r from-(--accent-anime) to-(--secondary) text-white border-transparent font-semibold',
        'content-anime': 'px-2.5 py-0.5 text-[0.6875rem] bg-(--accent-anime)/10 text-(--accent-anime) border-(--accent-anime)/30',
        'content-manga': 'px-2.5 py-0.5 text-[0.6875rem] bg-(--accent-manga)/10 text-(--accent-manga) border-(--accent-manga)/30',
        'content-game': 'px-2.5 py-0.5 text-[0.6875rem] bg-(--accent-game)/10 text-(--accent-game) border-(--accent-game)/30',
        'content-news': 'px-2.5 py-0.5 text-[0.6875rem] bg-(--accent-news)/10 text-(--accent-news) border-(--accent-news)/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
```

### Modal Bold Glass Upgrade

```typescript
// Key change: overlay gets --surface-backdrop (no blur), panel gets bold glass
<motion.div
  className="fixed inset-0 z-100 flex items-center justify-center bg-(--surface-backdrop)"
  // No backdrop-blur here
>
  <motion.div
    ref={contentRef}
    className={cn(
      `w-full ${WIDTH_CLASSES[width]} rounded-xl overflow-hidden`,
      'backdrop-blur-[20px]',         // bold glass blur on PANEL
      'bg-(--surface-glass)',          // rgba(255,255,255,0.03)
      'border border-white/15',        // luminous border
      'shadow-[var(--shadow-lg)]',     // 0 12px 40px rgba(0,0,0,0.4)
    )}
  >
    {/* ... */}
  </motion.div>
</motion.div>
```

### DeepDivePanel Bold Glass Upgrade

```typescript
// Replace CSS class .deepdive-panel with Tailwind bold glass:
<div
  className={cn(
    'deepdive-panel',  // Keep for focus-ring in components.css
    'rounded-xl mt-4 p-4',
    'backdrop-blur-[16px]',        // smaller blur for inline panel
    'bg-(--surface-glass)',
    'border border-white/15',
    'shadow-[var(--shadow-md)]',
  )}
  id={`deepdive-${articleId}`}
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `React.FC<Props>` components | Function declarations with explicit return type | Project-wide rule | All new/rebuilt components must use function declarations |
| `const VARIANT_CLASSES = {} as const` | `cva()` with `VariantProps<>` | Phase 5 | Type-safe variant API |
| Inline SVG `<path d="...">` | `lucide-react` named imports | Phase 5 | Tree-shaking; no path maintenance |
| `array.join(' ')` class composition | `cn(cva(...), className)` | Phase 5 | Class conflict prevention |
| Tailwind default colors in Toast | Semantic CSS variables | Phase 5 | Design system compliance |
| Emoji icons in Toast | lucide-react icons | Phase 5 | Consistency with icon system |
| `backdrop-blur-sm` on Modal overlay | No blur on overlay, `blur(20px)` on panel | Phase 5 | Correct glassmorphism pattern |

**Deprecated/outdated in this codebase:**
- `style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}` in DeepDivePanel: inline style violation; replace with Tailwind classes
- `bg-green-600 / bg-red-600 / bg-blue-600` in Toast: Tailwind defaults; replace with `--accent-game` / `--error` / `--secondary`
- Emoji icon strings in Toast (`✨`, `⚠️`, `📰`): replace with lucide-react

---

## Component-by-Component Change Summary

### 7 UI Primitives (COMP-01)

| Component | LOC | Key Changes | Breaking? |
|-----------|-----|-------------|-----------|
| `Badge` | 34 | CVA migration; add `ai`, `content-{type}` variants; fix `React.FC` | No (additive variants) |
| `Button` | 52 | CVA migration; add `neon`, `glass` variants; fix `React.FC` | No (additive variants) |
| `Spinner` | 22 | Update color to follow `--primary`; keep size API unchanged | No |
| `Input` | 46 | Upgrade `bg-white/[0.04]` → `bg-(--surface-container)`; add error border/box-shadow; `displayName` preserved | No |
| `ToggleGroup` | 55 | Upgrade active indicator style; already correct `font-semibold` state | No |
| `Card` | 45 | CVA migration; add `glass`, `featured` variants; add content-type left-border | API change: `isInteractive` prop deprecated in favor of `variant` |
| `Modal` | 99 | Bold glass upgrade on panel; fix overlay (remove backdrop-blur); keep all a11y hooks intact | No |

Total primitive LOC: ~353 (as stated in CONTEXT.md D-02).

### Feature Components

| Component | Key Changes |
|-----------|-------------|
| `AppShell.tsx` | Replace SVG paths with lucide-react; upgrade NAV_ITEMS type; active state CSS upgrade |
| `DiscoverCard.tsx` | Add poster thumbnail layout (flex row collapsed, top-of-card expanded); add CoverArtFallback; add content-type left-border |
| `CardSummary.tsx` | Replace `ai-summary-label` SVG with `Badge variant="ai"` |
| `DeepDivePanel.tsx` | Bold glass upgrade; fix inline `style={{ }}` violation on question buttons |
| `Toast.tsx` | Bold glass upgrade; replace Tailwind defaults with semantic variables; replace emoji with lucide icons |

### New Components (to create)

| Component | Location | Purpose |
|-----------|----------|---------|
| `CoverArtFallback` | `src/components/discover/CoverArtFallback.tsx` | Gradient + icon fallback for cards without cover art |
| `SectionHeader` | `src/components/common/SectionHeader.tsx` | Left-border accent header |
| `EmptyState` | `src/components/common/EmptyState.tsx` | Unified empty state with CSS motifs |
| `cn()` utility | `src/lib/utils.ts` | Shared clsx + tailwind-merge helper |

---

## Environment Availability

Step 2.6: SKIPPED — all external dependencies are npm packages; no CLI tools, databases, or external services are required for Phase 5.

---

## Open Questions

1. **`DiscoverArticleDto` has `contentType` field?**
   - What we know: The `CoverArtFallback` and content-type left-border require a `contentType: 'anime' | 'manga' | 'game' | 'news'` field on the article DTO.
   - What's unclear: `DiscoverArticleDto` in `src/types/index.ts` was not read in this research pass. If the field doesn't exist, the planner needs to add a Wave 0 task to verify.
   - Recommendation: Planner should add a task to read `src/types/index.ts` to confirm `contentType` (or equivalent like `feedType`, `category`) is present on `DiscoverArticleDto` before implementing `CoverArtFallback`.

2. **Where are empty state components currently rendered?**
   - What we know: No existing empty state components were identified. The phase requires unified empty states in Feed, Saved, Search, and Schedule wings.
   - What's unclear: Whether these wings currently have any empty state handling (possibly just `null` renders or nothing).
   - Recommendation: Planner should add a task to search for "no articles", "empty", or null-returns in the 5 wing components to understand what gets replaced vs. what's new.

3. **`SectionHeader` usage locations**
   - What we know: The COMP-06 requirement adds left-border accents to section headers. The existing codebase uses `.highlights-header` CSS class for the highlights section in `DiscoverWing`.
   - What's unclear: How many other locations currently have section-header-like patterns.
   - Recommendation: A quick grep for `font-bold`, `uppercase`, `tracking-wide` on headings will locate candidates. This is a Wave 0 discovery task.

---

## Sources

### Primary (HIGH confidence)

- Direct file reads: `Badge.tsx`, `Button.tsx`, `Modal.tsx`, `Card.tsx`, `Input.tsx`, `ToggleGroup.tsx`, `Spinner.tsx`, `AppShell.tsx`, `DiscoverCard.tsx`, `CardSummary.tsx`, `DeepDivePanel.tsx`, `Toast.tsx` — current implementation state verified
- Direct file reads: `src/hooks/useFocusTrap.ts`, `useFocusReturn.ts`, `useScrollLock.ts`, `useAnnouncer.tsx` — a11y hook APIs verified
- Direct file reads: `src/styles/globals.css`, `src/styles/components.css`, `src/styles/animations.css`, `design.md` — all CSS variables and design tokens confirmed
- `npm view class-variance-authority version` → 0.7.1 (latest, 2026-03-28)
- `npm view clsx version` → 2.1.1 (latest)
- `npm view tailwind-merge version` → 3.5.0 (latest)
- `npm view lucide-react version` → 1.7.0 (latest)
- `npm view class-variance-authority dependencies` → `{ clsx: '^2.1.1' }` — no Tailwind dependency; confirms Tailwind v4 compatibility
- `package.json` — confirmed: `tailwindcss ^4.2.1`, `motion ^12.38.0` present; CVA/clsx/tailwind-merge/lucide-react NOT yet installed
- `vitest.config.ts` — test infrastructure: `jsdom` environment for components, `src/test/**` pattern, existing mocks

### Secondary (MEDIUM confidence)

- `05-CONTEXT.md` decisions D-01 through D-10 — user-locked architectural decisions
- `05-UI-SPEC.md` — full visual and interaction contract verified for internal consistency with `globals.css` values

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase 5 |
|------------|--------|-------------------|
| `any` type forbidden — use `unknown` + type guards | `coding-standards.md` | CVA `VariantProps<>` must be used; no manual `any` in variant resolution |
| `React.FC<Props>` forbidden — use function declarations | `typescript.md` | Badge and Button currently violate this; must be fixed during CVA migration |
| Named exports only — no default exports | `typescript.md` | All new components export named functions |
| `console.log` forbidden — use pino | `coding-standards.md` | No logging changes needed in UI components |
| Inline styles `style={{ }}` forbidden — use Tailwind classes | project CLAUDE.md | DeepDivePanel has existing violation that must be fixed |
| Tailwind default colors forbidden — use CSS variables | `design-system.md` | Toast must replace `bg-green-600` etc. |
| Hardcoded HEX/RGB forbidden | `design-system.md` | All gradients must use CSS variables |
| `backdrop-filter` forbidden on list items | UI-SPEC.md forbidden patterns | Blur only on Modal, DeepDive, Toast |
| Biome check must pass: `npm run check` | CLAUDE.md completion criteria | Applies to all new/modified files |
| TypeScript strict mode: `npm run typecheck` | CLAUDE.md completion criteria | CVA `VariantProps<>` must be typed correctly |
| 4-layer architecture: no business logic in components | CLAUDE.md | UI components are pure view layer; Tauri invokes through `tauri-commands.ts` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed versions; CVA/tailwind-merge compatibility verified by dependency inspection
- Architecture: HIGH — all source files read directly; patterns derived from actual code
- Pitfalls: HIGH — derived from direct code inspection of existing violations in DeepDivePanel, Toast, Modal, Badge, Button
- CSS art techniques: MEDIUM — conic-gradient and box-shadow pixel art are established CSS patterns; specific implementations require visual iteration

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries; CSS techniques are timeless)
