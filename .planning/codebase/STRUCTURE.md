# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
otaku-pulse/
├── .claude/                      # Project-specific AI guidelines
│   ├── agents/                   # Specialized AI agent definitions
│   ├── commands/                 # Project-specific CLI commands
│   └── rules/                    # Tauri-specific patterns & decisions
├── .planning/codebase/           # Generated codebase analysis (this content)
├── src-tauri/                    # Rust backend (Tauri v2)
│   ├── Cargo.toml                # Rust dependencies
│   ├── src/
│   │   ├── lib.rs                # Tauri app initialization & setup
│   │   ├── main.rs               # Entry point (minimal, calls lib.rs)
│   │   ├── state.rs              # AppState struct (Arc-based, no Mutex)
│   │   ├── error.rs              # AppError enum & serialization
│   │   ├── commands/             # Tauri command handlers (thin layer)
│   │   │   ├── mod.rs
│   │   │   ├── articles.rs
│   │   │   ├── collect.rs
│   │   │   ├── digest.rs
│   │   │   ├── discover.rs
│   │   │   ├── discover_ai.rs
│   │   │   ├── discover_profile.rs
│   │   │   ├── feed.rs
│   │   │   ├── filters.rs
│   │   │   ├── llm.rs
│   │   │   ├── schedule.rs
│   │   │   ├── scheduler.rs
│   │   │   └── settings.rs
│   │   ├── services/             # Business logic layer
│   │   │   ├── mod.rs
│   │   │   ├── collector.rs      # Feed collection orchestrator
│   │   │   ├── collectors/       # Collector trait & implementations
│   │   │   ├── dedup_service.rs  # Duplicate detection (Phase 1)
│   │   │   ├── digest_generator.rs
│   │   │   ├── digest_queries.rs
│   │   │   ├── discover_queries.rs
│   │   │   ├── feed_queries.rs
│   │   │   ├── fts_queries.rs
│   │   │   ├── deepdive_service.rs
│   │   │   ├── deepdive_helpers.rs
│   │   │   ├── summary_service.rs
│   │   │   ├── scoring_service.rs  # Importance scoring (Phase 2+)
│   │   │   ├── personal_scoring.rs # User preference learning
│   │   │   ├── profile_service.rs
│   │   │   ├── highlights_service.rs
│   │   │   ├── opml_service.rs     # Import/export OPML
│   │   │   ├── library_queries.rs
│   │   │   ├── article_queries.rs
│   │   │   ├── scheduler.rs        # Background scheduler (collect, digest loops)
│   │   │   └── test_helpers.rs
│   │   ├── infra/                # External I/O layer
│   │   │   ├── mod.rs
│   │   │   ├── database.rs         # SQLx pool initialization
│   │   │   ├── http_client.rs      # reqwest client wrapper
│   │   │   ├── anilist_client.rs   # AniList GraphQL API
│   │   │   ├── anilist_client_tests.rs
│   │   │   ├── perplexity_client.rs # Perplexity AI API
│   │   │   ├── ollama_client.rs     # Ollama local LLM
│   │   │   ├── llm_client.rs        # LLM orchestration (provider selection)
│   │   │   ├── rss_fetcher.rs       # HTTP fetch for RSS/Atom
│   │   │   ├── reddit_fetcher.rs    # Reddit .rss feed fetcher
│   │   │   ├── reddit_json.rs       # Reddit JSON API (fallback, untested)
│   │   │   ├── rawg_client.rs       # RAWG game releases API
│   │   │   ├── steam_client.rs      # Steam API (future)
│   │   │   ├── rate_limiter.rs      # Token bucket rate limiting
│   │   │   ├── rate_limiter_tests.rs
│   │   │   ├── credential_store.rs  # OS keystore integration
│   │   │   └── notification.rs      # Tauri notifications
│   │   ├── parsers/              # Data transformation (pure functions)
│   │   │   ├── mod.rs
│   │   │   ├── rss_parser.rs       # feed-rs wrapper
│   │   │   ├── rss_parser_tests.rs
│   │   │   ├── rss_helpers.rs
│   │   │   ├── graphql_parser.rs   # AniList query builder
│   │   │   ├── graphql_parser_tests.rs
│   │   │   ├── graphql_types.rs
│   │   │   ├── bbcode_parser.rs    # BBCode → markdown
│   │   │   └── bbcode_parser_tests.rs
│   │   ├── models/               # Rust DTOs & DB models
│   │   └── lib.rs (symlink path)
│   ├── migrations/               # SQLx database schema
│   │   ├── 001_initial.sql       # Tables: feeds, articles, digests, settings
│   │   ├── 002_keyword_filters.sql
│   │   ├── 003_fts5.sql          # Full-text search indexes
│   │   ├── 004_v2_discover.sql   # User interactions, summaries
│   │   ├── 005_deepdive_cache.sql
│   │   ├── 006_performance_indexes.sql
│   │   └── 007_additional_indexes.sql
│   ├── graphql/                 # AniList GraphQL query templates
│   │   ├── seasonal_anime.graphql
│   │   └── trending_manga.graphql
│   ├── capabilities/             # Tauri security capabilities (auto-generated)
│   ├── icons/                    # App icons
│   ├── gen/                      # Tauri codegen output
│   └── target/                   # Cargo build output (gitignored)
│
├── src/                          # React 19 frontend
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Root component (event listeners, scheduler setup)
│   ├── vite-env.d.ts             # Vite types
│   ├── types/
│   │   └── index.ts              # Shared TypeScript DTOs (mirrors Rust models)
│   ├── components/
│   │   ├── wings/                # 5 main UI sections (Zustand-backed)
│   │   │   ├── DiscoverWing.tsx   # For-you, trending, category feeds
│   │   │   ├── LibraryWing.tsx    # All articles (unread/read)
│   │   │   ├── SavedWing.tsx      # Bookmarked articles
│   │   │   ├── ScheduleWing.tsx   # Airing schedule + game releases
│   │   │   └── ProfileWing.tsx    # User profile + learned preferences
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # Main layout (nav, wing switching)
│   │   │   ├── CollectButton.tsx  # Refresh feeds button
│   │   │   ├── TopBarSearch.tsx   # Global search
│   │   │   └── WindowControls.tsx # Window minimize/maximize/close
│   │   ├── discover/
│   │   │   ├── DiscoverCard.tsx    # Article card component
│   │   │   ├── CardHeader.tsx
│   │   │   ├── CardSummary.tsx     # AI summary section
│   │   │   ├── CardSkeleton.tsx    # Loading state
│   │   │   ├── CardActions.tsx     # Read/bookmark buttons
│   │   │   ├── DeepDivePanel.tsx   # Deep dive Q&A UI
│   │   │   ├── HighlightsSection.tsx # Daily highlights
│   │   │   ├── SummarySkeleton.tsx
│   │   │   ├── CitationFooter.tsx  # DeepDive citations
│   │   │   ├── UniversalTabs.tsx   # Tab navigation
│   │   │   └── ArticleList.tsx (in wings/)
│   │   ├── schedule/
│   │   │   ├── AiringCard.tsx      # Anime episode card
│   │   │   ├── GameReleaseCard.tsx # Game release card
│   │   │   ├── ScheduleGridView.tsx
│   │   │   ├── ScheduleToggleGroup.tsx # View mode selector
│   │   │   ├── GameViews.tsx       # Game schedule views
│   │   │   └── airing/             # Airing-specific components
│   │   ├── reader/
│   │   │   └── ArticleBody.tsx     # Full article view (markdown)
│   │   ├── profile/
│   │   │   ├── ProfileSection.tsx
│   │   │   ├── FeedsSection.tsx
│   │   │   ├── AdvancedSection.tsx # Settings
│   │   │   └── PreferenceSuggestion.tsx (in onboarding/)
│   │   ├── settings/
│   │   │   ├── LlmSettings.tsx     # Perplexity/Ollama config
│   │   │   ├── SchedulerControls.tsx
│   │   │   ├── SchedulerSection.tsx
│   │   │   └── GameSettings.tsx    # RAWG API key
│   │   ├── onboarding/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── StepCreators.tsx
│   │   │   ├── StepGenres.tsx
│   │   │   ├── StepTitles.tsx
│   │   │   ├── TagInputStep.tsx
│   │   │   ├── PreferenceSuggestion.tsx
│   │   │   └── (step components)
│   │   ├── common/
│   │   │   ├── ArticleReader.tsx   # Reader modal
│   │   │   ├── RelatedArticles.tsx # Related articles sidebar
│   │   │   ├── Toast.tsx           # Notifications
│   │   │   ├── ErrorBoundary.tsx   # Error fallback
│   │   │   └── KeyboardHelpModal.tsx
│   │   └── ui/                    # Primitive components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Badge.tsx
│   │       ├── Spinner.tsx
│   │       └── ToggleGroup.tsx
│   ├── stores/                   # Zustand state management
│   │   ├── useArticleStore.ts     # Article feed, highlights, unread counts
│   │   ├── useFilterStore.ts      # Keyword filters, hidden feeds
│   │   ├── useProfileStore.ts     # User profile (display name, genres, creators)
│   │   ├── useReaderStore.ts      # Article modal state
│   │   ├── useSchedulerStore.ts   # Scheduler event listeners
│   │   ├── useSearchStore.ts      # Search state
│   │   ├── useThemeStore.ts       # Dark/light mode preference
│   │   ├── useKeyboardStore.ts    # Keyboard shortcuts enabled/disabled
│   │   └── useDiscoverStore.ts    # Discover-specific pagination state
│   ├── hooks/                    # Custom React hooks
│   │   ├── useKeyboardShortcuts.ts # Keyboard event handling
│   │   ├── useTauriCommand.ts     # Wrapper for invoke() with error handling
│   │   ├── useTauriQuery.ts       # Wrapper for async data fetching
│   │   ├── useDeepDive.ts         # Deep dive Q&A state
│   │   └── useDebounce.ts         # Debouncing utility
│   ├── lib/                      # Utilities
│   │   ├── logger.ts             # pino logger instance
│   │   ├── articleFilter.ts       # Article filtering logic
│   │   ├── textUtils.ts          # Text manipulation (sanitize, truncate)
│   │   ├── scheduleUtils.ts      # Schedule formatting & filtering
│   │   └── tauri-commands.ts     # (future) Centralized Tauri invoke wrappers
│   ├── styles/
│   │   ├── globals.css           # Tailwind base + custom properties
│   │   ├── components.css        # Component-specific styles
│   │   ├── animations.css        # Keyframes & transitions
│   │   └── tailwind.config.ts
│   ├── test/                     # Test utilities
│   │   └── setup.ts              # Vitest configuration
│   └── CLAUDE.md                 # Frontend-specific guidelines
│
├── docs/                         # Documentation
├── .github/workflows/            # CI/CD pipelines
├── biome.json                    # Formatting & linting config
├── tsconfig.json                 # TypeScript compiler options
├── vite.config.ts                # Vite bundler config
├── package.json                  # Frontend dependencies
├── tauri.conf.json               # Tauri app configuration
├── Cargo.toml (symlink to src-tauri/)
└── CLAUDE.md                     # Project-level AI guidelines
```

## Directory Purposes

**`src-tauri/`:** Complete Rust backend—4-layer architecture with strict dependency flow (commands → services → infra ← parsers). Contains Tauri app setup, all business logic, external integrations, database access, and build configuration.

**`src-tauri/src/commands/`:** Tauri IPC entry points. Each file handles one domain (feed, articles, digest, discover, etc.). Commands are action handlers only—all logic delegated to services. Thin layer (~10–20 lines per command).

**`src-tauri/src/services/`:** Heart of business logic. Orchestrates collectors, dedup, scoring, summarization, digest generation, and recommendations. Modules are stateless and testable. No direct external I/O calls (all via `infra/`).

**`src-tauri/src/infra/`:** External I/O isolation. HTTP clients (reqwest), database access (sqlx), LLM calls, rate limiting, OS credential store. Services depend on this; infra never depends upward.

**`src-tauri/src/parsers/`:** Pure data transformations. RSS parsing via feed-rs, GraphQL query building, BBCode conversion. No state, no side effects. Called by collectors.

**`src-tauri/src/models/`:** Rust DTOs and database model definitions. Mirrored to TypeScript in `src/types/index.ts`.

**`src-tauri/migrations/`:** SQLx migration files (SQL). Executed on DB init. Track schema evolution with numeric prefixes (001, 002, etc.). Never modify executed migrations; add new ones.

**`src/`:** React 19 + TypeScript frontend. Vite-bundled, Tailwind-styled, Zustand state management. Lazy-loads wing components.

**`src/components/wings/`:** 5 main screens (Discover, Library, Saved, Schedule, Profile). Each wing is a self-contained vertical slice with its own data fetching and state via Zustand stores.

**`src/components/discover/`:** Article card and deep dive UI. Handles rendering, summary display, citations, and interaction recording.

**`src/stores/`:** Domain-based Zustand stores. One store per feature (articles, filters, profile, scheduler, etc.). Encapsulates async Tauri command calls and local state.

**`src/hooks/`:** Reusable React hooks. `useTauriCommand` and `useTauriQuery` wrap `invoke()` for error handling and loading states. `useKeyboardShortcuts` handles global keyboard events.

**`src/lib/`:** Utility functions. `logger.ts` exports pino instance for structured logging. `textUtils.ts`, `scheduleUtils.ts`, `articleFilter.ts` contain shared business logic.

**`src/types/`:** Single TypeScript file defining all DTOs shared with backend. Mirrors Rust model struct names (converted to camelCase for TypeScript conventions).

**`src/styles/`:** Tailwind CSS + custom animations. No inline styles. All visual design through class names.

## Key File Locations

- **App Entry Points:** `src-tauri/src/lib.rs` (Rust), `src/main.tsx` (React)
- **Tauri Setup & Plugins:** `src-tauri/src/lib.rs#run()` (lines 15–180)
- **Command Definitions:** `src-tauri/src/lib.rs#invoke_handler` (lines 106–174)
- **Database Initialization:** `src-tauri/src/infra/database.rs`
- **Scheduler Startup:** `src-tauri/src/services/scheduler.rs#start()`
- **Error Type Definition:** `src-tauri/src/error.rs`
- **State Management (AppState):** `src-tauri/src/state.rs`
- **React Root Component:** `src/App.tsx` (event listener setup)
- **Main Layout:** `src/components/layout/AppShell.tsx` (wing navigation)
- **Article Store:** `src/stores/useArticleStore.ts` (main Zustand store for discover feed)
- **Shared Types:** `src/types/index.ts` (all DTOs)
- **Logger Instance:** `src/lib/logger.ts`
- **Tailwind Config:** `tailwind.config.ts` (if present in `src/styles/`)

