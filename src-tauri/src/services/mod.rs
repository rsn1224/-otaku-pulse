// services/ — Business logic layer.
// Orchestration, summarization, scoring, dedup.

pub mod collector;
pub mod dedup_service;
pub mod digest_generator;
pub mod digest_queries;
pub mod feed_queries;
pub mod fts_queries;
pub mod opml_service;
pub mod scheduler;
pub mod scoring_service;
