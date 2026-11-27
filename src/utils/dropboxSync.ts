/**
 * JivanOS Phase 4 — Dropbox Sync Engine (App Folder: /Apps/JivanOS/backup.json)
 *
 * Dual-runtime architecture:
 * 1) Native Android APK (Capacitor): uses JivanDropboxPlugin (DropboxAuth.kt + DropboxSyncProvider.kt)
 *    - Dropbox Android SDK (com.dropbox.core:dropbox-core-sdk + dropbox-android-sdk)
 *    - OAuth 2.0 PKCE flow (public app key 7vi2yjqec4ezw1q, zero client secret)
 *    - Tokens persisted exclusively in AndroidX EncryptedSharedPreferences
 *    - Silent re-auth on app launch & WorkManager periodic autoSync(intervalMinutes)
 * 2) Web / Desktop / PWA:
 *    - Pure OAuth 2.0 PKCE popup flow (SHA-256 code_challenge, no client secret)
 *    - Tokens kept strictly in memory (never written to plaintext localStorage)
 *    - Dropbox HTTP API v2 against App Folder path `/backup.json` (= `/Apps/JivanOS/backup.json`)
 */

import {
  AutoSyncIntervalMinutes,
  DriveBackupEnvelope,
  buildDriveBackupEnvelope,
  computeInitials,
  formatDriveFileSize,
  formatRelativeSyncTime,
  isRemoteNewerThanLocal,
  mergeDriveData,
  parseDriveBackupEnvelope,
} from './googleDriveSync';
import { isCapacitorNative } from '../lib/firebase';

export const DROPBOX_APP_KEY = '7vi2yjqec4ezw1q';
export const DROPBOX_ANDROID_REDIRECT_URI = 'db-7vi2yjqec4ezw1q://2/token';
// Because access type is "App folder", Dropbox roots "/" at "/Apps/JivanOS/"
export const DROPBOX_BACKUP_PATH = '/backup.json';
export const DROPBOX_SYNC_META_KEY = 'jivanos_dropbox_sync_meta_v1';
export const DROPBOX_SYNC_STATE_EVENT = 'jivanos:dropbox-sync-updated';

export type DropboxSyncStatus = 'idle' | 'synced' | 'syncing' | 'error';

export interface DropboxAccount {
  connected: boolean;
  name: string;
  email: string;
  initials: string;
}

export interface DropboxSyncInfo {
  lastModified: string;
  fileSizeBytes: number;
}

export interface DropboxRestoreResponse {
  found: boolean;
  envelope: DriveBackupEnvelope | null;
  lastModified: string | null;
  fileSizeBytes: number;
}

export interface StoredDropboxSyncMeta {
  wasConnected: boolean;
  lastSyncedAt: string | null;
  lastFileSizeBytes: number | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: AutoSyncIntervalMinutes;
  lastError: string | null;
}

interface NativeJivanDropboxPlugin {
  connect(): Promise<{ connected: boolean; name?: string; email?: string; initials?: string }>;
  silentReAuth(): Promise<{ connected: boolean; name?: string; email?: string; initials?: string }>;
  disconnect(): Promise<{ disconnected: boolean }>;
  backupToDropbox(opts: { payloadJson: string }): Promise<{
    success: boolean;
    lastModified: string;
    fileSizeBytes: number;
  }>;
  restoreFromDropbox(): Promise<{
    found: boolean;
    content: string;
    lastModified: string;
    fileSizeBytes: number;
  }>;
  getLastSyncInfo(): Promise<{
    exists: boolean;
    lastModified?: string;
    fileSizeBytes?: number;
  }>;
  scheduleAutoSync(opts: { intervalMinutes: number }): Promise<{
    scheduled: boolean;
    intervalMinutes: number;
  }>;
  cacheLocalPayloadForBackgroundSync(opts: { payloadJson: string }): Promise<{ cached: boolean }>;
}

// Strict in-memory token store on Web (Android persists tokens in EncryptedSharedPreferences)
let webAccessToken: string | null = null;
let webRefreshToken: string | null = null;
let webTokenExpiresAt = 0;
let currentDropboxAccount: DropboxAccount | null = null;
let webDropboxAutoSyncTimer: ReturnType<typeof setInterval> | null = null;

