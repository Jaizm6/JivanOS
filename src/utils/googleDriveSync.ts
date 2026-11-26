/**
 * JivanOS Phase 2 — Google Drive Sync Engine (AppDataFolder)
 *
 * Dual-runtime architecture:
 * 1) Native Android APK (Capacitor): uses JivanGoogleDrivePlugin
 *    - Google Sign-In SDK (com.google.android.gms:play-services-auth)
 *    - Scope: https://www.googleapis.com/auth/drive.appdata ONLY
 *    - Silent re-auth on launch
 *    - WorkManager background autoSync(intervalMinutes)
 * 2) Web / Desktop / PWA:
 *    - Firebase Auth GoogleAuthProvider with drive.appdata ONLY
 *    - Strict in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
 *    - Google Drive REST API v3 against hidden `appDataFolder/backup.json`
 *
 * Backup file envelope (appDataFolder/backup.json):
 * {
 *   "schemaVersion": 1,
 *   "app": "JivanOS",
 *   "updatedAt": "ISO timestamp",
 *   "deviceId": "unique per install",
 *   "data": { ...all app collections... }
 * }
 */

import {
  deriveFavoriteIdsFromQuoteSyncData,
  mergeQuoteSyncData,
} from './quoteSync';
import {
  connectGoogleDriveWithFirebase,
  gdriveAuth,
  getInMemoryGDriveDisplayName,
  getInMemoryGDriveEmail,
  getInMemoryGDriveToken,
  isCapacitorNative,
  revokeWebGDriveToken,
} from '../lib/firebase';

export const DRIVE_BACKUP_FILENAME = 'backup.json';
export const DRIVE_SYNC_META_KEY = 'jivanos_gdrive_sync_meta_v1';
export const DRIVE_SYNC_STATE_EVENT = 'jivanos:gdrive-sync-updated';

export type AutoSyncIntervalMinutes = 0 | 15 | 30 | 60;
export type DriveSyncStatus = 'idle' | 'synced' | 'syncing' | 'error';

export interface DriveAccountInfo {
  connected: boolean;
  name: string;
  email: string;
  initials: string;
}

export interface DriveSyncInfo {
  lastModified: string;
  fileSizeBytes: number;
}

export interface DriveBackupEnvelope {
  schemaVersion: 1;
  app: 'JivanOS';
  updatedAt: string;
  deviceId: string;
  data: Record<string, any>;
}

export interface StoredDriveSyncMeta {
  deviceId: string;
  wasConnected: boolean;
  lastSyncedAt: string | null;
  lastFileSizeBytes: number | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: AutoSyncIntervalMinutes;
  lastError: string | null;
}

export interface DriveRestoreResponse {
  found: boolean;
  envelope: DriveBackupEnvelope | null;
  lastModified: string | null;
  fileSizeBytes: number;
}

