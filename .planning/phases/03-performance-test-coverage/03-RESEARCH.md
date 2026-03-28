# Phase 3: Performance & Test Coverage - Research

**Researched:** 2026-03-28
**Domain:** Rust async performance (tokio::join!, rayon, SQLite query consolidation), Rust test patterns (cargo-llvm-cov), TypeScript hook testing (Vitest + @testing-library/react)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Rust バックエンド優先で実装する。コアロジック（dedup, rate_limiter, scheduler, personal_scoring）のテストを先に固め、TS hook/コンポーネントテストは後半で実施

**D-02:** Phase 2 成果物もテスト対象に含める。ユニットテスト中心で、CancellationToken 発火テスト、ホットリロード event テスト、オフラインフォールバックテストなどを追加

**D-03:** 20+ ケースの包括的 dedup テストスイートを作成。Unicode 正規化エッジケース（絵文字、CJK 互換文字、ゼロ幅スペース）、URL バリエーション、content_hash 衝突、Jaccard 類似度境界値を全てカバー

**D-04:** アサーションベースのアプローチを採用。Testing Library で「エラーメッセージが表示される」「画像が fallback になる」など振る舞いを検証。スナップショットテストは使用しない

**D-05:** cargo-llvm-cov と @vitest/coverage-v8 を導入し、ローカルでレポート生成可能にする。閾値設定や CI 連携は本フェーズでは行わない

**D-06:** tokio::join! で4カテゴリを並列実行する。1カテゴリが失敗した場合は部分成功を許容し、失敗カテゴリはログしてスキップ、他カテゴリは正常にダイジェスト生成を続行

**D-07:** カテゴリ毎にタイムアウトを設定する（値は Claude 裁量）

**D-08:** ベンチマークツール（criterion 等）は導入しない。テスト内アサーションで「N+1 が解消された」「並列実行された」ことを検証する

### Claude's Discretion

- PERF-03: personal_scoring の LEFT JOIN クエリの具体的な SQL 設計
- PERF-04: FTS サブクエリ内 LIMIT/OFFSET の実装方式
- PERF-05: highlights の GROUP BY クエリ設計
- PERF-06: rayon 並列化のバッチサイズと適用閾値
- PERF-02: カテゴリ毎タイムアウト値
- Phase 2 テストの具体的なテストケース設計

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-02 | digest_loop の4カテゴリ処理を tokio::join! で並列化し、カテゴリ毎にタイムアウトを設定する | tokio::join! / tokio::time::timeout patterns confirmed |
| PERF-03 | personal_scoring の3回の DB クエリを1回の LEFT JOIN クエリに統合する | batch_interaction_bonuses confirmed: 3+ queries → 1 CTE query |
| PERF-04 | FTS 検索にサブクエリ内 LIMIT/OFFSET を追加し、全件メモリロードを回避する | fts_queries.rs confirmed: no pagination in FTS scan path |
| PERF-05 | highlights の N+1 クエリを GROUP BY + 単一クエリに書き換える | get_trending_keywords confirmed: single query already; re-scoped to highlights_service single query consolidation |
| PERF-06 | URL 正規化を rayon::par_iter() で並列化する（500+ 記事のフィード向け） | rayon not yet in Cargo.toml; needs to be added |
| TEST-01 | dedup_service の包括テストスイートを作成する（20+ ケース） | dedup_service.rs has 10 existing tests; need 10+ more cases |
| TEST-02 | rate_limiter のストレステストを作成する（並行リクエスト, 429 ハンドリング, トークン枯渇） | rate_limiter_tests.rs exists with 5 tests; need concurrent/stress cases |
| TEST-03 | scheduler の CancellationToken によるシャットダウンテストを作成する | CancellationToken confirmed as tokio_util::sync::CancellationToken |
| TEST-04 | personal_scoring のエッジケーステストを作成する（空プロフィール, 72h 超記事, ボーナス上限） | personal_scoring.rs has basic tests; edge cases missing |
| TEST-05 | TypeScript hook（useTauriCommand, useTauriQuery）のエラーハンドリングテストを作成する | hooks exist; src/test/hooks/ is empty; @testing-library/react NOT installed |
| TEST-06 | React コンポーネントの部分データレンダリングテストを作成する（null サマリー, 画像ロード失敗） | @testing-library/react NOT installed; needs jsdom env config |
| TEST-07 | cargo-llvm-cov と @vitest/coverage-v8 によるカバレッジインフラを導入する | @vitest/coverage-v8 4.1.2 available; cargo-llvm-cov 0.8.5 available |
</phase_requirements>

---

