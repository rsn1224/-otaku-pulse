import { describe, expect, it } from 'vitest';
import { applyMuteFilters, getHighlightKeywords } from '../../lib/articleFilter';
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

describe('applyMuteFilters', () => {
  it('returns all articles when no mute keywords', () => {
    const articles = [makeArticle()];
    expect(applyMuteFilters(articles, [])).toEqual(articles);
  });

  it('filters articles matching mute keyword in title', () => {
    const articles = [
      makeArticle({ id: 1, title: 'Spoiler Alert' }),
      makeArticle({ id: 2, title: 'Normal News' }),
    ];
    const result = applyMuteFilters(articles, ['spoiler']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters articles matching mute keyword in summary', () => {
    const articles = [makeArticle({ summary: 'Contains blocked content' })];
    expect(applyMuteFilters(articles, ['blocked'])).toHaveLength(0);
  });

  it('filters articles matching mute keyword in aiSummary', () => {
    const articles = [makeArticle({ aiSummary: 'AI says this is spoiler' })];
    expect(applyMuteFilters(articles, ['spoiler'])).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const articles = [makeArticle({ title: 'UPPERCASE Title' })];
    expect(applyMuteFilters(articles, ['uppercase'])).toHaveLength(0);
  });

  it('handles null summary and aiSummary', () => {
    const articles = [makeArticle({ title: 'No Match', summary: null, aiSummary: null })];
    expect(applyMuteFilters(articles, ['blocked'])).toHaveLength(1);
  });

  it('handles multiple mute keywords', () => {
    const articles = [
      makeArticle({ id: 1, title: 'Anime Review' }),
      makeArticle({ id: 2, title: 'Game Update' }),
      makeArticle({ id: 3, title: 'Manga Chapter' }),
    ];
    const result = applyMuteFilters(articles, ['review', 'chapter']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
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
