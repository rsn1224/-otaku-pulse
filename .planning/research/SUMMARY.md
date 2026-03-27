# Project Research Summary

**Project:** OtakuPulse
**Domain:** Tauri v2 + Rust + React 19 — Desktop News Aggregator Stabilization
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

OtakuPulse is a working Tauri v2 desktop app with a 4-layer Rust architecture (commands/services/infra/parsers) and a React 19 frontend using Zustand for state management. The existing stack is well-chosen and requires no major additions or framework changes. Research confirms the stabilization milestone is squarely about hardening existing code — lifecycle management, async safety, query efficiency, and correctness of dedup/cache logic — not about adding new capabilities.

The recommended approach follows a strict dependency ordering: foundational safety fixes first (startup panics, WAL mode, Unicode normalization, rate limiter correctness), then async lifecycle work (CancellationToken, config hot-reload, DeepDive cache invalidation), then query/performance optimization, and finally comprehensive test coverage and security audit. Attempting performance fixes before correctness fixes would optimize on top of broken dedup data, and testing before CancellationToken exists means the scheduler cannot be meaningfully tested.

The primary risks are: (1) the three `panic!` sites in `lib.rs` that crash the app silently on DB init failure — the fix must use `Err` return from `setup()`, not a dialog before the window exists; (2) scheduler loops that have no shutdown path, creating potential DB corruption on close; and (3) Unicode normalization that uses NFC instead of NFKC, causing dedup misses for Japanese titles that mix full-width and half-width characters. All three are confirmed via direct code analysis with HIGH confidence.

---

## Key Findings

### Recommended Stack

The existing stack requires only four Rust additions and three TypeScript additions. No new frameworks, no major version changes. All additions address specific confirmed gaps from CONCERNS.md.

**Core technology additions:**
- `tokio-util 0.7` (`CancellationToken`) — cooperative shutdown for scheduler loops; the canonical tokio pattern for this problem
- `rayon 1.10` — CPU-parallel URL normalization for large feed batches; must be invoked via `tokio::task::spawn_blocking` to avoid blocking the async runtime
- `lru 0.12` — LRU eviction cap for DeepDive cache; lighter than `moka` for single-service in-process use
- `@vitest/coverage-v8` — V8 coverage provider; correct choice given `environment: 'node'` in vitest.config.ts
- `@testing-library/react 16.x` + `@testing-library/user-event 14.x` — component and keyboard interaction tests for React 19

**Existing patterns requiring enforcement (already in dependencies, inconsistently applied):**
- `unicode-normalization`: switch `nfc()` to `nfkc()` in `dedup_service.rs` for Japanese title compatibility
- `sha2`: add `CHECK(length(content_hash) = 64)` migration constraint
- SQLite WAL mode: enable via `SqliteConnectOptions` at pool creation time — unblocks concurrent reads during writes
- `sqlx` offline mode: run `cargo sqlx prepare`, commit `.sqlx/`, set `SQLX_OFFLINE=true` in CI

### Expected Features

Research maps CONCERNS.md items to stabilization features classified by user-visible impact.

**Must have (table stakes — absence makes app feel broken):**
- Startup panic elimination — currently crashes silently on DB init failure or missing AppData dir
- Graceful offline mode — app must serve 72h cached content when network is unavailable
- Scheduler graceful shutdown — prevents DB corruption and process hang on close (Windows especially)
- DeepDive cache TTL enforcement — indefinitely stale AI answers degrade user trust
- Config hot-reload for scheduler — changes in Settings must take effect without restart
- Dedup URL canonicalization fix — duplicate articles in Feed destroy aggregator credibility
- Unicode dedup consistency (NFC → NFKC) — duplicate Japanese articles survive dedup currently
- Personal scoring JSON validation — silent fallback to empty preferences makes recommendations silently wrong
- API key log scrubbing — Perplexity key leak in error logs is a security incident
- Mutex lock poisoning recovery — `expect("lock poisoned")` crashes app on any task panic

**Should have (differentiators — noticeably better experience):**
- Digest loop parallelization (4x speed improvement via `tokio::join!`)
- Rate limiter f64 token accounting (prevents 429s at boundary conditions)
- N+1 query elimination in highlights (100 DB calls → 1)
- Personal scoring 3-query consolidation (5 queries → 1 CTE)
- FTS pagination pushdown (avoid loading all matches into memory)
- RSS parse error visibility (surface broken feeds to user)
- DeepDive cache LRU eviction (prevent unbounded disk growth)

