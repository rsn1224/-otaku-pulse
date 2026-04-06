-- OtakuPulse v1.1 schema additions
-- Features: A(implicit feedback), B(clustering), C(today view),
--           D(anilist watchlist), E(impact labels), G(steam games)

-- =========================================================
-- Feature E: Impact label classification
-- =========================================================
ALTER TABLE articles ADD COLUMN impact_level TEXT DEFAULT 'general';

-- =========================================================
-- Feature B: Topic clustering
-- =========================================================
ALTER TABLE articles ADD COLUMN cluster_id TEXT;

CREATE TABLE IF NOT EXISTS topic_clusters (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    label                       TEXT NOT NULL,
    category                    TEXT NOT NULL,
    article_count               INTEGER NOT NULL DEFAULT 0,
    representative_article_id   INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cluster_articles (
    cluster_id  INTEGER NOT NULL REFERENCES topic_clusters(id) ON DELETE CASCADE,
    article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    similarity  REAL NOT NULL DEFAULT 0.0,
    added_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (cluster_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_clusters_category ON topic_clusters(category);
CREATE INDEX IF NOT EXISTS idx_clusters_expires  ON topic_clusters(expires_at);
CREATE INDEX IF NOT EXISTS idx_cluster_articles_article ON cluster_articles(article_id);

-- =========================================================
-- Feature D: AniList watchlist cache
-- =========================================================
CREATE TABLE IF NOT EXISTS anilist_watchlist (
    media_id        INTEGER NOT NULL PRIMARY KEY,
    title_romaji    TEXT NOT NULL,
    title_native    TEXT,
    status          TEXT NOT NULL,          -- 'CURRENT' | 'PLANNING'
    media_type      TEXT NOT NULL DEFAULT 'ANIME',
    cover_image_url TEXT,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anilist_status ON anilist_watchlist(status);

-- =========================================================
-- Feature G: Steam owned games cache
-- =========================================================
CREATE TABLE IF NOT EXISTS steam_games (
    appid               INTEGER PRIMARY KEY,
    name                TEXT NOT NULL,
    playtime_forever    INTEGER NOT NULL DEFAULT 0,  -- minutes (total)
    playtime_2weeks     INTEGER NOT NULL DEFAULT 0,  -- minutes (recent)
    img_icon_url        TEXT,
    fetched_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_steam_playtime ON steam_games(playtime_forever DESC);

-- =========================================================
-- Feature C: Today view cache
-- =========================================================
CREATE TABLE IF NOT EXISTS today_view (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    headline        TEXT NOT NULL,      -- ≤15 chars reason
    rank            INTEGER NOT NULL,   -- 1, 2, 3
    generated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- Settings keys for new features
-- =========================================================
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('anilist_username',            '""'),
    ('steam_api_key',               '""'),
    ('steam_id',                    '""'),
    ('anilist_sync_interval_hours', '"6"'),
    ('steam_sync_interval_hours',   '"24"'),
    ('weekly_report_enabled',       '"1"'),
    ('today_view_enabled',          '"1"'),
    ('digest_wing_enabled',         '"1"');
