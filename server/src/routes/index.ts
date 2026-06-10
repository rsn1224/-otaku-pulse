import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import {
  getArticleDetail,
  getBookmarkedArticles,
  markRead,
  recordInteraction,
  toggleBookmark,
} from '../db/articles-read.ts';
import { deleteDigest, getLatestDigest, listDigests } from '../db/digests.ts';
import {
  getDiscoverFeed,
  getLibraryArticles,
  getRelatedArticles,
  getUnreadCounts,
  markAllReadCategory,
} from '../db/discover.ts';
import {
  cleanupOldArticles,
  deleteFeed,
  getFeedById,
  listFeeds,
  reenableFeed,
} from '../db/feeds-read.ts';
import { addCustomFeed, getAllFeedsForExport, importFeedIfNew } from '../db/feeds-write.ts';
import { addKeywordFilter, getKeywordFilters, removeKeywordFilter } from '../db/filters.ts';
import { searchArticles } from '../db/fts.ts';
import { getDailyHighlights } from '../db/highlights.ts';
import {
  adjustFeedPreference,
  getProfile,
  incrementReadCount,
  resetLearningData,
  updateProfile,
} from '../db/profile.ts';
import { loadSettings, upsertSetting } from '../db/settings.ts';
import { getTrendingKeywords } from '../db/trending.ts';
import { AppError, invalidInput, notImplemented } from '../error.ts';
import { bus, type DomainEvent, emitEvent } from '../events/bus.ts';
import {
  deleteCredential,
  loadCredential,
  RAWG_ACCOUNT,
  storeCredential,
} from '../infra/credentials.ts';
import { fetchGameReleases } from '../infra/rawg.ts';
import { checkOllamaStatus } from '../llm/ollama.ts';
import { routeFor, tryRouteFor } from '../llm/router.ts';
import {
  clearAnthropicKey,
  clearPerplexityKey,
  getLlmSettings,
  setAnthropicKey,
  setAnthropicModel,
  setEmbeddingModel,
  setOllamaSettings,
  setPerplexityKey,
  setProvider,
} from '../llm/settings.ts';
import { type ChatMessage, providerDebugName } from '../llm/types.ts';
import { exportOpml, parseOpml } from '../parsers/opml.ts';
import { getSchedulerConfig, reconfigureScheduler } from '../scheduler/index.ts';
import { aiSearch } from '../services/ai-search.ts';
import { clusterArticles, getClusteredFeed } from '../services/clustering.ts';
import { collectFeed, refreshAll } from '../services/collector.ts';
import { getOrGenerateContextMemo } from '../services/context-memo.ts';
import {
  answerFollowup,
  answerQuestion,
  checkProviderConsistency,
  generateQuestions,
  streamAnswer,
} from '../services/deepdive.ts';
import { runDigestNow } from '../services/digest.ts';
import { embedArticles, semanticSearch } from '../services/embeddings.ts';
import { getObservability } from '../services/observability.ts';
import { getPcStatus } from '../services/pc-status.ts';
import { suggestPreferences } from '../services/preferences.ts';
import { runResearchReport, runWeeklyReportNow } from '../services/reports.ts';
import { rescoreArticles } from '../services/rescore.ts';
import { getAiringSchedule } from '../services/schedule.ts';
import { batchGenerateSummaries, getOrGenerateSummary } from '../services/summary.ts';
import {
  getAniListSyncStatus,
  getSteamSyncStatus,
  syncAniListNow,
  syncSteamNow,
} from '../services/sync.ts';
import { getTodayView } from '../services/today-view.ts';
import type { UserProfileDto } from '../types/dto.ts';

type Args = Record<string, unknown>;
type Handler = (db: DatabaseSync, args: Args) => unknown | Promise<unknown>;

function reqNum(a: Args, key: string): number {
  const v = a[key];
  if (typeof v !== 'number') throw invalidInput(`${key} (number) が必要です`);
  return v;
}
function optNum(a: Args, key: string): number | undefined {
  const v = a[key];
  return typeof v === 'number' ? v : undefined;
}
function reqStr(a: Args, key: string): string {
  const v = a[key];
  if (typeof v !== 'string') throw invalidInput(`${key} (string) が必要です`);
  return v;
}
function optStr(a: Args, key: string): string | undefined {
  const v = a[key];
  return typeof v === 'string' ? v : undefined;
}
function optStrNull(a: Args, key: string): string | null {
  const v = a[key];
  return typeof v === 'string' ? v : null;
}

let collecting = false;

