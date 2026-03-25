// ---------------------------------------------------------------------------
// Wing IDs
// ---------------------------------------------------------------------------
export type WingId = 'dashboard' | 'feed' | 'digest' | 'saved' | 'schedule' | 'settings';

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
