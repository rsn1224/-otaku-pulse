# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview
- Overall: **4-Layer Tauri Desktop App** (Commands → Services → Infra → Parsers) with React 19 frontend
- Key Characteristics: Clean separation of concerns, no business logic in commands, dependency inversion (services never call infra directly for state), individual resource management (no Mutex<AppState>), structured logging via tracing

## Layers

**Command Layer:**
- Purpose: Accept Tauri IPC calls from React frontend, parse arguments, delegate to services, return errors as structured JSON
- Location: `src-tauri/src/commands/`
- Depends on: Services (one-way dependency only) / Used by: React frontend via `@tauri-apps/api/core#invoke()`
- Pattern: Every command is thin wrapper calling a single service function; no business logic allowed

**Service Layer:**
- Purpose: Orchestrate business logic—article collection, deduplication, scoring, summarization, digest generation, and discover recommendations
- Location: `src-tauri/src/services/`
- Depends on: Infra and Database / Used by: Commands
- Modules: `collector` (multi-feed refresh), `dedup_service` (duplicate detection), `scoring_service` (importance scoring), `summary_service` (AI summarization), `digest_generator` (batch digest creation), `discover_queries` (feed ranking), `personal_scoring` (user preference learning)
- Pattern: Pure business logic, stateless functions, structured as domain-specific query/service modules

**Infra Layer:**
- Purpose: External I/O—HTTP clients (AniList, Perplexity, RAWG, Reddit, Steam), database queries, LLM orchestration, rate limiting, credential storage
- Location: `src-tauri/src/infra/`
- Depends on: None (no upward dependencies) / Used by: Services only
- Modules: `http_client` (reqwest wrapper), `database` (SQLx pool init), `anilist_client`, `perplexity_client`, `ollama_client`, `reddit_fetcher`, `rss_fetcher`, `rawg_client`, `steam_client`, `rate_limiter`, `credential_store`, `notification`
- Pattern: All external calls isolated here; no business logic; reusable, testable in isolation

**Parser Layer:**
- Purpose: Pure data transformation—RSS to Article DTOs, GraphQL responses to typed models, BBCode to markdown, HTML to text
- Location: `src-tauri/src/parsers/`
- Depends on: Models only / Used by: Collectors in services
- Modules: `rss_parser` (feed-rs wrapper), `graphql_parser` (AniList query builder), `bbcode_parser` (format conversion), `graphql_types` (typed GQL responses)
- Pattern: Stateless functions with no side effects; pure transformations

## Data Flow

**Collection Flow (Scheduler → Feed Refresh → Dedup → Scoring → Database):**
- Scheduler triggers `collect_loop` (via `scheduler.rs`)
- `collector::refresh_all()` iterates enabled feeds
- `collect_feed()` selects collector (RSS, AniList, Steam, Reddit) based `feed_type`
- Collector calls infra (HTTP clients) → Parser transforms to `Article` DTOs
- `dedup_service` normalizes URLs, generates content hashes, compares against recent articles using Jaccard similarity
- `scoring_service` calculates `importance_score` (Phase 2+; Phase 1 uses 0.0)
- `feed_queries::insert_articles_batch()` writes to DB with dedup flags
- Event emitted: `collect-completed` → React toast notification

**Discover Feed Flow (Frontend request → Query ranking → Pagination → Response):**
- Frontend calls `invoke("get_discover_feed", { tab: "for_you", offset: 0, limit: 30 })`
- Command calls `discover_queries::get_discover_feed()`
- Query: `SELECT articles WHERE is_duplicate=0 AND is_read=0` with scoring/interaction-based ranking
- Pagination: 30 articles per page, tracked via Zustand `offset`
- Response: `{ articles: DiscoverArticleDto[], total: number, hasMore: boolean }`
- State Management: Zustand `useArticleStore` caches results, allows infinite scroll

