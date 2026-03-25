# OtakuPulse — プロジェクト完了レポート

**日付:** 2026-03-25
**ステータス:** 全 Phase 完了、MVP 起動確認済み
**テスト:** 58 件全パス
**ビルド:** cargo check + tsc --noEmit クリーン

---

## プロジェクト概要

アニメ・漫画・ゲーム・PC ハードウェアの最新情報を自動収集し、AI 要約ダイジェストとして毎日届けるデスクトップアプリ。

**技術スタック:**
- BE: Tauri v2 + Rust + SQLite (sqlx)
- FE: React 19 + TypeScript + Tailwind CSS v4 + Zustand
- LLM: Perplexity Sonar / Ollama (LlmClient trait で抽象化)
- スケジューラ: tokio-cron-scheduler

---

## 完了フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| 0 | 骨格 + 設計書 7 本 + 4 層アーキテクチャ | 完了 |
| 1 | 収集エンジン (RSS/AniList/Steam/Reddit + 3 層 dedup + scoring) | 完了 |
| 2 | UI (NEWS Wing + Digest Wing + コンポーネント分割) | 完了 |
| 3 | LLM ダイジェスト (Perplexity Sonar + Ollama + trait 抽象化) | 完了 |
| 4 | スケジューラ (自動収集 + 朝のダイジェスト + トースト通知) | 完了 |
| P0 | 必須機能 (検索/キーボード/OPML/記事閲覧/フィード管理/未読カウント/エラーバウンダリ/クリーンアップ) | 完了 |
| バグ修正 | CRITICAL 6 件 + コンパイルエラー修正 | 完了 |

---

## アーキテクチャ (4 層 + state)

```
src-tauri/src/
├── commands/     ← Tauri コマンド定義のみ (ロジック禁止)
│   ├── articles.rs, digest.rs, feed.rs, llm.rs, scheduler.rs, settings.rs
├── services/     ← ビジネスロジック
│   ├── collector.rs, dedup_service.rs, digest_generator.rs
│   ├── digest_queries.rs, feed_queries.rs, opml_service.rs
│   ├── scheduler.rs, scoring_service.rs
├── infra/        ← 外部 I/O
│   ├── http_client.rs, rate_limiter.rs, database.rs
│   ├── rss_fetcher.rs, anilist_client.rs, steam_client.rs, reddit_fetcher.rs
│   ├── llm_client.rs, ollama_client.rs, perplexity_client.rs, notification.rs
├── parsers/      ← 純粋関数のみ (I/O 禁止)
│   ├── rss_parser.rs, bbcode_parser.rs, graphql_parser.rs
├── models/       ← DB モデル + DTO
├── error.rs      ← AppError + CmdResult<T>
├── state.rs      ← AppState (Arc<SqlitePool> + Arc<Client> + LLM 設定)
├── lib.rs        ← エントリポイント
└── main.rs
```

```
src/
├── components/
│   ├── layout/     ← AppShell, Sidebar, TitleBar
│   ├── wings/      ← DashboardWing, NewsWing, SettingsWing
│   ├── common/     ← ArticleCard, ArticleReader, SearchBar, ErrorBoundary 等
│   ├── digest/     ← DigestCard, DigestSkeleton, GenerateButton
│   └── settings/   ← LlmSettingsSection, SchedulerSection
├── stores/         ← Zustand ストア (appStore, feedStore, digestStore 等)
├── hooks/          ← useKeyboardShortcuts
├── wings/          ← DigestWing
├── types/          ← TypeScript 型定義
└── App.tsx         ← → AppShell
```

---

## 主要機能

### 収集エンジン
- RSS フィード (feed-rs) + 条件付きリクエスト (ETag/Last-Modified)
- AniList GraphQL (季節アニメ + トレンドマンガ)
- Steam News API (BBCode パーサー付き)
- Reddit RSS (.rss 第一選択、.json フォールバック)
- レートリミッター (トークンバケット、AniList 30 req/min)
- フィード auto-disable (連続エラー 3 回)

### 重複排除 (3 層)
- Layer 1: URL 正規化 (トラッキングパラメータ除去)
- Layer 2: タイトル Jaccard bigram 類似度 (閾値 0.6)
- Layer 3: コンテンツハッシュ (SHA-256、専用カラム + インデックス)

### AI ダイジェスト
- Perplexity Sonar API (クラウド)
- Ollama (ローカル LLM、Qwen 2.5 7B 推奨)
- LlmClient trait で抽象化 → プロバイダー切替可能
- カテゴリ別プロンプト (anime/manga/game/pc)
- フォールバック: スタブ要約 + エラー理由表示

### スケジューラ
- tokio-cron-scheduler で自動収集
- 毎朝 8:00 に自動ダイジェスト生成
- Settings UI から設定変更可能
- トースト通知

### UI
- ダークモード統一 (bg-gray-800/900/950)
- カスタムタイトルバー (decorations: false)
- NEWS Wing: カテゴリタブ + 記事カード + 無限スクロール + 未読バッジ
- Digest Wing: カテゴリ別ダイジェスト + 生成ボタン + プロバイダーバッジ
- Settings Wing: フィード管理 + LLM 設定 + スケジューラ設定 + OPML
- キーボードショートカット (1-4: Wing, R: 更新, /: 検索)
- エラーバウンダリ

---

## ファイル数

| カテゴリ | ファイル数 |
|---------|-----------|
| Rust (BE) | 32 |
| TypeScript/React (FE) | 30 |
| 設計書 (docs/) | 7 |
| ルール (.claude/rules/) | 7 |
| GraphQL | 3 |
| SQL (migrations) | 1 |
| 設定 (Cargo.toml, package.json 等) | 6 |
| **合計** | **86** |

---

## 起動方法

```bash
cd c:\Users\rsn12\dev\otaku-pulse
npm run tauri dev
```

---

## 技術的判断メモ

- `sqlx::query!` マクロは使わない → `sqlx::query` ランタイム版 (DATABASE_URL 不要)
- `Mutex<AppState>` 禁止 → 個別 `app.manage()` + AppState で Arc 共有
- React Query 不採用 → Zustand + invoke のみ (Tauri IPC は HTTP ではない)
- `dangerouslySetInnerHTML` 禁止 → Markdown テキスト表示
- content_hash は `articles.content_hash` 専用カラム (metadata JSON 禁止)

---

## AI 協業ワークフロー

| 役割 | 担当 | 実績 |
|------|------|------|
| 設計・レビュー・バグ修正 | Claude Code | 設計書 7 本、CRITICAL バグ 6 件修正、コードレビュー |
| 実装 | Cascade (Windsurf) | Phase 1-4 実装 (要レビュー・修正) |
| 設計相談 | Perplexity | v2 プロンプト作成 |

**注意:** Cascade は過去 2 回間違ったディレクトリで作業した。指示時は必ずパスを明記。
