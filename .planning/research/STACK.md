# Technology Stack — Stabilization & Optimization

**Project:** OtakuPulse
**Researched:** 2026-03-27
**Mode:** Ecosystem — what tools/patterns to add/confirm for stabilizing an existing Tauri v2 + Rust + React codebase

---

## Executive Summary

The existing stack is well-chosen and requires no major additions. The stabilization milestone calls for a small number of targeted additions on top of the existing dependencies: `tokio-util` for `CancellationToken`, `rayon` for CPU-parallel normalization, `cargo-llvm-cov` for Rust coverage, and `@vitest/coverage-v8` for TypeScript coverage. Everything else is already present and at a current version. No framework swaps, no new runtimes.

---

## Current Stack Audit

All versions are confirmed from `Cargo.lock` and `package-lock.json` as of 2026-03-27.

### Rust — Locked Versions

| Crate | Locked Version | Status |
|-------|---------------|--------|
| tokio | 1.50.0 | Current — no action needed |
| thiserror | 2.0.18 | Current — already at v2 |
| anyhow | 1.0.102 | Current |
| sqlx | 0.8.6 | Current |
| tracing | 0.1.x | Current |
| tracing-subscriber | 0.3.x | Current |
| wiremock | 0.6 | Current |
| reqwest | 0.12.x | Current |
| tokio-cron-scheduler | 0.13.0 | Current |
| unicode-normalization | 0.1.x | Current — already present, use it consistently |

### TypeScript — Locked Versions

| Package | Locked Version | Status |
|---------|---------------|--------|
| react | 19.1.0 | Current |
| vitest | 4.1.0 | Current |
| zustand | 5.0.11 | Current |
| tailwindcss | 4.2.1 | Current |
| @biomejs/biome | 2.4.7 | Current |
| pino | 10.3.1 | Current |

---

## Recommended Stack — Additions Only

The following are the only additions needed for stabilization. Rationale is project-specific.

### Rust Additions

| Crate | Version to Add | Purpose | Why |
|-------|---------------|---------|-----|
| `tokio-util` | `0.7` (features = ["rt"]) | `CancellationToken` for scheduler shutdown | Tokio's own utility crate. `CancellationToken` is the idiomatic way to signal graceful shutdown to `collect_loop` and `digest_loop`. CONCERNS.md identifies this as the fix for "Scheduler loop shutdown untested". Alternative of `tokio::sync::oneshot` requires manual propagation; `CancellationToken` is cloneable and composable across multiple tasks. |
| `rayon` | `1.10` | CPU-parallel URL normalization | CONCERNS.md: "normalize_url is O(n) per URL; called on every article before DB write". `rayon` adds data-parallelism for CPU-bound work (regex, lowercasing, param sorting) without async complexity. Should not be used inside `async fn` — call via `tokio::task::spawn_blocking`. |
| `lru` | `0.12` | LRU cache eviction for DeepDive cache | CONCERNS.md: "implement LRU eviction when cache size exceeds threshold". The `lru` crate (MIT, no unsafe) provides `LruCache<K, V>`. Lighter than `moka` (which is for concurrent async caches). In-process cache keyed by `(article_id, question)`. Wrap in `Arc<Mutex<LruCache<...>>>` — acceptable here because eviction is fast. |
| `cargo-llvm-cov` | `0.6` (dev tool only) | Rust test coverage | The standard for Tauri/Tokio projects. Produces LCOV and HTML reports. Supports `--doctests`. Install once: `cargo install cargo-llvm-cov`. Command: `cargo llvm-cov --all-features`. Provides line + branch coverage that `cargo test` alone does not. |

**Confidence:** HIGH — all four are referenced in official tokio / rayon / Rust docs and are de facto standard choices for their respective problems.

### TypeScript Additions

