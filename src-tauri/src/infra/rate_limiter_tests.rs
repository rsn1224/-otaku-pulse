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
        .status(429)
        .header("Retry-After", "60")
        .header("X-RateLimit-Remaining", "5")
        .body("")
        .unwrap();

    // Update bucket from response — should not panic
    bucket.update_from_response(&response);
}

#[test]
fn test_configs() {
    let anilist = configs::anilist();

    // Verify anilist config creates a valid limiter that can acquire
    // (no remaining()/retry_after() accessors — just test acquire works)
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        assert!(anilist.acquire().await.is_ok());
    });
}