**Defer to later milestones:**
- New API source integrations
- Cloud sync / OAuth
- Full circuit breaker library (tower/reqwest-middleware)
- UI redesign or new Wings
- Telemetry / crash reporting (Sentry)
- rayon URL normalization per-article (50ms saving not user-perceptible at current scale)
- LLM provider hot-switch safety (niche edge case)

### Architecture Approach

The 4-layer architecture (commands → services → infra → parsers) is correctly implemented and requires no structural changes. The individual `app.manage()` pattern is in place with no global `Mutex<AppState>`. The stabilization work is targeted hardening within existing layer boundaries, not reorganization.

**Major components and stabilization priorities:**
1. `scheduler.rs` — CRITICAL: no shutdown path, no config sync; requires `CancellationToken` + `Arc<RwLock<SchedulerConfig>>`
2. `lib.rs setup()` — CRITICAL: 3 panic sites; replace with `Err` return from `setup()` closure
3. `dedup_service.rs` — HIGH: NFC → NFKC normalization; URL param sort canonicalization
4. `rate_limiter.rs` — HIGH: `u32` token truncation → `f64`; Mutex held across `.await`
5. `personal_scoring.rs` — HIGH: 5 DB queries → 1 CTE; JSON silent fallback
6. `deepdive_service.rs` — MEDIUM: no TTL check; missing `summary_hash` in cache key; cleanup only at startup
7. `fts_queries.rs` — MEDIUM: all FTS matches loaded before pagination

**Key data flow stabilization targets:**
- Collection flow: serial per-feed loop → `join_all` with per-feed timeout; CPU-bound normalization → `spawn_blocking`
- Digest flow: serial 4-category for loop → `tokio::join!` with per-category 120s timeout
- Scheduler config flow: value-copy at spawn → `Arc<RwLock<SchedulerConfig>>` read each iteration
- Shutdown flow: process kill → `CancellationToken::cancel()` + `SqlitePool::close().await`

### Critical Pitfalls

1. **Setup panic before window exists** — Replacing `panic!` with a dialog call inside `setup()` does nothing (WebView not mounted yet). Fix: return `Err(Box<dyn Error>)` from `setup()`; show error from `RunEvent` handler. Confirm by intentionally failing DB init in a dev build.

2. **Scheduler loops abandoned mid-transaction** — No `CancellationToken` means Tokio drops loops at the next `.await` during process kill, potentially interrupting in-flight DB writes. SQLite WAL recovery handles it usually, but pool `close()` may hang. Fix: `CancellationToken` + `SqlitePool::close().await` in exit handler.

3. **Unicode NFKC migration side effect** — Switching `nfc()` to `nfkc()` changes hash values for existing articles already in the DB. After migration: run `UPDATE articles SET is_duplicate = 0` and re-execute dedup pass to recompute with new normalization.

4. **Rate limiter Mutex held across `.await`** — `last_request` MutexGuard is live on stack during `sleep().await` in `rate_limiter.rs`. Safe with current single-task usage, but becomes a deadlock risk when digest parallelization adds concurrent `acquire()` calls. Fix in Phase 1 before Phase 3 parallelization.

5. **FTS5 OFFSET is O(n)** — Using `LIMIT ? OFFSET ?` on FTS5 still scans all preceding rows. For deep pagination, use cursor-based `rowid > last_seen_rowid` instead of offset. Phase 3 warning.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and feature priorities from FEATURES.md, a 6-phase structure is recommended. Phases 3 and 4 explicitly depend on Phase 1 correctness being established before optimization and cache work begin.

### Phase 1: Foundation Safety
**Rationale:** Every other phase depends on the app not panicking at startup and on dedup producing correct data. Rate limiter correctness must precede parallelization (Phase 3). Unicode normalization must precede the dedup test suite (Phase 4).
**Delivers:** App that starts reliably, dedup that correctly handles Japanese titles, rate limiter that counts tokens correctly, WAL mode for concurrent reads/writes, sqlx CI builds.
**Addresses:** Startup panic elimination, Unicode dedup consistency, URL canonicalization fix, dedup/rate limiter correctness, SQLite WAL mode, sqlx offline mode.
**Avoids:** Pitfall 1 (setup panic fix), Pitfall 3 (NFKC migration), Pitfall 4 (Mutex across await — fix before Phase 3 parallelization).