function getNativeDropboxPlugin(): NativeJivanDropboxPlugin | null {
  try {
    if (typeof window === 'undefined') return null;
    const cap = (window as any).Capacitor;
    const plugin = cap?.Plugins?.JivanDropbox;
    if (plugin && typeof plugin.connect === 'function') {
      return plugin as NativeJivanDropboxPlugin;
    }
  } catch {
    // Web fallback
  }
  return null;
}

export function isNativeAndroidDropboxAvailable(): boolean {
  return getNativeDropboxPlugin() !== null;
}

export function getStoredDropboxSyncMeta(): StoredDropboxSyncMeta {
  const defaults: StoredDropboxSyncMeta = {
    wasConnected: false,
    lastSyncedAt: null,
    lastFileSizeBytes: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 0,
    lastError: null,
  };
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(DROPBOX_SYNC_META_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const validInterval: AutoSyncIntervalMinutes =
      parsed.autoSyncIntervalMinutes === 15 ||
      parsed.autoSyncIntervalMinutes === 30 ||
      parsed.autoSyncIntervalMinutes === 60
        ? parsed.autoSyncIntervalMinutes
        : 0;
    return {
      wasConnected: Boolean(parsed.wasConnected),
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastFileSizeBytes: typeof parsed.lastFileSizeBytes === 'number' ? parsed.lastFileSizeBytes : null,
      autoSyncEnabled: Boolean(parsed.autoSyncEnabled) && validInterval > 0,
      autoSyncIntervalMinutes: validInterval,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return defaults;
  }
}

export function updateStoredDropboxSyncMeta(
  patch: Partial<StoredDropboxSyncMeta>
): StoredDropboxSyncMeta {
  const next: StoredDropboxSyncMeta = {
    ...getStoredDropboxSyncMeta(),
    ...patch,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DROPBOX_SYNC_META_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DROPBOX_SYNC_STATE_EVENT, { detail: next }));
    }
  } catch {}
  return next;
}

export function getConnectedDropboxAccount(): DropboxAccount | null {
  return currentDropboxAccount?.connected ? currentDropboxAccount : null;
}

// ============================================================================
// WEB OAUTH 2.0 PKCE HELPERS (NO CLIENT SECRET)
// ============================================================================

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = new Uint8Array(48);
  crypto.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

let prewarmedPkce: { verifier: string; challenge: string } | null = null;

function refreshPrewarmedPkce(): void {
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) return;
  generatePkcePair()
    .then((pair) => {
      prewarmedPkce = pair;
    })
    .catch(() => {});
}

// Pre-generate a fresh S256 PKCE pair so clicking "Connect Dropbox" can call window.open()
// synchronously on the user gesture without losing popup permission.
refreshPrewarmedPkce();

export function getDropboxWebRedirectUri(): string {
  return `${window.location.origin}/auth/oauth-callback`;
}

export async function getValidDropboxAccessToken(): Promise<string> {
  return refreshWebAccessTokenIfNeeded();
}

async function refreshWebAccessTokenIfNeeded(): Promise<string> {
  if (webAccessToken && Date.now() < webTokenExpiresAt - 60_000) {
    return webAccessToken;
  }
  if (!webRefreshToken) {
    if (webAccessToken) return webAccessToken;
    throw new Error('Dropbox is not connected for this session. Click Connect Dropbox first.');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: webRefreshToken,
    client_id: DROPBOX_APP_KEY,
  });
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    webAccessToken = null;
    webRefreshToken = null;
    currentDropboxAccount = null;
    throw new Error('Dropbox session expired. Please reconnect Dropbox.');
  }
  const tokenJson = await res.json();
  webAccessToken = String(tokenJson.access_token || '');
  const expiresInSec = Number(tokenJson.expires_in || 14400);
  webTokenExpiresAt = Date.now() + expiresInSec * 1000;
  return webAccessToken;
}

