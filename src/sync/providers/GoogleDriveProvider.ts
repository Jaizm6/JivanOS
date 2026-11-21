/**
 * Google Drive SyncProvider Implementation
 *
 * Implements the shared SyncProvider contract across:
 * - Android: Capacitor JivanGoogleDrivePlugin (Google Sign-In SDK + Drive appDataFolder + WorkManager)
 * - Desktop (Electron/Tauri): Native DesktopSyncBridge (loopback OAuth PKCE + OS keychain + Node/Rust HTTP)
 * - Web / Desktop PWA: Firebase Auth GoogleAuthProvider (in-memory token) + fetch Drive REST API v3
 */

import {
  AutoSyncIntervalMinutes,
  autoSync as scheduleDriveAutoSync,
  backupToDrive,
  buildDriveBackupEnvelope,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getConnectedDriveAccount,
  getLastSyncInfo as getDriveLastSyncInfo,
  parseDriveBackupEnvelope,
  restoreFromDrive,
  silentReAuthGoogleDrive,
} from '../../utils/googleDriveSync';
import {
  SyncAccount,
  SyncInfo,
  SyncPlatform,
  SyncProvider,
  SyncRestoreResult,
  detectSyncPlatform,
} from '../SyncProvider';
import { getDesktopSyncTransport } from '../desktop/DesktopSyncTransport';

export class GoogleDriveSyncProvider implements SyncProvider {
  readonly id = 'gdrive' as const;
  readonly displayName = 'Google Drive';
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
    return connectGoogleDrive();
  }

  async silentReAuth(): Promise<SyncAccount | null> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const account = await desktop.silentReAuth(this.id);
      this.desktopConnected = Boolean(account?.connected);
      return account;
    }
    return silentReAuthGoogleDrive();
  }

  isConnected(): boolean {
    if (getDesktopSyncTransport()) {
      return this.desktopConnected;
    }
    return Boolean(getConnectedDriveAccount()?.connected);
  }

  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      const envelope = buildDriveBackupEnvelope(data);
      return desktop.backup(this.id, JSON.stringify(envelope));
    }
    return backupToDrive(data);
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
    return restoreFromDrive();
  }

  async disconnect(): Promise<void> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      await desktop.disconnect(this.id);
      this.desktopConnected = false;
      return;
    }
    await disconnectGoogleDrive();
  }

  async getLastSyncInfo(): Promise<SyncInfo | null> {
    const desktop = getDesktopSyncTransport();
    if (desktop) {
      return desktop.getLastSyncInfo(this.id);
    }
    return getDriveLastSyncInfo();
  }

  async setAutoSync(
    enabled: boolean,
    intervalMinutes: AutoSyncIntervalMinutes,
    getCurrentData?: () => Record<string, unknown>
  ): Promise<void> {
    const effectiveInterval: AutoSyncIntervalMinutes = enabled ? intervalMinutes : 0;
    await scheduleDriveAutoSync(
      effectiveInterval,
      getCurrentData
        ? async () => {
            await this.backup(getCurrentData());
          }
        : undefined
    );
  }
}

export const googleDriveSyncProvider = new GoogleDriveSyncProvider();