**AI Summary/DeepDive Flow (Frontend request → LLM selection → Infra call → Cache → Response):**
- Frontend calls `invoke("get_or_generate_summary", { articleId: 123 })`
- `discover_ai::get_or_generate_summary()` checks `summaries` table cache
- If miss: selects LLM provider from `AppState.llm` (Perplexity or Ollama)
- Calls `llm_client::summarize()` → routes to `perplexity_client` or `ollama_client`
- Caches result in DB with `generated_at` timestamp
- Deep dive: `ask_deepdive()` iterates conversation, maintains citation tracking
- State Management: Frontend caches summaries in `useArticleStore`, re-renders on update

**Scheduler Event Flow (Background scheduler → Event emission → Frontend listener → Toast):**
- `scheduler::start()` spawns tokio tasks for `collect_loop`, `digest_loop`, `digest_cache_loop`
- Each loop publishes Tauri event: `collect-completed { fetched, saved }`, `digest-ready { category }`, etc.
- React `App.tsx` listeners via `listen('collect-completed')` → store update → toast display
- Pattern: One-way pub-sub; no command reply mechanism needed

**User Profile Learning Flow (Frontend interactions → Scoring → Recommendations):**
- Frontend records `record_interaction(articleId, action="view"|"click"|"bookmark", dwellSeconds)`
- `discover_queries::record_interaction()` updates `user_interactions` table (future schema)
- `personal_scoring` module recalculates user preferences from interaction history
- `discover_queries` re-ranks articles using `totalScore = content_score × user_preference_boost`
- Profile data fetched via `discover_profile::get_user_profile()` → displays learned tags/genres

## Key Abstractions

**Collector Pattern:** `src-tauri/src/services/collectors/mod.rs`
- Trait: `pub trait Collector { async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> }`
- Implementations: `RssCollector`, `AniListCollector`, `SteamCollector`
- Purpose: Polymorphic feed type handling; easy to add new sources (e.g., `RedditCollector`)
- Usage: `match feed.feed_type { "rss" => Box::new(RssCollector::new(...)), ... }`

**Dedup Service:** `src-tauri/src/services/dedup_service.rs`
- Functions: `normalize_url()`, `generate_content_hash()`, `jaccard_bigram_similarity()`
- Purpose: Prevent duplicate articles entering DB; runs at Phase 1 (collection time)
- Key rule: Content hash stored in dedicated `articles.content_hash` column (indexed), not in JSON metadata

**Scoring Service:** `src-tauri/src/services/scoring_service.rs`
- Functions: `calculate_importance_score()`, `adjust_by_user_preference()`
- Purpose: Compute 0.0–1.0 importance for ranking; Phase 1 inserts with 0.0, Phase 2+ updates
- Factors: Feed priority (anime > manga > game), keyword matching, publish date freshness

**LLM Client Orchestration:** `src-tauri/src/infra/llm_client.rs`
- Enum: `LlmProvider { Perplexity, Ollama }`
- Pattern: Reads `AppState::llm` (RwLock) at runtime, delegates to appropriate client
- Perplexity: Real API key stored in OS credential store (via `credential_store` module), retrieved on startup
- Ollama: Local HTTP call to `http://localhost:11434` (configurable)

**AppState (No Mutex):** `src-tauri/src/state.rs`
- Structure: `AppState { db: Arc<SqlitePool>, http: Arc<Client>, llm: Arc<RwLock<LlmSettings>> }`
- Pattern: Individual `app.manage()` for db, http, and llm; no Mutex<AppState>
- Rationale: DB access doesn't block HTTP; RwLock used only for llm settings (infrequently updated)
- Commands extract: `db: State<SqlitePool>, http: State<Arc<Client>>, app_state: State<AppState>`

**Error Type:** `src-tauri/src/error.rs`
- Enum: `AppError { Database, Http, FeedParse, Unauthorized, RateLimit, Network, Parse, InvalidInput, Llm, Scheduler, Keyring, Internal }`
- Serialization: `{ "kind": "feed_parse", "message": "Invalid XML" }` (safe for JSON.stringify on frontend)
- Pattern: All Tauri commands return `Result<T, AppError>`; framework auto-serializes

