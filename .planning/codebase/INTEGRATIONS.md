# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

### LLM / AI Providers
- **Perplexity Sonar** — AI article summarization and digest generation
  - SDK: Custom client in `src-tauri/src/infra/perplexity_client.rs`
  - Endpoint: `https://api.perplexity.ai`
  - Auth: API key via OS credential store (Windows Credential Manager)
  - Key Storage: `credential_store.rs` with constant `PERPLEXITY_ACCOUNT`
  - Commands: `set_perplexity_api_key()`, `clear_perplexity_api_key()` in `src-tauri/src/commands/llm.rs`
  - Features: max_tokens, temperature control, search_recency_filter

- **Ollama (Local)** — Fallback LLM for offline/privacy-preserving summarization
  - SDK: Custom client in `src-tauri/src/infra/ollama_client.rs`
  - Endpoint: `http://localhost:11434` (configurable)
  - Auth: None (local service, no credentials)
  - Config Command: `set_ollama_base_url()` in `src-tauri/src/commands/llm.rs`
  - Capabilities: Model listing, chat completion, status check
  - Status: `check_status()` polls available models

### Anime/Manga Data
- **AniList GraphQL API** — Seasonal anime schedule, anime details
  - Endpoint: `https://graphql.anilist.co`
  - SDK: Custom client in `src-tauri/src/infra/anilist_client.rs`
  - Auth: None (public GraphQL endpoint)
  - Rate Limit: **30 req/min** (hardcoded constraint in code, not 90 as advertised)
  - Implementation: `src-tauri/src/infra/rate_limiter.rs` with TokenBucket
  - GraphQL Queries: Parsed from `src-tauri/graphql/*.graphql` files
  - Key Files:
    - `src-tauri/graphql/seasonal_anime.graphql` — Fetch seasonal anime
    - `src-tauri/graphql/trending_manga.graphql` — Fetch trending manga

### Gaming Data
- **RAWG.io API** — Video game release schedule and metadata
  - Endpoint: `https://api.rawg.io/api/games`
  - SDK: Custom client in `src-tauri/src/infra/rawg_client.rs`
  - Auth: API key required, stored in OS credential store
  - Key Storage: Constant `RAWG_ACCOUNT` in `credential_store.rs`
  - Commands: `set_rawg_api_key()`, `clear_rawg_api_key()`, `is_rawg_api_key_set()` in `src-tauri/src/commands/schedule.rs`
  - Features: Game releases, platforms, images (background_image), slug-based lookup

- **Steam Web API** — Steam app news and community content
  - SDK: Custom client in `src-tauri/src/infra/steam_client.rs`
  - Protocol: steam:// URLs parsed to AppID extraction
  - Features: News fetching, BBCode formatting to HTML
  - File: `src-tauri/src/parsers/bbcode_parser.rs` for content conversion

### Feed Aggregation
- **RSS/Atom Feeds** — First-class support via feed-rs library
  - SDK: `feed-rs` 2.1 (MIT licensed)
  - Parser: `src-tauri/src/parsers/rss_parser.rs`
  - Support: Reddit (.rss preferred), blog feeds, news sites
  - Features: Automatic content deduplication, link extraction
  - Status: No external API — local parsing only

### Web Scraping / Metadata
- **Web Scraping for OGP** — Extract open graph metadata (images, summaries)
  - SDK: `scraper` 0.20 (MIT, CSS selector-based)
  - Usage: `src-tauri/src/infra/` for HTML parsing on article URLs
  - Purpose: Enriching article metadata when feeds lack complete data

## Data Storage

