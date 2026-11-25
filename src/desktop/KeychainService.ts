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
  memoryCache.set(key, value);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${WEB_TOKEN_PREFIX}${key}`, value);
    }
  } catch {
    // Ignore localStorage quota errors
  }

  if (isDesktop()) {
    try {
      await invoke<void>('keychain_set_token', { provider: key, value });
    } catch {
      // Fallback to localStorage mirror on Linux/Windows when keyring daemon is unavailable
    }
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
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${WEB_TOKEN_PREFIX}${key}`, value);
          }
        } catch {}
        return value;
      }
    } catch {
      // Fall through to localStorage fallback
    }
  }

  try {
    if (typeof localStorage === 'undefined') return memoryCache.get(key) ?? null;
    const raw = localStorage.getItem(`${WEB_TOKEN_PREFIX}${key}`);
    if (raw) {
      memoryCache.set(key, raw);
      return raw;
    }
    return memoryCache.get(key) ?? null;
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

/**
 * Delete a token from the OS keychain (desktop) or localStorage (web/Android).
 */
export async function deleteToken(provider: string): Promise<void> {
  const key = normalizeProviderKey(provider);
  memoryCache.delete(key);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${WEB_TOKEN_PREFIX}${key}`);
    }
  } catch {
    // Ignore storage removal errors
  }

  if (isDesktop()) {
    try {
      await invoke<void>('keychain_delete_token', { provider: key });
    } catch {
      // Ignore missing-entry errors on delete
    }
  }
}

/**
 * Synchronous helper reading the last hydrated value in memory or localStorage fallback.
 */
export function getCachedTokenSync(provider: string): string | null {
  try {
    const key = normalizeProviderKey(provider);
    const cached = memoryCache.get(key);
    if (cached) return cached;
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${WEB_TOKEN_PREFIX}${key}`);
      if (raw) {
        memoryCache.set(key, raw);
        return raw;
      }
    }
    return null;
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
