# OtakuPulse 開発ロードマップ

<!-- 最終更新: 2026-03-25 -->

> OtakuPulse — オタク向け情報収集・AI要約デスクトップアプリの段階的開発計画

---

## 全体概要

| Phase | テーマ | 依存 | 目安期間 |
|-------|--------|------|----------|
| 0 | 基盤構築 | なし | 1週間 |
| 1 | 収集エンジン | Phase 0 | 2週間 |
| 2 | AI 要約 | Phase 1 | 1.5週間 |
| 3 | UI 実装 | Phase 0（部分的に Phase 1・2） | 2週間 |
| 4 | 通知 + 仕上げ | Phase 1〜3 全完了 | 1週間 |

### AI 協業ワークフロー（全 Phase 共通）

```
Claude Code: 仕様書作成 → HANDOFF.md 記入（pending）
Cascade:     実装（in-progress → review）
Claude Code: コードレビュー → フィードバック → done
```

---

## Phase 0: 基盤構築

### 目標

プロジェクトの骨格を確立し、全 Phase の土台を整える。

### タスク

1. **プロジェクトスキャフォールディング + 設計ドキュメント**
   - Tauri v2 + React + TypeScript プロジェクト初期化
   - Biome / Clippy / テスト設定
   - `docs/DATA_MODEL.md`, `docs/ROADMAP.md` 整備
2. **DB スキーマ + マイグレーション + デフォルトフィード登録**
   - SQLite スキーマ定義（`migrations/` ディレクトリ）
   - `feeds`, `articles`, `digests`, `settings` テーブル作成
   - 初回起動時のデフォルトフィード INSERT
3. **基本 Tauri ウィンドウ + システムトレイ**
   - メインウィンドウ設定（`tauri.conf.json`）
   - システムトレイアイコン + 右クリックメニュー
4. **FE: AppShell + Sidebar + 4 Wing プレースホルダー**
   - `src/components/AppShell.tsx` — レイアウト骨格
   - `src/components/Sidebar.tsx` — ナビゲーション
   - `src/wings/DashboardWing.tsx` — プレースホルダー
   - `src/wings/FeedWing.tsx` — プレースホルダー
   - `src/wings/DigestWing.tsx` — プレースホルダー
   - `src/wings/SettingsWing.tsx` — プレースホルダー

### 主要ファイル

| ファイル | 種別 |
|----------|------|
| `src-tauri/migrations/*.sql` | 新規作成 |
| `src-tauri/src/db.rs` | 新規作成 |
| `src-tauri/tauri.conf.json` | 修正 |
| `src/components/AppShell.tsx` | 新規作成 |
| `src/components/Sidebar.tsx` | 新規作成 |
| `src/wings/*.tsx` | 新規作成（4ファイル） |

### 完了条件

- `cargo check` + `npm run check` がエラーなしで通過
- ウィンドウが表示され、Sidebar から 4 Wing を切り替え可能
- システムトレイにアイコンが表示される

### リスク

- Tauri v2 のシステムトレイ API は変更が多いため、公式ドキュメントの最新版を確認すること
- SQLite マイグレーションの実行順序管理（`sqlx` の `migrate!` マクロで対応）

---

## Phase 1: 収集エンジン

**依存: Phase 0 完了（DB スキーマ + Tauri 基本動作）**

### 目標

4 ソース（RSS / AniList / Steam / Reddit）からの記事収集パイプラインを構築する。

### タスク

1. **共有 HTTP クライアント**
   - `Arc<reqwest::Client>` をアプリ状態として管理
   - タイムアウト・リトライ・User-Agent 設定
2. **レートリミッター** — `src-tauri/src/infra/rate_limiter.rs`
   - トークンバケット方式、ソース別レート設定
3. **RSS フィード収集** — `feed-rs` クレート
   - 条件付きリクエスト（`ETag` / `Last-Modified` ヘッダー）
   - `src-tauri/src/collectors/rss_collector.rs`
4. **AniList GraphQL クライアント** — `graphql_client` クレート
   - トレンドアニメ・放送中作品の取得
   - `src-tauri/src/collectors/anilist_collector.rs`
5. **Steam News API クライアント**
   - BBCode → プレーンテキスト変換パーサー
   - `src-tauri/src/collectors/steam_collector.rs`
6. **Reddit RSS 収集** — `.rss` 形式を `feed-rs` でパース
   - `src-tauri/src/collectors/reddit_collector.rs`
