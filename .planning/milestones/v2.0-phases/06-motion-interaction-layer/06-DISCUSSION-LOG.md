# Phase 6: Motion & Interaction Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 06-motion-interaction-layer
**Areas discussed:** Wing 遷移トランジション, スタッガー＆エントランス演出, レトロ装飾モチーフ, マイクロインタラクション

---

## Wing 遷移トランジション

### Q1: トランジション方向

| Option | Description | Selected |
|--------|-------------|----------|
| フェードのみ（推奨） | クロスフェード。方向感がなくシンプル。ROADMAP の「200ms fade-slide」に合致 | |
| スライド（方向付き） | サイドバー上下位置に応じてスライド方向が変わる空間的手がかり | |
| Claude に任せる | ROADMAP success criteria を満たす範囲で最適な方向を選択 | ✓ |

**User's choice:** Claude に任せる
**Notes:** ROADMAP の success criteria「200ms fade-slide AnimatePresence transition」を満たす範囲で Claude が判断

### Q2: コンテンツ保持

| Option | Description | Selected |
|--------|-------------|----------|
| リセットでOK（推奨） | 毎回フレッシュ描画。シンプルでメモリ節約。現状の動作と同じ | |
| スクロール位置のみ復元 | Zustand にスクロール位置を保存し、Wing 復帰時に復元 | |
| Claude に任せる | パフォーマンスと実装複雑度のバランスで判断 | ✓ |

**User's choice:** Claude に任せる
**Notes:** React.lazy による遅延読み込みが前提

---

## スタッガー＆エントランス演出

### Q1: 演出スタイル

| Option | Description | Selected |
|--------|-------------|----------|
| フェード+スライドアップ（推奨） | 既存 staggerItem を拡張。下からふわっと現れる定番パターン | |
| スケールイン | 小さい状態から拡大しながら現れる。GPU 負荷が高め | |
| Claude に任せる | パフォーマンスとデザインのバランスで最適なアニメーションを選択 | ✓ |

**User's choice:** Claude に任せる
**Notes:** ROADMAP の ~150ms 間隔、先頭 10 アイテムのみの制約あり

### Q2: 追加読み込み時のスタッガー

| Option | Description | Selected |
|--------|-------------|----------|
| 初回読み込みのみ（推奨） | ページ初回表示時だけスタッガー。スクロール追加分は即座表示 | |
| 追加分もスタッガー | 新バッチにもスタッガー適用。「新コンテンツが届いた」感 | |
| Claude に任せる | UX とパフォーマンスのバランスで判断 | ✓ |

**User's choice:** Claude に任せる

---

## レトロ装飾モチーフ

### Q1: 適用範囲と密度

| Option | Description | Selected |
|--------|-------------|----------|
| アクセント程度（推奨） | 空ステート、セクションヘッダー、サイドバーの一部など限定的 | |
| 全体的に散りばめる | カード、モーダル、パネルなど幅広く適用 | |
| Claude に任せる | デコレーションバジェット内で判断 | ✓ |

**User's choice:** Claude に任せる
**Notes:** Phase 5 で .retro-decoration 等の CSS フックが配置済み

### Q2: トーン（色味）

| Option | Description | Selected |
|--------|-------------|----------|
| 彩度を落とした微光（推奨） | ネオングロー同系色だが opacity 10-20% の控えめな表現 | |
| ビビッドな Y2K | 明るいネオンカラーではっきり見せる | |
| Claude に任せる | デザインシステムのトーンと整合するよう判断 | ✓ |

**User's choice:** Claude に任せる

---

## マイクロインタラクション

### Q1: ホバー深度フィードバック

| Option | Description | Selected |
|--------|-------------|----------|
| glow なし（lift+shadowのみ） | translateY + shadow 増加だけ。シンプルで軽量 | |
| glow 付き（推奨） | ROADMAP 通り、ネオングローも追加。デザイン言語と一貫 | |
| Claude に任せる | 要素種類ごとに glow の有無・強度を判断 | ✓ |

**User's choice:** Claude に任せる
**Notes:** ROADMAP success criteria に「translateY(-2px) lift and shadow depth increase」あり

### Q2: アクション反応アニメーション

| Option | Description | Selected |
|--------|-------------|----------|
| スケールポップ（推奨） | 既存 bookmarkPop 拡張。scale(1→1.3→1)。簡潔で効果的 | |
| スプリングバウンス | motion の spring で弾むような動き。遊び心があるが頻繁操作でうるさい可能性 | |
| Claude に任せる | アクション種類ごとに最適な演出を判断 | ✓ |

**User's choice:** Claude に任せる

---

## Claude's Discretion

全 8 問が Claude 裁量に委ねられた。ROADMAP success criteria 5 つとアニメーション/デコレーションバジェット制約を遵守しつつ、最適な実装を判断する。

## Deferred Ideas

None — discussion stayed within phase scope
