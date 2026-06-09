-- ADR-7: RAG セマンティック検索用の記事 embedding。
-- embedding は JSON 配列（float[]）として保存し、検索時に JS で cosine 類似度を計算する。
-- node:sqlite は拡張ロードが不安定なため sqlite-vec を使わず in-JS cosine とする。
CREATE TABLE IF NOT EXISTS article_embeddings (
    article_id  INTEGER PRIMARY KEY,
    embedding   TEXT NOT NULL,
    model       TEXT NOT NULL,
    dim         INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);
