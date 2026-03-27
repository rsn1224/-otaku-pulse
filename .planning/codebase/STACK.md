# Technology Stack

**Analysis Date:** 2026-03-27

## Languages
- **Rust** 2024 edition — Backend (Tauri v2 app core, services, API clients)
- **TypeScript** ~5.8.3 — Frontend (React 19, strict mode, ES2022 target)
- **JavaScript** (ES2022) — Build configuration, Vite config

## Runtime
- **Environment:** Tauri v2.5.0 (Rust backend + Chromium frontend)
- **Package Manager:** npm (7+ implicit) — Lockfile: `package-lock.json` (present)
- **Build System:** Vite 7.0.4 (frontend) + Cargo (backend)

## Frameworks
- **Core Frontend:** React 19.1.0 (function components + hooks only)
- **Core Backend:** Tauri 2 (`src-tauri/src/main.rs`, `src-tauri/src/lib.rs`)
- **Desktop Shell:** Tauri plugins (notification, store, fs, opener, single-instance, window-state)
- **Testing:** Vitest 4.1.0 (frontend), cargo test (backend)
- **Build/Dev:** Vite 7.0.4, Tauri CLI 2.5.0

## Key Dependencies

### Frontend (TypeScript/React)
- **State Management:** Zustand 5.0.11 — Store per domain (`useDiscoverStore`, `useSchedulerStore`, etc.)
- **UI/Styling:** Tailwind CSS 4.2.1 + `@tailwindcss/vite` 4.2.1 — Class-first only (no inline styles)
- **Lists:** `@tanstack/react-virtual` 3.13.23 — Virtual scrolling for large lists
- **Logging:** pino 10.3.1 — Structured logging with browser support
- **Desktop Integration:** `@tauri-apps/api` 2.10.1 — Core Tauri IPC
- **Tauri Plugins:**
  - `@tauri-apps/plugin-fs` 2.2.0 — File system access
  - `@tauri-apps/plugin-notification` 2.3.3 — System notifications
  - `@tauri-apps/plugin-opener` 2.5.3 — URL/file opening
  - `@tauri-apps/plugin-store` 2.2.0 — Persistent settings storage

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
  - Node.js 16+ (npm 7+)
  - Rust 1.56+ (Cargo)
  - Tauri CLI v2
  - Windows/macOS/Linux with UI toolkit support
- **Production:**
  - **Deployment:** Desktop application (Windows .msi, macOS .app, Linux .AppImage)
  - **Runtime:** OS-native Chromium (bundled by Tauri)
  - **Data:** Local SQLite database in user app data dir
  - **Network:** Internet connection for API calls (Perplexity, AniList, RAWG, Steam)
