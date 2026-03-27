# OtakuPulse — Stabilization & Optimization

## What This Is

AI パワードのオタクニュースアグリゲーター（Tauri v2 デスクトップアプリ）の安定化・最適化マイルストーン。新機能追加ではなく、既存機能の品質・パフォーマンス・テストカバレッジ・セキュリティを全面的に底上げする。

## Core Value

**既存機能が正しく・速く・安全に動作すること。** ユーザーが気づかないバグや性能問題をゼロに近づけ、今後の機能追加に耐えるコードベースにする。

## Requirements

### Validated

- ✓ 4層 Rust バックエンド（commands → services → infra → parsers） — existing
- ✓ React 19 + TypeScript + Tailwind CSS v4 フロントエンド — existing
- ✓ RSS/Atom フィード収集（feed-rs） — existing
- ✓ AniList GraphQL 季節アニメ・トレンド漫画取得 — existing
- ✓ RAWG ゲーム情報取得 — existing
- ✓ Steam ニュース取得 — existing
- ✓ Reddit RSS フィード取得 — existing
- ✓ AI 要約・ダイジェスト生成（Ollama / Perplexity） — existing
- ✓ DeepDive Q&A 機能 — existing
- ✓ パーソナルスコアリング（ユーザー嗜好学習） — existing
- ✓ 重複排除（dedup_service） — existing
- ✓ スケジューラー（定期収集・ダイジェスト） — existing
- ✓ OPML インポート — existing
- ✓ 資格情報ストア（OS credential manager） — existing
- ✓ 全文検索（FTS5） — existing

### Active

**Tech Debt:**
- [ ] setup コードの panic 排除（lib.rs の unwrap_or_else）
- [ ] Mutex lock poisoning リスク対応
- [ ] digest_loop の並列化（serial → tokio::join_all）
- [ ] DeepDive キャッシュの unwrap_or_default 改善
- [ ] personal_scoring の JSON バリデーション強化
- [ ] rate_limiter のトークン精度修正（f64 化）
- [ ] dedup の Unicode 正規化一貫性修正

**Known Bugs:**
- [ ] URL クエリパラメータ順序による dedup 漏れ修正
- [ ] DeepDive キャッシュ無効化の実装（summary hash + TTL）

**Security:**
- [ ] Perplexity API キーのログ漏洩防止監査
- [ ] user profile JSON のサイズ制限（DB + UI）

**Performance:**
- [ ] URL 正規化の並列化（rayon）
- [ ] personal_scoring の 3 クエリ → 1 クエリ統合
- [ ] FTS 検索のページネーション最適化
- [ ] highlights の N+1 クエリ解消

**Fragile Areas:**
- [ ] DeepDive キャッシュ定期クリーンアップ + LRU
- [ ] Scheduler config のランタイム同期（Arc<RwLock>）
- [ ] RSS パースエラーの可視化
- [ ] articleFilter のフロント/バックエンド重複排除
- [ ] OPML インポートの URL バリデーション

**Dependencies:**
- [ ] feedrs のバージョン固定 + 代替評価
- [ ] reqwest のバージョン固定 + circuit breaker 検討
- [ ] sqlx オフラインモード対応

**Test Coverage:**
- [ ] dedup_service の包括テスト（20+ ケース）
- [ ] AniList rate limiter のストレステスト
- [ ] Scheduler shutdown のテスト（CancellationToken）
- [ ] personal_scoring のエッジケーステスト
- [ ] TypeScript hook のエラーハンドリングテスト
- [ ] コンポーネントの部分データレンダリングテスト

**Incomplete Features:**
- [ ] Config ホットリロード（Tauri event 通知）
- [ ] LLM プロバイダー切り替えの安全化
- [ ] オフラインモード（API 不達時のグレースフルデグラデーション）

### Out of Scope

- 新規 Wing（画面）の追加 — 安定化マイルストーンのため
- 新しい API ソースの追加 — 既存ソースの安定化が優先
- UI デザインの大幅変更 — 機能的な改善のみ
- OAuth / ユーザー認証 — デスクトップアプリで不要

## Context

- OtakuPulse は既に動作する Tauri v2 デスクトップアプリ
- 4 Wings 構成: Dashboard, Feed, Digest, Settings
- CONCERNS.md の全30+項目を対象とするスタビライゼーション
- Rust バックエンドは 4層アーキテクチャ（commands → services → infra → parsers）
- コードベースマッピング済み（`.planning/codebase/` に7ドキュメント）

## Constraints

- **Tech stack**: 既存スタック維持（Tauri v2, Rust, React 19, TypeScript, SQLite）
- **Architecture**: 4層アーキテクチャを崩さない
- **Compatibility**: 既存の DB スキーマとの後方互換性を維持
- **Testing**: 変更には必ず対応テストを追加

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 新機能なし、安定化のみ | 既存機能の品質が今後の拡張の土台 | — Pending |
| CONCERNS.md 全項目対応 | 部分対応では技術的負債が蓄積 | — Pending |
| バランス型最適化 | 特定領域に偏らず全面的に底上げ | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
