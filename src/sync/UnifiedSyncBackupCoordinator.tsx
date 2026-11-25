import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ActiveSyncProviderId,
  UNIFIED_BACKUP_STATE_EVENT,
  UNIFIED_SYNC_STATE_EVENT,
  computeBackupContentHash,
  computeNextScheduledBackupIso,
  executeMultiDestinationBackup,
  getSyncthingFolderState,
  getUnifiedBackupSettings,
  getUnifiedSyncSettings,
  isNetworkAllowed,
  pullFromSyncthingFolder,
  pushToSyncthingFolder,
  saveUnifiedBackupSettings,
  saveUnifiedSyncSettings,
} from './unifiedSyncBackupEngine';
import {
  DriveBackupEnvelope,
  mergeDriveData,
} from '../utils/googleDriveSync';
import { googleDriveSyncProvider } from './providers/GoogleDriveProvider';
import { dropboxSyncProvider } from './providers/DropboxProvider';
import { telegramSyncProvider } from './providers/TelegramSyncProvider';
import { megaSyncProvider } from './providers/MEGASyncProvider';
import { firestoreSyncProvider } from './providers/FirestoreSyncProvider';
import { showAndroidToast } from '../components/common/AndroidToast';

export const TRIGGER_UNIFIED_SYNC_NOW_EVENT = 'jivanos:trigger-unified-sync-now';
export const TRIGGER_UNIFIED_BACKUP_NOW_EVENT = 'jivanos:trigger-unified-backup-now';

export function triggerUnifiedSyncNow(manual = true): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_UNIFIED_SYNC_NOW_EVENT, { detail: { manual } })
    );
  }
}

export function triggerUnifiedBackupNow(password?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_UNIFIED_BACKUP_NOW_EVENT, {
        detail: { manual: true, password },
      })
    );
  }
}

const PROVIDER_LABELS: Record<ActiveSyncProviderId, string> = {
  none: 'None',
  firebase: 'JivanOS Cloud',
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  webdav: 'WebDAV / Nextcloud',
  telegram: 'Telegram (Basic)',
  local_folder: 'Local / Syncthing folder',
  mega: 'MEGA',
  s3: 'S3 / MinIO',
};

