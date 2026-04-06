-- Phase 2 (P2) features: Context AI Memo + Weekly Deep Research Report

-- Feature F: コンテキスト AI メモのキャッシュテーブル
-- 記事ごとに LLM が生成したコンテキストメモを永続化する
CREATE TABLE IF NOT EXISTS article_context_memos (
    article_id  INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    memo        TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature H: digests テーブルの category CHECK 制約を 'weekly_report' に拡張する
-- SQLite は ALTER TABLE で CHECK 制約を変更できないため、テーブルを再作成する
CREATE TABLE digests_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    category         TEXT NOT NULL CHECK(category IN ('anime', 'manga', 'game', 'pc', 'all', 'weekly_report')),
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
