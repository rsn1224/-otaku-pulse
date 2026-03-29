# Phase 6: Motion & Interaction Layer - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

アプリに「生命感」を付与する。Wing 遷移トランジション、フィードカードリストのスタッガー登場アニメ、ホバー深度フィードバック、ブックマーク/いいね等のマイクロインタラクション、平成/Y2K レトロ装飾モチーフを一貫したモーション言語で実装し、`prefers-reduced-motion` で安全にデグレードさせる。

**既存コンポーネント構造の上にモーション層を重ねる。** 新機能追加・レイアウト変更・コンポーネント構造変更は含まない。

</domain>

<decisions>
## Implementation Decisions

### Wing 遷移トランジション
- **D-01:** Wing 切り替え時のトランジション方向（フェードのみ / スライド / 方向付き）は Claude 裁量。ROADMAP success criteria「200ms fade-slide AnimatePresence transition; no snap-replace or layout flash」を満たすこと。
- **D-02:** Wing 遷移中のコンテンツ保持（スクロール位置リセット vs 復元）は Claude 裁量。パフォーマンスと実装複雑度のバランスで判断。現状は React.lazy による遅延読み込みで毎回フレッシュ描画。

### スタッガー＆エントランス演出
- **D-03:** スタッガーの演出スタイル（フェード+スライドアップ / スケールイン等）は Claude 裁量。ROADMAP success criteria「~150ms intervals for first 10 visible items; items below fold load without animation」を満たすこと。
- **D-04:** 無限スクロールの追加読み込みバッチへのスタッガー適用有無は Claude 裁量。UX とパフォーマンスのバランスで判断。

### レトロ装飾モチーフ
- **D-05:** レトロ装飾の適用範囲・密度は Claude 裁量。デコレーションバジェット（1 animated + 1 gradient + 1 decorative icon per component max）を遵守。ROADMAP success criteria「corner brackets, scan-line texture, dot grid visible on designated components; CSS ::before/::after only — no JavaScript」を満たすこと。
- **D-06:** レトロ装飾のトーン（彩度・不透明度）は Claude 裁量。ダークテーマとネオングローデザイン言語との調和を優先。

### マイクロインタラクション
- **D-07:** ホバー深度フィードバック（translateY + shadow + glow の組み合わせ・強度）は Claude 裁量。ROADMAP success criteria「translateY(-2px) lift and shadow depth increase」を満たすこと。要素種類ごとの glow 有無・強度も Claude 判断。
- **D-08:** ブックマーク・いいね等のアクション反応アニメーション（スケールポップ / スプリングバウンス等）は Claude 裁量。ROADMAP success criteria「bookmark and like actions trigger a visible micro-interaction keyframe」を満たすこと。

### prefers-reduced-motion 対応
- **D-09:** 全モーションに `useMotionConfig` ガードを適用する（MOTN-06 要件）。既存の `motion-variants.ts` の `reduced` バリアントと `globals.css` の `@media (prefers-reduced-motion: reduce)` ルールを組み合わせ、JavaScript アニメーション（motion ライブラリ）と CSS アニメーション双方をカバーする。

### Claude's Discretion
全ディスカッション項目がユーザーにより Claude 裁量に委ねられた。以下の制約内で最適な実装を判断する:
- ROADMAP.md の 5 つの success criteria を全て満たすこと
- STATE.md のアニメーションバジェット（同時 1 エントランス、idle/ambient OFF by default、スタッガー先頭 10 のみ）
- STATE.md のデコレーションバジェット（1 animated + 1 gradient + 1 decorative icon per component max）
- 既存の motion-variants.ts / useMotionConfig パターンを拡張する形で実装

### Folded Todos
該当なし。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### モーションシステム
- `src/lib/motion-variants.ts` -- 既存モーションバリアント定義（springTransition, staggerContainer, staggerItem, reduced variants）。Phase 6 で拡張対象
- `src/hooks/useMotionConfig.ts` -- reduced-motion 対応フック。全新規モーションで使用必須
- `src/styles/animations.css` -- CSS キーフレーム（fadeSlideIn, bookmarkPop, shimmer）。Phase 6 で追加対象

### デザインシステム
- `design.md` -- Phase 4 で全面書き換え済みの新デザインシステム定義。ネオングロー変数、アクセントカラー一覧
- `.claude/rules/design-system.md` -- CSS 変数命名パターン、禁止パターン

### コンポーネント（モーション適用対象）
- `src/components/layout/AppShell.tsx` -- Wing 切り替えロジック（activeWing state + switch）。AnimatePresence 追加対象
- `src/components/wings/ArticleList.tsx` -- カードリスト。スタッガーアニメ適用対象
- `src/components/wings/DiscoverWing.tsx` -- AnimatePresence 使用済み
- `src/components/discover/DiscoverCard.tsx` -- ホバー深度フィードバック統一対象
- `src/components/ui/Card.tsx` -- ホバー状態（hover:-translate-y-0.5）。統一対象
- `src/components/ui/Button.tsx` -- ホバー状態（neon variant に glow）。統一対象
- `src/components/common/Toast.tsx` -- AnimatePresence + motion 使用済み

### レトロ装飾フック（Phase 5 配置済み）
- `src/styles/components.css` -- .retro-decoration, .retro-corner-bracket, .retro-scanline クラス（空、Phase 6 で populate）

### スタイル
- `src/styles/globals.css` -- prefers-reduced-motion メディアクエリ（既存）
- `src/styles/components.css` -- DiscoverCard ホバー（translateY(-2px) scale(1.01)）

### ROADMAP Success Criteria
- `.planning/ROADMAP.md` Phase 6 セクション -- 5 つの success criteria 定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `motion-variants.ts`: springTransition, gentleSpring, modalOverlay/Content, slideInRight, fadeSlideIn, staggerContainer/Item, toastSlideIn + reduced motion variants が全て定義済み。新バリアント追加で拡張可能
- `useMotionConfig.ts`: `useReducedMotion()` ベースで自動的に適切なバリアントセットを返す。全新規モーションコードで使用すべき
- `bookmarkPop` keyframe: scale(1→1.3→1) の CSS アニメーション。ブックマークアクションで流用可能
- `AnimatePresence`: Toast.tsx, Modal.tsx, DiscoverWing.tsx で使用実績。Wing 遷移への適用パターンが確立済み

### Established Patterns
- motion/react v12.38.0（旧 framer-motion）を使用。`motion.div` + variants パターン
- ホバーは Tailwind クラス（Card, Button）と CSS（DiscoverCard, DeepDive）が混在。Phase 6 で統一が望ましい
- Spring 物理（stiffness: 400, damping: 30）がデフォルトの transition として定義済み

### Integration Points
- `AppShell.tsx` の `renderWing()` switch 文 — AnimatePresence ラッパー追加箇所
- `ArticleList.tsx` — stagger variants 適用箇所
- `components.css` の .retro-* クラス — CSS 実装を追加するだけ（JSX 変更不要）
- 全インタラクティブ要素のホバー — 統一的な深度フィードバックユーティリティクラスまたは CSS 変数化

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within ROADMAP success criteria and budget constraints.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-motion-interaction-layer*
*Context gathered: 2026-03-28*
