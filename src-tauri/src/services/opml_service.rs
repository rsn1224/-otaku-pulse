use crate::error::AppError;
use crate::models::Feed;

/// OPML XML を生成
pub fn export_opml(feeds: &[Feed]) -> String {
    let mut opml = String::new();
    opml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    opml.push('\n');
    opml.push_str(r#"<opml version="2.0">"#);
    opml.push('\n');
    opml.push_str("  <head>\n");
    opml.push_str("    <title>OtakuPulse Feeds</title>\n");
    opml.push_str("  </head>\n");
    opml.push_str("  <body>\n");

    // カテゴリーでグループ化
    let mut categories = std::collections::HashMap::new();
    for feed in feeds {
        categories
            .entry(feed.category.clone())
            .or_insert_with(Vec::new)
            .push(feed);
    }

    for (category, category_feeds) in categories {
        opml.push_str(&format!(
            "    <outline text=\"{}\" title=\"{}\">\n",
            category, category
        ));

        for feed in category_feeds {
            opml.push_str(&format!(
                "      <outline type=\"rss\" text=\"{}\" xmlUrl=\"{}\" />\n",
                escape_xml(&feed.name),
                escape_xml(&feed.url)
            ));
        }

        opml.push_str("    </outline>\n");
    }

    opml.push_str("  </body>\n");
    opml.push_str("</opml>\n");

    opml
}

/// OPML XML からフィードをパース
pub fn parse_opml(xml: &str) -> Result<Vec<(String, String, String)>, AppError> {
    // 簡単なXMLパーサー実装
    let mut feeds = Vec::new();
    let mut current_category = String::new();

    for line in xml.lines() {
        let trimmed = line.trim();

        // カテゴリー開始タグ
        if trimmed.starts_with("<outline")
            && !trimmed.contains("type=")
            && let Some(category) = extract_attribute(trimmed, "text")
        {
            current_category = category;
        }

        // RSSフィード
        if trimmed.starts_with("<outline")
            && trimmed.contains("type=\"rss\"")
            && let (Some(name), Some(url)) = (
                extract_attribute(trimmed, "text"),
                extract_attribute(trimmed, "xmlUrl"),
            )
        {
            feeds.push((name, url, current_category.clone()));
        }
    }

    Ok(feeds)
}

/// XML文字をエスケープ
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// XML属性値を抽出
fn extract_attribute(line: &str, attr: &str) -> Option<String> {
    let pattern = format!(r#"{}=""#, attr);
    if let Some(start) = line.find(&pattern) {
        let start = start + pattern.len();
        if let Some(end) = line[start..].find('"') {
            return Some(line[start..start + end].to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_opml() {
        let feeds = vec![Feed {
            id: 1,
            name: "Test Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            feed_type: "rss".to_string(),
            category: "anime".to_string(),
            enabled: true,
            fetch_interval_minutes: 60,
            last_fetched_at: None,
            consecutive_errors: 0,
            disabled_reason: None,
            last_error: None,
            etag: None,
            last_modified: None,
            created_at: "2023-01-01".to_string(),
            updated_at: "2023-01-01".to_string(),
        }];

        let opml = export_opml(&feeds);
        assert!(opml.contains("<opml version=\"2.0\">"));
        assert!(opml.contains("<title>OtakuPulse Feeds</title>"));
        assert!(opml.contains("<outline text=\"anime\""));
        assert!(opml.contains("xmlUrl=\"https://example.com/rss\""));
    }

    #[test]
    fn test_parse_opml() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>OtakuPulse Feeds</title>
  </head>
  <body>
    <outline text="anime" title="anime">
      <outline type="rss" text="Test Feed" xmlUrl="https://example.com/rss" />
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(
            feeds[0],
            (
                "Test Feed".to_string(),
                "https://example.com/rss".to_string(),
                "anime".to_string()
            )
        );
    }
}
