# CLAUDE.md — OtakuPulse プロジェクト固有ルール

<!-- 最終更新: 2026-03-28 -->

## プロジェクト概要

**OtakuPulse** — AI パワードのオタクニュースアグリゲーター
スタック: Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + Biome v2

### 4 Wings（画面構成）

| Wing | 役割 |
|------|------|
| Dashboard | ホーム画面・概要表示 |
| Feed | ニュースフィード一覧・閲覧 |
| Digest | AI 要約・ダイジェスト生成 |
| Settings | ユーザー設定・フィード管理 |

---

## 🤖 メタ認知と自己最適化ルール

> このセクションは Claude Code 自身の「振る舞い」を定義する。言語固有のルールは `.claude/rules/` を参照。

### 1. Plan before Execute（計画の提示）
コードの変更や大規模な探索を始める前に、必ず関連ファイルを `grep` / `find` で最小限に調査し、**ステップバイステップの実行計画を日本語で提示**してから着手すること。

### 2. Context Economy（文脈の節約）
巨大なファイルを一度に全読み込みしない。関数単位の抽出やピンポイント検索を駆使し、コンテキストウィンドウ消費を最小限に抑えること。

### 3. Self-Critique（自己評価と方針転換）
- 同じエラーを **2回** 繰り返した場合
- ツール呼び出しが **5回以上** 連続で解決に結びつかない場合

→ 直ちに手を止め、別アプローチを日本語で提案すること。ハックで乗り切ろうとしない。

### 4. Progressive Disclosure（ルールの外部化）
`CLAUDE.md` を肥大化させない。新しい知見・パターンを発見したら `.claude/rules/` 配下の該当ファイルに追記し、このファイルには参照リンクのみ残す。

### 5. Reflection Trigger（自動振り返り）
タスク完了後、以下のキーワードが会話に含まれていたら自動的に振り返りを実行する:
- 「完了」「finish」「done」「LGTM」
→ `.claude/rules/` の該当ファイルに学びを追記すること（詳細は `.claude/agents/reflector.md` 参照）。

---

## 開発コマンド

```bash
# フロントエンド
npm run dev          # Vite dev server
npm run check        # Biome lint + format check
npm run typecheck    # tsc --noEmit

# バックエンド (Rust / Tauri)
cargo check                      # コンパイルチェック
cargo clippy -- -D warnings      # Lint（警告はエラー扱い）
cargo test                       # テスト実行

# フルスタック
npm run tauri dev    # Tauri + Vite 同時起動
```

---

## 4層アーキテクチャ（Rust バックエンド）

```
src-tauri/src/
├── commands/    — Tauri コマンド（#[tauri::command]）。薄いレイヤー、ロジック禁止
├── services/    — ビジネスロジック。テスト可能な純粋関数中心
├── infra/       — 外部 I/O（HTTP, DB, ファイルシステム）
└── parsers/     — フィード・BBCode パーサー（feed-rs ラッパー等）
```

**ルール:**
- `commands/` にビジネスロジックを書かない。services/ を呼ぶだけ
- `services/` は外部 I/O に直接依存しない。infra/ を経由する
- `parsers/` はステートレスな変換のみ

---

## キーパターン

- **状態管理:** 個別 `app.manage()` 必須。`Mutex<AppState>` 禁止 → `.claude/rules/state_no_mutex.md`
- **エラー型:** `AppError → { kind, message }` + `?` 演算子必須 → `.claude/rules/error-patterns.md`
- **デザインシステム:** CSS 変数ベースのダークテーマ → `./design.md` + `.claude/rules/design-system.md`

---

## Design System

UI コンポーネントやスタイルに関する実装を行う際は、必ず `./design.md` を読み込み、
そのトークンとルールに厳密に従うこと。

- デザインワークフロー（Stitch / Figma MCP）は `~/.claude/rules/design-workflow.md` に従う
- プロジェクト固有のトークン変換表は `./design.md` の Stitch Token Mapping セクションを参照

---

## ルール参照一覧（`.claude/rules/`）

| ファイル | 内容 |
|----------|------|
| `state_no_mutex.md` | Tauri state 管理パターン |
| `tauri-v2-gotchas.md` | Tauri v2 の落とし穴 |
| `anilist_rate_limit.md` | AniList API レート制限対応 |
| `no_rss_funnel.md` | RSS ファンネル禁止の背景 |
| `reddit_rss_first.md` | Reddit RSS 優先ルール |
| `content_hash_column.md` | content_hash カラム設計 |
| `scoring_phase1.md` | スコアリング Phase 1 設計 |
| `rust-perf.md` | Rust パフォーマンスチューニング |
| `typescript.md` | TypeScript / React 規約 |
| `error-patterns.md` | AppError 型・エラーハンドリングパターン |
| `design-system.md` | デザインシステム命名規約・禁止パターン |

