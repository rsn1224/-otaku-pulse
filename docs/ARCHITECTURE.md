# OtakuPulse アーキテクチャ設計書

<!-- 最終更新: 2026-03-19 -->

## 概要

OtakuPulse は、アニメ・マンガ・ゲーム・PC ハードウェアのニュースを自動収集し、
AI ダイジェストを生成する Tauri v2 デスクトップアプリケーションである。

本ドキュメントでは、バックエンド（Rust）とフロントエンド（React）の設計方針、
レイヤー構成、データフロー、エラーハンドリング戦略を定義する。

---

## 1. 4 レイヤーアーキテクチャ

### レイヤー定義

| レイヤー | ディレクトリ | 責務 | 許可される依存先 | 禁止事項 |
|----------|-------------|------|-----------------|----------|
| **Commands** | `src-tauri/src/commands/` | Tauri コマンド定義（FE との境界） | services/, infra/(State 取得のみ) | ビジネスロジックの実装 |
| **Services** | `src-tauri/src/services/` | ビジネスロジック（収集オーケストレーション、要約、スコアリング、重複排除） | infra/, parsers/ | 直接的な外部 I/O、FE 依存 |
| **Infra** | `src-tauri/src/infra/` | 外部 I/O（HTTP クライアント、DB アクセス、LLM クライアント、レートリミッター） | parsers/(変換が必要な場合) | services/ への逆依存 |
| **Parsers** | `src-tauri/src/parsers/` | データ変換（RSS→Article、GraphQL→Article、BBCode→テキスト） | なし（標準ライブラリ・crateのみ） | 副作用、I/O、状態保持 |

### レイヤー間の依存関係図

```
commands/
    ↓ 呼び出し
services/
    ↓ 呼び出し          ↓ 呼び出し
infra/              parsers/
    ↓ 呼び出し(変換が必要な場合)
parsers/
```

### 各レイヤーの詳細

#### Commands 層（`commands/`）

- Tauri の `#[tauri::command]` 定義のみを配置する
- State の取り出しと services 層への委譲が唯一の責務
- **ビジネスロジックの記述は厳禁**（if 分岐による判定すら services に委ねる）

```rust
// OK — services に委譲するだけ
#[tauri::command]
async fn get_feed_articles(
    db: State<'_, SqlitePool>,
    category: String,
) -> Result<Vec<ArticleDto>, AppError> {
    services::feed::get_articles(&db, &category).await
}

// NG — commands 層にビジネスロジックが漏れている
#[tauri::command]
async fn get_feed_articles(
    db: State<'_, SqlitePool>,
    category: String,
) -> Result<Vec<ArticleDto>, AppError> {
    let articles = sqlx::query_as!(...)  // 直接 DB アクセス
        .fetch_all(&*db).await?;
    let filtered = articles.into_iter()  // フィルタロジック
        .filter(|a| a.score > 50)
        .collect();
    Ok(filtered)
}
```

#### Services 層（`services/`）

- 収集オーケストレーション、AI 要約生成、スコアリング、重複排除などのビジネスロジック
- infra 層と parsers 層を組み合わせてユースケースを実現する
- 外部 I/O を直接行わない（必ず infra 層を経由する）

主要モジュール:

| モジュール | 責務 |
|-----------|------|
| `feed.rs` | フィード収集のオーケストレーション |
| `summarizer.rs` | AI ダイジェスト生成の制御 |
| `scorer.rs` | 記事の関連度スコアリング |
| `dedup.rs` | 重複記事の検出・排除 |
| `scheduler.rs` | 定期収集スケジュールの管理 |

#### Infra 層（`infra/`）

- 外部世界とのすべての I/O を担当する
- HTTP リクエスト、データベースアクセス、LLM API 呼び出し、通知送信
- **services 層への逆依存は厳禁**（依存の方向を守る）

主要モジュール:

| モジュール | 責務 |
|-----------|------|
| `http_client.rs` | HTTP クライアント（reqwest ラッパー、リトライ・タイムアウト管理） |
| `database.rs` | SQLite アクセス（sqlx クエリ、マイグレーション） |
| `llm_client.rs` | Ollama / OpenAI API クライアント |
| `rate_limiter.rs` | API レートリミッター（トークンバケット） |
| `notification.rs` | デスクトップ通知送信 |

#### Parsers 層（`parsers/`）

- 外部データ形式から内部ドメインモデルへの変換を担当する
- **純粋関数のみ**（副作用禁止、I/O 禁止、状態保持禁止）
- 入力と出力が決定的であること（同じ入力 → 同じ出力）

主要モジュール:

