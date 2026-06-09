-- ADR-7 連携: grounded deepdive。RAG で参照した収集記事の出典を deepdive_cache に保存する。
-- キャッシュヒット時にも citations を復元できるようにする（従来はヒット時 citations: [] だった）。
ALTER TABLE deepdive_cache ADD COLUMN citations TEXT NOT NULL DEFAULT '[]';
