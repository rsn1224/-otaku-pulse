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

#[derive(Debug, Clone, sqlx::FromRow)]
#[allow(dead_code)]
pub struct ArticleInteraction {
    pub id: i64,
    pub article_id: i64,
    pub action: String,
    pub dwell_seconds: i64,
    pub created_at: String,
}
