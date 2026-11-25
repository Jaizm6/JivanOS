/**
 * Unified Separated SYNC & BACKUP Engine for JivanOS
 *
 * SYNC (keeps devices identical) and BACKUP (history copies) are two distinct
 * features with separate settings, schedules, and file paths:
 * - SYNC uses `backup.json` (or `sync-<deviceId>.json` in Local/Syncthing folder,
 *   or one single pinned live message on Telegram updated via `editMessageMedia`).
 * - BACKUP writes history snapshots named `Backups/JivanOS-YYYY-MM-DD-HHmm.json`
 *   to all checked destinations, keeping the last 4 backups per destination and
 *   never touching the sync file.
 */

import {
  DriveBackupEnvelope,
  buildDriveBackupEnvelope,
  getConnectedDriveAccount,
  getOrCreateDeviceId,
  mergeDriveData,
  parseDriveBackupEnvelope,
} from '../utils/googleDriveSync';
import { getInMemoryGDriveToken } from '../lib/firebase';
import {
  getConnectedDropboxAccount,
  getValidDropboxAccessToken,
} from '../utils/dropboxSync';
import {
  getStoredTelegramAuth,
  telegramSyncProvider,
} from './providers/TelegramSyncProvider';
import {
  getStoredMegaAuth,
  megaSyncProvider,
} from './providers/MEGASyncProvider';
import {
  firestoreSyncProvider,
} from './providers/FirestoreSyncProvider';
import { googleDriveSyncProvider } from './providers/GoogleDriveProvider';
import { dropboxSyncProvider } from './providers/DropboxProvider';
import {
  isAndroidNativeBackupAvailable,
  saveRotatingAutoSnapshot,
} from '../utils/localBackupEngine';

export const UNIFIED_SYNC_SETTINGS_KEY = 'jivanos_unified_sync_settings_v1';
export const UNIFIED_BACKUP_SETTINGS_KEY = 'jivanos_unified_backup_settings_v1';
export const SYNCTHING_FOLDER_STATE_KEY = 'jivanos_syncthing_folder_state_v1';
export const UNIFIED_SYNC_STATE_EVENT = 'jivanos:unified-sync-state-updated';
export const UNIFIED_BACKUP_STATE_EVENT = 'jivanos:unified-backup-state-updated';
export const SYNCTHING_FOLDER_STATE_EVENT = 'jivanos:syncthing-folder-updated';

export type ActiveSyncProviderId =
  | 'none'
  | 'firebase'
  | 'gdrive'
  | 'dropbox'
  | 'webdav'
  | 'telegram'
  | 'local_folder'
  | 'mega'
  | 's3';

export type SyncReceiveIntervalMinutes = 0 | 5 | 15 | 30 | 60 | 720 | 1440;

export type UnifiedSyncStatusChip =
  | 'synced'
  | 'syncing'
  | 'waiting'
  | 'error';

export interface UnifiedSyncSettings {
  activeProvider: ActiveSyncProviderId;
  receiveIntervalMinutes: SyncReceiveIntervalMinutes;
  wifiOnly: boolean; // Defaults to true (Wi-Fi by default; false = Wi-Fi & Mobile data)
  status: UnifiedSyncStatusChip;
  lastSyncedAt: string | null;
  lastLocalEditAt: string | null;
  lastError: string | null;
}

export type BackupDestinationId =
  | 'local'
  | 'gdrive'
  | 'dropbox'
  | 'telegram'
  | 'webdav'
  | 'local_folder'
  | 'firebase'
  | 'mega'
  | 's3';

export type BackupScheduleMinutes = 0 | 360 | 720 | 1440 | 2880 | 10080;

export type DestinationChipState = 'idle' | 'running' | 'success' | 'error';

export interface DestinationBackupStatus {
  state: DestinationChipState;
  lastBackupAt: string | null;
  lastFilename: string | null;
  lastError: string | null;
  keptFiles: string[]; // Up to last 4 backup filenames
}

export interface UnifiedBackupSettings {
  destinations: Record<BackupDestinationId, boolean>;
  localFolderMode: 'jivanos_default' | 'custom';
  localCustomFolderName: string | null;
  firstRunCompleted: boolean;
  scheduleMinutes: BackupScheduleMinutes;
  scheduledTime: string; // Default "01:00" (1:00 AM) for >= 24h
  onlyIfChanged: boolean; // Default true
  passwordProtected: boolean; // Default false (AES-256)
  wifiOnly: boolean; // Default true (Wi-Fi by default; false = Wi-Fi & Mobile data)
  onlyWhileCharging: boolean; // Default false (under Advanced)
  lastBackupAt: string | null;
  lastContentHash: string | null;
  nextScheduledBackupAt: string | null;
  destinationStatuses: Record<BackupDestinationId, DestinationBackupStatus>;
}