async function fetchWebDropboxProfile(token: string): Promise<DropboxAccount> {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Could not load Dropbox profile (HTTP ${res.status}).`);
  }
  const profile = await res.json();
  const email = String(profile?.email || '');
  const name =
    String(profile?.name?.display_name || '').trim() ||
    (email ? email.split('@')[0] : 'Dropbox User');
  return {
    connected: true,
    name,
    email,
    initials: computeInitials(name, email),
  };
}

async function connectDropboxWebPkce(): Promise<DropboxAccount> {
  const pkcePair = prewarmedPkce || (await generatePkcePair());
  prewarmedPkce = null;
  // Immediately prepare a fresh PKCE pair for any subsequent reconnect
  refreshPrewarmedPkce();

  const { verifier, challenge } = pkcePair;
  const redirectUri = getDropboxWebRedirectUri();
  const state = `dbx_pkce_${Math.random().toString(36).slice(2, 12)}`;

  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    token_access_type: 'offline',
    state,
  });
  const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

  const authCode = await new Promise<string>((resolve, reject) => {
    const popup = window.open(authUrl, 'jivanos_dropbox_pkce', 'width=560,height=680');
    if (!popup) {
      reject(new Error('Dropbox sign-in popup was blocked. Please allow popups and try again.'));
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      clearTimeout(timeout);
    };

    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'JIVANOS_DRIVE_OAUTH_CODE') {
        if (event.data.state && event.data.state !== state) return;
        settled = true;
        cleanup();
        try { popup.close(); } catch {}
        resolve(String(event.data.code || ''));
      } else if (event.data?.type === 'JIVANOS_DRIVE_OAUTH_ERROR') {
        settled = true;
        cleanup();
        try { popup.close(); } catch {}
        reject(new Error(event.data.error || 'Dropbox authorization was cancelled.'));
      }
    };

    window.addEventListener('message', onMessage);

    const closedPoll = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(new Error('Dropbox sign-in window was closed before completing.'));
      }
    }, 500);

    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        try { popup.close(); } catch {}
        reject(new Error('Dropbox sign-in timed out. Please try again.'));
      }
    }, 180_000);
  });

  // Exchange PKCE authorization code for access token + refresh token (no client secret)
  const tokenBody = new URLSearchParams({
    code: authCode,
    grant_type: 'authorization_code',
    client_id: DROPBOX_APP_KEY,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    throw new Error(`Dropbox PKCE token exchange failed (HTTP ${tokenRes.status})${errText ? `: ${errText}` : ''}`);
  }

  const tokenData = await tokenRes.json();
  webAccessToken = String(tokenData.access_token || '');
  webRefreshToken = tokenData.refresh_token ? String(tokenData.refresh_token) : null;
  const expiresInSec = Number(tokenData.expires_in || 14400);
  webTokenExpiresAt = Date.now() + expiresInSec * 1000;

  const account = await fetchWebDropboxProfile(webAccessToken);
  currentDropboxAccount = account;
  updateStoredDropboxSyncMeta({ wasConnected: true, lastError: null });
  return account;
}

// Persisted in sessionStorage so code_verifier survives page reloads and mobile backgrounding
const DROPBOX_PKCE_VERIFIER_STORAGE_KEY = 'jivanos_dropbox_pkce_verifier_v1';
const DROPBOX_PKCE_AUTH_URL_STORAGE_KEY = 'jivanos_dropbox_pkce_auth_url_v1';
const DROPBOX_POPUP_MODE_PREF_KEY = 'jivanos_dropbox_popup_mode_v1';

export const DROPBOX_EXPIRED_CODE_ERROR =
  'That code has expired or was already used. Tap Open Dropbox Authorization again to get a new one.';

let pendingManualPkceVerifier: string | null = null;
let pendingManualPkceAuthUrl: string | null = null;

function loadSavedManualPkce(): { verifier: string; authUrl: string } | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const verifier = window.sessionStorage.getItem(DROPBOX_PKCE_VERIFIER_STORAGE_KEY);
      const authUrl = window.sessionStorage.getItem(DROPBOX_PKCE_AUTH_URL_STORAGE_KEY);
      if (verifier && authUrl && !authUrl.includes('redirect_uri')) {
        pendingManualPkceVerifier = verifier;
        pendingManualPkceAuthUrl = authUrl;
        return { verifier, authUrl };
      }
    }
  } catch {
    // Fallback to in-memory mirror if sessionStorage is unavailable
  }
  if (
    pendingManualPkceVerifier &&
    pendingManualPkceAuthUrl &&
    !pendingManualPkceAuthUrl.includes('redirect_uri')
  ) {
    return { verifier: pendingManualPkceVerifier, authUrl: pendingManualPkceAuthUrl };
  }
  return null;
}

function saveManualPkce(verifier: string, authUrl: string): void {
  pendingManualPkceVerifier = verifier;
  pendingManualPkceAuthUrl = authUrl;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(DROPBOX_PKCE_VERIFIER_STORAGE_KEY, verifier);
      window.sessionStorage.setItem(DROPBOX_PKCE_AUTH_URL_STORAGE_KEY, authUrl);
    }
  } catch {
    // Keep in-memory fallback if storage quota or privacy mode blocks sessionStorage
  }
}

function clearManualPkce(): void {
  pendingManualPkceVerifier = null;
  pendingManualPkceAuthUrl = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(DROPBOX_PKCE_VERIFIER_STORAGE_KEY);
      window.sessionStorage.removeItem(DROPBOX_PKCE_AUTH_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage cleanup errors
  }
}

export function isDropboxPopupModeEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(DROPBOX_POPUP_MODE_PREF_KEY) === 'true';
    }
  } catch {
    // Default off
  }
  return false;
}

export function setDropboxPopupModeEnabled(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (enabled) {
        window.localStorage.setItem(DROPBOX_POPUP_MODE_PREF_KEY, 'true');
      } else {
        window.localStorage.removeItem(DROPBOX_POPUP_MODE_PREF_KEY);
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Generates an official Dropbox OAuth2 PKCE authorization URL with NO redirect_uri parameter.
 * Reuses any saved sessionStorage code_verifier unless forceNew is true so reloads/backgrounding
 * never invalidate an in-progress paste-code login.
 */
export async function startDropboxManualCodePkce(options?: {
  forceNew?: boolean;
}): Promise<{ authUrl: string }> {
  if (!options?.forceNew) {
    const existing = loadSavedManualPkce();
    if (existing) {
      return { authUrl: existing.authUrl };
    }
  }

  const pair = await generatePkcePair();
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: pair.challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  saveManualPkce(pair.verifier, authUrl);
  return { authUrl };
}

/**
 * Exchanges the pasted Dropbox authorization code via PKCE (NO redirect_uri, no client secret)
 * for access + offline refresh tokens.
 */
export async function completeDropboxManualCodePkce(authCode: string): Promise<DropboxAccount> {
  const cleanCode = (authCode || '').trim();
  if (!cleanCode) {
    throw new Error('Paste the authorization code shown by Dropbox first.');
  }

  const saved = loadSavedManualPkce();
  if (!saved?.verifier) {
    throw new Error(DROPBOX_EXPIRED_CODE_ERROR);
  }

  const tokenBody = new URLSearchParams({
    code: cleanCode,
    grant_type: 'authorization_code',
    client_id: DROPBOX_APP_KEY,
    code_verifier: saved.verifier,
  });

  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    if (
      tokenRes.status === 400 ||
      tokenRes.status === 401 ||
      /invalid_grant|expired|invalid.*code|code_verifier/i.test(errText)
    ) {
      clearManualPkce();
      throw new Error(DROPBOX_EXPIRED_CODE_ERROR);
    }
    throw new Error(`Dropbox sign-in failed (HTTP ${tokenRes.status})${errText ? `: ${errText}` : ''}`);
  }

  clearManualPkce();
  const tokenData = await tokenRes.json();
  webAccessToken = String(tokenData.access_token || '');
  webRefreshToken = tokenData.refresh_token ? String(tokenData.refresh_token) : null;
  const expiresInSec = Number(tokenData.expires_in || 14400);
  webTokenExpiresAt = Date.now() + expiresInSec * 1000;

  const account = await fetchWebDropboxProfile(webAccessToken);
  currentDropboxAccount = account;
  updateStoredDropboxSyncMeta({ wasConnected: true, lastError: null });
  return account;
}

// ============================================================================
// PUBLIC AUTH API: connectDropbox, silentReAuthDropbox, disconnectDropbox
// ============================================================================

export async function connectDropbox(options?: { allowPopup?: boolean }): Promise<DropboxAccount> {
  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    const res = await nativePlugin.connect();
    if (!res?.connected) {
      throw new Error('Dropbox authorization was not completed.');
    }
    const name = res.name || (res.email ? res.email.split('@')[0] : 'Dropbox User');
    const email = res.email || '';
    currentDropboxAccount = {
      connected: true,
      name,
      email,
      initials: res.initials || computeInitials(name, email),
    };
    updateStoredDropboxSyncMeta({ wasConnected: true, lastError: null });
    return currentDropboxAccount;
  }

  if (isCapacitorNative()) {
    throw new Error(
      'Native JivanDropbox plugin is unavailable in this build. Rebuild the Android APK with Dropbox SDK.'
    );
  }

  if (!options?.allowPopup && !isDropboxPopupModeEnabled()) {
    throw new Error(
      '1-Click Popup Mode is disabled. Use the paste-code flow or turn on 1-Click Popup Mode first.'
    );
  }

  return connectDropboxWebPkce();
}

export async function silentReAuthDropbox(): Promise<DropboxAccount | null> {
  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    try {
      const res = await nativePlugin.silentReAuth();
      if (res?.connected) {
        const name = res.name || (res.email ? res.email.split('@')[0] : 'Dropbox User');
        const email = res.email || '';
        currentDropboxAccount = {
          connected: true,
          name,
          email,
          initials: res.initials || computeInitials(name, email),
        };
        updateStoredDropboxSyncMeta({ wasConnected: true });
        return currentDropboxAccount;
      }
      currentDropboxAccount = null;
      return null;
    } catch {
      return null;
    }
  }

  return getConnectedDropboxAccount();
}

export async function disconnectDropbox(): Promise<void> {
  if (webDropboxAutoSyncTimer) {
    clearInterval(webDropboxAutoSyncTimer);
    webDropboxAutoSyncTimer = null;
  }

  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    try {
      await nativePlugin.disconnect();
    } catch {
      // Clear local metadata regardless
    }
  } else if (webAccessToken) {
    const tokenToRevoke = webAccessToken;
    webAccessToken = null;
    webRefreshToken = null;
    webTokenExpiresAt = 0;
    try {
      await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenToRevoke}` },
      });
    } catch {
      // Best-effort token revocation
    }
  }

  currentDropboxAccount = null;
  updateStoredDropboxSyncMeta({
    wasConnected: false,
    lastSyncedAt: null,
    lastFileSizeBytes: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 0,
    lastError: null,
  });
}

