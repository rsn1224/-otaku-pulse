# Testing Patterns

**Analysis Date:** 2026-03-27

## Test Framework

**TypeScript/React:**
- Runner: **Vitest** v3.x (configured in `vitest.config.ts`)
- Assertion Library: Vitest built-in `expect()`
- Run Commands:
  - `npm run test` — run all tests once
  - `npm run test:coverage` — run with coverage report
  - Config: `src/test/**/*.test.ts` pattern

**Rust:**
- Runner: **cargo test** (standard Rust test framework)
- Assertion: `assert!`, `assert_eq!`, `assert_ne!` macros
- Test modules embedded in source files with `#[cfg(test)]` attribute
- Async tests use `#[tokio::test]` macro
- Example: `src-tauri/src/parsers/rss_parser_tests.rs` uses standard Rust `#[test]`

## Test File Organization

**TypeScript:**
- Location: Separate directory `src/test/` (NOT co-located with source)
- Subdirectories mirror source structure:
  - `src/test/lib/` — tests for `src/lib/`
  - `src/test/stores/` — tests for `src/stores/`
  - `src/test/hooks/` — tests for `src/hooks/`
- Naming: `{module}.test.ts` pattern (e.g., `textUtils.test.ts`, `useArticleStore.test.ts`)

**Rust:**
- Location: Co-located with source (module-level tests)
- File naming: `{module}_tests.rs` as separate files (e.g., `rss_parser_tests.rs`)
- Embedded tests also use `mod tests { #[test] fn test_name() { ... } }`

## Test Structure

**TypeScript Structure:**
```typescript
import { describe, expect, it } from 'vitest';
import { stripCitations } from '../../lib/textUtils';

describe('stripCitations', () => {
  it('removes numbered citations [1] [2]', () => {
    expect(stripCitations('Hello [1] world [2]')).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(stripCitations('')).toBe('');
  });
});
```

**Rust Structure:**
```rust
#[tokio::test]
async fn test_token_bucket_basic() {
    let limiter = TokenBucket::new(5, 1.0, 100);

    for _ in 0..5 {
        assert!(limiter.acquire().await.is_ok());
    }

    assert!(limiter.acquire().await.is_err());
}

#[test]
fn test_update_from_response() {
    let bucket = TokenBucket::new(10, 1.0, 100);
    // ...
    assert_eq!(bucket.tokens, expected);
}
```

**Setup/Teardown:**
- TypeScript: Global `beforeEach` in `src/test/setup.ts` clears all mocks:
  ```typescript
  beforeEach(() => {
    vi.clearAllMocks();
  });
  ```
- Rust: Helper functions like `setup_test_db()` in `src-tauri/src/services/test_helpers.rs` create fresh fixtures
  - In-memory SQLite for unit tests: `SqlitePool::connect(":memory:")`
  - Builds schema once, reused across tests

**Assertions:**
- TypeScript: `expect(value).toBe()`, `expect(value).toContain()`, `expect(promise).rejects.toThrow()`
- Rust: `assert!()`, `assert_eq!()`, `assert!(result.is_ok())`, `assert!(result.is_err())`

## Mocking

**Framework:** Vitest `vi` module

**Mocking Strategy:**
- Mock external dependencies at module boundaries
- Path alias resolution in `vitest.config.ts`:
  ```typescript
  resolve: {
    alias: {
      '@tauri-apps/api/core': 'src/test/mocks/tauri.ts',
      '@tauri-apps/plugin-store': 'src/test/mocks/tauri-store.ts',
      pino: 'src/test/mocks/pino.ts',
    },
  }
  ```

**Tauri Mocking Example (`src/test/mocks/tauri.ts`):**
```typescript
import { vi } from 'vitest';

export const invoke = vi.fn();
```

**Usage in Tests:**
```typescript
import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedInvoke = vi.mocked(invoke);

describe('useArticleStore', () => {
  beforeEach(() => {
    useArticleStore.setState({
      tab: 'for_you',
      articles: [],
      // reset state...
    });
  });

  it('fetches articles', () => {
    mockedInvoke.mockResolvedValueOnce(makeFeedResult(5));
    // ... test interaction
  });
});
```

**What to Mock:**
- External APIs (Tauri invoke, HTTP calls)
- Logger (pino)
- Zustand store state/actions (via `setState()`)

**What NOT to Mock:**
- Core utilities (`stripCitations`, `sanitizeHtml`)
- Standard library functions
- Pure helper functions — test the actual implementation

## Fixtures and Factories

**Pattern:** Factory functions create test data

**Location:** Inline within test files or in `src/test/` directory

