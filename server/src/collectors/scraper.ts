import { fetchText } from '../infra/http.ts';
import { type ApiConfig, parseApiJson, type ScrapeConfig, scrapeHtml } from '../parsers/scraper.ts';
import type { CollectedArticle, FeedRow } from '../types/models.ts';

// collectors.rs の ScraperCollector / CustomApiCollector 移植（機能B）。

function parseConfig<T>(feed: FeedRow): T {
  if (feed.config === null || feed.config.trim() === '') {
    throw new Error(`ソース '${feed.name}' に config が設定されていません`);
  }
  try {
    return JSON.parse(feed.config) as T;
  } catch (e) {
    throw new Error(`ソース '${feed.name}' の config JSON が不正: ${(e as Error).message}`);
  }
}

export async function collectScraper(feed: FeedRow): Promise<CollectedArticle[]> {
  const cfg = parseConfig<ScrapeConfig>(feed);
  const html = await fetchText(feed.url);
  return scrapeHtml(html, feed.id, cfg);
}

export async function collectCustomApi(feed: FeedRow): Promise<CollectedArticle[]> {
  const cfg = parseConfig<ApiConfig>(feed);
  const body = await fetchText(feed.url);
  return parseApiJson(body, feed.id, cfg);
}