## Summary

Phase 3 has two parallel tracks: **performance optimizations** (PERF-02 through PERF-06) that target five identified bottlenecks in the Rust backend, and **test coverage** (TEST-01 through TEST-07) that builds a comprehensive test suite for both Rust and TypeScript.

The performance work is straightforward Rust async/SQL refactoring. The digest parallelization (PERF-02) replaces a serial `for` loop with `tokio::join!` and `tokio::time::timeout`. The DB query consolidations (PERF-03, PERF-05) replace multiple sequential queries with single CTE/GROUP BY queries. FTS pagination (PERF-04) adds a subquery-based LIMIT/OFFSET to avoid loading all matches into memory. URL normalization parallelization (PERF-06) requires adding `rayon` to Cargo.toml as a new dependency.

The test coverage work has a **critical gap**: `@testing-library/react` is not installed and `vitest.config.ts` uses `environment: 'node'`, which means React component tests (TEST-05, TEST-06) require installing `@testing-library/react`, `@testing-library/user-event`, `jsdom` (or `happy-dom`), and switching the vitest environment to `jsdom` for the hooks/components test files. This must be addressed in Wave 0. The Rust test work (TEST-01 through TEST-04) builds on the existing `#[tokio::test]` + in-memory SQLite infrastructure and requires no new dependencies.

**Primary recommendation:** Address the missing `@testing-library/react` + jsdom environment setup as the first task of the TypeScript test track; all React component and hook behavior tests depend on it.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio | 1.x (in Cargo.toml) | Async runtime: join!, timeout, spawn | Already in project; the right tool for async parallelism |
| rayon | 1.x (to be added) | CPU-parallel iterator for URL normalization | Standard Rust data-parallelism library |
| cargo-llvm-cov | 0.8.5 | Rust source-based coverage (LLVM) | Official recommended for Rust coverage |
| @vitest/coverage-v8 | 4.1.2 | TypeScript/React test coverage | Matches vitest 4.1.2 already in project |
| @testing-library/react | 16.x | React component behavior testing | Required for TEST-05, TEST-06 per D-04 |
| jsdom | 25.x | Browser DOM simulation for Vitest | Required for @testing-library/react |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | 14.x | Simulate user interactions in tests | When testing click/type events in components |
| tokio_util::sync::CancellationToken | 0.7 (in Cargo.toml as tokio-util) | Cancellable async tasks | TEST-03 scheduler shutdown tests |
| wiremock | 0.6 (already in dev-deps) | HTTP mock server | TEST-02 rate limiter 429 simulation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rayon par_iter | tokio::task::spawn_blocking | rayon is better for CPU-bound batch work; spawn_blocking for single heavy ops |
| jsdom | happy-dom | happy-dom is faster but less complete browser API coverage |
| @testing-library/react | renderHook from vitest | Testing Library is the standard per D-04 decision |

**Installation:**
```bash
# Rust — add to Cargo.toml [dependencies]
# rayon = "1"
# Rust — install cargo-llvm-cov tool
cargo install cargo-llvm-cov

# TypeScript — coverage + component testing
npm install --save-dev @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
```

**Version verification:** `npm view @vitest/coverage-v8 version` → 4.1.2; `cargo search cargo-llvm-cov` → 0.8.5

---

## Architecture Patterns

### PERF-02: Digest Parallelization with tokio::join!

**What:** Replace the serial `for category in &["anime", "manga", "game", "pc"]` loop in `scheduler.rs` lines 225-256 with `tokio::join!` + per-category `tokio::time::timeout`.

**When to use:** When 4 independent async operations each involve network I/O (LLM API calls) and can proceed concurrently without shared mutable state.

**Pattern:**
```rust
// Source: tokio docs — tokio::time::timeout wraps a future with a deadline
let timeout_secs = 120; // 2 minutes per category (recommended value)
let (r_anime, r_manga, r_game, r_pc) = tokio::join!(
    tokio::time::timeout(Duration::from_secs(timeout_secs), generate_category(&state, &llm_client, "anime")),
    tokio::time::timeout(Duration::from_secs(timeout_secs), generate_category(&state, &llm_client, "manga")),
    tokio::time::timeout(Duration::from_secs(timeout_secs), generate_category(&state, &llm_client, "game")),
    tokio::time::timeout(Duration::from_secs(timeout_secs), generate_category(&state, &llm_client, "pc")),
);
```

**Timeout value reasoning:** LLM API (Perplexity or Ollama) for a digest can take 30-90 seconds. 120 seconds gives enough headroom without holding the loop indefinitely. Per D-07, this value is Claude's discretion.

