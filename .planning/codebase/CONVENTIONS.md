# Coding Conventions

**Analysis Date:** 2026-03-27

## Naming Patterns

- **Files:** camelCase for utilities and hooks (`textUtils.ts`, `useTauriCommand.ts`); PascalCase for components (`ErrorBoundary.tsx`, `Toast.tsx`); snake_case for Rust modules (`rate_limiter.rs`)
- **Functions:** camelCase for TypeScript (`stripCitations`, `fetchFeed`); snake_case for Rust (`clone_llm_settings`, `list_articles`)
- **Variables:** camelCase for all locals (`isLoading`, `hasMore`, `newOffset`)
- **Types:** PascalCase for interfaces and types (`ArticleState`, `AppError`, `ToastContextType`)
- **Constants:** UPPER_SNAKE_CASE with semantic meaning (`PAGE_SIZE = 30`, `ALLOWED_TAGS`, `HTML_TAG_RE`)

## Code Style

**Formatting:**
- Tool: **Biome** v2.4.7 (`npx biome check --apply .`)
- Key settings:
  - 2-space indents
  - 100-character line width
  - Single quotes for strings
  - Semicolons always required

**Linting:**
- Biome with `recommended: true` base rules
- Key enforcement:
  - `noExplicitAny: "error"` — `any` type is forbidden
  - `useConst: "error"` — Variables that don't reassign must be const
  - `noArrayIndexKey: "warn"` — Using array indices as React keys triggers warning
  - Security: `noDangerouslySetInnerHtml: "warn"`
  - A11y: `useSemanticElements: "warn"`, `noStaticElementInteractions: "warn"`

**TypeScript Config (`tsconfig.json`):**
- `strict: true` — Full strict mode enabled
- `noUncheckedIndexedAccess: true` — Array/object access requires bounds checking
- `noUnusedLocals: true` — All local variables must be used
- `noUnusedParameters: true` — Function parameters must be used
- `noFallthroughCasesInSwitch: true` — Explicit breaks in switch statements

## Import Organization

**Order (observed):**
1. External packages (`@tauri-apps/api/core`, `zustand`, `pino`, `react`)
2. Relative imports (`../lib/logger`, `../../types`)
3. Type imports via `import type { ... }` separate from runtime imports

**Examples from codebase:**
```typescript
// From src/stores/useArticleStore.ts
import { invoke } from '@tauri-apps/api/core';        // External
import { create } from 'zustand';                     // External
import { logger } from '../lib/logger';               // Relative
import type { DiscoverArticleDto, ... } from '../types';  // Type imports

// From src/components/common/Toast.tsx
import type React from 'react';                       // Type import first
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
```

**Path Aliases:** None detected; project uses relative paths throughout.

## Error Handling

**TypeScript/React:**
- Use `try/catch` with proper error narrowing: `typeof error === "object" && error !== null && "message" in error`
- Tauri command errors are plain objects (not Error instances) — extract message field explicitly
- Log errors with context object: `logger.error({ error, context }, 'message')`
- Propagate errors to UI via `showToast('error', message)` for user-facing operations
- ErrorBoundary catches React component errors and logs them

**Rust:**
- Return `Result<T, AppError>` from all Tauri commands (type alias: `CmdResult<T>`)
- Use `?` operator for error propagation (never `unwrap()` in production)
- `expect()` allowed only with meaningful error messages: `expect("reason for unwrapping")`
- AppError serializes to `{ "kind": "...", "message": "..." }` JSON for frontend safety
- Error types: Database, Http, FeedParse, Unauthorized, RateLimit, Network, Parse, InvalidInput, Llm, Scheduler, Keyring, Internal

**Example from `src-tauri/src/error.rs`:**
```rust
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Converts to { "kind": "database", "message": "..." }
        // Enables safe frontend JSON.stringify() without [object Object]
    }
}
```

## Logging

**Framework:** `pino` v10.3.1 (TypeScript/React)

**Setup in `src/lib/logger.ts`:**
```typescript
const LOG_LEVEL = import.meta.env.DEV ? 'debug' : 'warn';
export const logger = pino({
  browser: { asObject: true },
  level: LOG_LEVEL,
});
```