const core: Record<string, Handler> = {
  // Discover / Articles
  get_discover_feed: (db, a) =>
    getDiscoverFeed(db, reqStr(a, 'tab'), optNum(a, 'limit'), optNum(a, 'offset')),
  get_library_articles: (db, a) =>
    getLibraryArticles(db, optNum(a, 'limit') ?? 30, optNum(a, 'offset') ?? 0),
  get_unread_counts: (db) => getUnreadCounts(db),
  mark_all_read_category: (db, a) => markAllReadCategory(db, reqStr(a, 'category')),
  get_related_articles: (db, a) => getRelatedArticles(db, reqNum(a, 'articleId')),
  get_article_detail: (db, a) => getArticleDetail(db, reqNum(a, 'articleId')),
  get_bookmarked_articles: (db) => getBookmarkedArticles(db),
  mark_read: (db, a) => {
    markRead(db, reqNum(a, 'articleId'));
    return null;
  },
  toggle_bookmark: (db, a) => {
    toggleBookmark(db, reqNum(a, 'articleId'));
    return null;
  },
  record_interaction: (db, a) => {
    const action = reqStr(a, 'action');
    recordInteraction(db, reqNum(a, 'articleId'), action, optNum(a, 'dwellSeconds') ?? 0);
    if (action === 'open') incrementReadCount(db);
    return null;
  },
  get_daily_highlights: (db) => getDailyHighlights(db),
  search_discover: (db, a) =>
    searchArticles(db, reqStr(a, 'query'), optNum(a, 'limit') ?? 30, optNum(a, 'offset') ?? 0),

  // Feeds
  get_feeds: (db) => listFeeds(db),
  delete_feed: (db, a) => {
    deleteFeed(db, reqNum(a, 'feedId'));
    return null;
  },
  reenable_feed: (db, a) => {
    reenableFeed(db, reqNum(a, 'feedId'));
    return null;
  },
  cleanup_old_articles: (db, a) => cleanupOldArticles(db, reqNum(a, 'daysOld')),
  refresh_feed: async (db, a) => {
    const feed = getFeedById(db, reqNum(a, 'feedId'));
    if (feed === undefined) throw new AppError('database', 'feed not found');
    return collectFeed(db, feed);
  },
  init_default_feeds: () => 0,

  // Collection
  run_collect_now: async (db) => {
    if (collecting) return { fetched: 0, saved: 0, deduped: 0, errors: [] };
    collecting = true;
    try {
      const r = await refreshAll(db, false);
      // 全滅（1件も保存できず error あり）= オフライン扱い。部分失敗は completed。
      if (r.saved === 0 && r.errors.length > 0) {
        emitEvent('collect-failed', {
          message: r.errors[0] ?? '収集に失敗しました',
          errorCount: r.errors.length,
        });
      } else {
        emitEvent('collect-completed', r);
      }
      // ADR-7: 収集後に embedding 索引をバックグラウンドで増分構築（応答はブロックしない）。
      void embedArticles(db, 100).catch(() => {});
      return r;
    } finally {
      collecting = false;
    }
  },

  // Settings / Filters / Digests
  get_settings: (db) => loadSettings(db),
  update_setting: (db, a) => {
    upsertSetting(db, reqStr(a, 'key'), reqStr(a, 'value'));
    return null;
  },
  get_keyword_filters: (db) => getKeywordFilters(db),
  add_keyword_filter: (db, a) =>
    addKeywordFilter(db, reqStr(a, 'keyword'), reqStr(a, 'filterType'), optStrNull(a, 'category')),
  remove_keyword_filter: (db, a) => {
    removeKeywordFilter(db, reqNum(a, 'id'));
    return null;
  },
  get_digests: (db, a) => listDigests(db, optStr(a, 'category')),
  get_latest_digest: (db, a) => getLatestDigest(db, reqStr(a, 'category')),
  delete_digest: (db, a) => {
    deleteDigest(db, reqNum(a, 'digestId'));
    return null;
  },

  // AI: Summary / DeepDive / Search（ADR-2 ルーティング）
  get_or_generate_summary: (db, a) =>
    getOrGenerateSummary(db, reqNum(a, 'articleId'), routeFor('summary')),
  batch_generate_summaries: (db, a) =>
    batchGenerateSummaries(db, routeFor('summary'), optNum(a, 'limit') ?? 10),
  get_deepdive_questions: (db, a) =>
    generateQuestions(db, reqNum(a, 'articleId'), routeFor('questions')),
  ask_deepdive: (db, a) => {
    const articleId = reqNum(a, 'articleId');
    const question = reqStr(a, 'question');
    const client = routeFor('deepdive');
    checkProviderConsistency(db, articleId, providerDebugName(client.provider()));
    return answerQuestion(db, articleId, question, client);
  },
  ask_deepdive_followup: (db, a) => {
    const articleId = reqNum(a, 'articleId');
    const question = reqStr(a, 'question');
    const history = (Array.isArray(a.history) ? a.history : []) as ChatMessage[];
    const client = routeFor('deepdive');
    checkProviderConsistency(db, articleId, providerDebugName(client.provider()));
    return answerFollowup(db, articleId, question, history, client);
  },
  ai_search: (db, a) => aiSearch(db, reqStr(a, 'query')),

  // ADR-7: RAG セマンティック検索 / embedding 生成
  semantic_search: (db, a) => semanticSearch(db, reqStr(a, 'query'), optNum(a, 'limit') ?? 20),
  embed_articles: (db, a) => embedArticles(db, optNum(a, 'limit') ?? 50),

  // LLM settings
  get_llm_settings: async () => {
    const s = getLlmSettings();
    let models: string[] = [];
    try {
      models = await checkOllamaStatus(s.ollamaBaseUrl);
    } catch {
      models = [];
    }
    return {
      provider: s.provider,
      perplexity_api_key_set: s.perplexityApiKey !== null,
      anthropic_api_key_set: s.anthropicApiKey !== null,
      anthropic_model: s.anthropicModel,
      embedding_model: s.embeddingModel,
      ollama_base_url: s.ollamaBaseUrl,
      ollama_model: s.ollamaModel,
      available_ollama_models: models,
      ollama_running: models.length > 0,
    };
  },
  set_llm_provider: (db, a) => {
    setProvider(db, reqStr(a, 'provider'));
    return null;
  },
  set_ollama_settings: (db, a) => {
    setOllamaSettings(db, reqStr(a, 'baseUrl'), reqStr(a, 'model'));
    return null;
  },
  set_perplexity_api_key: (_db, a) => {
    setPerplexityKey(reqStr(a, 'apiKey'));
    return null;
  },
  clear_perplexity_api_key: () => {
    clearPerplexityKey();
    return null;
  },
  set_anthropic_api_key: (_db, a) => {
    setAnthropicKey(reqStr(a, 'apiKey'));
    return null;
  },
  clear_anthropic_api_key: () => {
    clearAnthropicKey();
    return null;
  },
  set_anthropic_model: (db, a) => {
    setAnthropicModel(db, reqStr(a, 'model'));
    return null;
  },
  set_embedding_model: (db, a) => {
    setEmbeddingModel(db, reqStr(a, 'model'));
    return null;
  },
  check_ollama_status: () => checkOllamaStatus(getLlmSettings().ollamaBaseUrl),

  // Profile
  get_user_profile: (db) => getProfile(db),
  update_user_profile: (db, a) => {
    const p = a.profile;
    if (typeof p !== 'object' || p === null) throw invalidInput('profile が必要です');
    updateProfile(db, p as UserProfileDto);
    return null;
  },
  reset_learning_data: (db) => {
    resetLearningData(db);
    return null;
  },
  adjust_feed_preference: (db, a) => {
    adjustFeedPreference(db, reqNum(a, 'feedId'), reqNum(a, 'delta'));
    return null;
  },
  suggest_preferences: (db) => suggestPreferences(db),
  rescore_articles: (db) => rescoreArticles(db), // ADR-6 unified scoring
  get_observability: (db) => getObservability(db), // ADR-13 観測性

  // Scheduler config
  get_scheduler_config: () => {
    const c = getSchedulerConfig();
    return {
      collect_interval_minutes: c.collectIntervalMinutes,
      digest_hour: c.digestHour,
      digest_minute: c.digestMinute,
      enabled: c.enabled,
    };
  },
  set_scheduler_config: (db, a) => {
    const cfg = a.config as {
      collect_interval_minutes?: number;
      digest_hour?: number;
      digest_minute?: number;
      enabled?: boolean;
    };
    reconfigureScheduler(db, {
      collectIntervalMinutes: cfg.collect_interval_minutes ?? 30,
      digestHour: cfg.digest_hour ?? 8,
      digestMinute: cfg.digest_minute ?? 0,
      enabled: cfg.enabled ?? true,
    });
    emitEvent('scheduler-config-changed', cfg);
    return null;
  },

  // Digest generation
  run_digest_now: (db) => runDigestNow(db),

  // OPML / custom feed
  export_opml: (db) => exportOpml(getAllFeedsForExport(db)),
  import_opml: (db, a) => {
    let count = 0;
    for (const [name, url, category] of parseOpml(reqStr(a, 'xml'))) {
      if (importFeedIfNew(db, name, url, category)) count += 1;
    }
    return count;
  },
  add_custom_feed: (db, a) =>
    addCustomFeed(db, {
      name: reqStr(a, 'name'),
      url: reqStr(a, 'url'),
      feedType: reqStr(a, 'feedType'),
      category: reqStr(a, 'category'),
      config: optStrNull(a, 'config'),
      fetchIntervalMinutes: optNum(a, 'fetchIntervalMinutes'),
    }),

  // Schedule (AniList airing / RAWG)
  get_airing_schedule: (_db, a) =>
    getAiringSchedule(optNum(a, 'startTimestamp'), optNum(a, 'daysAhead')),
  get_game_releases: (_db, a) => {
    const key = loadCredential(RAWG_ACCOUNT);
    if (key === null) throw invalidInput('RAWG API キーが未設定です');
    return fetchGameReleases(key, reqStr(a, 'startDate'), reqStr(a, 'endDate'));
  },
  set_rawg_api_key: (_db, a) => {
    const key = reqStr(a, 'apiKey').trim();
    if (key === '') throw invalidInput('RAWG API キーが空です');
    storeCredential(RAWG_ACCOUNT, key);
    return null;
  },
  clear_rawg_api_key: () => {
    deleteCredential(RAWG_ACCOUNT);
    return null;
  },
  is_rawg_api_key_set: () => loadCredential(RAWG_ACCOUNT) !== null,

  // Trending keywords / Context memo
  get_trending_keywords: (db) => getTrendingKeywords(db),
  get_context_memo: (db, a) => {
    const llm = tryRouteFor('memo');
    if (llm === null) {
      return 'LLM が未設定のためコンテキストメモを生成できません。設定画面から LLM を設定してください。';
    }
    return getOrGenerateContextMemo(db, llm, reqNum(a, 'articleId'));
  },

  // v1.1: Today View / Clustering
  get_today_view: (db) => getTodayView(db, tryRouteFor('today')),
  get_clustered_feed: (db, a) =>
    getClusteredFeed(db, optStr(a, 'category'), optNum(a, 'limit') ?? 20),
  run_clustering: (db) => clusterArticles(db),

  // v1.1: AniList / Steam sync
  sync_anilist_now: (db) => syncAniListNow(db),
  get_anilist_sync_status: (db) => getAniListSyncStatus(db),
  sync_steam_now: (db) => syncSteamNow(db),
  get_steam_sync_status: (db) => getSteamSyncStatus(db),

  // LLM research reports
  run_weekly_report_now: (db) => runWeeklyReportNow(db),
  run_research_report: (db, a) => runResearchReport(db, reqStr(a, 'query')),

  // System status (機能A)
  get_pc_status: () => getPcStatus(),
};

