# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**Panics in setup code:** Files: `src-tauri/src/lib.rs` (lines 37, 51, 178) — Issue: Application terminates ungracefully on database or HTTP client initialization failures instead of returning structured errors — Impact: Prevents proper error recovery and logging at app startup — Fix: Wrap `unwrap_or_else` calls in proper error handling with user-facing error dialogs via Tauri window events

**Mutex lock poisoning risk:** Files: `src-tauri/src/lib.rs` (line 71), `src-tauri/src/services/scheduler.rs` (lines 179-180) — Issue: `.expect("LLM settings lock poisoned during startup")` and `.map_err()` calls on RwLock operations assume lock is never poisoned; no recovery path exists — Impact: If a panic occurs while lock is held, subsequent operations silently degrade error messages instead of failing fast — Fix: Use `lock().map_err(|e| AppError::Internal(format!(...)))` consistently; add metrics for lock contention

**Serial execution in digest_loop:** Files: `src-tauri/src/services/scheduler.rs` (lines 136-167) — Issue: 4 categories (anime, manga, game, pc) are processed sequentially in a loop; network I/O bottlenecks entire loop — Impact: If one API call is slow, all subsequent digests are delayed — Fix: Spawn independent tasks per category with `tokio::join_all()`; add timeout per category

**Unwrap in cache serialization:** Files: `src-tauri/src/services/deepdive_service.rs` (lines 55, 95) — Issue: `serde_json::from_str(...).unwrap_or_default()` and `.unwrap_or_default()` silently drop malformed JSON cache entries — Impact: Silent data loss; debugging requires log inspection — Fix: Log warning when cache deserialization fails; implement cache repair mechanism

**JSON parsing without validation:** Files: `src-tauri/src/services/personal_scoring.rs` (lines 248-253) — Issue: `serde_json::from_str()` on user-provided profile JSON with `.unwrap_or_else()` that logs but continues — Impact: Silently uses empty lists when profile data is corrupted; scoring degrades without user awareness — Fix: Add validation step; return `AppError::InvalidInput` instead of silent fallback

**Rate limiter Token allocation bug:** Files: `src-tauri/src/infra/rate_limiter.rs` (line 48-49) — Issue: Token bucket increments by `(elapsed.as_secs_f64() * refill_rate) as u32` which truncates fractional tokens; real tokens leak — Impact: Over time, actual rate limit is higher than configured — Fix: Use `f64` for token accounting; convert to integer only at acquire time

**Unicode normalization inconsistency:** Files: `src-tauri/src/services/dedup_service.rs` (lines 1-80) — Issue: `normalize_title()` uses `nfc()` normalization but duplicate detection compares normalized vs non-normalized titles in some code paths — Impact: Duplicate detection may miss near-duplicates with combining characters — Fix: Ensure all title comparisons use consistent normalization; store normalized form in DB

---

## Known Bugs

**URL query parameter ordering affects dedup:** Files: `src-tauri/src/services/dedup_service.rs` (lines 41-48) — Symptoms: Two otherwise identical articles with query parameters in different order are not deduplicated — Trigger: RSS feeds that emit URLs with reordered parameters (e.g., `?a=1&b=2` vs `?b=2&a=1`) — Root cause: After filtering tracking params, params are sorted but not all URL sources provide consistent ordering

**AniList rate limiter claims 60 req/min but enforces 30:** Files: `src-tauri/src/infra/anilist_client.rs` (line 10), `.claude/rules/anilist_rate_limit.md` — Symptoms: 429 Too Many Requests errors after ~30 requests despite X-RateLimit-Limit header claiming 60 — Trigger: Rapid seasonal anime batch fetches (>2 pages per call) — Root cause: AniList's actual limit is 30 req/min; workaround in place but documentation mismatch

**Deepdive cache invalidation missing:** Files: `src-tauri/src/services/deepdive_service.rs` (lines 44-62) — Symptoms: Cached answers returned indefinitely even if underlying article summary changes — Trigger: Update article summary after deepdive cache created — Root cause: Cache key is `(article_id, question)` but doesn't include summary hash; no TTL enforcement

---

## Security Considerations

**Tauri credential store access on Windows:** Files: `src-tauri/src/infra/credential_store.rs` — Risk: API keys (Perplexity, RAWG) stored in OS credential manager; if device is compromised, all keys are accessible — Mitigation: OS credential store is hardened per-platform (Windows Data Protection API); user is responsible for device security — Recommendations: (1) Add option to encrypt keys in-app with user password; (2) Rotate keys regularly; (3) Document credential storage in README; (4) Implement key expiration warnings

