# FEATURES.md — OtakuPulse Stabilization Feature Landscape

**Domain:** Production Tauri v2 + Rust desktop app stabilization
**Researched:** 2026-03-27
**Mode:** Ecosystem / Stabilization
**Sources:** Codebase direct analysis (HIGH confidence), Tauri v2 docs patterns (MEDIUM), Rust ecosystem best practices (HIGH)

---

## Context

OtakuPulse is a working Tauri v2 desktop app. This milestone is pure stabilization — no new Wings, no new APIs. The feature landscape here maps CONCERNS.md items into deliverable stability features, classified by whether their absence causes user-visible failure (table stakes) vs. whether their presence creates a noticeably better experience (differentiators).

---

## Table Stakes

Missing any of these makes the app feel broken or untrustworthy to real users.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Startup panic elimination** | App that crashes on launch (e.g., DB path failure) with no recovery message is unusable | Low | `lib.rs` lines 37, 51, 178 use `panic!`; replace with structured error dialogs via `app_handle.emit()` to show user-facing message before exit |
| **Graceful offline mode** | Desktop app that cannot open at all without network is unacceptable — users expect cached content | Medium | Currently app_state init succeeds but collect_loop 429/network failures are only logged; need to gate API calls, serve stale cache (72h TTL) and surface "offline" badge in UI |
| **Scheduler graceful shutdown** | Orphaned background threads on close can cause DB corruption (WAL not flushed) or prevent clean re-launch on Windows | Medium | `collect_loop` and `digest_loop` have no cancellation path; add `tokio::sync::CancellationToken`, pass to both loops, cancel in Tauri `on_window_event(CloseRequested)` |
| **DeepDive cache TTL enforcement** | Indefinitely cached AI answers that are stale degrade trust in the AI feature | Low | Cache key is `(article_id, question)` with no TTL; add `cached_at` column (already has schema) + TTL check on read (24h); add periodic cleanup job in scheduler |
| **Config hot-reload for scheduler** | If user changes collect interval in Settings, waiting 60 min for it to take effect is confusing | Medium | `collect_loop` reads config at spawn time only; wrap `SchedulerConfig` in `Arc<RwLock<SchedulerConfig>>`, pass Arc to loops; emit Tauri event from `set_scheduler_config` to notify loops immediately |
| **Dedup URL canonicalization fix** | Duplicate articles appearing in Feed erodes trust in the aggregator's core function | Low | Query-param sort is in place but inconsistent normalization path means same URL with different param order passes dedup; extend `normalize_url` to always sort all remaining (non-tracking) params, store normalized URL in `articles` table for lookup |
| **Unicode dedup consistency** | Near-duplicate articles with combining characters (common in Japanese titles) appear as duplicates | Low | `normalize_title` uses `nfc()` but comparison path uses raw form in some branches; apply `nfkc()` normalization at both insert and compare time; use NFKC consistently (more aggressive than NFC, handles fullwidth characters) |
| **Personal scoring JSON validation** | Silent fallback to empty preferences (`unwrap_or_else`) makes scoring degrade invisibly | Low | Add explicit validation before `serde_json::from_str`; return `AppError::InvalidInput` so UI can surface "Preferences corrupted — please reset" message |
| **API key log scrubbing** | Leaking Perplexity API key in error logs is a security incident | Low | Audit `perplexity_client.rs` error paths; wrap with redactor that replaces `Bearer sk-...` in log output; add unit test asserting key never appears in formatted error strings |
| **Mutex lock poisoning recovery** | `.expect("lock poisoned")` in hot paths will crash app if any task panics while holding the lock | Low | Replace all `expect()` on RwLock/Mutex with `map_err(|e| AppError::Internal(...))`; log the poison event and attempt recovery by reinitializing the guard |

---

## Differentiators

