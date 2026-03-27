use crate::error::AppError;
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::collections::HashMap;

/// スコアリング対象の最新記事数上限
const SCORING_ARTICLE_LIMIT: i64 = 2000;

fn calc_base_score(published_at: &Option<String>) -> f64 {
    match published_at {
        Some(date_str) => {
            if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
                let hours = (Utc::now() - dt.with_timezone(&Utc)).num_hours();
                match hours {
                    h if h <= 1 => 1.0,
                    h if h <= 6 => 0.7,
                    h if h <= 24 => 0.4,
                    h if h <= 72 => 0.1,
                    _ => 0.05,
                }
            } else {
                0.3
            }
        }
        None => 0.3,
    }
}

fn calc_personal_score(
    title: &str,
    favorite_titles: &[String],
    favorite_genres: &[String],
    favorite_creators: &[String],
) -> f64 {
    let title_lower = title.to_lowercase();
    let mut score = 0.0;

    for fav in favorite_titles {
        if title_lower.contains(&fav.to_lowercase()) {
            score += 2.0;
        }
    }
    for genre in favorite_genres {
        if title_lower.contains(&genre.to_lowercase()) {
            score += 1.5;
        }
    }
    for creator in favorite_creators {
        if title_lower.contains(&creator.to_lowercase()) {
            score += 1.5;
        }
    }

    score
}

async fn batch_interaction_bonuses(db: &SqlitePool) -> Result<HashMap<i64, f64>, AppError> {
    let mut bonuses: HashMap<i64, f64> = HashMap::new();

    let bookmarked: Vec<(i64,)> =
        sqlx::query_as("SELECT id FROM articles WHERE is_bookmarked = 1 AND is_duplicate = 0")
            .fetch_all(db)
            .await?;
    for (id,) in &bookmarked {
        *bonuses.entry(*id).or_insert(0.0) += 3.0;
    }

    let deepdived: Vec<(i64,)> = sqlx::query_as(
        "SELECT DISTINCT article_id FROM article_interactions WHERE action = 'deepdive'",
    )
    .fetch_all(db)
    .await?;
    for (id,) in &deepdived {
        *bonuses.entry(*id).or_insert(0.0) += 1.0;
    }

    let feed_rates: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT a.feed_id,
                CAST(SUM(CASE WHEN ai.action = 'open' THEN 1 ELSE 0 END) AS REAL)
                / CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END
         FROM article_interactions ai
         JOIN articles a ON ai.article_id = a.id
         GROUP BY a.feed_id",
    )
    .fetch_all(db)
    .await?;

    let feed_rate_map: HashMap<i64, f64> = feed_rates.into_iter().collect();

    let feed_articles: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT id, feed_id FROM articles WHERE is_duplicate = 0
         ORDER BY published_at DESC LIMIT ?",
    )
    .bind(SCORING_ARTICLE_LIMIT)
    .fetch_all(db)
    .await?;

    for (article_id, feed_id) in &feed_articles {
        if let Some(rate) = feed_rate_map.get(feed_id) {
            *bonuses.entry(*article_id).or_insert(0.0) += rate * 1.5;
        }
    }

    Ok(bonuses)
}

/// 全記事のスコアを再計算して article_scores に保存
pub async fn rescore_all(db: &SqlitePool) -> Result<u64, AppError> {
    let profile: (String, String, String) = sqlx::query_as(
        "SELECT favorite_titles, favorite_genres, favorite_creators
         FROM user_profile WHERE id = 1",
    )
    .fetch_one(db)
    .await?;

    let fav_titles: Vec<String> = serde_json::from_str(&profile.0).unwrap_or_else(|e| {
        tracing::warn!(error = %e, field = "favorite_titles", "Failed to parse user profile JSON");
        Vec::new()
    });
    let fav_genres: Vec<String> = serde_json::from_str(&profile.1).unwrap_or_else(|e| {
        tracing::warn!(error = %e, field = "favorite_genres", "Failed to parse user profile JSON");
        Vec::new()
    });
    let fav_creators: Vec<String> = serde_json::from_str(&profile.2).unwrap_or_else(|e| {
        tracing::warn!(error = %e, field = "favorite_creators", "Failed to parse user profile JSON");
        Vec::new()
    });

    let interaction_bonuses = batch_interaction_bonuses(db).await?;

    let rows: Vec<(i64, String, Option<String>, f64)> = sqlx::query_as(
        "SELECT id, title, published_at, importance_score
         FROM articles
         WHERE is_duplicate = 0
         ORDER BY published_at DESC
         LIMIT ?",
    )
    .bind(SCORING_ARTICLE_LIMIT)
    .fetch_all(db)
    .await?;

    let mut scores: Vec<(i64, f64, f64, f64)> = Vec::with_capacity(rows.len());

    for (id, title, published_at, importance) in &rows {
        let base = calc_base_score(published_at) + importance * 0.5;
        let personal = calc_personal_score(title, &fav_titles, &fav_genres, &fav_creators);
        let interaction = interaction_bonuses.get(id).copied().unwrap_or(0.0);
        let total = base * 0.3 + personal * 0.4 + interaction * 0.3;
        scores.push((*id, base, personal, total));
    }

    for chunk in scores.chunks(100) {
        let mut tx = db.begin().await?;
        for (id, base, personal, total) in chunk {
            sqlx::query(
                "INSERT INTO article_scores (article_id, base_score, personal_score, total_score, scored_at)
                 VALUES (?1, ?2, ?3, ?4, datetime('now'))
                 ON CONFLICT(article_id) DO UPDATE SET
                   base_score = ?2, personal_score = ?3, total_score = ?4, scored_at = datetime('now')",
            )
            .bind(id)
            .bind(base)
            .bind(personal)
            .bind(total)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
    }

    let count = scores.len() as u64;

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_personal_score_match() {
        let score = calc_personal_score(
            "エルデンリング DLC 新ボス公開",
            &["エルデンリング".to_string()],
            &["RPG".to_string()],
            &[],
        );
        assert!(score >= 2.0);
    }

    #[test]
    fn test_personal_score_no_match() {
        let score = calc_personal_score(
            "天気予報: 明日は晴れ",
            &["エルデンリング".to_string()],
            &["RPG".to_string()],
            &[],
        );
        assert!((score - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_base_score_recent() {
        let now = Utc::now().to_rfc3339();
        let score = calc_base_score(&Some(now));
        assert!((score - 1.0).abs() < 0.001);
    }
}
