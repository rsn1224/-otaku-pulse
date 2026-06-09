-- パフォーマンス最適化インデックス
CREATE INDEX IF NOT EXISTS idx_articles_dup_published
  ON articles(is_duplicate, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_dup_score
  ON articles(is_duplicate, importance_score DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_article_action
  ON article_interactions(article_id, action);

CREATE INDEX IF NOT EXISTS idx_articles_feed_dup
  ON articles(feed_id, is_duplicate);
