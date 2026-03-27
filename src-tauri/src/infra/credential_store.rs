//! OS credential manager integration via the `keyring` crate.
//!
//! Provides secure, persistent storage for API keys using
//! Windows Credential Manager (or platform equivalent).

use crate::error::AppError;

const SERVICE_NAME: &str = "otaku-pulse";

/// Well-known account identifiers for credential store entries.
pub const PERPLEXITY_ACCOUNT: &str = "perplexity-api-key";
pub const RAWG_ACCOUNT: &str = "rawg-api-key";

/// Load a credential from the OS credential store.
///
/// Returns `Ok(None)` when no credential is stored (first launch).
pub fn load_credential(account: &str) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(format!(
            "Failed to read credential from store: {e}"
        ))),
    }
}

/// Store a credential in the OS credential store.
pub fn store_credential(account: &str, key: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    entry.set_password(key).map_err(|e| {
        AppError::Keyring(format!(
            "Failed to store credential in store: {e}"
        ))
    })
}

/// Delete a credential from the OS credential store.
///
/// Silently succeeds if no credential exists.
pub fn delete_credential(account: &str) -> Result<(), AppError> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| AppError::Keyring(format!("Failed to create keyring entry: {e}")))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(format!(
            "Failed to delete credential from store: {e}"
        ))),
    }
}
