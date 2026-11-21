/**
 * Dropbox SyncProvider Implementation
 *
 * Implements the shared SyncProvider contract across:
 * - Android: Capacitor JivanDropboxPlugin (DropboxAuth.kt + DropboxSyncProvider.kt, EncryptedSharedPreferences + WorkManager)
 * - Desktop (Electron/Tauri): Native DesktopSyncBridge (loopback OAuth2 PKCE + OS keychain + Node/Rust HTTP)
 * - Web / Desktop PWA: Browser OAuth2 PKCE popup + fetch Dropbox API v2 (/Apps/JivanOS/backup.json)
 */

import {
  AutoSyncIntervalMinutes,
  buildDriveBackupEnvelope,
  parseDriveBackupEnvelope,
} from '../../utils/googleDriveSync';
import {
  autoSync as scheduleDropboxAutoSync,
  backupToDropbox,
  connectDropbox,
  disconnectDropbox,
  getConnectedDropboxAccount,
  getLastSyncInfo as getLastDropboxSyncInfo,
  restoreFromDropbox,
  silentReAuthDropbox,
} from '../../utils/dropboxSync';
import {
  SyncAccount,
  SyncInfo,
  SyncPlatform,
  SyncProvider,
  SyncRestoreResult,
  detectSyncPlatform,
} from '../SyncProvider';
import { getDesktopSyncTransport } from '../desktop/DesktopSyncTransport';

export class DropboxSyncProviderAdapter implements SyncProvider {
  readonly id = 'dropbox' as const;
  readonly displayName = 'Dropbox';
  private desktopConnected = false;

  get platform(): SyncPlatform {
    return detectSyncPlatform();
  }

  async connect(): Promise<SyncAccount> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const account = await desktop.connect(this.id);
      this.desktopConnected = account.connected;
      return account;
    }
    return connectDropbox();
  }

  async silentReAuth(): Promise<SyncAccount | null> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const account = await desktop.silentReAuth(this.id);
      this.desktopConnected = Boolean(account?.connected);
      return account;
    }
    return silentReAuthDropbox();
  }

  isConnected(): boolean {
    if (getDesktopSyncTransport()) {
      return this.desktopConnected;
    }
    return Boolean(getConnectedDropboxAccount()?.connected);
  }

  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const envelope = buildDriveBackupEnvelope(data);
      return desktop.backup(this.id, JSON.stringify(envelope));
    }
    return backupToDropbox(data);
  }

  async restore(): Promise<SyncRestoreResult> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const raw = await desktop.restore(this.id);
      if (!raw.found || !raw.content) {
        return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
      }
      const envelope = parseDriveBackupEnvelope(raw.content);
      return {
        found: Boolean(envelope),
        envelope,
        lastModified: raw.lastModified || envelope?.updatedAt || null,
        fileSizeBytes: raw.fileSizeBytes,
      };
    }
    return restoreFromDropbox();
  }

  async disconnect(): Promise<void> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      await desktop.disconnect(this.id);
      this.desktopConnected = false;
      return;
    }
    await disconnectDropbox();
  }

  async getLastSyncInfo(): Promise<SyncInfo | null> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      return desktop.getLastSyncInfo(this.id);
    }
    return getLastDropboxSyncInfo();
  }

  async setAutoSync(
    enabled: boolean,
    intervalMinutes: AutoSyncIntervalMinutes,
    getCurrentData?: () => Record<string, unknown>
  ): Promise<void> {
    const effectiveInterval: AutoSyncIntervalMinutes = enabled ? intervalMinutes : 0;
    await scheduleDropboxAutoSync(
      effectiveInterval,
      getCurrentData
        ? async () => {
            await this.backup(getCurrentData());
          }
        : undefined
    );
  }
}

export const DropboxSyncProvider = DropboxSyncProviderAdapter;
export const dropboxSyncProvider = new DropboxSyncProviderAdapter();
