// commands/ — Tauri command definitions only.
// Business logic is FORBIDDEN here. Delegate to services/.

pub mod articles;
pub mod collect;
mod default_feeds;
#[allow(dead_code)] // Commands implemented, not yet wired to invoke_handler
pub mod digest;
pub mod discover;
pub mod discover_ai;
pub mod discover_profile;
pub mod feed;
pub mod filters;
pub mod llm;
pub mod schedule;
pub mod scheduler;
#[allow(dead_code)] // Commands implemented, not yet wired to invoke_handler
pub mod settings;
