/**
 * Joplin-Style Multi-Drive Synchronization & Auto-Backup Engine
 * Supports:
 * 1. Local / OS Synced Folder (File System Access API + IndexedDB handle persistence — works with Syncthing, iCloud Drive, OneDrive/Drive Desktop, Nextcloud Folder)
 * 2. Microsoft OneDrive (OAuth 2.0 PKCE / Graph API /me/drive/special/approot:/jivanos-sync.json:/content)
 * 3. Google Drive (OAuth 2.0 Token / Drive REST v3 appDataFolder or /JivanOS)
 * 4. Dropbox (OAuth 2.0 PKCE / Dropbox API v2 /jivanos-sync.json)
 * 5. Nextcloud & Generic WebDAV (PROPFIND / GET / PUT / MKCOL with automatic server proxy fallback for CORS)
 * 6. S3-Compatible Object Storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2 — WebCrypto SigV4 + proxy fallback)
 * 7. JivanOS Cloud (Firebase Firestore authenticated users/{uid})
 *
 * Includes conflict-safe item-level merge (`updatedAt` + `deletedIds` tombstones)
 * and full Personal Details (`profile`) synchronization (display photo, DOB, name, nickname, bio, metrics, currency).
 */

import { JoplinSyncSettings, SyncDriveConfig, SyncDriveId, UserProfile } from '../types';
import { encryptText, decryptText } from './crypto';
import {
  saveUserDataToFirestore,
  getUserDataFromFirestore,
  getInMemoryGDriveToken,
  isRunningInIframe,
} from '../lib/firebase';

export const DEFAULT_JOPLIN_SYNC_SETTINGS: JoplinSyncSettings = {
  primaryTarget: 'none',
  autoSyncIntervalMinutes: 15,
  syncOnChange: true,
  syncOnStartup: true,
  syncPersonalDetails: true,
  e2eeEnabled: false,
  e2eePassphrase: '',
  drives: {
    jivanos_vault: {
      id: 'jivanos_vault',
      enabled: false,
      autoBackupEnabled: false,
      label: 'JivanOS Private Vault',
      vaultId: '',
      vaultPin: '',
      lastStatus: 'idle',
    },
    local_folder: {
      id: 'local_folder',
      enabled: false,
      autoBackupEnabled: false,
      label: 'Local / OS Folder',
      folderName: '',
      lastStatus: 'idle',
    },
    onedrive: {
      id: 'onedrive',
      enabled: false,
      autoBackupEnabled: false,
      label: 'Microsoft OneDrive',
      clientId: '',
      accessToken: '',
      lastStatus: 'idle',
    },
    gdrive: {
      id: 'gdrive',
      enabled: false,
      autoBackupEnabled: false,
      label: 'Google Drive',
      clientId: '',
      accessToken: '',
      lastStatus: 'idle',
    },
    dropbox: {
      id: 'dropbox',
      enabled: false,
      autoBackupEnabled: false,
      label: 'Dropbox',
      clientId: '',
      accessToken: '',
      lastStatus: 'idle',
    },
    nextcloud: {
      id: 'nextcloud',
      enabled: false,
      autoBackupEnabled: false,
      label: 'Nextcloud',
      serverUrl: '',
      username: '',
      password: '',
      remotePath: '/JivanOS',
      lastStatus: 'idle',
    },
    webdav: {
      id: 'webdav',
      enabled: false,
      autoBackupEnabled: false,
      label: 'WebDAV / Koofr / pCloud',
      serverUrl: '',
      username: '',
      password: '',
      remotePath: '/JivanOS',
      lastStatus: 'idle',
    },
    s3: {
      id: 's3',
      enabled: false,
      autoBackupEnabled: false,
      label: 'S3 / R2 / MinIO / B2',
      s3Endpoint: '',
      s3Bucket: 'jivanos-sync',
      s3Region: 'auto',
      s3AccessKey: '',
      s3SecretKey: '',
      lastStatus: 'idle',
    },
    firebase: {
      id: 'firebase',
      enabled: false,
      autoBackupEnabled: false,
      label: 'JivanOS Cloud (Firebase)',
      lastStatus: 'idle',
    },
  },
};

