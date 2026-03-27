import type { DiscoverArticleDto } from '../types';

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