Present = noticeably better experience. Absent = still usable but less polished.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Digest loop parallelization** | 4 AI digest categories (anime/manga/game/pc) run serially — 4x faster with concurrent tasks | Low-Medium | Replace `for category in &[...]` loop with `tokio::join_all()`; add per-category timeout (e.g., 30s) so one slow LLM call doesn't block others; already have `tokio` `rt-multi-thread` feature enabled |
| **Rate limiter f64 token accounting** | Token bucket truncates fractional tokens; at 0.5 tokens/sec, actual rate is up to 1 extra request/min above limit | Low | Change `tokens: Arc<Mutex<u32>>` to `Arc<Mutex<f64>>`; convert to integer only at acquire time; fixes AniList 429 risk at boundary conditions |
| **N+1 query elimination (highlights)** | 100 highlight keywords = 100 DB queries; single GROUP BY query reduces this to 1 | Low | Rewrite `highlights_service.rs` to fetch all articles in one query with WHERE keyword IN (...); aggregate in Rust |
| **Personal scoring 3-query consolidation** | 3 sequential DB queries (bookmarked + deepdived + dwelled) per scoring pass | Low | Single LEFT JOIN query on `article_interactions` table; also enables DB-side sorting instead of in-memory sort |
| **FTS pagination pushdown** | FTS search loads all matching rows into memory before slicing | Medium | Add `LIMIT ? OFFSET ?` inside the FTS subquery; requires changing query signature in `fts_queries.rs` |
| **URL normalization parallelization (rayon)** | For large feeds (500+ articles), sequential normalization adds 50ms+ per feed | Medium | Wrap `refresh_all` article normalization in `rayon::par_iter()`; already have multi-thread tokio runtime; confirm rayon doesn't conflict with tokio task context |
| **LLM provider hot-switch safety** | Switching Ollama → Perplexity mid-deepdive loses conversation context | Medium | Store provider ID on first request of a conversation; compare at subsequent turns; return `AppError::InvalidInput("Provider changed during conversation")` if mismatch |
| **RSS parse error visibility** | Silent article skips make it impossible to know if a feed is broken | Low | Change collector return type to `(Vec<Article>, Vec<ParseError>)`; store parse errors in a `feed_errors` table or log with feed URL for Settings > Feeds to display |
| **OPML URL validation** | Malformed URLs in OPML silently fail in collector loop | Low | Validate each URL (`http(s)://` scheme, parseable host) before insert; return per-URL validation errors to UI in a preview/dry-run step |
| **DeepDive cache LRU eviction** | Cache grows unbounded; no size cap means disk usage creeps up | Medium | Implement LRU eviction cap (e.g., 500 entries) in periodic cleanup job; use `SELECT id FROM deepdive_cache ORDER BY last_accessed ASC LIMIT (count - 500)` to find eviction candidates; requires `last_accessed` column in migration |
| **Scheduler config runtime sync** | `collect_loop` reads config snapshot at spawn; config mutations via `set_scheduler_config` are invisible to running loop | Medium | Pass `Arc<RwLock<SchedulerConfig>>` to loops; on each tick, read current config atomically; avoids channel complexity while being safer than current static snapshot |
| **SQLx offline mode for CI** | Missing `.sqlx/` metadata directory blocks CI builds when DB not available at compile time | Low | Run `cargo sqlx prepare` and commit `.sqlx/` directory; set `SQLX_OFFLINE=true` in CI; documented as table stakes for build reproducibility |

---

## Anti-Features

Deliberately NOT building these in this milestone.

| Feature | Why Avoid | What to Do Instead |
|---------|-----------|-------------------|
| **New API source integrations** | Adds surface area while existing sources are unstable | Fix existing AniList/RAWG/Steam/Reddit reliability first |
| **OAuth / user authentication** | Desktop single-user app has no authentication boundary; adds credential management complexity | OS credential store (already implemented) is sufficient |
| **Cloud sync** | Requires backend infrastructure, auth, conflict resolution — out of scope for local desktop app | Ensure DB path is in user-visible location for manual backup |
| **Full circuit breaker library (tower/reqwest-middleware)** | Adds dependency for a pattern that can be implemented with 30 lines of Rust | Implement simple exponential backoff inline (already partially done in `http_client.rs` tests) |
| **UI redesign / new Wings** | Stabilization milestone explicitly excludes UI additions | Design system improvements only as side effect of fixing existing broken states |
| **WebSockets / live data streaming** | RSS/REST polling is sufficient for news aggregation cadence | Scheduler-based polling is the right model for this domain |
| **Plugin system / extensibility API** | Architecture is not designed for third-party extension | Internal 4-layer arch is clean enough without adding plugin boundaries |
| **Telemetry / crash reporting (Sentry etc.)** | Privacy concern for a personal desktop app; tracing logs are sufficient | Improve local log file rotation and structured log output instead |
| **Database sharding or multi-DB** | SQLite with WAL mode handles the scale (tens of thousands of articles) fine | Optimize existing queries; do not introduce architectural complexity |

---

