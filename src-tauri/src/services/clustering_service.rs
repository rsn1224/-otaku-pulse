/// トピッククラスタリングサービス (v1.1, ADR-102)
///
/// キーワードベースの Jaccard 類似度で記事をクラスタリングし、
/// `topic_clusters` / `cluster_articles` テーブルに永続化する。
///
/// スコアリング式:
///   similarity = jaccard(keywords_a, keywords_b) * 0.5
///              + time_proximity(published_a, published_b) * 0.3
///              + feed_diversity_bonus * 0.2
///
/// 閾値(CLUSTER_THRESHOLD = 0.45)を超えたペアを貪欲クラスタリング。
/// 3件未満のクラスタは除外。
use crate::error::AppError;
use crate::models::{ClusterGroup, DiscoverArticleDto};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use tracing::info;

const CLUSTER_THRESHOLD: f64 = 0.45;
const MIN_CLUSTER_SIZE: usize = 3;
const CLUSTER_MAX_ARTICLES: i64 = 500; // クラスタリング対象記事数上限
const CLUSTER_EXPIRES_DAYS: i64 = 7;

/// キーワード抽出: CJK 連続ブロック + ASCII アルファベット単語
fn extract_keywords(text: &str) -> HashSet<String> {
    let mut keywords = HashSet::new();
    let text_lower = text.to_lowercase();

    // CJK (漢字・ひらがな・カタカナ) の連続2文字以上を抽出
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if is_cjk(c) {
            let mut j = i + 1;
            while j < chars.len() && is_cjk(chars[j]) {
                j += 1;
            }
            if j - i >= 2 {
                let chunk: String = chars[i..j].iter().collect();
                // 2文字バイグラムとチャンク全体を登録
                for k in 0..chunk.chars().count().saturating_sub(1) {
                    let bigram: String = chunk.chars().skip(k).take(2).collect();
                    keywords.insert(bigram);
                }
                keywords.insert(chunk);
            }
            i = j;
        } else {
            i += 1;
        }
    }

    // ASCII アルファベット単語（3文字以上）
    for word in text_lower.split(|c: char| !c.is_alphanumeric()) {
        if word.len() >= 3 && word.chars().all(|c| c.is_ascii_alphabetic()) {
            keywords.insert(word.to_string());
        }
    }

    keywords
}

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{3000}'..='\u{9FFF}'  // CJK + 仮名
        | '\u{F900}'..='\u{FAFF}'
        | '\u{20000}'..='\u{2A6DF}'
    )
}

/// Jaccard 類似度
fn jaccard(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }
    let intersection = a.intersection(b).count() as f64;
    let union = a.union(b).count() as f64;
    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

/// 時間近接性スコア (0..=1.0)
fn time_proximity(published_a: &Option<String>, published_b: &Option<String>) -> f64 {
    let parse = |s: &str| -> Option<i64> {
        chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.timestamp())
            .or_else(|| {
                // "YYYY-MM-DD" 形式にも対応
                chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp())
            })
    };

    match (
        published_a.as_deref().and_then(parse),
        published_b.as_deref().and_then(parse),
    ) {
        (Some(ta), Some(tb)) => {
            let diff_hours = (ta - tb).unsigned_abs() as f64 / 3600.0;
            // 0h → 1.0, 24h → 0.5, 48h → 0.25, 168h(7日) → ~0
            (1.0 / (1.0 + diff_hours / 24.0)).min(1.0)
        }
        _ => 0.5, // 日時不明の場合は中間値
    }
}

struct ArticleNode {
    id: i64,
    feed_id: i64,
    title: String,
    published_at: Option<String>,
    keywords: HashSet<String>,
}

