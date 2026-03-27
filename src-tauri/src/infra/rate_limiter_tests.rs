use super::*;
use std::time::Duration;

#[tokio::test]
async fn test_token_bucket_basic() {
    let limiter = TokenBucket::new(5, 1.0, 100); // 5 tokens, 1 token/sec, 100ms min interval

    // Should be able to acquire tokens immediately
    for _ in 0..5 {
        assert!(limiter.acquire().await.is_ok());
    }

    // Next acquire should fail (no tokens)
    assert!(limiter.acquire().await.is_err());

    // Wait for token refill
    tokio::time::sleep(Duration::from_millis(1100)).await;

    // Should be able to acquire again
    assert!(limiter.acquire().await.is_ok());
}

#[tokio::test]
async fn test_minimum_interval() {
    let limiter = TokenBucket::new(10, 10.0, 200); // 200ms min interval

    let start = Instant::now();

    // First acquire should be immediate
    assert!(limiter.acquire().await.is_ok());

    // Second acquire should wait for interval
    assert!(limiter.acquire().await.is_ok());

    let elapsed = start.elapsed();
    assert!(elapsed >= Duration::from_millis(200));
}

#[test]
fn test_update_from_response() {
    let bucket = TokenBucket::new(10, 1.0, 100);

    // Create a mock response with rate limit headers
    let response = http::Response::builder()
        .status(429) // Use numeric status code
        .header("Retry-After", "60")
        .header("X-RateLimit-Remaining", "5")
        .body("")
        .unwrap();

    // Update bucket from response
    bucket.update_from_response(&response);

    assert_eq!(bucket.remaining(), 5);
    assert_eq!(bucket.retry_after(), Some(Duration::from_secs(60)));
}

#[test]
fn test_configs() {
    let anilist = configs::anilist();
    let steam = configs::steam();
    let rss = configs::rss();

    // Test that configs create valid limiters
    assert_eq!(anilist.remaining(), 30);
    assert_eq!(steam.remaining(), 10);
    assert_eq!(rss.remaining(), 1);
}