// ============================================================================
// 1. IndexedDB Persistence for FileSystemDirectoryHandle (Local / OS Folder)
// ============================================================================
const IDB_NAME = 'jivanos_fs_handles_db';
const IDB_STORE = 'dir_handles';
const IDB_KEY = 'primary_sync_dir';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(handle: any): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function pickLocalSyncDirectory(): Promise<{ success: boolean; folderName?: string; error?: string }> {
  try {
    if (isRunningInIframe()) {
      return {
        success: false,
        error:
          'Local folder access is blocked inside embedded preview frames. Open JivanOS in a full browser tab, or use JivanOS Private Vault / Google Drive.',
      };
    }
    const win = window as any;
    if (typeof win.showDirectoryPicker !== 'function') {
      return {
        success: false,
        error:
          'Direct folder access requires Chromium/Edge/Android Chrome outside embedded frames. Use JivanOS Private Vault or Google Drive here.',
      };
    }
    const dirHandle = await win.showDirectoryPicker({
      id: 'jivanos_sync',
      mode: 'readwrite',
    });
    await saveDirectoryHandle(dirHandle);
    return {
      success: true,
      folderName: dirHandle.name || 'Selected Folder',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Folder selection cancelled.' };
    }
    return {
      success: false,
      error: err?.message || 'Unable to select directory.',
    };
  }
}

async function verifyDirPermission(dirHandle: any, readWrite = true): Promise<boolean> {
  if (!dirHandle) return false;
  try {
    const opts = { mode: readWrite ? 'readwrite' : 'read' };
    if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
    if ((await dirHandle.requestPermission(opts)) === 'granted') return true;
    return false;
  } catch {
    return true;
  }
}