interface NativeJivanGoogleDrivePlugin {
  connect(): Promise<{ connected: boolean; name?: string; email?: string; initials?: string }>;
  silentReAuth(): Promise<{ connected: boolean; name?: string; email?: string; initials?: string }>;
  disconnect(): Promise<{ disconnected: boolean }>;
  backupToDrive(opts: { payloadJson: string }): Promise<{
    success: boolean;
    lastModified: string;
    fileSizeBytes: number;
  }>;
  restoreFromDrive(): Promise<{
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

// Runtime in-memory state (never puts OAuth tokens into localStorage)
let currentConnectedAccount: DriveAccountInfo | null = null;
let webAutoSyncTimer: ReturnType<typeof setInterval> | null = null;

function getNativeDrivePlugin(): NativeJivanGoogleDrivePlugin | null {
  try {
    if (typeof window === 'undefined') return null;
    const cap = (window as any).Capacitor;
    const plugin = cap?.Plugins?.JivanGoogleDrive;
    if (plugin && typeof plugin.connect === 'function') {
      return plugin as NativeJivanGoogleDrivePlugin;
    }
  } catch {
    // Web fallback
  }
  return null;
}

export function isNativeAndroidDriveAvailable(): boolean {
  return getNativeDrivePlugin() !== null;
}

function generateDeviceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `jivanos-${crypto.randomUUID()}`;
    }
  } catch {}
  return `jivanos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getStoredDriveSyncMeta(): StoredDriveSyncMeta {
  const defaults: StoredDriveSyncMeta = {
    deviceId: '',
    wasConnected: false,
    lastSyncedAt: null,
    lastFileSizeBytes: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 0,
    lastError: null,
  };
  try {
    if (typeof localStorage === 'undefined') {
      return { ...defaults, deviceId: generateDeviceId() };
    }
    const raw = localStorage.getItem(DRIVE_SYNC_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validInterval: AutoSyncIntervalMinutes =
        parsed.autoSyncIntervalMinutes === 15 ||
        parsed.autoSyncIntervalMinutes === 30 ||
        parsed.autoSyncIntervalMinutes === 60
          ? parsed.autoSyncIntervalMinutes
          : 0;
      const meta: StoredDriveSyncMeta = {
        deviceId: typeof parsed.deviceId === 'string' && parsed.deviceId ? parsed.deviceId : generateDeviceId(),
        wasConnected: Boolean(parsed.wasConnected),
        lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
        lastFileSizeBytes: typeof parsed.lastFileSizeBytes === 'number' ? parsed.lastFileSizeBytes : null,
        autoSyncEnabled: Boolean(parsed.autoSyncEnabled) && validInterval > 0,
        autoSyncIntervalMinutes: validInterval,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
      };
      if (!parsed.deviceId) {
        localStorage.setItem(DRIVE_SYNC_META_KEY, JSON.stringify(meta));
      }
      return meta;
    }
    const seeded: StoredDriveSyncMeta = { ...defaults, deviceId: generateDeviceId() };
    localStorage.setItem(DRIVE_SYNC_META_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return { ...defaults, deviceId: generateDeviceId() };
  }
}

export function updateStoredDriveSyncMeta(patch: Partial<StoredDriveSyncMeta>): StoredDriveSyncMeta {
  const next: StoredDriveSyncMeta = {
    ...getStoredDriveSyncMeta(),
    ...patch,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DRIVE_SYNC_META_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DRIVE_SYNC_STATE_EVENT, { detail: next }));
    }
  } catch {}
  return next;
}

export function getOrCreateDeviceId(): string {
  return getStoredDriveSyncMeta().deviceId;
}

export function computeInitials(name?: string | null, email?: string | null): string {
  const source = (name || '').trim() || (email || '').trim() || 'J';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function getConnectedDriveAccount(): DriveAccountInfo | null {
  if (currentConnectedAccount?.connected) {
    return currentConnectedAccount;
  }
  // Check in-memory web token cache
  const webToken = getInMemoryGDriveToken();
  if (webToken) {
    const email = getInMemoryGDriveEmail() || gdriveAuth.currentUser?.email || '';
    const name =
      getInMemoryGDriveDisplayName() ||
      gdriveAuth.currentUser?.displayName ||
      (email ? email.split('@')[0] : 'Google User');
    currentConnectedAccount = {
      connected: true,
      name,
      email,
      initials: computeInitials(name, email),
    };
    return currentConnectedAccount;
  }
  return null;
}

export function buildDriveBackupEnvelope(data: Record<string, any>): DriveBackupEnvelope {
  return {
    schemaVersion: 1,
    app: 'JivanOS',
    updatedAt: new Date().toISOString(),
    deviceId: getOrCreateDeviceId(),
    data,
  };
}

export function parseDriveBackupEnvelope(rawText: string): DriveBackupEnvelope | null {
  try {
    if (!rawText || !rawText.trim()) return null;
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') return null;

    // Standard Phase 2 envelope
    if (parsed.app === 'JivanOS' && parsed.data && typeof parsed.data === 'object') {
      return {
        schemaVersion: 1,
        app: 'JivanOS',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : 'unknown-device',
        data: parsed.data,
      };
    }

    // Graceful compatibility if backup.json holds raw app data object directly
    if (
      Array.isArray(parsed.tasks) ||
      Array.isArray(parsed.habits) ||
      Array.isArray(parsed.bills) ||
      Array.isArray(parsed.medications) ||
      Array.isArray(parsed.journals)
    ) {
      return {
        schemaVersion: 1,
        app: 'JivanOS',
        updatedAt:
          typeof parsed.exportedAt === 'string'
            ? parsed.exportedAt
            : typeof parsed.lastUpdated === 'string'
              ? parsed.lastUpdated
              : new Date().toISOString(),
        deviceId: 'legacy-backup',
        data: parsed,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function formatRelativeSyncTime(iso: string | null | undefined): string {
  if (!iso) return 'Never synced';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Never synced';
  const diffMs = Math.max(0, Date.now() - ts);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} d ago`;
}