/// 全クラスタリング処理: 記事取得 → 類似度計算 → 貪欲クラスタリング → 永続化
pub async fn cluster_articles(db: &SqlitePool) -> Result<usize, AppError> {
    // 過去7日間の記事を取得
    let rows: Vec<(i64, i64, String, Option<String>)> = sqlx::query_as(
        "SELECT id, feed_id, title, published_at
         FROM articles
         WHERE is_duplicate = 0
           AND (published_at >= datetime('now', '-7 days') OR published_at IS NULL)
         ORDER BY published_at DESC
         LIMIT ?",
    )
    .bind(CLUSTER_MAX_ARTICLES)
    .fetch_all(db)
    .await?;

    if rows.len() < MIN_CLUSTER_SIZE {
        return Ok(0);
    }

    let nodes: Vec<ArticleNode> = rows
        .into_iter()
        .map(|(id, feed_id, title, published_at)| {
            let keywords = extract_keywords(&title);
            ArticleNode {
                id,
                feed_id,
                title,
                published_at,
                keywords,
            }
        })
        .collect();

    // 貪欲クラスタリング: 各記事を未割当であれば新クラスタの代表に
    let mut assigned: HashMap<i64, usize> = HashMap::new(); // article_id → cluster_idx
    let mut clusters: Vec<Vec<usize>> = Vec::new(); // cluster_idx → [node_idx]

    for i in 0..nodes.len() {
        if assigned.contains_key(&nodes[i].id) {
            continue;
        }

        let mut cluster = vec![i];
        assigned.insert(nodes[i].id, clusters.len());

        for j in (i + 1)..nodes.len() {
            if assigned.contains_key(&nodes[j].id) {
                continue;
            }

            // 代表記事との類似度計算
            let jac = jaccard(&nodes[i].keywords, &nodes[j].keywords);
            let time = time_proximity(&nodes[i].published_at, &nodes[j].published_at);
            // フィード多様性ボーナス: 異なるフィードの組み合わせは +0.2
            let diversity = if nodes[i].feed_id != nodes[j].feed_id {
                0.2
            } else {
                0.0
            };
            let sim = jac * 0.5 + time * 0.3 + diversity;

            if sim >= CLUSTER_THRESHOLD {
                assigned.insert(nodes[j].id, clusters.len());
                cluster.push(j);
            }
        }

        clusters.push(cluster);
    }

    // 既存クラスタを削除して再生成
    sqlx::query("DELETE FROM cluster_articles")
        .execute(db)
        .await?;
    sqlx::query("DELETE FROM topic_clusters")
        .execute(db)
        .await?;

    let mut saved_clusters = 0;
    let expires_at = (chrono::Utc::now() + chrono::Duration::days(CLUSTER_EXPIRES_DAYS))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    for cluster_nodes in &clusters {
        if cluster_nodes.len() < MIN_CLUSTER_SIZE {
            continue;
        }

        let representative_id = nodes[cluster_nodes[0]].id;
        // クラスタラベル = 代表記事のタイトル先頭20文字
        let label: String = nodes[cluster_nodes[0]].title.chars().take(20).collect();

        // category は代表記事のフィードカテゴリを取得
        let category: Option<String> = sqlx::query_scalar(
            "SELECT f.category FROM articles a JOIN feeds f ON f.id = a.feed_id WHERE a.id = ?",
        )
        .bind(representative_id)
        .fetch_optional(db)
        .await?;
        let category = category.unwrap_or_else(|| "news".to_string());

        let cluster_id: i64 = sqlx::query_scalar(
            "INSERT INTO topic_clusters
               (label, category, article_count, representative_article_id, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING id",
        )
        .bind(&label)
        .bind(&category)
        .bind(cluster_nodes.len() as i64)
        .bind(representative_id)
        .bind(&expires_at)
        .fetch_one(db)
        .await?;

        for &node_idx in cluster_nodes {
            let node = &nodes[node_idx];
            let jac = jaccard(&nodes[cluster_nodes[0]].keywords, &node.keywords);
            let time = time_proximity(&nodes[cluster_nodes[0]].published_at, &node.published_at);
            let similarity = jac * 0.5 + time * 0.5;

            sqlx::query(
                "INSERT OR IGNORE INTO cluster_articles (cluster_id, article_id, similarity)
                 VALUES (?1, ?2, ?3)",
            )
            .bind(cluster_id)
            .bind(node.id)
            .bind(similarity)
            .execute(db)
            .await?;

            // articles.cluster_id を更新
            sqlx::query("UPDATE articles SET cluster_id = ?1 WHERE id = ?2")
                .bind(cluster_id.to_string())
                .bind(node.id)
                .execute(db)
                .await?;
        }

        saved_clusters += 1;
    }

    info!(clusters = saved_clusters, "トピッククラスタリング完了");
    Ok(saved_clusters)
}

const DISCOVER_COLS: &str = "a.id, a.feed_id, a.title, a.url, a.summary, a.author, \
     a.published_at, a.is_read, a.is_bookmarked, a.language, \
     a.thumbnail_url, a.ai_summary, f.name AS feed_name, f.category AS category, \
     a.impact_level, COALESCE(s.total_score, a.importance_score) AS total_score";

/// クラスタ済みフィードを取得する
pub async fn get_clustered_feed(
    db: &SqlitePool,
    category: Option<&str>,
    limit: i64,
) -> Result<Vec<ClusterGroup>, AppError> {
    let cat_filter = match category {
        Some(c) if !c.is_empty() && c != "all" => format!("AND tc.category = '{}'", c),
        _ => String::new(),
    };

    let cluster_rows: Vec<(i64, String, i64, i64)> = sqlx::query_as(&format!(
        "SELECT tc.id, tc.label, tc.representative_article_id, tc.article_count
         FROM topic_clusters tc
         WHERE tc.expires_at > datetime('now') {cat_filter}
         ORDER BY tc.article_count DESC, tc.created_at DESC
         LIMIT ?",
    ))
    .bind(limit)
    .fetch_all(db)
    .await?;

    let mut groups = Vec::with_capacity(cluster_rows.len());

    for (cluster_id, label, representative_id, count) in cluster_rows {
        // 代表記事を取得
        let rep: Option<DiscoverArticleDto> = sqlx::query_as(&format!(
            "SELECT {DISCOVER_COLS}
             FROM articles a JOIN feeds f ON a.feed_id = f.id
             LEFT JOIN article_scores s ON a.id = s.article_id
             WHERE a.id = ?",
        ))
        .bind(representative_id)
        .fetch_optional(db)
        .await?;

        let Some(representative) = rep else { continue };

        // その他の記事を取得（代表を除く上位4件）
        let others: Vec<DiscoverArticleDto> = sqlx::query_as(&format!(
            "SELECT {DISCOVER_COLS}
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN cluster_articles ca ON ca.article_id = a.id
             LEFT JOIN article_scores s ON a.id = s.article_id
             WHERE ca.cluster_id = ? AND a.id != ?
             ORDER BY ca.similarity DESC, a.published_at DESC
             LIMIT 4",
        ))
        .bind(cluster_id)
        .bind(representative_id)
        .fetch_all(db)
        .await?;

        groups.push(ClusterGroup {
            cluster_id,
            label,
            representative,
            others,
            count,
        });
    }

    Ok(groups)
}