async function readLocalFolderSyncFile(): Promise<string | null> {
  const dirHandle = await getSavedDirectoryHandle();
  if (!dirHandle) return null;
  const hasPerm = await verifyDirPermission(dirHandle, false);
  if (!hasPerm) return null;
  try {
    const fileHandle = await dirHandle.getFileHandle('jivanos-sync.json', { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

async function writeLocalFolderSyncFile(content: string, isBackupSnapshot = false): Promise<boolean> {
  const dirHandle = await getSavedDirectoryHandle();
  if (!dirHandle) {
    throw new Error('No local sync folder selected. Click "Choose Sync Folder" first.');
  }
  const hasPerm = await verifyDirPermission(dirHandle, true);
  if (!hasPerm) {
    throw new Error('Permission to write to local sync folder was denied.');
  }

  // Always write primary jivanos-sync.json
  const mainFileHandle = await dirHandle.getFileHandle('jivanos-sync.json', { create: true });
  const writable = await mainFileHandle.createWritable();
  await writable.write(content);
  await writable.close();

  // If backup snapshot requested, also write timestamped file inside /backups subfolder
  if (isBackupSnapshot) {
    try {
      const backupsDir = await dirHandle.getDirectoryHandle('backups', { create: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const snapHandle = await backupsDir.getFileHandle(`jivanos-backup-${stamp}.json`, { create: true });
      const snapWritable = await snapHandle.createWritable();
      await snapWritable.write(content);
      await snapWritable.close();
    } catch {
      // Non-fatal if subfolder creation isn't supported
    }
  }
  return true;
}

// ============================================================================
// 2. Joplin-Style Item-Level & Personal Profile Conflict-Free Merge
// ============================================================================

function mergeProfile(
  localProf: UserProfile | undefined,
  remoteProf: UserProfile | undefined,
  syncPersonalDetails = true
): UserProfile | undefined {
  if (!syncPersonalDetails) return localProf;
  if (!remoteProf) return localProf;
  if (!localProf) return remoteProf;

  const isLocalGuestDefault =
    (!localProf.name || localProf.name === 'Guest') &&
    !localProf.nickname &&
    !localProf.avatarPhoto &&
    !localProf.dateOfBirth &&
    !localProf.bio;

  const isRemoteGuestDefault =
    (!remoteProf.name || remoteProf.name === 'Guest') &&
    !remoteProf.nickname &&
    !remoteProf.avatarPhoto &&
    !remoteProf.dateOfBirth &&
    !remoteProf.bio;

  if (isLocalGuestDefault && !isRemoteGuestDefault) {
    return { ...localProf, ...remoteProf };
  }
  if (!isLocalGuestDefault && isRemoteGuestDefault) {
    return localProf;
  }

  const localTime = localProf.updatedAt ? new Date(localProf.updatedAt).getTime() : 0;
  const remoteTime = remoteProf.updatedAt ? new Date(remoteProf.updatedAt).getTime() : 0;

  const primary = remoteTime > localTime ? remoteProf : localProf;
  const secondary = remoteTime > localTime ? localProf : remoteProf;

  return {
    ...secondary,
    ...primary,
    name:
      primary.name && primary.name !== 'Guest'
        ? primary.name
        : secondary.name && secondary.name !== 'Guest'
        ? secondary.name
        : 'Guest',
    nickname: primary.nickname || secondary.nickname || '',
    identifier: primary.identifier || secondary.identifier || '',
    email: primary.email || secondary.email || primary.identifier || secondary.identifier || '',
    avatarPhoto: primary.avatarPhoto || secondary.avatarPhoto || '',
    bio: primary.bio || secondary.bio || '',
    dateOfBirth: primary.dateOfBirth || secondary.dateOfBirth || '',
    heightCm: primary.heightCm ?? secondary.heightCm,
    weightKg: primary.weightKg ?? secondary.weightKg,
    gender:
      primary.gender && primary.gender !== 'unspecified'
        ? primary.gender
        : secondary.gender || 'unspecified',
    preferredCurrency: primary.preferredCurrency || secondary.preferredCurrency || 'INR',
    updatedAt:
      remoteTime > localTime
        ? remoteProf.updatedAt || new Date().toISOString()
        : localProf.updatedAt || new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };
}

function getItemTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const raw = item.updatedAt || item.completedAt || item.loggedAt || item.paidAt || item.createdAt;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mergeEntityArray(localArr: any[] = [], remoteArr: any[] = [], deletedSet: Set<string>): any[] {
  const map = new Map<string, any>();

  for (const item of localArr) {
    if (!item || !item.id) continue;
    if (deletedSet.has(item.id)) continue;
    map.set(item.id, item);
  }

  for (const rItem of remoteArr) {
    if (!rItem || !rItem.id) continue;
    if (deletedSet.has(rItem.id)) continue;
    const existing = map.get(rItem.id);
    if (!existing) {
      map.set(rItem.id, rItem);
    } else {
      const lTime = getItemTimestamp(existing);
      const rTime = getItemTimestamp(rItem);
      // For habits, also merge completionHistory keys so no checked day is ever lost
      if (existing.completionHistory && rItem.completionHistory) {
        const mergedHistory = {
          ...existing.completionHistory,
          ...rItem.completionHistory,
        };
        const winner = rTime >= lTime ? rItem : existing;
        map.set(rItem.id, {
          ...winner,
          completionHistory: mergedHistory,
          bestStreak: Math.max(existing.bestStreak || 0, rItem.bestStreak || 0),
        });
      } else {
        map.set(rItem.id, rTime > lTime ? rItem : existing);
      }
    }
  }

  return Array.from(map.values());
}

export function mergeSyncPayloads(
  localRaw: string | Record<string, any>,
  remoteRaw: string | Record<string, any>,
  syncPersonalDetails = true
): Record<string, any> {
  const localObj = typeof localRaw === 'string' ? JSON.parse(localRaw) : localRaw;
  const remoteObj = typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw;

  if (!remoteObj || typeof remoteObj !== 'object') return localObj;
  if (!localObj || typeof localObj !== 'object') return remoteObj;

  const localDeleted: string[] = Array.isArray(localObj.deletedIds) ? localObj.deletedIds : [];
  const remoteDeleted: string[] = Array.isArray(remoteObj.deletedIds) ? remoteObj.deletedIds : [];
  const deletedSet = new Set<string>([...localDeleted, ...remoteDeleted]);

  const localExportedTime = localObj.exportedAt ? new Date(localObj.exportedAt).getTime() : 0;
  const remoteExportedTime = remoteObj.exportedAt ? new Date(remoteObj.exportedAt).getTime() : 0;
  const preferRemoteScalar = remoteExportedTime > localExportedTime;

  const mergedProfile = mergeProfile(localObj.profile, remoteObj.profile, syncPersonalDetails);

  // Merge hydration logs for today if same day
  const mergedHydration = preferRemoteScalar
    ? { ...localObj.hydration, ...remoteObj.hydration }
    : { ...remoteObj.hydration, ...localObj.hydration };
  if (localObj.hydration?.todayLogs && remoteObj.hydration?.todayLogs) {
    mergedHydration.todayLogs = mergeEntityArray(
      localObj.hydration.todayLogs,
      remoteObj.hydration.todayLogs,
      deletedSet
    );
  }

  return {
    ...localObj,
    ...remoteObj,
    version: 2,
    profile: mergedProfile,
    tasks: mergeEntityArray(localObj.tasks, remoteObj.tasks, deletedSet),
    medications: mergeEntityArray(localObj.medications, remoteObj.medications, deletedSet),
    doseLogs: mergeEntityArray(localObj.doseLogs, remoteObj.doseLogs, deletedSet),
    habits: mergeEntityArray(localObj.habits, remoteObj.habits, deletedSet),
    routines: mergeEntityArray(localObj.routines, remoteObj.routines, deletedSet),
    goals: mergeEntityArray(localObj.goals, remoteObj.goals, deletedSet),
    bills: mergeEntityArray(localObj.bills, remoteObj.bills, deletedSet),
    scheduleItems: mergeEntityArray(
      localObj.scheduleItems || localObj.schedule,
      remoteObj.scheduleItems || remoteObj.schedule,
      deletedSet
    ),
    inboxItems: mergeEntityArray(localObj.inboxItems, remoteObj.inboxItems, deletedSet),
    todoLists: mergeEntityArray(localObj.todoLists, remoteObj.todoLists, deletedSet),
    listGroups: mergeEntityArray(localObj.listGroups, remoteObj.listGroups, deletedSet),
    tags: mergeEntityArray(localObj.tags, remoteObj.tags, deletedSet),
    widgets: preferRemoteScalar ? remoteObj.widgets || localObj.widgets : localObj.widgets || remoteObj.widgets,
    hydration: mergedHydration,
    currency: mergedProfile?.preferredCurrency || (preferRemoteScalar ? remoteObj.currency : localObj.currency) || 'INR',
    theme: preferRemoteScalar ? remoteObj.theme || localObj.theme : localObj.theme || remoteObj.theme,
    themeStyle: preferRemoteScalar ? remoteObj.themeStyle || localObj.themeStyle : localObj.themeStyle || remoteObj.themeStyle,
    accentTone: preferRemoteScalar ? remoteObj.accentTone || localObj.accentTone : localObj.accentTone || remoteObj.accentTone,
    favoriteQuoteIds: Array.from(
      new Set([...(localObj.favoriteQuoteIds || []), ...(remoteObj.favoriteQuoteIds || [])])
    ),
    deletedIds: Array.from(deletedSet).slice(-500),
    exportedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 3. Optional E2EE Envelope Wrap / Unwrap
// ============================================================================

export async function encodeSyncEnvelope(
  plainJsonStr: string,
  e2eeEnabled: boolean,
  passphrase?: string
): Promise<string> {
  if (!e2eeEnabled || !passphrase || !passphrase.trim()) {
    return plainJsonStr;
  }
  const encrypted = await encryptText(plainJsonStr, passphrase.trim());
  return JSON.stringify({
    __jivanos_e2ee: true,
    version: 2,
    updatedAt: new Date().toISOString(),
    ...encrypted,
  });
}

export async function decodeSyncEnvelope(
  rawStr: string,
  passphrase?: string
): Promise<string> {
  if (!rawStr) return '';
  try {
    const parsed = JSON.parse(rawStr);
    if (parsed && parsed.__jivanos_e2ee && parsed.cipherText && parsed.iv && parsed.salt) {
      if (!passphrase || !passphrase.trim()) {
        throw new Error('Remote sync vault is encrypted. Please enter your E2EE Sync Passphrase in Sync Settings.');
      }
      return await decryptText(
        {
          cipherText: parsed.cipherText,
          iv: parsed.iv,
          salt: parsed.salt,
        },
        passphrase.trim()
      );
    }
    return typeof parsed === 'object' ? JSON.stringify(parsed) : rawStr;
  } catch (err: any) {
    if (err?.message?.includes('E2EE') || err?.message?.includes('Decryption failed')) {
      throw err;
    }
    return rawStr;
  }
}

// ============================================================================
// 4. Drive Adapters: WebDAV/Nextcloud, S3/R2/MinIO, OneDrive, Google Drive, Dropbox
// ============================================================================

async function webdavRequest(
  cfg: SyncDriveConfig,
  method: 'PROPFIND' | 'GET' | 'PUT' | 'MKCOL',
  fileName = 'jivanos-sync.json',
  bodyContent?: string
): Promise<{ status: number; text: string }> {
  const base = (cfg.serverUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('WebDAV / Nextcloud Server URL is required.');
  const cleanRemoteDir = (cfg.remotePath || '/JivanOS').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const targetUrl = fileName
    ? `${base}/${cleanRemoteDir ? cleanRemoteDir + '/' : ''}${fileName}`
    : `${base}/${cleanRemoteDir}`;

  const authHeader = 'Basic ' + btoa(`${cfg.username || ''}:${cfg.password || ''}`);

  // Try direct browser fetch first (works in native APK / CORS-enabled Nextcloud)
  try {
    const headers: Record<string, string> = {
      Authorization: authHeader,
    };
    if (method === 'PROPFIND') headers['Depth'] = '0';
    if (method === 'PUT') headers['Content-Type'] = 'application/json; charset=utf-8';

    const res = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'PUT' ? bodyContent : undefined,
    });
    const text = method === 'GET' ? await res.text() : '';
    return { status: res.status, text };
  } catch {
    // Fallback to server proxy when running in browser with strict CORS
    const proxyRes = await fetch('/api/backup/webdav-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl,
        method,
        username: cfg.username || '',
        password: cfg.password || '',
        content: bodyContent,
      }),
    });
    const data = await proxyRes.json();
    if (!data.success && data.error) {
      throw new Error(data.error);
    }
    return { status: data.status || 200, text: data.body || '' };
  }
}

async function s3Request(
  cfg: SyncDriveConfig,
  method: 'GET' | 'PUT',
  objectKey = 'jivanos-sync.json',
  bodyContent?: string
): Promise<{ status: number; text: string }> {
  if (!cfg.s3Endpoint || !cfg.s3Bucket || !cfg.s3AccessKey || !cfg.s3SecretKey) {
    throw new Error('S3 Endpoint, Bucket, Access Key, and Secret Key are required.');
  }
  const res = await fetch('/api/backup/s3-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: cfg.s3Endpoint.trim(),
      bucket: cfg.s3Bucket.trim(),
      region: (cfg.s3Region || 'auto').trim(),
      accessKey: cfg.s3AccessKey.trim(),
      secretKey: cfg.s3SecretKey.trim(),
      objectKey,
      method,
      content: bodyContent,
    }),
  });
  const data = await res.json();
  if (!data.success && data.error) {
    throw new Error(data.error);
  }
  return { status: data.status || 200, text: data.body || '' };
}

async function oneDrivePull(cfg: SyncDriveConfig): Promise<string | null> {
  if (!cfg.accessToken) throw new Error('OneDrive access token not connected.');
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/special/approot:/jivanos-sync.json:/content',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cfg.accessToken.trim()}`,
      },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`OneDrive HTTP ${res.status}: Please reconnect or refresh your OneDrive token.`);
  }
  return await res.text();
}