**Usage patterns:**
- `logger.error({ error, context }, 'message')` — for errors
- `logger.warn({ error }, 'message')` — for warnings
- `logger.debug({ data }, 'message')` — for debugging
- Never use `console.log` or `console.error` in production code

**Rust:** `tracing` crate with `info!`, `warn!`, `error!` macros (not yet observed but specified in CLAUDE.md rules)

## Function Design

**Size guideline:** No hard limit observed; `stripCitations` is a concise 5-line function, while `sanitizeHtml` is ~30 lines with clear sections via regex replacements

**Parameters:**
- Prefer single-object parameters for multiple related values
- Example from `useTauriCommand<T>(command: string)` — single parameter for clarity
- Zustand stores often destructure `{ set, get }` in creator function

**Return Values:**
- Always declare explicit return types in function signatures
- React components: `React.JSX.Element` or `React.FC<Props>`
- Tauri commands: `CmdResult<T>` (which is `Result<T, AppError>`)
- Zustand actions return void or Promise: `setTab: (tab: DiscoverTab) => void`

**Example from `src/hooks/useTauriCommand.ts`:**
```typescript
export function useTauriCommand<T>(command: string): TauriCommandResult<T> {
  // Clear return type, generic parameter
  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => { ... },
    [command, showToast],
  );
}
```

## Module Design

**Exports:**
- Use named exports exclusively (no default exports)
- Example from `src/stores/useDiscoverStore.ts` — re-exports individual store hooks
- Barrel files for organizing related exports: `export { useArticleStore } from './useArticleStore'`

**Store Structure (Zustand v5):**
- Interface defines state shape and actions
- `create()` wraps store logic with `(set, get) => ({ ... })`
- Actions are methods on the state object
- Access: `const { tab, setTab } = useArticleStore()`
- Example from `src/stores/useArticleStore.ts` has ~80-line interface with state + 15+ actions

**React Component Structure:**
- Function declarations over arrow functions for better stack traces
- Props interface separate from component: `interface Props { ... }`
- Type React.FC not recommended — use function with explicit return type
- Example from `src/components/common/RelatedArticles.tsx`:
  ```typescript
  export const RelatedArticles: React.FC<RelatedArticlesProps> = ({ articles, isLoading }) => { ... }
  ```
  (Note: This uses React.FC but newer code should avoid it per CLAUDE.md)

## Type Organization

- `src/types/index.ts` centralizes all DTOs and domain types
- Type files use `export type` and `export interface`
- Example types: `Category`, `LlmProvider`, `FeedDto`, `DiscoverFeedResult`, `AppError`, `DeepDiveResult`

## Hooks and Custom Functions

**Pattern:** Hooks return objects with data, loading state, error state, and action functions
- `useTauriCommand<T>()` returns `{ data, isLoading, error, execute, reset }`
- `useToast()` returns `{ showToast }`
- Custom hooks follow React rules: `useEffect` for side effects only, not data fetching
- Data fetching triggered by user actions or state changes, not in useEffect directly

## Tauri Command Integration

**Pattern:** Thin command layer that calls services
- All Tauri command handlers in `src-tauri/src/commands/` are thin wrappers
- Example from `src-tauri/src/commands/discover_ai.rs`:
  ```rust
  #[tauri::command]
  pub async fn get_or_generate_summary(
      state: tauri::State<'_, AppState>,
      article_id: i64,
  ) -> CmdResult<String> {
      let settings = clone_llm_settings(&state)?;
      let client = build_llm_client(&settings, &state.http)?;
      summary_service::get_or_generate_summary(&state.db, article_id, as_llm_client(&client)).await
  }
  ```
- No business logic in commands; delegate to `services/` module
- Use `tauri::State<'_, T>` to access managed resources

## Forbidden Patterns

| Pattern | Alternative | Reason |
|---------|-------------|--------|
| `console.log` in production | `logger.error/warn/debug` | Logging framework ensures proper levels |
| `any` type | `unknown` + type guard | Maintain strict type safety |
| `import/export default` | named imports/exports | Explicit API surface |
| Inline styles in JSX | Tailwind CSS classes | Consistent theming, no style conflicts |
| `as` type casting | Type guards or explicit types | Avoid silent type errors |
| `unwrap()` in Rust production | `?` operator or `.expect("msg")` | Proper error propagation |
| Business logic in Tauri commands | services/ module | Layer separation |
