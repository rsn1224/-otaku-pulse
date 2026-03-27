-- 未読記事の日付順取得を高速化
CREATE INDEX IF NOT EXISTS idx_articles_read_published
  ON articles(is_read, published_at DESC) WHERE is_read = 0;

-- フィード別の非重複記事取得を高速化
CREATE INDEX IF NOT EXISTS idx_articles_feed_dup_published
  ON articles(feed_id, is_duplicate, published_at DESC);

-- 記事インタラクション履歴の時系列取得を高速化
CREATE INDEX IF NOT EXISTS idx_interactions_article_created
  ON article_interactions(article_id, created_at DESC);