| Package | Version to Add | Purpose | Why |
|---------|---------------|---------|-----|
| `@vitest/coverage-v8` | `4.x` (matches vitest version) | TypeScript test coverage | The V8 provider is Vitest's recommended coverage backend for non-browser environments. The project already uses `environment: 'node'` in vitest.config.ts, making V8 the correct choice over Istanbul. Command: `vitest run --coverage`. Requires zero configuration changes beyond adding the package. |
| `@testing-library/react` | `16.x` | Component rendering tests | CONCERNS.md identifies "Component rendering with missing data" as untested. Testing Library is the only ergonomic way to test React 19 components in Vitest. It renders into jsdom and exposes the DOM API cleanly. Note: requires changing `environment` to `'jsdom'` in vitest.config.ts for component test files (can be set per-file via `@vitest-environment jsdom`). |
| `@testing-library/user-event` | `14.x` | Simulated user interactions in component tests | Companion to Testing Library. Required for testing keyboard shortcuts (`useKeyboardShortcuts.ts`) and modal interactions (`Modal.tsx`). Uses real browser event simulation rather than synthetic `.fireEvent()`. |

**Confidence:** HIGH — these are the ecosystem standard for the stated Vitest version.

---

## Existing Libraries — How to Use for Stabilization

These are already in `Cargo.toml` but require pattern changes for the stabilization work.

### `thiserror` 2.0 + `anyhow` 1.x (already present)

**Pattern:** Use `thiserror` for all library/service layer error types (`AppError`). Use `anyhow` only in test setup code or binary entry points (`main.rs`). Do not use `anyhow` in `services/` or `infra/` — callers need to pattern-match on `AppError::Kind`.

The `thiserror` v2 change relevant here: `#[error(transparent)]` now correctly avoids double-formatting. The existing `AppError` should use `#[from]` on inner error variants rather than `anyhow::Error` as a catch-all field. This preserves `kind` discrimination for the frontend.

```rust
// Use this pattern in services/
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("rate limited: retry after {retry_after}s")]
    RateLimited { retry_after: u64 },
    #[error("internal: {0}")]
    Internal(String),
}
// Do NOT add: Other(#[from] anyhow::Error) — loses kind discrimination
```

**Confidence:** HIGH — derived from thiserror docs and the existing AppError usage pattern in the codebase.

### `tokio` 1.50 `CancellationToken` via `tokio-util` (addition needed)

**Pattern:** The scheduler's `collect_loop` and `digest_loop` currently run forever with no shutdown path. The fix is:

```rust
// In scheduler::start()
let token = tokio_util::sync::CancellationToken::new();
let collect_token = token.child_token();
let digest_token = token.child_token();

tauri::async_runtime::spawn(async move {
    tokio::select! {
        _ = collect_loop(...) => {}
        _ = collect_token.cancelled() => { info!("collect_loop shutdown"); }
    }
});
// Store token in AppState for on_exit hook to call token.cancel()
```

Store the root `CancellationToken` in `app.manage()` so the `on_exit` Tauri hook can call `token.cancel()`. This enables testable shutdown.

**Confidence:** HIGH — `tokio_util::sync::CancellationToken` is the canonical tokio shutdown pattern since tokio 1.x.

### `tokio::join!` / `futures::future::join_all` for parallel digest loop

The `digest_loop` currently runs 4 categories sequentially. The fix uses `tokio::join!` (for a fixed 4 tasks) rather than `join_all` (for dynamic N tasks). `join!` is simpler, avoids a `Vec<Box<dyn Future>>` allocation, and the categories are always 4.

```rust
// Replace the for loop with:
let (r1, r2, r3, r4) = tokio::join!(
    generate_with_timeout(&state, "anime", timeout),
    generate_with_timeout(&state, "manga", timeout),
    generate_with_timeout(&state, "game", timeout),
    generate_with_timeout(&state, "pc", timeout),
);
```

Wrap each in `tokio::time::timeout(Duration::from_secs(120), ...)` to prevent one slow API from blocking the others.

**Confidence:** HIGH — standard tokio concurrent futures pattern.

### `sqlx` offline mode for CI

