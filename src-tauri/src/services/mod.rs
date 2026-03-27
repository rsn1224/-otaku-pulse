// services/ — Business logic layer.
// Orchestration, summarization, scoring, dedup.

pub mod article_queries;
pub mod collector;
pub mod collectors;
pub mod dedup_service;
pub(crate) mod deepdive_helpers;
pub mod deepdive_service;
pub mod digest_generator;
pub mod digest_queries;
pub mod discover_queries;
pub mod feed_queries;
pub mod fts_queries;
pub(crate) mod highlights_helpers;
pub mod highlights_service;
pub mod library_queries;
pub mod opml_service;
pub mod personal_scoring;
pub mod profile_service;
pub mod scheduler;
mod scoring_keywords;
pub mod scoring_service;
pub mod summary_service;
#[cfg(test)]
pub mod test_helpers;
