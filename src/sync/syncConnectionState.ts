import type { User as FirebaseUser } from 'firebase/auth';
import type { JoplinSyncSettings } from '../types';
import { getConnectedDriveAccount, getStoredDriveSyncMeta } from '../utils/googleDriveSync';
import { getConnectedDropboxAccount, getStoredDropboxSyncMeta } from '../utils/dropboxSync';
import { getStoredTelegramAuth } from './providers/TelegramSyncProvider';
import { getStoredMegaAuth, hasActiveMegaSession } from './providers/MEGASyncProvider';
import { getStoredCloudMeta } from './providers/FirestoreSyncProvider';
import { getCachedDesktopOAuthAccount } from './desktop/DesktopSyncTransport';
import { KeychainService, isDesktop } from '../desktop/KeychainService';
import { getSyncthingFolderState } from './unifiedSyncBackupEngine';

export type UnifiedProviderId =
  | 'firebase'
  | 'gdrive'
  | 'dropbox'
  | 'telegram'
  | 'mega'
  | 'webdav'
  | 'local_folder'
  | 's3';

export interface ConnectedProviderSummary {
  id: UnifiedProviderId;
  label: string;
  accountLabel: string;
  lastSyncedAt: string | null;
  brandColor: string;
}

export interface RealSyncOverview {
  connectedProviders: ConnectedProviderSummary[];
  connectedCount: number;
  hasAnyConnected: boolean;
  latestSyncedAt: string | null;
}

export const NAVIGATE_SETTINGS_SECTION_EVENT = 'jivanos_navigate_settings_section';

export function requestOpenBackupSyncScreen(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('jivanos_pending_settings_section', 'backup_sync');
  } catch {}
  window.dispatchEvent(
    new CustomEvent(NAVIGATE_SETTINGS_SECTION_EVENT, {
      detail: { section: 'backup_sync' },
    })
  );
}

/**
 * Computes real connection state strictly from authenticated tokens / verified credentials.
 * Never fabricates timestamps or returns disconnected providers as connected.
 */
export function getRealSyncOverview(
  firebaseUser: FirebaseUser | null,
  joplinSyncSettings: JoplinSyncSettings
): RealSyncOverview {
  const connected: ConnectedProviderSummary[] = [];

  // 1. JivanOS Cloud (Firebase) — only when explicitly connected via JivanOS Cloud (never auto-connected by Google Drive)
  const cloudMeta = getStoredCloudMeta();
  if (firebaseUser && firebaseUser.emailVerified && cloudMeta.cloudOptInConnected) {
    connected.push({
      id: 'firebase',
      label: 'JivanOS Cloud',
      accountLabel: firebaseUser.email || firebaseUser.displayName || 'Signed in',
      lastSyncedAt: cloudMeta.lastSyncedAt || null,
      brandColor: '#4F46E5',
    });
  }

  // 2. Google Drive
  const gdriveAcc = isDesktop()
    ? getCachedDesktopOAuthAccount('gdrive')
    : getConnectedDriveAccount();
  if (gdriveAcc?.connected) {
    const meta = getStoredDriveSyncMeta();
    connected.push({
      id: 'gdrive',
      label: 'Google Drive',
      accountLabel: gdriveAcc.email || gdriveAcc.name || 'Google Drive',
      lastSyncedAt: meta.lastSyncedAt || null,
      brandColor: '#4285F4',
    });
  }

  // 3. Dropbox
  const dropboxAcc = isDesktop()
    ? getCachedDesktopOAuthAccount('dropbox')
    : getConnectedDropboxAccount();
  if (dropboxAcc?.connected) {
    const meta = getStoredDropboxSyncMeta();
    connected.push({
      id: 'dropbox',
      label: 'Dropbox',
      accountLabel: dropboxAcc.email || dropboxAcc.name || 'Dropbox',
      lastSyncedAt: meta.lastSyncedAt || null,
      brandColor: '#0061FF',
    });
  }

  // 4. Telegram (Basic)
  const tgAuth = getStoredTelegramAuth();
  const hasTelegramToken = Boolean(
    tgAuth?.botToken || (isDesktop() && KeychainService.getCachedTokenSync('telegram'))
  );
  if (hasTelegramToken && tgAuth?.chatId) {
    connected.push({
      id: 'telegram',
      label: 'Telegram (Basic)',
      accountLabel: tgAuth.botUsername ? `@${tgAuth.botUsername}` : 'Telegram Bot',
      lastSyncedAt: tgAuth.lastSyncedAt || null,
      brandColor: '#229ED9',
    });
  }

  // 5. MEGA (only when active session exists in sessionStorage)
  const megaAuth = getStoredMegaAuth();
  if (megaAuth?.email && hasActiveMegaSession()) {
    connected.push({
      id: 'mega',
      label: 'MEGA',
      accountLabel: megaAuth.email,
      lastSyncedAt: megaAuth.lastSyncedAt || null,
      brandColor: '#D9272E',
    });
  }

  // 6. WebDAV / Nextcloud (merged single provider)
  const webdavCfg = joplinSyncSettings.drives.webdav;
  const nextcloudCfg = joplinSyncSettings.drives.nextcloud;
  const activeDavCfg =
    webdavCfg?.serverUrl?.trim() && webdavCfg?.username?.trim() && webdavCfg?.password?.trim()
      ? webdavCfg
      : nextcloudCfg?.serverUrl?.trim() && nextcloudCfg?.username?.trim() && nextcloudCfg?.password?.trim()
      ? nextcloudCfg
      : null;

  if (activeDavCfg) {
    let hostLabel = activeDavCfg.serverUrl || 'WebDAV';
    try {
      hostLabel = new URL(activeDavCfg.serverUrl || '').hostname || hostLabel;
    } catch {}
    connected.push({
      id: 'webdav',
      label: 'WebDAV / Nextcloud',
      accountLabel: `${activeDavCfg.username}@${hostLabel}`,
      lastSyncedAt: activeDavCfg.lastSyncedAt || null,
      brandColor: '#0082C9',
    });
  }

  // 7. Local / Syncthing folder
  const syncthingState = getSyncthingFolderState();
  if (syncthingState.connected) {
    connected.push({
      id: 'local_folder',
      label: 'Local / Syncthing folder',
      accountLabel: syncthingState.folderName || syncthingState.deviceFileName,
      lastSyncedAt: syncthingState.lastSyncedAt || null,
      brandColor: '#0891B2',
    });
  }

  // 8. S3 / MinIO (Advanced)
  const s3Cfg = joplinSyncSettings.drives.s3;
  if (
    s3Cfg?.s3Endpoint?.trim() &&
    s3Cfg?.s3Bucket?.trim() &&
    s3Cfg?.s3AccessKey?.trim() &&
    s3Cfg?.s3SecretKey?.trim()
  ) {
    connected.push({
      id: 's3',
      label: 'S3 / MinIO',
      accountLabel: s3Cfg.s3Bucket.trim(),
      lastSyncedAt: s3Cfg.lastSyncedAt || null,
      brandColor: '#D97706',
    });
  }

  // Compute the single most recent real lastSyncedAt across connected providers
  let latestSyncedAt: string | null = null;
  let latestMs = 0;
  for (const item of connected) {
    if (!item.lastSyncedAt) continue;
    const ms = Date.parse(item.lastSyncedAt);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestSyncedAt = item.lastSyncedAt;
    }
  }

  return {
    connectedProviders: connected,
    connectedCount: connected.length,
    hasAnyConnected: connected.length > 0,
    latestSyncedAt,
  };
}