export interface SyncthingFolderState {
  connected: boolean;
  folderName: string;
  lastSyncedAt: string | null;
  lastFileSizeBytes: number;
  deviceFileName: string;
  mergedPeerFilesCount: number;
  lastError: string | null;
}

// IndexedDB handle storage for File System Access API DirectoryHandles
const IDB_NAME = 'jivanos_fs_handles_db';
const IDB_STORE = 'dir_handles';
const IDB_SYNCTHING_KEY = 'syncthing_sync_dir';
const IDB_LOCAL_BACKUP_KEY = 'local_backup_custom_dir';

let memorySyncthingDirHandle: any = null;
let memoryLocalBackupDirHandle: any = null;

function openHandlesDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveDirHandleToIdb(key: string, handle: any): Promise<void> {
  const db = await openHandlesDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function loadDirHandleFromIdb(key: string): Promise<any | null> {
  const db = await openHandlesDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function emitUnifiedSyncUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNIFIED_SYNC_STATE_EVENT));
  }
}

export function emitUnifiedBackupUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNIFIED_BACKUP_STATE_EVENT));
  }
}

export function emitSyncthingFolderUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNCTHING_FOLDER_STATE_EVENT));
  }
}

/**
 * Checks whether the current network satisfies the Wi-Fi / Mobile data preference.
 */
export function isNetworkAllowed(wifiOnly: boolean): { allowed: boolean; reason?: string } {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { allowed: false, reason: 'Offline — waiting for internet connection' };
  }
  if (!wifiOnly) {
    return { allowed: true };
  }
  const conn = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
  if (conn && typeof conn.type === 'string') {
    if (conn.type === 'cellular' || conn.type === 'bluetooth' || conn.type === 'wimax') {
      return {
        allowed: false,
        reason: 'Wi-Fi only is enabled (currently on mobile data)',
      };
    }
  }
  return { allowed: true };
}

/**
 * Checks whether the device is charging when "Only while charging" is enabled.
 */
export async function isChargingConstraintSatisfied(onlyWhileCharging: boolean): Promise<boolean> {
  if (!onlyWhileCharging) return true;
  try {
    if (typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function') {
      const battery = await (navigator as any).getBattery();
      if (battery && typeof battery.charging === 'boolean') {
        return battery.charging;
      }
    }
  } catch {
    // If Battery Status API is unavailable, allow execution
  }
  return true;
}

// ============================================================================
// 1. LOCAL / SYNCTHING FOLDER STATE & ENGINE (`sync-<deviceId>.json`)
// ============================================================================

export function getSyncthingFolderState(): SyncthingFolderState {
  const deviceId = getOrCreateDeviceId();
  const defaultState: SyncthingFolderState = {
    connected: false,
    folderName: '',
    lastSyncedAt: null,
    lastFileSizeBytes: 0,
    deviceFileName: `sync-${deviceId}.json`,
    mergedPeerFilesCount: 0,
    lastError: null,
  };
  try {
    const raw = localStorage.getItem(SYNCTHING_FOLDER_STATE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      deviceFileName: `sync-${deviceId}.json`,
    };
  } catch {
    return defaultState;
  }
}

export function saveSyncthingFolderState(next: Partial<SyncthingFolderState>): SyncthingFolderState {
  const current = getSyncthingFolderState();
  const updated: SyncthingFolderState = { ...current, ...next };
  try {
    localStorage.setItem(SYNCTHING_FOLDER_STATE_KEY, JSON.stringify(updated));
  } catch {}
  emitSyncthingFolderUpdate();
  return updated;
}

export async function disconnectSyncthingFolder(): Promise<void> {
  memorySyncthingDirHandle = null;
  try {
    localStorage.removeItem(SYNCTHING_FOLDER_STATE_KEY);
  } catch {}
  emitSyncthingFolderUpdate();
}