export function formatDriveFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// ============================================================================
// AUTHENTICATION (Android Google Sign-In SDK + Web Firebase drive.appdata)
// ============================================================================

export async function connectGoogleDrive(): Promise<DriveAccountInfo> {
  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    const res = await nativePlugin.connect();
    if (!res?.connected) {
      throw new Error('Google Drive sign-in was not completed.');
    }
    const name = res.name || (res.email ? res.email.split('@')[0] : 'Google User');
    const email = res.email || '';
    currentConnectedAccount = {
      connected: true,
      name,
      email,
      initials: res.initials || computeInitials(name, email),
    };
    updateStoredDriveSyncMeta({ wasConnected: true, lastError: null });
    return currentConnectedAccount;
  }

  if (isCapacitorNative()) {
    throw new Error(
      'Native JivanGoogleDrive plugin is unavailable in this build. Rebuild the Android APK with play-services-auth.'
    );
  }

  // Web/Desktop: Firebase Auth GoogleAuthProvider with drive.appdata scope ONLY
  const result = await connectGoogleDriveWithFirebase();
  const name = result.displayName || (result.email ? result.email.split('@')[0] : 'Google User');
  const email = result.email || '';
  currentConnectedAccount = {
    connected: true,
    name,
    email,
    initials: computeInitials(name, email),
  };
  updateStoredDriveSyncMeta({ wasConnected: true, lastError: null });
  return currentConnectedAccount;
}

export async function silentReAuthGoogleDrive(): Promise<DriveAccountInfo | null> {
  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    try {
      const res = await nativePlugin.silentReAuth();
      if (res?.connected) {
        const name = res.name || (res.email ? res.email.split('@')[0] : 'Google User');
        const email = res.email || '';
        currentConnectedAccount = {
          connected: true,
          name,
          email,
          initials: res.initials || computeInitials(name, email),
        };
        updateStoredDriveSyncMeta({ wasConnected: true });
        return currentConnectedAccount;
      }
      currentConnectedAccount = null;
      return null;
    } catch {
      return null;
    }
  }

  // Web: OAuth access token is strictly in memory for security.
  // If already in memory for this session, return the active account.
  return getConnectedDriveAccount();
}

export async function disconnectGoogleDrive(): Promise<void> {
  if (webAutoSyncTimer) {
    clearInterval(webAutoSyncTimer);
    webAutoSyncTimer = null;
  }

  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    try {
      await nativePlugin.disconnect();
    } catch {
      // Proceed to clear local state regardless
    }
  } else {
    await revokeWebGDriveToken();
  }

  currentConnectedAccount = null;
  updateStoredDriveSyncMeta({
    wasConnected: false,
    lastSyncedAt: null,
    lastFileSizeBytes: null,
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 0,
    lastError: null,
  });
}

// ============================================================================
// WEB DRIVE REST v3 HELPERS (appDataFolder ONLY)
// ============================================================================

