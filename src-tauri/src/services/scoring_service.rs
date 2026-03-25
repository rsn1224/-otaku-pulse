use crate::models::Article;
use chrono::{DateTime, Utc};

/// 記事の新鮮度を計算 (0.0-1.0)
fn calculate_freshness(published_at: &Option<String>) -> f64 {
    if let Some(date_str) = published_at {
        if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
            let now = Utc::now();
            let hours_ago = (now - dt.with_timezone(&Utc)).num_hours();

            // 24時間以内: 1.0、48時間以内: 0.5、それ以上: 0.0
            if hours_ago <= 24 {
                1.0
            } else if hours_ago <= 48 {
                0.5
            } else {
                0.0
            }
        } else {
            0.5 // パース失敗時は中間スコア
        }
    } else {
        0.5 // 日付なしは中間スコア
    }
}

/// カテゴリー別キーワードマッチングスコア (0.0-0.3)
fn keyword_match_score(title: &str, category: &str) -> f64 {
    let keywords = match category {
        "anime" => vec![
            "新作",
            "アニメ化",
            "放送開始",
            "決定",
            "pv",
            "cm",
            "予告編",
            "第弾",
            "シリーズ",
            "キャスト",
            "スタッフ",
            "制作",
            "原作",
            "漫画",
            "ライトノベル",
            "ゲーム",
            "特報",
            "情報解禁",
        ],
        "manga" => vec![
            "連載開始",
            "新連載",
            "最終回",
            "アニメ化",
            "ドラマ化",
            "実写化",
            "単行本",
            "コミックス",
            "週刊",
            "月刊",
            "web漫画",
            "配信",
            "アプリ",
            "電子書籍",
            "巻",
            "話",
        ],
        "game" => vec![
            "発売",
            "dlc",
            "アップデート",
            "イベント",
            "キャンペーン",
            "セール",
            "限定",
            "コラボ",
            "シーズン",
            "パス",
            "beta",
            "alpha",
            "クローズド",
            "オープン",
            "プレ配信",
            "demo",
            "体験版",
        ],
        "pc" => vec![
            "gpu",
            "cpu",
            "ram",
            "ssd",
            "hdd",
            "windows",
            "linux",
            "mac",
            "driver",
            "bios",
            "uefi",
            "overclock",
            "水冷",
            "空冷",
            "ケース",
            "電源",
            "マザーボード",
            "メモリ",
        ],
        _ => return 0.0,
    };

    let title_lower = title.to_lowercase();
    let mut matches = 0;

    for keyword in keywords {
        if title_lower.contains(&keyword.to_lowercase()) {
            matches += 1;
        }
    }

    // キーワードマッチ数に応じてスコア (最大0.3)
    (matches as f64 * 0.1).min(0.3)
}

/// 重要度スコアを計算 (0.0-1.0)
pub fn calculate_importance(article: &Article, category: &str) -> f64 {
    let freshness = calculate_freshness(&article.published_at);
    let keyword_score = keyword_match_score(&article.title, category);
    let content_score = if article.content.is_some() || article.summary.is_some() {
        0.2
    } else {
        0.0
    };

    // 既存の重要度スコアを考慮 (0-1)
    let base_score = article.importance_score.clamp(0.0, 1.0);

    let total = base_score * 0.5 + freshness * 0.2 + keyword_score + content_score;

    // 最終的なスコアを0.0-1.0にクランプ
    total.clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Article;

    fn make_article(title: &str, content: Option<&str>, published_at: Option<&str>) -> Article {
        Article {
            id: 1,
            feed_id: 1,
            external_id: None,
            title: title.to_string(),
            url: None,
            url_normalized: None,
            content: content.map(|s| s.to_string()),
            summary: None,
            author: None,
            published_at: published_at.map(|s| s.to_string()),
            importance_score: 0.5,
            is_read: false,
            is_bookmarked: false,
            is_duplicate: false,
            duplicate_of: None,
            language: None,
            thumbnail_url: None,
            content_hash: None,
            metadata: None,
            created_at: String::new(),
        }
    }

    #[test]
    fn test_freshness_recent() {
        let now = Utc::now().to_rfc3339();
        let f = calculate_freshness(&Some(now));
        assert!(f > 0.9, "freshness={f}");
    }

    #[test]
    fn test_freshness_old() {
        let f = calculate_freshness(&Some("2020-01-01T00:00:00Z".to_string()));
        assert!((f - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_freshness_missing() {
        assert!((calculate_freshness(&None) - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_keyword_anime() {
        let score = keyword_match_score("新作アニメ化決定PV公開", "anime");
        assert!(score >= 0.3, "score={score}");
    }

    #[test]
    fn test_keyword_none() {
        let score = keyword_match_score("ordinary title", "anime");
        assert!((score - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_calculate_importance() {
        let article = make_article(
            "新作アニメ放送開始のお知らせ",
            Some("content"),
            Some(&Utc::now().to_rfc3339()),
        );
        let score = calculate_importance(&article, "anime");
        assert!(score > 0.5, "score={score}");
        assert!(score <= 1.0);
    }

    #[test]
    fn test_score_clamped() {
        let article = make_article("a", None, None);
        let score = calculate_importance(&article, "unknown");
        assert!(score >= 0.0 && score <= 1.0);
    }
}