**TypeScript Example (`src/test/stores/useArticleStore.test.ts`):**
```typescript
const makeFeedResult = (count: number, hasMore = false): DiscoverFeedResult => ({
  articles: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    feedId: 1,
    title: `Article ${i + 1}`,
    url: null,
    summary: null,
    // ...
  })),
  total: count,
  hasMore,
});

// In test
mockedInvoke.mockResolvedValueOnce(makeFeedResult(5));
```

**Rust Example (`src-tauri/src/services/article_queries_tests.rs`):**
```rust
async fn seed_feed_and_article(db: &SqlitePool) -> i64 {
    sqlx::query(
        "INSERT INTO feeds (name, url, feed_type, category, created_at, updated_at)
         VALUES ('Test Feed', 'https://example.com/rss', 'rss', 'anime',
                 datetime('now'), datetime('now'))",
    )
    .execute(db)
    .await
    .unwrap();

    // Return inserted ID for assertions
}

#[tokio::test]
async fn list_articles_returns_articles() {
    let db = setup_test_db().await;
    seed_feed_and_article(&db).await;

    let result = list_articles(&db, None).await.unwrap();
    assert_eq!(result.len(), 1);
}
```

## Coverage

**Requirements:** Not explicitly enforced in config (no coverage threshold in `vitest.config.ts`)

**View Coverage:**
```bash
npm run test:coverage
```

**Target:** Per `uds-acceptance-criteria.md` rules, aim for 80%+ coverage on feature branches before merge

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities in isolation
- Examples: `textUtils.test.ts` (string manipulation), `rss_parser_tests.rs` (feed parsing)
- Fast execution, deterministic

**Integration Tests:**
- Scope: Multiple modules interacting, especially with database
- Examples: `article_queries_tests.rs` (queries with test DB), `useArticleStore.test.ts` (store + mocked invoke)
- Use in-memory SQLite (`":memory:"`) for speed
- Mock external APIs (Tauri invoke) but test store logic + data seeding together

**E2E Tests:**
- Framework: Not used in this codebase
- Would require full Tauri app runtime (expensive)
- Focus instead on integration tests with real DB schema

## Test Patterns Observed

**1. Zustand Store Testing:**
```typescript
beforeEach(() => {
  useArticleStore.setState({
    tab: 'for_you',
    articles: [],
    // ... reset to initial state
  });
});

it('updates tab and resets offset', () => {
  mockedInvoke.mockResolvedValueOnce(makeFeedResult(0));
  useArticleStore.getState().setTab('trending');

  const state = useArticleStore.getState();
  expect(state.tab).toBe('trending');
  expect(state.offset).toBe(0);
});
```

**2. Async/Promise Testing:**
```typescript
it('handles promise rejection', async () => {
  mockedInvoke.mockRejectedValueOnce(new Error('Network error'));

  const result = await executeCommand();
  expect(result).toBeNull();
  expect(state.error).toBeDefined();
});
```

**3. Database Seeding with In-Memory DB:**
```rust
#[tokio::test]
async fn test_with_db() {
    let db = setup_test_db().await;

    sqlx::query("INSERT INTO feeds ...")
        .execute(&db)
        .await
        .unwrap();

    let result = some_query(&db).await.unwrap();
    assert_eq!(result.len(), expected);
}
```

**4. Edge Cases and Error Paths:**
```typescript
describe('stripCitations', () => {
  it('removes numbered citations [1] [2]', () => { ... });
  it('removes footnote citations [^1]', () => { ... });
  it('handles empty string', () => { ... });
  it('handles text with no citations', () => { ... });
});
```

## Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach | Reason |
|--------------|------------------|--------|
| Testing implementation details | Test observable behavior | Brittle tests that break on refactoring |
| Mocking too much (even core utils) | Mock at boundaries only | Loses confidence in actual behavior |
| Async tests without proper waiting | Use `await`, promises, or `.rejects` | Tests pass but code fails in production |
| Testing unrelated concerns in one test | Single responsibility per test | Unclear failures, harder to debug |
| Not resetting mocks between tests | Use `beforeEach(() => vi.clearAllMocks())` | State leaks between tests |
| Hardcoded test data | Factory functions | Easy to extend and maintain |

## Running Tests

**All tests:**
```bash
npm run test
```

**With coverage:**
```bash
npm run test:coverage
```

**Watch mode:**
```bash
npx vitest
```

**Specific test file:**
```bash
npx vitest run src/test/lib/textUtils.test.ts
```

**Rust tests:**
```bash
cargo test
cargo test --lib
cargo test --test '*'
```
