// DB 行型（node:sqlite はカラム名 = snake_case のオブジェクトを返す）と
// 収集パイプライン内のメモリ表現を定義する。

/** feeds テーブルの行。boolean 系は SQLite INTEGER (0/1)。 */
export interface FeedRow {
  id: number;
  name: string;
  url: string;
  feed_type: string;
  category: string;
  enabled: number;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  consecutive_errors: number;
  disabled_reason: string | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  config: string | null;
  created_at: string;
  updated_at: string;
}

/** collector が生成し upsert に渡す記事（id/created_at は DB 側で付与）。 */
export interface CollectedArticle {
  feedId: number;
  externalId: string | null;
  title: string;
  url: string | null;
  urlNormalized: string | null;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  importanceScore: number;
  isDuplicate: boolean;
  duplicateOf: number | null;
  language: string | null;
  thumbnailUrl: string | null;
  contentHash: string | null;
  metadata: string | null;
}
