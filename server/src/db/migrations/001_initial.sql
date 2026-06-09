-- OtakuPulse initial schema

-- feeds: RSS/API feed source management
CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    feed_type TEXT NOT NULL CHECK(feed_type IN ('rss', 'anilist', 'steam', 'reddit')),
    category TEXT NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc')),
    enabled BOOLEAN NOT NULL DEFAULT 1,
    fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
    last_fetched_at TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    disabled_reason TEXT,
    last_error TEXT,
    etag TEXT,
    last_modified TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- articles: collected articles / news
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    external_id TEXT,
    title TEXT NOT NULL,
    url TEXT,
    url_normalized TEXT,
    content TEXT,
    summary TEXT,
    author TEXT,
    published_at TEXT,
    importance_score REAL NOT NULL DEFAULT 0.0 CHECK(importance_score BETWEEN 0.0 AND 1.0),
    is_read BOOLEAN NOT NULL DEFAULT 0,
    is_bookmarked BOOLEAN NOT NULL DEFAULT 0,
    is_duplicate BOOLEAN NOT NULL DEFAULT 0,
    duplicate_of INTEGER REFERENCES articles(id),
    language TEXT DEFAULT 'ja',
    thumbnail_url TEXT,
    content_hash TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(feed_id, external_id)
);

-- digests: AI-generated summaries
CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'all')),
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    content_html TEXT,
    article_ids TEXT NOT NULL,
    model_used TEXT,
    token_count INTEGER,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- settings: user preferences (KVS)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_importance ON articles(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url_normalized ON articles(url_normalized);
CREATE INDEX IF NOT EXISTS idx_articles_is_duplicate ON articles(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_articles_is_bookmarked ON articles(is_bookmarked) WHERE is_bookmarked = 1;
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digests_category ON digests(category);
CREATE INDEX IF NOT EXISTS idx_digests_generated_at ON digests(generated_at DESC);

-- Default feeds: Anime
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Seasonal', 'https://graphql.anilist.co', 'anilist', 'anime', 1440),
    ('コミックナタリー', 'https://natalie.mu/comic/feed/news', 'rss', 'anime', 30),
    ('アニメ!アニメ!', 'https://animeanime.jp/rss/index.rdf', 'rss', 'anime', 30),
    ('GIGAZINE', 'https://gigazine.net/news/rss_2.0/', 'rss', 'anime', 60),
    ('r/anime', 'https://www.reddit.com/r/anime/.rss', 'rss', 'anime', 30);

-- Default feeds: Manga
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('AniList Manga', 'https://graphql.anilist.co/manga', 'anilist', 'manga', 1440),
    ('コミックナタリー (manga)', 'https://natalie.mu/comic/feed/news/manga', 'rss', 'manga', 30),
    ('r/manga', 'https://www.reddit.com/r/manga/.rss', 'rss', 'manga', 30);

-- Default feeds: Game
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('4Gamer.net', 'https://www.4gamer.net/rss/index.xml', 'rss', 'game', 30),
    ('PC Gamer', 'https://www.pcgamer.com/rss/', 'rss', 'game', 60),
    ('Gematsu', 'https://www.gematsu.com/feed', 'rss', 'game', 60),
    ('r/pcgaming', 'https://www.reddit.com/r/pcgaming/.rss', 'rss', 'game', 30),
    ('r/Steam', 'https://www.reddit.com/r/Steam/.rss', 'rss', 'game', 30);

-- Default feeds: PC Hardware
INSERT OR IGNORE INTO feeds (name, url, feed_type, category, fetch_interval_minutes) VALUES
    ('PC Watch', 'https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf', 'rss', 'pc', 30),
    ('Tom''s Hardware', 'https://www.tomshardware.com/feeds/all', 'rss', 'pc', 60),
    ('GamersNexus', 'https://gamersnexus.net/rss.xml', 'rss', 'pc', 60),
    ('igor''sLAB', 'https://www.igorslab.de/en/feed', 'rss', 'pc', 60),
    ('r/hardware', 'https://www.reddit.com/r/hardware/.rss', 'rss', 'pc', 30);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('ollama_endpoint',       '"http://localhost:11434"'),
    ('ollama_model',          '"qwen2.5:7b-instruct"'),
    ('digest_schedule_cron',  '"0 7 * * *"'),
    ('notification_enabled',  '"1"'),
    ('importance_threshold',  '"0.7"'),
    ('reddit_user_agent',     '"OtakuPulse/1.0 (personal use)"'),
    ('theme',                 '"dark"'),
    ('language',              '"ja"');
