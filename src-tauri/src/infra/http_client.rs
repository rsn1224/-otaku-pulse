use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
#[cfg(test)]
use tokio::time::sleep;
#[cfg(test)]
use tracing::{error, info, warn};

const REQUEST_TIMEOUT_SECS: u64 = 30;
#[cfg(test)]
const MAX_RETRIES: u32 = 3;
#[cfg(test)]
const INITIAL_RETRY_DELAY_MS: u64 = 1000;

/// Builds an HTTP client with proper configuration for OtakuPulse.
pub fn build_http_client() -> Arc<Client> {
    let client = Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .user_agent("OtakuPulse/1.0.0 (personal use)")
        .build()
        .expect("Failed to create HTTP client");

    Arc::new(client)
}

/// Executes an HTTP request with retry logic and exponential backoff.
#[cfg(test)]
pub async fn execute_with_retry<F, Fut>(
    _client: &Arc<Client>,
    request_fn: F,
) -> Result<reqwest::Response, crate::error::AppError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
{
    let mut last_error = None;

    for attempt in 0..=MAX_RETRIES {
        match request_fn().await {
            Ok(response) => {
                let status = response.status();

                // Handle rate limiting (429)
                if status == 429 {
                    if attempt < MAX_RETRIES {
                        // Check for Retry-After header
                        let retry_after = response
                            .headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(60); // Default to 60 seconds

                        info!(
                            "Rate limited. Waiting {} seconds before retry {}/{}",
                            retry_after,
                            attempt + 1,
                            MAX_RETRIES + 1
                        );
                        sleep(Duration::from_secs(retry_after)).await;
                        continue;
                    } else {
                        return Err(crate::error::AppError::RateLimit(
                            "Rate limit exceeded after all retries".to_string(),
                        ));
                    }
                }

                // Handle server errors (5xx)
                if status.is_server_error() {
                    if attempt < MAX_RETRIES {
                        let delay = INITIAL_RETRY_DELAY_MS * 2_u64.pow(attempt);
                        warn!(
                            "Server error {}: {}. Retrying in {}ms...",
                            status,
                            response.text().await.unwrap_or_default(),
                            delay
                        );
                        sleep(Duration::from_millis(delay)).await;
                        continue;
                    } else {
                        return Err(crate::error::AppError::Network(format!(
                            "Server error {} after all retries",
                            status
                        )));
                    }
                }

                return Ok(response);
            }
            Err(e) => {
                last_error = Some(format!("{}", e));
                if attempt < MAX_RETRIES {
                    let delay = INITIAL_RETRY_DELAY_MS * 2_u64.pow(attempt);
                    warn!("Request error: {}. Retrying in {}ms...", e, delay);
                    sleep(Duration::from_millis(delay)).await;
                } else {
                    error!("Request failed after all retries: {}", e);
                }
            }
        }
    }

    Err(crate::error::AppError::Network(format!(
        "All retries failed: {:?}",
        last_error
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[test]
    fn test_build_http_client() {
        let _client = build_http_client();
        // Succeeds if no panic during construction
    }

    #[tokio::test]
    async fn test_retry_on_server_error() {
        let mock_server = MockServer::start().await;
        let client = build_http_client();

        // Mock server that returns 500 twice, then 200
        Mock::given(method("GET"))
            .and(path("/test"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(2)
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/test"))
            .respond_with(ResponseTemplate::new(200))
            .mount(&mock_server)
            .await;

        let response = execute_with_retry(&client, || {
            client.get(format!("{}/test", mock_server.uri())).send()
        })
        .await;

        assert!(response.is_ok());
        assert_eq!(response.unwrap().status(), 200);
    }

    #[tokio::test]
    async fn test_rate_limit_handling() {
        let mock_server = MockServer::start().await;
        let client = build_http_client();

        // Mock server that returns 429 with Retry-After header
        Mock::given(method("GET"))
            .and(path("/rate-limited"))
            .respond_with(ResponseTemplate::new(429).insert_header("Retry-After", "2"))
            .mount(&mock_server)
            .await;

        let start = std::time::Instant::now();
        let result = execute_with_retry(&client, || {
            client
                .get(format!("{}/rate-limited", mock_server.uri()))
                .send()
        })
        .await;

        // Should fail after max retries
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            crate::error::AppError::RateLimit(_)
        ));

        // Should have waited at least 2 seconds due to Retry-After
        assert!(start.elapsed() >= Duration::from_secs(2));
    }
}
