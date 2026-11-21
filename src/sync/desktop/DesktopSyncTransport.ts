/**
 * Desktop Sync Transport Adapter (Windows / Linux / macOS — Tauri v2 & Electron)
 *
 * Bridges the shared TypeScript SyncProvider contract to a native Desktop shell:
 * - Tauri v2 (`isDesktop()`): uses `OAuthLoopback` (127.0.0.1 ephemeral port + system browser),
 *   `KeychainService` (Windows Credential Manager / Linux libsecret), HTTPS REST APIs, and
 *   `TrayService` (tray tooltip + native OS sync notifications).
 * - Electron: uses `window.jivanDesktop.sync` exposed via preload `contextBridge` if present.
 * - Web / Android: returns null so providers use their Web PKCE / Capacitor native paths.
 */

import type { SyncAccount, SyncInfo, SyncProviderId } from '../SyncProvider';
import {
  computeInitials,
  formatRelativeSyncTime,
  updateStoredDriveSyncMeta,
} from '../../utils/googleDriveSync';
import {
  DROPBOX_BACKUP_PATH,
  updateStoredDropboxSyncMeta,
} from '../../utils/dropboxSync';
import { KeychainService, isDesktop } from '../../desktop/KeychainService';
import {
  DesktopOAuthTokenBundle,
  getValidDesktopOAuthToken,
  runDesktopOAuthLoopback,
} from '../../desktop/OAuthLoopback';
import {
  sendDesktopSyncNotification,
  updateTraySyncTooltip,
} from '../../desktop/TrayService';

/**
 * Synchronously reads cached desktop OAuth profile metadata from the in-memory
 * keychain mirror (populated after connect/silentReAuth/getToken).
 */
export function getCachedDesktopOAuthAccount(
  providerId: 'gdrive' | 'dropbox'
): SyncAccount | null {
  if (!isDesktop()) return null;
  const raw = KeychainService.getCachedTokenSync(providerId);
  if (!raw) return null;
  try {
    const bundle = JSON.parse(raw) as DesktopOAuthTokenBundle;
    if (!bundle?.accessToken) return null;
    const name = bundle.name || (providerId === 'gdrive' ? 'Google Drive' : 'Dropbox');
    const email = bundle.email || '';
    return {
      connected: true,
      name,
      email,
      initials: computeInitials(name, email),
    };
  } catch {
    return null;
  }
}

export interface DesktopRawRestoreResult {
  found: boolean;
  content: string;
  lastModified: string;
  fileSizeBytes: number;
}

export interface DesktopSyncBridge {
  connect(providerId: SyncProviderId): Promise<SyncAccount>;
  silentReAuth(providerId: SyncProviderId): Promise<SyncAccount | null>;
  isConnected(providerId: SyncProviderId): boolean | Promise<boolean>;
  disconnect(providerId: SyncProviderId): Promise<void>;
  backup(providerId: SyncProviderId, payloadJson: string): Promise<SyncInfo>;
  restore(providerId: SyncProviderId): Promise<DesktopRawRestoreResult>;
  getLastSyncInfo(providerId: SyncProviderId): Promise<SyncInfo | null>;
}

const GDRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const GDRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const GDRIVE_BACKUP_NAME = 'backup.json';

async function fetchGoogleProfile(accessToken: string): Promise<{ name: string; email: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { name: 'Google Drive', email: '' };
  const data = await res.json();
  return {
    name: String(data?.name || data?.email || 'Google Drive'),
    email: String(data?.email || ''),
  };
}

async function fetchDropboxProfile(accessToken: string): Promise<{ name: string; email: string }> {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { name: 'Dropbox', email: '' };
  const data = await res.json();
  return {
    name: String(data?.name?.display_name || data?.email || 'Dropbox'),
    email: String(data?.email || ''),
  };
}

