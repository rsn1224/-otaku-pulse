-- v2 Discover: user profile, interactions, scoring, inline AI summary
-- ユーザープロフィール（好み設定）
CREATE TABLE IF NOT EXISTS user_profile (
    id                 INTEGER PRIMARY KEY DEFAULT 1,
    display_name       TEXT NOT NULL DEFAULT 'オタク',
    favorite_titles    TEXT NOT NULL DEFAULT '[]',
    favorite_genres    TEXT NOT NULL DEFAULT '[]',
    favorite_creators  TEXT NOT NULL DEFAULT '[]',
    total_read         INTEGER NOT NULL DEFAULT 0,
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期レコード挿入
INSERT OR IGNORE INTO user_profile (id) VALUES (1);

-- 記事インタラクション履歴
CREATE TABLE IF NOT EXISTS article_interactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id    INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    action        TEXT NOT NULL,
    dwell_seconds INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interactions_article ON article_interactions(article_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON article_interactions(created_at DESC);

-- パーソナルスコアキャッシュ
CREATE TABLE IF NOT EXISTS article_scores (
    article_id     INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    base_score     REAL NOT NULL DEFAULT 0.0,
    personal_score REAL NOT NULL DEFAULT 0.0,
    total_score    REAL NOT NULL DEFAULT 0.0,
    scored_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- articles テーブルに AI サマリー列を追加
ALTER TABLE articles ADD COLUMN ai_summary TEXT;
ALTER TABLE articles ADD COLUMN ai_summary_generated_at TEXT;