## エージェント参照一覧（`.claude/agents/`）

| ファイル | 役割 |
|----------|------|
| `rust-reviewer.md` | Rust コードレビュー専門 |
| `ts-reviewer.md` | TypeScript/React コードレビュー専門 |
| `test-writer.md` | テストコード自動生成 |
| `reflector.md` | セッション終了時の振り返り・知見蓄積 |

---

## デフォルト完了要件

以下すべてをパスして初めて「完了」と報告できる:

- [ ] `npm run check` — Biome lint/format エラーなし
- [ ] `npm run typecheck` — TypeScript 型エラーなし
- [ ] `cargo clippy -- -D warnings` — Clippy 警告なし
- [ ] `cargo test` — 全テストグリーン

---

## 禁止事項

| 対象 | 禁止内容 | 理由 |
|------|----------|------|
| TypeScript | `console.log` | pino を使用 |
| TypeScript | `any` 型 | strict モード必須 |
| TypeScript | インラインスタイル | Tailwind CSS のみ |
| Rust | `unwrap()` in production | `?` 演算子 + AppError |
| Rust | `commands/` にビジネスロジック | services/ に分離 |

<!-- GSD:project-start source:PROJECT.md -->
## Project

**OtakuPulse — Stabilization & Optimization**

AI パワードのオタクニュースアグリゲーター（Tauri v2 デスクトップアプリ）の安定化・最適化マイルストーン。新機能追加ではなく、既存機能の品質・パフォーマンス・テストカバレッジ・セキュリティを全面的に底上げする。

**Core Value:** **既存機能が正しく・速く・安全に動作すること。** ユーザーが気づかないバグや性能問題をゼロに近づけ、今後の機能追加に耐えるコードベースにする。

### Constraints