// A2 完遂: 全コマンド移植済み。未移植 stub は無し。
const emptyDefaults: Record<string, () => unknown> = {};
const actionStubNames: string[] = [];

export function registerRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get('/api/health', () => ({ status: 'ok' }));

  app.get('/events', (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(': connected\n\n');
    const onEvent = (e: DomainEvent): void => {
      reply.raw.write(`event: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`);
    };
    bus.on('event', onEvent);
    req.raw.on('close', () => bus.off('event', onEvent));
  });

  // ADR-5: deepdive 回答のストリーミング。生トークンを chunked text で逐次返す。
  // FE は ---FOLLOWUP--- 以前を answer として progressive 描画する。
  app.post('/api/ask_deepdive_stream', async (req, reply) => {
    const a = (req.body ?? {}) as Args;
    try {
      const articleId = reqNum(a, 'articleId');
      const question = reqStr(a, 'question');
      const history = Array.isArray(a.history) ? (a.history as ChatMessage[]) : null;
      const client = routeFor('deepdive');
      checkProviderConsistency(db, articleId, providerDebugName(client.provider()));

      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      });
      const result = await streamAnswer(db, articleId, question, history, client, (chunk) =>
        reply.raw.write(chunk),
      );
      // 出典は本文末尾に ---CITATIONS--- ブロックで付加する（FE が分離してパースする）。
      reply.raw.write(`\n---CITATIONS---\n${JSON.stringify(result.citations)}`);
      reply.raw.end();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (reply.raw.headersSent) {
        reply.raw.write(`\n[ERROR] ${message}`);
        reply.raw.end();
      } else {
        reply.code(e instanceof AppError ? 400 : 500);
        return { kind: e instanceof AppError ? e.kind : 'internal', message };
      }
    }
  });

  const register = (name: string, handler: Handler): void => {
    app.post(`/api/${name}`, async (req, reply) => {
      const args = (req.body ?? {}) as Args;
      try {
        return await handler(db, args);
      } catch (e) {
        if (e instanceof AppError) {
          reply.code(400);
          return { kind: e.kind, message: e.message };
        }
        reply.code(500);
        return { kind: 'internal', message: e instanceof Error ? e.message : String(e) };
      }
    });
  };

  for (const [name, h] of Object.entries(core)) register(name, h);
  for (const [name, def] of Object.entries(emptyDefaults)) register(name, () => def());
  for (const name of actionStubNames) {
    register(name, () => {
      throw notImplemented(`${name} は未移植 (A2 後続)`);
    });
  }
}