## Naming Conventions

**Rust Files:**
- Modules: `snake_case` (e.g., `dedup_service.rs`, `collector.rs`)
- Functions: `snake_case` (e.g., `refresh_all`, `collect_feed`)
- Structs/Enums: `PascalCase` (e.g., `AppError`, `LlmProvider`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_CONNECTIONS`, `FEED_SELECT`)
- Tauri commands: `snake_case` (auto-converted to `camelCase` in TypeScript invoke calls)

**TypeScript Files:**
- Components: `PascalCase.tsx` (e.g., `DiscoverWing.tsx`, `ArticleCard.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g., `useArticleStore.ts`, `useKeyboardShortcuts.ts`)
- Utilities: `camelCase.ts` (e.g., `logger.ts`, `textUtils.ts`)
- Types: `snake_case.ts` (e.g., `types/index.ts`) with `PascalCase` type names inside
- Zustand stores: `use{Domain}Store.ts` (e.g., `useArticleStore.ts`)

**Database:**
- Tables: `snake_case` (e.g., `articles`, `keyword_filters`, `deepdive_questions`)
- Columns: `snake_case` (e.g., `published_at`, `is_duplicate`, `consecutive_errors`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_articles_feed_id`)
- Foreign keys: implicit via `{table_id}` pattern (e.g., `feed_id` references `feeds.id`)

**CSS/Styling:**
- No custom class names in CSS; all Tailwind utility classes
- Animation names in `animations.css`: `camelCase` (e.g., `fadeIn`, `slideUp`)
- CSS custom properties: `--kebab-case` (e.g., `--color-primary`)

## Where to Add New Code

**New Tauri Command:**
1. Create handler in `src-tauri/src/commands/{domain}.rs` (or add to existing file)
2. Handler must delegate to service layer: `pub async fn my_command(...) -> CmdResult<T> { services::...::my_logic(...).await }`
3. Register in `src-tauri/src/lib.rs#invoke_handler` macro
4. Create React hook/store method in `src/hooks/` or `src/stores/` to call `invoke('my_command', ...)`
5. Use hook in component via Zustand store or `useTauriCommand` hook

**New Service (Business Logic):**
1. Create new module file in `src-tauri/src/services/{name}.rs`
2. Export public functions only; keep implementation details private (`pub fn`, `pub async fn`)
3. Dependencies: call `infra/` modules only, never reverse
4. Example: `pub async fn my_logic(db: &SqlitePool, http: &Arc<Client>) -> Result<T, AppError> { ... }`
5. Add to `src-tauri/src/services/mod.rs#pub mod`

**New Infra Client (External I/O):**
1. Create `src-tauri/src/infra/{service}_client.rs` (e.g., `myapi_client.rs`)
2. Implement HTTP requests via `http_client::build_http_client()` or directly via reqwest
3. Apply rate limiting if needed: use `rate_limiter` module
4. Return DTOs that services can convert (or return raw, let services parse)
5. Add to `src-tauri/src/infra/mod.rs#pub mod`

**New Database Schema:**
1. Create migration in `src-tauri/migrations/{NNN}_{description}.sql` (increment NNN)
2. Use SQLx syntax with `IF NOT EXISTS` checks
3. Add indexes for frequently queried columns
4. Never modify existing migrations; create new ones for changes
5. Define Rust DTO in `src-tauri/src/models/` and TypeScript mirror in `src/types/index.ts`

**New React Component:**
1. Create in `src/components/{category}/{Name}.tsx`
2. Functional component with explicit return type: `export function MyComponent({ prop }: Props): React.JSX.Element { ... }`
3. No inline styles; use Tailwind classes only
4. Prop types: `interface MyComponentProps { ... }` exported for reuse
5. If fetching data: create/use Zustand store or `useTauriQuery` hook
6. Place in appropriate folder: `discover/`, `schedule/`, `layout/`, `ui/`, etc.

**New Zustand Store:**
1. Create `src/stores/use{Domain}Store.ts`
2. Define state interface and actions in `create<State>((set, get) => ({ ... }))`
3. Async actions: wrap `invoke()` calls with try-catch, update state via `set()`
4. Export single store instance: `export const use{Domain}Store = create<...>(...)`
5. Use in components: `const { state, action } = use{Domain}Store()`

**New Utility Function:**
1. If text/parsing related: `src/lib/textUtils.ts`
2. If schedule/date related: `src/lib/scheduleUtils.ts`
3. If article filtering: `src/lib/articleFilter.ts`
4. If Tauri-specific: consider `src/lib/tauri-commands.ts` (future centralized invoke wrapper)
5. Export with clear name: `export function myUtil(arg: Type): ReturnType { ... }`

**New Test:**
- Rust: `src-tauri/src/{module}_tests.rs` (co-located with module, gated by `#[cfg(test)]`)
- TypeScript: `src/components/{Name}.test.tsx` or `src/stores/{name}.test.ts` (Vitest format)
- Run Rust: `cargo test`
- Run TypeScript: `npm run test`

## Cross-Module Dependencies

- Commands ↓ Services (one-way)
- Services ↓ Infra (one-way)
- Parsers ↓ Models only (pure transforms)
- React components ↓ Stores ↓ Tauri commands ↓ Rust backend
- No circular imports; use trait abstraction where needed (e.g., `Collector` trait)
