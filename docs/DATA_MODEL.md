# OtakuPulse データモデル定義書

<!-- 最終更新: 2026-03-25 v2 -->

## 1. ER 図

```text
+----------+       1    *  +-----------+       *    1  +-----------+
|  feeds   |──────────────>|  articles  |──────────────>|  articles |
+----------+               +-----------+  duplicate_of  +-----------+
                                                        (self-ref)

+-----------+
|  digests  |  article_ids: JSON 配列 (FK ではない)
+-----------+  → articles.id を参照するが、DB レベルの外部キー制約なし

+-----------+
|  settings |  キー・バリューストア (アプリ設定用)
+-----------+
```

---

## 2. テーブル定義

### 2.1 feeds

フィード購読元の管理テーブル。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 内部 ID |
| name | TEXT | NOT NULL | フィード表示名 |
| url | TEXT | NOT NULL UNIQUE | フィード URL |
| feed_type | TEXT | NOT NULL CHECK(feed_type IN ('rss', 'anilist', 'steam', 'reddit')) | フィード形式 |
| category | TEXT | NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc')) | カテゴリ |
| enabled | BOOLEAN | NOT NULL DEFAULT 1 | 有効フラグ |
| fetch_interval_minutes | INTEGER | NOT NULL DEFAULT 60 | 取得間隔 (分) |
| last_fetched_at | TEXT | NULL | 最終取得日時 (ISO 8601) |
| consecutive_errors | INTEGER | NOT NULL DEFAULT 0 | 連続エラー回数 (3 で auto-disable) |
| disabled_reason | TEXT | NULL | 自動無効化の理由 |
| last_error | TEXT | NULL | 最後のエラーメッセージ |
| etag | TEXT | NULL | HTTP ETag ヘッダー (条件付きリクエスト用) |
| last_modified | TEXT | NULL | HTTP Last-Modified ヘッダー |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | 作成日時 |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | 更新日時 |

### 2.2 articles

取得した記事の保存テーブル。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 内部 ID |
| feed_id | INTEGER | NOT NULL REFERENCES feeds(id) ON DELETE CASCADE | 所属フィード |
| external_id | TEXT | NOT NULL | フィード内の一意識別子 (guid/id) |
| title | TEXT | NOT NULL | 記事タイトル |
| url | TEXT | NOT NULL | 記事 URL |
| url_normalized | TEXT | NULL | 正規化 URL (重複検出用、クエリパラメータ除去済み) |
| content | TEXT | NULL | 本文 (HTML) |
| summary | TEXT | NULL | 要約テキスト |
| author | TEXT | NULL | 著者名 |
| published_at | TEXT | NULL | 公開日時 (ISO 8601) |
| importance_score | REAL | NOT NULL DEFAULT 0.0 | 重要度スコア (0.0–1.0) |
| is_read | BOOLEAN | NOT NULL DEFAULT 0 | 既読フラグ |
| is_bookmarked | BOOLEAN | NOT NULL DEFAULT 0 | ブックマークフラグ |
| is_duplicate | BOOLEAN | NOT NULL DEFAULT 0 | 重複フラグ |
| duplicate_of | INTEGER | NULL REFERENCES articles(id) ON DELETE SET NULL | 重複元記事 (自己参照) |
| language | TEXT | NULL | 言語コード (ja, en 等) |
| thumbnail_url | TEXT | NULL | サムネイル画像 URL |
| content_hash | TEXT | NULL | SHA-256 ハッシュ (dedup Layer 3 用、専用カラム) |
| metadata | TEXT | NULL | 追加メタデータ (JSON 文字列) |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now')) | 取得日時 |

**複合ユニーク制約:** `UNIQUE(feed_id, external_id)`

### 2.3 digests

AI 生成ダイジェストの保存テーブル。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 内部 ID |
| category | TEXT | NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'all')) | 対象カテゴリ |
| title | TEXT | NOT NULL | ダイジェストタイトル |
| content_markdown | TEXT | NOT NULL | 本文 (Markdown) |
| content_html | TEXT | NOT NULL | 本文 (HTML レンダリング済み) |
| article_ids | TEXT | NOT NULL | 参照記事 ID 配列 (JSON: `[1, 2, 3]`) |
| model_used | TEXT | NOT NULL | 使用 AI モデル名 |
| token_count | INTEGER | NOT NULL DEFAULT 0 | 消費トークン数 |
| generated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | 生成日時 |

### 2.4 settings

アプリケーション設定のキー・バリューストア。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| key | TEXT | PRIMARY KEY | 設定キー |
| value | TEXT | NOT NULL | 設定値 (JSON 文字列可) |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now')) | 更新日時 |

