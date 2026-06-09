import type { FeedRow } from './models.ts';

// src/types/index.ts に対応する camelCase DTO と、DB 行 (snake_case) → DTO マッパー。

export interface FeedDto {
  id: number;
  name: string;
  url: string;
  feedType: string;
  category: string;
  enabled: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
  consecutiveErrors: number;
  disabledReason: string | null;
  lastError: string | null;
}

export interface DiscoverArticleDto {
  id: number;
  feedId: number;
  title: string;
  url: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isBookmarked: boolean;
  language: string | null;
  thumbnailUrl: string | null;
  feedName: string | null;
  aiSummary: string | null;
  totalScore: number | null;
  category: string | null;
  impactLevel: string | null;
}

export interface DiscoverFeedResult {
  articles: DiscoverArticleDto[];
  total: number;
  hasMore: boolean;
}

export interface ArticleDto {
  id: number;
  feedId: number;
  title: string;
  url: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  importanceScore: number;
  isRead: boolean;
  isBookmarked: boolean;
  language: string | null;
  thumbnailUrl: string | null;
  feedName: string | null;
}

export interface ArticleDetailDto {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  feedName: string | null;
  importanceScore: number;
}

export interface DigestDto {
  id: number;
  category: string;
  title: string;
  contentMarkdown: string;
  contentHtml: string | null;
  articleCount: number;
  modelUsed: string | null;
  generatedAt: string;
}

export interface HighlightEntry {
  article: DiscoverArticleDto;
  reason: string;
}

export interface UnreadCounts {
  forYou: number;
  trending: number;
  anime: number;
  game: number;
  manga: number;
  hardware: number;
  tech: number;
}

export interface KeywordFilterDto {
  id: number;
  keyword: string;
  filterType: string;
  category: string | null;
  createdAt: string;
}

export interface UserProfileDto {
  displayName: string;
  favoriteTitles: string[];
  favoriteGenres: string[];
  favoriteCreators: string[];
  totalRead: number;
}

// --- DB 行型 (snake_case) ---

export interface DiscoverRow {
  id: number;
  feed_id: number;
  title: string;
  url: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  is_read: number;
  is_bookmarked: number;
  language: string | null;
  thumbnail_url: string | null;
  ai_summary: string | null;
  feed_name: string | null;
  category: string | null;
  impact_level: string | null;
  total_score: number | null;
}

export function toDiscoverArticleDto(r: DiscoverRow): DiscoverArticleDto {
  return {
    id: r.id,
    feedId: r.feed_id,
    title: r.title,
    url: r.url,
    summary: r.summary,
    author: r.author,
    publishedAt: r.published_at,
    isRead: r.is_read !== 0,
    isBookmarked: r.is_bookmarked !== 0,
    language: r.language,
    thumbnailUrl: r.thumbnail_url,
    feedName: r.feed_name,
    aiSummary: r.ai_summary,
    totalScore: r.total_score,
    category: r.category,
    impactLevel: r.impact_level,
  };
}

export function toFeedDto(f: FeedRow): FeedDto {
  return {
    id: f.id,
    name: f.name,
    url: f.url,
    feedType: f.feed_type,
    category: f.category,
    enabled: f.enabled !== 0,
    fetchIntervalMinutes: f.fetch_interval_minutes,
    lastFetchedAt: f.last_fetched_at,
    consecutiveErrors: f.consecutive_errors,
    disabledReason: f.disabled_reason,
    lastError: f.last_error,
  };
}
