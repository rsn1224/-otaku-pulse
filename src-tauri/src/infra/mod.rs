pub mod anilist_client;
pub mod credential_store;
pub mod database;
pub mod http_client;
pub mod llm_client;
pub mod notification;
pub mod ollama_client;
pub mod perplexity_client;
pub mod rate_limiter;
pub mod rawg_client;
pub(crate) mod reddit_json;
pub mod reddit_fetcher;
pub mod rss_fetcher;
pub mod steam_client;

// infra/ — External I/O layer.
// HTTP clients, DB access, LLM clients, rate limiters.
// Must NOT depend on services/ (no reverse dependency).