**React Zustand Stores:** `src/stores/*.ts`
- Pattern: One store per domain (`useArticleStore`, `useFilterStore`, `useProfileStore`, `useSchedulerStore`, etc.)
- State shape: Separate concerns (articles list vs. unread counts vs. scroll positions)
- Async actions: Commands wrapped in `invoke()` calls with error logging
- Example: `fetchFeed(reset?: boolean)` → calls `invoke("get_discover_feed", ...)` → updates store articles

## Entry Points

**Rust Backend Entry:**
- `src-tauri/src/main.rs` → calls `otaku_pulse_lib::run()`
- `src-tauri/src/lib.rs#run()` — Tauri app setup, plugin initialization, database init, scheduler startup, invoke handler registration (59 commands)

**React Frontend Entry:**
- `src/main.tsx` — mounts `<App />` to root element
- `src/App.tsx` — `AppContent()` component with event listeners for scheduler events (collect-completed, digest-ready, etc.)

**Scheduler Entry:**
- `src-tauri/src/services/scheduler.rs#start()` — spawned from `lib.rs` setup, runs three background loops:
  - `collect_loop`: Every 30 minutes (configurable), calls `collector::refresh_all()`
  - `digest_loop`: Daily at configured time, calls `digest_generator::generate_digests()`
  - `digest_cache_loop`: Every 2 hours, publishes `digest-ready` events

**Database Entry:**
- `src-tauri/src/infra/database.rs#init_pool()` — runs SQLx migrations from `migrations/` on first connect
- Migration files: `001_initial.sql` (schema), `002–007_*.sql` (incremental updates)

## Error Handling

- Strategy: **Explicit error types, no `.unwrap()` in production code**
- Pattern: `?` operator throughout services/infra; `AppError` variants provide context
- Tauri commands: `Result<T, AppError>` serializes to JSON `{ "kind", "message" }`
- Frontend: Error caught in `invoke()` try-catch; logged via pino logger; optional user-facing toast
- Database: SQLx errors wrap as `AppError::Database`; HTTP errors as `AppError::Http` or `AppError::RateLimit`
- Scheduler: Failed iterations logged (not fatal); app continues with next scheduled run

## Cross-Cutting Concerns

**Logging:**
- Framework: `tracing` with `tracing-subscriber` (Rust side)
- Config: `RUST_LOG` env var (default: "info"), filtered by `EnvFilter`
- Pattern: `tracing::info!()`, `tracing::warn!()`, `tracing::error!()`
- Structured fields: `error = %e, feed_id = feed.id`
- Frontend: `pino` logger in `src/lib/logger.ts`; structured JSON output

**Authentication & Secrets:**
- API keys: Stored in OS credential store (Windows: Windows Credential Manager, macOS: Keychain)
- Flow: On startup, `credential_store::load_credential(PERPLEXITY_ACCOUNT)` loads key into `AppState.llm.perplexity_api_key`
- UI: Settings page allows user to input/clear API keys; keys never logged or transmitted
- RAWG API key: Similar pattern via `credential_store`

**Rate Limiting:**
- AniList: Hardcoded to 30 req/min (not 90 public docs claim); 2-second minimum interval between requests
- Implementation: `infra/rate_limiter.rs` with token bucket algorithm
- Behavior: On 429, read `Retry-After` header, wait, and retry

**Caching:**
- Database-backed: Summaries cached in `summaries` table; deep-dive questions in `deepdive_questions` table
- TTL: Summaries TTL configurable (default 1 hour); checked on read
- Dedup cache: Recent articles (past 72 hours) loaded into memory during `collect_feed()` for comparison
- HTTP: No HTTP-level caching; relies on feed `etag` / `last-modified` headers to avoid re-parsing identical responses

**State Initialization:**
- Database: Created from migrations on app startup; initial feed inserts from `001_initial.sql` default feeds
- User preferences: Loaded from `settings` KVS table on demand
- Theme: Read from localStorage via `useThemeStore`, applied on mount
- Scheduler config: Loaded from settings on startup; can be updated via UI