async function webFindAppDataBackupFile(
  token: string
): Promise<{ id: string; modifiedTime: string; size: number } | null> {
  const q = encodeURIComponent(`name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error('Google Drive session expired. Please reconnect Google Drive.');
  }
  if (!res.ok) {
    throw new Error(`Google Drive lookup failed (HTTP ${res.status}).`);
  }
  const json = await res.json();
  const files = Array.isArray(json?.files) ? json.files : [];
  if (files.length === 0) return null;
  const first = files[0];
  return {
    id: String(first.id),
    modifiedTime: String(first.modifiedTime || new Date().toISOString()),
    size: Number(first.size || 0),
  };
}

export async function getValidDriveAccessToken(): Promise<string | null> {
  return getInMemoryGDriveToken() || null;
}

function getRequiredWebToken(): string {
  const token = getInMemoryGDriveToken();
  if (!token) {
    throw new Error('Google Drive is not connected for this session. Click Connect Google Drive first.');
  }
  return token;
}

// ============================================================================
// CORE SYNC FUNCTIONS: backupToDrive, restoreFromDrive, getLastSyncInfo, autoSync
// ============================================================================

export async function backupToDrive(data: Record<string, any>): Promise<DriveSyncInfo> {
  const envelope = buildDriveBackupEnvelope(data);
  const payloadJson = JSON.stringify(envelope);

  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    const res = await nativePlugin.backupToDrive({ payloadJson });
    const lastModified = res.lastModified || envelope.updatedAt;
    const fileSizeBytes = Number(res.fileSizeBytes || new Blob([payloadJson]).size);
    updateStoredDriveSyncMeta({
      lastSyncedAt: lastModified,
      lastFileSizeBytes: fileSizeBytes,
      lastError: null,
    });
    return { lastModified, fileSizeBytes };
  }

  const token = getRequiredWebToken();
  const existing = await webFindAppDataBackupFile(token);

  let response: Response;
  if (existing) {
    response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,modifiedTime,size`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: payloadJson,
      }
    );
  } else {
    const boundary = `jivanos_appdata_${Date.now()}`;
    const metadata = {
      name: DRIVE_BACKUP_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${payloadJson}\r\n` +
      `--${boundary}--`;

    response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Google Drive session expired. Please reconnect Google Drive.');
  }
  if (!response.ok) {
    throw new Error(`Google Drive backup failed (HTTP ${response.status}).`);
  }

  const uploaded = await response.json();
  const lastModified = String(uploaded?.modifiedTime || envelope.updatedAt);
  const fileSizeBytes = Number(uploaded?.size || new Blob([payloadJson]).size);

  updateStoredDriveSyncMeta({
    lastSyncedAt: lastModified,
    lastFileSizeBytes: fileSizeBytes,
    lastError: null,
  });

  return { lastModified, fileSizeBytes };
}

export async function restoreFromDrive(): Promise<DriveRestoreResponse> {
  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    const res = await nativePlugin.restoreFromDrive();
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

  const token = getRequiredWebToken();
  const existing = await webFindAppDataBackupFile(token);
  if (!existing) {
    return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Google Drive session expired. Please reconnect Google Drive.');
  }
  if (!res.ok) {
    throw new Error(`Google Drive restore failed (HTTP ${res.status}).`);
  }

  const rawText = await res.text();
  const envelope = parseDriveBackupEnvelope(rawText);
  return {
    found: Boolean(envelope),
    envelope,
    lastModified: existing.modifiedTime || envelope?.updatedAt || null,
    fileSizeBytes: existing.size || new Blob([rawText]).size,
  };
}

export async function getLastSyncInfo(): Promise<DriveSyncInfo | null> {
  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    const res = await nativePlugin.getLastSyncInfo();
    if (!res?.exists || !res.lastModified) return null;
    const info: DriveSyncInfo = {
      lastModified: res.lastModified,
      fileSizeBytes: Number(res.fileSizeBytes || 0),
    };
    updateStoredDriveSyncMeta({
      lastSyncedAt: info.lastModified,
      lastFileSizeBytes: info.fileSizeBytes,
    });
    return info;
  }

  const token = getInMemoryGDriveToken();
  if (!token) return null;

  const existing = await webFindAppDataBackupFile(token);
  if (!existing) return null;

  const info: DriveSyncInfo = {
    lastModified: existing.modifiedTime,
    fileSizeBytes: existing.size,
  };
  return info;
}

export async function autoSync(
  intervalMinutes: AutoSyncIntervalMinutes,
  onWebAutoSyncTick?: () => Promise<void> | void
): Promise<void> {
  const normalized: AutoSyncIntervalMinutes =
    intervalMinutes === 15 || intervalMinutes === 30 || intervalMinutes === 60 ? intervalMinutes : 0;

  updateStoredDriveSyncMeta({
    autoSyncEnabled: normalized > 0,
    autoSyncIntervalMinutes: normalized,
  });

  // 1) Native Android WorkManager scheduling
  const nativePlugin = getNativeDrivePlugin();
  if (nativePlugin) {
    await nativePlugin.scheduleAutoSync({ intervalMinutes: normalized });
    return;
  }

  // 2) Web/Desktop interval fallback
  if (webAutoSyncTimer) {
    clearInterval(webAutoSyncTimer);
    webAutoSyncTimer = null;
  }
  if (normalized > 0 && onWebAutoSyncTick) {
    webAutoSyncTimer = setInterval(() => {
      if (getConnectedDriveAccount() && (typeof navigator === 'undefined' || navigator.onLine)) {
        Promise.resolve(onWebAutoSyncTick()).catch(() => {});
      }
    }, normalized * 60 * 1000);
  }
}

export async function cachePayloadForBackgroundSync(data: Record<string, any>): Promise<void> {
  const nativePlugin = getNativeDrivePlugin();
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

// ============================================================================
// CONFLICT DETECTION & LAST-WRITE-WINS MERGE ENGINE
// ============================================================================

/**
 * Compare remote updatedAt vs local lastSyncedAt before restore/sync.
 * Returns true if remote backup is strictly newer than the last local sync timestamp
 * (using a 2-second clock-skew tolerance to avoid false positives right after pushing).
 */
export function isRemoteNewerThanLocal(
  remoteUpdatedAt: string | null | undefined,
  localLastSyncedAt: string | null | undefined
): boolean {
  if (!remoteUpdatedAt) return false;
  const remoteTs = Date.parse(remoteUpdatedAt);
  if (Number.isNaN(remoteTs)) return false;

  if (!localLastSyncedAt) {
    // Device has never synced with Drive yet, and a remote cloud backup already exists
    return true;
  }
  const localTs = Date.parse(localLastSyncedAt);
  if (Number.isNaN(localTs)) return true;

  return remoteTs > localTs + 2000;
}

function getItemTimestampMs(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.updatedAt,
    item.completedAt,
    item.loggedAt,
    item.paidAt,
    item.paidDate,
    item.archivedAt,
    item.lastUpdated,
    item.createdAt,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) {
      const parsed = Date.parse(c);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

function extractDeletedIdSet(rawDeleted: unknown): Set<string> {
  const set = new Set<string>();
  if (Array.isArray(rawDeleted)) {
    for (const id of rawDeleted) {
      if (typeof id === 'string' && id.trim()) {
        set.add(id.trim());
      }
    }
  } else if (rawDeleted && typeof rawDeleted === 'object') {
    for (const [k, v] of Object.entries(rawDeleted as Record<string, unknown>)) {
      // Handle accidental array-to-object conversion {"0": "task_123"} as well as {"task_123": "2026-..."}
      if (/^\d+$/.test(k) && typeof v === 'string' && v.trim()) {
        set.add(v.trim());
      } else if (k.trim()) {
        set.add(k.trim());
      }
    }
  }
  return set;
}

/**
 * Union two arrays of objects, deduplicating by `id`, filtering out tombstone `deletedSet`,
 * and resolving conflicts with Joplin-style last-write-wins by `updatedAt`
 * (plus habit completionHistory dictionary merging).
 */
export function mergeCollectionByIdLWW<T extends Record<string, any>>(
  localItems: T[] | undefined,
  remoteItems: T[] | undefined,
  deletedSet?: Set<string>
): T[] {
  const localArr = Array.isArray(localItems) ? localItems : [];
  const remoteArr = Array.isArray(remoteItems) ? remoteItems : [];

  const byId = new Map<string, T>();
  const noIdItems: T[] = [];

  for (const item of localArr) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : null;
    if (!id) {
      noIdItems.push(item);
      continue;
    }
    if (deletedSet?.has(id)) continue;
    byId.set(id, item);
  }

  for (const remoteItem of remoteArr) {
    if (!remoteItem || typeof remoteItem !== 'object') continue;
    const id = typeof remoteItem.id === 'string' ? remoteItem.id : null;
    if (!id) {
      noIdItems.push(remoteItem);
      continue;
    }
    if (deletedSet?.has(id)) continue;

    const existingLocal = byId.get(id);
    if (!existingLocal) {
      byId.set(id, remoteItem);
    } else {
      const localTs = getItemTimestampMs(existingLocal);
      const remoteTs = getItemTimestampMs(remoteItem);

      // Special handling for habits / routine items with completionHistory maps
      const hasCompletionHistory =
        (existingLocal.completionHistory && typeof existingLocal.completionHistory === 'object') ||
        (remoteItem.completionHistory && typeof remoteItem.completionHistory === 'object');

      if (hasCompletionHistory) {
        const mergedHistory =
          remoteTs >= localTs
            ? { ...(existingLocal.completionHistory || {}), ...(remoteItem.completionHistory || {}) }
            : { ...(remoteItem.completionHistory || {}), ...(existingLocal.completionHistory || {}) };
        const winner = remoteTs >= localTs ? remoteItem : existingLocal;
        const loser = remoteTs >= localTs ? existingLocal : remoteItem;
        byId.set(id, {
          ...loser,
          ...winner,
          completionHistory: mergedHistory,
          bestStreak: Math.max(
            Number(existingLocal.bestStreak || 0),
            Number(remoteItem.bestStreak || 0)
          ),
        } as T);
      } else if (remoteTs > localTs) {
        byId.set(id, remoteItem);
      } else if (localTs > remoteTs) {
        byId.set(id, existingLocal);
      } else {
        // Equal timestamp tie-breaker: prefer incoming remote fields on top of local
        byId.set(id, { ...existingLocal, ...remoteItem });
      }
    }
  }

  return [...byId.values(), ...noIdItems];
}

const KNOWN_ARRAY_COLLECTIONS = [
  'tasks',
  'habits',
  'routines',
  'goals',
  'medications',
  'doseLogs',
  'bills',
  'scheduleItems',
  'inboxItems',
  'todoLists',
  'listGroups',
  'tags',
  'workflowStages',
  'journals',
  'expenseChecklists',
  'reminders',
] as const;

/**
 * Joplin-Style Item-Level LWW + Tombstone Merge:
 * - Unions all entity collections, removes any ID in `deletedIds`, resolves per-item edits by `updatedAt`.
 * - Preserves `deletedIds` as `string[]` so AppContext tombstone state stays valid.
 */
export function mergeDriveData(
  localData: Record<string, any>,
  remoteData: Record<string, any>
): Record<string, any> {
  const safeLocal = localData && typeof localData === 'object' ? localData : {};
  const safeRemote = remoteData && typeof remoteData === 'object' ? remoteData : {};

  // Build unified tombstone set from both local and remote deletedIds
  const localDeletedSet = extractDeletedIdSet(safeLocal.deletedIds);
  const remoteDeletedSet = extractDeletedIdSet(safeRemote.deletedIds);
  const deletedSet = new Set<string>([...localDeletedSet, ...remoteDeletedSet]);

  const localExportedTs = safeLocal.exportedAt ? Date.parse(String(safeLocal.exportedAt)) : 0;
  const remoteExportedTs = safeRemote.exportedAt ? Date.parse(String(safeRemote.exportedAt)) : 0;
  const preferRemoteScalar =
    Number.isFinite(remoteExportedTs) &&
    (!Number.isFinite(localExportedTs) || remoteExportedTs >= localExportedTs);

  const merged: Record<string, any> = preferRemoteScalar
    ? { ...safeLocal, ...safeRemote }
    : { ...safeRemote, ...safeLocal };

  merged.version = Math.max(Number(safeLocal.version || 2), Number(safeRemote.version || 2));
  merged.exportedAt = new Date().toISOString();

  // Merge all known + any additional array-of-objects collections dynamically
  const allCollectionKeys = new Set<string>(KNOWN_ARRAY_COLLECTIONS);
  for (const key of [...Object.keys(safeLocal), ...Object.keys(safeRemote)]) {
    if (Array.isArray(safeLocal[key]) || Array.isArray(safeRemote[key])) {
      if (key !== 'favoriteQuoteIds' && key !== 'widgets' && key !== 'deletedIds' && key !== 'trashBin') {
        allCollectionKeys.add(key);
      }
    }
  }

  for (const key of allCollectionKeys) {
    if (safeLocal[key] !== undefined || safeRemote[key] !== undefined) {
      merged[key] = mergeCollectionByIdLWW(safeLocal[key], safeRemote[key], deletedSet);
    }
  }

  // Merge 30-day Recycle Bin (trashBin) without filtering by deletedSet; prune expired (>30d) items
  if (Array.isArray(safeLocal.trashBin) || Array.isArray(safeRemote.trashBin)) {
    const nowMs = Date.now();
    const activeIds = new Set<string>();
    for (const key of KNOWN_ARRAY_COLLECTIONS) {
      const arr = merged[key];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          if (entry && typeof entry.id === 'string') activeIds.add(entry.id);
        }
      }
    }
    const mergedBin = mergeCollectionByIdLWW(safeLocal.trashBin, safeRemote.trashBin);
    merged.trashBin = mergedBin.filter((entry: any) => {
      if (!entry || typeof entry !== 'object' || !entry.id) return false;
      const expMs = entry.expiresAt ? Date.parse(String(entry.expiresAt)) : 0;
      if (expMs > 0 && expMs <= nowMs) return false;
      // If item was restored and exists in an active collection, drop it from bin
      if (typeof entry.itemId === 'string' && activeIds.has(entry.itemId)) return false;
      return true;
    });
  }

  // Also support legacy `schedule` array alias if present
  if (
    (!Array.isArray(merged.scheduleItems) || merged.scheduleItems.length === 0) &&
    (Array.isArray(safeLocal.schedule) || Array.isArray(safeRemote.schedule))
  ) {
    merged.scheduleItems = mergeCollectionByIdLWW(
      safeLocal.scheduleItems || safeLocal.schedule,
      safeRemote.scheduleItems || safeRemote.schedule,
      deletedSet
    );
  }

  // Merge profile by updatedAt LWW (preserving non-Guest profile details)
  if (safeLocal.profile || safeRemote.profile) {
    const localProf = safeLocal.profile || {};
    const remoteProf = safeRemote.profile || {};
    const localProfTs = getItemTimestampMs(localProf);
    const remoteProfTs = getItemTimestampMs(remoteProf);
    const isLocalGuest = (!localProf.name || localProf.name === 'Guest') && !localProf.nickname && !localProf.bio;
    const isRemoteGuest = (!remoteProf.name || remoteProf.name === 'Guest') && !remoteProf.nickname && !remoteProf.bio;

    if (isLocalGuest && !isRemoteGuest) {
      merged.profile = { ...localProf, ...remoteProf };
    } else if (!isLocalGuest && isRemoteGuest) {
      merged.profile = { ...remoteProf, ...localProf };
    } else {
      merged.profile =
        remoteProfTs >= localProfTs
          ? { ...localProf, ...remoteProf }
          : { ...remoteProf, ...localProf };
    }
  }

  // Merge quoteLibrary (custom quotes, edits, deletions, timestamped favourites, categories)
  if (safeLocal.quoteLibrary || safeRemote.quoteLibrary) {
    const mergedQuoteLibrary = mergeQuoteSyncData(safeLocal.quoteLibrary, safeRemote.quoteLibrary);
    merged.quoteLibrary = mergedQuoteLibrary;
    merged.favoriteQuoteIds = deriveFavoriteIdsFromQuoteSyncData(mergedQuoteLibrary);
  } else if (Array.isArray(safeLocal.favoriteQuoteIds) || Array.isArray(safeRemote.favoriteQuoteIds)) {
    const favSet = new Set<string>([
      ...(Array.isArray(safeRemote.favoriteQuoteIds) ? safeRemote.favoriteQuoteIds : []),
      ...(Array.isArray(safeLocal.favoriteQuoteIds) ? safeLocal.favoriteQuoteIds : []),
    ]);
    merged.favoriteQuoteIds = Array.from(favSet);
  }

  // Merge hydration (take newer date or merge todayLogs / logs for same day)
  if (safeLocal.hydration && safeRemote.hydration) {
    const localDate = String(safeLocal.hydration.date || safeLocal.hydration.lastResetDate || '');
    const remoteDate = String(safeRemote.hydration.date || safeRemote.hydration.lastResetDate || '');
    if (remoteDate > localDate) {
      merged.hydration = safeRemote.hydration;
    } else if (localDate > remoteDate) {
      merged.hydration = safeLocal.hydration;
    } else {
      merged.hydration = {
        ...(preferRemoteScalar ? safeLocal.hydration : safeRemote.hydration),
        ...(preferRemoteScalar ? safeRemote.hydration : safeLocal.hydration),
        currentMl: Math.max(
          Number(safeLocal.hydration.currentMl || 0),
          Number(safeRemote.hydration.currentMl || 0)
        ),
        todayLogs: mergeCollectionByIdLWW(
          safeLocal.hydration.todayLogs,
          safeRemote.hydration.todayLogs,
          deletedSet
        ),
        logs: mergeCollectionByIdLWW(
          safeLocal.hydration.logs,
          safeRemote.hydration.logs,
          deletedSet
        ),
      };
    }
  }

  // Always preserve deletedIds as string[] (up to last 500 tombstones)
  merged.deletedIds = Array.from(deletedSet).slice(-500);

  return merged;
}
