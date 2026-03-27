import { describe, expect, it } from 'vitest';
import { getHighlightKeywords } from '../../lib/articleFilter';
import type { DiscoverArticleDto } from '../../types';

const makeArticle = (overrides: Partial<DiscoverArticleDto> = {}): DiscoverArticleDto => ({
  id: 1,
  feedId: 1,
  title: 'Test Article',
  url: null,
  summary: 'A summary about anime news',
  author: null,
  publishedAt: null,
  isRead: false,
  isBookmarked: false,
  language: null,
  thumbnailUrl: null,
  feedName: null,
  aiSummary: null,
  totalScore: null,
  category: null,
  ...overrides,
});

describe('getHighlightKeywords', () => {
  it('returns empty array when no highlight keywords', () => {
    expect(getHighlightKeywords(makeArticle(), [])).toEqual([]);
  });

  it('returns matching keywords from title', () => {
    const article = makeArticle({ title: 'Dragon Ball Super Update' });
    expect(getHighlightKeywords(article, ['Dragon Ball', 'Naruto'])).toEqual(['Dragon Ball']);
  });

  it('returns matching keywords from summary', () => {
    const article = makeArticle({ summary: 'New Zelda game announced' });
    expect(getHighlightKeywords(article, ['Zelda'])).toEqual(['Zelda']);
  });

  it('is case insensitive', () => {
    const article = makeArticle({ title: 'POKEMON new release' });
    expect(getHighlightKeywords(article, ['pokemon'])).toEqual(['pokemon']);
  });

  it('returns multiple matching keywords', () => {
    const article = makeArticle({ title: 'Pokemon and Zelda news' });
    const result = getHighlightKeywords(article, ['Pokemon', 'Zelda', 'Mario']);
    expect(result).toEqual(['Pokemon', 'Zelda']);
  });
});
