# Phase 5: UI Primitive & Component Overhaul - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

全 UI プリミティブ（Badge, Button, Spinner, Input, ToggleGroup, Card, Modal）と機能コンポーネント（DiscoverCard, サイドバー, DeepDive パネル, トースト, 空ステート, セクションヘッダー, AI バッジ）を新デザイン言語でビジュアルリビルドする。a11y hooks の統合、lucide-react アイコン全置換、CVA による variant システム導入を含む。

**コンポーネントの見た目と構造を刷新する。** 新機能追加・レイアウト動線変更は含まない。

</domain>

<decisions>
## Implementation Decisions

### コンポーネント variant 戦略
- **D-01:** CVA (class-variance-authority) + clsx + tailwind-merge で全プリミティブの variant システムを再構築する。既存の手動 const + `.join(' ')` パターンを完全に置き換える。
- **D-02:** 7 プリミティブ（Badge, Button, Spinner, Input, ToggleGroup, Card, Modal）は一括リビルドする。合計 ~353 LOC と小規模なため、一貫性を優先して同時移行する。
- **D-03:** CVA が Tailwind v4 と非互換だった場合は tailwind-variants に切り替える（STATE.md のリスク項目に記載済み）。アーキテクチャへの影響なし。

### アイコンシステム
- **D-04:** lucide-react をアプリ全体に導入し、全てのインライン SVG（Heroicons 風）を置換する。サイドバーだけでなくカード、アクション、ヘッダー等の全箇所が対象。

### DiscoverCard カバーアートモード
- **D-05:** 2:3 ポスター比率のサムネイルを常時表示する。collapsed 状態ではカード左側に小さく、summary/deepdive 展開時はカードトップにフル幅で表示。
- **D-06:** カバーアート画像がない記事（RSS ニュース等）は、コンテンツタイプ別アクセントカラー（anime=紫, manga=ピンク, game=シアン, news=アンバー）のグラデーション背景 + カテゴリアイコンを fallback として表示する。

### グラスモーフィズム
- **D-07:** bold glass スタイルを採用する。blur(16-24px) + 明確な光沢ボーダー(white/15%) + グラデーションオーバーレイ。
- **D-08:** blur バジェット内での優先順位は Claude 裁量。GPU パフォーマンス検証結果に基づいて、モーダル・DeepDive・トースト間の配分を決定する。バジェット制約: 同時最大 2 要素、各 15% viewport 以下。

### 空ステート & 装飾モチーフ
- **D-09:** 空ステートのアニメ文化モチーフ（桜、ピクセルスター、マンガスピードライン）は CSS のみ（gradient, box-shadow, border, ::before/::after）で実現する。追加画像アセット不要。
- **D-10:** Phase 6 のレトロ装飾（MOTN-03: コーナーブラケット、スキャンライン、ドットグリッド）に備えて、空ステートコンポーネントに `.retro-decoration` 等の CSS クラスフックを付与しておく。Phase 5 時点ではスタイルは空。

### Claude's Discretion
- AI バッジチップ（紫→青グラデーション）の具体的なデザイン・配置
- セクションヘッダーの左ボーダーアクセントのデザイン
- blur バジェット内でのコンポーネント優先順位（モーダル vs DeepDive vs トースト）
- bold glass の具体的な opacity/blur 値の微調整
- 各プリミティブの新 variant 追加（neon, glass 等の新バリエーション名）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### デザインシステム
- `design.md` — Phase 4 で全面書き換え済みの新デザインシステム定義。CSS 変数一覧、Stitch Token Mapping
- `.claude/rules/design-system.md` — CSS 変数命名パターン（MD3 準拠）、禁止パターン、カスタム UI コンポーネント設計原則
- `~/.claude/rules/design-workflow.md` — Stitch / Figma MCP ワークフロー

### スタイル定義
- `src/styles/globals.css` — 全 CSS 変数（5 層サーフェス、ネオングロー、アクセントカラー、glass 変数）
- `src/styles/components.css` — コンポーネント固有スタイル（DiscoverCard, DeepDive 等）
- `src/styles/animations.css` — キーフレームアニメーション

