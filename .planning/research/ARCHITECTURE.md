# Architecture Research — OtakuPulse Stabilization

**Domain:** 4-Layer Tauri v2 + Rust Desktop App — Stabilization Patterns
**Researched:** 2026-03-27
**Overall Confidence:** HIGH (based on direct codebase analysis + established Rust/Tokio patterns)

---

## Recommended Architecture

The existing 4-layer architecture is fundamentally sound. Stabilization does NOT require structural changes — it requires hardening within each layer's existing boundaries. The primary architectural gaps are:

1. Lifecycle management (scheduler loops have no shutdown path)
2. Token accounting precision (rate limiter uses integer truncation)
3. Shared config mutation without synchronization primitive
4. Query fan-out where single queries suffice (N+1, 3-separate-queries)
5. Cache invalidation by key mismatch (deepdive ignores summary hash)

### Layer Diagram (Current — Confirmed via Code Analysis)

```
React Frontend (src/)
       │
       │  invoke() / Tauri IPC
       ▼
┌─────────────────────────────────────────┐
│  Command Layer  (src-tauri/src/commands/)│  ← thin wrappers only; 59 registered commands
│  Result<T, AppError> → JSON serialize   │
└──────────────┬──────────────────────────┘
               │  delegates 100% to services
               ▼
┌─────────────────────────────────────────┐
│  Service Layer  (src-tauri/src/services/)│  ← ALL business logic lives here
│  collector, dedup, scoring, digest,     │
│  deepdive, personal_scoring, scheduler  │
└──────┬───────────────────┬──────────────┘
       │ reads/writes DB    │ calls infra clients
       ▼                    ▼
┌─────────────┐  ┌──────────────────────────────────┐
│ SQLite DB   │  │  Infra Layer  (src-tauri/src/infra/)│
│ (SQLx pool) │  │  HTTP, rate_limiter, credential_  │
└─────────────┘  │  store, anilist, perplexity,      │
                 │  ollama, rss_fetcher, rawg, steam  │
                 └──────────────────────────────────┘
                              │
                              ▼
                 ┌──────────────────────────────────┐
                 │  Parser Layer (src-tauri/parsers/) │
                 │  rss_parser, graphql_parser,      │
                 │  bbcode_parser, graphql_types      │
                 └──────────────────────────────────┘
```

### AppState — Current Implementation (Confirmed)

Source: `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`

```
AppState {
  db:  Arc<SqlitePool>          ← individual manage(), no Mutex
  http: Arc<reqwest::Client>    ← individual manage(), no Mutex
  llm: Arc<RwLock<LlmSettings>> ← RwLock for infrequent writes only
}
```

The individual `app.manage()` pattern is correctly implemented. No global `Mutex<AppState>` exists. This is the correct pattern.

---

## Component Boundaries

