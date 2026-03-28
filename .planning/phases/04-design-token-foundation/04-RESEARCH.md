# Phase 4: Design Token Foundation - Research

**Researched:** 2026-03-28
**Domain:** CSS Design Tokens, Tailwind CSS v4, @fontsource-variable, Legacy alias migration
**Confidence:** HIGH

## Summary

Phase 4 is a pure CSS and token layer change — no component JSX is modified. The work divides into four streams: (1) rebuilding the `:root` token set in `globals.css` with a 5-layer void-black surface hierarchy plus neon glow variables; (2) defining four content-type accent variables; (3) introducing Noto Sans JP Variable via `@fontsource-variable/noto-sans-jp` and redefining the typography hierarchy; and (4) replacing all 212 legacy alias usages across `src/` and deleting the Legacy aliases block from `globals.css`.

The project already uses Tailwind CSS v4 with the `bg-(--variable)` arbitrary CSS variable syntax, so no new patterns are needed. The `@fontsource-variable/noto-sans-jp` package (v5.2.10, OFL-1.1) is pre-verified: it ships 124 woff2 files split by unicode-range, already includes `font-display: swap` in every `@font-face` block, and must be imported as `@fontsource-variable/noto-sans-jp/wght.css` (variable weight axis). All files are 5.3 MB total on disk, but the browser loads only the unicode-range chunks that are actually rendered — a Tauri cold-launch on a Japanese-text page will fetch roughly 5–8 chunks (the latin + most-common-kanji ranges), not all 124.

The most operationally complex part is the legacy alias sweep: 212 occurrences across 28+ source files. The mapping is fully deterministic (13 aliases map 1-to-1 to recommended tokens; 2 unmappable aliases `--bg-secondary` / `--bg-deepdive` are absorbed into the nearest surface layer per D-12). The plan must treat this as a batch replace operation with Biome check as the gating test.

**Primary recommendation:** Define tokens bottom-up (globals.css :root → components.css legacy replacement → design.md rewrite), then install and import the font as the final sub-task. Keep all surface HEX values provisional until the Stitch mockup session confirms them.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stitch 先行フロー — Stitch で UI モック生成 → Figma で調整 → 確定 HEX 値を CONTEXT.md / design.md に記録。design-workflow.md の標準フローに準拠する。
- **D-02:** 5 層サーフェス階層の明度ステップは Stitch モックアップセッションで探索・決定する。事前に固定値をコミットしない。
- **D-03:** 60-30-10 ネオングローの配色（メインカラー選定）は Stitch で複数カラースキームを生成して比較検討する。
- **D-04:** anime=紫、manga=ピンク、game=シアン、news=アンバーの 4 色。具体的な HEX 値は Stitch で探索して決定する（--primary との関係も含めて）。
- **D-05:** アクセントカラーの適用箇所はカードの左ボーダー + バッジ背景。Phase 4 では CSS 変数定義のみ、Phase 5 でコンポーネントに適用。
- **D-06:** Noto Sans JP のみ導入。Zen Maru Gothic と Noto Serif JP は不採用（バンドルサイズ削減、情報密度の高い UI に丸ゴシックは不向き）。
- **D-07:** font-display: swap でローディング。FOIT を防ぎ、システムフォントで即座に描画後にカスタムフォントに切り替え。
- **D-08:** フォントウェイトは 3 種（300=meta/light, 400=body, 600=title/heading）に絞り込み。
- **D-09:** @fontsource-variable/noto-sans-jp を使用。unicode-range サブセットで必要なグリフのみロード。Tauri バイナリサイズへの影響を検証すること。
- **D-10:** Phase 4 で 16 個の Legacy alias を一括置換・削除する。段階的移行は行わない。
- **D-11:** grep で全使用箇所を特定 → 推奨トークンに一括置換 → globals.css から Legacy aliases セクション削除。
- **D-12:** マップ不能な Legacy alias（--bg-secondary: #131319, --bg-deepdive: #131319）は新 5 層サーフェス階層の最も近い層に吸収する。専用トークンは新設しない。

