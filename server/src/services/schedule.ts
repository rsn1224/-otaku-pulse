import { executeQuery as queryAniList } from '../infra/anilist.ts';

// commands/schedule.rs の get_airing_schedule 移植（AniList airing GraphQL）。

export interface AiringEntry {
  id: number;
  episode: number;
  airingAt: number;
  mediaId: number;
  titleNative: string | null;
  titleRomaji: string;
  coverImageUrl: string | null;
  totalEpisodes: number | null;
  siteUrl: string | null;
}

const AIRING_QUERY = `query AiringSchedule($airingAtGreater: Int, $airingAtLesser: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
      id episode airingAt
      media {
        id
        title { native romaji }
        coverImage { medium }
        episodes
        siteUrl
      }
    }
  }
}`;

interface AiringNode {
  id: number;
  episode: number;
  airingAt: number;
  media: {
    id: number;
    title: { native?: string | null; romaji?: string | null };
    coverImage?: { medium?: string | null } | null;
    episodes?: number | null;
    siteUrl?: string | null;
  };
}

interface AiringResp {
  data: { Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AiringNode[] } };
}

export async function getAiringSchedule(
  startTimestamp?: number,
  daysAhead?: number,
): Promise<AiringEntry[]> {
  const start = startTimestamp ?? Math.floor(Date.now() / 1000);
  const days = daysAhead ?? 7;
  const end = start + days * 86400;

  const all: AiringEntry[] = [];
  for (let page = 1; page <= 5; page++) {
    const response = await queryAniList(AIRING_QUERY, {
      airingAtGreater: start,
      airingAtLesser: end,
      page,
    });
    const parsed = JSON.parse(response) as AiringResp;
    const pg = parsed.data.Page;
    for (const node of pg.airingSchedules) {
      all.push({
        id: node.id,
        episode: node.episode,
        airingAt: node.airingAt,
        mediaId: node.media.id,
        titleNative: node.media.title.native ?? null,
        titleRomaji: node.media.title.romaji ?? '',
        coverImageUrl: node.media.coverImage?.medium ?? null,
        totalEpisodes: node.media.episodes ?? null,
        siteUrl: node.media.siteUrl ?? null,
      });
    }
    if (!pg.pageInfo.hasNextPage) break;
  }
  return all;
}
