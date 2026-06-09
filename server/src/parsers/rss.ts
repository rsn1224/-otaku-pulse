import Parser from 'rss-parser';
import { detectLanguage, extractImgFromHtml, isImageUrl } from '../lib/text.ts';
import type { CollectedArticle } from '../types/models.ts';

// rss_parser.rs の移植。feed-rs を rss-parser に置換。

interface MediaNode {
  $?: { url?: string; type?: string };
}

interface CustomItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  author?: string;
  isoDate?: string;
  guid?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: MediaNode[];
  mediaThumbnail?: MediaNode[];
}

const parser = new Parser<object, CustomItem>({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
    ],
  },
});

function pickContent(item: CustomItem): string | null {
  const c = item.content ?? item.contentSnippet ?? null;
  if (c === null) return null;
  const t = c.trim();
  return t === '' ? null : t;
}

/** サムネ抽出: media:content(image) → media:thumbnail → enclosure(image) → HTML <img>。 */
function extractThumbnail(item: CustomItem, content: string | null): string | null {
  for (const m of item.mediaContent ?? []) {
    const url = m.$?.url;
    if (url !== undefined && (m.$?.type?.startsWith('image/') || isImageUrl(url))) return url;
  }
  for (const m of item.mediaThumbnail ?? []) {
    if (m.$?.url !== undefined) return m.$.url;
  }
  const enc = item.enclosure;
  if (enc?.url !== undefined && (enc.type?.startsWith('image/') || isImageUrl(enc.url))) {
    return enc.url;
  }
  if (content !== null) {
    const img = extractImgFromHtml(content);
    if (img !== null) return img;
  }
  return null;
}

function convertItem(item: CustomItem, feedId: number): CollectedArticle | null {
  const title = (item.title ?? '').trim();
  if (title === '') return null;

  const url = item.link?.trim() || null;
  const content = pickContent(item);
  const author = (item.creator ?? item.author)?.trim() || null;
  const publishedAt = item.isoDate ?? null;
  const externalId = item.guid?.trim() || url || null;
  const thumbnailUrl = extractThumbnail(item, content);

  return {
    feedId,
    externalId,
    title,
    url,
    urlNormalized: null,
    content,
    summary: null,
    author,
    publishedAt,
    importanceScore: 0.0,
    isDuplicate: false,
    duplicateOf: null,
    language: detectLanguage(title, content),
    thumbnailUrl,
    contentHash: null,
    metadata: null,
  };
}

/** RSS/Atom 生 XML を Article 配列にパースする。 */
export async function parseRssFeed(xml: string, feedId: number): Promise<CollectedArticle[]> {
  const feed = await parser.parseString(xml);
  const out: CollectedArticle[] = [];
  for (const item of feed.items) {
    const article = convertItem(item, feedId);
    if (article !== null) out.push(article);
  }
  return out;
}
