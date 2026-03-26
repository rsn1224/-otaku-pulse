// commands/ — Tauri command definitions only.
// Business logic is FORBIDDEN here. Delegate to services/.

pub mod articles;
pub mod collect;
#[allow(dead_code)]
pub mod digest;
pub mod discover;
pub mod feed;
pub mod filters;
pub mod llm;
#[allow(dead_code)]
pub mod schedule;
pub mod scheduler;
#[allow(dead_code)]
pub mod settings;
