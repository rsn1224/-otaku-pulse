/**
 * @module tauri-commands
 * @description Tauri invoke ラッパー。全コマンド呼び出しをここに集約する。
 * @dependencies ./api (fetch ベースの invoke。Tauri から移行)
 * @entrypoint ./tauri-commands.ts
 */

import type {
  AiringEntry,
  AiSearchResult,
  ArticleDetailDto,
  ArticleDto,
  ChatMessage,
  Citation,
  ClusterGroup,
  DeepDiveResult,
  DiscoverArticleDto,
  DiscoverFeedResult,
  DiscoverTab,
  FeedDto,
  GameReleaseEntry,
  HighlightEntry,
  PcStatusView,
  TodayViewItem,
  UserProfileDto,
} from '../types';
import { invoke } from './api';

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

export interface AddCustomFeedParams {
  name: string;
  url: string;
  feedType: string;
  category: string;
  config?: string | null;
  fetchIntervalMinutes?: number;
}

export function addCustomFeed(params: AddCustomFeedParams): Promise<number> {
  return invoke<number>('add_custom_feed', { ...params });
}

// ---------------------------------------------------------------------------
// System status (機能A) — PC framework / pending plans の状態取得
// ---------------------------------------------------------------------------

export function getPcStatus(): Promise<PcStatusView> {
  return invoke<PcStatusView>('get_pc_status');
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

export function askDeepDiveFollowup(
  articleId: number,
  question: string,
  history: ChatMessage[],
): Promise<DeepDiveResult> {
  return invoke<DeepDiveResult>('ask_deepdive_followup', { articleId, question, history });
}

/**
 * ADR-5: deepdive 回答をストリーミング取得する。answer を逐次 onAnswer に渡し、最終結果を返す。
 * バックエンドは生トークン（末尾に ---FOLLOWUP--- + followUps JSON）を chunked text で返す。
 */
export async function askDeepDiveStream(
  articleId: number,
  question: string,
  history: ChatMessage[],
  onAnswer: (answerSoFar: string) => void,
): Promise<DeepDiveResult> {
  const res = await fetch('/api/ask_deepdive_stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, question, history }),
  });
  if (!res.ok || res.body === null) {
    let err: { kind: string; message: string };
    try {
      err = (await res.json()) as { kind: string; message: string };
    } catch {
      err = { kind: 'http', message: `HTTP ${res.status}` };
    }
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const FOLLOWUP = '---FOLLOWUP---';
  let raw = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    const idx = raw.indexOf(FOLLOWUP);
    onAnswer((idx === -1 ? raw : raw.slice(0, idx)).trim());
  }

  return parseDeepDiveStreamRaw(raw, question);
}

/**
 * streaming レスポンス本文（`answer ---FOLLOWUP--- [followups] ---CITATIONS--- [citations]`）を
 * DeepDiveResult にパースする純関数。CITATIONS ブロックを先に切り離すことで、followup の
 * 正規表現（貪欲マッチ）が citations 配列を飲み込むのを防ぐ。
 */
export function parseDeepDiveStreamRaw(raw: string, question: string): DeepDiveResult {
  const FOLLOWUP = '---FOLLOWUP---';
  const CITATIONS = '---CITATIONS---';

  const citIdx = raw.indexOf(CITATIONS);
  const beforeCitations = citIdx === -1 ? raw : raw.slice(0, citIdx);
  let citations: Citation[] = [];
  if (citIdx !== -1) {
    const match = raw.slice(citIdx + CITATIONS.length).match(/\[[\s\S]*\]/);
    if (match !== null) {
      try {
        const arr = JSON.parse(match[0]) as unknown;
        if (Array.isArray(arr)) {
          citations = arr
            .filter(
              (x): x is { url: string; title?: unknown } =>
                typeof x === 'object' &&
                x !== null &&
                typeof (x as { url?: unknown }).url === 'string',
            )
            .map((x) => ({ url: x.url, title: typeof x.title === 'string' ? x.title : null }));
        }
      } catch {
        // ignore malformed citations
      }
    }
  }

  const idx = beforeCitations.indexOf(FOLLOWUP);
  const answer = (idx === -1 ? beforeCitations : beforeCitations.slice(0, idx)).trim();
  let followUpQuestions: string[] = [];
  if (idx !== -1) {
    const match = beforeCitations.slice(idx + FOLLOWUP.length).match(/\[[\s\S]*\]/);
    if (match !== null) {
      try {
        const arr = JSON.parse(match[0]) as unknown;
        if (Array.isArray(arr)) {
          followUpQuestions = arr.filter((x): x is string => typeof x === 'string');
        }
      } catch {
        // ignore malformed followups
      }
    }
  }
  return { question, answer, followUpQuestions, provider: '', citations };
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

// ---------------------------------------------------------------------------
// v1.1: AniList / Steam sync
// ---------------------------------------------------------------------------

export function syncAniListNow(): Promise<string> {
  return invoke<string>('sync_anilist_now');
}

export function getAniListSyncStatus(): Promise<string | null> {
  return invoke<string | null>('get_anilist_sync_status');
}

export function syncSteamNow(): Promise<string> {
  return invoke<string>('sync_steam_now');
}

export function getSteamSyncStatus(): Promise<string | null> {
  return invoke<string | null>('get_steam_sync_status');
}

// ---------------------------------------------------------------------------
// v1.1: Clustering
// ---------------------------------------------------------------------------

export function getClusteredFeed(category?: string, limit?: number): Promise<ClusterGroup[]> {
  return invoke<ClusterGroup[]>('get_clustered_feed', { category, limit });
}

export function runClustering(): Promise<number> {
  return invoke<number>('run_clustering');
}

// ---------------------------------------------------------------------------
// v1.1: Today View
// ---------------------------------------------------------------------------

export function getTodayView(): Promise<TodayViewItem[]> {
  return invoke<TodayViewItem[]>('get_today_view');
}

// ---------------------------------------------------------------------------
// v1.1 P2: Context Memo / Weekly Report
// ---------------------------------------------------------------------------

export function getContextMemo(articleId: number): Promise<string> {
  return invoke<string>('get_context_memo', { articleId });
}

export function runWeeklyReportNow(): Promise<string> {
  return invoke<string>('run_weekly_report_now');
}

export function runResearchReport(query: string): Promise<string> {
  return invoke<string>('run_research_report', { query });
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export function getDigests(category?: string): Promise<import('../types').DigestDto[]> {
  return invoke('get_digests', { category });
}

export function getLatestDigest(category: string): Promise<import('../types').DigestDto | null> {
  return invoke('get_latest_digest', { category });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_settings');
}

export function updateSetting(key: string, value: string): Promise<void> {
  return invoke<void>('update_setting', { key, value });
}