### Claude's Discretion
- サーフェス階層の具体的な HEX 値（Stitch 出力をベースに調整）
- ネオングロー変数のネーミングと opacity 値
- design.md の構成・セクション分け
- WCAG AA コントラスト比の検証方法とツール選定

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DTKN-01 | サーフェスカラーを void black (#0a0a0f) ベースに深化し、5 層サーフェス階層を再定義する | Surface layer naming pattern confirmed in design-system.md; current 4-layer structure identified in globals.css |
| DTKN-02 | ネオングロー CSS 変数システム（--glow-primary, --glow-secondary 等）を追加し、60-30-10 ルールで適用する | New variable section placement identified; rgba opacity pattern already used in --primary-soft/glow |
| DTKN-03 | コンテンツタイプ別アクセントカラー 4 色（anime=紫, manga=ピンク, game=シアン, news=アンバー）を定義する | Naming strategy confirmed; CSS variable-only scope for Phase 4 locked in D-05 |
| DTKN-04 | CJK フォント（Noto Sans JP）をセルフホスト + unicode-range サブセットで導入する | @fontsource-variable/noto-sans-jp v5.2.10 verified: 124 woff2 + built-in font-display swap + unicode-range auto-subsetting; import path confirmed as `wght.css` |
| DTKN-05 | タイポグラフィ階層を再定義する（title=600, body=400, meta=300 + ウェイトコントラスト強化） | Current globals.css has no font-family definition; 3-weight system (300/400/600) matches variable font axis range 100–900 |
| DTKN-06 | Legacy CSS alias（14 個）を完全削除し、推奨トークンに移行する | 212 occurrences confirmed across src/; full mapping table built; 2 unmappable aliases identified with absorption targets |
| DTKN-07 | design.md を新デザインシステムで全面書き換えし、Stitch Token Mapping を更新する | Current design.md structure confirmed; new sections required: 5-layer surface, glow system, content-type accents, CJK typography |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Biome v2.4.7** — lint/format gate. `npm run check` must pass before any commit.
- **TypeScript strict** — `any` forbidden. `npm run typecheck` must pass.
- **No inline styles** — Tailwind CSS classes only (except for JS-injected SVG stroke/fill values like CardHeader.tsx).
- **No hardcoded HEX/RGB** — all colors must go through CSS variables.
- **No Tailwind default colors** — `blue-500`, `gray-200` etc. forbidden.
- **No light mode conditionals** — dark-only `:root` definition, no `dark:` prefix.
- **Stitch HEX → CSS variable** — all Stitch output values MUST be translated via design.md Stitch Token Mapping before committing.
- **300-line file limit** — globals.css will grow; split into `palette.css` / `typography.css` if it approaches limit.
- **157 existing tests must stay green** throughout Phase 4.
- **Blur budget:** max 2 blurred elements, each under 15% viewport (no new blur elements in Phase 4).
- **Decoration budget:** Phase 4 is CSS vars only — no new decorative elements.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.1 | Utility classes referencing CSS vars | Already installed; v4 arbitrary CSS-variable syntax `bg-(--var)` is the established pattern |
| @fontsource-variable/noto-sans-jp | 5.2.10 | Self-hosted Noto Sans JP variable font | Confirmed installable; OFL-1.1 license; built-in font-display swap + unicode-range chunking |
| Biome | 2.4.7 | Lint/format gate | Project standard; CSS is parsed with Tailwind directives enabled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js grep (via Bash) | — | Legacy alias sweep — enumerate all occurrences before replace | Use for D-11 audit before writing any replacement |
| npx tsc | 5.8.3 | Type-check gate | After globals.css changes, verify no TypeScript type narrowing issues caused by removed variables |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fontsource-variable/noto-sans-jp | Google Fonts CDN | CDN blocked in Tauri CSP; self-host is required |
| @fontsource-variable/noto-sans-jp | @fontsource/noto-sans-jp (static) | Static version lacks variable weight axis; larger total download for 3 separate weight files |
| CSS :root variables | Tailwind `@theme` block | Tailwind v4 `@theme` generates utilities but is not needed here — raw CSS vars are simpler and already the project pattern |

**Installation:**
```bash
npm install @fontsource-variable/noto-sans-jp
```

**Version verification:** `npm view @fontsource-variable/noto-sans-jp version` → `5.2.10` (confirmed 2026-03-28)

---

## Architecture Patterns

### Recommended Project Structure (Phase 4 edits only)

```
src/
├── styles/
│   ├── globals.css         # Primary edit target — :root token definitions
│   ├── components.css      # Secondary edit — legacy alias replacement
│   └── animations.css      # Read-only in Phase 4
├── main.tsx                # Add font import here
design.md                   # Full rewrite
```

If `globals.css` exceeds 280 lines after the new token system, split out:
```
src/styles/
├── palette.css             # Surface + glow + accent tokens
├── typography.css          # Font-face declarations + type scale
└── globals.css             # Imports the above + utility classes
```

### Pattern 1: 5-Layer Surface Hierarchy in :root

**What:** void-black base with 5 progressively lighter surface layers.
**When to use:** This replaces the current 4-layer system (`--surface` through `--surface-container-highest`).

```css
/* Source: design-system.md + Stitch mockup output (values TBD from Stitch session) */
--surface-base: #0a0a0f;          /* void black — D-01 locked */
--surface:      [Stitch value];   /* page background */
--surface-container: [Stitch];    /* card/panel background */
--surface-container-high: [Stitch]; /* hovered card */
--surface-elevated: [Stitch];     /* floating elements */
```

Note: The final HEX values for layers 2–5 MUST come from the Stitch mockup session (D-02). Do not hardcode before the session. Use placeholder comments in the plan.

### Pattern 2: Neon Glow System

**What:** Semi-transparent rgba variables expressing the 60-30-10 color distribution.
**When to use:** Defined once in `:root`; referenced by Phase 5 components.

```css
/* Source: existing --primary-soft / --primary-glow pattern in globals.css */
--glow-primary:   rgba([primary-hue], 0.12);  /* 60% — dominant glow */
--glow-secondary: rgba([secondary-hue], 0.08); /* 30% — supporting */
--glow-subtle:    rgba([primary-hue], 0.04);  /* 10% — ambient */
```

Exact HEX/rgba values depend on 60-30-10 color selection from Stitch (D-03). The naming `--glow-primary`, `--glow-secondary`, `--glow-subtle` is at Claude's discretion and aligns with the `--primary-*` namespace already in use.

### Pattern 3: Content-Type Accent Variables

**What:** 4 semantic accent variables, one per content type.
**When to use:** Defined in `:root`; Phase 5 applies them to card borders and badge backgrounds (D-05).

```css
/* Source: D-04; HEX values from Stitch session */
--accent-anime:  [purple-hue];   /* anime content type */
--accent-manga:  [pink-hue];     /* manga content type */
--accent-game:   [cyan-hue];     /* game content type */
--accent-news:   [amber-hue];    /* news/general content type */
```

WCAG AA (4.5:1) must be verified for each accent against `--surface-container` background. See Pitfall 3.

### Pattern 4: Font Import + font-family Declaration

**What:** Import the variable font CSS, then reference it as a CSS variable.
**When to use:** In `main.tsx` (import) and `globals.css` (font-family assignment).

```typescript
// src/main.tsx — add AFTER existing imports
import "@fontsource-variable/noto-sans-jp/wght.css";
```

```css
/* src/styles/globals.css — typography section */
:root {
  --font-jp: "Noto Sans JP Variable", system-ui, sans-serif;
}
body {
  font-family: var(--font-jp);
}
```

The `wght.css` file already declares `font-display: swap` in every `@font-face` block (verified from source). No manual `font-display` override is needed.

### Pattern 5: Legacy Alias Replacement (Batch)

**What:** Find-and-replace all 212 usages in two passes.
**When to use:** After the new token set is locked in `:root`, before globals.css Legacy section is deleted.

```
Pass 1 — components.css (CSS var() references):
  var(--bg-primary)       → var(--surface)
  var(--bg-card)          → var(--surface-container)
  var(--bg-card-hover)    → var(--surface-container-high)
  var(--bg-deepdive)      → var(--surface-elevated)   [D-12: absorbed into nearest layer]
  var(--bg-secondary)     → var(--surface-elevated)   [D-12: absorbed into nearest layer]
  var(--border)           → var(--surface-container-highest)
  var(--border-hover)     → var(--outline-variant)
  var(--accent)           → var(--primary)
  var(--accent-soft)      → var(--primary-soft)
  var(--accent-glow)      → var(--primary-glow)
  var(--text-primary)     → var(--on-surface)
  var(--text-secondary)   → var(--on-surface-variant)
  var(--text-tertiary)    → var(--outline)
  var(--text-source)      → var(--on-surface-variant)
  var(--badge-hot)        → var(--error)
  var(--badge-new)        → var(--secondary)

Pass 2 — TSX files (Tailwind arbitrary syntax):
  bg-(--bg-primary)       → bg-(--surface)
  bg-(--bg-card)          → bg-(--surface-container)
  border-(--border)       → border-(--surface-container-highest)
  text-(--text-primary)   → text-(--on-surface)
  text-(--text-secondary) → text-(--on-surface-variant)
  text-(--text-tertiary)  → text-(--outline)
  text-(--text-source)    → text-(--on-surface-variant)
  text-(--badge-hot)      → text-(--error)
  border-(--badge-hot)    → border-(--error)
  ... (all --accent → --primary, etc.)
```

### Anti-Patterns to Avoid

- **Hardcoding Stitch HEX values before the mockup session:** The plan must include a Wave 0 task "Run Stitch session, record HEX values in CONTEXT.md" before any token CSS is written.
- **Importing the full font bundle:** Use `wght.css` (variable weight axis only), not `index.css` (which includes all axes and can be larger). For Noto Sans JP there is only one axis (wght), so both are equivalent — but `wght.css` is the explicit recommended path.
- **Setting `font-display` manually:** The package already includes `font-display: swap` in every `@font-face`. Adding a second declaration would override per-chunk swap behavior.
- **Using Tailwind `dark:` prefix:** Project is dark-only. All tokens defined in `:root` directly, no `@media (prefers-color-scheme)` wrapping.
- **Partial legacy alias removal:** D-10 mandates a single batch pass. Leaving any aliases in place after the sweep will cause Phase 5 components to receive a broken reference when the Legacy section is deleted.
- **New CSS variables outside MD3 naming pattern:** Follow `--surface-*`, `--on-surface-*`, `--primary-*`, `--outline-*`, `--glow-*` conventions per design-system.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CJK font loading with unicode-range | Manual @font-face declarations with subset ranges | `@fontsource-variable/noto-sans-jp/wght.css` | Package already ships 124 unicode-range-split woff2 chunks with font-display swap; building this manually would require Glyphhanger or pyftsubset toolchain |
| Legacy alias audit | Manual file-by-file inspection | `grep -rn` bash command | 212 occurrences in 28+ files; grep produces a complete hit list in under 1 second |
| WCAG contrast ratio calculation | Mental arithmetic | webaim.org/resources/contrastchecker or `npx color-contrast` | Relative luminance formula is error-prone; neon colors are notoriously borderline at 4.5:1 |

**Key insight:** This phase is entirely declarative. Every "solution" is either a CSS variable definition or a string replacement. The only non-trivial tooling decision is the font package import path.

---

## Legacy Alias Inventory

### Current Legacy Aliases (16 total in globals.css)

| Legacy Alias | Current Value | Replacement Token | Occurrences in src/ |
|-------------|---------------|-------------------|---------------------|
| `--bg-primary` | `var(--surface)` | `--surface` | ~15 |
| `--bg-secondary` | `#131319` | `--surface-elevated` (D-12: nearest layer) | ~3 |
| `--bg-card` | `var(--surface-container)` | `--surface-container` | ~20 |
| `--bg-card-hover` | `var(--surface-container-high)` | `--surface-container-high` | ~8 |
| `--bg-deepdive` | `#131319` | `--surface-elevated` (D-12: nearest layer) | ~5 |
| `--border` | `var(--surface-container-highest)` | `--surface-container-highest` | ~40 |
| `--border-hover` | `var(--outline-variant)` | `--outline-variant` | ~5 |
| `--accent` | `var(--primary)` | `--primary` | ~35 |
| `--accent-soft` | `var(--primary-soft)` | `--primary-soft` | ~10 |
| `--accent-glow` | `var(--primary-glow)` | `--primary-glow` | ~8 |
| `--text-primary` | `var(--on-surface)` | `--on-surface` | ~30 |
| `--text-secondary` | `var(--on-surface-variant)` | `--on-surface-variant` | ~15 |
| `--text-tertiary` | `var(--outline)` | `--outline` | ~12 |
| `--text-source` | `var(--on-surface-variant)` | `--on-surface-variant` | ~6 |
| `--badge-hot` | `var(--error)` | `--error` | ~5 |
| `--badge-new` | `var(--secondary)` | `--secondary` | ~3 |

**Total confirmed: 212 occurrences** (grep count from 2026-03-28).

**Unmappable aliases (D-12):** `--bg-secondary` and `--bg-deepdive` both equal `#131319`. This is between `--surface` (`#0e0e13`) and `--surface-container` (`#19191f`) in the current system. Under the new 5-layer hierarchy, they map to `--surface-elevated` (the 5th layer, serving as a slightly raised surface for deepdive/secondary content). The name `--surface-elevated` is a recommendation for Claude's discretion to finalize.

---

## Common Pitfalls

### Pitfall 1: Stitch HEX Values Committed Before Mockup Session
**What goes wrong:** The plan specifies HEX values in tasks before the Stitch session has run. Implementation proceeds with provisional values that never get updated, causing visual inconsistency with the approved mockup.
**How to avoid:** Every surface layer task MUST be gated on "Stitch session complete, HEX values recorded in CONTEXT.md". Use placeholder syntax (`[STITCH-VALUE]`) in task descriptions until the session runs.
**Warning signs:** Tasks that list specific HEX values for `--surface-elevated` or `--glow-primary` without citing a Stitch session result.

### Pitfall 2: Partial Legacy Alias Removal Causes Silent Failures
**What goes wrong:** Some legacy aliases are replaced, the Legacy section in `globals.css` is deleted, and remaining usages now reference undefined CSS custom properties. CSS silently inherits or renders as transparent/invisible without errors.
**How to avoid:** Run `grep -rn` for ALL 16 aliases after the batch replace and before the Legacy section deletion. The grep must return zero matches before deletion.
**Warning signs:** After replacing, running grep on any individual alias still returns hits in `.tsx` or `.css` files.

### Pitfall 3: Neon Accent Colors Failing WCAG AA at 4.5:1
**What goes wrong:** Neon cyan (`--accent-game`) and neon amber (`--accent-news`) on dark backgrounds often pass 3:1 (AA for large text) but fail 4.5:1 (AA for normal text). The REQUIREMENTS.md success criterion explicitly requires 4.5:1 for all neon colors.
**How to avoid:** After Stitch outputs HEX values, verify each of the 4 accent colors against `--surface-container` using a contrast checker. If any accent fails, increase lightness of the hex value until it passes.
**Warning signs:** Contrast ratio between 3.0:1–4.4:1 for game=cyan or news=amber — these hues are particularly susceptible.

### Pitfall 4: Font Name Mismatch (FOIT)
**What goes wrong:** The `font-family` CSS declaration uses `"Noto Sans JP"` (the static package name) instead of `"Noto Sans JP Variable"` (the variable package name). The browser doesn't match the declared family to the loaded font-face and falls back to system font permanently.
**How to avoid:** The font-family name in the `@font-face` blocks within `wght.css` is exactly `'Noto Sans JP Variable'`. The CSS declaration must match exactly.
**Warning signs:** After import, browser DevTools shows the computed font-family as `system-ui` instead of `Noto Sans JP Variable`.

### Pitfall 5: globals.css Line Count Overflow
**What goes wrong:** Adding the 5-layer surface tokens, glow system, content-type accents, and typography variables pushes `globals.css` above the 300-line project limit.
**How to avoid:** Before Phase 4 begins, count current line count (112 lines as of 2026-03-28). Budget approximately 40 new lines for new tokens. If total will exceed 280, split into `palette.css` (token declarations) imported by `globals.css`.
**Warning signs:** globals.css approaching 250 lines during the token-writing task.

### Pitfall 6: Biome Linting CSS Variables in TSX
**What goes wrong:** After replacement, some TSX files may have inline `style={{ color: 'var(--error)' }}` patterns that violate the "no inline styles" rule. The batch replace may introduce these if it targets `style={{}}` attributes.
**How to avoid:** The batch replace is string-based (`var(--alias)` → `var(--token)`). It does not introduce new inline styles — it only replaces the variable name inside existing `var()` calls. Existing inline style violations in components like `DeepDivePanel.tsx` (line 75: `{ background: 'var(--accent-soft)', color: 'var(--accent)' }`) are pre-existing and out of Phase 4 scope.
**Warning signs:** Biome check fails on files that were not touched during the alias sweep.

---

## Code Examples

### Font Import Pattern (verified from package source)

```typescript
// src/main.tsx — import AFTER globals.css import
import "@fontsource-variable/noto-sans-jp/wght.css";
// Source: /node_modules/@fontsource-variable/noto-sans-jp/README.md
```

### Font-family CSS Declaration

```css
/* src/styles/globals.css */
:root {
  --font-jp: "Noto Sans JP Variable", system-ui, sans-serif;
}
body { font-family: var(--font-jp); }
/* Source: wght.css declares font-family: 'Noto Sans JP Variable' */
```

### Glow Variable Pattern (modeled on existing --primary-glow)

```css
/* Source: existing pattern in globals.css line 22 */
--primary-glow: rgba(189, 157, 255, 0.06);  /* existing */
--glow-primary: rgba([R], [G], [B], 0.12);  /* new — stronger for 60% use */
--glow-subtle:  rgba([R], [G], [B], 0.04);  /* new — ambient 10% use */
```

### Content-Type Accent Variables

```css
/* Phase 4 defines; Phase 5 applies */
--accent-anime: [HEX from Stitch];   /* purple family, >= 4.5:1 on --surface-container */
--accent-manga: [HEX from Stitch];   /* pink family */
--accent-game:  [HEX from Stitch];   /* cyan family */
--accent-news:  [HEX from Stitch];   /* amber family */
```

### Legacy Alias Replacement Example

```css
/* BEFORE — components.css line 8 */
background: var(--bg-card);
/* AFTER */
background: var(--surface-container);
```

```tsx
/* BEFORE — AppShell.tsx line 134 */
className="... bg-(--bg-primary) text-(--text-primary)"
/* AFTER */
className="... bg-(--surface) text-(--on-surface)"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Fonts CDN link | @fontsource self-hosted npm packages | ~2021 | Eliminates CDN dependency; works in Tauri CSP |
| Static font weights (separate files per weight) | Variable font (single file, wght axis 100–900) | ~2020 | Smaller download; fluid weight interpolation |
| `@import url()` in CSS for fonts | `import "package/font.css"` in JS entry | Vite era | Tree-shaking friendly; Vite bundles only used chunks |
| Tailwind `text-blue-500` | `text-(--css-var)` arbitrary syntax | Tailwind v4 | Decouples design tokens from utility class regeneration |

**Deprecated/outdated:**
- `@fontsource/noto-sans-jp` (non-variable): still published but generates separate files per weight; the variable version is preferred for 3-weight systems.
- Tailwind v3 `@apply` for CSS variables: v4 makes this unnecessary — use `bg-(--var)` directly.

---

## Open Questions

1. **Surface layer 5 name** — What to call the 5th layer (`--surface-elevated` is recommended above, but `--surface-container-low` or `--surface-deep` are alternatives). What we know: current 4-layer system has `--surface`, `--surface-container`, `--surface-container-high`, `--surface-container-highest`. Gap: the 5th layer needs to sit below `--surface` (darker than page background, for deepdive/drawer areas). Recommendation: use `--surface-sunken` to signal it goes below the base rather than above — but this is Claude's discretion per CONTEXT.md.

2. **Stitch mockup session workflow** — The plan requires a human-in-the-loop Stitch session before any surface tokens are written. What we know: CONTEXT.md says "Stitch 先行フロー" and the Stitch mockup session must precede palette.css commits. Gap: unclear whether the session runs synchronously within Phase 4 Wave 1 or is a pre-phase prerequisite. Recommendation: make it Wave 0, Task 0 — a gate task that blocks all CSS writing until confirmed.

3. **Tauri binary size delta for Noto Sans JP** — D-09 says "Tauri バイナリサイズへの影響を検証すること". What we know: 124 woff2 files totaling 5.3 MB are added to the npm package. Vite bundles only the CSS file (the woff2 files are referenced as `url()` paths and are copied to `dist/`). Gap: does Tauri embed `dist/` assets into the binary or serve them from disk? Recommendation: check `tauri.conf.json` for `bundle.resources` configuration; if woff2 files are in `dist/` they will be bundled into the `.exe`. Run `before/after` binary size comparison in the verification task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm (package install) | D-09: @fontsource-variable install | Available | 10.x | None needed |
| Biome | Completion gate | Available | 2.4.7 | None — required |
| TypeScript tsc | Completion gate | Available | 5.8.3 | None — required |
| Vitest | Test gate (157 tests) | Available | 4.1.0 | None — required |
| Stitch (Google Stitch) | D-01/02/03/04: palette finalization | External tool — user-operated | Current | Plan must include explicit gate task |

**Missing with no fallback:** None identified for the CSS/token work itself.
**External dependency:** Stitch mockup session is a human-operated step. The plan must model this as a blocking gate before palette HEX values are written.

---

## Sources

### Primary (HIGH confidence)
- Project codebase (`src/styles/globals.css`, `src/styles/components.css`) — current state of all tokens and legacy aliases
- `/c/Users/rsn12/node_modules/@fontsource-variable/noto-sans-jp/README.md` — import paths, supported weights/subsets, font-family name
- `/c/Users/rsn12/node_modules/@fontsource-variable/noto-sans-jp/index.css` + `wght.css` — verified font-display swap behavior and unicode-range chunking
- `.claude/rules/design-system.md` — MD3 naming conventions, forbidden patterns, legacy alias migration rules
- `design.md` — current design system state, full Stitch Token Mapping

### Secondary (MEDIUM confidence)
- `npm view @fontsource-variable/noto-sans-jp` output — confirmed version 5.2.10, OFL-1.1, 5.3MB files
- fontsource.org/docs/getting-started/variable — variable font axis import path pattern confirmed (`/wght.css`)
- REQUIREMENTS.md DTKN-01 through DTKN-07 — success criteria defining 4.5:1 contrast requirement
- STATE.md Accumulated Context — blur/decoration/animation budgets

### Tertiary (LOW confidence)
- Stitch HEX value recommendations — provisional values used in design.md are from a prior session; Phase 4 requires a fresh Stitch session per D-01/D-02 before committing any final values. Do not treat current globals.css values as Phase 4 output targets.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — package verified from installed source, Tailwind v4 patterns confirmed from existing codebase
- Architecture: HIGH — file paths, import patterns, and replacement targets are confirmed from direct file reads
- Pitfalls: HIGH for alias removal and font naming; MEDIUM for WCAG contrast (final values not yet known from Stitch session)
- Surface HEX values: LOW — explicitly deferred to Stitch session per D-02; no values committed in this research

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (font package stable; CSS patterns stable; legacy alias count may change if untracked files are modified)