| モジュール | 責務 |
|-----------|------|
| `rss_parser.rs` | RSS/Atom フィード → `Article` 変換 |
| `graphql_parser.rs` | AniList GraphQL レスポンス → `Article` 変換 |
| `html_sanitizer.rs` | HTML → プレーンテキスト変換 |
| `bbcode_parser.rs` | BBCode → テキスト変換 |

```rust
// parsers/ の関数は必ず純粋関数にする
pub fn parse_rss_feed(raw_xml: &str) -> Result<Vec<Article>, ParseError> {
    // I/O なし、副作用なし、状態なし
    let feed = feed_rs::parser::parse(raw_xml.as_bytes())?;
    feed.entries.into_iter().map(entry_to_article).collect()
}
```

---

## 2. State 共有パターン

### 禁止パターン: `Mutex<AppState>`

nexus プロジェクトでの教訓として、`Mutex<AppState>` による一括管理は
長時間ロック・デッドロックの原因となるため**厳禁**とする。

```rust
// NG — 長時間ロック、デッドロックの原因になる
struct AppState {
    db: SqlitePool,
    http: reqwest::Client,
    scheduler: JobScheduler,
    config: AppConfig,
}
app.manage(Mutex::new(AppState { ... }));
```

### 推奨パターン: 個別リソース登録

各リソースを `app.manage()` で個別に登録する。
内部にコネクションプーリングやスレッドセーフ機構を持つ型はそのまま登録し、
共有が必要な型のみ `Arc` でラップする。

```rust
// OK — 各リソースを個別に manage() で登録
app.manage(db_pool);          // SqlitePool（内部にコネクションプールを持つ）
app.manage(http_client);      // Arc<reqwest::Client>
app.manage(scheduler_handle); // Arc<JobScheduler>
app.manage(app_config);       // Arc<RwLock<AppConfig>>（設定は RwLock で読み書き分離）
```

### State 取得ルール

- `commands/` 層で `State<'_, T>` を受け取り、services 層に参照を渡す
- services 層は Tauri の `State` 型を直接使わない（テスタビリティのため）

```rust
// commands/ — State を取り出して services に渡す
#[tauri::command]
async fn refresh_feeds(
    db: State<'_, SqlitePool>,
    http: State<'_, Arc<reqwest::Client>>,
) -> Result<u32, AppError> {
    services::feed::refresh_all(&db, &http).await
}

// services/ — 具体的な型の参照を受け取る（State<T> ではない）
pub async fn refresh_all(
    db: &SqlitePool,
    http: &reqwest::Client,
) -> Result<u32, AppError> {
    // ビジネスロジック
}
```

---

## 3. データフロー

### 全体フロー図

```
┌──────────────┐
│ External     │  RSS, AniList GraphQL, Web スクレイピング
│ Sources      │
└──────┬───────┘
       ↓
┌──────────────┐
│ infra/       │  HTTP フェッチ、レートリミット適用
│ (fetch)      │
└──────┬───────┘
       ↓ 生データ (XML, JSON)
┌──────────────┐
│ parsers/     │  RSS→Article, GraphQL→Article, HTML→テキスト
│ (transform)  │
└──────┬───────┘
       ↓ Vec<Article>
┌──────────────┐
│ services/    │  重複排除、関連度スコアリング
│ (dedup/score)│
└──────┬───────┘
       ↓ Vec<Article>（スコア付き、重複なし）
┌──────────────┐
│ infra/       │  SQLite へ永続化
│ (database)   │
└──────┬───────┘
       ↓ 保存完了
┌──────────────┐
│ services/    │  LLM による AI ダイジェスト生成
│ (summarizer) │
└──────┬───────┘
       ↓ DigestDto
┌──────────────┐
│ commands/    │  Tauri コマンドとして FE に配信
│ (deliver)    │
└──────┬───────┘
       ↓ JSON
┌──────────────┐
│ Frontend     │  Zustand で状態管理、React で UI レンダリング
│ (UI render)  │
└──────┬───────┘
       ↓ 新着通知トリガー
┌──────────────┐
│ infra/       │  デスクトップ通知（トースト）
│ (notification)│
└──────────────┘
```

### 定期収集フロー

1. `services/scheduler` が cron ベースで収集タスクを起動
2. `services/feed` が登録済みフィードソースを取得
3. `infra/http_client` が各ソースからデータをフェッチ（レートリミット適用）
4. `parsers/` が生データを `Article` に変換
5. `services/dedup` が既存記事との重複を検出・排除
6. `services/scorer` が関連度スコアを計算
7. `infra/database` が新規記事を SQLite に保存
8. 閾値を超えた新着がある場合、`services/summarizer` がダイジェストを生成
9. `infra/notification` がデスクトップ通知を送信

