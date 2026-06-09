import { fetchSeasonalAnime, fetchTrendingManga } from '../infra/anilist.ts';
import type { CollectedArticle, FeedRow } from '../types/models.ts';

// collectors.rs の AniListCollector 移植。

const ANILIST_PER_PAGE = 50;
const MAX_ANILIST_PAGES = 3;

function currentSeason(month: number): string {
  if (month >= 1 && month <= 3) return 'WINTER';
  if (month >= 4 && month <= 6) return 'SPRING';
  if (month >= 7 && month <= 9) return 'SUMMER';
  return 'FALL';
}

export async function collectAniList(feed: FeedRow): Promise<CollectedArticle[]> {
  const isManga = feed.category === 'manga';
  const now = new Date();
  const season = currentSeason(now.getUTCMonth() + 1);
  const year = now.getUTCFullYear();

  const all: CollectedArticle[] = [];
  for (let page = 1; page <= MAX_ANILIST_PAGES; page++) {
    const batch = isManga
      ? await fetchTrendingManga(page)
      : await fetchSeasonalAnime(season, year, page);
    all.push(...batch);
    if (batch.length < ANILIST_PER_PAGE) break;
  }

  for (const a of all) a.feedId = feed.id;
  return all;
}