| Component | Responsibility | Communicates With | Stabilization Priority |
|-----------|---------------|-------------------|----------------------|
| `scheduler.rs` | Spawns 2 background loops (collect, digest); reads SchedulerConfig snapshot at spawn time | services/collector, services/digest_generator, AppHandle (events) | CRITICAL — no shutdown path, no config sync |
| `collector.rs` | Orchestrates per-feed collection: select Collector impl → collect → dedup → score → upsert | services/dedup_service, services/scoring_service, services/feed_queries, infra/* | HIGH — serial loop for N feeds, URL normalization is synchronous |
| `dedup_service.rs` | Stateless pure functions: normalize_url, normalize_title, jaccard_bigram_similarity, generate_content_hash | None (pure functions) | HIGH — Unicode normalization uses NFC but title comparison may use un-normalized paths; URL param sort bug |
| `personal_scoring.rs` | Computes per-article scores from interaction history; 5 separate DB round-trips for bookmarks/deepdive/feed_rates/feed_articles/dwell | services/article_queries (via db) | HIGH — 5 queries → 1 query opportunity; JSON profile parsed with unwrap_or fallback |
| `rate_limiter.rs` | Token bucket per API source; acquire() waits for interval + checks tokens | AniList client (only consumer currently) | HIGH — integer truncation loses fractional tokens; retry_after check returns AppError::Internal (wrong variant) |
| `deepdive_service.rs` | Q&A cache: key = (article_id, question); no TTL check on cache hit; follow_up JSON uses unwrap_or_default | infra/llm_client, DB | MEDIUM — cache key missing summary_hash; cleanup runs once at startup only |
| `lib.rs setup()` | App bootstrap: DB init, credential load, scheduler start | All layers | MEDIUM — 3 panic sites (app_data_dir, db_pool, .run()); LLM lock uses .expect() |
| `highlights_service.rs` | Per-article LLM calls for highlight reasons; iterates top-5 articles | infra/llm_client, DB | LOW — currently limited to 5 articles, not a fan-out problem yet |
| `fts_queries.rs` | FTS5 full-text search | DB | MEDIUM — fetches all matching rows before pagination |

---

## Data Flow

### Collection Flow (Scheduler-driven, every N minutes)

```
scheduler::collect_loop
  │  tokio::interval tick
  ▼
collector::refresh_all(db, http)
  │  for each enabled feed (serial loop — stabilization target)
  ▼
collector::collect_feed(db, http, feed)
  │  select Collector impl by feed_type
  ├─► RssCollector::collect()  → infra/rss_fetcher → parsers/rss_parser
  ├─► AniListCollector::collect() → infra/anilist_client (rate_limiter.acquire()) → parsers/graphql_parser
  ├─► SteamCollector::collect() → infra/steam_client
  │
  │  for each article: normalize_url (sync, on tokio thread — stabilization target)
  │  for each article: generate_content_hash
  │
  ▼
feed_queries::recent_articles_for_dedup(db, category)
  │  load last 72h articles into memory
  ▼
dedup_service: jaccard_bigram_similarity + content_hash match
  ▼
scoring_service::calculate_importance(article, category)
  ▼
feed_queries::upsert_articles(db, articles)  ← batch insert
  ▼
app_handle.emit("collect-completed", result) → React toast
```

**Key Stabilization Points in this flow:**
- Serial loop over feeds: convert to `futures::future::join_all` with per-feed timeout
- Synchronous URL normalization inside async context: move CPU-bound work to `tokio::task::spawn_blocking` with rayon batch, or at minimum parallelize per-article within a feed
- Unicode normalization inconsistency: dedup `normalize_title` uses `nfc()` but should use `nfkc()` for broader compatibility (half-width katakana, compatibility chars)
- URL parameter sort bug: params are sorted correctly in `normalize_url`, but the sort is by raw string — should sort by decoded key name for full correctness

### Digest Flow (Daily, serial categories — stabilization target)

```
scheduler::digest_loop
  │  sleep until configured hour:minute
  ▼
for category in ["anime", "manga", "game", "pc"]  ← SERIAL (stabilization target)
  │
  ▼
digest_generator::generate(db, llm, category, 24h)
  │  SELECT top articles in category
  │  LLM call (Perplexity/Ollama)
  ▼
digest_queries::insert_digest(db, digest)
  ▼
notification::notify_digest_ready(app_handle, category)
```

**Fix Pattern — Parallel digest generation:**
```rust
// Current: serial for loop
// Target: tokio::join_all with per-category timeout

let tasks: Vec<_> = CATEGORIES.iter().map(|cat| {
    let state = state.clone();
    let app_handle = app_handle.clone();
    async move {
        tokio::time::timeout(
            Duration::from_secs(120),
            generate_and_save_digest(&state, &app_handle, cat)
        ).await
    }
}).collect();
let results = futures::future::join_all(tasks).await;
```

### AI Summary / DeepDive Flow

```
Frontend: invoke("get_or_generate_summary", { articleId })
  ▼
commands/discover_ai.rs (thin wrapper)
  ▼
summary_service::get_or_generate(db, article_id, llm)
  │  SELECT from summaries table
  │  if cache hit → return (no TTL check currently — bug)
  │  if miss → llm.complete(req)
  ▼
deepdive_service::answer_question(db, article_id, question, llm)
  │  cache key: (article_id, question)  ← missing: summary_hash
  │  follow_ups: serde_json::from_str().unwrap_or_default()  ← bug: silent data loss
  ▼
DB: INSERT into deepdive_cache
```

**Cache Invalidation Fix:**
Cache key must include a hash of the current article summary. When summary changes, deepdive cache is stale. Add `summary_hash TEXT` column to `deepdive_cache` table; invalidate when hash differs from current `articles.content_hash`.

### Scheduler Config Sync Flow (Currently Broken)

```
User: Settings UI → invoke("set_scheduler_config", { intervalMinutes: 30 })
  ▼
commands/scheduler::set_scheduler_config
  ▼
DB: UPDATE settings (persisted)
  │
  ← collect_loop reads stale SchedulerConfig (cloned at startup, never updated)
```

**Fix Pattern:**
```rust
// In scheduler::start(), accept Arc<RwLock<SchedulerConfig>>
pub fn start(
    app_handle: AppHandle,
    config: Arc<RwLock<SchedulerConfig>>,
    ...
) {
    tauri::async_runtime::spawn(async move {
        collect_loop(app_handle, config.clone(), db, http).await;
    });
}

// In collect_loop: read config each iteration
async fn collect_loop(config: Arc<RwLock<SchedulerConfig>>, ...) {
    loop {
        let (interval_mins, enabled) = {
            let cfg = config.read().unwrap();  // or map_err
            (cfg.collect_interval_minutes, cfg.enabled)
        };
        tokio::time::sleep(Duration::from_secs(interval_mins * 60)).await;
        if !enabled { continue; }
        // ...
    }
}
```

### Graceful Shutdown Flow (Currently Missing)

No cancellation token exists. Loops run until OS kills the process.

**Fix Pattern — CancellationToken:**
```rust
use tokio_util::sync::CancellationToken;

pub struct SchedulerHandle {
    cancel: CancellationToken,
}

pub fn start(...) -> SchedulerHandle {
    let cancel = CancellationToken::new();
    let child = cancel.child_token();

    tauri::async_runtime::spawn(async move {
        tokio::select! {
            _ = collect_loop(...) => {}
            _ = child.cancelled() => {
                tracing::info!("collect_loop cancelled");
            }
        }
    });

    SchedulerHandle { cancel }
}

impl Drop for SchedulerHandle {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}
```

The `SchedulerHandle` should be stored via `app.manage()` and dropped on Tauri's `on_window_event` close event.

---

## Patterns to Follow

### Pattern 1: CancellationToken for Background Tasks

**What:** `tokio_util::sync::CancellationToken` provides cooperative cancellation across async task trees.
**When:** Any `tokio::spawn`ed loop that must terminate cleanly on app exit.
**Why:** Without it, scheduler loops become orphaned during Tauri app shutdown, potentially corrupting in-flight DB writes or leaving OS resources open.

```rust
// Crate: tokio-util (already in tokio ecosystem, likely already transitive dep)
// Usage:
let token = CancellationToken::new();
tokio::select! {
    _ = work_loop() => {}
    _ = token.cancelled() => { /* cleanup */ }
}
```

**Confidence:** HIGH — tokio-util is part of the tokio project, stable API since 0.6.

### Pattern 2: f64 Token Accumulation in Rate Limiter

**What:** Track fractional tokens as f64; convert to integer only at `acquire()` boundary.
**When:** Token bucket where refill rate * elapsed can be < 1.0 per check interval.
**Why:** Current code: `(elapsed.as_secs_f64() * refill_rate) as u32` truncates sub-second accumulation. Over time, actual throughput is lower than configured limit (tokens are silently lost).

```rust
// Current (buggy):
tokens: Arc<Mutex<u32>>,
let tokens_to_add = (elapsed * refill_rate) as u32;  // loses fractions