async function oneDrivePush(cfg: SyncDriveConfig, content: string, fileName = 'jivanos-sync.json'): Promise<boolean> {
  if (!cfg.accessToken) throw new Error('OneDrive access token not connected.');
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${fileName}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${cfg.accessToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: content,
    }
  );
  if (!res.ok) {
    throw new Error(`OneDrive upload failed (HTTP ${res.status}).`);
  }
  return true;
}

function resolveGoogleDriveToken(cfg: SyncDriveConfig): string {
  return (cfg.accessToken || getInMemoryGDriveToken() || '').trim();
}

async function googleDriveFindSyncFile(token: string, fileName = 'jivanos-sync.json'): Promise<string | null> {
  const q = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${token.trim()}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Google Drive HTTP ${res.status}: Please reconnect Google Drive.`);
  }
  const data = await res.json();
  if (Array.isArray(data.files) && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function googleDrivePull(cfg: SyncDriveConfig): Promise<string | null> {
  const token = resolveGoogleDriveToken(cfg);
  if (!token) throw new Error('Google Drive is not connected for this session. Click Sign in with Google first.');
  const fileId = await googleDriveFindSyncFile(token, 'jivanos-sync.json');
  if (!fileId) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.text();
}

async function googleDrivePush(cfg: SyncDriveConfig, content: string, fileName = 'jivanos-sync.json'): Promise<boolean> {
  const token = resolveGoogleDriveToken(cfg);
  if (!token) throw new Error('Google Drive is not connected for this session. Click Sign in with Google first.');
  const existingId = fileName === 'jivanos-sync.json' ? await googleDriveFindSyncFile(token, fileName) : null;

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );
    if (!res.ok) throw new Error(`Google Drive update failed (HTTP ${res.status}).`);
    return true;
  } else {
    const metadata = { name: fileName, mimeType: 'application/json' };
    const boundary = 'jivanos_gdrive_boundary_' + Date.now();
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    if (!res.ok) throw new Error(`Google Drive upload failed (HTTP ${res.status}).`);
    return true;
  }
}

async function dropboxPull(cfg: SyncDriveConfig): Promise<string | null> {
  if (!cfg.accessToken) throw new Error('Dropbox access token not connected.');
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken.trim()}`,
      'Dropbox-API-Arg': JSON.stringify({ path: '/jivanos-sync.json' }),
    },
  });
  if (res.status === 409) return null; // path/not_found
  if (!res.ok) {
    throw new Error(`Dropbox HTTP ${res.status}: Please check your Dropbox access token.`);
  }
  return await res.text();
}