## Feature Dependencies

Understanding which features block others prevents phase ordering mistakes.

```
Startup panic elimination
  └── blocks: meaningful error messages for all other failure modes

Scheduler graceful shutdown (CancellationToken)
  ├── enables: Scheduler config hot-reload (loops must be restartable)
  └── enables: Scheduler test coverage (CancellationToken is testable)

DeepDive cache TTL
  └── requires: `cached_at` column exists (check migration 005_deepdive_cache.sql)
  └── enables: DeepDive cache LRU eviction (once cleanup logic exists)

Config hot-reload
  └── requires: Scheduler graceful shutdown (loops must accept updated config Arc)

SQLx offline mode
  └── blocks: reliable CI for all Rust changes

Unicode dedup consistency
  └── should: precede dedup test suite (tests need stable behavior to assert against)

Personal scoring JSON validation
  └── enables: User profile JSON size limits (security concern)

Rate limiter f64 fix
  └── precedes: AniList rate limiter stress tests (tests should assert correct behavior)
```

---

## MVP Recommendation

Three highest-leverage stabilization items for a Phase 1 focus, in priority order:

**Priority 1 — Startup panic elimination + offline graceful degradation**
Rationale: A desktop app that panics on launch or cannot open without internet fails its most basic user promise. These are the two issues most likely to cause a user to permanently uninstall. Both changes are confined to `lib.rs` and the scheduler error paths.

**Priority 2 — Scheduler shutdown (CancellationToken) + config hot-reload**
Rationale: The scheduler is the heartbeat of the entire application. Without graceful shutdown, Windows process cleanup is unreliable. Without hot-reload, Settings changes feel broken. These two are architecturally coupled (hot-reload requires restartable loops).

**Priority 3 — Dedup correctness (URL params + Unicode) + personal scoring validation**
Rationale: Dedup failures are user-visible (duplicate articles in Feed). Silent scoring fallback corrupts personalization silently. Both are low-complexity fixes with high correctness impact. Both require test coverage to be added alongside.

**Deferred to later phases:**
- Digest loop parallelization (performance win but not a correctness issue)
- N+1 query elimination (performance, not user-visible at current scale)
- FTS pagination pushdown (only matters at 10K+ article scale)
- rayon URL normalization (50ms saving not user-perceptible per refresh)
- LLM provider hot-switch safety (niche edge case — most users use one provider)
- DeepDive cache LRU eviction (disk space concern, not functionality)
- RSS parse error visibility (UX improvement, not core stability)

---

## Sources

| Source | Type | Confidence | Notes |
|--------|------|------------|-------|
| `src-tauri/src/lib.rs` (direct read) | Code | HIGH | Startup panic patterns confirmed at lines 37, 51 |
| `src-tauri/src/services/scheduler.rs` (direct read) | Code | HIGH | Serial digest loop confirmed lines 136-167; no CancellationToken present |
| `src-tauri/src/services/deepdive_service.rs` (direct read) | Code | HIGH | Cache has no TTL check on read (line 54-63); `unwrap_or_default` confirmed line 55 |
| `src-tauri/src/services/dedup_service.rs` (direct read) | Code | HIGH | `nfc()` used (line 79) not `nfkc()`; URL param sort present but coverage inconsistent |
| `src-tauri/src/infra/rate_limiter.rs` (direct read) | Code | HIGH | `as u32` truncation confirmed line 47; `f64` fix is correct approach |
| `src-tauri/src/infra/http_client.rs` (direct read) | Code | HIGH | Retry logic exists but gated under `#[cfg(test)]`; production paths have no retry |
| `.planning/codebase/CONCERNS.md` (direct read) | Docs | HIGH | All 30+ concerns catalogued; used as ground truth for classification |
| `.planning/PROJECT.md` (direct read) | Docs | HIGH | Scope constraints confirmed (no new Wings, existing stack) |
| `src-tauri/Cargo.toml` (direct read) | Code | HIGH | tokio `rt-multi-thread` present; rayon not yet in deps |
| Tauri v2 graceful shutdown patterns | Knowledge | MEDIUM | CancellationToken pattern is tokio standard; Tauri `on_window_event` hookpoint confirmed in Tauri v2 docs pattern; verify exact API in tauri::WindowEvent |
| tokio::sync::CancellationToken | Knowledge | HIGH | Stable since tokio 1.0; `cancel()` + `cancelled().await` pattern is idiomatic |