// Fixed:
tokens: Arc<Mutex<f64>>,
let tokens_to_add = elapsed * refill_rate;  // preserve fractions
// At acquire:
if *tokens >= 1.0 { *tokens -= 1.0; Ok(()) } else { Err(...) }
```

**Confidence:** HIGH — direct analysis of `src-tauri/src/infra/rate_limiter.rs:47`.

### Pattern 3: Single Aggregated Query over Multiple Round-trips

**What:** Consolidate `batch_interaction_bonuses` from 5 separate queries to a single LEFT JOIN query with CASE aggregation.
**When:** `personal_scoring::rescore_all` currently issues: bookmarked query, deepdive query, feed_rates query, feed_articles query, dwell_time query — serially.
**Why:** 5 DB round-trips through SQLx for what is fundamentally a single aggregation. SQLite can do all GROUP BY/aggregation in one pass.

```sql
-- Target single query:
SELECT
  a.id,
  a.feed_id,
  a.published_at,
  a.title,
  COALESCE(SUM(CASE WHEN ai.action = 'deepdive' THEN 1 ELSE 0 END), 0) AS deepdive_count,
  COALESCE(AVG(CASE WHEN ai.dwell_seconds > 0 THEN ai.dwell_seconds END), 0) AS avg_dwell,
  MAX(CASE WHEN a.is_bookmarked = 1 THEN 1 ELSE 0 END) AS is_bookmarked,
  COUNT(CASE WHEN ai.action = 'open' THEN 1 END) * 1.0 / NULLIF(COUNT(ai.id), 0) AS open_rate
