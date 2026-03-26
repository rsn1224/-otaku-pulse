use crate::error::AppError;

#[derive(Default)]
pub struct FeedCache {
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

/// RSS フィードを取得。304 の場合は None を返す。
pub async fn fetch_rss(
    client: &reqwest::Client,
    url: &str,
    cache: &FeedCache,
) -> Result<Option<(Vec<u8>, FeedCache)>, AppError> {
    let mut request = client.get(url);

    // If-None-Match / If-Modified-Since ヘッダーを付与
    if let Some(etag) = &cache.etag {
        request = request.header("If-None-Match", etag);
    }
    if let Some(last_modified) = &cache.last_modified {
        request = request.header("If-Modified-Since", last_modified);
    }

    let response = request.send().await?;

    match response.status().as_u16() {
        304 => Ok(None), // Not Modified
        200 => {
            // Extract headers before consuming response
            let new_cache = FeedCache {
                etag: response
                    .headers()
                    .get("ETag")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string()),
                last_modified: response
                    .headers()
                    .get("Last-Modified")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string()),
            };

            let body = response.bytes().await?.to_vec();

            Ok(Some((body, new_cache)))
        }
        status => Err(AppError::NetworkError(format!(
            "Failed to fetch RSS feed: HTTP {}",
            status
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::http_client;
    use std::sync::Arc;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_fetch_rss_not_modified() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/feed"))
            .and(header("If-None-Match", "\"test-etag\""))
            .respond_with(ResponseTemplate::new(304))
            .mount(&mock_server)
            .await;

        let client = Arc::new(http_client::build_http_client());
        let cache = FeedCache {
            etag: Some("\"test-etag\"".to_string()),
            last_modified: None,
        };

        let result = fetch_rss(&client, &format!("{}/feed", mock_server.uri()), &cache).await;

        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_fetch_rss_modified() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/feed"))
            .and(header("If-None-Match", "\"old-etag\""))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("ETag", "\"new-etag\"")
                    .insert_header("Last-Modified", "Wed, 21 Oct 2015 07:28:00 GMT")
                    .set_body_bytes(b"<rss></rss>"),
            )
            .mount(&mock_server)
            .await;

        let client = Arc::new(http_client::build_http_client());
        let cache = FeedCache {
            etag: Some("\"old-etag\"".to_string()),
            last_modified: None,
        };

        let result = fetch_rss(&client, &format!("{}/feed", mock_server.uri()), &cache).await;

        assert!(result.is_ok());
        let (body, new_cache) = result.unwrap().unwrap();
        assert_eq!(body, b"<rss></rss>");
        assert_eq!(new_cache.etag, Some("\"new-etag\"".to_string()));
        assert_eq!(
            new_cache.last_modified,
            Some("Wed, 21 Oct 2015 07:28:00 GMT".to_string())
        );
    }

    #[tokio::test]
    async fn test_fetch_rss_no_cache() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/feed"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("ETag", "\"test-etag\"")
                    .set_body_bytes(b"<rss></rss>"),
            )
            .mount(&mock_server)
            .await;

        let client = Arc::new(http_client::build_http_client());
        let cache = FeedCache::default();

        let result = fetch_rss(&client, &format!("{}/feed", mock_server.uri()), &cache).await;

        assert!(result.is_ok());
        let (body, new_cache) = result.unwrap().unwrap();
        assert_eq!(body, b"<rss></rss>");
        assert_eq!(new_cache.etag, Some("\"test-etag\"".to_string()));
    }
}
