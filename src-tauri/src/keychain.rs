use keyring::Entry;

const KEYRING_SERVICE: &str = "com.jaiz.jivanos";

fn validate_provider_key(provider: &str) -> Result<String, String> {
    let trimmed = provider.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err("Invalid keychain key length.".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ':'))
    {
        return Err("Invalid characters in keychain key.".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
pub fn keychain_set_token(provider: String, value: String) -> Result<(), String> {
    let key = validate_provider_key(&provider)?;
    let entry = Entry::new(KEYRING_SERVICE, &key)
        .map_err(|_| "Failed to initialize OS keychain entry.".to_string())?;
    entry
        .set_password(&value)
        .map_err(|_| "Failed to store credential in OS keychain.".to_string())
}

#[tauri::command]
pub fn keychain_get_token(provider: String) -> Result<Option<String>, String> {
    let key = validate_provider_key(&provider)?;
    let entry = Entry::new(KEYRING_SERVICE, &key)
        .map_err(|_| "Failed to initialize OS keychain entry.".to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Failed to read credential from OS keychain.".to_string()),
    }
}

#[tauri::command]
pub fn keychain_delete_token(provider: String) -> Result<(), String> {
    let key = validate_provider_key(&provider)?;
    let entry = Entry::new(KEYRING_SERVICE, &key)
        .map_err(|_| "Failed to initialize OS keychain entry.".to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Failed to delete credential from OS keychain.".to_string()),
    }
}
