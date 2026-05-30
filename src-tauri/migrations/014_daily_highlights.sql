-- Migration 014: daily_highlights キャッシュ (P1-1)
--
-- ハイライト (過去24h 上位5件 + 「なぜ注目か」理由) をサーバ側にキャッシュし、
-- 初回ロードでの LLM 同期待ちを解消する。収集完了後に scheduler が再計算して書き込み、
-- フロントの get_daily_highlights は有効キャッシュがあれば即返す。today_view と同型。
--
-- 純追加・冪等 (IF NOT EXISTS) のため warm DB へも安全に適用される。

CREATE TABLE IF NOT EXISTS daily_highlights (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id   INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,      -- ≤15 字の注目理由
    rank         INTEGER NOT NULL,   -- 1..=5
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_highlights_rank ON daily_highlights(rank);
CREATE INDEX IF NOT EXISTS idx_daily_highlights_generated ON daily_highlights(generated_at);
