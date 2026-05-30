//! ユーザー定義ソースのフェッチ/抽出 (機能B)
//!
//! 2 種類のユーザー定義ソースを扱う:
//!   * `scraper`    — 任意 HTML ページを CSS selector で抽出 (`scraper` crate)
//!   * `custom-api` — 任意 JSON エンドポイントを field 名マッピングで抽出
//!
//! 設定は `feeds.config` の JSON 文字列に格納する。HTTP 取得は infra 層の責務として
//! ここで行い、抽出ロジックは純粋関数として切り出してテスト可能にする。
//!
//! 注意: `scraper::Html` / `Selector` は `!Send` のため、HTML パースは `.await` を
//! 跨がない同期スコープ (`scrape_html`) 内で完結させる。

use crate::error::AppError;
use crate::models::Article;
use scraper::{Html, Selector};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;

/// ユーザー指定 URL 取得の per-request タイムアウト。
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);
/// 取得本文のサイズ上限 (OOM / 巨大レスポンス対策)。
const MAX_BODY_BYTES: usize = 5 * 1024 * 1024;

/// HTML スクレイピング設定 (`feed_type = 'scraper'`)。
#[derive(Debug, Deserialize)]
pub struct ScrapeConfig {
    /// 各記事コンテナを選ぶ CSS selector。
    pub item: String,
    /// item 内のタイトル selector。
    pub title: String,
    /// item 内のリンク selector (href 属性を採用)。省略時は item 内最初の `<a>`。
    #[serde(default)]
    pub link: Option<String>,
    /// item 内の要約 selector (省略可)。
    #[serde(default)]
    pub summary: Option<String>,
    /// 相対リンク解決用のベース URL (省略可)。
    #[serde(default)]
    pub base_url: Option<String>,
}

/// JSON API 設定 (`feed_type = 'custom-api'`)。
#[derive(Debug, Deserialize)]
pub struct ApiConfig {
    /// 配列までのドットパス (例 `"data.items"`)。省略時はルートが配列。
    #[serde(default)]
    pub items_path: Option<String>,
    /// タイトルの field 名。
    pub title: String,
    /// リンクの field 名 (省略可)。
    #[serde(default)]
    pub link: Option<String>,
    /// 要約の field 名 (省略可)。
    #[serde(default)]
    pub summary: Option<String>,
    /// 外部 ID の field 名 (省略可)。
    #[serde(default)]
    pub id: Option<String>,
}

/// 任意 URL を GET して本文文字列を返す。
///
/// ユーザー指定の任意 URL を取得するため、per-request タイムアウトと本文サイズ上限を課す:
///   * `Content-Length` が上限超過なら即拒否
///   * ヘッダが無い場合もチャンク累積で上限を監視
///   * 上限内で読み切った後 UTF-8 (lossy) としてデコードする
pub async fn fetch_text(http: &Arc<reqwest::Client>, url: &str) -> Result<String, AppError> {
    let mut resp = http
        .get(url)
        .timeout(FETCH_TIMEOUT)
        .send()
        .await?
        .error_for_status()?;

    if let Some(len) = resp.content_length()
        && len as usize > MAX_BODY_BYTES
    {
        return Err(AppError::InvalidInput(format!(
            "取得サイズが上限 ({} MiB) を超えています: {len} bytes",
            MAX_BODY_BYTES / (1024 * 1024)
        )));
    }

    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = resp.chunk().await? {
        if buf.len() + chunk.len() > MAX_BODY_BYTES {
            return Err(AppError::InvalidInput(format!(
                "取得サイズが上限 ({} MiB) を超えています",
                MAX_BODY_BYTES / (1024 * 1024)
            )));
        }
        buf.extend_from_slice(&chunk);
    }

    Ok(String::from_utf8_lossy(&buf).into_owned())
}

/// HTML を CSS selector で抽出して Article 列にする (純粋・同期)。
pub fn scrape_html(html: &str, feed_id: i64, cfg: &ScrapeConfig) -> Result<Vec<Article>, AppError> {
    let doc = Html::parse_document(html);

    let item_sel = parse_selector(&cfg.item)?;
    let title_sel = parse_selector(&cfg.title)?;
    let link_sel = match &cfg.link {
        Some(s) => Some(parse_selector(s)?),
        None => None,
    };
    let summary_sel = match &cfg.summary {
        Some(s) => Some(parse_selector(s)?),
        None => None,
    };
    let fallback_link_sel = parse_selector("a")?;

    let now = chrono::Utc::now().to_rfc3339();
    let mut articles = Vec::new();

    for item in doc.select(&item_sel) {
        let title = item
            .select(&title_sel)
            .next()
            .map(|e| collapse_ws(&e.text().collect::<String>()))
            .filter(|t| !t.is_empty());

        let Some(title) = title else {
            continue;
        };

        let href = link_sel
            .as_ref()
            .and_then(|sel| item.select(sel).next())
            .or_else(|| item.select(&fallback_link_sel).next())
            .and_then(|e| e.value().attr("href"))
            .map(|h| resolve_url(cfg.base_url.as_deref(), h));

        let summary = summary_sel
            .as_ref()
            .and_then(|sel| item.select(sel).next())
            .map(|e| collapse_ws(&e.text().collect::<String>()))
            .filter(|s| !s.is_empty());

        let external_id = href.clone().unwrap_or_else(|| format!("scrape:{title}"));

        articles.push(make_article(
            feed_id,
            external_id,
            title,
            href,
            summary,
            now.clone(),
        ));
    }

    Ok(articles)
}

