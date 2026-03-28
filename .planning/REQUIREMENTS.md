# Requirements: OtakuPulse

**Defined:** 2026-03-28
**Core Value:** アニメ・オタク文化を体現するリッチなビジュアルデザインで UI/UX を全面刷新する

## v2.0 Requirements

Requirements for design overhaul milestone. Each maps to roadmap phases.

### Design Token Foundation

- [x] **DTKN-01**: サーフェスカラーを void black (#0a0a0f) ベースに深化し、5層サーフェス階層を再定義する
- [x] **DTKN-02**: ネオングロー CSS 変数システム（--glow-primary, --glow-secondary 等）を追加し、60-30-10 ルールで適用する
- [x] **DTKN-03**: コンテンツタイプ別アクセントカラー4色（anime=紫, manga=ピンク, game=シアン, news=アンバー）を定義する
- [x] **DTKN-04**: CJK フォント（Noto Sans JP / Zen Maru Gothic）をセルフホスト + unicode-range サブセットで導入する
- [x] **DTKN-05**: タイポグラフィ階層を再定義する（title=600, body=400, meta=300 + ウェイトコントラスト強化）
- [x] **DTKN-06**: Legacy CSS alias（--bg-card, --text-primary 等14個）を完全削除し、推奨トークンに移行する
- [x] **DTKN-07**: design.md を新デザインシステムで全面書き換えし、Stitch Token Mapping を更新する

### Component Visual Overhaul

- [x] **COMP-01**: Badge / Button / Spinner / Input / ToggleGroup / Card / Modal の全 UI プリミティブを新デザイン言語で再設計する
- [ ] **COMP-02**: DiscoverCard にポスター比率 (2:3) カバーアートモードを追加する
- [ ] **COMP-03**: DeepDive パネル、モーダル、トーストにグラスモーフィズム効果を適用する
- [ ] **COMP-04**: サイドバーナビゲーションのアクティブ状態にネオングロー + lucide-react アイコンに刷新する
- [ ] **COMP-05**: AI 処理済みカードに AI バッジチップ（紫→青グラデーション）を表示する
- [ ] **COMP-06**: セクションヘッダーにデコレーティブ左ボーダーアクセントを追加する
- [ ] **COMP-07**: 空ステートをアニメ文化モチーフ（桜、ピクセルスター、マンガスピードライン）で統一する

### Motion & Interaction

- [ ] **MOTN-01**: Wing 切り替え時に AnimatePresence トランジションを適用する
- [ ] **MOTN-02**: フィードカードリストにスタッガーフェードイン（~150ms 間隔）を実装する
- [ ] **MOTN-03**: 平成/Y2K レトロ装飾（コーナーブラケット、スキャンライン、ドットグリッド）を CSS のみで実装する
- [ ] **MOTN-04**: ホバー深度フィードバック（translateY + shadow lift + glow）を全インタラクティブ要素に適用する
- [ ] **MOTN-05**: ブックマーク、いいね等のマイクロインタラクションアニメーションを実装する
- [ ] **MOTN-06**: prefers-reduced-motion 完全対応（全モーションに useMotionConfig ガード適用）

### Accessibility & Performance

- [ ] **A11Y-01**: WIP a11y hooks（announcer, focusTrap, focusReturn, scrollLock）を全モーダル/パネルに統合する
- [ ] **A11Y-02**: 全ネオンカラーで WCAG AA 4.5:1 コントラスト比を保証する
- [ ] **A11Y-03**: 見出し階層（h1→h2→h3）とフォームラベルを正規化する
- [ ] **PERF-01**: @tanstack/react-virtual で 1000+ 記事の仮想スクロールを実装する
- [ ] **PERF-02**: useArticleStore をスライス分割する（フィード / ハイライト / カウント / スクロール位置）
- [ ] **PERF-03**: glassmorphism の blur バジェットを設定し、GPU パフォーマンスを検証する

## Future Requirements

### Deferred to post-v2.0

- **FUTURE-01**: シネマティックリーダー（マンガパネル風コラムレイアウト + ドロップキャップ）
- **FUTURE-02**: スケジュール Wing カレンダーグリッドビュー（放送カレンダー風）
- **FUTURE-03**: コマンドパレット（Cmd+K スタイル）
- **FUTURE-04**: パーソナライズド "For You" グラデーションヘッダー

## Out of Scope

| Feature | Reason |
|---------|--------|
| ライトモード | ダーク専用設計。v3+ で検討 |
| アニメキャラクター画像の装飾利用 | 著作権リスク + ビジュアルクラッター |
| パーティクルエフェクト（tsParticles 等） | バンドル 1MB+、GPU 負荷、バッテリー消耗 |
| カスタムカーソル | Tauri/Chromium の高 DPI レンダリング問題 |
| パララックススクロール | パフォーマンス劣化 + 前庭性めまいリスク |
| 自動再生ビデオ/GIF プレビュー | バックエンドデータなし + CSP 制約 |
| Wing ごとのカスタムテーマ | CSS トークン面積 N 倍 + QA 負担 |
| マンガパネルレイアウト（不規則グリッド） | 仮想スクロール破壊 + 長リスト可読性低下 |
| リアルタイムライブティッカー | WebSocket/ポーリング不要。カウントダウンで代替 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DTKN-01 | Phase 4 | Complete |
| DTKN-02 | Phase 4 | Complete |
| DTKN-03 | Phase 4 | Complete |
| DTKN-04 | Phase 4 | Complete |
| DTKN-05 | Phase 4 | Complete |
| DTKN-06 | Phase 4 | Complete |
| DTKN-07 | Phase 4 | Complete |
| COMP-01 | Phase 5 | Complete |
| COMP-02 | Phase 5 | Pending |
| COMP-03 | Phase 5 | Pending |
| COMP-04 | Phase 5 | Pending |
| COMP-05 | Phase 5 | Pending |
| COMP-06 | Phase 5 | Pending |
| COMP-07 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| MOTN-01 | Phase 6 | Pending |
| MOTN-02 | Phase 6 | Pending |
| MOTN-03 | Phase 6 | Pending |
| MOTN-04 | Phase 6 | Pending |
| MOTN-05 | Phase 6 | Pending |
| MOTN-06 | Phase 6 | Pending |
| A11Y-01 | Phase 7 | Pending |
| A11Y-02 | Phase 7 | Pending |
| A11Y-03 | Phase 7 | Pending |
| PERF-01 | Phase 7 | Pending |
| PERF-02 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
