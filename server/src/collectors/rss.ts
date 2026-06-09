import { fetchRss } from '../infra/http.ts';
import { parseRssFeed } from '../parsers/rss.ts';
import type { CollectedArticle, FeedRow } from '../types/models.ts';

/** 収集結果 + 次回の条件付き GET 用キャッシュヘッダ。 */
export interface CollectOutput {
  articles: CollectedArticle[];
  etag: string | null;
  lastModified: string | null;
}

/** RSS / Reddit(RSS) コレクター。etag/Last-Modified を返し条件付き GET を可能にする（Phase B 修正）。 */
export async function collectRss(feed: FeedRow): Promise<CollectOutput> {
  const result = await fetchRss(feed.url, { etag: feed.etag, lastModified: feed.last_modified });
  if (result === null) {
    // 304 Not Modified: 既存キャッシュを維持
    return { articles: [], etag: feed.etag, lastModified: feed.last_modified };
  }
  return {
    articles: await parseRssFeed(result.body, feed.id),
    etag: result.etag,
    lastModified: result.lastModified,
  };
}