FROM articles a
LEFT JOIN article_interactions ai ON ai.article_id = a.id
WHERE a.is_duplicate = 0
ORDER BY a.published_at DESC
LIMIT 2000
GROUP BY a.id
```

**Confidence:** HIGH — direct analysis of `personal_scoring.rs:63-138`.

### Pattern 4: Consistent Unicode Normalization (NFKC)

**What:** Apply NFKC normalization (not NFC) for all title comparison paths.
**When:** Dedup service `normalize_title` uses `nfc()` via `unicode_normalization` crate.
**Why:** NFC handles combining character sequences but not compatibility equivalences (e.g., half-width katakana ｱ vs full-width ア, or squared characters ㎞ vs km). NFKC collapses both. Anime/manga titles frequently mix these forms.

```rust
// Current (line 79 of dedup_service.rs):
let normalized = title.nfc().collect::<String>();

// Fixed:
let normalized = title.nfkc().collect::<String>();
```

The `unicode_normalization` crate already provides `nfkc()` — this is a one-line fix that unblocks the test coverage gap.
**Confidence:** HIGH — `unicode_normalization` crate `nfkc()` function is stable.

### Pattern 5: Panic-to-Error in Setup Code

**What:** Replace `panic!()` / `.unwrap_or_else(|e| panic!(...))` in `lib.rs` setup with graceful error dialogs.
**When:** DB init failure, app_data_dir failure. Currently panics without user-visible message.
**Why:** On first run or after corruption, the app silently crashes rather than showing a dialog. Tauri provides dialog APIs for this exact case.

```rust
// Pattern: use tauri::Builder::setup() Result<(), Box<dyn Error>>
// Return Err(...) from setup closure; Tauri surfaces this as a startup error
.setup(|app| {
    let db_pool = tauri::async_runtime::block_on(infra::database::init_pool(&db_path))
        .map_err(|e| {
            // Optionally show native dialog before returning
            tracing::error!(error = %e, "DB init failed");
            Box::new(e) as Box<dyn std::error::Error>
        })?;
    Ok(())
})
```

**Confidence:** HIGH — Tauri v2 `setup()` closure returns `Result<(), Box<dyn std::error::Error>>`.

### Pattern 6: AppError Variant Correctness

**What:** Use domain-specific `AppError` variants; avoid `AppError::Internal` for rate limit and lock errors.
**When:** `rate_limiter.rs:80-83` returns `AppError::Internal` when rate-limited; should return `AppError::RateLimit`.
**Why:** Frontend error handling branches on `error.kind`; `"internal"` is opaque to the frontend and prevents user-visible rate-limit messaging.

```rust
// Current (rate_limiter.rs:80):
Err(crate::error::AppError::Internal(format!("Rate limited. Retry after {:?}", duration)))