### Phase 2: Async Lifecycle
**Rationale:** Scheduler is the app's heartbeat. Without graceful shutdown, Windows process cleanup is unreliable. Without config hot-reload, Settings feel broken. DeepDive cache staleness is a trust-eroding correctness bug, not a performance concern. OPML URL validation is a security concern at the data-entry boundary.
**Delivers:** Scheduler that shuts down cleanly, config changes that take effect immediately, DeepDive cache that invalidates on stale summary, OPML imports that reject SSRF-risk URLs.
**Uses:** `tokio-util CancellationToken`, `Arc<RwLock<SchedulerConfig>>`, `summary_hash` DB migration, OPML URL scheme validation.
**Implements:** SchedulerHandle lifecycle pattern, graceful exit hook in `lib.rs`.
**Avoids:** Pitfall 2 (scheduler shutdown), Phase 2 warning (CancellationToken stored separately from AppState to avoid circular Arc).

### Phase 3: Query and Performance Optimization
**Rationale:** Query optimization and parallelization are only meaningful after Phase 1 dedup correctness is established — otherwise you're optimizing on top of broken data. Digest parallelization requires Phase 2's `LlmClient` `Sync` audit (needed before `Arc<dyn LlmClient + Send + Sync>` in join_all).
**Delivers:** 4x faster digest generation, 5x fewer DB round-trips for scoring, FTS search that doesn't load all matches into memory, N+1 highlights query eliminated.
**Uses:** `tokio::join!` for digest categories, single CTE query for personal scoring, FTS5 rowid subquery, `Arc<reqwest::Client>` cleanup in collector.
**Avoids:** Pitfall (FTS OFFSET O(n) — use cursor pagination); digest DB writes remain serial after parallel LLM calls.

### Phase 4: Cache Hardening and Validation
**Rationale:** DeepDive cache eviction requires Phase 2's periodic cleanup scheduler job to exist. Personal scoring JSON validation surfaces errors that require the `AppError::InvalidInput` variant (confirmed present). Security items (API key log scrub, JSON size limits) belong together as a security review pass.
**Delivers:** DeepDive cache that evicts at 500-row LRU cap, personal scoring that surfaces corrupted profiles to UI, API key redaction in error logs, user_profile JSON size limit.
**Uses:** `lru 0.12` for in-process LRU tracking, `CHECK(json_valid(...))` DB migration, tracing audit of reqwest error paths.
**Avoids:** Pitfall (silent JSON fallback masks corrupted data).

### Phase 5: Test Coverage
**Rationale:** Tests are listed last not because they are low priority, but because meaningful tests require stable behavior to assert against — Phase 1 normalization and Phase 2 lifecycle fixes must be in place first. Rate limiter tests require `tokio::time::pause()` for determinism. Scheduler tests require the CancellationToken from Phase 2.
**Delivers:** dedup_service 20+ test cases, rate_limiter concurrency stress tests, scheduler shutdown test, personal_scoring edge cases, TypeScript hook error-shape tests, full coverage reporting via `cargo-llvm-cov` and `@vitest/coverage-v8`.
**Uses:** `@testing-library/react 16.x`, `@testing-library/user-event 14.x`, `sqlx::test` macro with in-memory pool, `tokio::time::pause()`.
**Avoids:** Phase 4 warning (sqlx tests require `sqlx::test` macro — not raw `SqlitePool::connect`).

### Phase 6: Offline Mode and UX Polish
**Rationale:** Offline mode requires `FetchStatus` enum propagation through the collection pipeline — a data-model change that should not be introduced mid-stabilization. RSS parse error visibility and OPML dry-run preview are UX improvements that layer on top of the stable pipeline from Phases 1-5.
**Delivers:** Graceful offline mode with 72h stale cache serving and "offline" badge in UI, RSS feed error surface in Settings, OPML import dry-run validation UI.
**Addresses:** Graceful offline mode (table stakes), RSS parse error visibility, OPML URL validation UI.

### Phase Ordering Rationale

- Phase 1 before everything else: three `panic!` sites and NFC→NFKC migration affect every downstream feature's testability and correctness.
- Phase 2 before Phase 3: digest parallelization (`join_all`) requires `LlmClient` to be `Send + Sync`, which the Phase 2 audit confirms; also CancellationToken must exist before scheduler tests.
- Phase 3 before Phase 4: LRU eviction uses the periodic cleanup job added in Phase 3's scheduler work.
- Phase 5 deferred (not skipped): writing tests against unfixed behavior produces tests that must be rewritten after fixes — wasteful. Write tests after each fix is confirmed, but group coverage infrastructure setup here.
- Phase 6 last: offline mode requires a `FetchStatus` data-model change that is safest after the collection pipeline is stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (digest parallelization):** Audit whether `OllamaClient` and `PerplexityClient` implement `Sync` before assuming `Arc<dyn LlmClient + Send + Sync>` compiles — need to check trait bound definitions.
- **Phase 3 (personal scoring CTE):** Benchmark the single CTE vs. 5 simple queries with `EXPLAIN QUERY PLAN` before committing — the CTE may regress on a cold cache at current article scale.
- **Phase 6 (offline mode):** `FetchStatus` enum propagation touches collector, scheduler, and frontend event types — scope needs planning before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (WAL mode + sqlx offline):** Both are documented one-line changes with known configurations.
- **Phase 2 (CancellationToken):** tokio-util `CancellationToken` has a fully documented and stable API; pattern is well-established.
- **Phase 5 (test infrastructure):** `@vitest/coverage-v8`, `@testing-library/react`, `sqlx::test` are all documented ecosystem standards with clear setup.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed from `Cargo.lock` and `package-lock.json`; additions are ecosystem standards with no version ambiguity |
| Features | HIGH | All table-stakes and differentiator features confirmed via direct code analysis of identified concern files; no speculation |
| Architecture | HIGH | 4-layer structure, AppState, all component boundaries confirmed from direct file reads; patterns are tokio/SQLite standards |
| Pitfalls | HIGH | All critical pitfalls confirmed at specific line numbers via direct code analysis; only minor pitfalls rely on inferred risk |