### 2.5 インデックス一覧

| インデックス名 | 対象テーブル | カラム | 用途 |
|---|---|---|---|
| idx_articles_feed_id | articles | feed_id | フィード別記事取得 |
| idx_articles_published_at | articles | published_at DESC | 新着順ソート |
| idx_articles_importance | articles | importance_score DESC | 重要度順ソート |
| idx_articles_url_normalized | articles | url_normalized | URL ベース重複検出 |
| idx_articles_is_duplicate | articles | is_duplicate | 重複フィルタリング |
| idx_articles_content_hash | articles | content_hash | dedup Layer 3 ハッシュ検索 |
| idx_articles_is_bookmarked | articles | is_bookmarked (WHERE=1) | ブックマーク一覧取得 |
| idx_articles_created_at | articles | created_at DESC | 取得日時順ソート |
| idx_digests_category | digests | category | カテゴリ別ダイジェスト取得 |
| idx_digests_generated_at | digests | generated_at DESC | 最新ダイジェスト取得 |

---

## 3. Rust モデル型定義

### 3.1 DB 行構造体 (sqlx::FromRow)

```rust
// src-tauri/src/models/db.rs

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Feed {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub feed_type: String,
    pub category: String,
    pub enabled: bool,
    pub fetch_interval_minutes: i64,
    pub last_fetched_at: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Article {
    pub id: i64,
    pub feed_id: i64,
    pub external_id: String,
    pub title: String,
    pub url: String,
    pub url_normalized: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub importance_score: f64,
    pub is_read: bool,
    pub is_bookmarked: bool,
    pub is_duplicate: bool,
    pub duplicate_of: Option<i64>,
    pub language: Option<String>,
    pub thumbnail_url: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Digest {
    pub id: i64,
    pub category: String,
    pub title: String,
    pub content_markdown: String,
    pub content_html: String,
    pub article_ids: String,
    pub model_used: String,
    pub token_count: i64,
    pub generated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
```

### 3.2 フロントエンド向け DTO (Serialize/Deserialize)

DTO は DB 内部カラム (`etag`, `last_modified`, `url_normalized`, `metadata`) を**公開しない**。

```rust
// src-tauri/src/models/dto.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedDto {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub feed_type: String,
    pub category: String,
    pub enabled: bool,
    pub fetch_interval_minutes: i64,
    pub last_fetched_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDto {
    pub id: i64,
    pub feed_id: i64,
    pub title: String,
    pub url: String,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub importance_score: f64,
    pub is_read: bool,
    pub is_bookmarked: bool,
    pub is_duplicate: bool,
    pub duplicate_of: Option<i64>,
    pub language: Option<String>,
    pub thumbnail_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestDto {
    pub id: i64,
    pub category: String,
    pub title: String,
    pub content_markdown: String,
    pub content_html: String,
    pub article_ids: Vec<i64>,
    pub model_used: String,
    pub token_count: i64,
    pub generated_at: String,
}
```

---

## 4. UPSERT ポリシー

記事の再取得時、同一フィード内の同一 `external_id` が存在する場合は **部分更新** を行う。

### 基本方針

- `content`, `summary`, `importance_score` は最新値で上書きする
- **`is_read` はユーザー操作の結果であるため、UPSERT で上書きしない**
- `is_bookmarked` も同様に保護する

### SQL 例

```sql
INSERT INTO articles (
    feed_id, external_id, title, url, url_normalized,
    content, summary, author, published_at,
    importance_score, language, thumbnail_url, metadata
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
ON CONFLICT(feed_id, external_id) DO UPDATE SET
    title            = excluded.title,
    url              = excluded.url,
    url_normalized   = excluded.url_normalized,
    content          = excluded.content,
    summary          = excluded.summary,
    author           = excluded.author,
    published_at     = excluded.published_at,
    importance_score = excluded.importance_score,
    language         = excluded.language,
    thumbnail_url    = excluded.thumbnail_url,
    metadata         = excluded.metadata;
-- 注意: is_read, is_bookmarked, is_duplicate, duplicate_of は
--       SET 句に含めない → ユーザー操作を保護
```

---

## 5. マイグレーション戦略

### 実行方式

`sqlx::migrate!` マクロによる組み込みマイグレーション。アプリ起動時に自動適用される。

```rust
// src-tauri/src/db.rs
sqlx::migrate!("./migrations").run(&pool).await?;
```

### ファイル: `migrations/001_initial.sql`

