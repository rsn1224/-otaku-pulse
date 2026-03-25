CREATE TABLE IF NOT EXISTS keyword_filters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword    TEXT NOT NULL,
    filter_type TEXT NOT NULL CHECK(filter_type IN ('mute', 'highlight')),
    category   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keyword_filters_type ON keyword_filters(filter_type);