// ============================================================================
// PUBLIC SYNC FUNCTIONS: backupToDropbox, restoreFromDropbox, getLastSyncInfo, autoSync
// ============================================================================

export async function backupToDropbox(data: Record<string, any>): Promise<DropboxSyncInfo> {
  const envelope = buildDriveBackupEnvelope(data);
  const payloadJson = JSON.stringify(envelope);

  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    const res = await nativePlugin.backupToDropbox({ payloadJson });
    const lastModified = res.lastModified || envelope.updatedAt;
    const fileSizeBytes = Number(res.fileSizeBytes || new Blob([payloadJson]).size);
    updateStoredDropboxSyncMeta({
      lastSyncedAt: lastModified,
      lastFileSizeBytes: fileSizeBytes,
      lastError: null,
    });
    return { lastModified, fileSizeBytes };
  }

  const token = await refreshWebAccessTokenIfNeeded();
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: DROPBOX_BACKUP_PATH,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
    },
    body: payloadJson,
  });

  if (res.status === 401) {
    throw new Error('Dropbox session expired. Please reconnect Dropbox.');
  }
  if (!res.ok) {
    throw new Error(`Dropbox upload failed (HTTP ${res.status}).`);
  }

  const meta = await res.json();
  const lastModified = String(meta?.server_modified || meta?.client_modified || envelope.updatedAt);
  const fileSizeBytes = Number(meta?.size || new Blob([payloadJson]).size);

  updateStoredDropboxSyncMeta({
    lastSyncedAt: lastModified,
    lastFileSizeBytes: fileSizeBytes,
    lastError: null,
  });

  return { lastModified, fileSizeBytes };
}

