-- DeepDive 結果キャッシュ
CREATE TABLE IF NOT EXISTS deepdive_cache (
    article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    follow_ups  TEXT NOT NULL DEFAULT '[]',
    provider    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (article_id, question)
);