**Partial success handling:** Each `tokio::time::timeout` result is `Result<Result<DigestResult, AppError>, Elapsed>`. Log and skip on either error; continue saving successful results.

**Critical constraint:** `build_scheduler_llm_client` reads an `RwLock<LlmSettings>` synchronously — call it once before `tokio::join!` and pass `Arc<dyn LlmClient + Send + Sync>` to each branch. The `LlmClient` trait already declares `Send + Sync`, so `Arc<Box<dyn LlmClient>>` compiles (confirmed in `src-tauri/src/infra/llm_client.rs`).

```rust
// Helper to extract from Box<dyn LlmClient>
let llm_client: Arc<dyn LlmClient + Send + Sync> = Arc::from(build_scheduler_llm_client(&state)?);
```

### PERF-03: personal_scoring Query Consolidation

**What:** Replace the 3+ sequential queries in `batch_interaction_bonuses` (lines 66-135 in `personal_scoring.rs`) with a single CTE query.

**Current state:** 5 separate queries: bookmarked articles, deepdived articles, feed open rates (requires 2 queries: feed_rates + feed_articles), global avg dwell, per-article avg dwell.

**Pattern — single CTE approach:**
```sql
WITH
  bookmarks AS (
    SELECT id AS article_id, 3.0 AS bonus FROM articles WHERE is_bookmarked = 1 AND is_duplicate = 0
  ),
  deepdives AS (
    SELECT DISTINCT article_id, 1.0 AS bonus FROM article_interactions WHERE action = 'deepdive'
  ),
  dwell_stats AS (
    SELECT article_id,
           AVG(dwell_seconds) AS avg_dwell,
           (SELECT AVG(dwell_seconds) FROM article_interactions WHERE dwell_seconds > 0) AS global_avg
    FROM article_interactions WHERE dwell_seconds > 0 GROUP BY article_id
  ),
  feed_engagement AS (
    SELECT a.id AS article_id,
           CAST(SUM(CASE WHEN ai.action = 'open' THEN 1 ELSE 0 END) AS REAL)
           / CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END * 1.5 AS bonus
    FROM articles a
    JOIN article_interactions ai ON ai.article_id = a.id
    WHERE a.is_duplicate = 0
    GROUP BY a.id
  )
SELECT
  a.id AS article_id,
  COALESCE(b.bonus, 0.0) + COALESCE(d.bonus, 0.0) + COALESCE(fe.bonus, 0.0)
  + CASE WHEN ds.avg_dwell > ds.global_avg
         THEN MIN((ds.avg_dwell - ds.global_avg) / 30.0 * 0.5, 2.0)
         ELSE 0.0 END AS total_bonus
FROM articles a
LEFT JOIN bookmarks b ON b.article_id = a.id
LEFT JOIN deepdives d ON d.article_id = a.id
LEFT JOIN dwell_stats ds ON ds.article_id = a.id
LEFT JOIN feed_engagement fe ON fe.article_id = a.id
WHERE a.is_duplicate = 0
ORDER BY a.published_at DESC LIMIT ?
```

**Validation approach (per D-08):** Add a test that counts `sqlx::query` call count is 1 by injecting a counter pool wrapper, or verify output equality between old (3-query) and new (1-query) implementations with the same seed data.

### PERF-04: FTS Pagination via Subquery

**What:** The current `search_articles` in `fts_queries.rs` does `LIMIT ?` on the outer query, but the FTS5 MATCH scan happens before the LIMIT is applied, meaning all matches are evaluated. The fix adds OFFSET support and uses a subquery to limit the rowids before the JOIN.

**Current code:** `JOIN articles_fts fts ON a.id = fts.rowid WHERE articles_fts MATCH ? ORDER BY rank LIMIT ?`

**Pattern:**
```sql
SELECT a.id, a.feed_id, a.title, a.url, a.summary, a.author,
       a.published_at, a.importance_score, a.is_read, a.is_bookmarked,
       a.language, a.thumbnail_url, f.name as feed_name
FROM articles a
JOIN feeds f ON a.feed_id = f.id
WHERE a.id IN (
    SELECT rowid FROM articles_fts
    WHERE articles_fts MATCH ?
    ORDER BY rank
    LIMIT ? OFFSET ?
)
ORDER BY a.published_at DESC
```

**Note:** The subquery with `LIMIT ? OFFSET ?` directly on the FTS virtual table restricts the scan. The outer query then only fetches the matched article rows. Add `offset: i64` parameter to `search_articles` (default 0).

### PERF-05: Highlights Single-Query Consolidation