export async function restoreFromDropbox(): Promise<DropboxRestoreResponse> {
  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    const res = await nativePlugin.restoreFromDropbox();
    if (!res.found || !res.content) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }
    const envelope = parseDriveBackupEnvelope(res.content);
    return {
      found: Boolean(envelope),
      envelope,
      lastModified: res.lastModified || envelope?.updatedAt || null,
      fileSizeBytes: Number(res.fileSizeBytes || res.content.length),
    };
  }

  const token = await refreshWebAccessTokenIfNeeded();
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_BACKUP_PATH }),
    },
  });

  if (res.status === 409) {
    return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
  }
  if (res.status === 401) {
    throw new Error('Dropbox session expired. Please reconnect Dropbox.');
  }
  if (!res.ok) {
    throw new Error(`Dropbox download failed (HTTP ${res.status}).`);
  }

  let headerMeta: { server_modified?: string; client_modified?: string; size?: number } = {};
  try {
    const rawHeader = res.headers.get('dropbox-api-result');
    if (rawHeader) headerMeta = JSON.parse(rawHeader);
  } catch {}

  const rawText = await res.text();
  const envelope = parseDriveBackupEnvelope(rawText);
  return {
    found: Boolean(envelope),
    envelope,
    lastModified: headerMeta.server_modified || headerMeta.client_modified || envelope?.updatedAt || null,
    fileSizeBytes: Number(headerMeta.size || new Blob([rawText]).size),
  };
}

