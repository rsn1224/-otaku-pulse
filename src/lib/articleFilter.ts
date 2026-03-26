import type { DiscoverArticleDto } from '../types';

/** ミュートキーワードに一致する記事を除外する */
export function applyMuteFilters(
  articles: DiscoverArticleDto[],
  muteKeywords: string[],
): DiscoverArticleDto[] {
  if (muteKeywords.length === 0) return articles;

  const lowerKeywords = muteKeywords.map((k) => k.toLowerCase());

  return articles.filter((article) => {
    const title = article.title.toLowerCase();
    const summary = (article.summary ?? '').toLowerCase();
    const aiSummary = (article.aiSummary ?? '').toLowerCase();

    return !lowerKeywords.some(
      (kw) => title.includes(kw) || summary.includes(kw) || aiSummary.includes(kw),
    );
  });
}

/** 記事に該当するハイライトキーワード一覧を返す */
export function getHighlightKeywords(
  article: DiscoverArticleDto,
  highlightKeywords: string[],
): string[] {
  if (highlightKeywords.length === 0) return [];

  const title = article.title.toLowerCase();
  const summary = (article.summary ?? '').toLowerCase();

  return highlightKeywords.filter((kw) => {
    const lower = kw.toLowerCase();
    return title.includes(lower) || summary.includes(lower);
  });
}