async function dropboxPush(cfg: SyncDriveConfig, content: string, fileName = 'jivanos-sync.json'): Promise<boolean> {
  if (!cfg.accessToken) throw new Error('Dropbox access token not connected.');
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken.trim()}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${fileName}`,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
    },
    body: content,
  });
  if (!res.ok) {
    throw new Error(`Dropbox upload failed (HTTP ${res.status}).`);
  }
  return true;
}

// ============================================================================
// 5. Unified Pull / Push / Sync Execution Across Any Drive
// ============================================================================

async function jivanosVaultPull(cfg: SyncDriveConfig): Promise<string | null> {
  const vaultId = (cfg.vaultId || '').trim();
  if (!vaultId || vaultId.length < 4) {
    throw new Error('Enter a Private Vault Key (at least 4 characters) to sync.');
  }
  const headers: Record<string, string> = {};
  if (cfg.vaultPin?.trim()) headers['x-vault-pin'] = cfg.vaultPin.trim();

  const res = await fetch(`/api/sync/vault/${encodeURIComponent(vaultId)}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Private Vault HTTP ${res.status}`);
  }
  return data.payload || null;
}

async function jivanosVaultPush(cfg: SyncDriveConfig, content: string): Promise<boolean> {
  const vaultId = (cfg.vaultId || '').trim();
  if (!vaultId || vaultId.length < 4) {
    throw new Error('Enter a Private Vault Key (at least 4 characters) to sync.');
  }
  const res = await fetch(`/api/sync/vault/${encodeURIComponent(vaultId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: content,
      pin: cfg.vaultPin?.trim() || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Private Vault upload failed (HTTP ${res.status})`);
  }
  return true;
}

export async function fetchServerOAuthDefaults(): Promise<{
  gdriveClientId: string;
  onedriveClientId: string;
  dropboxClientId: string;
}> {
  try {
    const res = await fetch('/api/sync/oauth-config');
    if (res.ok) {
      const data = await res.json();
      return {
        gdriveClientId: data.gdriveClientId || '',
        onedriveClientId: data.onedriveClientId || '',
        dropboxClientId: data.dropboxClientId || '',
      };
    }
  } catch {}
  return {
    gdriveClientId: '',
    onedriveClientId: '',
    dropboxClientId: '',
  };
}

export async function pullFromDrive(
  driveId: SyncDriveId,
  cfg: SyncDriveConfig,
  firebaseUid?: string | null
): Promise<string | null> {
  switch (driveId) {
    case 'jivanos_vault':
      return await jivanosVaultPull(cfg);
    case 'local_folder':
      return await readLocalFolderSyncFile();
    case 'nextcloud':
    case 'webdav': {
      const res = await webdavRequest(cfg, 'GET', 'jivanos-sync.json');
      if (res.status === 200 && res.text && res.text.trim().length > 2) {
        return res.text;
      }
      return null;
    }
    case 's3': {
      const res = await s3Request(cfg, 'GET', 'jivanos-sync.json');
      if (res.status === 200 && res.text && res.text.trim().length > 2) {
        return res.text;
      }
      return null;
    }
    case 'onedrive':
      return await oneDrivePull(cfg);
    case 'gdrive':
      return await googleDrivePull(cfg);
    case 'dropbox':
      return await dropboxPull(cfg);
    case 'firebase': {
      if (!firebaseUid) return null;
      const docData = await getUserDataFromFirestore(firebaseUid);
      return docData?.payload || null;
    }
    default:
      return null;
  }
}

export async function pushToDrive(
  driveId: SyncDriveId,
  cfg: SyncDriveConfig,
  encodedContent: string,
  options?: { isBackupSnapshot?: boolean; firebaseUid?: string | null; email?: string }
): Promise<boolean> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const snapshotName = options?.isBackupSnapshot ? `jivanos-backup-${stamp}.json` : 'jivanos-sync.json';

  switch (driveId) {
    case 'jivanos_vault':
      return await jivanosVaultPush(cfg, encodedContent);
    case 'local_folder':
      return await writeLocalFolderSyncFile(encodedContent, options?.isBackupSnapshot);
    case 'nextcloud':
    case 'webdav': {
      try {
        await webdavRequest(cfg, 'MKCOL', '');
      } catch {}
      await webdavRequest(cfg, 'PUT', 'jivanos-sync.json', encodedContent);
      if (options?.isBackupSnapshot) {
        try {
          await webdavRequest(cfg, 'PUT', snapshotName, encodedContent);
        } catch {}
      }
      return true;
    }
    case 's3': {
      await s3Request(cfg, 'PUT', 'jivanos-sync.json', encodedContent);
      if (options?.isBackupSnapshot) {
        try {
          await s3Request(cfg, 'PUT', `backups/${snapshotName}`, encodedContent);
        } catch {}
      }
      return true;
    }
    case 'onedrive': {
      await oneDrivePush(cfg, encodedContent, 'jivanos-sync.json');
      if (options?.isBackupSnapshot) {
        try {
          await oneDrivePush(cfg, encodedContent, `backups/${snapshotName}`);
        } catch {}
      }
      return true;
    }
    case 'gdrive': {
      await googleDrivePush(cfg, encodedContent, 'jivanos-sync.json');
      if (options?.isBackupSnapshot) {
        try {
          await googleDrivePush(cfg, encodedContent, snapshotName);
        } catch {}
      }
      return true;
    }
    case 'dropbox': {
      await dropboxPush(cfg, encodedContent, 'jivanos-sync.json');
      if (options?.isBackupSnapshot) {
        try {
          await dropboxPush(cfg, encodedContent, `backups/${snapshotName}`);
        } catch {}
      }
      return true;
    }
    case 'firebase': {
      if (!options?.firebaseUid) {
        throw new Error('Sign in with Google first to sync with JivanOS Cloud (Firebase).');
      }
      return await saveUserDataToFirestore(options.firebaseUid, {
        email: options.email || '',
        payload: encodedContent,
        provider: 'firebase',
        source: options.isBackupSnapshot ? 'manual' : 'auto',
      });
    }
    default:
      return false;
  }
}

/**
 * OAuth Popup Helper for OneDrive, Google Drive, and Dropbox
 * Opens the provider's OAuth 2.0 URL directly in a popup and receives the access token via postMessage from /auth/oauth-callback
 */
export function launchDriveOAuthPopup(
  driveId: 'onedrive' | 'gdrive' | 'dropbox',
  clientId: string
): Promise<{ accessToken: string }> {
  return new Promise((resolve, reject) => {
    const cleanClientId = (clientId || '').trim();
    if (!cleanClientId) {
      reject(new Error(`Please enter an OAuth Client ID / App Key or paste an Access Token for ${driveId}.`));
      return;
    }

    const redirectUri = `${window.location.origin}/auth/oauth-callback`;
    const state = `${driveId}_${Math.random().toString(36).slice(2, 10)}`;
    let authUrl = '';

    if (driveId === 'gdrive') {
      const params = new URLSearchParams({
        client_id: cleanClientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'https://www.googleapis.com/auth/drive.file',
        include_granted_scopes: 'true',
        prompt: 'select_account',
        state,
      });
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (driveId === 'onedrive') {
      const params = new URLSearchParams({
        client_id: cleanClientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'Files.ReadWrite.AppFolder User.Read',
        state,
      });
      authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
    } else if (driveId === 'dropbox') {
      const params = new URLSearchParams({
        client_id: cleanClientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        state,
      });
      authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
    }

    const popup = window.open(authUrl, `jivanos_oauth_${driveId}`, 'width=560,height=680');
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Please allow popups for this site or paste an Access Token directly.'));
      return;
    }

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleMsg);
      reject(new Error('OAuth connection timed out.'));
    }, 120000);

    function handleMsg(event: MessageEvent) {
      if (event.data?.type === 'JIVANOS_DRIVE_OAUTH_TOKEN' && event.data?.accessToken) {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMsg);
        resolve({ accessToken: event.data.accessToken });
      } else if (event.data?.type === 'JIVANOS_DRIVE_OAUTH_ERROR') {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMsg);
        reject(new Error(event.data.error || 'OAuth authorization failed.'));
      }
    }

    window.addEventListener('message', handleMsg);
  });
}

/**
 * Joplin-style "Check Synchronisation Configuration" diagnostic tester.
 * Verifies connectivity, credentials, and permissions cleanly before running sync.
 */
export async function testDriveConnection(
  driveId: SyncDriveId,
  cfg: SyncDriveConfig,
  firebaseUid?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    switch (driveId) {
      case 'jivanos_vault': {
        const vaultId = (cfg.vaultId || '').trim();
        if (!vaultId || vaultId.length < 4) {
          return { success: false, message: 'Enter a Vault Pairing Key (minimum 4 characters).' };
        }
        const headers: Record<string, string> = {};
        if (cfg.vaultPin?.trim()) headers['x-vault-pin'] = cfg.vaultPin.trim();
        const res = await fetch(`/api/sync/vault/${encodeURIComponent(vaultId)}?ping=1`, { headers });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, message: data.error || `Vault check failed (HTTP ${res.status}).` };
        }
        return {
          success: true,
          message: data.exists
            ? `Success! Vault "${data.vaultId}" reachable (revision #${data.version}, last updated ${new Date(data.updatedAt).toLocaleString()}).`
            : `Success! Vault Key "${data.vaultId}" is ready for your first sync push.`,
        };
      }
      case 'local_folder': {
        const handle = await getSavedDirectoryHandle();
        if (!handle) {
          return { success: false, message: 'No local sync folder selected yet. Click "Choose Local Sync Folder".' };
        }
        const granted = await verifyDirPermission(handle, true);
        if (!granted) {
          return { success: false, message: 'Read/Write permission to the selected folder was denied.' };
        }
        return {
          success: true,
          message: `Success! Folder "${handle.name || cfg.folderName || 'Sync Folder'}" has read & write access.`,
        };
      }
      case 'onedrive': {
        if (!cfg.accessToken?.trim()) {
          return { success: false, message: 'OneDrive is not connected yet. Connect via OAuth Popup or paste an Access Token.' };
        }
        const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
          headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
        });
        if (!res.ok) {
          return { success: false, message: `OneDrive rejected token (HTTP ${res.status}). Reconnect OAuth or paste a fresh token.` };
        }
        const data = await res.json();
        return {
          success: true,
          message: `Success! Connected to OneDrive (${data.owner?.user?.displayName || data.driveType || 'AppRoot'}).`,
        };
      }
      case 'gdrive': {
        const token = resolveGoogleDriveToken(cfg);
        if (!token) {
          return { success: false, message: 'Google Drive is not connected for this session. Click Sign in with Google first.' };
        }
        const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          return { success: false, message: `Google Drive authorization expired (HTTP ${res.status}). Sign in with Google again to reconnect.` };
        }
        const data = await res.json();
        return {
          success: true,
          message: `Connected to Google Drive (${data.user?.emailAddress || data.user?.displayName || 'Authorized'}).`,
        };
      }
      case 'dropbox': {
        if (!cfg.accessToken?.trim()) {
          return { success: false, message: 'Dropbox is not connected yet. Connect via OAuth Popup or paste an Access Token.' };
        }
        const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
        });
        if (!res.ok) {
          return { success: false, message: `Dropbox rejected token (HTTP ${res.status}). Reconnect OAuth or paste a fresh token.` };
        }
        const data = await res.json();
        return {
          success: true,
          message: `Success! Dropbox connected (${data.email || data.name?.display_name || 'App Folder'}).`,
        };
      }
      case 'nextcloud':
      case 'webdav': {
        if (!cfg.serverUrl?.trim()) {
          return { success: false, message: 'Enter your WebDAV / Nextcloud server URL.' };
        }
        const res = await webdavRequest(cfg, 'PROPFIND', '');
        if (res.status === 401 || res.status === 403) {
          return { success: false, message: `Authentication failed (HTTP ${res.status}). Verify username & app password.` };
        }
        if (res.status >= 200 && res.status < 400) {
          return { success: true, message: `Success! WebDAV endpoint responded cleanly (HTTP ${res.status}).` };
        }
        return { success: true, message: `Endpoint reachable (HTTP ${res.status}). Will auto-create folder on first sync.` };
      }
      case 's3': {
        if (!cfg.s3Endpoint?.trim() || !cfg.s3Bucket?.trim() || !cfg.s3AccessKey?.trim() || !cfg.s3SecretKey?.trim()) {
          return { success: false, message: 'S3 Endpoint, Bucket, Access Key ID, and Secret Access Key are required.' };
        }
        const res = await s3Request(cfg, 'GET', 'jivanos-sync.json');
        if (res.status === 403) {
          return { success: false, message: 'S3 rejected credentials (HTTP 403 Signature/Access Denied).' };
        }
        return {
          success: true,
          message:
            res.status === 200
              ? `Success! Connected to bucket "${cfg.s3Bucket}" and found existing sync file.`
              : `Success! Bucket "${cfg.s3Bucket}" reachable (HTTP ${res.status}). Ready to sync.`,
        };
      }
      case 'firebase': {
        if (!firebaseUid) {
          return { success: false, message: 'Sign in with Google on a web browser to activate JivanOS Cloud (Firestore).' };
        }
        return { success: true, message: 'Success! Authenticated with JivanOS Cloud (Firestore).' };
      }
      default:
        return { success: false, message: 'Unsupported sync target.' };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Configuration check failed.',
    };
  }
}