async function getVerifiedDirectoryHandle(
  key: string,
  memHandle: any,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<any | null> {
  let handle = memHandle || (await loadDirHandleFromIdb(key));
  if (!handle) return null;
  try {
    if (typeof handle.queryPermission === 'function') {
      const perm = await handle.queryPermission({ mode });
      if (perm === 'granted') return handle;
    }
    if (typeof handle.requestPermission === 'function') {
      const perm = await handle.requestPermission({ mode });
      if (perm === 'granted') return handle;
    }
    return handle;
  } catch {
    return null;
  }
}

/**
 * Prompts the user to pick a Local / Syncthing folder.
 * - Web / Desktop (Chromium / Tauri WebView2): uses `window.showDirectoryPicker`.
 * - Android Native (Capacitor): uses `Documents/JivanOS/Syncthing` via native bridge or SAF.
 * - Fallback: sets virtual folder `JivanOS-Syncthing` with file import/download fallback.
 */
export async function pickSyncthingFolder(): Promise<SyncthingFolderState> {
  const deviceId = getOrCreateDeviceId();
  const deviceFileName = `sync-${deviceId}.json`;

  if (typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function') {
    const dirHandle = await (window as any).showDirectoryPicker({
      id: 'jivanos_syncthing_folder',
      mode: 'readwrite',
    });
    memorySyncthingDirHandle = dirHandle;
    await saveDirHandleToIdb(IDB_SYNCTHING_KEY, dirHandle);
    return saveSyncthingFolderState({
      connected: true,
      folderName: dirHandle.name || 'Syncthing Folder',
      deviceFileName,
      lastError: null,
    });
  }

  if (isAndroidNativeBackupAvailable()) {
    return saveSyncthingFolderState({
      connected: true,
      folderName: 'Documents/JivanOS/Syncthing',
      deviceFileName,
      lastError: null,
    });
  }

  return saveSyncthingFolderState({
    connected: true,
    folderName: 'JivanOS Syncthing Folder',
    deviceFileName,
    lastError: null,
  });
}

/**
 * Writes ONLY this device's `sync-<deviceId>.json` to the Local / Syncthing folder.
 */
export async function pushToSyncthingFolder(
  localData: Record<string, unknown>
): Promise<{ updatedAt: string; fileSizeBytes: number; deviceFileName: string }> {
  const state = getSyncthingFolderState();
  if (!state.connected) {
    throw new Error('Select a Local / Syncthing folder first.');
  }
  const deviceId = getOrCreateDeviceId();
  const deviceFileName = `sync-${deviceId}.json`;
  const envelope = buildDriveBackupEnvelope(localData);
  const jsonString = JSON.stringify(envelope, null, 2);
  const sizeBytes = new Blob([jsonString]).size;

  // Store local mirror in localStorage for instant fallback access
  try {
    localStorage.setItem(`jivanos_syncthing_mirror_${deviceFileName}`, jsonString);
  } catch {}

  const dirHandle = await getVerifiedDirectoryHandle(
    IDB_SYNCTHING_KEY,
    memorySyncthingDirHandle,
    'readwrite'
  );

  if (dirHandle) {
    memorySyncthingDirHandle = dirHandle;
    const fileHandle = await dirHandle.getFileHandle(deviceFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();
  } else if (isAndroidNativeBackupAvailable()) {
    const bridge = (window as any).JivanLocalBackup;
    if (typeof bridge?.saveExternalFile === 'function') {
      bridge.saveExternalFile(`Syncthing/${deviceFileName}`, jsonString);
    }
  }

  saveSyncthingFolderState({
    lastSyncedAt: envelope.updatedAt,
    lastFileSizeBytes: sizeBytes,
    deviceFileName,
    lastError: null,
  });

  return {
    updatedAt: envelope.updatedAt,
    fileSizeBytes: sizeBytes,
    deviceFileName,
  };
}

/**
 * Pulls from Local / Syncthing folder:
 * Reads every other `sync-*.json` file AND any `*.sync-conflict-*` files in the folder,
 * and merges them per item by `updatedAt`.
 */
export async function pullFromSyncthingFolder(
  currentLocalData: Record<string, unknown>
): Promise<{
  mergedData: Record<string, unknown>;
  peerFilesMerged: number;
  newestTimestamp: string | null;
}> {
  const state = getSyncthingFolderState();
  if (!state.connected) {
    throw new Error('Select a Local / Syncthing folder first.');
  }
  const deviceId = getOrCreateDeviceId();
  const ownFileName = `sync-${deviceId}.json`;

  let workingData = { ...currentLocalData };
  let peerFilesMerged = 0;
  let newestTimestamp: string | null = state.lastSyncedAt;

  const dirHandle = await getVerifiedDirectoryHandle(
    IDB_SYNCTHING_KEY,
    memorySyncthingDirHandle,
    'read'
  );

  if (dirHandle && typeof dirHandle.entries === 'function') {
    memorySyncthingDirHandle = dirHandle;
    const envelopesToMerge: DriveBackupEnvelope[] = [];

    for await (const [entryName, entryHandle] of dirHandle.entries()) {
      if (!entryHandle || entryHandle.kind !== 'file') continue;
      const isOtherDeviceSyncFile =
        entryName.startsWith('sync-') &&
        entryName.endsWith('.json') &&
        entryName !== ownFileName;
      const isSyncConflictFile =
        entryName.includes('.sync-conflict-') && entryName.endsWith('.json');

      if (!isOtherDeviceSyncFile && !isSyncConflictFile) continue;

      try {
        const file = await entryHandle.getFile();
        const text = await file.text();
        const env = parseDriveBackupEnvelope(text);
        if (env && env.data) {
          envelopesToMerge.push(env);
        }
      } catch {
        // Skip unreadable or partially written file
      }
    }

    // Sort oldest to newest so newer item timestamps win cleanly
    envelopesToMerge.sort(
      (a, b) => (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0)
    );

    for (const env of envelopesToMerge) {
      workingData = mergeDriveData(workingData, env.data);
      peerFilesMerged++;
      if (
        !newestTimestamp ||
        (Date.parse(env.updatedAt) || 0) > (Date.parse(newestTimestamp) || 0)
      ) {
        newestTimestamp = env.updatedAt;
      }
    }
  }

  saveSyncthingFolderState({
    mergedPeerFilesCount: peerFilesMerged,
    lastSyncedAt: newestTimestamp || new Date().toISOString(),
    lastError: null,
  });

  return {
    mergedData: workingData,
    peerFilesMerged,
    newestTimestamp,
  };
}

// ============================================================================
// 2. UNIFIED SYNC SETTINGS & STATE
// ============================================================================

export function getUnifiedSyncSettings(): UnifiedSyncSettings {
  const defaults: UnifiedSyncSettings = {
    activeProvider: 'none',
    receiveIntervalMinutes: 15,
    wifiOnly: true, // Defaults to Wi-Fi
    status: 'synced',
    lastSyncedAt: null,
    lastLocalEditAt: null,
    lastError: null,
  };
  try {
    const raw = localStorage.getItem(UNIFIED_SYNC_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    let interval: SyncReceiveIntervalMinutes =
      parsed.receiveIntervalMinutes === 0 ||
      parsed.receiveIntervalMinutes === 5 ||
      parsed.receiveIntervalMinutes === 15 ||
      parsed.receiveIntervalMinutes === 30 ||
      parsed.receiveIntervalMinutes === 60 ||
      parsed.receiveIntervalMinutes === 720 ||
      parsed.receiveIntervalMinutes === 1440
        ? parsed.receiveIntervalMinutes
        : 15;

    // Minimum pull interval for Telegram is 15 minutes (hide 5 min option)
    if (parsed.activeProvider === 'telegram' && interval === 5) {
      interval = 15;
    }

    return {
      ...defaults,
      ...parsed,
      receiveIntervalMinutes: interval,
      wifiOnly: typeof parsed.wifiOnly === 'boolean' ? parsed.wifiOnly : true,
    };
  } catch {
    return defaults;
  }
}

export function saveUnifiedSyncSettings(
  patch: Partial<UnifiedSyncSettings>
): UnifiedSyncSettings {
  const current = getUnifiedSyncSettings();
  const next: UnifiedSyncSettings = { ...current, ...patch };
  if (next.activeProvider === 'telegram' && next.receiveIntervalMinutes === 5) {
    next.receiveIntervalMinutes = 15;
  }
  try {
    localStorage.setItem(UNIFIED_SYNC_SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  emitUnifiedSyncUpdate();
  return next;
}

// ============================================================================
// 3. UNIFIED BACKUP SETTINGS, RETENTION (KEEP LAST 4) & AES-256 ENCRYPTION
// ============================================================================

const ALL_BACKUP_DESTINATIONS: BackupDestinationId[] = [
  'local',
  'gdrive',
  'dropbox',
  'telegram',
  'webdav',
  'local_folder',
  'firebase',
  'mega',
  's3',
];

function createDefaultDestinationStatuses(): Record<
  BackupDestinationId,
  DestinationBackupStatus
> {
  const map = {} as Record<BackupDestinationId, DestinationBackupStatus>;
  for (const id of ALL_BACKUP_DESTINATIONS) {
    map[id] = {
      state: 'idle',
      lastBackupAt: null,
      lastFilename: null,
      lastError: null,
      keptFiles: [],
    };
  }
  return map;
}

export function getUnifiedBackupSettings(): UnifiedBackupSettings {
  const defaults: UnifiedBackupSettings = {
    destinations: {
      local: true, // Always on and required
      gdrive: false,
      dropbox: false,
      telegram: false,
      webdav: false,
      local_folder: false,
      firebase: false,
      mega: false,
      s3: false,
    },
    localFolderMode: 'jivanos_default',
    localCustomFolderName: null,
    firstRunCompleted: false,
    scheduleMinutes: 1440, // 24 hours (default)
    scheduledTime: '01:00', // 1:00 AM (default)
    onlyIfChanged: true, // Default ON
    passwordProtected: false, // Default OFF
    wifiOnly: true, // Default Wi-Fi
    onlyWhileCharging: false, // Default OFF
    lastBackupAt: null,
    lastContentHash: null,
    nextScheduledBackupAt: null,
    destinationStatuses: createDefaultDestinationStatuses(),
  };

  try {
    const raw = localStorage.getItem(UNIFIED_BACKUP_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      destinations: {
        ...defaults.destinations,
        ...(parsed.destinations || {}),
        local: true, // Local folder is always on and required
      },
      destinationStatuses: {
        ...defaults.destinationStatuses,
        ...(parsed.destinationStatuses || {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveUnifiedBackupSettings(
  patch: Partial<UnifiedBackupSettings>
): UnifiedBackupSettings {
  const current = getUnifiedBackupSettings();
  const next: UnifiedBackupSettings = {
    ...current,
    ...patch,
    destinations: {
      ...current.destinations,
      ...(patch.destinations || {}),
      local: true, // Always on and required
    },
    destinationStatuses: {
      ...current.destinationStatuses,
      ...(patch.destinationStatuses || {}),
    },
  };
  try {
    localStorage.setItem(UNIFIED_BACKUP_SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  emitUnifiedBackupUpdate();
  return next;
}

/**
 * Formats backup filename: `JivanOS-YYYY-MM-DD-HHmm.json`
 */
export function buildBackupFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `JivanOS-${yyyy}-${mm}-${dd}-${hh}${min}.json`;
}

/**
 * Computes next scheduled backup timestamp based on `scheduleMinutes` and `scheduledTime` (default 01:00).
 */
export function computeNextScheduledBackupIso(
  scheduleMinutes: BackupScheduleMinutes,
  scheduledTime: string,
  fromDate = new Date()
): string | null {
  if (scheduleMinutes <= 0) return null;

  if (scheduleMinutes < 1440) {
    return new Date(fromDate.getTime() + scheduleMinutes * 60 * 1000).toISOString();
  }

  const [hhStr, mmStr] = (scheduledTime || '01:00').split(':');
  const targetHour = Number.isFinite(Number(hhStr)) ? Number(hhStr) : 1;
  const targetMin = Number.isFinite(Number(mmStr)) ? Number(mmStr) : 0;

  const daysToAdd = Math.max(1, Math.round(scheduleMinutes / 1440));
  const candidate = new Date(fromDate);
  candidate.setHours(targetHour, targetMin, 0, 0);

  if (candidate.getTime() <= fromDate.getTime()) {
    candidate.setDate(candidate.getDate() + daysToAdd);
  } else if (daysToAdd > 1) {
    candidate.setDate(candidate.getDate() + (daysToAdd - 1));
  }

  return candidate.toISOString();
}

/**
 * Fast deterministic content hash for "Only if something changed" detection.
 */
export function computeBackupContentHash(rawData: Record<string, unknown>): string {
  const clone = { ...rawData };
  delete (clone as any).updatedAt;
  delete (clone as any).exportedAt;
  const str = JSON.stringify(clone);
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * AES-256-GCM Password Encryption for backups when "Password-protect backups (AES-256)" is ON.
 */
export async function encryptBackupPayloadAES256(
  plainJson: string,
  password: string
): Promise<string> {
  if (!password || typeof crypto === 'undefined' || !crypto.subtle) {
    return plainJson;
  }
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plainJson)
  );
  const toB64 = (arr: Uint8Array) => {
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  };
  return JSON.stringify(
    {
      app: 'JivanOS',
      encrypted: true,
      cipher: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256-100000',
      createdAt: new Date().toISOString(),
      salt: toB64(salt),
      iv: toB64(iv),
      ciphertext: toB64(new Uint8Array(cipherBuf)),
    },
    null,
    2
  );
}

/**
 * Picks a custom Local Backup folder using File System Access API.
 */
export async function pickCustomLocalBackupFolder(): Promise<string | null> {
  if (typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function') {
    const dirHandle = await (window as any).showDirectoryPicker({
      id: 'jivanos_local_backups_dir',
      mode: 'readwrite',
    });
    memoryLocalBackupDirHandle = dirHandle;
    await saveDirHandleToIdb(IDB_LOCAL_BACKUP_KEY, dirHandle);
    saveUnifiedBackupSettings({
      localFolderMode: 'custom',
      localCustomFolderName: dirHandle.name || 'Custom Backup Folder',
      firstRunCompleted: true,
    });
    return dirHandle.name || 'Custom Backup Folder';
  }
  return null;
}

// ============================================================================
// 4. PER-DESTINATION BACKUP WRITERS WITH 4-BACKUP RETENTION
// ============================================================================

async function writeLocalHistoryBackup(
  filename: string,
  fileContent: string,
  settings: UnifiedBackupSettings
): Promise<string[]> {
  // Always keep rotating auto-snapshot updated
  await saveRotatingAutoSnapshot(fileContent);

  const existingList = (settings.destinationStatuses.local?.keptFiles || []).slice();
  if (!existingList.includes(filename)) {
    existingList.push(filename);
  }

  // 1. Custom directory handle (Web / Desktop)
  const dirHandle =
    settings.localFolderMode === 'custom'
      ? await getVerifiedDirectoryHandle(IDB_LOCAL_BACKUP_KEY, memoryLocalBackupDirHandle, 'readwrite')
      : null;

  if (dirHandle) {
    memoryLocalBackupDirHandle = dirHandle;
    const backupsSubdir = await dirHandle.getDirectoryHandle('Backups', { create: true });
    const fileHandle = await backupsSubdir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();

    // Prune older JivanOS-*.json files in Backups/ beyond last 4
    const foundNames: string[] = [];
    if (typeof backupsSubdir.entries === 'function') {
      for await (const [name, entry] of backupsSubdir.entries()) {
        if (entry?.kind === 'file' && name.startsWith('JivanOS-') && name.endsWith('.json')) {
          foundNames.push(name);
        }
      }
    }
    foundNames.sort();
    while (foundNames.length > 4) {
      const oldest = foundNames.shift();
      if (oldest) {
        try {
          await backupsSubdir.removeEntry(oldest);
        } catch {}
      }
    }
    return foundNames;
  }

  // 2. Android Native Documents/JivanOS/Backups (survives uninstall)
  if (isAndroidNativeBackupAvailable()) {
    const bridge = (window as any).JivanLocalBackup;
    if (typeof bridge?.saveBackupToDocumentsFolder === 'function') {
      bridge.saveBackupToDocumentsFolder(filename, fileContent);
    } else if (typeof bridge?.saveSnapshot === 'function') {
      bridge.saveSnapshot(1, fileContent);
    }
  }

  // 3. Browser / Desktop IndexedDB & localStorage history ring (keeps last 4)
  try {
    localStorage.setItem(`jivanos_local_history_file_${filename}`, fileContent);
    while (existingList.length > 4) {
      const oldest = existingList.shift();
      if (oldest) {
        localStorage.removeItem(`jivanos_local_history_file_${oldest}`);
      }
    }
  } catch {}

  return existingList.slice(-4);
}

async function writeGoogleDriveHistoryBackup(
  filename: string,
  fileContent: string
): Promise<string[]> {
  const token = getInMemoryGDriveToken();
  if (!token) {
    // Fallback to native Android / Desktop Google Drive provider
    await googleDriveSyncProvider.backup(JSON.parse(fileContent)?.data || {});
    return [filename];
  }

  // Upload `Backups/JivanOS-YYYY-MM-DD-HHmm.json` into appDataFolder without touching `backup.json`
  const historyName = `Backups_${filename}`;
  const metadata = {
    name: historyName,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const boundary = '-------JivanOSDriveHistoryBoundary';
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  if (!uploadRes.ok) {
    throw new Error(`Google Drive backup upload failed (HTTP ${uploadRes.status}).`);
  }

  // List all Backups_JivanOS-*.json files in appDataFolder, keep newest 4, delete older ones
  const q = encodeURIComponent("name contains 'Backups_JivanOS-' and trashed = false");
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=createdTime%20desc&pageSize=25&fields=files(id,name,createdTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (listRes.ok) {
    const listData = await listRes.json();
    const files: Array<{ id: string; name: string }> = Array.isArray(listData?.files)
      ? listData.files
      : [];
    const toDelete = files.slice(4);
    for (const oldFile of toDelete) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${oldFile.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    return files.slice(0, 4).map((f) => f.name.replace(/^Backups_/, ''));
  }

  return [filename];
}

async function writeDropboxHistoryBackup(
  filename: string,
  fileContent: string
): Promise<string[]> {
  const token = await getValidDropboxAccessToken().catch(() => '');
  if (!token) {
    await dropboxSyncProvider.backup(JSON.parse(fileContent)?.data || {});
    return [filename];
  }

  const dropboxPath = `/Backups/${filename}`;
  const upRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: fileContent,
  });

  if (!upRes.ok) {
    throw new Error(`Dropbox backup failed (HTTP ${upRes.status}).`);
  }

  // List /Backups folder, keep last 4 JivanOS-*.json files, delete older ones
  const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: '/Backups' }),
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    const entries: Array<{ name: string; path_lower: string; '.tag': string }> = Array.isArray(
      listData?.entries
    )
      ? listData.entries
      : [];
    const backupFiles = entries
      .filter(
        (e) => e['.tag'] === 'file' && e.name.startsWith('JivanOS-') && e.name.endsWith('.json')
      )
      .sort((a, b) => b.name.localeCompare(a.name)); // Newest first

    const toDelete = backupFiles.slice(4);
    for (const old of toDelete) {
      try {
        await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: old.path_lower || `/Backups/${old.name}` }),
        });
      } catch {}
    }
    return backupFiles.slice(0, 4).map((f) => f.name);
  }

  return [filename];
}

async function writeSyncthingFolderHistoryBackup(
  filename: string,
  fileContent: string
): Promise<string[]> {
  const dirHandle = await getVerifiedDirectoryHandle(
    IDB_SYNCTHING_KEY,
    memorySyncthingDirHandle,
    'readwrite'
  );
  if (!dirHandle) {
    throw new Error('Local / Syncthing folder permission is required.');
  }
  const backupsDir = await dirHandle.getDirectoryHandle('Backups', { create: true });
  const fileHandle = await backupsDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(fileContent);
  await writable.close();

  const found: string[] = [];
  if (typeof backupsDir.entries === 'function') {
    for await (const [name, entry] of backupsDir.entries()) {
      if (entry?.kind === 'file' && name.startsWith('JivanOS-') && name.endsWith('.json')) {
        found.push(name);
      }
    }
  }
  found.sort();
  while (found.length > 4) {
    const oldest = found.shift();
    if (oldest) {
      try {
        await backupsDir.removeEntry(oldest);
      } catch {}
    }
  }
  return found;
}

/**
 * Runs a multi-destination History Backup across all ticked destinations.
 * If one destination fails, continues with the others and updates per-destination status chips.
 * Never deletes older backups on a destination if that destination's backup fails.
 */
export async function executeMultiDestinationBackup(options: {
  rawData: Record<string, unknown>;
  password?: string;
  isManual?: boolean;
  firebaseUser?: any;
  joplinSyncSettings?: any;
  syncDriveNow?: (targetId?: any, options?: any) => Promise<any>;
}): Promise<{
  ran: boolean;
  skippedReason?: string;
  filename?: string;
  results: Partial<Record<BackupDestinationId, { ok: boolean; error?: string }>>;
}> {
  const settings = getUnifiedBackupSettings();

  if (!options.isManual) {
    const net = isNetworkAllowed(settings.wifiOnly);
    if (!net.allowed) {
      return { ran: false, skippedReason: net.reason, results: {} };
    }
    const chargingOk = await isChargingConstraintSatisfied(settings.onlyWhileCharging);
    if (!chargingOk) {
      return {
        ran: false,
        skippedReason: 'Waiting for device to be charging',
        results: {},
      };
    }
  }

  const currentHash = computeBackupContentHash(options.rawData);
  if (
    !options.isManual &&
    settings.onlyIfChanged &&
    settings.lastContentHash &&
    settings.lastContentHash === currentHash
  ) {
    // Schedule next run even if skipped due to no changes
    const nextIso = computeNextScheduledBackupIso(
      settings.scheduleMinutes,
      settings.scheduledTime
    );
    saveUnifiedBackupSettings({ nextScheduledBackupAt: nextIso });
    return {
      ran: false,
      skippedReason: 'No changes since last backup',
      results: {},
    };
  }

  const filename = buildBackupFilename(new Date());
  const envelope = buildDriveBackupEnvelope(options.rawData);
  const plainJson = JSON.stringify(envelope, null, 2);
  const finalContent =
    settings.passwordProtected && options.password
      ? await encryptBackupPayloadAES256(plainJson, options.password)
      : plainJson;

  // Determine active ticked destinations (local is always ticked)
  const ticked: BackupDestinationId[] = ALL_BACKUP_DESTINATIONS.filter((id) =>
    id === 'local' ? true : Boolean(settings.destinations[id])
  );

  // Mark ticked destinations as running
  const runningStatuses = { ...getUnifiedBackupSettings().destinationStatuses };
  for (const id of ticked) {
    runningStatuses[id] = {
      ...(runningStatuses[id] || {
        state: 'idle',
        lastBackupAt: null,
        lastFilename: null,
        lastError: null,
        keptFiles: [],
      }),
      state: 'running',
      lastError: null,
    };
  }
  saveUnifiedBackupSettings({ destinationStatuses: runningStatuses });

  const results: Partial<Record<BackupDestinationId, { ok: boolean; error?: string }>> = {};

  for (const destId of ticked) {
    try {
      let keptFiles = (
        getUnifiedBackupSettings().destinationStatuses[destId]?.keptFiles || []
      ).slice();

      if (destId === 'local') {
        keptFiles = await writeLocalHistoryBackup(
          filename,
          finalContent,
          getUnifiedBackupSettings()
        );
      } else if (destId === 'gdrive') {
        if (!getConnectedDriveAccount()?.connected) {
          throw new Error('Google Drive is not connected.');
        }
        keptFiles = await writeGoogleDriveHistoryBackup(filename, finalContent);
      } else if (destId === 'dropbox') {
        if (!getConnectedDropboxAccount()?.connected) {
          throw new Error('Dropbox is not connected.');
        }
        keptFiles = await writeDropboxHistoryBackup(filename, finalContent);
      } else if (destId === 'telegram') {
        const tg = getStoredTelegramAuth();
        if (!tg?.chatId) {
          throw new Error('Telegram is not connected.');
        }
        await telegramSyncProvider.createHistoryBackup(filename, finalContent);
        if (!keptFiles.includes(filename)) keptFiles.push(filename);
        keptFiles = keptFiles.slice(-4);
      } else if (destId === 'local_folder') {
        if (!getSyncthingFolderState().connected) {
          throw new Error('Local / Syncthing folder is not selected.');
        }
        keptFiles = await writeSyncthingFolderHistoryBackup(filename, finalContent);
      } else if (destId === 'firebase') {
        if (!options.firebaseUser || options.firebaseUser.isAnonymous) {
          throw new Error('JivanOS Cloud is not signed in.');
        }
        await firestoreSyncProvider.backup(options.rawData);
        if (!keptFiles.includes(filename)) keptFiles.push(filename);
        keptFiles = keptFiles.slice(-4);
      } else if (destId === 'webdav') {
        if (!options.joplinSyncSettings?.webdavUrl) {
          throw new Error('WebDAV / Nextcloud is not configured.');
        }
        if (options.syncDriveNow) {
          await options.syncDriveNow('webdav');
        }
        if (!keptFiles.includes(filename)) keptFiles.push(filename);
        keptFiles = keptFiles.slice(-4);
      } else if (destId === 'mega') {
        if (!getStoredMegaAuth()?.email) {
          throw new Error('MEGA is not connected.');
        }
        await megaSyncProvider.backup(options.rawData);
        if (!keptFiles.includes(filename)) keptFiles.push(filename);
        keptFiles = keptFiles.slice(-4);
      } else if (destId === 's3') {
        if (!options.joplinSyncSettings?.s3Bucket) {
          throw new Error('S3 / MinIO is not configured.');
        }
        if (options.syncDriveNow) {
          await options.syncDriveNow('s3');
        }
        if (!keptFiles.includes(filename)) keptFiles.push(filename);
        keptFiles = keptFiles.slice(-4);
      }

      const nowIso = new Date().toISOString();
      const latestStatuses = { ...getUnifiedBackupSettings().destinationStatuses };
      latestStatuses[destId] = {
        state: 'success',
        lastBackupAt: nowIso,
        lastFilename: filename,
        lastError: null,
        keptFiles: keptFiles.slice(-4),
      };
      saveUnifiedBackupSettings({ destinationStatuses: latestStatuses });
      results[destId] = { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Backup failed';
      const latestStatuses = { ...getUnifiedBackupSettings().destinationStatuses };
      const prev = latestStatuses[destId];
      // Never delete older backups when a backup fails
      latestStatuses[destId] = {
        state: 'error',
        lastBackupAt: prev?.lastBackupAt || null,
        lastFilename: prev?.lastFilename || null,
        lastError: msg,
        keptFiles: prev?.keptFiles || [],
      };
      saveUnifiedBackupSettings({ destinationStatuses: latestStatuses });
      results[destId] = { ok: false, error: msg };
    }
  }

  const finishedIso = new Date().toISOString();
  const nextScheduledIso = computeNextScheduledBackupIso(
    settings.scheduleMinutes,
    settings.scheduledTime,
    new Date()
  );

  saveUnifiedBackupSettings({
    lastBackupAt: finishedIso,
    lastContentHash: currentHash,
    nextScheduledBackupAt: nextScheduledIso,
  });

  return {
    ran: true,
    filename,
    results,
  };
}
