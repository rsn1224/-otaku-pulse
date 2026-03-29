/**
 * @module tauri-commands
 * @description Tauri invoke ラッパー。全コマンド呼び出しをここに集約する。
 * @dependencies @tauri-apps/api/core
 * @entrypoint ./tauri-commands.ts
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  AiringEntry,
  AiSearchResult,
  ArticleDetailDto,
  ArticleDto,
  DeepDiveResult,
  DiscoverArticleDto,
  DiscoverFeedResult,
  DiscoverTab,
  FeedDto,
  GameReleaseEntry,
  HighlightEntry,
  UserProfileDto,
} from '../types';

// ---------------------------------------------------------------------------
// Scheduler types (local — matches Rust DTOs)
// ---------------------------------------------------------------------------

export interface SchedulerConfig {
  collect_interval_minutes: number;
  digest_hour: number;
  digest_minute: number;
  enabled: boolean;
}

export interface CollectResult {
  fetched: number;
  saved: number;
  deduped: number;
  errors: string[];
}

export interface DigestResult {
  category: string;
  summary: string;
  article_count: number;
  generated_at: string;
  is_ai_generated: boolean;
  provider?: string;
  model?: string;
  fallback_reason?: string;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface KeywordFilterDto {
  id: number;
  keyword: string;
  filterType: string;
  category: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// LLM types
// ---------------------------------------------------------------------------

export interface LlmSettingsResponse {
  provider: string;
  perplexity_api_key_set: boolean;
  ollama_base_url: string;
  ollama_model: string;
  available_ollama_models: string[];
  ollama_running: boolean;
}

export interface PreferenceSuggestion {
  suggestedTitles: string[];
  suggestedGenres: string[];
  suggestedCreators: string[];
  reason: string;
}

// ---------------------------------------------------------------------------
// Feed commands
// ---------------------------------------------------------------------------

export function getFeeds(): Promise<FeedDto[]> {
  return invoke<FeedDto[]>('get_feeds');
}

export function refreshFeed(feedId: number): Promise<number> {
  return invoke<number>('refresh_feed', { feedId });
}

export function deleteFeed(feedId: number): Promise<void> {
  return invoke<void>('delete_feed', { feedId });
}

export function reenableFeed(feedId: number): Promise<void> {
  return invoke<void>('reenable_feed', { feedId });
}

export function exportOpml(): Promise<string> {
  return invoke<string>('export_opml');
}

export function importOpml(xml: string): Promise<number> {
  return invoke<number>('import_opml', { xml });
}

export function initDefaultFeeds(): Promise<number> {
  return invoke<number>('init_default_feeds');
}

// ---------------------------------------------------------------------------
// Article commands
// ---------------------------------------------------------------------------

export function getDiscoverFeed(
  tab: DiscoverTab,
  limit: number,
  offset: number,
): Promise<DiscoverFeedResult> {
  return invoke<DiscoverFeedResult>('get_discover_feed', { tab, limit, offset });
}

export function getArticleDetail(articleId: number): Promise<ArticleDetailDto> {
  return invoke<ArticleDetailDto>('get_article_detail', { articleId });
}

export function getBookmarkedArticles(): Promise<ArticleDto[]> {
  return invoke<ArticleDto[]>('get_bookmarked_articles');
}

export function getLibraryArticles(limit: number, offset: number): Promise<DiscoverFeedResult> {
  return invoke<DiscoverFeedResult>('get_library_articles', { limit, offset });
}

export function getRelatedArticles(articleId: number): Promise<DiscoverArticleDto[]> {
  return invoke<DiscoverArticleDto[]>('get_related_articles', { articleId });
}

export function markRead(articleId: number): Promise<void> {
  return invoke<void>('mark_read', { articleId });
}

export function toggleBookmark(articleId: number): Promise<void> {
  return invoke<void>('toggle_bookmark', { articleId });
}

export function recordInteraction(
  articleId: number,
  action: string,
  dwellSeconds?: number | null,
): Promise<void> {
  return invoke<void>('record_interaction', { articleId, action, dwellSeconds });
}

export function markAllReadCategory(category: string): Promise<void> {
  return invoke<void>('mark_all_read_category', { category });
}

export function cleanupOldArticles(daysOld: number): Promise<number> {
  return invoke<number>('cleanup_old_articles', { daysOld });
}

export function rescoreArticles(): Promise<void> {
  return invoke<void>('rescore_articles');
}

// ---------------------------------------------------------------------------
// Collection commands
// ---------------------------------------------------------------------------

export function runCollectNow(): Promise<CollectResult> {
  return invoke<CollectResult>('run_collect_now');
}

// ---------------------------------------------------------------------------
// Highlights & Scoring
// ---------------------------------------------------------------------------

export function getDailyHighlights(): Promise<HighlightEntry[]> {
  return invoke<HighlightEntry[]>('get_daily_highlights');
}

export function getUnreadCounts(): Promise<Record<string, number>> {
  return invoke<Record<string, number>>('get_unread_counts');
}

// ---------------------------------------------------------------------------
// AI / Summary / DeepDive
// ---------------------------------------------------------------------------

export function getOrGenerateSummary(articleId: number): Promise<string> {
  return invoke<string>('get_or_generate_summary', { articleId });
}

export function batchGenerateSummaries(limit: number): Promise<number> {
  return invoke<number>('batch_generate_summaries', { limit });
}

export function getDeepDiveQuestions(articleId: number): Promise<string[]> {
  return invoke<string[]>('get_deepdive_questions', { articleId });
}

export function askDeepDive(articleId: number, question: string): Promise<DeepDiveResult> {
  return invoke<DeepDiveResult>('ask_deepdive', { articleId, question });
}

export function aiSearch(query: string): Promise<AiSearchResult> {
  return invoke<AiSearchResult>('ai_search', { query });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getUserProfile(): Promise<UserProfileDto> {
  return invoke<UserProfileDto>('get_user_profile');
}

export function updateUserProfile(profile: UserProfileDto): Promise<void> {
  return invoke<void>('update_user_profile', { profile });
}

export function resetLearningData(): Promise<void> {
  return invoke<void>('reset_learning_data');
}

export function suggestPreferences(): Promise<PreferenceSuggestion> {
  return invoke<PreferenceSuggestion>('suggest_preferences');
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function getSchedulerConfig(): Promise<SchedulerConfig> {
  return invoke<SchedulerConfig>('get_scheduler_config');
}

export function setSchedulerConfig(config: SchedulerConfig): Promise<void> {
  return invoke<void>('set_scheduler_config', { config });
}

export function runDigestNow(): Promise<DigestResult[]> {
  return invoke<DigestResult[]>('run_digest_now');
}

// ---------------------------------------------------------------------------
// Schedule (AniList / RAWG)
// ---------------------------------------------------------------------------

export function getAiringSchedule(
  startTimestamp: number,
  daysAhead: number,
): Promise<AiringEntry[]> {
  return invoke<AiringEntry[]>('get_airing_schedule', { startTimestamp, daysAhead });
}

export function getGameReleases(startDate: string, endDate: string): Promise<GameReleaseEntry[]> {
  return invoke<GameReleaseEntry[]>('get_game_releases', { startDate, endDate });
}

// ---------------------------------------------------------------------------
// LLM Settings
// ---------------------------------------------------------------------------

export function getLlmSettings(): Promise<LlmSettingsResponse> {
  return invoke<LlmSettingsResponse>('get_llm_settings');
}

export function setLlmProvider(provider: string): Promise<void> {
  return invoke<void>('set_llm_provider', { provider });
}

export function setOllamaSettings(baseUrl: string, model: string): Promise<void> {
  return invoke<void>('set_ollama_settings', { baseUrl, model });
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export function setPerplexityApiKey(apiKey: string): Promise<void> {
  return invoke<void>('set_perplexity_api_key', { apiKey });
}

export function clearPerplexityApiKey(): Promise<void> {
  return invoke<void>('clear_perplexity_api_key');
}

export function setRawgApiKey(apiKey: string): Promise<void> {
  return invoke<void>('set_rawg_api_key', { apiKey });
}

export function clearRawgApiKey(): Promise<void> {
  return invoke<void>('clear_rawg_api_key');
}

export function isRawgApiKeySet(): Promise<boolean> {
  return invoke<boolean>('is_rawg_api_key_set');
}

// ---------------------------------------------------------------------------
// Keyword Filters
// ---------------------------------------------------------------------------

export function getKeywordFilters(): Promise<KeywordFilterDto[]> {
  return invoke<KeywordFilterDto[]>('get_keyword_filters');
}

export function addKeywordFilter(
  keyword: string,
  filterType: string,
  category: string | null,
): Promise<KeywordFilterDto> {
  return invoke<KeywordFilterDto>('add_keyword_filter', { keyword, filterType, category });
}

export function removeKeywordFilter(id: number): Promise<void> {
  return invoke<void>('remove_keyword_filter', { id });
}