**Overall confidence:** HIGH

### Gaps to Address

- **`LlmClient` trait `Sync` bound**: Need to confirm both `OllamaClient` and `PerplexityClient` implement `Sync` before Phase 3 digest parallelization. If not, `+ Sync` must be added to the trait definition and all implementations. Check during Phase 3 planning.
- **`deepdive_cache` migration timing**: Adding `summary_hash` column (Phase 2) requires backfilling `NULL` for existing rows. Treat `NULL` as cache miss in code. Verify migration file numbering does not conflict with any pending migration.
- **`CancellationToken` storage location**: Must be stored as `tauri::State<CancellationToken>` independently, not inside `AppState`, to avoid a circular `Arc` reference. Confirm Tauri `RunEvent::ExitRequested` or `on_window_event(CloseRequested)` is the correct hook for calling `cancel()` in the target Tauri v2 version.
- **NFC→NFKC migration data impact**: After switching normalization, existing `is_duplicate` flags may be wrong. A one-time `UPDATE articles SET is_duplicate = 0` + dedup re-run is required. Plan this as part of a DB migration with rollback instructions.
- **`seconds_until` JST vs OS local time**: The digest scheduler uses `chrono::Local` but comments reference JST. Clarify intended behavior before Phase 2 — affects international users if left ambiguous.

---

## Sources

### Primary (HIGH confidence — direct code analysis)

- `src-tauri/src/lib.rs` — 3 panic sites at lines 37, 51, 178; Tauri setup pattern
- `src-tauri/src/services/scheduler.rs` — serial digest loop, no CancellationToken, no config sync
- `src-tauri/src/services/dedup_service.rs` — `nfc()` at line 79; URL normalization logic
- `src-tauri/src/services/personal_scoring.rs:63-138` — 5 sequential DB queries confirmed
- `src-tauri/src/services/deepdive_service.rs` — `unwrap_or_default()` at line 55; no TTL check
- `src-tauri/src/infra/rate_limiter.rs` — `as u32` truncation at line 47; Mutex across `.await` at lines 54-69
- `src-tauri/src/error.rs` — `AppError::RateLimit` variant exists but unused in rate_limiter
- `src-tauri/Cargo.lock` — all locked Rust dependency versions
- `package.json` / `package-lock.json` — all locked TypeScript dependency versions
- `vitest.config.ts` — `environment: 'node'` confirms V8 coverage backend choice
- `.planning/codebase/CONCERNS.md` — full concern inventory used as ground truth
- `.planning/PROJECT.md` — scope constraints (no new Wings, existing stack)

### Secondary (HIGH confidence — established ecosystem patterns)

- tokio-util `CancellationToken` API — standard tokio shutdown pattern since tokio-util 0.6
- SQLite WAL mode / FTS5 rowid subquery — SQLite official documentation
- `unicode_normalization` crate `nfkc()` — crate documentation, same API as `nfc()`
- `sqlx` offline mode — sqlx README, standard Tauri CI practice
- `@testing-library/react 16.x` — current version supporting React 19
- `cargo-llvm-cov` — de facto Rust coverage standard; Windows support confirmed

### Tertiary (MEDIUM confidence — requires implementation verification)

- Tauri v2 `on_window_event(CloseRequested)` as shutdown hook — pattern confirmed in Tauri v2 docs; exact hook name needs verification against installed Tauri version
- `OllamaClient`/`PerplexityClient` `Sync` bound — assumed given `Arc<reqwest::Client>` internals; must verify at compile time
- personal_scoring CTE query performance vs. 5 simple queries — architecturally correct; benchmark required before committing

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