**User profile JSON deserialization:** Files: `src-tauri/src/services/personal_scoring.rs` (lines 245-253) — Risk: User-controlled preference strings (favorite titles, genres, creators) are deserialized from DB without bounds checking — Mitigation: Zustand store validates input at UI boundary; DB constraints missing — Recommendations: (1) Add `CHECK (length(favorite_titles) < 10000)` constraints at DB level; (2) Implement input size limits in UI; (3) Add fuzzing tests for JSON parsing

**Perplexity API key exposure in logs:** Files: `src-tauri/src/infra/perplexity_client.rs` — Risk: If HTTP error occurs, request headers (containing API key) may be logged — Mitigation: `reqwest::Error` does not expose raw headers; key is in Authorization header only — Recommendations: (1) Audit all error logging for sensitive header inclusion; (2) Add unit tests that verify API keys are scrubbed from error messages

---

## Performance Bottlenecks

**Synchronous URL normalization in collector loop:** Files: `src-tauri/src/services/collector.rs` (line 69), `src-tauri/src/services/dedup_service.rs` (lines 5-74) — Problem: Feed article collection loops normalize every URL synchronously (regex, lowercasing, tracking param removal) before dedup check — Impact: For 500-article RSS feed, URL normalization takes ~50ms; multiplied by N feeds in refresh_all — Cause: normalize_url is O(n) per URL; called on every article before DB write — Fix: (1) Parallelize normalization with `rayon` for articles; (2) Move normalization to DB trigger (SQLite expression indexes); (3) Cache normalization results

**All article interactions queried sequentially:** Files: `src-tauri/src/services/personal_scoring.rs` (lines 74-81) — Problem: Fetching bookmarked + deepdived + dwelled articles as separate queries then merged in memory — Impact: 3 DB round-trips instead of 1; sorting happens in Rust instead of DB — Cause: No single query aggregates all interactions — Fix: Single SQL query with LEFT JOIN on article_interactions table; let DB do aggregation

**FTS index scan without limit in search:** Files: `src-tauri/src/services/fts_queries.rs` — Problem: Full-text search query fetches all matching articles before pagination applied — Impact: If query matches 10,000 articles, all are loaded into memory before slicing — Fix: Add WHERE ROWID IN (SELECT ROWID FROM fts_articles WHERE ... LIMIT offset,limit)

**N+1 queries in highlights generation:** Files: `src-tauri/src/services/highlights_service.rs` — Problem: For each highlighted keyword, fetch articles containing it (separate queries in loop) — Impact: 100 keywords = 100 DB queries — Fix: Single query with GROUP BY keyword, fetch all articles once, aggregate in Rust

---

## Fragile Areas

**Deepdive cache expiration logic:** Files: `src-tauri/src/services/deepdive_service.rs` (lines 132-140) — Why fragile: Cache cleanup (`cleanup_expired_cache`) runs once at startup; if app crashes before cleanup, stale cache accumulates; no cache size limits — Safe modification: (1) Add periodic cleanup job in scheduler; (2) Implement LRU eviction when cache size exceeds threshold; (3) Add migration to set TTL on existing cache rows

**Scheduler config mutation at runtime:** Files: `src-tauri/src/services/scheduler.rs` (lines 74, 120), `src-tauri/src/lib.rs` (lines 95-102) — Why fragile: `collect_loop` and `digest_loop` read `config.enabled` flag but config can be mutated via `set_scheduler_config` command; no synchronization primitive — Safe modification: (1) Wrap SchedulerConfig in `Arc<RwLock<>>` and pass to both loops; (2) Use channels to communicate config updates instead of shared state; (3) Add tests for concurrent config mutations

**RSS feed parsing error recovery:** Files: `src-tauri/src/infra/rss_fetcher.rs` — Why fragile: Parsing errors on a single article silently skip that article but continue feeding rest; no visibility into parse failures — Safe modification: (1) Return tuple `(successful_articles, failed_articles, errors)` from collector; (2) Log parse errors with article title + feed URL for debugging; (3) Store parse errors in DB for visibility in UI

**Article filtering by keywords:** Files: `src-tauri/src/lib/articleFilter.ts` — Why fragile: Client-side filter logic duplicates backend scoring; inconsistency risk if filtering rules diverge — Safe modification: (1) Move all filtering to Rust backend; (2) Return pre-filtered articles from `get_discover_feed`; (3) Add UI-only re-sorting, not re-filtering