- **Tech stack**: 既存スタック維持（Tauri v2, Rust, React 19, TypeScript, SQLite）
- **Architecture**: 4層アーキテクチャを崩さない
- **Compatibility**: 既存の DB スキーマとの後方互換性を維持
- **Testing**: 変更には必ず対応テストを追加
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- **Rust** 2024 edition — Backend (Tauri v2 app core, services, API clients)
- **TypeScript** ~5.8.3 — Frontend (React 19, strict mode, ES2022 target)
- **JavaScript** (ES2022) — Build configuration, Vite config
## Runtime
- **Environment:** Tauri v2.5.0 (Rust backend + Chromium frontend)
- **Package Manager:** npm (7+ implicit) — Lockfile: `package-lock.json` (present)
- **Build System:** Vite 8.0.3 (frontend) + Cargo (backend)
## Frameworks
- **Core Frontend:** React 19.1.0 (function components + hooks only)
- **Core Backend:** Tauri 2 (`src-tauri/src/main.rs`, `src-tauri/src/lib.rs`)
- **Desktop Shell:** Tauri plugins (notification, store, fs, opener, single-instance, window-state)
- **Testing:** Vitest 4.1.0 (frontend), cargo test (backend)
- **Build/Dev:** Vite 8.0.3, Tauri CLI 2.10.1
## Key Dependencies
### Frontend (TypeScript/React)
- **State Management:** Zustand 5.0.11 — Store per domain (`useDiscoverStore`, `useSchedulerStore`, etc.)
- **UI/Styling:** Tailwind CSS 4.2.1 + `@tailwindcss/vite` 4.2.1 — Class-first only (no inline styles)
- **Lists:** `@tanstack/react-virtual` 3.13.23 — Virtual scrolling for large lists
- **Logging:** pino 10.3.1 — Structured logging with browser support
- **Desktop Integration:** `@tauri-apps/api` 2.10.1 — Core Tauri IPC
- **Tauri Plugins:**
### Backend (Rust)
- **HTTP Client:** `reqwest` 0.12 (with rustls-tls, json) — All external API calls
- **Feed Parsing:** `feed-rs` 2.1 (MIT) — RSS/Atom parsing
- **Web Scraping:** `scraper` 0.20 (MIT) — HTML parsing (OGP extraction)
- **Async Runtime:** `tokio` 1.x (multi-thread, macros, sync, time)
- **Serialization:** `serde` 1, `serde_json` 1
- **Error Handling:** `thiserror` 2, `anyhow` 1
- **Database:** `sqlx` 0.8 (sqlite runtime, tokio) — Async SQLite with compile-time checked queries
- **Scheduling:** `tokio-cron-scheduler` 0.13 — Background job scheduling
- **Markdown:** `pulldown-cmark` 0.12 — Markdown to HTML conversion
- **Hashing:** `sha2` 0.10 — Content deduplication (content_hash)
- **Regex:** `regex` 1.10 — Text pattern matching
- **Dates:** `chrono` 0.4 (with serde) — Time/date handling
- **Async Traits:** `async-trait` 0.1 — Trait bounds for async functions
- **Credentials:** `keyring` 3 — OS credential store (Windows Credential Manager)
- **Logging:** `tracing` 0.1, `tracing-subscriber` 0.3 (env-filter)
- **Testing:** `wiremock` 0.6, `http` 1.1 — HTTP mocking
### DevDependencies
- **Linting/Formatting:** `@biomejs/biome` 2.4.7 — Single tool for lint + format (replaces ESLint/Prettier)
- **Type Checking:** TypeScript 5.8.3 compiler (`tsc --noEmit`)
## Configuration
### TypeScript
- **Config:** `tsconfig.json`
- **Key Settings:** strict mode, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters, jsx="react-jsx"
- **Target:** ES2022, module="ESNext", bundler resolution
### Biome (Lint/Format)
- **Config:** `biome.json`
- **Formatter:** 2-space indent, 100 char line width, single quotes, always semicolons
- **Linter:** Recommended rules + security (noDangerouslySetInnerHtml), a11y (semantic, interactions), style (useConst)
- **Tailwind:** Directives enabled in CSS parser
### Tauri
- **Config:** `src-tauri/tauri.conf.json`
- **CSP:** Allows connections to `http://localhost:11434` (Ollama), `https://api.perplexity.ai`, `https://graphql.anilist.co`, `https://api.rawg.io`
- **Window:** 1100x700, min 900x600, no decorations, single instance enforced
- **Plugins:** Notification, Store, FS, Opener, WindowState loaded at runtime
### Cargo (Rust)
- **File:** `src-tauri/Cargo.toml`
- **Edition:** 2024 (MSRV implicit from dependencies)
- **Lib Output:** staticlib + cdylib + rlib (Tauri requirement)
- **Release Profile:** opt-level=3, lto="fat", codegen-units=1, panic="abort", strip=true
### Database Migrations
- **Tool:** `sqlx::migrate!()` macro (compile-time verified)
- **Path:** `src-tauri/migrations/` (auto-discovered)
- **Driver:** SQLite (single file `~/.local/share/OtakuPulse/otaku_pulse.db` on Linux, platform-specific on Windows/macOS)
## Platform Requirements
- **Development:**
- **Production:**
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- **Files:** camelCase for utilities and hooks (`textUtils.ts`, `useTauriCommand.ts`); PascalCase for components (`ErrorBoundary.tsx`, `Toast.tsx`); snake_case for Rust modules (`rate_limiter.rs`)
- **Functions:** camelCase for TypeScript (`stripCitations`, `fetchFeed`); snake_case for Rust (`clone_llm_settings`, `list_articles`)
- **Variables:** camelCase for all locals (`isLoading`, `hasMore`, `newOffset`)
- **Types:** PascalCase for interfaces and types (`ArticleState`, `AppError`, `ToastContextType`)
- **Constants:** UPPER_SNAKE_CASE with semantic meaning (`PAGE_SIZE = 30`, `ALLOWED_TAGS`, `HTML_TAG_RE`)
## Code Style
- Tool: **Biome** v2.4.7 (`npx biome check --apply .`)
- Key settings:
- Biome with `recommended: true` base rules
- Key enforcement:
- `strict: true` — Full strict mode enabled
- `noUncheckedIndexedAccess: true` — Array/object access requires bounds checking
- `noUnusedLocals: true` — All local variables must be used
- `noUnusedParameters: true` — Function parameters must be used
- `noFallthroughCasesInSwitch: true` — Explicit breaks in switch statements
## Import Organization
## Error Handling
- Use `try/catch` with proper error narrowing: `typeof error === "object" && error !== null && "message" in error`
- Tauri command errors are plain objects (not Error instances) — extract message field explicitly
- Log errors with context object: `logger.error({ error, context }, 'message')`
- Propagate errors to UI via `showToast('error', message)` for user-facing operations
- ErrorBoundary catches React component errors and logs them
- Return `Result<T, AppError>` from all Tauri commands (type alias: `CmdResult<T>`)
- Use `?` operator for error propagation (never `unwrap()` in production)
- `expect()` allowed only with meaningful error messages: `expect("reason for unwrapping")`
- AppError serializes to `{ "kind": "...", "message": "..." }` JSON for frontend safety
- Error types: Database, Http, FeedParse, Unauthorized, RateLimit, Network, Parse, InvalidInput, Llm, Scheduler, Keyring, Internal
## Logging
- `logger.error({ error, context }, 'message')` — for errors
- `logger.warn({ error }, 'message')` — for warnings
- `logger.debug({ data }, 'message')` — for debugging
- Never use `console.log` or `console.error` in production code
## Function Design
- Prefer single-object parameters for multiple related values
- Example from `useTauriCommand<T>(command: string)` — single parameter for clarity
- Zustand stores often destructure `{ set, get }` in creator function
- Always declare explicit return types in function signatures
- React components: `React.JSX.Element` or `React.FC<Props>`
- Tauri commands: `CmdResult<T>` (which is `Result<T, AppError>`)
- Zustand actions return void or Promise: `setTab: (tab: DiscoverTab) => void`
## Module Design
- Use named exports exclusively (no default exports)
- Example from `src/stores/useDiscoverStore.ts` — re-exports individual store hooks
- Barrel files for organizing related exports: `export { useArticleStore } from './useArticleStore'`
- Interface defines state shape and actions
- `create()` wraps store logic with `(set, get) => ({ ... })`
- Actions are methods on the state object
- Access: `const { tab, setTab } = useArticleStore()`
- Example from `src/stores/useArticleStore.ts` has ~80-line interface with state + 15+ actions
- Function declarations over arrow functions for better stack traces
- Props interface separate from component: `interface Props { ... }`
- Type React.FC not recommended — use function with explicit return type
- Example from `src/components/common/RelatedArticles.tsx`:
## Type Organization
- `src/types/index.ts` centralizes all DTOs and domain types
- Type files use `export type` and `export interface`
- Example types: `Category`, `LlmProvider`, `FeedDto`, `DiscoverFeedResult`, `AppError`, `DeepDiveResult`
## Hooks and Custom Functions
- `useTauriCommand<T>()` returns `{ data, isLoading, error, execute, reset }`
- `useToast()` returns `{ showToast }`
- Custom hooks follow React rules: `useEffect` for side effects only, not data fetching
- Data fetching triggered by user actions or state changes, not in useEffect directly
## Tauri Command Integration
- All Tauri command handlers in `src-tauri/src/commands/` are thin wrappers
- Example from `src-tauri/src/commands/discover_ai.rs`:
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Overall: **4-Layer Tauri Desktop App** (Commands → Services → Infra → Parsers) with React 19 frontend
- Key Characteristics: Clean separation of concerns, no business logic in commands, dependency inversion (services never call infra directly for state), individual resource management (no Mutex<AppState>), structured logging via tracing
## Layers
- Purpose: Accept Tauri IPC calls from React frontend, parse arguments, delegate to services, return errors as structured JSON
- Location: `src-tauri/src/commands/`
- Depends on: Services (one-way dependency only) / Used by: React frontend via `@tauri-apps/api/core#invoke()`
- Pattern: Every command is thin wrapper calling a single service function; no business logic allowed
- Purpose: Orchestrate business logic—article collection, deduplication, scoring, summarization, digest generation, and discover recommendations
- Location: `src-tauri/src/services/`
- Depends on: Infra and Database / Used by: Commands
- Modules: `collector` (multi-feed refresh), `dedup_service` (duplicate detection), `scoring_service` (importance scoring), `summary_service` (AI summarization), `digest_generator` (batch digest creation), `discover_queries` (feed ranking), `personal_scoring` (user preference learning)
- Pattern: Pure business logic, stateless functions, structured as domain-specific query/service modules
- Purpose: External I/O—HTTP clients (AniList, Perplexity, RAWG, Reddit, Steam), database queries, LLM orchestration, rate limiting, credential storage
- Location: `src-tauri/src/infra/`
- Depends on: None (no upward dependencies) / Used by: Services only
- Modules: `http_client` (reqwest wrapper), `database` (SQLx pool init), `anilist_client`, `perplexity_client`, `ollama_client`, `reddit_fetcher`, `rss_fetcher`, `rawg_client`, `steam_client`, `rate_limiter`, `credential_store`, `notification`
- Pattern: All external calls isolated here; no business logic; reusable, testable in isolation
- Purpose: Pure data transformation—RSS to Article DTOs, GraphQL responses to typed models, BBCode to markdown, HTML to text
- Location: `src-tauri/src/parsers/`
- Depends on: Models only / Used by: Collectors in services
- Modules: `rss_parser` (feed-rs wrapper), `graphql_parser` (AniList query builder), `bbcode_parser` (format conversion), `graphql_types` (typed GQL responses)
- Pattern: Stateless functions with no side effects; pure transformations
## Data Flow
- Scheduler triggers `collect_loop` (via `scheduler.rs`)
- `collector::refresh_all()` iterates enabled feeds
- `collect_feed()` selects collector (RSS, AniList, Steam, Reddit) based `feed_type`
- Collector calls infra (HTTP clients) → Parser transforms to `Article` DTOs
- `dedup_service` normalizes URLs, generates content hashes, compares against recent articles using Jaccard similarity
- `scoring_service` calculates `importance_score` (Phase 2+; Phase 1 uses 0.0)
- `feed_queries::insert_articles_batch()` writes to DB with dedup flags
- Event emitted: `collect-completed` → React toast notification
- Frontend calls `invoke("get_discover_feed", { tab: "for_you", offset: 0, limit: 30 })`
- Command calls `discover_queries::get_discover_feed()`
- Query: `SELECT articles WHERE is_duplicate=0 AND is_read=0` with scoring/interaction-based ranking
- Pagination: 30 articles per page, tracked via Zustand `offset`
- Response: `{ articles: DiscoverArticleDto[], total: number, hasMore: boolean }`
- State Management: Zustand `useArticleStore` caches results, allows infinite scroll
- Frontend calls `invoke("get_or_generate_summary", { articleId: 123 })`
- `discover_ai::get_or_generate_summary()` checks `summaries` table cache
- If miss: selects LLM provider from `AppState.llm` (Perplexity or Ollama)
- Calls `llm_client::summarize()` → routes to `perplexity_client` or `ollama_client`
- Caches result in DB with `generated_at` timestamp
- Deep dive: `ask_deepdive()` iterates conversation, maintains citation tracking
- State Management: Frontend caches summaries in `useArticleStore`, re-renders on update
- `scheduler::start()` spawns tokio tasks for `collect_loop`, `digest_loop`, `digest_cache_loop`
- Each loop publishes Tauri event: `collect-completed { fetched, saved }`, `digest-ready { category }`, etc.
- React `App.tsx` listeners via `listen('collect-completed')` → store update → toast display
- Pattern: One-way pub-sub; no command reply mechanism needed
- Frontend records `record_interaction(articleId, action="view"|"click"|"bookmark", dwellSeconds)`
- `discover_queries::record_interaction()` updates `user_interactions` table (future schema)
- `personal_scoring` module recalculates user preferences from interaction history
- `discover_queries` re-ranks articles using `totalScore = content_score × user_preference_boost`
- Profile data fetched via `discover_profile::get_user_profile()` → displays learned tags/genres
## Key Abstractions
- Trait: `pub trait Collector { async fn collect(&self, feed: &Feed) -> Result<Vec<Article>, AppError> }`
- Implementations: `RssCollector`, `AniListCollector`, `SteamCollector`
- Purpose: Polymorphic feed type handling; easy to add new sources (e.g., `RedditCollector`)
- Usage: `match feed.feed_type { "rss" => Box::new(RssCollector::new(...)), ... }`
- Functions: `normalize_url()`, `generate_content_hash()`, `jaccard_bigram_similarity()`
- Purpose: Prevent duplicate articles entering DB; runs at Phase 1 (collection time)
- Key rule: Content hash stored in dedicated `articles.content_hash` column (indexed), not in JSON metadata
- Functions: `calculate_importance_score()`, `adjust_by_user_preference()`
- Purpose: Compute 0.0–1.0 importance for ranking; Phase 1 inserts with 0.0, Phase 2+ updates
- Factors: Feed priority (anime > manga > game), keyword matching, publish date freshness
- Enum: `LlmProvider { Perplexity, Ollama }`
- Pattern: Reads `AppState::llm` (RwLock) at runtime, delegates to appropriate client
- Perplexity: Real API key stored in OS credential store (via `credential_store` module), retrieved on startup
- Ollama: Local HTTP call to `http://localhost:11434` (configurable)
- Structure: `AppState { db: Arc<SqlitePool>, http: Arc<Client>, llm: Arc<RwLock<LlmSettings>> }`
- Pattern: Individual `app.manage()` for db, http, and llm; no Mutex<AppState>
- Rationale: DB access doesn't block HTTP; RwLock used only for llm settings (infrequently updated)
- Commands extract: `db: State<SqlitePool>, http: State<Arc<Client>>, app_state: State<AppState>`
- Enum: `AppError { Database, Http, FeedParse, Unauthorized, RateLimit, Network, Parse, InvalidInput, Llm, Scheduler, Keyring, Internal }`
- Serialization: `{ "kind": "feed_parse", "message": "Invalid XML" }` (safe for JSON.stringify on frontend)
- Pattern: All Tauri commands return `Result<T, AppError>`; framework auto-serializes
- Pattern: One store per domain (`useArticleStore`, `useFilterStore`, `useProfileStore`, `useSchedulerStore`, etc.)
- State shape: Separate concerns (articles list vs. unread counts vs. scroll positions)
- Async actions: Commands wrapped in `invoke()` calls with error logging
- Example: `fetchFeed(reset?: boolean)` → calls `invoke("get_discover_feed", ...)` → updates store articles
## Entry Points
- `src-tauri/src/main.rs` → calls `otaku_pulse_lib::run()`
- `src-tauri/src/lib.rs#run()` — Tauri app setup, plugin initialization, database init, scheduler startup, invoke handler registration (59 commands)
- `src/main.tsx` — mounts `<App />` to root element
- `src/App.tsx` — `AppContent()` component with event listeners for scheduler events (collect-completed, digest-ready, etc.)
- `src-tauri/src/services/scheduler.rs#start()` — spawned from `lib.rs` setup, runs three background loops:
- `src-tauri/src/infra/database.rs#init_pool()` — runs SQLx migrations from `migrations/` on first connect
- Migration files: `001_initial.sql` (schema), `002–007_*.sql` (incremental updates)
## Error Handling
- Strategy: **Explicit error types, no `.unwrap()` in production code**
- Pattern: `?` operator throughout services/infra; `AppError` variants provide context
- Tauri commands: `Result<T, AppError>` serializes to JSON `{ "kind", "message" }`
- Frontend: Error caught in `invoke()` try-catch; logged via pino logger; optional user-facing toast
- Database: SQLx errors wrap as `AppError::Database`; HTTP errors as `AppError::Http` or `AppError::RateLimit`
- Scheduler: Failed iterations logged (not fatal); app continues with next scheduled run
## Cross-Cutting Concerns
- Framework: `tracing` with `tracing-subscriber` (Rust side)
- Config: `RUST_LOG` env var (default: "info"), filtered by `EnvFilter`
- Pattern: `tracing::info!()`, `tracing::warn!()`, `tracing::error!()`
- Structured fields: `error = %e, feed_id = feed.id`
- Frontend: `pino` logger in `src/lib/logger.ts`; structured JSON output
- API keys: Stored in OS credential store (Windows: Windows Credential Manager, macOS: Keychain)
- Flow: On startup, `credential_store::load_credential(PERPLEXITY_ACCOUNT)` loads key into `AppState.llm.perplexity_api_key`
- UI: Settings page allows user to input/clear API keys; keys never logged or transmitted
- RAWG API key: Similar pattern via `credential_store`
- AniList: Hardcoded to 30 req/min (not 90 public docs claim); 2-second minimum interval between requests
- Implementation: `infra/rate_limiter.rs` with token bucket algorithm
- Behavior: On 429, read `Retry-After` header, wait, and retry
- Database-backed: Summaries cached in `summaries` table; deep-dive questions in `deepdive_questions` table
- TTL: Summaries TTL configurable (default 1 hour); checked on read
- Dedup cache: Recent articles (past 72 hours) loaded into memory during `collect_feed()` for comparison
- HTTP: No HTTP-level caching; relies on feed `etag` / `last-modified` headers to avoid re-parsing identical responses
- Database: Created from migrations on app startup; initial feed inserts from `001_initial.sql` default feeds
- User preferences: Loaded from `settings` KVS table on demand
- Theme: Read from localStorage via `useThemeStore`, applied on mount
- Scheduler config: Loaded from settings on startup; can be updated via UI
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
