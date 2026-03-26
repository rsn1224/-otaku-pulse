use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::{UserProfile, UserProfileDto};

/// プロフィール取得
pub async fn get_profile(db: &SqlitePool) -> Result<UserProfileDto, AppError> {
    let row = sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profile WHERE id = 1")
        .fetch_one(db)
        .await?;

    Ok(UserProfileDto {
        display_name: row.display_name,
        favorite_titles: parse_json_array(&row.favorite_titles),
        favorite_genres: parse_json_array(&row.favorite_genres),
        favorite_creators: parse_json_array(&row.favorite_creators),
        total_read: row.total_read,
    })
}

/// プロフィール更新
pub async fn update_profile(db: &SqlitePool, dto: &UserProfileDto) -> Result<(), AppError> {
    let titles = serde_json::to_string(&dto.favorite_titles)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let genres = serde_json::to_string(&dto.favorite_genres)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let creators = serde_json::to_string(&dto.favorite_creators)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    sqlx::query(
        "UPDATE user_profile
         SET display_name = ?1, favorite_titles = ?2, favorite_genres = ?3,
             favorite_creators = ?4, updated_at = datetime('now')
         WHERE id = 1",
    )
    .bind(&dto.display_name)
    .bind(&titles)
    .bind(&genres)
    .bind(&creators)
    .execute(db)
    .await?;

    Ok(())
}

/// total_read をインクリメント
pub async fn increment_read_count(db: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("UPDATE user_profile SET total_read = total_read + 1 WHERE id = 1")
        .execute(db)
        .await?;
    Ok(())
}

/// 学習データリセット
pub async fn reset_learning_data(db: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("DELETE FROM article_interactions")
        .execute(db)
        .await?;
    sqlx::query("DELETE FROM article_scores")
        .execute(db)
        .await?;
    sqlx::query("UPDATE user_profile SET total_read = 0 WHERE id = 1")
        .execute(db)
        .await?;
    Ok(())
}

fn parse_json_array(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_default()
}
