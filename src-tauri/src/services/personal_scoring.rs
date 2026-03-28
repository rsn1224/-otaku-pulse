use crate::error::AppError;
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::collections::HashMap;

/// スコアリング対象の最新記事数上限
const SCORING_ARTICLE_LIMIT: i64 = 2000;
/// dwell_time ボーナスの上限（30秒超過ごとに+0.5、最大+2.0）。SQL の MIN() 式にも反映済み。
#[allow(dead_code)]
const DWELL_BONUS_CAP: f64 = 2.0;
/// mute キーワードによるスコア減衰率
const MUTE_SCORE_FACTOR: f64 = 0.1;
/// highlight キーワードによるスコア加算
const HIGHLIGHT_SCORE_BONUS: f64 = 2.0;

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
    // PERF-03: Single CTE query replaces 5 sequential queries (~5x fewer round-trips)
    // DWELL_BONUS_CAP (2.0) enforced via MIN() in the SQL expression
    let rows: Vec<(i64, f64)> = sqlx::query_as(
        "WITH
          bookmarks AS (
            SELECT id AS article_id, 3.0 AS bonus FROM articles WHERE is_bookmarked = 1 AND is_duplicate = 0
          ),
          deepdives AS (
            SELECT DISTINCT article_id, 1.0 AS bonus FROM article_interactions WHERE action = 'deepdive'
          ),
          dwell_stats AS (
            SELECT article_id,
                   AVG(dwell_seconds) AS avg_dwell,
                   (SELECT AVG(dwell_seconds) FROM article_interactions WHERE dwell_seconds > 0) AS global_avg
            FROM article_interactions WHERE dwell_seconds > 0 GROUP BY article_id
          ),
          feed_engagement AS (
            SELECT a.id AS article_id,
                   CAST(SUM(CASE WHEN ai.action = 'open' THEN 1 ELSE 0 END) AS REAL)
                   / CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END * 1.5 AS bonus
            FROM articles a
            JOIN article_interactions ai ON ai.article_id = a.id
            WHERE a.is_duplicate = 0
            GROUP BY a.id
          )
        SELECT
          a.id AS article_id,
          COALESCE(b.bonus, 0.0) + COALESCE(d.bonus, 0.0) + COALESCE(fe.bonus, 0.0)
          + CASE WHEN ds.avg_dwell > ds.global_avg
                 THEN MIN((ds.avg_dwell - ds.global_avg) / 30.0 * 0.5, 2.0)
                 ELSE 0.0 END AS total_bonus
        FROM articles a
        LEFT JOIN bookmarks b ON b.article_id = a.id
        LEFT JOIN deepdives d ON d.article_id = a.id
        LEFT JOIN dwell_stats ds ON ds.article_id = a.id
        LEFT JOIN feed_engagement fe ON fe.article_id = a.id
        WHERE a.is_duplicate = 0
        ORDER BY a.published_at DESC LIMIT ?",
    )
    .bind(SCORING_ARTICLE_LIMIT)
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().collect())
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

    // キーワードフィルター読み込み
    let filters: Vec<(String, String)> = sqlx::query_as(
        "SELECT keyword, filter_type FROM keyword_filters",
    )
    .fetch_all(db)
    .await?;

    let mute_keywords: Vec<String> = filters
        .iter()
        .filter(|(_, ft)| ft == "mute")
        .map(|(k, _)| k.to_lowercase())
        .collect();
    let highlight_keywords: Vec<String> = filters
        .iter()
        .filter(|(_, ft)| ft == "highlight")
        .map(|(k, _)| k.to_lowercase())
        .collect();

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
        let mut total = base * 0.3 + personal * 0.4 + interaction * 0.3;

        // キーワードフィルター適用（total 計算後に適用し mute が確実に抑制されるように）
        let title_lower = title.to_lowercase();
        if mute_keywords.iter().any(|k| title_lower.contains(k)) {
            total *= MUTE_SCORE_FACTOR;
        }
        if highlight_keywords.iter().any(|k| title_lower.contains(k)) {
            total += HIGHLIGHT_SCORE_BONUS;
        }

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

    #[test]
    fn test_dwell_bonus_calculation() {
        // 30秒超過 → +0.5、60秒超過 → +1.0、上限2.0
        let global_avg = 20.0;
        let test_cases = [
            (20.0, 0.0),  // 平均と同じ → ボーナスなし
            (50.0, 0.5),  // 30秒超過 → +0.5
            (80.0, 1.0),  // 60秒超過 → +1.0
            (200.0, 2.0), // 180秒超過 → 上限2.0に制限
        ];
        for (avg_dwell, expected) in &test_cases {
            let excess: f64 = avg_dwell - global_avg;
            let bonus: f64 = if excess > 0.0 {
                (excess / 30.0 * 0.5).min(DWELL_BONUS_CAP)
            } else {
                0.0
            };
            assert!(
                (bonus - expected).abs() < 0.001,
                "avg_dwell={avg_dwell}, expected={expected}, got={bonus}"
            );
        }
    }

    #[test]
    fn test_mute_keyword_suppresses_score() {
        // mute 適用後のスコアが元の10%になる
        let original_score = 5.0;
        let suppressed = original_score * MUTE_SCORE_FACTOR;
        assert!((suppressed - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_highlight_keyword_boosts_score() {
        // highlight はフラット +2.0
        let original_score = 1.0;
        let boosted = original_score + HIGHLIGHT_SCORE_BONUS;
        assert!((boosted - 3.0).abs() < 0.001);
    }

    // --- エッジケーステスト (TEST-04) ---

    /// お気に入りがすべて空のとき personal score は 0.0 になる
    #[test]
    fn test_calc_personal_score_empty_favorites() {
        let score = calc_personal_score("Some Anime Title", &[], &[], &[]);
        assert_eq!(score, 0.0, "空のお気に入りは personal score = 0.0 になるべき");
    }

    /// published_at が None のとき fallback score 0.3 を返す
    #[test]
    fn test_calc_base_score_none_published_at() {
        let score = calc_base_score(&None);
        assert!(
            (score - 0.3).abs() < 0.01,
            "published_at = None は ~0.3 を返すべき、実際: {score}"
        );
    }

    /// 73 時間前の記事は 0〜1 時間前の記事より低いスコアになる
    #[test]
    fn test_calc_base_score_73h_old_article() {
        let old_date =
            (Utc::now() - chrono::Duration::hours(73)).to_rfc3339();
        let old_score = calc_base_score(&Some(old_date));
        let recent_score = calc_base_score(&Some(Utc::now().to_rfc3339()));
        assert!(
            old_score < recent_score,
            "73h 前の記事 ({old_score}) は新着記事 ({recent_score}) より低くなるべき"
        );
    }

    /// 日付文字列がパースできない場合も fallback を返しパニックしない
    #[test]
    fn test_calc_base_score_unparseable_date() {
        let score = calc_base_score(&Some("not-a-date".to_string()));
        assert!(
            score >= 0.0 && score <= 1.0,
            "パース不能な日付は有効な fallback スコアを返すべき、実際: {score}"
        );
    }

    /// dwell bonus cap: 過剰な dwell 超過は DWELL_BONUS_CAP (2.0) に頭打ちになる
    #[test]
    fn test_dwell_bonus_cap() {
        let excess = 1000.0_f64; // 1000 秒超過
        let dwell_bonus = (excess / 30.0 * 0.5).min(DWELL_BONUS_CAP);
        assert_eq!(
            dwell_bonus, DWELL_BONUS_CAP,
            "dwell ボーナスは DWELL_BONUS_CAP ({DWELL_BONUS_CAP}) を超えてはならない"
        );
    }

    /// 空の DB に対して batch_interaction_bonuses は空の HashMap を返す (PERF-03 CTE クエリ検証)
    #[tokio::test]
    async fn test_batch_interaction_bonuses_empty_db() {
        let db = crate::services::test_helpers::setup_test_db().await;
        let bonuses = batch_interaction_bonuses(&db).await.unwrap();
        assert!(bonuses.is_empty(), "空の DB はボーナス空マップを返すべき");
    }

    /// 空の DB に対して rescore_all は 0 を返す (user_profile は setup_test_db が seed 済み)
    #[tokio::test]
    async fn test_rescore_all_empty_db() {
        let db = crate::services::test_helpers::setup_test_db().await;
        let count = rescore_all(&db).await.unwrap();
        assert_eq!(count, 0, "空の DB の rescore_all は 0 を返すべき");
    }
}
