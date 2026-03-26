// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------
export type Category = 'anime' | 'manga' | 'game' | 'pc' | 'all';

// ---------------------------------------------------------------------------
// LLM Provider
// ---------------------------------------------------------------------------
export type LlmProvider = 'perplexity_sonar' | 'ollama';

// ---------------------------------------------------------------------------
// DTOs — mirrored from Rust models (camelCase)
// ---------------------------------------------------------------------------

export interface FeedDto {
  id: number;
  name: string;
  url: string;
  feedType: string;
  category: Category;
  enabled: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
  consecutiveErrors: number;
  disabledReason: string | null;
  lastError: string | null;
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
  content: string | null; // ArticleDto にはない本文
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  feedName: string | null;
  importanceScore: number;
}

export interface DigestDto {
  id: number;
  category: Category;
  title: string;
  contentMarkdown: string;
  contentHtml: string | null;
  articleCount: number;
  modelUsed: string | null;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// AppError — matches Rust AppError serialization
// ---------------------------------------------------------------------------
export interface AppError {
  kind: string;
  message: string;
}

// ---------------------------------------------------------------------------
// v2 Discover types
// ---------------------------------------------------------------------------
export type DiscoverTab =
  | 'for_you'
  | 'trending'
  | 'popular'
  | 'most_viewed'
  | 'anime'
  | 'game'
  | 'manga'
  | 'hardware';

export type WingIdV2 = 'discover' | 'library' | 'profile' | 'saved' | 'schedule';

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
}

export interface DiscoverFeedResult {
  articles: DiscoverArticleDto[];
  total: number;
  hasMore: boolean;
}

export interface UserProfileDto {
  displayName: string;
  favoriteTitles: string[];
  favoriteGenres: string[];
  favoriteCreators: string[];
  totalRead: number;
}

export interface Citation {
  url: string;
  title: string | null;
}

export interface DeepDiveResult {
  question: string;
  answer: string;
  followUpQuestions: string[];
  provider: string;
  citations: Citation[];
}

export interface AiSearchResult {
  localArticles: ArticleDto[];
  aiAnswer: string | null;
  citations: Citation[];
}

export interface HighlightEntry {
  article: DiscoverArticleDto;
  reason: string;
}

// ---------------------------------------------------------------------------
// P5-D: Airing Schedule
// ---------------------------------------------------------------------------
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

export type ScheduleViewMode = 'day' | 'week' | 'month';
export type ScheduleTab = 'anime' | 'game';

export interface GameReleaseEntry {
  id: number;
  name: string;
  released: string;
  platforms: string[];
  backgroundImage: string | null;
  slug: string;
}
