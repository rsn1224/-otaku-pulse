#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use crate::error::AppError;

#[derive(Deserialize)]
pub struct ArticleQuery {
    pub category: Option<String>,
    pub source: Option<String>,
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize)]
pub struct ArticleListResult {
    pub articles: Vec<ArticleRow>,
    pub total: i64,
    pub has_more: bool,
}

#[derive(Serialize, FromRow)]
pub struct ArticleRow {
    pub id: i64,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub source: String,
    pub category: String,
    pub published_at: Option<String>,
    pub is_read: bool,
    pub thumbnail_url: Option<String>,
}

#[tauri::command]
pub async fn get_articles(
    db: tauri::State<'_, SqlitePool>,
    query: ArticleQuery,
) -> Result<ArticleListResult, AppError> {
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    // Build WHERE clause
    let mut where_conditions = Vec::new();

    if let Some(_category) = &query.category {
        where_conditions.push("f.category = ?");
    }

    if let Some(_source) = &query.source {
        where_conditions.push("f.name = ?");
    }

    if query.unread_only.unwrap_or(false) {
        where_conditions.push("a.is_read = 0");
    }

    let where_clause = if where_conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_conditions.join(" AND "))
    };

    // Get total count
    let count_query = format!(
        "SELECT COUNT(*) as count FROM articles a JOIN feeds f ON a.feed_id = f.id {}",
        where_clause
    );
    
    let mut count_query_builder = sqlx::query_scalar(&count_query);
    
    if let Some(category) = &query.category {
        count_query_builder = count_query_builder.bind(category);
    }
    if let Some(source) = &query.source {
        count_query_builder = count_query_builder.bind(source);
    }
    
    let total: i64 = count_query_builder.fetch_one(&*db).await.unwrap_or(0);

    // Get articles
    let articles_query = format!(
        r#"
        SELECT 
            a.id,
            a.title,
            a.summary,
            a.url,
            f.name as source,
            f.category,
            a.published_at,
            a.is_read,
            a.thumbnail_url
        FROM articles a 
        JOIN feeds f ON a.feed_id = f.id 
        {}
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ? OFFSET ?
        "#,
        where_clause
    );

    // bind 順は SQL の ? 順に合わせる: WHERE 条件 → LIMIT → OFFSET
    let mut articles_builder = sqlx::query_as::<_, ArticleRow>(&articles_query);
    if let Some(category) = &query.category {
        articles_builder = articles_builder.bind(category);
    }
    if let Some(source) = &query.source {
        articles_builder = articles_builder.bind(source);
    }
    articles_builder = articles_builder.bind(limit).bind(offset);

    let article_list: Vec<ArticleRow> = articles_builder.fetch_all(&*db).await?;

    let has_more = (offset + article_list.len() as i64) < total;

    Ok(ArticleListResult {
        articles: article_list,
        total,
        has_more,
    })
}

#[tauri::command]
pub async fn mark_read(
    db: tauri::State<'_, SqlitePool>,
    article_id: i64,
) -> Result<(), AppError> {
    sqlx::query("UPDATE articles SET is_read = 1 WHERE id = ?")
        .bind(article_id)
        .execute(&*db)
        .await?;

    tracing::info!("Marked article {} as read", article_id);
    Ok(())
}

#[tauri::command]
pub async fn mark_all_read(
    db: tauri::State<'_, SqlitePool>,
    category: Option<String>,
) -> Result<i64, AppError> {
    let result = if let Some(cat) = category {
        let query = "UPDATE articles SET is_read = 1 WHERE id IN (
            SELECT a.id FROM articles a 
            JOIN feeds f ON a.feed_id = f.id 
            WHERE f.category = ? AND a.is_read = 0
        )";
        sqlx::query_scalar(query).bind(cat).fetch_one(&*db).await?
    } else {
        let query = "UPDATE articles SET is_read = 1 WHERE is_read = 0";
        sqlx::query_scalar(query).fetch_one(&*db).await?
    };

    tracing::info!("Marked {} articles as read", result);
    Ok(result)
}
