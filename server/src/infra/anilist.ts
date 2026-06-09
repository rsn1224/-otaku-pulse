import { anilistLimiter } from '../lib/rate-limiter.ts';
import { anilistToArticles } from '../parsers/graphql.ts';
import type { CollectedArticle } from '../types/models.ts';
import { USER_AGENT } from './http.ts';

// anilist_client.rs の移植。共有レートリミッタで 30 req/min・2.1s 間隔を強制。

const ANILIST_API_URL = 'https://graphql.anilist.co';

const SEASONAL_ANIME_QUERY = `query SeasonalAnime($season: MediaSeason!, $year: Int!, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { total perPage currentPage lastPage hasNextPage }
    media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) {
      id
      title { romaji english native userPreferred }
      type format status
      description(asHtml: false)
      startDate { year month day }
      endDate { year month day }
      episodes
      coverImage { large medium color }
      bannerImage genres synonyms averageScore popularity trending
      externalLinks { site url }
    }
  }
}`;

const TRENDING_MANGA_QUERY = `query TrendingManga($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { total perPage currentPage lastPage hasNextPage }
    media(type: MANGA, sort: TRENDING_DESC) {
      id
      title { romaji english native userPreferred }
      type format status
      description(asHtml: false)
      startDate { year month day }
      endDate { year month day }
      chapters volumes
      coverImage { large medium color }
      bannerImage genres synonyms averageScore popularity trending
      externalLinks { site url }
    }
  }
}`;

/** 任意の AniList GraphQL クエリを実行する（airing schedule 等で再利用）。 */
export async function executeQuery(
  query: string,
  variables: Record<string, unknown>,
): Promise<string> {
  await anilistLimiter.acquire();
  const res = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`AniList API error: ${res.status} - ${errorText}`);
  }
  return res.text();
}

export async function fetchSeasonalAnime(
  season: string,
  year: number,
  page: number,
): Promise<CollectedArticle[]> {
  const response = await executeQuery(SEASONAL_ANIME_QUERY, { season, year, page });
  return anilistToArticles(response, 'anime');
}

export async function fetchTrendingManga(page: number): Promise<CollectedArticle[]> {
  const response = await executeQuery(TRENDING_MANGA_QUERY, { page });
  return anilistToArticles(response, 'manga');
}

export interface WatchlistEntry {
  mediaId: number;
  titleRomaji: string;
  titleNative: string | null;
  status: string;
  mediaType: string;
  coverImageUrl: string | null;
}

const WATCHLIST_QUERY = `query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME, status_in: [CURRENT, PLANNING]) {
    lists { entries { status media { id title { romaji native } type coverImage { medium } } } }
  }
}`;

interface WatchlistResp {
  data?: {
    MediaListCollection?: {
      lists?: Array<{
        entries?: Array<{
          status?: string;
          media?: {
            id?: number;
            title?: { romaji?: string | null; native?: string | null };
            type?: string;
            coverImage?: { medium?: string | null };
          };
        }>;
      }>;
    };
  };
}

/** AniList ユーザーのウォッチリスト（CURRENT + PLANNING）を取得する。 */
export async function fetchUserWatchlist(username: string): Promise<WatchlistEntry[]> {
  const response = await executeQuery(WATCHLIST_QUERY, { username });
  const parsed = JSON.parse(response) as WatchlistResp;
  const lists = parsed.data?.MediaListCollection?.lists ?? [];

  const out: WatchlistEntry[] = [];
  for (const list of lists) {
    for (const e of list.entries ?? []) {
      const m = e.media;
      if (m?.id === undefined) continue;
      out.push({
        mediaId: m.id,
        titleRomaji: m.title?.romaji ?? '',
        titleNative: m.title?.native ?? null,
        status: e.status ?? '',
        mediaType: m.type ?? 'ANIME',
        coverImageUrl: m.coverImage?.medium ?? null,
      });
    }
  }
  return out;
}