export async function getLastSyncInfo(): Promise<DropboxSyncInfo | null> {
  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    const res = await nativePlugin.getLastSyncInfo();
    if (!res?.exists || !res.lastModified) return null;
    const info: DropboxSyncInfo = {
      lastModified: res.lastModified,
      fileSizeBytes: Number(res.fileSizeBytes || 0),
    };
    updateStoredDropboxSyncMeta({
      lastFileSizeBytes: info.fileSizeBytes,
    });
    return info;
  }

  if (!webAccessToken && !webRefreshToken) return null;
  const token = await refreshWebAccessTokenIfNeeded();
  const res = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: DROPBOX_BACKUP_PATH }),
  });

  if (res.status === 409) return null;
  if (!res.ok) return null;
  const meta = await res.json();
  const lastModified = String(meta?.server_modified || meta?.client_modified || '');
  if (!lastModified) return null;
  const fileSizeBytes = Number(meta?.size || 0);
  updateStoredDropboxSyncMeta({
    lastFileSizeBytes: fileSizeBytes,
  });
  return { lastModified, fileSizeBytes };
}

export async function autoSync(
  intervalMinutes: AutoSyncIntervalMinutes,
  onWebAutoSyncTick?: () => Promise<void> | void
): Promise<void> {
  const normalized: AutoSyncIntervalMinutes =
    intervalMinutes === 15 || intervalMinutes === 30 || intervalMinutes === 60 ? intervalMinutes : 0;

  updateStoredDropboxSyncMeta({
    autoSyncEnabled: normalized > 0,
    autoSyncIntervalMinutes: normalized,
  });

  const nativePlugin = getNativeDropboxPlugin();
  if (nativePlugin) {
    await nativePlugin.scheduleAutoSync({ intervalMinutes: normalized });
    return;
  }

  if (webDropboxAutoSyncTimer) {
    clearInterval(webDropboxAutoSyncTimer);
    webDropboxAutoSyncTimer = null;
  }
  if (normalized > 0 && onWebAutoSyncTick) {
    webDropboxAutoSyncTimer = setInterval(() => {
      if (getConnectedDropboxAccount() && (typeof navigator === 'undefined' || navigator.onLine)) {
        Promise.resolve(onWebAutoSyncTick()).catch(() => {});
      }
    }, normalized * 60 * 1000);
  }
}

export async function cacheDropboxPayloadForBackgroundSync(data: Record<string, any>): Promise<void> {
  const nativePlugin = getNativeDropboxPlugin();
  if (!nativePlugin) return;
  try {
    const envelope = buildDriveBackupEnvelope(data);
    await nativePlugin.cacheLocalPayloadForBackgroundSync({
      payloadJson: JSON.stringify(envelope),
    });
  } catch {
    // Silent background cache failure should never disrupt UI
  }
}

export {
  isRemoteNewerThanLocal,
  mergeDriveData,
  formatRelativeSyncTime,
  formatDriveFileSize,
  computeInitials,
};