---

## 4. BE/FE 責務分離

### 責務分担表

| 項目 | バックエンド (Rust) | フロントエンド (React/TS) |
|------|-------------------|--------------------------|
| **DateTime** | UTC で保存・処理 | `Asia/Tokyo` に変換して表示 |
| **エラー形式** | 構造化エラー `{ kind, message }` を返す | `kind` を日本語 UI メッセージにマッピング |
| **状態管理** | Tauri State（個別 `manage()`） | Zustand v5 ストア |
| **ローディング** | — | Zustand `isLoading`（単一管理、二重管理禁止） |
| **バリデーション** | 最終バリデーション（信頼境界） | UX 向け即時バリデーション |
| **i18n** | エラー kind のみ（英語キー） | 日本語メッセージへの変換 |

### DateTime 処理規約

```rust
// BE: 常に UTC で保存
pub struct Article {
    pub published_at: chrono::DateTime<Utc>,
    pub fetched_at: chrono::DateTime<Utc>,
}
```

```typescript
// FE: Asia/Tokyo に変換して表示
const displayDate = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(article.publishedAt));
```

### ローディング状態管理

```typescript
// FE: Zustand で isLoading を単一管理する
interface FeedStore {
  articles: Article[];
  isLoading: boolean;
  error: AppError | null;
  fetchArticles: (category: string) => Promise<void>;
}

// NG — isLoading と isFetching の二重管理
interface BadStore {
  isLoading: boolean;  // 初回読み込み用
  isFetching: boolean; // リフレッシュ用 ← 禁止
}
```

---

## 5. エラーハンドリング戦略

### Rust 側（バックエンド）

`thiserror` で `AppError` enum を定義し、`?` 演算子で伝播する。
**`unwrap()` は本番コードで厳禁**（テストコードでは理由コメント付きで許可）。

```rust
use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("データベースエラー: {0}")]
    Database(#[from] sqlx::Error),

    #[error("HTTPエラー: {0}")]
    Http(#[from] reqwest::Error),

    #[error("パースエラー: {0}")]
    Parse(String),

    #[error("LLMエラー: {0}")]
    Llm(String),

    #[error("設定エラー: {0}")]
    Config(String),

    #[error("レートリミット超過: {0}")]
    RateLimit(String),
}

// Tauri コマンドのエラーレスポンス形式
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub kind: String,
    pub message: String,
}

impl From<AppError> for ErrorResponse {
    fn from(err: AppError) -> Self {
        let kind = match &err {
            AppError::Database(_) => "DATABASE",
            AppError::Http(_) => "HTTP",
            AppError::Parse(_) => "PARSE",
            AppError::Llm(_) => "LLM",
            AppError::Config(_) => "CONFIG",
            AppError::RateLimit(_) => "RATE_LIMIT",
        };
        ErrorResponse {
            kind: kind.to_string(),
            message: err.to_string(),
        }
    }
}
```

### AppError のシリアライズ

Tauri v2 の invoke エラーは plain object として FE に渡される。
`[object Object]` 問題を回避するため、`{ kind, message }` 構造に統一する。

```rust
// Tauri コマンドでの使用例
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let response = ErrorResponse::from(self);
        response.serialize(serializer)
    }
}
```

### TypeScript 側（フロントエンド）

Tauri invoke のエラーは `JSON.stringify` パターンで安全に処理する。

```typescript
import { invoke } from "@tauri-apps/api/core";

interface AppError {
  kind: string;
  message: string;
}

// エラーメッセージの日本語マッピング
const ERROR_MESSAGES: Record<string, string> = {
  DATABASE: "データベースへの接続に問題が発生しました",
  HTTP: "ネットワーク接続を確認してください",
  PARSE: "データの読み取りに失敗しました",
  LLM: "AI 要約の生成に失敗しました",
  CONFIG: "設定に問題があります",
  RATE_LIMIT: "リクエスト制限に達しました。しばらくお待ちください",
};

async function safeTauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error: unknown) {
    // Tauri invoke エラーは plain object — JSON.stringify パターン必須
    const parsed = typeof error === "string"
      ? JSON.parse(error) as AppError
      : error as AppError;

    const uiMessage = ERROR_MESSAGES[parsed.kind] ?? parsed.message;
    throw new Error(uiMessage);
  }
}
```

---

## 6. 技術スタック

