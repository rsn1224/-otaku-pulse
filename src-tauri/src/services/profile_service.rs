use crate::error::AppError;
use crate::models::{UserProfile, UserProfileDto};
use sqlx::SqlitePool;

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

// SEC-02: Profile field size limits (defense-in-depth with DB triggers in migration 009)
const MAX_TITLES_LEN: usize = 6000;
const MAX_GENRES_LEN: usize = 1000;
const MAX_CREATORS_LEN: usize = 6000;

/// Validate profile field sizes before writing to DB.
fn validate_profile_sizes(titles: &str, genres: &str, creators: &str) -> Result<(), AppError> {
    if titles.len() > MAX_TITLES_LEN {
        return Err(AppError::InvalidInput(format!(
            "favorite_titles exceeds {MAX_TITLES_LEN} byte limit ({} bytes)",
            titles.len()
        )));
    }
    if genres.len() > MAX_GENRES_LEN {
        return Err(AppError::InvalidInput(format!(
            "favorite_genres exceeds {MAX_GENRES_LEN} byte limit ({} bytes)",
            genres.len()
        )));
    }
    if creators.len() > MAX_CREATORS_LEN {
        return Err(AppError::InvalidInput(format!(
            "favorite_creators exceeds {MAX_CREATORS_LEN} byte limit ({} bytes)",
            creators.len()
        )));
    }
    Ok(())
}

/// プロフィール更新
pub async fn update_profile(db: &SqlitePool, dto: &UserProfileDto) -> Result<(), AppError> {
    let titles = serde_json::to_string(&dto.favorite_titles)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let genres = serde_json::to_string(&dto.favorite_genres)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let creators = serde_json::to_string(&dto.favorite_creators)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    validate_profile_sizes(&titles, &genres, &creators)?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    #[tokio::test]
    async fn get_profile_returns_defaults() {
        let db = setup_test_db().await;
        let profile = get_profile(&db).await.unwrap();
        assert_eq!(profile.display_name, "オタク");
        assert!(profile.favorite_titles.is_empty());
        assert_eq!(profile.total_read, 0);
    }

    #[tokio::test]
    async fn update_profile_persists_changes() {
        let db = setup_test_db().await;
        let dto = UserProfileDto {
            display_name: "テストユーザー".to_string(),
            favorite_titles: vec!["進撃の巨人".to_string()],
            favorite_genres: vec!["アクション".to_string()],
            favorite_creators: vec!["諫山創".to_string()],
            total_read: 0,
        };
        update_profile(&db, &dto).await.unwrap();

        let profile = get_profile(&db).await.unwrap();
        assert_eq!(profile.display_name, "テストユーザー");
        assert_eq!(profile.favorite_titles, vec!["進撃の巨人"]);
        assert_eq!(profile.favorite_genres, vec!["アクション"]);
        assert_eq!(profile.favorite_creators, vec!["諫山創"]);
    }

    #[tokio::test]
    async fn increment_read_count_adds_one() {
        let db = setup_test_db().await;
        increment_read_count(&db).await.unwrap();
        increment_read_count(&db).await.unwrap();

        let profile = get_profile(&db).await.unwrap();
        assert_eq!(profile.total_read, 2);
    }

    #[test]
    fn validate_profile_sizes_accepts_within_limits() {
        let titles = serde_json::to_string(&vec!["title"; 10]).unwrap();
        let genres = serde_json::to_string(&vec!["genre"; 5]).unwrap();
        let creators = serde_json::to_string(&vec!["creator"; 10]).unwrap();
        assert!(validate_profile_sizes(&titles, &genres, &creators).is_ok());
    }

    #[test]
    fn validate_profile_sizes_rejects_oversized_titles() {
        let titles = "x".repeat(MAX_TITLES_LEN + 1);
        let genres = "[]".to_string();
        let creators = "[]".to_string();
        let result = validate_profile_sizes(&titles, &genres, &creators);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("favorite_titles"));
    }

    #[test]
    fn validate_profile_sizes_rejects_oversized_genres() {
        let titles = "[]".to_string();
        let genres = "x".repeat(MAX_GENRES_LEN + 1);
        let creators = "[]".to_string();
        let result = validate_profile_sizes(&titles, &genres, &creators);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("favorite_genres"));
    }

    #[test]
    fn validate_profile_sizes_rejects_oversized_creators() {
        let titles = "[]".to_string();
        let genres = "[]".to_string();
        let creators = "x".repeat(MAX_CREATORS_LEN + 1);
        let result = validate_profile_sizes(&titles, &genres, &creators);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("favorite_creators"));
    }

    #[tokio::test]
    async fn reset_learning_data_clears_state() {
        let db = setup_test_db().await;
        increment_read_count(&db).await.unwrap();
        reset_learning_data(&db).await.unwrap();

        let profile = get_profile(&db).await.unwrap();
        assert_eq!(profile.total_read, 0);
    }
}
