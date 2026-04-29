---
description: Figma → コード変換ルール（otaku-pulse/ 固有、Material Design 3 命名準拠）
globs: "src/**/*.{ts,tsx,css}"
---

# Figma → コード変換ルール（otaku-pulse/ プロジェクト固有）

> `figma-implement-design` スキルを使う際は、このファイルのルールを**全て適用**すること。
> Stitch デザインシステム（Material Design 3 命名）に準拠する。

---

## 1. 色/トークン変換

### Surface 階層（背景・コンテナ）

| レイヤー | CSS 変数 | 実値 | 用途 |
|---------|---------|------|------|
| ベース | `--surface-base` | `#0a0a0f` | ページ背景 |
| コンテナ | `--surface-container` | `#12121a` | カード背景 |
| カード | `--surface-card` | `#1a1a26` | ネストされたカード |
| 高 | `--surface-high` | `#252535` | 強調コンテナ |
| 最高 | `--surface-elevated` | `#3b3b4a` | ドロップダウン等 |

### コンテンツカラー

| 用途 | CSS 変数 | 実値 |
|------|---------|------|
| プライマリ | `--primary` | `#bd93f9` (purple) |
| セカンダリ | `--secondary` | `#699cff` (blue) |
| ターシャリ | `--tertiary` | `#ff97b2` (pink) |

### コンテンツタイプ別アクセント（重要）

Figma でコンテンツタイプが指定されている場合、以下を使う：

| タイプ | CSS 変数 | 実値 |
|-------|---------|------|
| Anime | `--accent-anime` | `#bd93f9` |
| Manga | `--accent-manga` | `#f48fb1` |
| Game | `--accent-game` | `#40e0d0` |
| News | `--accent-news` | `#ffb86c` |

> コンテンツタイプ不明の場合は `--primary` を使う。

### Neon Glow（グロー効果）

```tsx
// --glow-primary: rgba(189, 147, 249, 0.4)
// --glow-secondary: rgba(105, 156, 255, 0.4)
// --glow-subtle: rgba(189, 147, 249, 0.15)

<div className="shadow-[0_0_20px_var(--glow-primary)]">
<div className="shadow-[0_0_8px_var(--glow-subtle)]">
```

### Hover/Active オーバーレイ

```tsx
// --surface-hover: rgba(255,255,255,0.05)
// --surface-active: rgba(255,255,255,0.08)
// --surface-glass: rgba(255,255,255,0.03)
<div className="hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)]">
```

---

## 2. Auto Layout → CSS 変換

| Figma 制約 | Tailwind / CSS |
|-----------|----------------|
| FIXED W/H | `w-[Npx]` / `h-[Npx]` |
| HUG contents | `w-fit h-fit` |
| FILL container | `flex-1` または `w-full` |
| Horizontal + gap | `flex flex-row gap-{N}` |
| Vertical + gap | `flex flex-col gap-{N}` |

---

## 3. コンポーネントマッピング

| Figma コンポーネント | コード実装 |
|--------------------|-----------|
| Button (Primary) | `<Button variant="primary">` |
| Button (Secondary) | `<Button variant="secondary">` |
| Button (Ghost) | `<Button variant="ghost">` |
| Button (Danger) | `<Button variant="danger">` |
| Button (Neon) | `<Button variant="neon">` |
| Button (Glass) | `<Button variant="glass">` |
| Card | `<Card>` または `<div className="bg-[var(--surface-card)] rounded-xl p-4">` |
| Modal | `<Modal>` |
| Badge | `<Badge>` |
| Spinner | `<Spinner>` |
| Input | `<Input>` |
| ToggleGroup | `<ToggleGroup>` |

---

## 4. インタラクション状態

```tsx
// 標準ホバー
'hover:bg-[var(--surface-hover)]'

// Neon Glow ホバー（neon variant のみ）
'hover:shadow-[0_0_20px_var(--glow-primary)]'

// Glass ホバー
'hover:bg-[var(--surface-glass)]'

// Disabled
'disabled:pointer-events-none disabled:opacity-40'

// フォーカス
'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-opacity-50'
```

---

## 5. アニメーション

**必須**: `src/styles/animations.css` の @keyframes を使う。独自 @keyframes 定義禁止。

| Figma アニメーション | クラス |
|--------------------|-----------------------|
| フェードイン + スライド | `animate-[fadeSlideIn_0.3s_ease]` |
| ブックマーク | `animate-[bookmarkPop_0.2s_ease]` |
| シマー（ローディング） | `animate-[shimmer_1.5s_infinite]` |
| フェードイン（小） | `animate-[fadeIn_0.2s_ease]` |
| パルス（グロー） | `animate-[glowPulse_2s_infinite]` |

---

## 6. 実装後チェックリスト

- [ ] `--surface-*` 変数を使用（hex hardcode なし）
- [ ] コンテンツタイプが分かる場合は `--accent-anime/manga/game/news` を適用
- [ ] Neon/Glass variant の Glow は `--glow-*` 変数経由
- [ ] アニメーションは `animations.css` の @keyframes のみ使用
- [ ] `pnpm exec tsc --noEmit` エラーなし
- [ ] `pnpm exec biome check --write src/` エラーなし
