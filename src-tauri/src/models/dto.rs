use serde::{Deserialize, Serialize};

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
    pub content: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
    pub display_name: String,
    pub favorite_titles: Vec<String>,
    pub favorite_genres: Vec<String>,
    pub favorite_creators: Vec<String>,
    pub total_read: i64,
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