**OPML import without validation:** Files: `src-tauri/src/services/opml_service.rs` — Why fragile: Imports OPML file without validating feed URLs; malformed URLs cause silent failures in collector loop — Safe modification: (1) Validate each URL before inserting (must be HTTP/HTTPS, valid domain); (2) Return validation errors to UI; (3) Add dry-run mode to preview invalid feeds before import

---

## Dependencies at Risk

**feedrs (rss parsing):** Risk: Dependency on RSS parsing library not vendored — Impact: If crate is yanked or deprecated, feed collection breaks — Migration: (1) Evaluate `rss` or `atom_syndication` crates as alternative; (2) Implement minimal RSS parser for critical attributes only; (3) Add vendor backup copy of feedrs source

**reqwest (HTTP client):** Risk: Major version bumps could change TLS defaults or timeout behavior — Impact: AniList/RAWG/Steam API calls may hang or fail differently — Migration: (1) Pin version to ~0.11; (2) Add integration tests for each external API; (3) Implement circuit breaker pattern

**sqlx (compile-time checked queries):** Risk: Macros require actual database at compile time; migration tool breakage could block builds — Impact: CI/CD pipeline fails if database schema is out of sync — Mitigation: (1) Store compiled query metadata in Git; (2) Use offline mode for CI builds; (3) Add migration integration tests

---

## Test Coverage Gaps

**Dedup service untested in realistic conditions:** Files: `src-tauri/src/services/dedup_service.rs` (no _tests.rs file) — What's untested: Unicode normalization edge cases, URL parameter ordering, content hash collisions — Impact: Duplicate detection may fail silently; no regression tests for dedup improvements — Priority: High — Fix: Add `dedup_service_tests.rs` with 20+ test cases covering normalization, URL variants, and content hash collision rates

**AniList rate limiter not stress-tested:** Files: `src-tauri/src/infra/anilist_client.rs` (no tests for rate limit behavior) — What's untested: Concurrent requests exceeding token bucket; Retry-After header parsing; 429 response handling — Impact: Rate limit enforcement may be bypassed under load — Priority: High — Fix: Add tokio-based concurrency tests; simulate 429 responses; verify tokens are depleted correctly

**Scheduler loop shutdown untested:** Files: `src-tauri/src/services/scheduler.rs` (collect_loop and digest_loop have no shutdown mechanism) — What's untested: Graceful app termination while loops are running; resource cleanup on exit — Impact: Orphaned threads may prevent clean app shutdown — Priority: Medium — Fix: Implement cancellation token (tokio::sync::CancellationToken); add tests for task cancellation during sleep/work

**Personal scoring edge cases:** Files: `src-tauri/src/services/personal_scoring.rs` (limited test coverage) — What's untested: Scoring with empty preferences, very old articles (>72h), interaction bonus stacking — Impact: Edge cases may return negative scores or NaN values — Priority: Medium — Fix: Add parametrized tests for score calculation with various inputs; bounds-test dwell bonus cap

**TypeScript hook error handling:** Files: `src/hooks/useTauriCommand.ts`, `src/hooks/useTauriQuery.ts` — What's untested: Tauri invoke() error handling (error is plain object, not Error); retry logic; timeout scenarios — Impact: UI error boundaries may not catch Tauri errors correctly — Priority: Medium — Fix: Add tests that mock Tauri error responses; verify error shape matches expected format

**Component rendering with missing data:** Files: `src/components/discover/DiscoverCard.tsx` (188 lines) — What's untested: Rendering with null summaries, missing article details, failed image loads — Impact: UI may crash or display incorrectly with incomplete data — Priority: Low — Fix: Add snapshot tests with partial data; implement error boundaries per component

---

## Incomplete Features

**Config hot-reload without app restart:** Status: Partial — Scheduler config can be updated via `set_scheduler_config` but updates don't affect running loops until next tick — Impact: Users must wait up to 60 minutes for collect interval changes to take effect — Fix: Implement config change notification system (Tauri event); update running task parameters on receipt

**LLM provider switching at runtime:** Status: Partial — Provider stored in `AppState.llm` RwLock but switching from Ollama → Perplexity mid-request causes in-flight requests to use stale provider — Impact: Chat context lost if provider changes during deepdive conversation — Fix: Store provider ID on first request; validate no provider change during multi-turn conversation

**Offline mode:** Status: Not started — App crashes if all APIs are unavailable at startup — Impact: Cannot read cached articles without internet — Fix: Graceful degradation when APIs unreachable; fall back to local cache for 72 hours

