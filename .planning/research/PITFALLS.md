# PITFALLS.md — OtakuPulse Stabilization

**Domain:** Tauri v2 + Rust async + SQLite — stabilization/optimization
**Researched:** 2026-03-27
**Sources:** Direct codebase analysis (CONCERNS.md, lib.rs, scheduler.rs, rate_limiter.rs, dedup_service.rs, personal_scoring.rs, deepdive_service.rs, highlights_service.rs, database.rs, collector.rs) + Rust/Tokio domain knowledge (HIGH confidence for patterns confirmed in code; MEDIUM for architectural patterns)

---

## Critical Pitfalls

### 1. Replacing `panic!` in `setup()` With a Dialog That Never Shows

**What goes wrong:** The three `panic!` calls in `lib.rs` (lines 37, 51, 178) fire inside Tauri's `setup()` closure before any window exists. Replacing them with `app.dialog()` or `app_handle.emit()` silently fails because the WebView is not yet mounted. The app crashes with no user-visible feedback, same as before the fix.

**Why it happens:** `setup()` runs synchronously before the main window is created. Tauri's dialog and event plugins require an active window handle to display or deliver messages.

**Consequences:** Partial fix gives false confidence. Users on machines with no write permission to AppData (corporate devices, restricted profiles) still see a silent crash.

**Prevention:**
- For `app_data_dir` failure: fall back to `std::env::temp_dir()` joined with app name as emergency path, log the fallback with `tracing::error!`, and continue rather than panic.
- For DB init failure: return `Err(Box<dyn Error>)` from `setup()` — Tauri propagates this as a controlled exit. Log the path attempted before returning.
- Show the error dialog from an `app.run()` event hook, not inside `setup()`.
- Confirm the fix by intentionally causing a DB init failure in a dev build and verifying the user sees an error.

**Warning signs:** `tracing::error!` log entry immediately followed by process exit code 101 (Rust panic).

