// 純粋関数: 記事フィルタリングロジック

interface ArticleRow {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: string;
  published_at: string | null;
  is_read: boolean;
  thumbnail_url: string | null;
}

interface KeywordFilter {
  id: number;
  keyword: string;
  filter_type: string;
  category: string | null;
  created_at: string;
}

/**
 * ミュートワードで記事をフィルタリング
 */
export function applyMuteFilters(articles: ArticleRow[], muteKeywords: string[]): ArticleRow[] {
  if (muteKeywords.length === 0) return articles;

  return articles.filter((article) => {
    const searchText = `${article.title} ${article.summary || ''}`.toLowerCase();

    return !muteKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
  });
}

/**
 * 記事に含まれるハイライトキーワードを取得
 */
export function getHighlightKeywords(article: ArticleRow, highlightKeywords: string[]): string[] {
  if (highlightKeywords.length === 0) return [];

  const searchText = `${article.title} ${article.summary || ''}`.toLowerCase();

  return highlightKeywords.filter((keyword) => searchText.includes(keyword.toLowerCase()));
}

/**
 * カテゴリ指定でフィルタリング
 */
export function filterByCategory(
  filters: KeywordFilter[],
  targetCategory: string,
): KeywordFilter[] {
  return filters.filter((filter) => !filter.category || filter.category === targetCategory);
}

/**
 * キーワードフィルターをタイプ別に分類
 */
export function separateFiltersByType(filters: KeywordFilter[]): {
  mute: string[];
  highlight: string[];
} {
  const muteKeywords: string[] = [];
  const highlightKeywords: string[] = [];

  filters.forEach((filter) => {
    if (filter.filter_type === 'mute') {
      muteKeywords.push(filter.keyword);
    } else if (filter.filter_type === 'highlight') {
      highlightKeywords.push(filter.keyword);
    }
  });

  return { mute: muteKeywords, highlight: highlightKeywords };
}
