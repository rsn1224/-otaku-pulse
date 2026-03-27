# Phase 1: Foundation Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-foundation-correctness
**Areas discussed:** 起動失敗時のユーザー体験, NFKC 移行, DeepDive キャッシュ, フィルタ移行, WAL モード, lock poisoning, エラーハンドリング, rate_limiter, 依存ピンニング, sqlx オフラインモード

---

## 起動失敗時のユーザー体験 (SAFE-01)

### Q1: DB 初期化が失敗したとき、アプリはどうすべきですか？

| Option | Description | Selected |
|--------|-------------|----------|
| エラー画面で表示 | setup() は Err を返し、最小限の WebView でエラーページを表示。リトライやログフォルダへのリンクも含む。 | ✓ |
| OS 通知で告知 | Tauri notification プラグインで OS ネイティブ通知を出し、アプリは終了。 | |
| Claude におまかせ | 技術的に最適な方法を Claude が判断。 | |

**User's choice:** エラー画面で表示

### Q2: エラー画面に「リトライ」ボタンを付けますか？

| Option | Description | Selected |
|--------|-------------|----------|
| リトライ + ログフォルダ表示 | 「再試行」ボタンで setup を再実行し、「ログを開く」で OS のログディレクトリを開く。 | ✓ |
| ログフォルダ表示のみ | リトライなし。エラーメッセージとログフォルダへのリンクのみ。 | |
| Claude におまかせ | 技術的制約に基づいて最適な方法を判断。 | |

**User's choice:** リトライ + ログフォルダ表示

### Q3: エラーメッセージの言語は？

| Option | Description | Selected |
|--------|-------------|----------|
| 日本語のみ | アプリのターゲットが日本語話者なので日本語で表示。 | ✓ |
| 英語のみ | 技術エラーは英語が標準的。ログも英語なので一貫性がある。 | |
| Claude におまかせ | プロジェクトの他の UI メッセージに合わせて判断。 | |

**User's choice:** 日本語のみ

---

## NFKC 移行と既存データ戦略 (BUG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| マイグレーションで一括再 dedup | DB マイグレーションで is_duplicate をリセットし、次回収集時に NFKC で再 dedup。既存記事のタイトルも NFKC 正規化して content_hash を再計算。 | ✓ |
| 新規記事のみ適用 | 既存データはそのまま。今後収集される記事から NFKC を適用。既存重複は残る。 | |
| Claude におまかせ | データ量と影響範囲を見て判断。 | |

**User's choice:** マイグレーションで一括再 dedup

---

## DeepDive キャッシュ無効化ポリシー (BUG-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 24時間 | REQUIREMENTS.md の BUG-02 で提案済み。ニュースの鮮度とトークンコストのバランスが良い。summary_hash 変更時は即座無効化。 | ✓ |
| 1時間 | 現在のサマリーキャッシュと同じ TTL。頻繁に再生成されるがトークン消費が大きい。 | |
| Claude におまかせ | トークンコストと鮮度のバランスを見て判断。 | |

**User's choice:** 24時間

---

## フィルタ移行 (FRNT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| ミュートフィルタのみ Rust に移動 | applyMuteFilters を Rust の get_discover_feed クエリに組み込み、DB レベルで除外。getHighlightKeywords はフロントに残す。 | ✓ |
| 両方とも Rust に移動 | applyMuteFilters と getHighlightKeywords の両方を Rust 側に移動。articleFilter.ts を完全に削除。 | |
| Claude におまかせ | フィルタの性質を見て移行先を判断。 | |

**User's choice:** ミュートフィルタのみ Rust に移動

---

## WAL モード有効化 (PERF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| 接続時 PRAGMA | database.rs の init_pool() で PRAGMA journal_mode=WAL を実行。マイグレーション不要でシンプル。 | ✓ |
| DB マイグレーションで実行 | migrations/ に新規 SQL マイグレーションとして追加。履歴が残るが sqlx との互換性検証が必要。 | |
| Claude におまかせ | sqlx との互換性を調査して判断。 | |

**User's choice:** 接続時 PRAGMA

---

## Lock Poisoning 対処 (SAFE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| AppError::Internal で統一 | 全ての lock().expect() を lock().map_err() に置換。? 演算子でエラー伝搬。 | ✓ |
| parking_lot に移行 | parking_lot::RwLock は poisoning しないため問題自体が解消。依存追加が必要。 | |
| Claude におまかせ | 影響範囲とトレードオフを見て判断。 | |

**User's choice:** AppError::Internal で統一

---

## エラーハンドリング改善 (SAFE-03, SAFE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| 警告ログ + デフォルト値継続 | tracing::warn! でログ出力し、デフォルト値で継続。UX を壊さず問題を可視化。 | ✓ |
| AppError で即座エラー返却 | 破損データ検出時に AppError::InvalidInput を返し、フロントにエラートースト表示。 | |
| Claude におまかせ | ケースごとに最適なアプローチを判断。 | |

**User's choice:** 警告ログ + デフォルト値継続

---

## Rate Limiter 精度修正 (BUG-04)

| Option | Description | Selected |
|--------|-------------|----------|
| f64 で素直に修正 | トークンを f64 で管理し、acquire 時にのみ整数判定。端数トークンの損失を防ぐ。 | ✓ |
| Claude におまかせ | 実装の詳細は Claude が判断。 | |

**User's choice:** f64 で素直に修正

---

## 依存ピンニング (DEP-01, DEP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| マイナーバージョン固定 | Cargo.toml で `~` でマイナーバージョンを固定。パッチは自動受入、メジャー更新は手動。 | ✓ |
| 完全固定（exact） | `=X.Y.Z` で完全にバージョンをロック。セキュリティパッチも手動更新が必要。 | |
| Claude におまかせ | Rust エコシステムのベストプラクティスに従って判断。 | |

**User's choice:** マイナーバージョン固定

---

## sqlx オフラインモード (DEP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Git にコミット | .sqlx/ ディレクトリをリポジトリに含める。CI で DB 不要でビルド可能。スキーマ変更時に cargo sqlx prepare で再生成。 | ✓ |
| CI で毎回生成 | CI パイプラインで SQLite DB を作成してマイグレーション実行後にビルド。リポジトリに .sqlx/ を含めない。 | |
| Claude におまかせ | CI 環境との互換性を見て判断。 | |

**User's choice:** Git にコミット

---

## Claude's Discretion

- URL クエリパラメータのソートアルゴリズムの具体的実装（BUG-01）
- content_hash 再計算のバッチサイズとタイミング
- エラーページの具体的な HTML/CSS デザイン
- NFKC マイグレーション SQL の具体的な実装

## Deferred Ideas

None — discussion stayed within phase scope