export const UnifiedSyncBackupCoordinator: React.FC = () => {
  const {
    tasks,
    habits,
    routines,
    medications,
    doseLogs,
    bills,
    goals,
    scheduleItems,
    inboxItems,
    quotes,
    tags,
    todoLists,
    listGroups,
    deletedIds,
    profile,
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  } = useApp();

  // Keep latest AppContext methods/objects in a stable ref so callbacks never recreate on every render
  const appApiRef = useRef({
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  });
  appApiRef.current = {
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  };

  const isUploadingRef = useRef(false);
  const isPullingRef = useRef(false);
  const pendingReuploadRef = useRef(false);
  const hasUnsyncedChangesRef = useRef(false);
  const hashCheckTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const telegramCooldownTimerRef = useRef<number | null>(null);
  const lastObservedHashRef = useRef<string | null>(null);
  const applyingRemoteDataRef = useRef(false);

  const getLocalDataObject = useCallback((): Record<string, unknown> => {
    try {
      return JSON.parse(appApiRef.current.exportEncryptedJSON()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, []);

  /**
   * SEND (Push) to the ONE active sync provider.
   * If more edits arrive during an upload, uploads again immediately when it finishes.
   */
  const runSyncPush = useCallback(
    async (options?: { manual?: boolean; fromBackground?: boolean; payloadOverride?: Record<string, unknown> }) => {
      const settings = getUnifiedSyncSettings();
      const providerId = settings.activeProvider;
      if (providerId === 'none') return;

      if (!options?.manual) {
        const net = isNetworkAllowed(settings.wifiOnly);
        if (!net.allowed) {
          saveUnifiedSyncSettings({
            status: hasUnsyncedChangesRef.current ? 'waiting' : settings.status,
          });
          return;
        }
      }

      if (isUploadingRef.current) {
        pendingReuploadRef.current = true;
        saveUnifiedSyncSettings({ status: 'waiting' });
        return;
      }

      isUploadingRef.current = true;
      pendingReuploadRef.current = false;
      saveUnifiedSyncSettings({ status: 'syncing', lastError: null });

      try {
        const payload = options?.payloadOverride || getLocalDataObject();
        let syncedIso = new Date().toISOString();

        if (providerId === 'telegram') {
          const res = await telegramSyncProvider.syncPush(payload, {
            force: Boolean(options?.manual),
          });
          if (res.rateLimited && res.nextAllowedInMs) {
            hasUnsyncedChangesRef.current = true;
            saveUnifiedSyncSettings({
              status: 'waiting',
              lastError: null,
            });
            if (telegramCooldownTimerRef.current !== null) {
              window.clearTimeout(telegramCooldownTimerRef.current);
            }
            telegramCooldownTimerRef.current = window.setTimeout(() => {
              telegramCooldownTimerRef.current = null;
              void runSyncPush({ manual: false });
            }, res.nextAllowedInMs + 250);
            isUploadingRef.current = false;
            return;
          }
          syncedIso = res.lastModified || syncedIso;
        } else if (providerId === 'local_folder') {
          if (!getSyncthingFolderState().connected) {
            throw new Error('Select a Local / Syncthing folder first.');
          }
          const res = await pushToSyncthingFolder(payload);
          syncedIso = res.updatedAt;
        } else if (providerId === 'gdrive') {
          const res = await googleDriveSyncProvider.backup(payload);
          syncedIso = res.lastModified || syncedIso;
        } else if (providerId === 'dropbox') {
          const res = await dropboxSyncProvider.backup(payload);
          syncedIso = res.lastModified || syncedIso;
        } else if (providerId === 'firebase') {
          const res = await firestoreSyncProvider.backup(payload);
          syncedIso = res.lastModified || syncedIso;
        } else if (providerId === 'mega') {
          const res = await megaSyncProvider.backup(payload);
          syncedIso = res.lastModified || syncedIso;
        } else if (providerId === 'webdav' || providerId === 's3') {
          await appApiRef.current.syncDriveNow(providerId);
        }

        hasUnsyncedChangesRef.current = false;
        saveUnifiedSyncSettings({
          status: pendingReuploadRef.current ? 'waiting' : 'synced',
          lastSyncedAt: syncedIso,
          lastError: null,
        });

        if (options?.manual) {
          showAndroidToast(`Synced with ${PROVIDER_LABELS[providerId]}`, 2400, 'success');
        }
      } catch (err: any) {
        const msg = err?.message || 'Sync upload failed.';
        saveUnifiedSyncSettings({
          status: 'error',
          lastError: msg,
        });
        if (options?.manual) {
          showAndroidToast(msg, 3200, 'error');
        }
      } finally {
        isUploadingRef.current = false;
        if (pendingReuploadRef.current) {
          pendingReuploadRef.current = false;
          void runSyncPush({ manual: false });
        }
      }
    },
    [getLocalDataObject]
  );

  /**
   * RECEIVE (Pull) from the ONE active sync provider:
   * - Replicates Joplin Sync: pulls remote state, merges per item by `id`, `updatedAt`, and `deletedIds` tombstones
   *   silently without interrupting the user with a conflict dialog, then pushes the merged state if needed.
   */
  const runSyncPull = useCallback(
    async (options?: { manual?: boolean }) => {
      const settings = getUnifiedSyncSettings();
      const providerId = settings.activeProvider;
      if (providerId === 'none' || isPullingRef.current) return;

      if (!options?.manual) {
        const net = isNetworkAllowed(settings.wifiOnly);
        if (!net.allowed) return;
      }

      isPullingRef.current = true;
      if (options?.manual) {
        saveUnifiedSyncSettings({ status: 'syncing', lastError: null });
      }

      try {
        const localData = getLocalDataObject();

        // Local / Syncthing folder reads all other sync-*.json and *.sync-conflict-* files
        if (providerId === 'local_folder') {
          if (!getSyncthingFolderState().connected) {
            if (options?.manual) {
              throw new Error('Select a Local / Syncthing folder first.');
            }
            return;
          }
          const pulled = await pullFromSyncthingFolder(localData);
          if (pulled.peerFilesMerged > 0) {
            applyingRemoteDataRef.current = true;
            appApiRef.current.replaceAllAppDataFromBackup(JSON.stringify(pulled.mergedData));
            lastObservedHashRef.current = computeBackupContentHash(pulled.mergedData);
            window.setTimeout(() => {
              applyingRemoteDataRef.current = false;
            }, 350);
          }
          await pushToSyncthingFolder(pulled.mergedData);
          saveUnifiedSyncSettings({
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            lastError: null,
          });
          if (options?.manual) {
            showAndroidToast(
              pulled.peerFilesMerged > 0
                ? `Synced & merged ${pulled.peerFilesMerged} device file(s)`
                : 'Syncthing folder is up to date',
              2400,
              'success'
            );
          }
          return;
        }

        let remoteEnvelope: DriveBackupEnvelope | null = null;
        let remoteModifiedIso: string | null = null;

        if (providerId === 'telegram') {
          const pulled = await telegramSyncProvider.syncPull(
            options?.manual ? null : settings.lastSyncedAt
          );
          if (pulled.skippedNotNewer) {
            if (options?.manual || hasUnsyncedChangesRef.current) {
              await runSyncPush({ manual: options?.manual, payloadOverride: localData });
            }
            return;
          }
          remoteEnvelope = pulled.envelope;
          remoteModifiedIso = pulled.lastModified;
        } else if (providerId === 'gdrive') {
          const info = await googleDriveSyncProvider.getLastSyncInfo();
          if (
            info?.lastModified &&
            (!settings.lastSyncedAt ||
              Date.parse(info.lastModified) > Date.parse(settings.lastSyncedAt) ||
              options?.manual)
          ) {
            const res = await googleDriveSyncProvider.restore();
            remoteEnvelope = res.envelope;
            remoteModifiedIso = res.lastModified;
          }
        } else if (providerId === 'dropbox') {
          const info = await dropboxSyncProvider.getLastSyncInfo();
          if (
            info?.lastModified &&
            (!settings.lastSyncedAt ||
              Date.parse(info.lastModified) > Date.parse(settings.lastSyncedAt) ||
              options?.manual)
          ) {
            const res = await dropboxSyncProvider.restore();
            remoteEnvelope = res.envelope;
            remoteModifiedIso = res.lastModified;
          }
        } else if (providerId === 'firebase') {
          const res = await firestoreSyncProvider.restore();
          remoteEnvelope = res.envelope;
          remoteModifiedIso = res.lastModified;
        } else if (providerId === 'mega') {
          const res = await megaSyncProvider.restore();
          remoteEnvelope = res.envelope;
          remoteModifiedIso = res.lastModified;
        } else if (providerId === 'webdav' || providerId === 's3') {
          await appApiRef.current.syncDriveNow(providerId);
          saveUnifiedSyncSettings({
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            lastError: null,
          });
          if (options?.manual) {
            showAndroidToast(`Synced with ${PROVIDER_LABELS[providerId]}`, 2400, 'success');
          }
          return;
        }

        let mergedPayload = localData;
        let didMergeRemote = false;

        if (remoteEnvelope && remoteEnvelope.data) {
          // Joplin-style conflict-free per-item LWW + tombstone merge
          mergedPayload = mergeDriveData(localData, remoteEnvelope.data);
          didMergeRemote = true;
          applyingRemoteDataRef.current = true;
          appApiRef.current.replaceAllAppDataFromBackup(JSON.stringify(mergedPayload));
          lastObservedHashRef.current = computeBackupContentHash(mergedPayload);
          window.setTimeout(() => {
            applyingRemoteDataRef.current = false;
          }, 350);

          saveUnifiedSyncSettings({
            status: hasUnsyncedChangesRef.current ? 'waiting' : 'synced',
            lastSyncedAt:
              remoteModifiedIso || remoteEnvelope.updatedAt || new Date().toISOString(),
            lastError: null,
          });
        }

        if (options?.manual || hasUnsyncedChangesRef.current || didMergeRemote) {
          await runSyncPush({
            manual: options?.manual,
            payloadOverride: mergedPayload,
          });
        }
      } catch (err: any) {
        const msg = err?.message || 'Sync pull failed.';
        saveUnifiedSyncSettings({
          status: 'error',
          lastError: msg,
        });
        if (options?.manual) {
          showAndroidToast(msg, 3200, 'error');
        }
      } finally {
        isPullingRef.current = false;
      }
    },
    [getLocalDataObject, runSyncPush]
  );

  // 1. Non-blocking Debounced Change Detection & Send (~30 seconds after last edit)
  useEffect(() => {
    if (applyingRemoteDataRef.current) return;

    if (hashCheckTimerRef.current !== null) {
      window.clearTimeout(hashCheckTimerRef.current);
    }

    // Offload JSON serialization & hash comparison to a 1.2s quiet timer so UI stays 60fps
    hashCheckTimerRef.current = window.setTimeout(() => {
      hashCheckTimerRef.current = null;
      if (applyingRemoteDataRef.current) return;

      const currentData = getLocalDataObject();
      const hash = computeBackupContentHash(currentData);

      // Initialize baseline hash on first mount without triggering an edit push
      if (lastObservedHashRef.current === null) {
        lastObservedHashRef.current = hash;
        return;
      }

      if (hash === lastObservedHashRef.current) return;
      lastObservedHashRef.current = hash;

      const nowIso = new Date().toISOString();
      hasUnsyncedChangesRef.current = true;
      const settings = getUnifiedSyncSettings();
      if (settings.activeProvider === 'none') {
        saveUnifiedSyncSettings({ lastLocalEditAt: nowIso });
        return;
      }

      if (isUploadingRef.current) {
        pendingReuploadRef.current = true;
        saveUnifiedSyncSettings({
          status: 'waiting',
          lastLocalEditAt: nowIso,
        });
        return;
      }

      saveUnifiedSyncSettings({
        status: 'waiting',
        lastLocalEditAt: nowIso,
      });

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runSyncPush({ manual: false });
      }, 30000); // ~30 seconds after last edit
    }, 1200);

    return () => {
      if (hashCheckTimerRef.current !== null) {
        window.clearTimeout(hashCheckTimerRef.current);
        hashCheckTimerRef.current = null;
      }
    };
  }, [
    tasks,
    habits,
    routines,
    medications,
    doseLogs,
    bills,
    goals,
    scheduleItems,
    inboxItems,
    quotes,
    tags,
    todoLists,
    listGroups,
    deletedIds,
    profile.updatedAt,
    getLocalDataObject,
    runSyncPush,
  ]);

  // 2. Receive on app open, on return to foreground, and Send when going to background
  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void runSyncPull({ manual: false });
    }, 1800);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (hasUnsyncedChangesRef.current) {
          void runSyncPush({ manual: false, fromBackground: true });
        }
      } else if (document.visibilityState === 'visible') {
        void runSyncPull({ manual: false });
      }
    };

    const handlePageHide = () => {
      if (hasUnsyncedChangesRef.current) {
        void runSyncPush({ manual: false, fromBackground: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearTimeout(initTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [runSyncPull, runSyncPush]);

  // 3. Receive every N minutes while the app is open (no background sync while app is closed)
  const [syncConfigTick, setSyncConfigTick] = useState(0);
  useEffect(() => {
    const bump = () => setSyncConfigTick((t) => t + 1);
    window.addEventListener(UNIFIED_SYNC_STATE_EVENT, bump);
    return () => window.removeEventListener(UNIFIED_SYNC_STATE_EVENT, bump);
  }, []);

  useEffect(() => {
    const settings = getUnifiedSyncSettings();
    if (settings.activeProvider === 'none' || settings.receiveIntervalMinutes <= 0) {
      return;
    }
    const effectiveMinutes =
      settings.activeProvider === 'telegram'
        ? Math.max(15, settings.receiveIntervalMinutes)
        : settings.receiveIntervalMinutes;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void runSyncPull({ manual: false });
    }, effectiveMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [syncConfigTick, runSyncPull]);

  // 4. Listen for explicit "Sync now" and "Back up now" button triggers
  useEffect(() => {
    const onTriggerSyncNow = (e: Event) => {
      const manual = Boolean((e as CustomEvent)?.detail?.manual ?? true);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void runSyncPull({ manual });
    };

    const onTriggerBackupNow = async (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const res = await executeMultiDestinationBackup({
        rawData: getLocalDataObject(),
        password: detail.password,
        isManual: true,
        firebaseUser: appApiRef.current.firebaseUser,
        joplinSyncSettings: appApiRef.current.joplinSyncSettings,
        syncDriveNow: appApiRef.current.syncDriveNow,
      });
      if (res.ran) {
        const failedCount = Object.values(res.results).filter((r) => r && !r.ok).length;
        const okCount = Object.values(res.results).filter((r) => r && r.ok).length;
        if (failedCount === 0) {
          showAndroidToast(
            `Backed up (${res.filename}) to ${okCount} destination${okCount === 1 ? '' : 's'}`,
            2600,
            'success'
          );
        } else {
          showAndroidToast(
            `Backed up to ${okCount} destination(s); ${failedCount} had an error`,
            3200,
            'default'
          );
        }
      }
    };

    window.addEventListener(TRIGGER_UNIFIED_SYNC_NOW_EVENT, onTriggerSyncNow);
    window.addEventListener(TRIGGER_UNIFIED_BACKUP_NOW_EVENT, onTriggerBackupNow);
    return () => {
      window.removeEventListener(TRIGGER_UNIFIED_SYNC_NOW_EVENT, onTriggerSyncNow);
      window.removeEventListener(TRIGGER_UNIFIED_BACKUP_NOW_EVENT, onTriggerBackupNow);
    };
  }, [getLocalDataObject, runSyncPull]);

  // 5. BACKUP Schedule & Catch-up on app open (runs missed scheduled backup when app opens)
  const [backupConfigTick, setBackupConfigTick] = useState(0);
  useEffect(() => {
    const bump = () => setBackupConfigTick((t) => t + 1);
    window.addEventListener(UNIFIED_BACKUP_STATE_EVENT, bump);
    return () => window.removeEventListener(UNIFIED_BACKUP_STATE_EVENT, bump);
  }, []);

  useEffect(() => {
    const checkAndRunScheduledBackup = async () => {
      const bSettings = getUnifiedBackupSettings();
      if (bSettings.scheduleMinutes <= 0) return;

      const nowMs = Date.now();
      if (!bSettings.nextScheduledBackupAt) {
        const nextIso = computeNextScheduledBackupIso(
          bSettings.scheduleMinutes,
          bSettings.scheduledTime
        );
        saveUnifiedBackupSettings({ nextScheduledBackupAt: nextIso });
        return;
      }

      const targetMs = Date.parse(bSettings.nextScheduledBackupAt);
      if (Number.isFinite(targetMs) && nowMs >= targetMs) {
        await executeMultiDestinationBackup({
          rawData: getLocalDataObject(),
          isManual: false,
          firebaseUser: appApiRef.current.firebaseUser,
          joplinSyncSettings: appApiRef.current.joplinSyncSettings,
          syncDriveNow: appApiRef.current.syncDriveNow,
        });
      }
    };

    const catchUpTimer = window.setTimeout(() => {
      void checkAndRunScheduledBackup();
    }, 4500);

    const intervalTimer = window.setInterval(() => {
      void checkAndRunScheduledBackup();
    }, 60000);

    return () => {
      window.clearTimeout(catchUpTimer);
      window.clearInterval(intervalTimer);
    };
  }, [backupConfigTick, getLocalDataObject]);

  return null;
};
