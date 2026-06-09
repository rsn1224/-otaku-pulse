-- ADR-7 改善: nomic-embed-text の search_document:/search_query: prefix を導入。
-- 既存の embedding は prefix 無しで生成されており、prefix 付きクエリとは非対称になり検索精度が劣化する。
-- 全 embedding を破棄し、次回の収集サイクル / embed_articles で prefix 付きで再生成させる。
DELETE FROM article_embeddings;