### バックエンド

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| フレームワーク | Tauri | v2 | デスクトップアプリフレームワーク |
| 言語 | Rust | 1.85+ | バックエンドロジック |
| データベース | SQLite (sqlx) | sqlx 0.8 | ローカルデータ永続化 |
| HTTP | reqwest | 0.12 | 外部 API・フィード取得 |
| RSS パーサー | feed-rs | 2.3 | RSS/Atom フィード解析 |
| GraphQL | graphql_client | 0.14 | AniList API クライアント |
| スケジューラー | tokio-cron-scheduler | 0.13 | 定期収集タスク |
| エラー処理 | thiserror | 2.0 | エラー型定義 |
| シリアライズ | serde / serde_json | 1.0 | JSON シリアライズ/デシリアライズ |
| ログ | tracing | 0.1 | 構造化ログ出力 |

### フロントエンド

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| UI ライブラリ | React | 19 | コンポーネントベース UI |
| 言語 | TypeScript | strict モード | 型安全な開発 |
| スタイリング | Tailwind CSS | v4 | ユーティリティファースト CSS |
| 状態管理 | Zustand | v5 | グローバル状態管理 |
| リンター/フォーマッター | Biome | 最新 | コード品質管理 |
| Tauri API | @tauri-apps/api | v2 | BE との通信 |

### AI / LLM

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| ローカル LLM | Ollama | オフラインダイジェスト生成 |
| クラウド LLM | OpenAI API | 高品質要約（オプション） |

### 開発ツール

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| テスト (Rust) | cargo test | ユニットテスト・結合テスト |
| テスト (FE) | Vitest | コンポーネント・ロジックテスト |
| リント (Rust) | clippy | 静的解析 (`-D warnings`) |
| フォーマット (Rust) | rustfmt | コードフォーマット |
| リント/フォーマット (FE) | Biome | `npx biome check --apply .` |

---

## 7. ディレクトリ構成（概要）

```
otaku-pulse/
├── src-tauri/
│   ├── src/
│   │   ├── commands/       # Tauri コマンド定義
│   │   │   ├── mod.rs
│   │   │   ├── feed.rs
│   │   │   ├── digest.rs
│   │   │   └── settings.rs
│   │   ├── services/       # ビジネスロジック
│   │   │   ├── mod.rs
│   │   │   ├── feed.rs
│   │   │   ├── summarizer.rs
│   │   │   ├── scorer.rs
│   │   │   ├── dedup.rs
│   │   │   └── scheduler.rs
│   │   ├── infra/          # 外部 I/O
│   │   │   ├── mod.rs
│   │   │   ├── http_client.rs
│   │   │   ├── database.rs
│   │   │   ├── llm_client.rs
│   │   │   ├── rate_limiter.rs
│   │   │   └── notification.rs
│   │   ├── parsers/        # データ変換（純粋関数）
│   │   │   ├── mod.rs
│   │   │   ├── rss_parser.rs
│   │   │   ├── graphql_parser.rs
│   │   │   ├── html_sanitizer.rs
│   │   │   └── bbcode_parser.rs
│   │   ├── models/         # ドメインモデル・DTO
│   │   │   ├── mod.rs
│   │   │   ├── article.rs
│   │   │   ├── digest.rs
│   │   │   └── error.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── migrations/         # SQLite マイグレーション
│   └── Cargo.toml
├── src/                    # フロントエンド
│   ├── components/
│   ├── stores/             # Zustand ストア
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── docs/
│   └── ARCHITECTURE.md     # 本ドキュメント
├── package.json
├── tsconfig.json
├── biome.json
└── tailwind.config.ts
```

---

## 8. 設計原則まとめ

1. **依存は常に上位層から下位層へ** — 逆依存は厳禁
2. **parsers は純粋関数** — テスト容易性とデバッグ容易性を最大化
3. **State は個別管理** — `Mutex<AppState>` は使わない
4. **エラーは構造化して伝播** — `unwrap()` 禁止、`?` 演算子で統一
5. **BE は UTC、FE は表示変換** — タイムゾーン変換の責務を明確に分離
6. **ローディング状態は単一管理** — Zustand の `isLoading` のみ（二重管理禁止）
7. **commands 層にロジックを書かない** — 受け渡しと変換のみ

---

## 9. FE ストア分割設計

| ストア | ファイル | 管理対象 |
|--------|----------|----------|
| feedStore | `stores/feedStore.ts` | 記事一覧・フィード管理・フィルター・isLoading |
| digestStore | `stores/digestStore.ts` | ダイジェスト表示・生成状態・isLoading |
| appStore | `stores/appStore.ts` | サイドバー開閉・アクティブ Wing・設定 |

- 各ストアの `isLoading` は自身で管理し、他ストアと**共有しない**
- React Query は使わない（Tauri IPC は HTTP ではなく、Zustand 単一管理と矛盾する）
