use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::{info, warn};

/// Token bucket rate limiter
pub struct TokenBucket {
    /// Maximum number of tokens
    max_tokens: u32,
    /// Current number of tokens (f64 to prevent fractional token loss during refill)
    tokens: Arc<Mutex<f64>>,
    /// Token refill rate (tokens per second)
    refill_rate: f64,
    /// Last refill time
    last_refill: Arc<Mutex<Instant>>,
    /// Minimum interval between requests (ms)
    min_interval_ms: u64,
    /// Last request time
    last_request: Arc<Mutex<Instant>>,
    /// Retry-after duration if rate limited
    retry_after: Arc<Mutex<Option<Duration>>>,
}

impl TokenBucket {
    /// Create a new token bucket rate limiter
    pub fn new(max_tokens: u32, refill_rate: f64, min_interval_ms: u64) -> Self {
        Self {
            max_tokens,
            tokens: Arc::new(Mutex::new(max_tokens as f64)),
            refill_rate,
            last_refill: Arc::new(Mutex::new(Instant::now())),
            min_interval_ms,
            last_request: Arc::new(Mutex::new(
                Instant::now() - Duration::from_millis(min_interval_ms),
            )),
            retry_after: Arc::new(Mutex::new(None)),
        }
    }

    /// Refill tokens based on elapsed time
    async fn refill_tokens(&self) {
        let now = Instant::now();
        let mut last_refill = self.last_refill.lock().await;
        let elapsed = now.duration_since(*last_refill);

        if elapsed.as_secs_f64() > 0.0 {
            // D-13: f64 演算で小数トークンの精度を保持する（as u32 による切り捨てを排除）
            let tokens_to_add = elapsed.as_secs_f64() * self.refill_rate;
            let mut tokens = self.tokens.lock().await;
            *tokens = (*tokens + tokens_to_add).min(self.max_tokens as f64);
            *last_refill = now;
        }
    }

    /// Wait for minimum interval between requests
    async fn wait_for_interval(&self) {
        let now = Instant::now();
        let mut last_request = self.last_request.lock().await;
        let elapsed = now.duration_since(*last_request);

        if elapsed < Duration::from_millis(self.min_interval_ms) {
            let wait_time = Duration::from_millis(self.min_interval_ms) - elapsed;
            info!(
                "Rate limiting: waiting {:?} for minimum interval",
                wait_time
            );
            tokio::time::sleep(wait_time).await;
        }

        *last_request = Instant::now();
    }

    /// Acquire a token, waiting if necessary
    pub async fn acquire(&self) -> Result<(), crate::error::AppError> {
        // Check if we're in a retry-after period
        {
            let retry_after = self.retry_after.lock().await;
            if let Some(duration) = *retry_after
                && duration > Duration::ZERO
            {
                return Err(crate::error::AppError::Internal(format!(
                    "Rate limited. Retry after {:?}",
                    duration
                )));
            }
        }

        // Wait for minimum interval
        self.wait_for_interval().await;

        // Refill tokens
        self.refill_tokens().await;

        // Try to acquire a token (requires at least 1.0 whole token)
        let mut tokens = self.tokens.lock().await;
        if *tokens >= 1.0 {
            *tokens -= 1.0;
            Ok(())
        } else {
            warn!("Rate limit exceeded: no tokens available");
            Err(crate::error::AppError::Internal(
                "Rate limit exceeded: no tokens available".to_string(),
            ))
        }
    }

    /// Update rate limit information from HTTP response headers
    #[cfg(test)]
    pub fn update_from_response<T>(&self, response: &http::Response<T>) {
        // Update retry-after if rate limited
        if response.status() == 429
            && let Some(retry_after) = response
                .headers()
                .get("Retry-After")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
        {
            let mut retry_after_lock = self.retry_after.blocking_lock();
            *retry_after_lock = Some(Duration::from_secs(retry_after));
            info!("Updated retry-after to {} seconds", retry_after);
        }

        // Update remaining tokens from header
        if let Some(remaining) = response
            .headers()
            .get("X-RateLimit-Remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
        {
            let mut tokens_lock = self.tokens.blocking_lock();
            *tokens_lock = (remaining as f64).min(self.max_tokens as f64);
            info!("Updated remaining tokens to {}", remaining);
        }
    }

}

/// Rate limiter configurations for different sources
pub mod configs {
    use super::*;

    /// AniList: 30 requests per minute (>= 2,100ms interval)
    pub fn anilist() -> TokenBucket {
        TokenBucket::new(
            30,   // max_tokens (30 requests per minute)
            0.5,  // refill_rate (0.5 tokens per second = 30 per minute)
            2100, // min_interval_ms (2,100ms between requests)
        )
    }

}

#[cfg(test)]
#[path = "rate_limiter_tests.rs"]
mod tests;