// Fixed:
Err(crate::error::AppError::RateLimit(format!("Retry after {:?}", duration)))
```

**Confidence:** HIGH — direct code analysis; `AppError::RateLimit` variant already exists in `error.rs`.

### Pattern 7: FTS5 Pagination via Subquery

**What:** Apply LIMIT/OFFSET inside the FTS match subquery before joining to main table.
**When:** `fts_queries.rs` — search query returns all matches, then Rust slices.
**Why:** FTS5 can return 10k+ matches for a broad term; loading all into Rust memory before slicing is O(n) memory.

```sql
-- Target pattern:
SELECT a.* FROM articles a
WHERE a.id IN (
  SELECT rowid FROM fts_articles
  WHERE fts_articles MATCH ?
  ORDER BY rank
  LIMIT ? OFFSET ?
)
ORDER BY a.published_at DESC
```

**Confidence:** HIGH — standard SQLite FTS5 rowid-based pagination pattern.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mutex During .await

**What:** Holding a `tokio::sync::Mutex` guard across an `.await` point.
**Why Bad:** Blocks the executor thread; can cause deadlock if another task awaiting the same lock is scheduled on the same thread.
**Instead:** Acquire lock, copy data, release lock, then await.

```rust
// Bad:
let lock = self.state.lock().await;
let result = some_async_op(&lock.data).await;  // lock held during await!

// Good:
let data = { let lock = self.state.lock().await; lock.data.clone() };
let result = some_async_op(&data).await;
```

Current risk: `rate_limiter.rs` acquires Mutex guards and calls `tokio::time::sleep().await` while holding `last_request` guard (lines 54-69). This is safe only because sleep doesn't require the lock, but the pattern is fragile.

### Anti-Pattern 2: spawn_blocking for I/O (and vice versa)

**What:** Using `tokio::task::spawn_blocking` for async I/O; using async tasks for CPU-intensive work.
**Why Bad:** spawn_blocking reserves a blocking thread from Tokio's pool (limited); async tasks run on the event loop and can't block.
**Instead:** rayon for CPU-bound parallelism (URL normalization batch); spawn_blocking only for sync-only FFI or legacy sync APIs.

### Anti-Pattern 3: RwLock Write-Lock on Every Read (LLM Settings)

**What:** Using `state.llm.write()` when only reading settings.
**Why Bad:** Write-locks exclude all concurrent readers; if called frequently during summary generation, it serializes all LLM operations.
**Instead:** Use `read()` for reads; `write()` only when actually mutating (i.e., only on `set_llm_provider` command).

### Anti-Pattern 4: One-shot Cleanup at Startup

**What:** `deepdive_service::cleanup_expired_cache()` called once in setup, never again.
**Why Bad:** If app runs continuously for days (reasonable for a desktop news reader), deepdive cache grows unbounded. A 30-day-old question-answer pair for a long-deleted article wastes storage.
**Instead:** Add a periodic cleanup job to the scheduler (e.g., every 6 hours), capped by either COUNT > N or age > TTL.

### Anti-Pattern 5: Silent JSON Fallback

**What:** `serde_json::from_str(&profile.field).unwrap_or_else(|e| { warn!(...); Vec::new() })`
**Why Bad:** Corrupted profile data causes scoring to silently degrade — user sees poor recommendations with no explanation.
**Instead:** Surface deserialization failures as `AppError::InvalidInput`; let the command layer return an error the UI can handle (show a profile-repair prompt).

---

## Scalability Considerations

| Concern | Current (Single User Desktop) | If Feed Count Grows to 100+ | If Article DB Exceeds 100k |
|---------|-------------------------------|------------------------------|---------------------------|
| Collection loop | Serial per feed, adequate for <30 feeds | Serial becomes bottleneck; switch to `join_all` with concurrency limit | N/A (fetch is incremental) |
| Dedup lookup | `recent_articles_for_dedup` loads last 72h into memory; manageable | Memory pressure if category has 10k+ recent articles | Add DB-side index scan instead of in-memory Jaccard loop |
| Personal scoring | 5 DB queries × rescore_all calls | Merge to 1 query; no change needed | Add `article_scores` materialized table (already designed for this) |
| FTS search | In-memory slice after FTS match | Add rowid subquery pagination (fix now) | Add BM25 ranking + index optimization |
| DeepDive cache | Grows unbounded; cleanup at startup only | Add periodic LRU eviction | Add `MAX(cache_size_mb)` limit |
| Rate limiter | Per-client singleton; single-token bucket | Sufficient for 1 user; not applicable to multi-user | N/A |
| Digest generation | Serial, 4 categories | `join_all` reduces wait from 4x to 1x LLM latency | N/A (content bounded by 24h window) |

---

## Build Order for Stabilization Phases

The following dependency graph drives the recommended phase ordering:

```
Phase 1: Foundation Safety (no regressions possible without this)
  ├── AppError variant correctness (rate_limiter → AppError::RateLimit)
  ├── lib.rs panic → structured error (startup reliability)
  ├── Unicode normalization fix (dedup correctness; everything downstream depends on dedup)
  └── URL param sort canonicalization (dedup correctness)