7. **Collector トレイト + CollectorService**
   - `src-tauri/src/collectors/mod.rs` — `Collector` トレイト定義
   - `src-tauri/src/services/collector_service.rs` — オーケストレーション
8. **`dedup_service.rs` — 3 層重複排除**（Phase 4 からの前倒し）
9. **フィード auto-disable**（連続エラー 3 回で自動無効化）
10. **スケジューラー** — `tokio-cron-scheduler`
   - `src-tauri/src/infra/scheduler.rs`
   - cron 式で定期実行、Settings Wing から変更可能な設計

### 主要ファイル

| ファイル | 種別 |
|----------|------|
| `src-tauri/src/infra/rate_limiter.rs` | 新規作成 |
| `src-tauri/src/infra/scheduler.rs` | 新規作成 |
| `src-tauri/src/infra/http_client.rs` | 新規作成 |
| `src-tauri/src/collectors/mod.rs` | 新規作成 |
| `src-tauri/src/collectors/rss_collector.rs` | 新規作成 |
| `src-tauri/src/collectors/anilist_collector.rs` | 新規作成 |
| `src-tauri/src/collectors/steam_collector.rs` | 新規作成 |
| `src-tauri/src/collectors/reddit_collector.rs` | 新規作成 |
| `src-tauri/src/services/collector_service.rs` | 新規作成 |
| `src-tauri/Cargo.toml` | 修正（依存追加） |

### 完了条件

- 手動トリガーで全ソースから記事を取得し、dedup 後 DB に永続化される
- 3 層重複排除が動作する（URL 正規化 + Jaccard bigram + content_hash）
- 条件付きリクエストにより重複フェッチが回避される
- レートリミッターがソース別に動作する

### リスク

- AniList API のレート制限（実効 30 req/min、公称値を信用しないこと）— リミッター設定で対応
- Reddit の `.rss` 形式は非公式、フォーマット変更の可能性あり
- Steam BBCode の方言バリエーション — パーサーのテストケースを充実させること

---

## Phase 2: AI 要約

**依存: Phase 1 完了（収集エンジンが DB に記事を格納済み）**

### 目標

収集した記事を LLM で要約し、カテゴリ別ダイジェストを生成する。

### タスク

1. **Ollama クライアント** — `src-tauri/src/infra/llm_client.rs`
   - ローカル Ollama サーバーとの通信（REST API）
   - モデル選択・パラメータ設定
2. **OpenAI API フォールバック**
   - Ollama 接続失敗時に OpenAI API へ切り替え
   - API キーは OS キーチェーン経由で管理（ハードコード禁止）
3. **カテゴリ別要約プロンプトエンジン**
   - `src-tauri/src/services/prompt_engine.rs`
   - アニメ / ゲーム / 技術 etc. カテゴリごとにプロンプトテンプレート切り替え
4. **ダイジェストジェネレーター** — `src-tauri/src/services/digest_generator.rs`
   - 記事群 → 要約 → ダイジェストレコード生成
   - カテゴリ別バッチ処理
5. **Markdown/HTML レポート出力** — `pulldown-cmark` クレート
   - ダイジェストを Markdown → HTML に変換
   - ファイルエクスポート機能

### 主要ファイル

| ファイル | 種別 |
|----------|------|
| `src-tauri/src/infra/llm_client.rs` | 新規作成 |
| `src-tauri/src/services/prompt_engine.rs` | 新規作成 |
| `src-tauri/src/services/digest_generator.rs` | 新規作成 |
| `src-tauri/Cargo.toml` | 修正（pulldown-cmark 追加） |

### 完了条件

- カテゴリ別ダイジェストが生成され、DB に永続化される
- Markdown/HTML ファイルとして出力可能
- Ollama 未起動時に OpenAI フォールバックが動作する

### リスク

- Ollama のモデルサイズとメモリ消費 — 推奨モデルを Settings に明記
- LLM レスポンスの品質ばらつき — プロンプトのイテレーションが必要
- OpenAI API コスト — トークン使用量の表示・制限機能を検討

---

## Phase 3: UI 実装

**依存: Phase 0（AppShell）、部分的に Phase 1（記事データ）・Phase 2（ダイジェストデータ）**

### 目標

4 Wing をフル実装し、ユーザーが全機能を操作できるようにする。

### タスク