**What:** The current `highlights_service.rs::get_daily_highlights` already uses a single query for the top 5 articles. The PERF-05 requirement targets the `get_trending_keywords` path which loads 500 titles then processes in Rust. The consolidation moves word-frequency counting to SQL using a simplified approach, or alternatively the existing implementation is already near-optimal for SQLite. Research indicates that SQLite has no native word-tokenization function.

**Recommendation:** `get_trending_keywords` cannot be replaced with pure SQL because SQLite has no built-in word tokenizer. The existing single-query + Rust processing is already optimal. **PERF-05 should be implemented as follows:** The actual N+1 to fix is in `highlights_service.rs::batch_generate_summaries` which loops over articles and calls `llm.complete()` per article — this is intentional and not a DB N+1. The correct interpretation of PERF-05 is confirming the highlights query is a single GROUP BY query, which it already is for `get_daily_highlights`. Add a test asserting single-query behavior and document that the implementation is already correct.

**Confidence:** MEDIUM — the CONCERNS.md description of PERF-05 ("for each highlighted keyword, fetch articles") does not match the current `highlights_service.rs` implementation. The implementation may have been updated in Phase 1 or the CONCERNS.md was written against a different version. The planner should verify current code before implementing PERF-05.

### PERF-06: URL Normalization with rayon

**What:** `normalize_url` and `normalize_title` are pure CPU-bound functions currently called in a serial loop during `collect_feed`. Applying `rayon::par_iter()` parallelizes the batch.

**rayon is NOT yet in Cargo.toml** — must be added as a dependency.

**Pattern:**
```rust
// In Cargo.toml [dependencies]: rayon = "1"
use rayon::prelude::*;

// In collector.rs where articles Vec is built:
let normalized_articles: Vec<_> = articles.par_iter()
    .map(|a| Article {
        url_normalized: Some(normalize_url(&a.url.as_deref().unwrap_or(""))),
        ..a.clone()
    })
    .collect();
```