async function findGDriveBackupFile(
  accessToken: string
): Promise<{ id: string; modifiedTime: string; size: number } | null> {
  const q = encodeURIComponent(`name='${GDRIVE_BACKUP_NAME}' and trashed=false`);
  const res = await fetch(
    `${GDRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const file = Array.isArray(json?.files) ? json.files[0] : null;
  if (!file?.id) return null;
  return {
    id: String(file.id),
    modifiedTime: String(file.modifiedTime || new Date().toISOString()),
    size: Number(file.size || 0),
  };
}

function createTauriDesktopSyncBridge(): DesktopSyncBridge {
  return {
    async connect(providerId: SyncProviderId): Promise<SyncAccount> {
      if (providerId !== 'gdrive' && providerId !== 'dropbox') {
        throw new Error(`Provider "${providerId}" uses its own desktop authentication flow.`);
      }

      const bundle = await runDesktopOAuthLoopback(providerId);
      const profile =
        providerId === 'gdrive'
          ? await fetchGoogleProfile(bundle.accessToken)
          : await fetchDropboxProfile(bundle.accessToken);

      const enriched: DesktopOAuthTokenBundle = {
        ...bundle,
        name: profile.name,
        email: profile.email,
      };
      await KeychainService.setToken(providerId, JSON.stringify(enriched));
      if (providerId === 'gdrive') {
        updateStoredDriveSyncMeta({ lastError: null });
      } else {
        updateStoredDropboxSyncMeta({ lastError: null });
      }

      return {
        connected: true,
        name: profile.name,
        email: profile.email,
        initials: computeInitials(profile.name, profile.email),
      };
    },

    async silentReAuth(providerId: SyncProviderId): Promise<SyncAccount | null> {
      if (providerId !== 'gdrive' && providerId !== 'dropbox') return null;
      const bundle = await getValidDesktopOAuthToken(providerId);
      if (!bundle?.accessToken) return null;
      const name = bundle.name || (providerId === 'gdrive' ? 'Google Drive' : 'Dropbox');
      const email = bundle.email || '';
      return {
        connected: true,
        name,
        email,
        initials: computeInitials(name, email),
      };
    },

    isConnected(providerId: SyncProviderId): boolean {
      return Boolean(KeychainService.getCachedTokenSync(providerId));
    },

    async disconnect(providerId: SyncProviderId): Promise<void> {
      await KeychainService.deleteToken(providerId);
      if (providerId === 'gdrive') {
        updateStoredDriveSyncMeta({
          lastSyncedAt: null,
          lastFileSizeBytes: null,
          lastError: null,
          autoSyncEnabled: false,
          autoSyncIntervalMinutes: 0,
        });
      } else if (providerId === 'dropbox') {
        updateStoredDropboxSyncMeta({
          lastSyncedAt: null,
          lastFileSizeBytes: null,
          lastError: null,
          autoSyncEnabled: false,
          autoSyncIntervalMinutes: 0,
        });
      }
      await updateTraySyncTooltip('JivanOS — Ready');
    },

    async backup(providerId: SyncProviderId, payloadJson: string): Promise<SyncInfo> {
      if (providerId !== 'gdrive' && providerId !== 'dropbox') {
        throw new Error(`Unsupported desktop bridge backup provider: ${providerId}`);
      }

      try {
        const bundle = await getValidDesktopOAuthToken(providerId);
        if (!bundle?.accessToken) {
          throw new Error(`Reconnect ${providerId} to resume desktop sync.`);
        }

        const sizeBytes = new TextEncoder().encode(payloadJson).byteLength;

        if (providerId === 'dropbox') {
          const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bundle.accessToken}`,
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
          if (!res.ok) {
            throw new Error(`Dropbox desktop upload failed (HTTP ${res.status}).`);
          }
          const meta = await res.json();
          const lastModified = String(meta?.server_modified || new Date().toISOString());
          const fileSizeBytes = Number(meta?.size || sizeBytes);

          updateStoredDropboxSyncMeta({
            lastSyncedAt: lastModified,
            lastFileSizeBytes: fileSizeBytes,
            lastError: null,
          });
          await updateTraySyncTooltip(`Synced ${formatRelativeSyncTime(lastModified)}`);
          await sendDesktopSyncNotification(true);
          return { lastModified, fileSizeBytes };
        }

        // Google Drive AppDataFolder upload/update
        const existing = await findGDriveBackupFile(bundle.accessToken);
        const boundary = `jivanos_desktop_${Date.now()}`;
        const metadata = existing
          ? { name: GDRIVE_BACKUP_NAME, mimeType: 'application/json' }
          : { name: GDRIVE_BACKUP_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };

        const multipartBody = [
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify(metadata),
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          payloadJson,
          `--${boundary}--`,
        ].join('\r\n');

        const url = existing
          ? `${GDRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,modifiedTime,size`
          : `${GDRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,modifiedTime,size`;

        const res = await fetch(url, {
          method: existing ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${bundle.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });

        if (!res.ok) {
          throw new Error(`Google Drive desktop upload failed (HTTP ${res.status}).`);
        }

        const meta = await res.json();
        const lastModified = String(meta?.modifiedTime || new Date().toISOString());
        const fileSizeBytes = Number(meta?.size || sizeBytes);

        updateStoredDriveSyncMeta({
          lastSyncedAt: lastModified,
          lastFileSizeBytes: fileSizeBytes,
          lastError: null,
        });
        await updateTraySyncTooltip(`Synced ${formatRelativeSyncTime(lastModified)}`);
        await sendDesktopSyncNotification(true);
        return { lastModified, fileSizeBytes };
      } catch (err) {
        await sendDesktopSyncNotification(false);
        throw err;
      }
    },

    async restore(providerId: SyncProviderId): Promise<DesktopRawRestoreResult> {
      if (providerId !== 'gdrive' && providerId !== 'dropbox') {
        return { found: false, content: '', lastModified: '', fileSizeBytes: 0 };
      }

      const bundle = await getValidDesktopOAuthToken(providerId);
      if (!bundle?.accessToken) {
        throw new Error(`Reconnect ${providerId} before restoring.`);
      }

      if (providerId === 'dropbox') {
        const res = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bundle.accessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_BACKUP_PATH }),
          },
        });
        if (res.status === 409) {
          return { found: false, content: '', lastModified: '', fileSizeBytes: 0 };
        }
        if (!res.ok) {
          throw new Error(`Dropbox desktop download failed (HTTP ${res.status}).`);
        }
        const content = await res.text();
        let lastModified = new Date().toISOString();
        let fileSizeBytes = new TextEncoder().encode(content).byteLength;
        try {
          const headerMeta = JSON.parse(res.headers.get('dropbox-api-result') || '{}');
          if (headerMeta.server_modified) lastModified = String(headerMeta.server_modified);
          if (headerMeta.size) fileSizeBytes = Number(headerMeta.size);
        } catch {}
        return { found: true, content, lastModified, fileSizeBytes };
      }

      const existing = await findGDriveBackupFile(bundle.accessToken);
      if (!existing) {
        return { found: false, content: '', lastModified: '', fileSizeBytes: 0 };
      }
      const res = await fetch(
        `${GDRIVE_FILES_ENDPOINT}/${encodeURIComponent(existing.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${bundle.accessToken}` } }
      );
      if (!res.ok) {
        throw new Error(`Google Drive desktop download failed (HTTP ${res.status}).`);
      }
      const content = await res.text();
      return {
        found: true,
        content,
        lastModified: existing.modifiedTime,
        fileSizeBytes: existing.size || new TextEncoder().encode(content).byteLength,
      };
    },

    async getLastSyncInfo(providerId: SyncProviderId): Promise<SyncInfo | null> {
      if (providerId !== 'gdrive' && providerId !== 'dropbox') return null;
      const bundle = await getValidDesktopOAuthToken(providerId);
      if (!bundle?.accessToken) return null;

      if (providerId === 'dropbox') {
        const res = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bundle.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: DROPBOX_BACKUP_PATH }),
        });
        if (!res.ok) return null;
        const meta = await res.json();
        const info = {
          lastModified: String(meta?.server_modified || new Date().toISOString()),
          fileSizeBytes: Number(meta?.size || 0),
        };
        updateStoredDropboxSyncMeta({
          lastSyncedAt: info.lastModified,
          lastFileSizeBytes: info.fileSizeBytes,
          lastError: null,
        });
        return info;
      }

      const existing = await findGDriveBackupFile(bundle.accessToken);
      if (!existing) return null;
      const info = {
        lastModified: existing.modifiedTime,
        fileSizeBytes: existing.size,
      };
      updateStoredDriveSyncMeta({
        lastSyncedAt: info.lastModified,
        lastFileSizeBytes: info.fileSizeBytes,
        lastError: null,
      });
      return info;
    },
  };
}

let cachedTauriBridge: DesktopSyncBridge | null = null;

/**
 * Returns a native DesktopSyncBridge when hosted inside Tauri v2 or Electron,
 * or null when running in a standard Web browser / Android APK.
 */
export function getDesktopSyncTransport(): DesktopSyncBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, any>;

  // 1. Electron preload bridge (window.jivanDesktop.sync)
  const electronBridge = win.jivanDesktop?.sync as DesktopSyncBridge | undefined;
  if (electronBridge && typeof electronBridge.backup === 'function') {
    return electronBridge;
  }

  // 2. Tauri v2 native desktop shell (KeychainService + OAuthLoopback + TrayService)
  if (isDesktop()) {
    if (!cachedTauriBridge) {
      cachedTauriBridge = createTauriDesktopSyncBridge();
    }
    return cachedTauriBridge;
  }

  return null;
}
