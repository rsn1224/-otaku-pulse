import * as cheerio from 'cheerio';
import type { CollectedArticle } from '../types/models.ts';

// scraper_fetcher.rs の抽出ロジック移植（HTTP 取得は infra/http.ts）。

export interface ScrapeConfig {
  item: string;
  title: string;
  link?: string;
  summary?: string;
  base_url?: string;
}

export interface ApiConfig {
  items_path?: string;
  title: string;
  link?: string;
  summary?: string;
  id?: string;
}

function collapseWs(s: string): string {
  return s
    .split(/\s+/)
    .filter((x) => x.length > 0)
    .join(' ');
}

function resolveUrl(base: string | undefined, href: string): string {
  if (base !== undefined) {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }
  return href;
}

function makeArticle(
  feedId: number,
  externalId: string,
  title: string,
  url: string | null,
  summary: string | null,
  createdAt: string,
): CollectedArticle {
  return {
    feedId,
    externalId,
    title,
    url,
    urlNormalized: null,
    content: summary,
    summary,
    author: null,
    publishedAt: createdAt,
    importanceScore: 0.0,
    isDuplicate: false,
    duplicateOf: null,
    language: null,
    thumbnailUrl: null,
    contentHash: null,
    metadata: null,
  };
}

/** HTML を CSS selector で抽出して Article 列にする。 */
export function scrapeHtml(html: string, feedId: number, cfg: ScrapeConfig): CollectedArticle[] {
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const out: CollectedArticle[] = [];

  $(cfg.item).each((_i, el) => {
    const item = $(el);

    const title = collapseWs(item.find(cfg.title).first().text());
    if (title === '') return;

    let href: string | null = null;
    const linkEl = cfg.link !== undefined ? item.find(cfg.link).first() : item.find('a').first();
    const rawHref = linkEl.attr('href');
    if (rawHref !== undefined) href = resolveUrl(cfg.base_url, rawHref);

    let summary: string | null = null;
    if (cfg.summary !== undefined) {
      const s = collapseWs(item.find(cfg.summary).first().text());
      if (s !== '') summary = s;
    }

    const externalId = href ?? `scrape:${title}`;
    out.push(makeArticle(feedId, externalId, title, href, summary, now));
  });

  return out;
}

function dig(v: unknown, path: string): unknown {
  let cur: unknown = v;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function strField(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

/** JSON 本文を field マッピングで抽出して Article 列にする。 */
export function parseApiJson(body: string, feedId: number, cfg: ApiConfig): CollectedArticle[] {
  const root: unknown = JSON.parse(body);

  const arrayCandidate = cfg.items_path !== undefined ? dig(root, cfg.items_path) : root;
  if (!Array.isArray(arrayCandidate)) {
    throw new Error('custom-api: 指定パスに配列が見つかりません');
  }

  const now = new Date().toISOString();
  const out: CollectedArticle[] = [];

  for (const entry of arrayCandidate) {
    if (entry === null || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;

    const title = strField(obj, cfg.title);
    if (title === null) continue;

    const link = cfg.link !== undefined ? strField(obj, cfg.link) : null;
    const summary = cfg.summary !== undefined ? strField(obj, cfg.summary) : null;
    const id = (cfg.id !== undefined ? strField(obj, cfg.id) : null) ?? link ?? `api:${title}`;

    out.push(makeArticle(feedId, id, title, link, summary, now));
  }

  return out;
}
