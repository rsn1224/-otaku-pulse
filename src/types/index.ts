// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------
export type Category = 'anime' | 'manga' | 'game' | 'pc' | 'tech' | 'all';

// ---------------------------------------------------------------------------
// LLM Provider
// ---------------------------------------------------------------------------
export type LlmProvider = 'perplexity_sonar' | 'ollama' | 'anthropic';

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

// ---------------------------------------------------------------------------
// PC/System status (機能A) — mirrors Rust pc_status_service (camelCase)
// 記事ではないため article パイプラインを経由せず、get_pc_status で直接取得する。
// ---------------------------------------------------------------------------

export interface FrameworkStatusDto {
  name: string;
  kind: string;
  priority: string;
  note: string | null;
  applied: boolean;
  lastApply: string | null;
}

export interface PcStatusView {
  frameworks: FrameworkStatusDto[];
  pendingPlans: number;
  appliedCount: number;
  totalCount: number;
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
  | 'saved'
  | 'anime'
  | 'game'
  | 'manga'
  | 'hardware'
  | 'tech';

// ADR-10: 6→4 Wings 統合完了。Pulse=Discover+Saved / Digest=Digest+Schedule /
// Library / Profile(+観測+詳細)。Saved/Schedule はそれぞれ Pulse/Digest の内タブ。
export type WingIdV2 = 'pulse' | 'digest' | 'library' | 'profile';

export type ImpactLevel = 'confirmed' | 'rumor' | 'general';

export const IMPACT_LABEL: Record<ImpactLevel, string> = {
  confirmed: '🔴 速報',
  rumor: '🟡 噂',
  general: '',
} as const;

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
  /** v1.1: impact classification */
  impactLevel: ImpactLevel | null;
}

export interface ClusterGroup {
  clusterId: string;
  label: string;
  representative: DiscoverArticleDto;
  others: DiscoverArticleDto[];
  count: number;
}

export interface TodayViewItem {
  articleId: number;
  headline: string;
  rank: number;
  generatedAt: string;
  article?: DiscoverArticleDto;
}

export interface AniListWatchEntry {
  mediaId: number;
  titleRomaji: string;
  titleNative: string | null;
  status: 'CURRENT' | 'PLANNING';
  mediaType: string;
  coverImageUrl: string | null;
  fetchedAt: string;
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

/** Rust `infra::llm_client::ChatMessage` に対応（マルチターン DeepDive の会話履歴）。 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
