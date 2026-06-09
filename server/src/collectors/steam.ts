import { extractAppid, fetchAppNews } from '../infra/steam.ts';
import type { CollectedArticle, FeedRow } from '../types/models.ts';

// collectors.rs の SteamCollector 移植。

export async function collectSteam(feed: FeedRow): Promise<CollectedArticle[]> {
  const appid = extractAppid(feed.url);
  const articles = await fetchAppNews(appid);
  for (const a of articles) a.feedId = feed.id;
  return articles;
}
