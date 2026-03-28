# Phase 3: Performance & Test Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 03-performance-test-coverage
**Areas discussed:** テスト戦略と優先順位, カバレッジインフラ, ダイジェスト並列化エラー戦略, パフォーマンス検証方法

---

## テスト戦略と優先順位

### Rust vs TypeScript 優先順位

| Option | Description | Selected |
|--------|-------------|----------|
| Rust バックエンド優先 | dedup, rate_limiter, scheduler, personal_scoring などコアロジックのテストを先に固める | ✓ |
| Rust と TS を交互に | 各プランで Rust と TS を混ぜて実装 | |
| TS フロントエンド優先 | hook エラーハンドリングとコンポーネントテストを先に書く | |

**User's choice:** Rust バックエンド優先
**Notes:** なし

### dedup テストスイート深度

| Option | Description | Selected |
|--------|-------------|----------|
| 20+ ケース包括的 | Unicode エッジケース、URL バリエーション、content_hash 衝突、Jaccard 類似度境界値を全てカバー | ✓ |
| 15 ケース程度 | 主要な Unicode + URL パターンのみ。エッジケースはスキップ | |

**User's choice:** 20+ ケース包括的
**Notes:** REQUIREMENTS 定義通り

### Phase 2 テスト深度

| Option | Description | Selected |
|--------|-------------|----------|
| ユニットテスト中心 | 各機能のユニットテスト追加。CancellationToken 発火、ホットリロード event、オフラインフォールバック等 | ✓ |
| 統合テストも含む | ユニット + シャットダウンシーケンス全体やオフライン→オンライン復帰の E2E フロー | |
| Claude に任せる | 各機能のテスト可能性とコストを見て判断 | |

**User's choice:** ユニットテスト中心
**Notes:** なし

### TS コンポーネントテストアプローチ

| Option | Description | Selected |
|--------|-------------|----------|
| スナップショットテスト | レンダリング結果をスナップショットで固定 | |
| アサーションベース | Testing Library で振る舞いを検証 | ✓ |
| Claude に任せる | コンポーネントごとに最適なアプローチを判断 | |

**User's choice:** アサーションベース
**Notes:** なし

---

## カバレッジインフラ (TEST-07)

| Option | Description | Selected |
|--------|-------------|----------|
| レポート生成のみ | cargo-llvm-cov + @vitest/coverage-v8 導入、ローカルレポート生成可能に。閾値・CI 連携は後回し | ✓ |
| 閾値付き + CI 連携 | 閾値設定 + CI でカバレッジ下回りをブロック | |
| Claude に任せる | 現時点のテスト量を見て適切な閾値を判断 | |

**User's choice:** レポート生成のみ
**Notes:** なし

---

## ダイジェスト並列化エラー戦略 (PERF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 部分成功を許容 | 失敗カテゴリはログしてスキップ、他カテゴリは正常に続行 | ✓ |
| 全体失敗 | 1カテゴリ失敗でダイジェスト全体を失敗としてリトライ | |
| Claude に任せる | 実装時に最適なエラー戦略を判断 | |

**User's choice:** 部分成功を許容
**Notes:** なし

---

## パフォーマンス検証方法

| Option | Description | Selected |
|--------|-------------|----------|
| テスト内アサーションのみ | N+1 解消、並列実行をテストで確認。ベンチマーク不導入 | ✓ |
| criterion ベンチマーク導入 | マイクロベンチマークで before/after を数値比較 | |
| Claude に任せる | 各 PERF 項目の特性に応じて検証方法を判断 | |

**User's choice:** テスト内アサーションのみ
**Notes:** なし

---

## Phase 2 テストスコープ

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 スコープ内で網羅 | TEST-03 + Phase 2 の他の機能（ホットリロード、オフラインモード）もテストに含める | ✓ |
| TEST-01〜07 のみ厳守 | REQUIREMENTS.md 定義の TEST-01〜07 だけを対象 | |

**User's choice:** Phase 3 スコープ内で網羅
**Notes:** なし

---

## Claude's Discretion

- PERF-03〜06 の具体的な SQL/実装設計
- PERF-02 のカテゴリ毎タイムアウト値
- Phase 2 テストの具体的なテストケース設計

## Deferred Ideas

None — discussion stayed within phase scope
