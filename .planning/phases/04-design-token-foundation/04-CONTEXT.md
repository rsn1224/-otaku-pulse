# Phase 4: Design Token Foundation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

アプリのビジュアル言語の基盤を再構築する。void black ベースの 5 層サーフェス階層、ネオングロー CSS 変数システム、コンテンツタイプ別アクセントカラー 4 色、CJK フォント（Noto Sans JP）、タイポグラフィ階層の再定義、Legacy alias の完全削除、design.md の全面書き換えを行う。

**コンポーネント JSX は変更しない。** CSS 変数の定義・置換・フォント導入のみ。コンポーネントの見た目変更は Phase 5。

</domain>

<decisions>
## Implementation Decisions

### パレット確定プロセス
- **D-01:** Stitch 先行フロー — Stitch で UI モック生成 → Figma で調整 → 確定 HEX 値を CONTEXT.md / design.md に記録。design-workflow.md の標準フローに準拠する。
- **D-02:** 5 層サーフェス階層の明度ステップは Stitch モックアップセッションで探索・決定する。事前に固定値をコミットしない。
- **D-03:** 60-30-10 ネオングローの配色（メインカラー選定）は Stitch で複数カラースキームを生成して比較検討する。

### コンテンツタイプ別アクセント
- **D-04:** anime=紫、manga=ピンク、game=シアン、news=アンバーの 4 色。具体的な HEX 値は Stitch で探索して決定する（--primary との関係も含めて）。
- **D-05:** アクセントカラーの適用箇所はカードの左ボーダー + バッジ背景。Phase 4 では CSS 変数定義のみ、Phase 5 でコンポーネントに適用。

### CJK フォント戦略
- **D-06:** Noto Sans JP のみ導入。Zen Maru Gothic と Noto Serif JP は不採用（バンドルサイズ削減、情報密度の高い UI に丸ゴシックは不向き）。
- **D-07:** font-display: swap でローディング。FOIT を防ぎ、システムフォントで即座に描画後にカスタムフォントに切り替え。
- **D-08:** フォントウェイトは 3 種（300=meta/light, 400=body, 600=title/heading）に絞り込み。DTKN-05 の要件通り。
- **D-09:** @fontsource-variable/noto-sans-jp を使用。unicode-range サブセットで必要なグリフのみロード。Tauri バイナリサイズへの影響を検証すること。

### Legacy Alias 移行
- **D-10:** Phase 4 で 14 個の Legacy alias を一括置換・削除する。段階的移行は行わない。
- **D-11:** grep で全使用箇所を特定 → 推奨トークンに一括置換 → globals.css から Legacy aliases セクション削除。
- **D-12:** マップ不能な Legacy alias（--bg-secondary: #131319, --bg-deepdive: #131319）は新 5 層サーフェス階層の最も近い層に吸収する。専用トークンは新設しない。

### Claude's Discretion
- サーフェス階層の具体的な HEX 値（Stitch 出力をベースに調整）
- ネオングロー変数のネーミングと opacity 値
- design.md の構成・セクション分け
- WCAG AA コントラスト比の検証方法とツール選定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### デザインシステム
- `design.md` -- 現行デザインシステム定義（Phase 4 で全面書き換え対象）
- `.claude/rules/design-system.md` -- CSS 変数命名パターン、禁止パターン、Legacy alias 移行ルール
- `~/.claude/rules/design-workflow.md` -- Stitch / Figma MCP ワークフロー（トークン変換ルール）

### スタイル定義
- `src/styles/globals.css` -- CSS 変数定義（:root）、Legacy aliases セクション
- `src/styles/components.css` -- コンポーネント固有スタイル（Legacy alias 参照箇所あり）
- `src/styles/animations.css` -- キーフレームアニメーション

### 要件
- `.planning/REQUIREMENTS.md` -- DTKN-01〜DTKN-07 の詳細定義

### 制約
- `.planning/STATE.md` §Accumulated Context -- Stitch パレット暫定値、blur/decoration/animation バジェット

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/styles/globals.css` :root -- 全 CSS 変数の定義箇所。Phase 4 の主要編集対象
- `src/styles/components.css` -- Legacy alias を参照しているグラデーション・背景定義
- `src/components/ui/Button.tsx` -- VARIANT_CLASSES パターン: `bg-(--variable)` 記法で CSS 変数を参照
- `src/components/ui/Card.tsx` -- hover 効果に CSS 変数を使用するパターン例
- `src/components/ui/Badge.tsx` -- variant ごとのカラーマッピングパターン

### Established Patterns
- **CSS 変数 + Tailwind v4 arbitrary syntax**: `bg-(--primary)`, `text-(--on-surface)` 形式でトークン参照
- **Material Design 3 命名体系**: `--surface-*`, `--on-surface-*`, `--primary-*`, `--outline-*`
- **ダーク専用**: ライトモード分岐なし、:root で直接定義
- **グラスモーフィズム基本パターン**: `--surface-glass`, `backdrop-filter: blur()` が既に存在

### Integration Points
- `src/main.tsx` -- globals.css のインポート（フォント CSS のインポート追加箇所）
- `vite.config.ts` -- @tailwindcss/vite プラグイン（追加の Tailwind 設定が必要な場合）
- `src-tauri/tauri.conf.json` -- CSP 設定（フォントのセルフホストなら変更不要）

</code_context>

<specifics>
## Specific Ideas

- Stitch 先行フローでは「オタク文化・アニメ的世界観」をキーワードにモック生成する
- void black (#0a0a0f) はベース確定だが、サーフェス階層の具体的な明度差は Stitch で視覚的に検証
- 60-30-10 ルールの色選定も Stitch で複数案を比較（紫メイン vs シアンメイン等）

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-design-token-foundation*
*Context gathered: 2026-03-28*
