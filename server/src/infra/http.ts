// http_client.rs / rss_fetcher.rs の移植。サーバ側 fetch のため CORS は無関係。

export const USER_AGENT = 'OtakuPulse/1.0.0 (personal use)';
const TIMEOUT_MS = 30_000;

export interface FeedCache {
  etag: string | null;
  lastModified: string | null;
}

export interface FetchResult {
  body: string;
  etag: string | null;
  lastModified: string | null;
}

/** RSS を取得。304 の場合は null。200 以外は例外。 */
export async function fetchRss(url: string, cache: FeedCache): Promise<FetchResult | null> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (cache.etag) headers['If-None-Match'] = cache.etag;
  if (cache.lastModified) headers['If-Modified-Since'] = cache.lastModified;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (res.status === 304) return null;
  if (res.status === 200) {
    return {
      body: await res.text(),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    };
  }
  throw new Error(`Failed to fetch RSS feed: HTTP ${res.status}`);
}

const SCRAPER_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * 任意 URL のテキストを取得（scraper / custom-api 用）。
 * per-request 20s タイムアウト + 本文 5MiB 上限（api-data-sources 規約）。
 * Content-Length 超過は即拒否、無い場合もチャンク累積で監視する。
 */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(SCRAPER_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch: HTTP ${res.status}`);
  }

  const lenHeader = res.headers.get('content-length');
  const limitMiB = MAX_BODY_BYTES / (1024 * 1024);
  if (lenHeader !== null && Number(lenHeader) > MAX_BODY_BYTES) {
    throw new Error(`取得サイズが上限 (${limitMiB} MiB) を超えています: ${lenHeader} bytes`);
  }

  const reader = res.body?.getReader();
  if (reader === undefined) return res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      total += value.length;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error(`取得サイズが上限 (${limitMiB} MiB) を超えています`);
      }
      chunks.push(value);
    }
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}
