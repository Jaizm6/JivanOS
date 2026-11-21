/**
 * JivanOS Cross-Platform Sync Registry
 *
 * Single entry point for accessing cloud SyncProvider instances in UI display order:
 * 1. JivanOS Cloud (Firebase Firestore — premium, real-time)
 * 2. Google Drive (AppDataFolder — free)
 * 3. Dropbox (App Folder — free)
 * 4. Telegram (Private Bot Chat — free, power users)
 */

export * from './SyncProvider';
export * from './desktop/DesktopSyncTransport';
export { FirestoreSyncProvider, firestoreSyncProvider } from './providers/FirestoreSyncProvider';
export { GoogleDriveSyncProvider, googleDriveSyncProvider } from './providers/GoogleDriveProvider';
export {
  DropboxSyncProvider,
  DropboxSyncProviderAdapter,
  dropboxSyncProvider,
} from './providers/DropboxProvider';
export { TelegramSyncProvider, telegramSyncProvider } from './providers/TelegramSyncProvider';
export { MEGASyncProvider, megaSyncProvider } from './providers/MEGASyncProvider';

import type { SyncProvider, SyncProviderId } from './SyncProvider';
import { firestoreSyncProvider } from './providers/FirestoreSyncProvider';
import { googleDriveSyncProvider } from './providers/GoogleDriveProvider';
import { dropboxSyncProvider } from './providers/DropboxProvider';
import { telegramSyncProvider } from './providers/TelegramSyncProvider';
import { megaSyncProvider } from './providers/MEGASyncProvider';

export const SyncProviderRegistry: Record<SyncProviderId, SyncProvider> = {
  jivanos_cloud: firestoreSyncProvider,
  gdrive: googleDriveSyncProvider,
  dropbox: dropboxSyncProvider,
  telegram: telegramSyncProvider,
  mega: megaSyncProvider,
};

export const SYNC_PROVIDER_ORDER: SyncProviderId[] = [
  'jivanos_cloud',
  'gdrive',
  'dropbox',
  'telegram',
  'mega',
];

export function getSyncProvider(id: SyncProviderId): SyncProvider {
  return SyncProviderRegistry[id];
}

export function getAllSyncProviders(): SyncProvider[] {
  return SYNC_PROVIDER_ORDER.map((id) => SyncProviderRegistry[id]);
}
