---
phase: 03-performance-test-coverage
plan: 04
subsystem: frontend-testing
tags: [testing, vitest, coverage, react-hooks, components, jsdom]
dependency_graph:
  requires: []
  provides: [typescript-test-infrastructure, hook-error-tests, component-render-tests, coverage-tooling]
  affects: [vitest.config.ts, package.json, src/test/hooks, src/test/components]
tech_stack:
  added:
    - "@vitest/coverage-v8 ^3.x — v8 coverage provider for Vitest"
    - "@testing-library/react ^16.x — React hook and component testing"
    - "@testing-library/user-event ^14.x — User interaction simulation"
    - "@testing-library/jest-dom ^6.x — DOM matchers"
    - "jsdom ^26.x — Browser DOM simulation for Node.js"
  patterns:
    - "environmentMatchGlobs: hooks/ and components/ test dirs use jsdom, others stay node"
    - "ToastProvider wrapper for hook tests requiring context"
    - "mockResolvedValue (not Once) for stable multi-render hook tests"
key_files:
  created:
    - src/test/hooks/useTauriCommand.test.ts
    - src/test/hooks/useTauriQuery.test.ts
    - src/test/components/CardSummary.test.tsx
    - src/test/components/AiringCard.test.tsx
    - src/test/mocks/tauri-opener.ts
  modified:
    - vitest.config.ts
    - package.json
    - .gitignore
decisions:
  - "Use absolute paths (resolve(__dirname, p)) in vitest alias config — relative paths fail for jsdom environment file resolution"
  - "mockResolvedValue (persistent) over mockResolvedValueOnce for hook tests with useCallback deps causing multiple invokes"
  - "ToastProvider wrapper required for useTauriCommand and useTauriQuery tests — both hooks use useToast() internally"
  - "cargo-llvm-cov documented as local dev tool (cargo install) not a project dependency"
metrics:
  duration_seconds: 390
  completed_date: "2026-03-28"
  tasks_completed: 3
  files_changed: 8
  tests_added: 21
---

# Phase 03 Plan 04: TypeScript Testing Infrastructure and Coverage Summary

**One-liner:** @testing-library/react + jsdom per-directory env switching, 21 new tests for Tauri plain-object error handling and component partial-data rendering, v8 coverage producing HTML reports via `npm run test:coverage`.

## What Was Built

### Task 1: Install TS test dependencies and configure coverage + jsdom (TEST-07 setup)