### 既存 UI プリミティブ
- `src/components/ui/Badge.tsx` — 5 variants, ~34 LOC
- `src/components/ui/Button.tsx` — 4 variants + 3 sizes, ~52 LOC
- `src/components/ui/Spinner.tsx` — 3 sizes, ~22 LOC
- `src/components/ui/Input.tsx` — forwardRef 使用, ~46 LOC
- `src/components/ui/ToggleGroup.tsx` — generic type, a11y (tablist), ~55 LOC
- `src/components/ui/Card.tsx` — interactive mode, ~45 LOC
- `src/components/ui/Modal.tsx` — motion animations, a11y hooks 統合済み, ~99 LOC

### 機能コンポーネント
- `src/components/discover/DiscoverCard.tsx` — 状態マシン（collapsed/summary/deepdive）、サムネイル、dwell tracking
- `src/components/discover/CardHeader.tsx` — メタデータ表示、ブックマーク
- `src/components/discover/CardSummary.tsx` — AI サマリー表示、インライン AI バッジ
- `src/components/discover/DeepDivePanel.tsx` — Q&A パネル
- `src/components/layout/AppShell.tsx` — サイドバーナビ（インライン SVG、glassmorphism）
- `src/components/common/Toast.tsx` — 通知システム（Provider パターン）

### a11y hooks
- `src/hooks/useFocusTrap.ts` — フォーカストラップ（Modal で使用済み）
- `src/hooks/useFocusReturn.ts` — フォーカス復帰
- `src/hooks/useScrollLock.ts` — スクロールロック
- `src/hooks/useAnnouncer.tsx` — スクリーンリーダーアナウンス

### 要件・制約
- `.planning/REQUIREMENTS.md` — COMP-01〜COMP-07, PERF-03 の詳細定義
- `.planning/STATE.md` §Accumulated Context — blur/decoration/animation バジェット、新パッケージ一覧

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/Modal.tsx` — a11y hooks（focusTrap, focusReturn, scrollLock）統合パターンの参考実装
- `src/components/ui/Button.tsx` — VARIANT_CLASSES + SIZE_CLASSES パターン（CVA 移行のベース）
- `src/components/layout/AppShell.tsx` — glassmorphism パターン（backdrop-blur-[20px] + rgba bg）
- `src/hooks/useAnnouncer.tsx` — Zustand ベースの announcer（他コンポーネントへの統合候補）
- `src/lib/motion-variants.ts` — motion ライブラリの variant 定義（Modal で使用中）

### Established Patterns
- **CSS 変数 + Tailwind v4**: `bg-(--primary)`, `text-(--on-surface)` 形式
- **MD3 命名体系**: `--surface-*`, `--on-surface-*`, `--primary-*`, `--outline-*`
- **ダーク専用**: `:root` 直接定義、ライトモード分岐なし
- **コンポーネント設計**: Props interface export + 関数宣言 + className prop 受け取り
- **状態マシン**: DiscoverCard の collapsed/summary/deepdive パターン

### Integration Points
- `src/components/ui/index.ts` — UI コンポーネントの barrel export（新コンポーネント追加時に更新）
- `package.json` — CVA, clsx, tailwind-merge, lucide-react の追加
- `src/main.tsx` — グローバルスタイルのインポート

</code_context>

<specifics>
## Specific Ideas

- カバーアート fallback のグラデーションは Phase 4 で確定したコンテンツタイプ別アクセントカラー 4 色を直接使用
- bold glass の光沢ボーダーはネオングロー変数（--glow-primary 等）と連動させる
- 空ステートの CSS アートは decoration バジェット（1 animated + 1 gradient + 1 decorative per component）内に収める
- Phase 6 との連携: `.retro-decoration`, `.retro-corner-bracket`, `.retro-scanline` 等のクラス名をコンポーネントに付与しておく（スタイル定義は Phase 6）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-ui-primitive-component-overhaul*
*Context gathered: 2026-03-28*
