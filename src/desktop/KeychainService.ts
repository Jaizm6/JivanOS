/**
 * Phase 9 — OS Keychain Token Storage Service (Tauri v2 Desktop + Web/Android fallback)
 *
 * - On Desktop (Tauri v2):
 *   Stores credentials natively in the operating system's secure vault:
 *     - Windows: Windows Credential Manager
 *     - Linux: libsecret (GNOME Keyring / KWallet)
 *   via Rust `keychain_set_token` / `keychain_get_token` / `keychain_delete_token` commands.
 * - On Web / Android:
 *   Falls back to `localStorage` under a scoped key (`jivanos_token_<provider>`).
 */

import { invoke } from '@tauri-apps/api/core';

const WEB_TOKEN_PREFIX = 'jivanos_token_';

// Lightweight in-memory mirror populated on read/write for synchronous checks if needed
const memoryCache = new Map<string, string>();

/**
 * Returns true when running inside the Tauri v2 native desktop wrapper.
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__);
}

function normalizeProviderKey(provider: string): string {
  const clean = provider.trim().toLowerCase();
  if (!clean || !/^[a-z0-9._:-]{1,128}$/.test(clean)) {
    throw new Error(`Invalid keychain provider identifier: "${provider}"`);
  }
  return clean;
}

/**
 * Store a token or serialized token bundle in the OS keychain (desktop) or localStorage (web/Android).
 */
export async function setToken(provider: string, value: string): Promise<void> {
  const key = normalizeProviderKey(provider);

  if (isDesktop()) {
    await invoke<void>('keychain_set_token', { provider: key, value });
    memoryCache.set(key, value);
    return;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${WEB_TOKEN_PREFIX}${key}`, value);
    }
    memoryCache.set(key, value);
  } catch {
    throw new Error(`Failed to persist ${key} token locally.`);
  }
}

/**
 * Retrieve a token from the OS keychain (desktop) or localStorage (web/Android).
 */
export async function getToken(provider: string): Promise<string | null> {
  const key = normalizeProviderKey(provider);

  if (isDesktop()) {
    try {
      const value = await invoke<string | null>('keychain_get_token', { provider: key });
      if (value) {
        memoryCache.set(key, value);
        return value;
      }
      memoryCache.delete(key);
      return null;
    } catch {
      return null;
    }
  }

  try {
    if (typeof localStorage === 'undefined') return memoryCache.get(key) ?? null;
    const raw = localStorage.getItem(`${WEB_TOKEN_PREFIX}${key}`);
    if (raw) {
      memoryCache.set(key, raw);
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete a token from the OS keychain (desktop) or localStorage (web/Android).
 */
export async function deleteToken(provider: string): Promise<void> {
  const key = normalizeProviderKey(provider);
  memoryCache.delete(key);

  if (isDesktop()) {
    try {
      await invoke<void>('keychain_delete_token', { provider: key });
    } catch {
      // Ignore missing-entry errors on delete
    }
    return;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${WEB_TOKEN_PREFIX}${key}`);
    }
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Synchronous helper reading the last hydrated value in memory (does not hit disk/IPC).
 */
export function getCachedTokenSync(provider: string): string | null {
  try {
    return memoryCache.get(normalizeProviderKey(provider)) ?? null;
  } catch {
    return null;
  }
}

export const KeychainService = {
  isDesktop,
  setToken,
  getToken,
  deleteToken,
  getCachedTokenSync,
};