Phase 2: Async Safety (fixes structural problems in scheduler/rate limiter)
  ├── Rate limiter f64 token accounting (correctness)
  ├── CancellationToken for scheduler loops (shutdown safety)
  ├── Arc<RwLock<SchedulerConfig>> propagation (config sync)
  └── Digest loop parallelization (performance, but architecturally adjacent to CancellationToken work)

Phase 3: Query Optimization (requires Phase 1 dedup fixes to be testable)
  ├── personal_scoring: 5 queries → 1 query
  ├── FTS pagination fix
  ├── highlights N+1 elimination
  └── JSON profile validation (AppError::InvalidInput, not silent fallback)

Phase 4: Cache Hardening (requires Phase 1 + 2 to be stable)
  ├── DeepDive cache: add summary_hash to cache key
  ├── DeepDive follow_up: log + repair instead of unwrap_or_default
  ├── DeepDive cleanup: periodic job in scheduler (requires Phase 2 scheduler work)
  └── LRU eviction cap for deepdive cache

Phase 5: Test Coverage (can run after each Phase, but listed separately)
  ├── dedup_service: 20+ test cases (Unicode, URL variants, hash collisions)
  ├── rate_limiter: concurrency stress test, 429 simulation
  ├── scheduler: CancellationToken shutdown test
  ├── personal_scoring: edge cases (empty profile, NaN guard, bounds)
  └── TypeScript hooks: Tauri error shape test (plain object, not Error instance)

Phase 6: Security Audit
  ├── Perplexity API key log scrub audit
  ├── user_profile JSON size limit (DB CHECK constraint + UI input limit)
  └── OPML URL validation before insert
```

**Critical Dependency:** Phases 3 and 4 depend on Phase 1 being complete because query optimization and cache hardening are only meaningful once dedup correctness is established (otherwise you're optimizing on top of broken data).

---

## Sources

| Source | Type | Confidence | Notes |
|--------|------|------------|-------|
| `src-tauri/src/infra/rate_limiter.rs` | Direct code analysis | HIGH | Token truncation bug confirmed at line 47 |
| `src-tauri/src/services/scheduler.rs` | Direct code analysis | HIGH | No CancellationToken, no config sync confirmed |
| `src-tauri/src/services/personal_scoring.rs:63-138` | Direct code analysis | HIGH | 5 separate DB queries confirmed |
| `src-tauri/src/services/dedup_service.rs:79` | Direct code analysis | HIGH | `nfc()` call confirmed, NFKC needed for JA |
| `src-tauri/src/lib.rs:37,51,178` | Direct code analysis | HIGH | 3 panic sites confirmed |
| `src-tauri/src/error.rs` | Direct code analysis | HIGH | `AppError::RateLimit` variant exists but unused in rate_limiter |
| `src-tauri/src/services/deepdive_service.rs:55` | Direct code analysis | HIGH | `unwrap_or_default()` on cache JSON confirmed |
| `.planning/codebase/CONCERNS.md` | Prior analysis document | HIGH | Cross-referenced all findings |
| tokio-util `CancellationToken` | Established Tokio ecosystem pattern | HIGH | Standard pattern since tokio-util 0.6; no API changes |
| SQLite FTS5 rowid pagination | SQLite official docs pattern | HIGH | Standard FTS5 rowid subquery technique |
| Rust `unicode_normalization` crate | Crate documentation | HIGH | `nfkc()` method is stable, same API as `nfc()` |
