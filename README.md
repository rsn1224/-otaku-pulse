# OtakuPulse

Anime, manga, game, and PC hardware news aggregated automatically with AI-powered digest generation.

## Features

- **Auto-collection**: RSS / AniList / Steam sources on a configurable schedule
- **AI Digest**: Category-based summaries via Perplexity Sonar or Ollama
- **Airing Schedule**: Weekly anime broadcast calendar (AniList API)
- **Bookmarks**: Save and organize articles
- **FTS5 Search**: SQLite full-text search with prefix matching
- **Article Clustering**: Group related articles by shared keywords
- **Keyword Filters**: Mute or highlight articles by keyword
- **Keyboard Navigation**: J/K to move, O to open, B to bookmark, ? for help
- **Theme**: Dark / Light / System

## Requirements

- Windows 10/11
- (Optional) [Ollama](https://ollama.ai) for local AI digest generation

## Install

Run `OtakuPulse_1.0.0_x64-setup.exe`.

## First-time Setup

1. Launch the app
2. Settings > click "Initialize Default Feeds"
3. Settings > choose AI provider:
   - **Perplexity**: Set API key ([get one here](https://console.perplexity.ai))
   - **Ollama**: Run `ollama serve` + `ollama pull llama3.2`
4. Click "Collect Now" to fetch articles

## Development

```bash
npm install
npm run tauri dev
```

### Release Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/nsis/OtakuPulse_1.0.0_x64-setup.exe`

### Quality Checks

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
npx tsc --noEmit
npx biome check src/
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + Zustand |
| Backend | Rust + Tauri v2 + SQLx |
| Database | SQLite (FTS5 full-text search) |
| AI | Perplexity Sonar API / Ollama |

## License

MIT
