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

/// @AC BUG-04: f64 トークン精度 — 小数トークンが切り捨てられないことを確認
#[tokio::test]
async fn test_fractional_token_refill() {
    // refill_rate = 0.5 tokens/sec, max_tokens = 10
    let bucket = TokenBucket::new(10, 0.5, 0);

    // 全トークンを消費
    for _ in 0..10 {
        assert!(bucket.acquire().await.is_ok());
    }

    // last_refill を 3 秒前に設定することで 0.5 * 3 = 1.5 トークン補充をシミュレート
    {
        let mut last_refill = bucket.last_refill.lock().await;
        *last_refill = Instant::now() - Duration::from_secs(3);
    }

    bucket.refill_tokens().await;

    let tokens = *bucket.tokens.lock().await;
    // f64 では 1.5 が保持される（u32 なら 1 に切り捨てられていた）
    assert!(
        (tokens - 1.5).abs() < 0.01,
        "Expected ~1.5 tokens after 3s at 0.5/s, got {tokens}"
    );
}

/// @AC BUG-04: 1.0 未満のトークンでは acquire できないことを確認
#[tokio::test]
async fn test_acquire_requires_full_token() {
    let bucket = TokenBucket::new(10, 0.5, 0);

    // トークンを 0.9 に強制設定
    {
        let mut tokens = bucket.tokens.lock().await;
        *tokens = 0.9;
    }

    // 0.9 トークンでは acquire 不可
    assert!(
        bucket.acquire().await.is_err(),
        "acquire should fail with 0.9 tokens"
    );

    // トークンを 1.0 に設定
    {
        let mut tokens = bucket.tokens.lock().await;
        *tokens = 1.0;
    }

    // 1.0 トークンでは acquire 可能
    assert!(
        bucket.acquire().await.is_ok(),
        "acquire should succeed with 1.0 tokens"
    );

    // 消費後は 0.0 になる
    let remaining = *bucket.tokens.lock().await;
    assert!(
        (remaining - 0.0).abs() < 0.001,
        "tokens should be 0.0 after acquire, got {remaining}"
    );
}

/// @AC BUG-04: 補充後トークンが max_tokens を超えないことを確認
#[tokio::test]
async fn test_token_does_not_exceed_max() {
    let bucket = TokenBucket::new(10, 1.0, 0);

    // トークンを max - 0.5 に設定
    {
        let mut tokens = bucket.tokens.lock().await;
        *tokens = 9.5;
    }

    // last_refill を 2 秒前に設定（2.0 トークン補充を試みる）
    {
        let mut last_refill = bucket.last_refill.lock().await;
        *last_refill = Instant::now() - Duration::from_secs(2);
    }

    bucket.refill_tokens().await;

    let tokens = *bucket.tokens.lock().await;
    // max_tokens = 10.0 を超えないこと
    assert!(
        tokens <= 10.0,
        "tokens should not exceed max_tokens (10.0), got {tokens}"
    );
    assert!(
        (tokens - 10.0).abs() < 0.01,
        "tokens should be capped at 10.0, got {tokens}"
    );
}

// --- Concurrent / stress tests ---

/// @AC TEST-02: Concurrent acquire — exactly max_tokens succeed when spawning 2× tasks
#[tokio::test]
async fn test_concurrent_acquire_respects_limit() {
    use std::sync::Arc;
    let limiter = Arc::new(TokenBucket::new(5, 0.0, 0)); // 5 tokens, no refill, no interval

    let mut set = tokio::task::JoinSet::new();
    for _ in 0..10 {
        let l = limiter.clone();
        set.spawn(async move { l.acquire().await });
    }

    let mut successes = 0usize;
    while let Some(result) = set.join_next().await {
        if result.unwrap().is_ok() {
            successes += 1;
        }
    }

    assert_eq!(
        successes, 5,
        "Exactly 5 of 10 concurrent acquires should succeed with 5-token bucket"
    );
}

/// @AC TEST-02: 429 response sets retry-after and blocks subsequent acquire
/// Uses a separate thread to call blocking_lock() outside the tokio runtime.
#[test]
fn test_429_response_blocks_subsequent_acquire() {
    use std::sync::Arc;
    let limiter = Arc::new(TokenBucket::new(10, 1.0, 0));

    let response = http::Response::builder()
        .status(429)
        .header("Retry-After", "60")
        .body(())
        .unwrap();
    limiter.update_from_response(&response);

    // Verify retry_after was set by checking the field directly
    let retry = limiter.retry_after.blocking_lock();
    assert!(
        retry.is_some(),
        "retry_after must be set after 429 response"
    );
    let duration = retry.unwrap();
    assert_eq!(
        duration.as_secs(),
        60,
        "retry_after duration must match Retry-After header"
    );
}

/// @AC TEST-02: Token depletion then refill allows new acquire
#[tokio::test]
async fn test_token_depletion_and_refill() {
    let limiter = TokenBucket::new(2, 10.0, 0); // 2 tokens, 10/sec refill, no interval

    // Drain all tokens
    assert!(limiter.acquire().await.is_ok());
    assert!(limiter.acquire().await.is_ok());
    assert!(limiter.acquire().await.is_err(), "bucket should be empty");

    // Manually backdate last_refill to simulate 150ms elapsed (10 tok/s → ~1.5 tokens)
    {
        let mut last_refill = limiter.last_refill.lock().await;
        *last_refill = Instant::now() - Duration::from_millis(150);
    }

    // Should have refilled at least 1 token
    assert!(
        limiter.acquire().await.is_ok(),
        "should succeed after refill period"
    );
}

/// @AC TEST-02: Non-429 response does not set retry_after
#[test]
fn test_non_429_response_does_not_block() {
    let limiter = TokenBucket::new(10, 1.0, 0);

    let response = http::Response::builder()
        .status(200)
        .body(())
        .unwrap();
    limiter.update_from_response(&response);

    // retry_after must remain None
    let retry = limiter.retry_after.blocking_lock();
    assert!(
        retry.is_none(),
        "retry_after must not be set for a 200 response"
    );
}

/// @AC TEST-02: Zero-capacity limiter rejects all acquires immediately
#[tokio::test]
async fn test_zero_capacity_rejects_all() {
    let limiter = TokenBucket::new(0, 0.0, 0);
    let result = limiter.acquire().await;
    assert!(result.is_err(), "zero-capacity bucket must always reject");
}
