import { AppError } from '../error.ts';
import { bbcodeToPlain } from '../parsers/bbcode.ts';
import type { CollectedArticle } from '../types/models.ts';
import { USER_AGENT } from './http.ts';

// steam_client.rs の移植（news 取得部分）。

/** steam:// URL から AppID を抽出する。 */
export function extractAppid(url: string): number {
  if (!url.startsWith('steam://')) {
    throw new Error('Not a steam:// URL');
  }
  const parts = url.split('/');
  if (parts.length < 4) {
    throw new Error('Invalid steam:// URL format');
  }
  const appid = Number.parseInt(parts[3] ?? '', 10);
  if (!Number.isInteger(appid) || appid < 0) {
    throw new Error('Invalid AppID');
  }
  return appid;
}

interface SteamNewsItem {
  title?: string;
  url?: string;
  contents?: string;
  feedid?: number;
  date?: number;
  author?: string;
  tags?: unknown[];
}

function steamScore(item: SteamNewsItem): number {
  let score = 0.5;
  if (typeof item.contents === 'string') {
    score += Math.min(item.contents.length / 1000, 0.2);
  }
  if (Array.isArray(item.tags)) {
    score += Math.min(item.tags.length / 10, 0.1);
  }
  if (typeof item.date === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    const daysOld = Math.floor(Math.max(0, nowSec - item.date) / 86400);
    if (daysOld <= 7) score += 0.2;
  }
  return Math.min(score, 1.0);
}

export function parseSteamNewsJson(json: unknown, appid: number): CollectedArticle[] {
  const root = json as { appnews?: { newsitems?: SteamNewsItem[] } };
  const items = root.appnews?.newsitems;
  if (!Array.isArray(items)) {
    throw new Error('Invalid news items format');
  }

  const out: CollectedArticle[] = [];
  for (const item of items) {
    const title = item.title;
    const url = item.url;
    if (title === undefined || url === undefined) {
      throw new Error('Missing title or URL');
    }

    const content = bbcodeToPlain(item.contents ?? '');
    const feedid = item.feedid ?? 0;
    const date = item.date ?? 0;
    const author = item.author ?? 'Steam';
    const publishedAt = date > 0 ? new Date(date * 1000).toISOString().slice(0, 10) : null;

    const metadata = JSON.stringify({
      appid,
      feedid,
      author,
      date,
      tags: item.tags ?? [],
    });

    out.push({
      feedId: 0, // collector が上書き
      externalId: `steam:${appid}:${feedid}`,
      title,
      url,
      urlNormalized: null,
      content,
      summary: null,
      author,
      publishedAt,
      importanceScore: steamScore(item),
      isDuplicate: false,
      duplicateOf: null,
      language: 'en',
      thumbnailUrl: null,
      contentHash: null,
      metadata,
    });
  }
  return out;
}

/** Steam アプリのニュースを取得する。 */
export async function fetchAppNews(appid: number): Promise<CollectedArticle[]> {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=10&maxlength=0&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Steam API error: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseSteamNewsJson(json, appid);
}

export interface SteamGameEntry {
  appid: number;
  name: string;
  playtimeForever: number;
  playtime2weeks: number;
  imgIconUrl: string | null;
}

/** Steam Web API でユーザーの所有ゲーム一覧を取得する。 */
export async function fetchOwnedGames(apiKey: string, steamId: string): Promise<SteamGameEntry[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new AppError('network', `Steam GetOwnedGames error: ${res.status}`);

  const json = (await res.json()) as {
    response?: {
      games?: Array<{
        appid?: number;
        name?: string;
        playtime_forever?: number;
        playtime_2weeks?: number;
        img_icon_url?: string;
      }>;
    };
  };
  const games = json.response?.games ?? [];

  const out: SteamGameEntry[] = [];
  for (const g of games) {
    const name = g.name ?? '';
    if (name === '') continue;
    const appid = g.appid ?? 0;
    const icon =
      g.img_icon_url !== undefined && g.img_icon_url !== ''
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${g.img_icon_url}.jpg`
        : null;
    out.push({
      appid,
      name,
      playtimeForever: g.playtime_forever ?? 0,
      playtime2weeks: g.playtime_2weeks ?? 0,
      imgIconUrl: icon,
    });
  }
  return out;
}
