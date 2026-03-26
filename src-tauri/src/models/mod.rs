use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// DB row types (sqlx::FromRow)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct Feed {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub feed_type: String,
    pub category: String,
    pub enabled: bool,
    pub fetch_interval_minutes: i64,
    pub last_fetched_at: Option<String>,
    pub consecutive_errors: i64,
    pub disabled_reason: Option<String>,
    pub last_error: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct Article {
    pub id: i64,
    pub feed_id: i64,
    pub external_id: Option<String>,
    pub title: String,
    pub url: Option<String>,
    pub url_normalized: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub importance_score: f64,
    pub is_read: bool,
    pub is_bookmarked: bool,
    pub is_duplicate: bool,
    pub duplicate_of: Option<i64>,
    pub language: Option<String>,
    pub thumbnail_url: Option<String>,
    pub content_hash: Option<String>,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct Digest {
    pub id: i64,
    pub category: String,
    pub title: String,
    pub content_markdown: String,
    pub content_html: Option<String>,
    pub article_ids: String,
    pub model_used: Option<String>,
    pub token_count: Option<i64>,
    pub generated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct Setting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// DTO types (sent to FE — no internal DB columns exposed)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedDto {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub feed_type: String,
    pub category: String,
    pub enabled: bool,
    pub fetch_interval_minutes: i64,
    pub last_fetched_at: Option<String>,
    pub consecutive_errors: i64,
    pub disabled_reason: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDto {
    pub id: i64,
    pub feed_id: i64,
    pub title: String,
    pub url: Option<String>,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub importance_score: f64,
    pub is_read: bool,
    pub is_bookmarked: bool,
    pub language: Option<String>,
    pub thumbnail_url: Option<String>,
    pub feed_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDetailDto {
    pub id: i64,
    pub title: String,
    pub url: Option<String>,
    pub content: Option<String>, // ArticleDto にはない本文
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub feed_name: Option<String>,
    pub importance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestDto {
    pub id: i64,
    pub category: String,
    pub title: String,
    pub content_markdown: String,
    pub content_html: Option<String>,
    pub article_count: usize,
    pub model_used: Option<String>,
    pub generated_at: String,
}

// ---------------------------------------------------------------------------
// v2 Discover types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct UserProfile {
    pub id: i64,
    pub display_name: String,
    pub favorite_titles: String,
    pub favorite_genres: String,
    pub favorite_creators: String,
    pub total_read: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
    pub display_name: String,
    pub favorite_titles: Vec<String>,
    pub favorite_genres: Vec<String>,
    pub favorite_creators: Vec<String>,
    pub total_read: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct ArticleInteraction {
    pub id: i64,
    pub article_id: i64,
    pub action: String,
    pub dwell_seconds: i64,
    pub created_at: String,
}

/// Discover フィード用の拡張 ArticleDto（AI サマリー + スコア付き）
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverArticleDto {
    pub id: i64,
    pub feed_id: i64,
    pub title: String,
    pub url: Option<String>,
    pub summary: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub is_read: bool,
    pub is_bookmarked: bool,
    pub language: Option<String>,
    pub thumbnail_url: Option<String>,
    pub feed_name: Option<String>,
    pub ai_summary: Option<String>,
    pub total_score: Option<f64>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverFeedResult {
    pub articles: Vec<DiscoverArticleDto>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepDiveResult {
    pub question: String,
    pub answer: String,
    pub follow_up_questions: Vec<String>,
    pub provider: String,
    pub citations: Vec<crate::infra::llm_client::Citation>,
}