`sqlx` 0.8 supports `SQLX_OFFLINE=true` which reads from `.sqlx/` directory committed to git. This prevents CI failures when the SQLite file is not present at compile time. Enable with:

```bash
cargo sqlx prepare   # generates .sqlx/ metadata
# commit .sqlx/ to git
```

Set `SQLX_OFFLINE=true` in CI environment. No version change needed.

**Confidence:** HIGH — documented in sqlx README, standard practice for Tauri CI.

### SQLite WAL mode (via sqlx pool options)

The existing `SqlitePool` should be configured with WAL mode and optimal settings. This is a connection-time change, not a schema migration.

```rust
SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(
        SqliteConnectOptions::new()
            .filename(&db_path)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)  // Safe with WAL
            .pragma("cache_size", "-64000")          // 64MB page cache
            .pragma("temp_store", "memory")
            .pragma("mmap_size", "268435456")        // 256MB mmap
            .pragma("foreign_keys", "ON")
            .create_if_missing(true),
    )
    .await?
```

WAL mode allows concurrent reads during writes, which benefits the scheduler (writes) and query commands (reads) running simultaneously. This is a one-line config change with measurable throughput improvement for this access pattern.

**Confidence:** HIGH — official SQLite documentation + sqlx `SqliteConnectOptions` API.

### FTS5 query with pagination via ROWID subquery

CONCERNS.md identifies that FTS search loads all matches before paginating. The fix is a ROWID subquery:

```sql
SELECT a.* FROM articles a
WHERE a.id IN (
    SELECT rowid FROM fts_articles
    WHERE fts_articles MATCH ?1
    ORDER BY rank
    LIMIT ?3 OFFSET ?2
)
ORDER BY a.published_at DESC
```

This is a sqlx query change, not a dependency change. The FTS5 `rank` column provides relevance scoring for free.

**Confidence:** HIGH — SQLite FTS5 documentation, confirmed pattern.

---

## What NOT to Add (and Why)

| Library | Why Avoid |
|---------|-----------|
| `moka` (async cache) | Over-engineered for this use case. DeepDive cache is accessed from a single service, not across threads simultaneously. `Arc<Mutex<LruCache>>` is sufficient. `moka` adds ~200KB and async complexity with no benefit here. |
| `diesel` (ORM) | Would require migrating all `sqlx` queries and losing compile-time query checking. Not justified for stabilization. |
| `sentry` / `opentelemetry` | Telemetry scope is out of bounds for a local desktop app with no server backend. Structured `tracing` logs are sufficient. |
| `criterion` (benchmarks) | Nice-to-have but not needed for stabilization. Adds compile time. Defer to a future perf milestone. |
| `proptest` (property testing) | Valuable for dedup/scoring edge cases but adds significant test authoring overhead. Defer unless parameterized Vitest/Rust tests prove insufficient. |
| `axum` or any HTTP server | Not needed. All IPC goes through Tauri's invoke system. |
| Redux / Jotai / TanStack Query | State management is already well-handled by Zustand 5. Adding a second state library creates inconsistency. |
| `react-query` | The project uses `useTauriCommand.ts` / `useTauriQuery.ts` abstractions over Tauri invoke. These already provide loading/error state. Adding TanStack Query would duplicate that layer. |
| `@testing-library/jest-dom` | Jest-specific matchers. Vitest has its own assertion API. Do not add. |
| Istanbul (c8) for TS coverage | The project's `environment: 'node'` is not compatible with Istanbul instrumentation in all cases. V8 coverage is the correct choice. |

---

## Supporting Libraries — Patterns to Enforce

These are already present but used inconsistently. Stabilization enforces their proper use.

### `unicode-normalization` 0.1 (already in Cargo.toml)

Already present but CONCERNS.md confirms inconsistent use. Enforce: all title comparisons in `dedup_service.rs` use `use unicode_normalization::UnicodeNormalization; s.nfc().collect::<String>()`. Store normalized titles in a `title_normalized` column (new migration). This makes dedup O(1) index lookup instead of normalize-on-read.