**Phase:** Phase 1 (Tech Debt — must be first; affects every other phase's testability).

---

### 2. Token Bucket Refill Truncation Compounds Over Time

**What goes wrong:** `rate_limiter.rs` line 47 casts `(elapsed.as_secs_f64() * self.refill_rate) as u32`, truncating sub-integer tokens. At `refill_rate = 0.5` (AniList), a 1.9-second elapsed time adds 0 tokens instead of 0.95. Over a 30-minute period, up to 14 tokens are silently discarded. The real effective rate becomes ~27 req/min instead of 30.

**Why it happens:** Integer arithmetic is used for token state (`Arc<Mutex<u32>>`), but `refill_rate` is `f64`. The mismatch is invisible until tested under load.

**Consequences:** The AniList client becomes more conservative than necessary, slowing batch page fetches. Worse, a future fix that increases `refill_rate` could overshoot and cause 429s if someone corrects the integer math without accounting for the accumulated debt.

**Prevention:**
- Change `tokens` field type to `Arc<Mutex<f64>>`.
- Keep the integer conversion at the point of token consumption only: `if *tokens >= 1.0 { *tokens -= 1.0; Ok(()) }`.
- Existing `rate_limiter_tests.rs` — add a test that runs 60 ticks of 1.9s elapsed and asserts `tokens >= 29.0` (not 27).

**Warning signs:** Integration test showing fewer than 30 successful acquires per minute under 2-second polling.

**Phase:** Phase 1 (Tech Debt — the existing bug). Phase 2 stress tests will expose it if not fixed first.

---

### 3. Scheduler Loops With No Cancellation Token — Orphaned Tasks on Shutdown

**What goes wrong:** `collect_loop` and `digest_loop` run as `tauri::async_runtime::spawn` tasks with no `CancellationToken`. When the user closes the app, Tokio drops the runtime, but both loops are inside `loop {}` blocks that `await` futures. Tokio cancels futures at the next `.await` point, but any work-in-progress (DB write, HTTP fetch) at that moment is abandoned mid-transaction.

**Why it happens:** `tokio::spawn` returns a `JoinHandle` that is immediately discarded in `start()`. There is no select on a shutdown signal, so the only stopping mechanism is process termination.

**Consequences:**
- SQLite WAL may have uncommitted frames if the DB write is interrupted. On next startup, WAL recovery runs, which is usually safe but adds startup latency.
- If `collect_loop` holds a connection from the pool during shutdown, `SqlitePool::close()` may block indefinitely, causing a hang on exit.
- Tests for shutdown behavior cannot be written without a cancellation primitive.

**Prevention:**
- Pass `tokio_util::sync::CancellationToken` into both loops. Select between `interval_timer.tick()` and `token.cancelled()`.
- In `lib.rs` setup, store the token in managed state or as a `tauri::RunEvent::ExitRequested` handler.
- `SqlitePool::close().await` in the exit handler after cancelling loops — this ensures all connections drain cleanly.
- Write a test that cancels the token after 100ms and asserts the `JoinHandle` resolves within 500ms.

**Warning signs:** App takes >2s to close after window is dismissed. SQLite WAL file persists on disk after clean shutdown.

**Phase:** Phase 2 (Fragile Areas / Scheduler). Block test coverage phase on this fix.

---

### 4. `digest_loop` Sequential I/O — One Slow LLM Call Delays All Categories

**What goes wrong:** The loop in `scheduler.rs` lines 136–166 iterates `["anime", "manga", "game", "pc"]` with `for ... await` — fully sequential. If the Ollama instance is under load and the first category's LLM call takes 45 seconds, the other three categories are blocked for the entire duration.

**Why it happens:** The loop was written sequentially for simplicity. Tokio's `join_all` was not used because each category shares `&*llm_client`, and the `LlmClient` trait was likely not designed to be `Clone + Send` from the start.

**Consequences:** Digest generation can take 3–4x longer than necessary. Under heavy LLM load (large Ollama model), the digest may not complete before the next scheduled time.

**Prevention:**
- Before parallelizing: audit whether `llm_client` implements `Send + Sync`. If it wraps an `Arc<reqwest::Client>`, it will.
- Refactor to build one `LlmClient` per category (or clone an `Arc<dyn LlmClient + Send + Sync>`), then spawn with `tokio::task::spawn` per category and collect with `futures::future::join_all`.
- Add a per-category timeout: `tokio::time::timeout(Duration::from_secs(120), generate(...))`.
- Do NOT parallelize the DB writes that follow — insert serially to avoid contention on SQLite.

**Warning signs:** Digest generation log shows >60s between "開始" and "完了" messages. Categories complete in strict 1-2-3-4 order in logs.

**Phase:** Phase 3 (Performance). Depends on Phase 2 cancellation token work (shared task lifetime).

---

### 5. DeepDive Cache Never Invalidated — Stale Answers Returned Indefinitely

**What goes wrong:** `deepdive_service.rs` cache lookup (lines 45–63) uses `(article_id, question)` as key. There is no TTL column check and no summary-hash comparison. If an article's `ai_summary` is updated after a DeepDive session, the old cached answer is returned forever. The cache cleanup at startup (one-time, not periodic) only removes rows past a hard-coded age.

**Why it happens:** Cache key was designed for cache-hit speed, not invalidation correctness. Summary updates and cache invalidation are handled by separate code paths with no shared signal.

**Consequences:** Users see confidently wrong answers if article summaries are enriched post-publication. The bug is silent — no error, no staleness indicator.

**Prevention:**
- Add `summary_hash TEXT` column to `deepdive_cache`. Populate it as `sha256(ai_summary)[..16]` at insert time.
- On cache lookup, also fetch `articles.ai_summary`, compute its hash, and compare. Invalidate on mismatch.
- Add a periodic cleanup job in `scheduler.rs` (e.g., weekly) instead of only at startup — prevents indefinite accumulation between restarts.
- LRU eviction: cap `deepdive_cache` at 500 rows; delete oldest on insert when over limit.
- Write a test: insert cache entry, update article summary, assert that the next lookup returns a cache miss.

**Warning signs:** Manual inspection of `deepdive_cache` rows with `created_at` older than 30 days that have no corresponding updated `articles.ai_summary`.

**Phase:** Phase 2 (Known Bugs). Fix before Phase 3 performance work that may trigger more cache writes.

---

### 6. `SqlitePool` Without WAL Mode — Write Contention Under Parallel Tasks

**What goes wrong:** `database.rs` opens the pool with `sqlite:...?mode=rwc` but does not enable WAL (Write-Ahead Logging) mode. With `max_connections = 5`, any write from `collect_loop` (which runs on its own task) will lock the database in exclusive mode, blocking reads from Tauri commands for the duration of the write — typically 50–200ms per batch insert.

**Why it happens:** WAL mode is not the SQLite default. `sqlx` does not enable it automatically. Without WAL, SQLite uses rollback journal mode where writes hold a full exclusive lock.

**Consequences:** During feed collection (potentially 100s of inserts), the UI freezes waiting for DB reads to return. FTS searches, discover feed queries, and digest generation all block on the write lock.

**Prevention:**
- Run `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;` immediately after pool creation in `database.rs`.
- WAL allows concurrent readers during a write — this directly fixes the UI stall.
- Also set `PRAGMA busy_timeout = 5000;` to prevent `SQLITE_BUSY` errors if a write does block.
- Verify by checking `PRAGMA journal_mode;` in a test that returns `"wal"`.
- Note: WAL files (`.db-wal`, `.db-shm`) appear alongside the main DB. This is expected and safe.

**Warning signs:** UI log shows `SQLITE_BUSY` or `database is locked` errors during `collect_loop` runs. Discover feed query takes >500ms when collection is running in background.

**Phase:** Phase 1 (foundational — all other DB work depends on this not introducing contention).

---

### 7. Unicode Normalization Applied Inconsistently — Dedup Miss Rate

**What goes wrong:** `dedup_service.rs` `normalize_title()` applies NFC normalization (line 79: `.nfc().collect::<String>()`), but CONCERNS.md confirms some code paths compare normalized-vs-non-normalized titles. The `content_hash` is computed from the article body, not the normalized title. Two articles with identical content but titles using combining characters (common in Japanese) will produce different hashes and pass through dedup.

**Why it happens:** NFC was chosen but NFKC is generally more aggressive for dedup use cases (e.g., converts full-width to half-width, decomposes ligatures). The inconsistency likely originated from incremental additions to the normalization pipeline.

**Consequences:** Duplicate Japanese articles from sources that mix full-width and half-width characters (AniList titles, some RSS feeds) survive dedup. The AI summary phase then summarizes duplicates, wasting LLM tokens.

**Prevention:**
- Switch `normalize_title()` from `.nfc()` to `.nfkc()` (already available in `unicode_normalization` crate). NFKC handles full-width/half-width equivalences critical for Japanese content.
- Audit every call site that performs title comparison and ensure normalization is applied to both sides.
- Store `normalized_title` as a separate column in `articles` and compare only normalized forms in dedup queries.
- Add 20+ test cases to `dedup_service_tests.rs` covering: NFC vs NFD equivalents, full-width ASCII (Ａ vs A), mixed combining characters, URL parameter reordering (the separate known bug).

**Warning signs:** Running `SELECT COUNT(*) FROM articles WHERE is_duplicate = 0 GROUP BY normalized_title HAVING COUNT(*) > 1` returns non-zero rows.

**Phase:** Phase 1 (Tech Debt). Write tests first, then change normalization — tests catch regressions.

---

## Moderate Pitfalls

### 8. `collect_loop` Config Is a Value Copy — Runtime Changes Have No Effect

**What:** `scheduler.rs` `start()` clones `SchedulerConfig` into both loops by value. The `config.enabled` check (line 74) reads from this stale copy. Even if `set_scheduler_config` updates managed state, the running loop never sees it until the next app restart.

**Prevention:** Wrap `SchedulerConfig` in `Arc<RwLock<SchedulerConfig>>`, pass the `Arc` clone to both loops. On each iteration, acquire a read lock, copy only the fields needed, release immediately. Use `tokio::sync::RwLock` (not `std::sync::RwLock`) to avoid blocking the async runtime.

**Phase:** Phase 2 (Fragile Areas). Low urgency unless config hot-reload is shipped in this milestone.

---

### 9. `personal_scoring` Silent Fallback Masks Corrupted Profile Data

**What:** `personal_scoring.rs` lines 149–158 call `serde_json::from_str(...).unwrap_or_else(|e| { tracing::warn!(...); Vec::new() })`. A corrupted `favorite_titles` JSON silently returns an empty list, so all scoring uses zero personal preferences. The user sees deprioritized, generic content with no indication why.

**Prevention:** Validate JSON at write time (`profile_service.rs`) with a round-trip parse before committing. At read time, treat parse failure as `AppError::InvalidInput` and surface it to the UI as a settings alert rather than silently degrading. Add a DB `CHECK` constraint: `CHECK(json_valid(favorite_titles))`.

**Phase:** Phase 1 (Security/Validation) and Phase 4 (Test Coverage for edge cases).

---

### 10. N+1 Queries in `personal_scoring::batch_interaction_bonuses`

**What:** The function (`personal_scoring.rs` lines 63–137) issues 5 separate SQL queries: bookmarked articles, deepdived articles, feed engagement rates, feed articles, and dwell times. On a 1,000-article DB, this is 5 round-trips that could be 1. Each round-trip allocates a `Vec` and merges it into a `HashMap` in Rust.

**Prevention:** Combine into a single CTE query:
```sql
WITH interactions AS (
  SELECT article_id, action, dwell_seconds FROM article_interactions
), ...
SELECT a.id,
  MAX(CASE WHEN a.is_bookmarked THEN 3.0 ELSE 0.0 END) as bookmark_bonus,
  ...
FROM articles a ...
GROUP BY a.id
```
Let SQLite do the aggregation. Return one `Vec<(i64, f64)>` from a single `fetch_all`.

**Phase:** Phase 3 (Performance). Measure before and after with `EXPLAIN QUERY PLAN`.

---

### 11. FTS5 Search Loads All Matches Before Pagination

**What:** `fts_queries.rs` fetches all matching rows into a `Vec` before slicing for the requested page. For a query matching 5,000 articles, this allocates ~5MB of structs and deserializes them all, then discards 99% of the results.

**Prevention:** Use SQLite's `LIMIT`/`OFFSET` inside the FTS query itself:
```sql
SELECT rowid FROM fts_articles WHERE fts_articles MATCH ?1 LIMIT ?2 OFFSET ?3
```
Then join on `articles` to hydrate only the page's rows.

**Warning signs:** `get_discover_feed` response time grows linearly with total article count, not page size.

**Phase:** Phase 3 (Performance).

---

### 12. Mutex Lock Held Across `.await` — Latent Deadlock Risk

**What:** `rate_limiter.rs` `refill_tokens()` locks `self.last_refill`, then separately locks `self.tokens` (lines 43–49). `wait_for_interval()` locks `self.last_request` and then calls `tokio::time::sleep(...).await` while — critically — `last_request` is still held via the `MutexGuard` on the stack (line 66).

**Why it happens:** The `MutexGuard` for `last_request` is created on line 57 and used on line 69 (`*last_request = Instant::now()`). The `sleep().await` on line 66 suspends the task while the guard is live. This is a correctness issue: `tokio::sync::Mutex` allows this (no compile error), but it means no other task can acquire `last_request` during the sleep, defeating the purpose of a shared rate limiter.

**Prevention:**
- Record `last_request` as an `Arc<Mutex<Instant>>`, but release the lock before `sleep()`:
```rust
let wait_time = {
    let last = self.last_request.lock().await;
    // compute wait_time, lock released here
};
tokio::time::sleep(wait_time).await;
{
    let mut last = self.last_request.lock().await;
    *last = Instant::now();
}
```
- Add a test that spawns two concurrent `acquire()` calls and asserts the second waits the min interval.

**Phase:** Phase 1 (Tech Debt). Risk is low with current single-task usage, but becomes a bug when digest parallelization is added in Phase 3.

---

### 13. OPML Import Accepts Any URL Schema — SSRF Risk on Local Networks

**What:** `opml_service.rs` imports feed URLs without validating the schema or host. A malformed OPML file with `file:///etc/passwd` or `http://192.168.1.1/admin` as feed URLs causes `reqwest` to attempt those requests from the user's machine. On a Tauri desktop app this is a local SSRF — limited blast radius, but still wrong.

**Prevention:**
- Before inserting, validate that each URL (a) parses successfully, (b) uses `http://` or `https://` scheme, (c) has a non-private host (reject RFC1918 ranges for extra safety, or at minimum reject `localhost` and `127.0.0.1`).
- Return a `Vec<ValidationError>` listing rejected URLs with reasons, displayed in the import UI.

**Phase:** Phase 2 (Security).

---

### 14. `serde_json::from_str` on DeepDive `follow_ups` — Silent Empty Vec

**What:** `deepdive_service.rs` line 55: `serde_json::from_str(&follow_ups_json).unwrap_or_default()`. If the stored JSON is malformed (e.g., truncated write due to prior crash), follow-up questions are silently dropped. The user sees an answer with no follow-ups and assumes the LLM produced none.

**Prevention:** Log a `tracing::warn!` on parse failure with the raw string (truncated to 200 chars for safety). Return an explicit `AppError::Internal` rather than silent empty vec if the corruption is detected at read time. Add a migration to validate and repair existing rows.

**Phase:** Phase 1 (Tech Debt).

---

## Minor Pitfalls

### 15. `normalize_url` Does Not Percent-Decode Before Comparing

**What:** Two URLs that are percent-encoding variants of each other (`%2F` vs `/`) compare as different strings in dedup. Not common but occurs with some RSS feeds that encode slashes in path segments.

**Prevention:** Apply `percent_encoding::percent_decode_str` before normalization. Low priority — fix alongside the main URL normalization audit.

**Phase:** Phase 1 (part of dedup test expansion).

---

### 16. `reqwest::Client` Cloned in `collector.rs` Every `refresh_all` Call

**What:** `collector.rs` line 18: `let http = Arc::new(http.clone())`. The `http` parameter is already a `&reqwest::Client`, so `.clone()` creates a new client handle (cheap — it's an `Arc` internally), but wrapping it in a second `Arc` is redundant and confusing.

**Prevention:** Change the function signature to accept `Arc<reqwest::Client>` directly (consistent with how `lib.rs` stores it). Eliminates the double-Arc, makes ownership clear. Low risk, quick fix.

**Phase:** Phase 1 (cleanup, can be done alongside other refactors).

---

### 17. `seconds_until` Uses `Local::now()` for JST Digest Scheduling

**What:** `scheduler.rs` `seconds_until()` uses `chrono::Local` to compute wait time until `digest_hour:digest_minute`. On a machine where the OS timezone is not JST, the digest fires at the wrong wall-clock time relative to the user's expectation. Comments say "JST 基準" but the implementation uses OS local time.

**Prevention:** If the target timezone is always JST, use `chrono_tz::Asia::Tokyo`. If the intent is "user's local time," remove the JST comment. Add a unit test with a mocked "now" that asserts correct wait time in multiple timezones.

**Phase:** Phase 2 (Fragile Areas). Low impact for Japanese users; matters for international testers.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| P1: Remove `panic!` in setup | Showing error dialogs before window exists | Return `Err` from `setup()`; show dialog from `RunEvent` handler |
| P1: Rate limiter f64 fix | Changing token type breaks existing tests | Update `rate_limiter_tests.rs` first, then change type |
| P1: Unicode normalization | Switching NFC→NFKC changes hash values for existing articles | Run `UPDATE articles SET is_duplicate = 0` after migration and re-run dedup |
| P2: Scheduler CancellationToken | Token stored in `AppState` creates circular Arc reference | Store `CancellationToken` separately in `tauri::State<>`, not inside `AppState` |
| P2: DeepDive cache schema change | Adding `summary_hash` column requires migration | Write migration that backfills `NULL` for existing rows; treat `NULL` as cache miss |
| P2: OPML URL validation | Rejecting too aggressively breaks valid but unusual feeds | Allowlist `http`/`https` schemes only; do not block by TLD or IP range (too broad) |
| P3: digest_loop parallelization | `LlmClient` trait not `Sync` — compile error on `Arc<dyn LlmClient>` | Add `+ Sync` bound to `LlmClient` trait; verify `OllamaClient` and `PerplexityClient` are `Sync` |
| P3: FTS pagination | `OFFSET` on FTS5 is O(n) — scans all preceding rows | Use `rowid > last_seen_rowid` cursor pagination instead of `OFFSET` |
| P3: personal_scoring CTE | Single CTE may regress on cold cache vs. 5 simple queries | Benchmark both approaches with `EXPLAIN QUERY PLAN`; prefer CTE only if faster |
| P4: Adding tests to untested code | Tests that mock `SqlitePool` directly — sqlx requires a real DB | Use `sqlx::test` macro with an in-memory SQLite pool for all DB tests |
| P4: Rate limiter stress tests | Time-dependent tests flake on slow CI | Use `tokio::time::pause()` and `tokio::time::advance()` to fake elapsed time |
| P4: Scheduler shutdown tests | Testing background loops requires actual `tokio::runtime` | Use `#[tokio::test]` with explicit `CancellationToken`; do not use `block_on` in tests |
| P5: Offline mode | Returning cached articles while APIs are down requires distinguishing "no new articles" from "fetch failed" | Add `FetchStatus` enum to `CollectResult`; propagate to UI via event |
| P5: LLM provider switch | Mid-request provider change corrupts multi-turn conversation | Lock `llm_provider` into a per-session `Arc` at conversation start; refuse switch until session ends |