### Databases
- **SQLite** — Local embedded database
  - Connection: `src-tauri/src/infra/database.rs` initializes at startup
  - URL Format: `sqlite://{app_data_dir}/otaku_pulse.db?mode=rwc`
  - Pool: SqlitePool with max_connections=5
  - Client: `sqlx` 0.8 with compile-time query verification
  - Migrations: Auto-run on first connect from `src-tauri/migrations/` (sqlx::migrate! macro)
  - Schema: Managed via SQL files (location: `src-tauri/migrations/`)
  - Location: Platform-specific app data dir (Tauri's `app.path().app_data_dir()`)
  - ORM: None (raw sqlx queries with type safety via macros)

### File Storage
- **Local Filesystem Only** — No cloud storage
  - Cache: Temporary deepdive results in DB
  - Settings: `tauri-plugin-store` JSON files in app config dir
  - Credentials: OS Credential Manager (Windows) / Keychain (macOS) / Secret Service (Linux) via `keyring` crate

### Caching
- **In-Process Caching:** Zustand stores in React (state across re-renders)
- **Persistent Settings:** Tauri Plugin Store (JSON in app config)
- **DB Cache:** Deepdive results cached with expiration in `deepdive_service.rs`

## Authentication & Identity

### Providers
- **Custom Key Management** — No OAuth/SSO
  - Perplexity: User-provided API key
  - RAWG: User-provided API key
  - AniList: Public access (no auth)
  - Steam: Public RSS feeds (no auth)
  - Ollama: Local service (no auth)

### Credential Storage
- **OS Credential Manager Integration** — `src-tauri/src/infra/credential_store.rs`
  - Library: `keyring` crate v3 (secure OS-level storage)
  - Windows: Credential Manager
  - macOS: Keychain
  - Linux: Secret Service (systemd)
  - Accounts Defined:
    - `perplexity-api-key` (PERPLEXITY_ACCOUNT)
    - `rawg-api-key` (RAWG_ACCOUNT)
  - API: `load_credential()`, `store_credential()`, `delete_credential()`

## Monitoring & Observability

### Error Tracking
- **Not Detected** — No external error service (Sentry, etc.)
- Local implementation: Structured error types in `src-tauri/src/error.rs`
- Frontend: Error boundary component in `src/components/common/ErrorBoundary.tsx`

### Logs
- **Structured Logging:** `tracing` + `tracing-subscriber` (Rust backend)
  - Configuration: `EnvFilter` from `RUST_LOG` environment variable, defaults to "info"
  - Init: `src-tauri/src/lib.rs` (fmt subscriber with env-filter)
  - Levels: ERROR, WARN, INFO, DEBUG, TRACE
  - Front-end: `pino` 10.3.1 with browser transport
  - Log Level: DEBUG in dev mode, WARN in production (`src/lib/logger.ts`)
  - Format: Browser object transport (not console strings)

## CI/CD & Deployment

### Hosting
- **Desktop Application** (not web-hosted)
- **Distribution:** Native installers (Windows .msi, macOS .app, Linux .AppImage)
- **Build Output:** Managed by Tauri build system
- **Code Signing:** Not detected (opt-in via Tauri config)

### CI Pipeline
- **Not Detected** — No GitHub Actions, GitLab CI, or external service found
- **Local Development:** Manual build via `npm run tauri dev` or `npm run build`

## Environment Configuration

### Required Environment Variables
- **RUST_LOG** (optional) — Controls Rust logging level (defaults to "info")
  - Usage in `src-tauri/src/lib.rs` via `EnvFilter::try_from_default_env()`

### Secrets / API Key Management
- **No .env files required** — All secrets stored in OS Credential Manager at runtime
- **Configuration Flow:**
  1. User enters API keys in UI (Settings panel)
  2. Keys stored via `credential_store.rs` (OS-level encryption)
  3. On app startup, keys loaded from OS store
  4. Passed to clients (Perplexity, RAWG) during request

### Optional Configuration
- **Database Path:** Auto-determined from Tauri app data dir (customizable in code only)
- **Ollama URL:** Configurable via UI command `set_ollama_base_url()` (default: localhost:11434)
- **Perplexity Base URL:** Hardcoded to `https://api.perplexity.ai`
- **AniList GraphQL Endpoint:** Hardcoded to `https://graphql.anilist.co`
- **RAWG API Endpoint:** Hardcoded to `https://api.rawg.io/api/games`

### Network & Security
- **CSP (Content Security Policy):** Configured in `src-tauri/tauri.conf.json`
  - Allows: `localhost:11434` (Ollama), `api.perplexity.ai`, `graphql.anilist.co`, `api.rawg.io`
  - Default behavior: All assets served from `self`, images from https + data URIs
- **TLS:** rustls-tls enforced in reqwest (no native OpenSSL)
- **No Proxy Support:** Direct connections only
