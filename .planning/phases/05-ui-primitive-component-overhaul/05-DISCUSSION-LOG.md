# Phase 5: UI Primitive & Component Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 05-ui-primitive-component-overhaul
**Areas discussed:** コンポーネント variant 戦略, DiscoverCard カバーアート, グラスモーフィズム表現, 空ステート & 装飾モチーフ

---

## コンポーネント variant 戦略

### Q1: variant システム再構築アプローチ

| Option | Description | Selected |
|--------|-------------|----------|
| CVA + clsx + tw-merge | STATE.md の計画通り。型安全な variant 定義、クラス競合解決 | ✓ |
| tailwind-variants | Tailwind CSS 公式推奨。v4 互換性保証。slots 機能あり | |
| 現行パターン維持 | 新ライブラリ追加せず既存の const + .join(' ') を洗練 | |

**User's choice:** CVA + clsx + tw-merge (推奨)
**Notes:** Tailwind v4 非互換時は tailwind-variants にフォールバック（STATE.md 記載のリスク対応）

### Q2: リビルドスコープ

| Option | Description | Selected |
|--------|-------------|----------|
| 一括リビルド | 7 コンポーネント全て同時に書き直す | ✓ |
| 段階的移行 | Button/Badge で確立 → 残りに展開 | |

**User's choice:** 一括リビルド (推奨)
**Notes:** 合計 ~353 LOC と小規模なため一貫性を優先

### Q3: アイコンシステム

| Option | Description | Selected |
|--------|-------------|----------|
| lucide-react に全置換 | COMP-04 要件。tree-shakable、アプリ全体の SVG 置換 | ✓ |
| サイドバーのみ lucide-react | COMP-04 スコープ内のみ | |
| lucide-react 不採用 | インライン SVG 維持 | |

**User's choice:** lucide-react に全置換 (推奨)
**Notes:** なし

---

## DiscoverCard カバーアート

### Q1: カードレイアウト

| Option | Description | Selected |
|--------|-------------|----------|
| サムネイル常時表示 | collapsed でも左側に小さく表示、展開時にトップ大表示 | ✓ |
| 展開時のみフルカバー | collapsed はテキストのみ、展開で 2:3 カバー表示 | |
| Claude におまかせ | Stitch モックで決定 | |

**User's choice:** サムネイル常時表示 (推奨)
**Notes:** なし

### Q2: 画像なし時の fallback

| Option | Description | Selected |
|--------|-------------|----------|
| カテゴリアクセントグラデーション | コンテンツタイプ別カラーでグラデーション + アイコン | ✓ |
| プレースホルダーイラスト | アニメモチーフ SVG | |
| サムネイル非表示 | テキストのみカードに | |

**User's choice:** カテゴリアクセントグラデーション (推奨)
**Notes:** Phase 4 確定のアクセントカラー 4 色を使用

---

## グラスモーフィズム表現

### Q1: blur バジェット内の優先順位

| Option | Description | Selected |
|--------|-------------|----------|
| モーダル優先 | モーダル=フル glass、DeepDive=軽め、トースト=border のみ | |
| 全員に glass 適用 | 動的 blur OFF ロジック必要 | |
| Claude におまかせ | GPU パフォーマンス検証結果に基づいて決定 | ✓ |

**User's choice:** Claude におまかせ
**Notes:** blur バジェット制約（同時最大 2、各 15% viewport 以下）内で Claude が判断

### Q2: ビジュアルスタイル

| Option | Description | Selected |
|--------|-------------|----------|
| subtle glass | blur(8-12px), 薄いボーダー(white/5%), 半透明背景 | |
| bold glass | blur(16-24px), 明確な光沢ボーダー(white/15%), グラデーションオーバーレイ | ✓ |

**User's choice:** bold glass
**Notes:** なし

---

## 空ステート & 装飾モチーフ

### Q1: モチーフ実現方式

| Option | Description | Selected |
|--------|-------------|----------|
| CSS アート | gradient, box-shadow, border, pseudo-elements で実現 | ✓ |
| SVG イラスト | インライン SVG で描画 | |
| ハイブリッド | lucide-react アイコン + CSS 装飾 | |

**User's choice:** CSS アート (推奨)
**Notes:** 追加アセット不要、軽量

### Q2: AI バッジ & セクションヘッダー

| Option | Description | Selected |
|--------|-------------|----------|
| Claude におまかせ | デザイントークンに沿って実装 | ✓ |
| 詳しく話したい | 具体的デザインをディスカッション | |

**User's choice:** Claude におまかせ (推奨)
**Notes:** なし

### Q3: Phase 6 レトロ装飾との連携

| Option | Description | Selected |
|--------|-------------|----------|
| CSS クラスのフックだけ準備 | .retro-decoration 等のクラスを付与、スタイルは Phase 6 | ✓ |
| 意識しない | Phase 5 は Phase 5 で完結 | |

**User's choice:** CSS クラスのフックだけ準備 (推奨)
**Notes:** なし

---

## Claude's Discretion

- AI バッジチップの具体的デザイン・配置
- セクションヘッダー左ボーダーアクセントのデザイン
- blur バジェット内でのコンポーネント優先順位
- bold glass の具体的パラメータ微調整
- 各プリミティブの新 variant 名

## Deferred Ideas

None — discussion stayed within phase scope
