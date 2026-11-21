/**
 * Shared Cross-Platform SyncProvider Contract for JivanOS
 *
 * Every platform (Android native Kotlin, Web browser JS/TS, Desktop Electron/Tauri TS,
 * and future iOS Swift) implements this exact same contract so all sync orchestration,
 * conflict resolution (last-write-wins merge by updatedAt), and UI state stay identical
 * across platforms — only the OAuth + HTTP transport layer differs per platform.
 */

import type { AutoSyncIntervalMinutes, DriveBackupEnvelope } from '../utils/googleDriveSync';
import { isCapacitorNative } from '../lib/firebase';

export type SyncProviderId = 'jivanos_cloud' | 'gdrive' | 'dropbox' | 'telegram' | 'mega';

export type SyncPlatform = 'android' | 'ios' | 'desktop' | 'web';

export interface SyncInfo {
  lastModified: string;
  fileSizeBytes: number;
  deviceId?: string;
}

export interface SyncAccount {
  connected: boolean;
  name: string;
  email: string;
  initials: string;
}

export type SyncBackupEnvelope = DriveBackupEnvelope;

export interface SyncRestoreResult {
  found: boolean;
  envelope: SyncBackupEnvelope | null;
  lastModified: string | null;
  fileSizeBytes: number;
}

/**
 * Core cross-platform SyncProvider interface.
 * Mirrors /android-native/SyncProvider.kt method-for-method.
 */
export interface SyncProvider {
  readonly id: SyncProviderId;
  readonly displayName: string;
  readonly platform: SyncPlatform;

  /**
   * Upload and overwrite the provider's remote backup.json with the app data snapshot.
   */
  backup(data: Record<string, unknown>): Promise<SyncInfo>;

  /**
   * Download and parse the provider's remote backup.json.
   */
  restore(): Promise<SyncRestoreResult>;

  /**
   * Synchronous check of whether the provider currently has an active authenticated session.
   */
  isConnected(): boolean;

  /**
   * Clear stored credentials / tokens and cancel any scheduled background sync.
   */
  disconnect(): Promise<void>;

  /**
   * Fetch remote backup.json metadata (lastModified + fileSizeBytes), or null if no backup exists.
   */
  getLastSyncInfo(): Promise<SyncInfo | null>;

  /**
   * Interactive authentication flow (native SDK on Android, PKCE popup on Web, loopback PKCE on Desktop).
   */
  connect(): Promise<SyncAccount>;

  /**
   * Non-interactive session restoration on app launch.
   */
  silentReAuth(): Promise<SyncAccount | null>;

  /**
   * Configure periodic background auto-sync (WorkManager on Android, scheduler on Web/Desktop).
   */
  setAutoSync(
    enabled: boolean,
    intervalMinutes: AutoSyncIntervalMinutes,
    getCurrentData?: () => Record<string, unknown>
  ): Promise<void>;
}

/**
 * Detect the active runtime platform for sync transport selection.
 */
export function detectSyncPlatform(): SyncPlatform {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const win = window as unknown as Record<string, any>;

  // 1. Native mobile via Capacitor (Android / iOS)
  if (isCapacitorNative()) {
    const capPlatform = win.Capacitor?.getPlatform?.();
    if (capPlatform === 'ios') return 'ios';
    return 'android';
  }

  // 2. Native Desktop shell (Electron preload bridge or Tauri v1/v2 runtime)
  if (
    win.jivanDesktop?.sync ||
    win.__TAURI_INTERNALS__ ||
    win.__TAURI__ ||
    (typeof navigator !== 'undefined' && /Electron\//i.test(navigator.userAgent))
  ) {
    return 'desktop';
  }

  // 3. Browser / Desktop PWA
  return 'web';
}
