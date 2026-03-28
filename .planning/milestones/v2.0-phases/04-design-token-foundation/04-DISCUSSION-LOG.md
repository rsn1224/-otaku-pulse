# Phase 4: Design Token Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 04-design-token-foundation
**Areas discussed:** パレット確定プロセス, コンテンツタイプ別アクセント, CJK フォント戦略, Legacy alias 移行戦略

---

## パレット確定プロセス

### Q1: パレットの HEX 値をどのタイミングで確定させますか？

| Option | Description | Selected |
|--------|-------------|----------|
| Stitch 先行 (推奨) | Stitch で UI モック生成 → Figma で調整 → CONTEXT.md に確定値を記録 | ✓ |
| 手動パレット定義 | 既にイメージがあるので HEX 値を直接指定 | |
| ハイブリッド | サーフェス階層は手動、グロー+アクセントは Stitch で探索 | |

**User's choice:** Stitch 先行
**Notes:** design-workflow.md の標準フローに従う

### Q2: 5 層サーフェス階層の明度ステップは？

| Option | Description | Selected |
|--------|-------------|----------|
| 等間隔ステップ (推奨) | 各層 +7 lightness の均一ステップ | |
| コントラスト強調 | 下層は密、上層は粗いステップ | |
| Stitch に一任 | Stitch モックアップで明度ステップも探索 | ✓ |

**User's choice:** Stitch に一任
**Notes:** 具体的な HEX 値は Stitch で視覚的に検証して決定

### Q3: ネオングローの 60-30-10 ルール、メインカラーは？

| Option | Description | Selected |
|--------|-------------|----------|
| 紫がメイン (推奨) | 現行 --primary を踏襲、60=紫, 30=シアン/ピンク, 10=アンバー | |
| シアンがメイン | サイバーパンク寄り、60=シアン, 30=紫, 10=ピンク | |
| Stitch で探索 | 複数スキームを生成して比較 | ✓ |

**User's choice:** Stitch で探索
**Notes:** 複数のカラースキームを Stitch で生成して比較検討

---

## コンテンツタイプ別アクセント

### Q1: anime アクセントの紫とメイン --primary の紫の関係は？

| Option | Description | Selected |
|--------|-------------|----------|
| 同一色 (推奨) | anime = --primary、ブランドカラーがアニメを反映 | |
| 別の紫 | anime 専用の紫、--primary は UI 全体のアクセント | |
| Stitch で探索 | 4 色のバランスを視覚的に検証してから決定 | ✓ |

**User's choice:** Stitch で探索

### Q2: アクセントカラーの適用箇所は？

| Option | Description | Selected |
|--------|-------------|----------|
| カードボーダー + バッジ (推奨) | 左ボーダーとバッジ背景にアクセント。Phase 4 は変数定義のみ | ✓ |
| グロー + ボーダー | ネオングローエフェクトもタイプ別に変える | |
| ミニマル | バッジテキスト色のみ | |

**User's choice:** カードボーダー + バッジ (推奨)

---

## CJK フォント戦略

### Q1: CJK フォントの構成は？

| Option | Description | Selected |
|--------|-------------|----------|
| Noto Sans JP のみ (推奨) | バンドルサイズ最小、情報密度向き | ✓ |
| Noto Sans JP + Noto Serif JP | 見出しに Serif、本文に Sans | |
| Noto Sans JP + Zen Maru Gothic | 装飾用途に丸ゴシック | |

**User's choice:** Noto Sans JP のみ

### Q2: FOIT 防止のローディング戦略は？

| Option | Description | Selected |
|--------|-------------|----------|
| font-display: swap (推奨) | システムフォントで即座描画、カスタムフォントロード後に切替 | ✓ |
| font-display: optional | 100ms 以内にロードされなければシステムフォントのまま | |
| preload + swap | 重要ウェイトを先行読み込み | |

**User's choice:** font-display: swap

### Q3: フォントウェイトの絞り込みは？

| Option | Description | Selected |
|--------|-------------|----------|
| 3 ウェイト (300/400/600) (推奨) | DTKN-05 要件通り、バンドルサイズ最小 | ✓ |
| 4 ウェイト (300/400/500/600) | medium も残す | |
| Variable font 全範囲 | 全ウェイト 1 ファイル | |

**User's choice:** 3 ウェイト (300/400/600)

---

## Legacy Alias 移行戦略

### Q1: 14 個の Legacy alias 削除の進め方は？

| Option | Description | Selected |
|--------|-------------|----------|
| 一括置換 (推奨) | Phase 4 で全 14 個を一気に推奨トークンに置換・削除 | ✓ |
| alias を残して段階的 | Phase 4 は推奨トークン定義のみ、Phase 5 で自然削除 | |
| CSS のみ先行 | components.css のみ先に置換、.tsx は Phase 5 | |

**User's choice:** 一括置換

### Q2: マップ不能な Legacy alias の扱いは？

| Option | Description | Selected |
|--------|-------------|----------|
| 新サーフェス層に吸収 (推奨) | 5 層サーフェス階層の最も近い層にマッピング | ✓ |
| 専用トークンとして維持 | --surface-deepdive 等の専用トークンを新設 | |

**User's choice:** 新サーフェス層に吸収

---

## Claude's Discretion

- サーフェス階層の具体的な HEX 値（Stitch 出力ベース）
- ネオングロー変数のネーミングと opacity 値
- design.md の構成・セクション分け
- WCAG AA コントラスト比の検証方法

## Deferred Ideas

None -- discussion stayed within phase scope