Installed 5 new dev dependencies: `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.

Updated `vitest.config.ts` with:
- `include` pattern extended to `*.test.{ts,tsx}` for component test files
- `environmentMatchGlobs` mapping `src/test/hooks/**` and `src/test/components/**` to `jsdom` (preserving `node` default for store/lib tests)
- `coverage` block: `provider: 'v8'`, `reporter: ['text', 'html']`, `reportsDirectory: './coverage'`
- All aliases converted to absolute paths using `resolve(__dirname, p)` — required for jsdom env resolution

**Commit:** `c44a413`

### Task 2: Write hook error-handling tests and component partial-data tests (TEST-05, TEST-06)

**Hook tests (9 tests total):**

`useTauriCommand.test.ts` — 5 tests:
- Successful invoke returns data
- Tauri plain-object error `{ kind: 'Http', message: 'timeout' }` is handled (documents `String(e)` = `'[object Object]'` behavior)
- Standard `Error` instance message extracted correctly
- `isLoading` is `true` during execution, `false` after
- `reset()` clears data and error state

`useTauriQuery.test.ts` — 4 tests:
- Data fetched on mount via `useEffect`
- Tauri plain-object error sets error state
- `refetch()` triggers additional invoke call
- `enabled: false` prevents initial fetch

**Component tests (12 tests total):**

`CardSummary.test.tsx` — 5 tests:
- Renders null (no crash) when all props are null
- Shows `SummarySkeleton` when `summaryLoading` is true
- Renders AI summary with label when `summary` is provided
- Renders `fallbackSummary` when `summary` is null
- AI summary takes priority over fallback

`AiringCard.test.tsx` — 7 tests:
- Renders without crash with minimal props
- Displays `titleRomaji` when `titleNative` is null
- Shows emoji `📺` fallback (no `<img>`) when `coverImageUrl` is null
- Renders `<img>` with correct `src` when `coverImageUrl` is provided
- Episode number formatted as `#N`
- Episode formatted as `#N/M` when `totalEpisodes` is provided
- `titleNative` takes priority over `titleRomaji`

**Commit:** `a1d7398`

### Task 3: Verify coverage infrastructure (TEST-07 verification)

- `npm run test:coverage` runs all 102 tests and generates v8 HTML coverage report in `coverage/`
- Added `coverage/` and `coverage-rust/` to `.gitignore`
- `cargo-llvm-cov` installation started; command for Rust coverage: `cargo llvm-cov --html --output-dir ../coverage-rust/`

**Commit:** `2aafec7`

## Verification Results

```
npm run test -- --run:       12 test files, 102 tests passed
npm run test:coverage:       12 test files, 102 tests passed, coverage/ HTML generated
npm run typecheck:           0 errors
npm run check (Biome):       14 warnings, 0 errors (warnings are pre-existing)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest alias resolution fails in jsdom environment with relative paths**
- **Found during:** Task 1 (verified in Task 2 when first running hook tests)
- **Issue:** `resolve.alias` using relative paths like `'src/test/mocks/tauri.ts'` works in `node` environment but fails with `Failed to resolve import` when Vite resolves from the test file path in `jsdom` environment
- **Fix:** Converted all alias values to absolute paths using `resolve(__dirname, p)` helper
- **Files modified:** `vitest.config.ts`
- **Commit:** `a1d7398`

**2. [Rule 1 - Bug] mockRejectedValueOnce causes timing issues in useTauriQuery error test**
- **Found during:** Task 2
- **Issue:** `useCallback` deps (`showToast` from context) cause the fetch to run multiple times; `mockRejectedValueOnce` consumed on first call leaves subsequent calls returning `undefined`; also `vi.waitFor(() => isLoading === false)` returns immediately (initial state is `false` before effect fires)
- **Fix:** Switched to `mockRejectedValue` (persistent) and wrapped in `vi.waitFor(() => error !== null)` for the error case; used `mockResolvedValue` for other tests needing stable multi-render behavior
- **Files modified:** `src/test/hooks/useTauriQuery.test.ts`
- **Commit:** `a1d7398`

**3. [Rule 2 - Missing] ToastProvider wrapper required for all hook tests**
- **Found during:** Task 2
- **Issue:** Both `useTauriCommand` and `useTauriQuery` call `useToast()` internally, which requires `ToastProvider` context — without it, throws "useToast must be used within a ToastProvider"
- **Fix:** Added `const wrapper = ({ children }) => ToastProvider({ children })` and passed to `renderHook`
- **Files modified:** `src/test/hooks/useTauriCommand.test.ts`, `src/test/hooks/useTauriQuery.test.ts`
- **Commit:** `a1d7398`

**4. [Rule 2 - Missing] @tauri-apps/plugin-opener mock needed for AiringCard tests**
- **Found during:** Task 2
- **Issue:** `AiringCard` imports `openUrl` from `@tauri-apps/plugin-opener`; no mock existed
- **Fix:** Created `src/test/mocks/tauri-opener.ts` with `export const openUrl = vi.fn()` and added alias to `vitest.config.ts`
- **Files modified:** `src/test/mocks/tauri-opener.ts`, `vitest.config.ts`
- **Commit:** `a1d7398`

## Known Stubs

None — all tests use real component/hook code with mocked Tauri IPC.

## Self-Check: PASSED

All files confirmed present. All commits confirmed in git log.

| Item | Status |
|------|--------|
| src/test/hooks/useTauriCommand.test.ts | FOUND |
| src/test/hooks/useTauriQuery.test.ts | FOUND |
| src/test/components/CardSummary.test.tsx | FOUND |
| src/test/components/AiringCard.test.tsx | FOUND |
| vitest.config.ts | FOUND |
| .gitignore | FOUND |
| commit c44a413 | FOUND |
| commit a1d7398 | FOUND |
| commit 2aafec7 | FOUND |