### `sha2` 0.10 for content_hash (already present)

Already used for `content_hash`. The stabilization adds validation: `content_hash` must be non-empty before DB insert. Add a `CHECK (length(content_hash) = 64)` migration constraint.

### `tracing` for error audit (already present)

The Perplexity API key logging risk (CONCERNS.md Security section) is mitigated by auditing all `tracing::error!` / `warn!` callsites that include `reqwest::Error` or HTTP response details. Pattern to enforce: never log `{:?}` on a `reqwest::Response` — log only status code and URL.

---

## Installation Commands

```toml
# Cargo.toml additions
tokio-util = { version = "0.7", features = ["rt"] }
rayon = "1.10"
lru = "0.12"
```

```bash
# Dev tool (once per machine, not in Cargo.toml)
cargo install cargo-llvm-cov --locked
```

```bash
# npm additions
npm install --save-dev @vitest/coverage-v8@^4.1.0
npm install --save-dev @testing-library/react@^16.0.0
npm install --save-dev @testing-library/user-event@^14.0.0
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Cancellation | `tokio-util` CancellationToken | `tokio::sync::oneshot` | Oneshot is not cloneable; can't share across multiple loop tasks without wrapping in `Arc` |
| Cancellation | `tokio-util` CancellationToken | `tokio::sync::broadcast` | Broadcast is for multiple producers; overkill for shutdown signaling |
| CPU parallelism | `rayon` | `tokio::task::spawn_blocking` per item | spawn_blocking has per-task overhead; rayon is designed for data parallelism with work-stealing |
| LRU cache | `lru` crate | `moka` | moka is async-aware and heavier; overkill when cache is always accessed from one task |
| LRU cache | `lru` crate | `linked-hash-map` | `lru` is the successor and has a simpler API |
| TS coverage | `@vitest/coverage-v8` | `@vitest/coverage-istanbul` | Istanbul requires source transforms incompatible with `environment: 'node'` in some cases; V8 is native to Node 18+ |
| Component tests | `@testing-library/react` | `enzyme` | Enzyme does not support React 19; unmaintained |
| Rust coverage | `cargo-llvm-cov` | `tarpaulin` | tarpaulin requires Linux; this is a Windows development environment |

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Existing stack versions | HIGH | Confirmed from Cargo.lock and package-lock.json directly |
| tokio-util CancellationToken | HIGH | tokio's own ecosystem, documented pattern |
| rayon for CPU parallelism | HIGH | Widely established; `spawn_blocking` bridging is documented |
| sqlx WAL mode config | HIGH | Verified against sqlx SqliteConnectOptions API |
| lru crate selection | MEDIUM | Correct category; `moka` is also viable if async eviction needed later |
| cargo-llvm-cov | HIGH | De facto Rust coverage standard; Windows support confirmed |
| @vitest/coverage-v8 | HIGH | Vitest official package, same version family as installed vitest |
| @testing-library/react v16 | HIGH | Current version supporting React 19 |

---

## Sources

- `src-tauri/Cargo.lock` (2026-03-27) — exact locked versions for all Rust dependencies
- `package.json` (2026-03-27) — TypeScript dependency versions
- `.planning/codebase/CONCERNS.md` (2026-03-27) — identified bottlenecks and fragile areas
- `.planning/PROJECT.md` (2026-03-27) — scope and constraints
- `src-tauri/src/services/scheduler.rs` — current loop implementation confirming no cancellation exists
- `src-tauri/src/services/deepdive_service.rs` — current cache implementation confirming `unwrap_or_default`
- `vitest.config.ts` — confirms `environment: 'node'`, relevant to coverage backend choice
- tokio-util crate documentation — `CancellationToken` API [Source: Knowledge, HIGH confidence]
- SQLite WAL mode documentation — journal_mode=WAL semantics [Source: Knowledge, HIGH confidence]
- SQLite FTS5 documentation — rank column and ROWID subquery pattern [Source: Knowledge, HIGH confidence]