1. **Dashboard Wing** — 今日のダイジェスト概要
   - カテゴリカード（記事数・要約プレビュー）
   - 注目記事ハイライト
   - 最終収集時刻表示
2. **Feed Wing** — 記事一覧・管理
   - 記事リスト + フィルター（ソース / カテゴリ / 既読状態）
   - 無限スクロール（仮想リスト）
   - 既読管理（クリックで既読、一括既読）
3. **Digest Wing** — AI 要約ビューア
   - カテゴリタブ切り替え
   - ダイジェスト履歴一覧
   - 再生成ボタン（手動トリガー）
   - Markdown レンダリング表示
4. **Settings Wing** — 設定管理
   - フィード管理（追加 / 編集 / 削除 / 有効・無効切替）
   - スケジュール設定（cron 式 or プリセット）
   - LLM 設定（Ollama URL / OpenAI API キー / モデル選択）
   - 通知設定（有効・無効 / 重要度閾値）

### 主要ファイル

| ファイル | 種別 |
|----------|------|
| `src/wings/DashboardWing.tsx` | 修正（実装） |
| `src/wings/FeedWing.tsx` | 修正（実装） |
| `src/wings/DigestWing.tsx` | 修正（実装） |
| `src/wings/SettingsWing.tsx` | 修正（実装） |
| `src/components/*.tsx` | 新規作成（各種 UI コンポーネント） |
| `src/hooks/*.ts` | 新規作成（Tauri invoke ラッパー） |
| `src-tauri/src/commands/*.rs` | 新規作成（Tauri コマンド） |

### 完了条件

- 全 Wing のナビゲーションと基本操作が機能する
- 記事のフィルタリング・既読管理が動作する
- ダイジェストの閲覧・再生成が動作する
- 設定変更が永続化される

### リスク

- 無限スクロールのパフォーマンス — 仮想リスト（`@tanstack/react-virtual`）で対処
- Tauri invoke のエラーハンドリング — plain object として `JSON.stringify` パターン必須
- 状態管理の複雑化 — Zustand 等の軽量ストアで管理

---

## Phase 4: 通知 + 仕上げ

**依存: Phase 1〜3 全完了**

### 目標

重要度スコアリング・重複排除・通知を実装し、全機能を統合テストする。

### タスク

1. **重要度スコアリング** — `src-tauri/src/services/scoring_service.rs`
   - 記事メタデータ（ソース信頼度 / エンゲージメント / 鮮度）に基づくスコア算出
   - スコア閾値による通知トリガー
2. ~~3層重複排除エンジン~~ → **Phase 1 に前倒し済み**
3. **Windows トースト通知** — `tauri-plugin-notification`
   - 重要記事の即座通知
   - ダイジェスト完成通知
   - 通知クリックでアプリ内該当箇所へ遷移
4. **既読管理の仕上げ**
   - 自動既読（一定時間表示で既読化）
   - 一括既読操作
   - 未読フィルターの最適化

### 主要ファイル

| ファイル | 種別 |
|----------|------|
| `src-tauri/src/services/scoring_service.rs` | 新規作成 |
| `src-tauri/src/services/dedup_service.rs` | 新規作成 |
| `src-tauri/src/lib.rs` | 修正（プラグイン登録） |
| `src-tauri/Cargo.toml` | 修正（notification プラグイン追加） |

### 完了条件

- 全機能の統合テストがパスする
- 重要記事が Windows トースト通知で届く
- 重複記事が 3 層フィルターで排除される
- 既読管理が全操作パターンで正しく動作する

### リスク

- 重複排除の誤判定（偽陽性）— 閾値チューニングとユーザー報告機能で対応
- Windows 通知権限 — アプリ初回起動時に権限リクエストを案内
- 統合テストの網羅性 — E2E テストシナリオを事前に設計すること

---

## 補足: Phase 間の依存関係図

```
Phase 0 ─────────────────────────────────┐
  │                                       │
  ├── Phase 1（収集エンジン）              │
  │     │                                 │
  │     └── Phase 2（AI 要約）            │
  │                                       │
  └── Phase 3（UI 実装）←─ Phase 1, 2 のデータ
                │
                └── Phase 4（通知 + 仕上げ）←─ Phase 1〜3 全完了
```

> Phase 3 は Phase 0 完了後に着手可能だが、実データ表示には Phase 1・2 の完了が必要。
> モック データで先行開発し、バックエンド完成後に結合する戦略を推奨する。
