-- no-transaction
-- Migration 012: collection 機能拡張
--   * feeds.feed_type を scraper / custom-api に拡張 (機能B)
--   * feeds.category を tech に拡張 (機能D)
--   * feeds.config 列追加 (scraper selector / custom-api マッピングの JSON 格納)
--   * digests.category を research_report / tech に拡張 (機能C/D)
--   * tech RSS の seed feed、Markdown export 設定キーを追加 (機能D/E)
-- 注: PC 状態 (機能A) は記事化せず独立コマンドで扱うため、ここでは seed しない。
--
-- 注意: SQLite は CHECK 制約を ALTER できないためテーブルを再作成する。
-- feeds は articles(feed_id) ON DELETE CASCADE で参照されるため、
-- DROP TABLE 時の暗黙 DELETE が articles を巻き込まないよう foreign_keys を一時無効化する。
-- このため本マイグレーションは `-- no-transaction` で実行する
-- (PRAGMA foreign_keys はトランザクション内では無視されるため)。

PRAGMA foreign_keys=OFF;

-- feeds 再作成 (feed_type / category 拡張 + config 列)
CREATE TABLE feeds_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    feed_type TEXT NOT NULL CHECK(feed_type IN ('rss', 'anilist', 'steam', 'reddit', 'scraper', 'custom-api')),
    category TEXT NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'tech')),
    enabled BOOLEAN NOT NULL DEFAULT 1,
    fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
    last_fetched_at TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    disabled_reason TEXT,
    last_error TEXT,
    etag TEXT,
    last_modified TEXT,
    config TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO feeds_new
    (id, name, url, feed_type, category, enabled, fetch_interval_minutes,
     last_fetched_at, consecutive_errors, disabled_reason, last_error,
     etag, last_modified, created_at, updated_at)
SELECT
    id, name, url, feed_type, category, enabled, fetch_interval_minutes,
    last_fetched_at, consecutive_errors, disabled_reason, last_error,
    etag, last_modified, created_at, updated_at
FROM feeds;

DROP TABLE feeds;
ALTER TABLE feeds_new RENAME TO feeds;

-- digests 再作成 (category 拡張)。011 で消えていたインデックスもここで復活させる
CREATE TABLE digests_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    category         TEXT NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'all', 'weekly_report', 'research_report', 'tech')),
    title            TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    content_html     TEXT,
    article_ids      TEXT NOT NULL,
    model_used       TEXT,
    token_count      INTEGER,
    generated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO digests_new SELECT * FROM digests;
DROP TABLE digests;
ALTER TABLE digests_new RENAME TO digests;
CREATE INDEX IF NOT EXISTS idx_digests_category ON digests(category);
CREATE INDEX IF NOT EXISTS idx_digests_generated_at ON digests(generated_at DESC);

PRAGMA foreign_keys=ON;

-- 機能D: 技術ニュース源の seed (feed_type は既存 RssCollector を再利用)
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('Hacker News',  'https://hnrss.org/frontpage',                'rss', 'tech', 60),
    ('Publickey',    'https://www.publickey1.jp/atom.xml',         'rss', 'tech', 120),
    ('Zenn Trending','https://zenn.dev/feed',                      'rss', 'tech', 120),
    ('Rust Blog',    'https://blog.rust-lang.org/feed.xml',        'rss', 'tech', 1440),
    ('The Verge',    'https://www.theverge.com/rss/index.xml',     'rss', 'tech', 120),
    ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'rss', 'tech', 120);

-- 機能A: PC/システム状態は記事化せず、独立した get_pc_status コマンド + SystemStatusSection で
-- 表示する (dashboard_reader を直読み)。article 収集パイプラインには載せない。

-- 機能E: Markdown digest export 設定 (値は JSON エンコード文字列。dir 空文字 = app_data_dir/digests を既定)
-- 既定は opt-in (無効)。ユーザー同意なしのディスク書き込みを避けるため Settings で有効化する。
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('digest_export_enabled', '"0"'),
    ('digest_export_dir',     '""');
