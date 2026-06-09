-- FTS5 仮想テーブル
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title,
    summary,
    content='articles',
    content_rowid='id',
    tokenize='unicode61'
);

-- 既存データを FTS に挿入
INSERT INTO articles_fts(rowid, title, summary)
SELECT id, title, COALESCE(summary, '') FROM articles;

-- INSERT トリガー
CREATE TRIGGER IF NOT EXISTS articles_fts_ai
AFTER INSERT ON articles BEGIN
    INSERT INTO articles_fts(rowid, title, summary)
    VALUES (new.id, new.title, COALESCE(new.summary, ''));
END;

-- UPDATE トリガー
CREATE TRIGGER IF NOT EXISTS articles_fts_au
AFTER UPDATE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, summary)
    VALUES ('delete', old.id, old.title, COALESCE(old.summary, ''));
    INSERT INTO articles_fts(rowid, title, summary)
    VALUES (new.id, new.title, COALESCE(new.summary, ''));
END;

-- DELETE トリガー
CREATE TRIGGER IF NOT EXISTS articles_fts_ad
AFTER DELETE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, summary)
    VALUES ('delete', old.id, old.title, COALESCE(old.summary, ''));
END;