**Threshold per D-06 (Claude's discretion):** Apply `par_iter` when `articles.len() >= 50`. For smaller batches, serial is faster due to rayon thread pool overhead. Implement as: `if articles.len() >= 50 { par_iter } else { iter }`.

**Constraint:** `normalize_url` and `normalize_title` are already pure functions with no shared mutable state — safe for rayon. Verify no `Arc<Mutex<_>>` or thread-local state in their implementations (confirmed: they are pure string transformations).

### TEST-01: dedup_service Comprehensive Test Suite

**What:** Expand `dedup_service.rs` inline tests from 10 to 20+ cases.

**Existing coverage (10 tests):** tracking param removal, http→https, fragment removal, title normalization with Japanese symbols, Jaccard identical/similar/different/empty, content hash length, NFKC half-width katakana, NFKC full-width ASCII, URL param order independence, tracking params removed.

**Missing cases to add (14+):**
1. Zero-width space in title (`\u{200B}`)
2. CJK compatibility ideographs (`\u{FA30}` → NFKC normalizes to `\u{6328}`)
3. Emoji in title (should not crash, preserves emoji after normalization)
4. Combining diacritics (é as `e\u{301}` vs precomposed `\u{E9}`)
5. Jaccard boundary: exactly at 0.8 threshold
6. Jaccard with single-character strings (bigrams = empty set)
7. Content hash: empty string
8. Content hash: >200 character truncation (NFKC applied before truncation)
9. URL with no query params (no `?` added)
10. URL with only tracking params (all removed, no `?` appended)
11. URL with trailing slash at root (https://example.com/ → no pop since length <= 8)
12. URL with uppercase scheme (HTTP:// → https://)
13. URL with mixed-case host (EXAMPLE.COM → example.com)
14. `normalize_url` on empty string

**File location:** Add to existing `#[cfg(test)] mod tests` block in `src-tauri/src/services/dedup_service.rs`

### TEST-02: rate_limiter Stress Tests

**What:** Add concurrent stress tests to `src-tauri/src/infra/rate_limiter_tests.rs`.

**Missing cases:**
1. Concurrent acquire: spawn N tasks simultaneously, verify exactly `max_tokens` succeed and rest fail
2. 429 retry-after: `update_from_response` with 429 → subsequent `acquire()` returns RateLimit error
3. Token depletion: drain all tokens, wait refill, confirm exactly 1 new token available
4. `update_from_response` with non-429 status (should not set retry_after)
5. Concurrent refill race: multiple tasks calling `refill_tokens` at same time (no double-refill)

**Pattern for concurrent test:**
```rust
#[tokio::test]
async fn test_concurrent_acquire_respects_limit() {
    let limiter = Arc::new(TokenBucket::new(5, 0.0, 0)); // no refill, no interval
    let handles: Vec<_> = (0..10).map(|_| {
        let l = limiter.clone();
        tokio::spawn(async move { l.acquire().await })
    }).collect();
    let results = futures::future::join_all(handles).await;
    let successes = results.iter().filter(|r| r.as_ref().unwrap().is_ok()).count();
    assert_eq!(successes, 5);
}
```

### TEST-03: Scheduler CancellationToken Shutdown Test

**What:** Test that `collect_loop` and `digest_loop` exit cleanly when `CancellationToken::cancel()` is called.

**Pattern:**
```rust
#[tokio::test]
async fn test_cancellation_token_exits_collect_loop() {
    let token = CancellationToken::new();
    let token_clone = token.clone();
    // spawn the loop
    let handle = tokio::spawn(async move {
        // simplified loop body with tokio::select! on token
        token_clone.cancelled().await;
    });
    token.cancel();
    tokio::time::timeout(Duration::from_secs(1), handle).await
        .expect("loop did not exit within 1 second")
        .unwrap();
}
```

**Note:** The full `collect_loop` and `digest_loop` in `scheduler.rs` require `AppHandle` (Tauri) and `AppState` which cannot be easily constructed in unit tests. The test should extract the cancellable core logic into a testable helper, or test the `tokio::select!` pattern in isolation.

### TEST-04: personal_scoring Edge Case Tests

**What:** Add tests to `personal_scoring.rs` for the edge cases.

**Missing cases:**
1. Empty `favorite_titles`, `favorite_genres`, `favorite_creators` → `calc_personal_score` returns 0.0
2. `calc_base_score` with None published_at → returns 0.3
3. `calc_base_score` with 73h-old article → returns 0.05 (not 0.1)
4. `calc_base_score` with unparseable date string → returns 0.3
5. Interaction bonus: dwell_bonus cap at `DWELL_BONUS_CAP = 2.0`
6. `rescore_all` with empty DB (no articles) → returns Ok(0)

### TEST-05 & TEST-06: TypeScript Hooks and Component Tests

**Critical setup requirement:**

The current `vitest.config.ts` uses `environment: 'node'`. React component/hook tests require browser DOM APIs (`document`, `window`). Must:

1. Install: `npm install --save-dev @testing-library/react @testing-library/user-event jsdom`
2. Configure per-file environment override OR create a separate vitest config for component tests

**Recommended approach — inline environment comment (Vitest 0.34+):**
```typescript
// src/test/hooks/useTauriCommand.test.ts
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
```

This avoids changing the global `vitest.config.ts` environment which would break existing `node`-environment tests.

**Alternative:** Add `environmentMatchGlobs` to `vitest.config.ts`:
```typescript
// vitest.config.ts
test: {
  environmentMatchGlobs: [
    ['src/test/hooks/**', 'jsdom'],
    ['src/test/components/**', 'jsdom'],
  ]
}
```

**TEST-05 hook test pattern:**
```typescript
// src/test/hooks/useTauriCommand.test.ts
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core'; // aliased to mock

it('sets error string from plain object AppError', async () => {
  vi.mocked(invoke).mockRejectedValueOnce({ kind: 'Http', message: 'timeout' });
  const { result } = renderHook(() => useTauriCommand('some_command'), { wrapper: ToastProvider });
  await act(async () => { await result.current.execute(); });
  expect(result.current.error).toBe('[object Object]'); // Current behavior — String(plainObj)
});
```

**Key finding:** The current `useTauriCommand.ts` error handling uses `e instanceof Error ? e.message : String(e)`. For Tauri plain object errors `{ kind: 'Http', message: 'timeout' }`, `String(e)` returns `[object Object]` which loses the error details. This is the bug TEST-05 should verify and potentially fix — the correct handling should use `JSON.stringify(e)` or extract `.message` from the plain object (as documented in `.claude/rules/tauri-v2-gotchas.md`).

**TEST-06 component test pattern:**
```typescript
// src/test/components/CardSummary.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { CardSummary } from '../../components/discover/CardSummary';

it('shows loading placeholder when summary is null', () => {
  render(<CardSummary summary={null} isLoading={false} />);
  expect(screen.queryByRole('img')).toBeNull();
});
```

### TEST-07: Coverage Infrastructure

**cargo-llvm-cov setup:**
```toml
# Cargo.toml [dev-dependencies] (already has wiremock + http)
# No dev-dependency needed — cargo-llvm-cov is a cargo subcommand tool
```

```bash
# Install once
cargo install cargo-llvm-cov
# Run coverage
cargo llvm-cov --html --output-dir coverage/
cargo llvm-cov --summary-only
```

**@vitest/coverage-v8 setup:**
```typescript
// vitest.config.ts — add coverage config
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/test/**', 'src/vite-env.d.ts'],
  }
}
```

```bash
# package.json scripts already has: "test:coverage": "vitest run --coverage"
# After installing @vitest/coverage-v8, this command will work
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPU-parallel batch processing | Custom thread pool | rayon | rayon's work-stealing scheduler handles load balancing automatically |
| Async task joining | Manual JoinHandle tracking + await | tokio::join! | join! is zero-overhead and more readable than managing handles |
| Per-future timeout | Busy-wait loop | tokio::time::timeout | OS-level timer; no CPU waste |
| LLVM-based coverage | Custom instrumentation | cargo-llvm-cov | Accurate source-based coverage (not estimate) |
| DOM environment for tests | Manual DOM mocking | jsdom + @testing-library | Standard approach with full browser API support |

**Key insight:** The tokio runtime already powers this project's async code. `tokio::join!` and `tokio::time::timeout` are in `tokio::time` which is already enabled in `Cargo.toml` with `features = ["time"]` (confirmed: `tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }`).

---

## Common Pitfalls

### Pitfall 1: Box<dyn LlmClient> is not Clone — breaks tokio::join!

**What goes wrong:** `build_scheduler_llm_client` returns `Box<dyn LlmClient>`. Passing it to multiple branches of `tokio::join!` requires moving it into each branch, which is impossible without cloning.

**How to avoid:** Wrap in `Arc<dyn LlmClient + Send + Sync>` before the join:
```rust
let llm: Arc<dyn LlmClient + Send + Sync> = Arc::from(build_scheduler_llm_client(&state)?);
let llm2 = Arc::clone(&llm);
let llm3 = Arc::clone(&llm);
let llm4 = Arc::clone(&llm);
tokio::join!(gen(Arc::clone(&llm), "anime"), gen(llm2, "manga"), ...);
```

**Warning signs:** Compiler error "cannot move out of `llm` because it is not `Copy`"

### Pitfall 2: rayon inside tokio::spawn panics

**What goes wrong:** Calling rayon functions directly inside `async fn` can deadlock or panic if rayon's thread pool blocks the tokio executor.

**How to avoid:** URL normalization (PERF-06) happens in `collector.rs` which is already inside a `tokio::spawn`. Use `tokio::task::spawn_blocking` to call the rayon batch:
```rust
let normalized = tokio::task::spawn_blocking(move || {
    articles.par_iter().map(|a| normalize_url(...)).collect::<Vec<_>>()
}).await?;
```

Or, simpler: since `normalize_url` is fast (microseconds per URL), just use rayon directly in the non-async normalization path — rayon does not block the async executor for CPU-bound work as long as you don't `.await` inside rayon closures.

**Warning signs:** Tokio warning "task is blocking the async runtime"

### Pitfall 3: FTS subquery OFFSET semantics in SQLite

**What goes wrong:** `LIMIT ? OFFSET ?` on FTS5 virtual tables uses rank-based offset, not rowid-based. This is correct for pagination but the `ORDER BY rank` inside the subquery must be consistent with the outer query ordering.

**How to avoid:** Keep `ORDER BY rank` inside the subquery for FTS5. The outer query can re-sort by `published_at` or `total_score`:
```sql
WHERE a.id IN (
    SELECT rowid FROM articles_fts WHERE articles_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?
)
ORDER BY a.published_at DESC  -- independent re-sort after retrieval
```

**Warning signs:** Test returning results in unexpected order after adding pagination

### Pitfall 4: vitest `environment: 'node'` breaks renderHook

**What goes wrong:** `@testing-library/react` requires `document` global. Without jsdom environment, `renderHook` throws "document is not defined".

**How to avoid:** Use `// @vitest-environment jsdom` at the top of each hook/component test file, or configure `environmentMatchGlobs` in `vitest.config.ts`. Do NOT change the global `environment` to `jsdom` — this would break existing store/lib tests that don't need DOM.

**Warning signs:** `ReferenceError: document is not defined` in hook test output

### Pitfall 5: useTauriCommand error handling loses AppError structure

**What goes wrong:** Current code: `const msg = e instanceof Error ? e.message : String(e)`. Tauri plain-object errors `{ kind: 'Http', message: 'timeout' }` produce `String(e)` = `"[object Object]"`, losing the error details.

**How to avoid:** The test (TEST-05) should BOTH verify the current behavior AND potentially fix it:
```typescript
// Correct extraction for Tauri AppError plain objects
const msg = typeof e === 'object' && e !== null && 'message' in e
  ? (e as { message: string }).message
  : JSON.stringify(e);
```

**Warning signs:** Tests passing but error messages showing "[object Object]" in the UI

### Pitfall 6: cargo-llvm-cov requires LLVM toolchain

**What goes wrong:** `cargo-llvm-cov` requires the LLVM toolchain component. On Windows, this may not be installed by default.

**How to avoid:**
```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
```

**Warning signs:** `cargo llvm-cov` errors with "llvm-tools not found"

---

## Code Examples

### tokio::join! with timeout (PERF-02)
```rust
// Source: tokio docs https://docs.rs/tokio/latest/tokio/macro.join.html
use tokio::time::{timeout, Duration};
let (r1, r2, r3, r4) = tokio::join!(
    timeout(Duration::from_secs(120), generate_digest(&state, &llm, "anime")),
    timeout(Duration::from_secs(120), generate_digest(&state, &llm2, "manga")),
    timeout(Duration::from_secs(120), generate_digest(&state, &llm3, "game")),
    timeout(Duration::from_secs(120), generate_digest(&state, &llm4, "pc")),
);
for (cat, result) in [("anime", r1), ("manga", r2), ("game", r3), ("pc", r4)] {
    match result {
        Ok(Ok(digest)) => save_and_notify(&state, &app_handle, cat, digest).await,
        Ok(Err(e)) => warn!(category=cat, error=%e, "digest generation failed"),
        Err(_) => warn!(category=cat, "digest generation timed out"),
    }
}
```

### rayon par_iter (PERF-06)
```rust
// Source: rayon docs https://docs.rs/rayon/latest/rayon/
use rayon::prelude::*;
const RAYON_THRESHOLD: usize = 50;
let urls: Vec<String> = if raw_urls.len() >= RAYON_THRESHOLD {
    raw_urls.par_iter().map(|u| normalize_url(u)).collect()
} else {
    raw_urls.iter().map(|u| normalize_url(u)).collect()
};
```

### vitest renderHook with jsdom (TEST-05)
```typescript
// Source: @testing-library/react docs https://testing-library.com/docs/react-testing-library/api
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
const { result } = renderHook(() => useTauriCommand('cmd'), { wrapper: ToastProvider });
await act(async () => { await result.current.execute({}); });
expect(result.current.isLoading).toBe(false);
```

### cargo-llvm-cov HTML report
```bash
# Source: cargo-llvm-cov README https://github.com/taiki-e/cargo-llvm-cov
cargo llvm-cov --html --output-dir target/llvm-cov/
# Open: target/llvm-cov/index.html
cargo llvm-cov --summary-only  # text summary to stdout
```

---

## Runtime State Inventory

> Not applicable — this is a code-only optimization and test coverage phase. No data migration, no stored state changes, no OS-level registrations affected.

**None found in any category:** This phase modifies SQL queries (in-code, not schema), adds Cargo.toml dependencies, and adds test files. No migration scripts needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cargo-llvm-cov | TEST-07 | Not installed (tool) | 0.8.5 latest | None — must install |
| llvm-tools-preview | cargo-llvm-cov | Unknown | varies | `rustup component add llvm-tools-preview` |
| @vitest/coverage-v8 | TEST-07 | Not installed (npm devDep) | 4.1.2 | None — must install |
| @testing-library/react | TEST-05, TEST-06 | Not installed | 16.x | None — must install |
| @testing-library/user-event | TEST-06 | Not installed | 14.x | Optional for TEST-06 |
| jsdom | TEST-05, TEST-06 | Not installed | 25.x | happy-dom (lighter, less complete) |
| rayon | PERF-06 | Not in Cargo.toml | 1.x | None — must add |
| tokio::time::timeout | PERF-02 | Available (in tokio features) | 1.x | N/A |
| tokio_util::CancellationToken | TEST-03 | Available (tokio-util 0.7 in Cargo.toml) | 0.7 | N/A |
| wiremock | TEST-02 | Available (in dev-dependencies) | 0.6 | N/A |

**Missing with no fallback:** cargo-llvm-cov (install as tool), @vitest/coverage-v8 (npm devDep), @testing-library/react (npm devDep), jsdom (npm devDep), rayon (Cargo.toml dep)
**Missing with fallback:** happy-dom as alternative to jsdom (less complete but faster)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serial category loop in digest | tokio::join! parallel | Phase 3 (this phase) | ~4x speed for digest generation |
| 5+ separate DB queries for scoring | Single CTE LEFT JOIN | Phase 3 | Fewer round-trips, DB does aggregation |
| FTS loads all matches | Subquery LIMIT/OFFSET | Phase 3 | O(limit) memory instead of O(total_matches) |
| NFC normalization | NFKC (Phase 1) | Phase 1 | Already done; tests should verify |
| u32 token counting | f64 token counting (Phase 1) | Phase 1 | Already done; tests should verify |

**Deprecated/outdated:**
- `for category in &[...]` serial loop in `digest_loop`: replaced by `tokio::join!` in PERF-02
- Multiple `batch_interaction_bonuses` sequential queries: replaced by CTE in PERF-03

---

## Open Questions

1. **PERF-05 scope ambiguity** — What we know: `get_daily_highlights` and `get_trending_keywords` both use single queries currently. The CONCERNS.md describes an N+1 for "keyword-based article fetching" which doesn't match current code. What's unclear: Whether PERF-05 refers to a different code path, or whether the current implementation already satisfies it. Recommendation: Verify `highlights_service.rs` against the PERF-05 success criteria before planning the task; if already satisfied, write a regression test asserting single-query behavior.

2. **rayon + Tauri CDylib compatibility** — What we know: rayon spawns OS threads via its global thread pool. Tauri apps build as cdylib. What's unclear: Whether rayon's thread pool initialization is safe in a cdylib context on all platforms (Windows/macOS/Linux). Recommendation: Add rayon as a dependency and run `cargo check` before writing rayon code; this is LOW risk (rayon is widely used in Tauri apps) but should be verified.

3. **TEST-05 fix vs. verify** — What we know: `useTauriCommand` uses `String(e)` for plain objects which produces "[object Object]". What's unclear: Whether TEST-05 should ONLY document current behavior or also fix the bug. Recommendation: Fix the bug as part of TEST-05 (it's a one-line change to extract `.message` from AppError objects), since the purpose of the test is to "demonstrate that invoke errors surface as typed AppError shapes".

4. **test_helpers.rs missing tables for Phase 2** — What we know: `setup_test_db()` in `test_helpers.rs` creates tables up to `deepdive_cache`. What's unclear: Whether Phase 2 migrations added new tables (e.g., for offline mode, provider guard) that are not in `setup_test_db`. Recommendation: Check `src-tauri/migrations/` for migrations after `007_*` and update `test_helpers.rs` accordingly.

---

## Sources

### Primary (HIGH confidence)
- Codebase read: `src-tauri/src/services/scheduler.rs` — confirmed serial digest loop location (lines 225-256)
- Codebase read: `src-tauri/src/services/personal_scoring.rs` — confirmed 5+ sequential DB queries in `batch_interaction_bonuses`
- Codebase read: `src-tauri/src/services/fts_queries.rs` — confirmed no OFFSET parameter, LIMIT is on outer query
- Codebase read: `src-tauri/src/services/dedup_service.rs` — confirmed 10 existing tests, identified 14 missing cases
- Codebase read: `src-tauri/src/infra/rate_limiter.rs` + `rate_limiter_tests.rs` — confirmed current test coverage
- Codebase read: `src-tauri/src/infra/llm_client.rs` — confirmed `LlmClient: Send + Sync` (resolves STATE.md blocker)
- Codebase read: `src-tauri/Cargo.toml` — confirmed tokio features, rayon absent, tokio-util present
- Codebase read: `vitest.config.ts` — confirmed `environment: 'node'`, no coverage config
- Codebase read: `package.json` — confirmed `@testing-library/react` not installed
- `cargo search cargo-llvm-cov` — confirmed version 0.8.5
- `npm view @vitest/coverage-v8 version` — confirmed version 4.1.2 (matches vitest 4.1.2)

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md` — performance bottleneck analysis (written 2026-03-27)
- `.planning/codebase/TESTING.md` — test patterns and infrastructure documentation
- `.claude/rules/rust-perf.md` — rayon usage guidance (spawn_blocking rule)
- `.claude/rules/tauri-v2-gotchas.md` — plain object error handling confirmation

### Tertiary (LOW confidence)
- rayon cdylib compatibility: based on project experience pattern (widely used, unverified for this specific Tauri version)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified via npm/cargo commands
- Architecture: HIGH — patterns derived from reading actual source files
- Pitfalls: HIGH — derived from reading actual code + project rules
- PERF-05 scope: MEDIUM — CONCERNS.md description doesn't match current code

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable tech stack; no fast-moving dependencies)