/// JSON 本文を field マッピングで抽出して Article 列にする (純粋・同期)。
pub fn parse_api_json(body: &str, feed_id: i64, cfg: &ApiConfig) -> Result<Vec<Article>, AppError> {
    let root: serde_json::Value =
        serde_json::from_str(body).map_err(|e| AppError::Parse(format!("custom-api JSON: {e}")))?;

    let array = match &cfg.items_path {
        Some(path) => dig(&root, path).and_then(|v| v.as_array()),
        None => root.as_array(),
    };
    let Some(array) = array else {
        return Err(AppError::Parse(
            "custom-api: 指定パスに配列が見つかりません".to_string(),
        ));
    };

    let now = chrono::Utc::now().to_rfc3339();
    let mut articles = Vec::with_capacity(array.len());

    for obj in array {
        let Some(title) = str_field(obj, &cfg.title) else {
            continue;
        };
        let link = cfg.link.as_deref().and_then(|k| str_field(obj, k));
        let summary = cfg.summary.as_deref().and_then(|k| str_field(obj, k));
        let id = cfg
            .id
            .as_deref()
            .and_then(|k| str_field(obj, k))
            .or_else(|| link.clone())
            .unwrap_or_else(|| format!("api:{title}"));

        articles.push(make_article(feed_id, id, title, link, summary, now.clone()));
    }

    Ok(articles)
}

fn parse_selector(sel: &str) -> Result<Selector, AppError> {
    Selector::parse(sel)
        .map_err(|e| AppError::InvalidInput(format!("不正な CSS selector '{sel}': {e}")))
}

/// ドットパス (`a.b.c`) で JSON をたどる。
fn dig<'a>(v: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut cur = v;
    for key in path.split('.') {
        cur = cur.get(key)?;
    }
    Some(cur)
}

fn str_field(obj: &serde_json::Value, key: &str) -> Option<String> {
    obj.get(key).and_then(|v| match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    })
}

/// 相対 URL を base で解決する。base 無し・解決失敗時は href をそのまま返す。
fn resolve_url(base: Option<&str>, href: &str) -> String {
    if let Some(base) = base
        && let Ok(base_url) = url::Url::parse(base)
        && let Ok(joined) = base_url.join(href)
    {
        return joined.to_string();
    }
    href.to_string()
}

fn collapse_ws(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn make_article(
    feed_id: i64,
    external_id: String,
    title: String,
    url: Option<String>,
    summary: Option<String>,
    created_at: String,
) -> Article {
    Article {
        id: 0,
        feed_id,
        external_id: Some(external_id),
        title,
        url,
        url_normalized: None,
        content: summary.clone(),
        summary,
        author: None,
        published_at: Some(created_at.clone()),
        importance_score: 0.0,
        is_read: false,
        is_bookmarked: false,
        is_duplicate: false,
        duplicate_of: None,
        language: None,
        thumbnail_url: None,
        content_hash: None,
        metadata: None,
        created_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrape_extracts_items() {
        let html = r#"
            <html><body>
              <article class="post">
                <h2 class="t"><a href="/a">First Post</a></h2>
                <p class="ex">Summary A</p>
              </article>
              <article class="post">
                <h2 class="t"><a href="https://x.test/b">Second</a></h2>
                <p class="ex">Summary B</p>
              </article>
            </body></html>
        "#;
        let cfg = ScrapeConfig {
            item: "article.post".into(),
            title: "h2.t a".into(),
            link: Some("h2.t a".into()),
            summary: Some("p.ex".into()),
            base_url: Some("https://x.test".into()),
        };
        let arts = scrape_html(html, 7, &cfg).unwrap();
        assert_eq!(arts.len(), 2);
        assert_eq!(arts[0].title, "First Post");
        assert_eq!(arts[0].url.as_deref(), Some("https://x.test/a"));
        assert_eq!(arts[0].summary.as_deref(), Some("Summary A"));
        assert_eq!(arts[1].url.as_deref(), Some("https://x.test/b"));
    }

    #[test]
    fn scrape_invalid_selector_errors() {
        let cfg = ScrapeConfig {
            item: ">>>bad".into(),
            title: "a".into(),
            link: None,
            summary: None,
            base_url: None,
        };
        assert!(scrape_html("<html></html>", 1, &cfg).is_err());
    }

    #[test]
    fn api_parse_with_path() {
        let body = r#"{"data":{"items":[
            {"id":"1","name":"A","href":"https://x/1","desc":"da"},
            {"id":"2","name":"B","href":"https://x/2"}
        ]}}"#;
        let cfg = ApiConfig {
            items_path: Some("data.items".into()),
            title: "name".into(),
            link: Some("href".into()),
            summary: Some("desc".into()),
            id: Some("id".into()),
        };
        let arts = parse_api_json(body, 3, &cfg).unwrap();
        assert_eq!(arts.len(), 2);
        assert_eq!(arts[0].title, "A");
        assert_eq!(arts[0].external_id.as_deref(), Some("1"));
        assert_eq!(arts[0].summary.as_deref(), Some("da"));
        assert_eq!(arts[1].external_id.as_deref(), Some("2"));
    }

    #[test]
    fn api_parse_root_array() {
        let body = r#"[{"title":"X","url":"u"}]"#;
        let cfg = ApiConfig {
            items_path: None,
            title: "title".into(),
            link: Some("url".into()),
            summary: None,
            id: None,
        };
        let arts = parse_api_json(body, 1, &cfg).unwrap();
        assert_eq!(arts.len(), 1);
        // id field 省略 → link を external_id に
        assert_eq!(arts[0].external_id.as_deref(), Some("u"));
    }
}