```sql
-- feeds テーブル
CREATE TABLE IF NOT EXISTS feeds (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT    NOT NULL,
    url                   TEXT    NOT NULL UNIQUE,
    feed_type             TEXT    NOT NULL CHECK(feed_type IN ('rss', 'anilist', 'steam', 'reddit')),
    category              TEXT    NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc')),
    enabled               BOOLEAN NOT NULL DEFAULT 1,
    fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
    last_fetched_at       TEXT,
    etag                  TEXT,
    last_modified         TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- articles テーブル
CREATE TABLE IF NOT EXISTS articles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id           INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    external_id       TEXT    NOT NULL,
    title             TEXT    NOT NULL,
    url               TEXT    NOT NULL,
    url_normalized    TEXT,
    content           TEXT,
    summary           TEXT,
    author            TEXT,
    published_at      TEXT,
    importance_score  REAL    NOT NULL DEFAULT 0.0,
    is_read           BOOLEAN NOT NULL DEFAULT 0,
    is_bookmarked     BOOLEAN NOT NULL DEFAULT 0,
    is_duplicate      BOOLEAN NOT NULL DEFAULT 0,
    duplicate_of      INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    language          TEXT,
    thumbnail_url     TEXT,
    metadata          TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(feed_id, external_id)
);

-- digests テーブル
CREATE TABLE IF NOT EXISTS digests (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    category         TEXT    NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'all')),
    title            TEXT    NOT NULL,
    content_markdown TEXT    NOT NULL,
    content_html     TEXT    NOT NULL,
    article_ids      TEXT    NOT NULL,
    model_used       TEXT    NOT NULL,
    token_count      INTEGER NOT NULL DEFAULT 0,
    generated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- settings テーブル
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_articles_feed_id        ON articles(feed_id);
CREATE INDEX idx_articles_published_at   ON articles(published_at DESC);
CREATE INDEX idx_articles_importance      ON articles(importance_score DESC);
CREATE INDEX idx_articles_url_normalized  ON articles(url_normalized);
CREATE INDEX idx_articles_is_duplicate    ON articles(is_duplicate);
CREATE INDEX idx_digests_category         ON digests(category);
CREATE INDEX idx_digests_generated_at     ON digests(generated_at DESC);

-- デフォルトフィード: anime
INSERT INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Seasonal',  'https://graphql.anilist.co',                    'anilist', 'anime', 1440),
    ('コミックナタリー',    'https://natalie.mu/comic/feed/news',            'rss',     'anime', 30),
    ('アニメ!アニメ!',     'https://animeanime.jp/rss/index.rdf',           'rss',     'anime', 30),
    ('GIGAZINE',          'https://gigazine.net/news/rss_2.0/',            'rss',     'anime', 60),
    ('r/anime',           'https://www.reddit.com/r/anime/.rss',           'rss',     'anime', 30);

-- デフォルトフィード: manga
INSERT INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Manga',           'https://graphql.anilist.co',              'anilist', 'manga', 1440),
    ('コミックナタリー（マンガ）', 'https://natalie.mu/comic/feed/news',    'rss',     'manga', 30),
    ('r/manga',                 'https://www.reddit.com/r/manga/.rss',     'rss',     'manga', 30);

-- デフォルトフィード: game
INSERT INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('4Gamer.net',   'https://www.4gamer.net/rss/index.xml',              'rss', 'game', 30),
    ('PC Gamer',     'https://www.pcgamer.com/rss/',                      'rss', 'game', 60),
    ('Gematsu',      'https://www.gematsu.com/feed',                      'rss', 'game', 60),
    ('r/pcgaming',   'https://www.reddit.com/r/pcgaming/.rss',            'rss', 'game', 30),
    ('r/Steam',      'https://www.reddit.com/r/Steam/.rss',               'rss', 'game', 30);

-- デフォルトフィード: pc
INSERT INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('PC Watch',      'https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf', 'rss', 'pc', 30),
    ('Tom''s Hardware','https://www.tomshardware.com/feeds/all',           'rss', 'pc', 60),
    ('GamersNexus',   'https://gamersnexus.net/rss.xml',                  'rss', 'pc', 60),
    ('igor''sLAB',    'https://www.igorslab.de/en/feed',                  'rss', 'pc', 60),
    ('r/hardware',    'https://www.reddit.com/r/hardware/.rss',            'rss', 'pc', 30);

-- デフォルト設定
INSERT INTO settings (key, value) VALUES
    ('digest_model',          '"qwen2.5:7b-instruct"'),
    ('digest_schedule_cron',  '"0 7 * * *"'),
    ('theme',                 '"dark"'),
    ('language',              '"ja"');
```
