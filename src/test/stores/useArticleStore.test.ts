import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useArticleStore } from '../../stores/useArticleStore';
import type { DiscoverFeedResult } from '../../types';

const mockedInvoke = vi.mocked(invoke);

const makeFeedResult = (count: number, hasMore = false): DiscoverFeedResult => ({
  articles: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    feedId: 1,
    title: `Article ${i + 1}`,
    url: null,
    summary: null,
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
  })),
  total: count,
  hasMore,
});

describe('useArticleStore', () => {
  beforeEach(() => {
    useArticleStore.setState({
      tab: 'for_you',
      articles: [],
      total: 0,
      hasMore: true,
      isLoading: false,
      error: null,
      offset: 0,
      highlights: [],
      highlightsLoading: false,
      highlightsError: false,
      highlightsFetchedAt: 0,
      unreadCounts: {},
      scrollPositions: {},
    });
  });

  describe('setTab', () => {
    it('updates tab and resets offset', () => {
      mockedInvoke.mockResolvedValueOnce(makeFeedResult(0));
      useArticleStore.getState().setTab('trending');

      const state = useArticleStore.getState();
      expect(state.tab).toBe('trending');
      expect(state.offset).toBe(0);
      expect(state.hasMore).toBe(true);
    });
  });

  describe('fetchFeed', () => {
    it('sets articles on success', async () => {
      mockedInvoke.mockResolvedValueOnce(makeFeedResult(3, true));

      await useArticleStore.getState().fetchFeed(true);

      const state = useArticleStore.getState();
      expect(state.articles).toHaveLength(3);
      expect(state.total).toBe(3);
      expect(state.hasMore).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.offset).toBe(3);
    });

    it('appends articles when not reset', async () => {
      useArticleStore.setState({
        articles: makeFeedResult(2).articles,
        offset: 2,
      });
      mockedInvoke.mockResolvedValueOnce(makeFeedResult(1));

      await useArticleStore.getState().fetchFeed(false);

      expect(useArticleStore.getState().articles).toHaveLength(3);
    });

    it('sets error on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('network error'));

      await useArticleStore.getState().fetchFeed(true);

      const state = useArticleStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('invokes with correct command and params', async () => {
      mockedInvoke.mockResolvedValueOnce(makeFeedResult(0));

      await useArticleStore.getState().fetchFeed(true);

      expect(mockedInvoke).toHaveBeenCalledWith('get_discover_feed', {
        tab: 'for_you',
        limit: 30,
        offset: 0,
      });
    });
  });

  describe('loadMore', () => {
    it('does nothing when already loading', async () => {
      useArticleStore.setState({ isLoading: true });
      await useArticleStore.getState().loadMore();
      expect(mockedInvoke).not.toHaveBeenCalled();
    });

    it('does nothing when no more items', async () => {
      useArticleStore.setState({ hasMore: false });
      await useArticleStore.getState().loadMore();
      expect(mockedInvoke).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('updates article isRead on success', async () => {
      useArticleStore.setState({
        articles: makeFeedResult(2).articles,
      });
      mockedInvoke.mockResolvedValueOnce(undefined);

      await useArticleStore.getState().markRead(1);

      const article = useArticleStore.getState().articles.find((a) => a.id === 1);
      expect(article?.isRead).toBe(true);
    });

    it('does not throw on failure', async () => {
      useArticleStore.setState({ articles: makeFeedResult(1).articles });
      mockedInvoke.mockRejectedValueOnce(new Error('fail'));

      await expect(useArticleStore.getState().markRead(1)).resolves.toBeUndefined();
    });
  });

  describe('toggleBookmark', () => {
    it('toggles bookmark state', async () => {
      useArticleStore.setState({ articles: makeFeedResult(1).articles });
      mockedInvoke.mockResolvedValueOnce(undefined);

      await useArticleStore.getState().toggleBookmark(1);

      const article = useArticleStore.getState().articles.find((a) => a.id === 1);
      expect(article?.isBookmarked).toBe(true);
    });
  });

  describe('updateArticleSummary', () => {
    it('updates aiSummary for matching article', () => {
      useArticleStore.setState({ articles: makeFeedResult(2).articles });

      useArticleStore.getState().updateArticleSummary(1, 'AI generated summary');

      const article = useArticleStore.getState().articles.find((a) => a.id === 1);
      expect(article?.aiSummary).toBe('AI generated summary');
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useArticleStore.setState({ error: 'some error' });
      useArticleStore.getState().clearError();
      expect(useArticleStore.getState().error).toBeNull();
    });
  });

  describe('saveScrollPosition', () => {
    it('saves position for tab', () => {
      useArticleStore.getState().saveScrollPosition('for_you', 500);
      expect(useArticleStore.getState().scrollPositions.for_you).toBe(500);
    });

    it('preserves other tab positions', () => {
      useArticleStore.setState({ scrollPositions: { trending: 200 } });
      useArticleStore.getState().saveScrollPosition('for_you', 500);
      expect(useArticleStore.getState().scrollPositions.trending).toBe(200);
    });
  });

  describe('fetchHighlights', () => {
    it('fetches highlights from backend', async () => {
      const highlights = [{ article: makeFeedResult(1).articles[0], reason: 'trending' }];
      mockedInvoke.mockResolvedValueOnce(highlights);

      await useArticleStore.getState().fetchHighlights();

      const state = useArticleStore.getState();
      expect(state.highlights).toEqual(highlights);
      expect(state.highlightsLoading).toBe(false);
      expect(state.highlightsFetchedAt).toBeGreaterThan(0);
    });

    it('skips fetch if recently fetched', async () => {
      useArticleStore.setState({
        highlightsFetchedAt: Date.now(),
        highlights: [{ article: makeFeedResult(1).articles[0], reason: 'hot' }],
      });

      await useArticleStore.getState().fetchHighlights();
      expect(mockedInvoke).not.toHaveBeenCalled();
    });

    it('sets error flag on failure', async () => {
      mockedInvoke.mockRejectedValueOnce(new Error('fail'));

      await useArticleStore.getState().fetchHighlights();

      expect(useArticleStore.getState().highlightsError).toBe(true);
    });
  });
});
