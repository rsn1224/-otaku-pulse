use super::*;

#[test]
fn test_convert_entry_without_title() {
    let entry = feed_rs::model::Entry::default();

    let article = convert_entry_to_article(entry, 1);

    assert!(article.is_none());
}

#[test]
fn test_parse_rss_feed() {
    let rss_content = r##"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Test Feed</title>
<item>
<title>Test Article</title>
<link>https://example.com/article</link>
<description>Test description</description>
<pubDate>Wed, 18 Jun 2024 12:00:00 GMT</pubDate>
</item>
</channel>
</rss>"##;

    let result = parse_rss_feed(rss_content.as_bytes(), 1);

    assert!(result.is_ok());
    let articles = result.unwrap();
    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Test Article");
    assert_eq!(
        articles[0].url,
        Some("https://example.com/article".to_string())
    );
}

#[test]
fn test_parse_atom_feed() {
    let atom_content = r##"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Test Feed</title>
<entry>
<title>Test Article</title>
<link href="https://example.com/article" />
<summary>Test description</summary>
<updated>2024-06-18T12:00:00Z</updated>
</entry>
</feed>"##;

    let result = parse_rss_feed(atom_content.as_bytes(), 1);

    assert!(result.is_ok());
    let articles = result.unwrap();
    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Test Article");
    assert_eq!(
        articles[0].url,
        Some("https://example.com/article".to_string())
    );
}
