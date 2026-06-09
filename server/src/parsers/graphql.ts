import type { CollectedArticle } from '../types/models.ts';

// graphql_parser.rs + graphql_types.rs の移植。AniList レスポンス → Article。

interface MediaTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

interface MediaCoverImage {
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}

interface ExternalLink {
  site: string;
  url: string;
}

interface FuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface Media {
  id: number;
  title: MediaTitle;
  type?: string | null;
  format?: string | null;
  status?: string | null;
  description?: string | null;
  startDate?: FuzzyDate | null;
  episodes?: number | null;
  chapters?: number | null;
  coverImage?: MediaCoverImage | null;
  genres?: string[];
  averageScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  externalLinks?: ExternalLink[];
}

interface AniListResponse {
  data: { Page: { media: Media[] } };
}

function getPreferredTitle(t: MediaTitle): string {
  return t.userPreferred || t.english || t.romaji || t.native || 'Untitled';
}

function convertHtmlToText(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&nbsp;', ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function calculateImportanceScore(media: Media): number {
  let score = 0.5;
  if (media.popularity != null) score += Math.min(media.popularity / 10000, 0.3);
  if (media.trending != null) score += Math.min(media.trending / 1000, 0.2);
  if (media.averageScore != null) score += (media.averageScore / 100) * 0.2;
  score += Math.min((media.genres?.length ?? 0) / 20, 0.1);
  return Math.min(score, 1.0);
}

/** AniList レスポンス文字列を Article 配列に変換する。category: 'anime' | 'manga'。 */
export function anilistToArticles(response: string, category: string): CollectedArticle[] {
  const urlSegment = category.toLowerCase() === 'manga' ? 'manga' : 'anime';
  const parsed = JSON.parse(response) as AniListResponse;

  const out: CollectedArticle[] = [];
  for (const media of parsed.data.Page.media) {
    const title = getPreferredTitle(media.title);
    const content = convertHtmlToText(media.description ?? '');
    const publishedAt = media.startDate?.year != null ? `${media.startDate.year}-01-01` : null;

    const metadata = JSON.stringify({
      anilist_id: media.id,
      type: media.type,
      format: media.format,
      status: media.status,
      episodes: media.episodes,
      chapters: media.chapters,
      genres: media.genres,
      average_score: media.averageScore,
      popularity: media.popularity,
      trending: media.trending,
      external_links: media.externalLinks,
    });

    out.push({
      feedId: 0, // collector が上書き
      externalId: `anilist:${media.id}`,
      title,
      url: `https://anilist.co/${urlSegment}/${media.id}`,
      urlNormalized: null,
      content,
      summary: null,
      author: null,
      publishedAt,
      importanceScore: calculateImportanceScore(media),
      isDuplicate: false,
      duplicateOf: null,
      language: 'ja',
      thumbnailUrl: media.coverImage?.large ?? null,
      contentHash: null,
      metadata,
    });
  }
  return out;
}
