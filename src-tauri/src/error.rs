use serde::Serialize;

/// Application-wide error type.
/// All Tauri commands must return `Result<T, AppError>`.
/// Serialized as a JSON object so the FE can `JSON.stringify()` safely
/// (avoids the `[object Object]` issue from nexus).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Feed parse error: {0}")]
    FeedParse(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Rate limit: {0}")]
    RateLimit(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("LLM error: {0}")]
    Llm(String),

    #[error("Scheduler error: {0}")]
    Scheduler(String),

    #[error("Keyring error: {0}")]
    Keyring(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Serialize into `{ "kind": "...", "message": "..." }` so the FE
/// can always read `error.message` after `JSON.stringify()`.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let kind = match self {
            Self::Database(_) => "database",
            Self::Http(_) => "http",
            Self::FeedParse(_) => "feed_parse",
            Self::RateLimit(_) => "rate_limit",
            Self::Unauthorized(_) => "unauthorized",
            Self::Network(_) => "network",
            Self::Parse(_) => "parse",
            Self::InvalidInput(_) => "invalid_input",
            Self::Llm(_) => "llm",
            Self::Scheduler(_) => "scheduler",
            Self::Keyring(_) => "keyring",
            Self::Internal(_) => "internal",
        };
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// Shorthand for Tauri command return types.
pub type CmdResult<T> = Result<T, AppError>;
