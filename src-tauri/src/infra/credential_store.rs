//! OS credential manager integration via the `keyring` crate.
//!
//! Provides secure, persistent storage for API keys using
//! Windows Credential Manager (or platform equivalent).

use crate::error::AppError;

const SERVICE_NAME: &str = "otaku-pulse";
const PERPLEXITY_ACCOUNT: &str = "perplexity-api-key";

/// Load the Perplexity API key from the OS credential store.
///
/// Returns `Ok(None)` when no credential is stored (first launch).
pub fn load_api_key() -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, PERPLEXITY_ACCOUNT)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(format!(
            "Failed to read API key from credential store: {e}"
        ))),
    }
}

/// Store the Perplexity API key in the OS credential store.
pub fn store_api_key(key: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, PERPLEXITY_ACCOUNT)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    entry.set_password(key).map_err(|e| {
        AppError::Keyring(format!(
            "Failed to store API key in credential store: {e}"
        ))
    })
}

/// Delete the Perplexity API key from the OS credential store.
///
/// Silently succeeds if no credential exists.
pub fn delete_api_key() -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, PERPLEXITY_ACCOUNT)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(format!(
            "Failed to delete API key from credential store: {e}"
        ))),
    }
}
