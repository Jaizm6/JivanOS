import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ActiveSyncProviderId,
  BackupDestinationId,
  SYNCTHING_FOLDER_STATE_EVENT,
  UNIFIED_BACKUP_STATE_EVENT,
  UNIFIED_SYNC_STATE_EVENT,
  activateSyncProviderIfNone,
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
  DRIVE_SYNC_STATE_EVENT,
  DriveBackupEnvelope,
  getStoredDriveSyncMeta,
  mergeDriveData,
  updateStoredDriveSyncMeta,
} from '../utils/googleDriveSync';
import {
  DROPBOX_SYNC_STATE_EVENT,
  getStoredDropboxSyncMeta,
  updateStoredDropboxSyncMeta,
} from '../utils/dropboxSync';
import {
  TELEGRAM_SYNC_STATE_EVENT,
  getStoredTelegramAuth,
  telegramSyncProvider,
} from './providers/TelegramSyncProvider';
import { MEGA_SYNC_STATE_EVENT, megaSyncProvider } from './providers/MEGASyncProvider';
import { JIVANOS_CLOUD_STATE_EVENT, firestoreSyncProvider } from './providers/FirestoreSyncProvider';
import { googleDriveSyncProvider } from './providers/GoogleDriveProvider';
import { dropboxSyncProvider } from './providers/DropboxProvider';
import { getRealSyncOverview } from './syncConnectionState';
import { showAndroidToast } from '../components/common/AndroidToast';

export const TRIGGER_UNIFIED_SYNC_NOW_EVENT = 'jivanos:trigger-unified-sync-now';
export const TRIGGER_UNIFIED_BACKUP_NOW_EVENT = 'jivanos:trigger-unified-backup-now';

export function triggerUnifiedSyncNow(
  manual = true,
  providerId?: ActiveSyncProviderId
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_UNIFIED_SYNC_NOW_EVENT, { detail: { manual, providerId } })
    );
  }
}

export function triggerUnifiedBackupNow(
  password?: string,
  targetDestination?: BackupDestinationId
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TRIGGER_UNIFIED_BACKUP_NOW_EVENT, {
        detail: { manual: true, password, targetDestination },
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
  telegram: 'Telegram',
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
    trashBin,
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
  const hasUnsyncedChangesRef = useRef(
    (() => {
      try {
        const s = getUnifiedSyncSettings();
        return Boolean(
          s.lastLocalEditAt &&
            (!s.lastSyncedAt || Date.parse(s.lastLocalEditAt) > Date.parse(s.lastSyncedAt))
        );
      } catch {
        return false;
      }
    })()
  );
  const hashCheckTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const telegramCooldownTimerRef = useRef<number | null>(null);
  const remoteApplyTimerRef = useRef<number | null>(null);
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
   * Automatically promote the first connected provider to activeProvider whenever activeProvider === 'none'.
   * Ensures Joplin-style automatic sync works immediately once a user connects any cloud service.
   */
  const ensureActiveProviderIfConnected = useCallback((): ActiveSyncProviderId => {
    const current = getUnifiedSyncSettings();
    if (current.activeProvider && current.activeProvider !== 'none') {
      return current.activeProvider;
    }
    const overview = getRealSyncOverview(
      appApiRef.current.firebaseUser,
      appApiRef.current.joplinSyncSettings
    );
    const firstConnected = overview.connectedProviders[0]?.id as ActiveSyncProviderId | undefined;
    if (firstConnected) {
      activateSyncProviderIfNone(firstConnected);
      return firstConnected;
    }
    if (getSyncthingFolderState().connected) {
      activateSyncProviderIfNone('local_folder');
      return 'local_folder';
    }
    return 'none';
  }, []);

  useEffect(() => {
    ensureActiveProviderIfConnected();
    const events = [
      DRIVE_SYNC_STATE_EVENT,
      DROPBOX_SYNC_STATE_EVENT,
      TELEGRAM_SYNC_STATE_EVENT,
      MEGA_SYNC_STATE_EVENT,
      JIVANOS_CLOUD_STATE_EVENT,
      SYNCTHING_FOLDER_STATE_EVENT,
    ];
    const onProviderEvent = () => {
      ensureActiveProviderIfConnected();
    };
    events.forEach((ev) => window.addEventListener(ev, onProviderEvent));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onProviderEvent));
    };
  }, [ensureActiveProviderIfConnected, firebaseUser, joplinSyncSettings]);

  /**
   * SEND (Push) to the active (or specified) sync provider.
   * Silently merges if needed and pushes without asking any questions.
   */
  const runSyncPush = useCallback(
    async (options?: {
      manual?: boolean;
      fromBackground?: boolean;
      providerIdOverride?: ActiveSyncProviderId;
      payloadOverride?: Record<string, unknown>;
    }) => {
      const settings = getUnifiedSyncSettings();
      const providerId =
        options?.providerIdOverride ||
        (settings.activeProvider !== 'none'
          ? settings.activeProvider
          : ensureActiveProviderIfConnected());

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
              void runSyncPush({ manual: false, providerIdOverride: providerId });
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
          showAndroidToast(`Synced with ${PROVIDER_LABELS[providerId]}`, 2200, 'success');
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
    [ensureActiveProviderIfConnected, getLocalDataObject]
  );

  /**
   * RECEIVE (Pull) & Silent Joplin-Style Bidirectional Sync:
   * Pulls remote state, merges per item by `id`, `updatedAt`, and `deletedIds` tombstones
   * silently without ever asking "Merge / Restore / Keep", then pushes merged state if needed.
   */
  const runSyncPull = useCallback(
    async (options?: {
      manual?: boolean;
      pushAfterMerge?: boolean;
      providerIdOverride?: ActiveSyncProviderId;
    }) => {
      const settings = getUnifiedSyncSettings();
      const providerId =
        options?.providerIdOverride ||
        (settings.activeProvider !== 'none'
          ? settings.activeProvider
          : ensureActiveProviderIfConnected());

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
            if (remoteApplyTimerRef.current !== null) {
              window.clearTimeout(remoteApplyTimerRef.current);
            }
            appApiRef.current.replaceAllAppDataFromBackup(JSON.stringify(pulled.mergedData));
            lastObservedHashRef.current = computeBackupContentHash(pulled.mergedData);
            remoteApplyTimerRef.current = window.setTimeout(() => {
              lastObservedHashRef.current = computeBackupContentHash(getLocalDataObject());
              applyingRemoteDataRef.current = false;
              remoteApplyTimerRef.current = null;
            }, 900);
          }
          await pushToSyncthingFolder(pulled.mergedData);
          hasUnsyncedChangesRef.current = false;
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
              2200,
              'success'
            );
          }
          return;
        }

        let remoteEnvelope: DriveBackupEnvelope | null = null;
        let remoteModifiedIso: string | null = null;

        if (providerId === 'telegram') {
          const tgLastSynced = getStoredTelegramAuth()?.lastSyncedAt || null;
          const pulled = await telegramSyncProvider.syncPull(
            options?.manual || options?.pushAfterMerge ? null : tgLastSynced
          );
          if (pulled.skippedNotNewer) {
            if (options?.manual || options?.pushAfterMerge || hasUnsyncedChangesRef.current) {
              await runSyncPush({
                manual: options?.manual,
                providerIdOverride: providerId,
                payloadOverride: localData,
              });
            }
            return;
          }
          remoteEnvelope = pulled.envelope;
          remoteModifiedIso = pulled.lastModified;
        } else if (providerId === 'gdrive') {
          const info = await googleDriveSyncProvider.getLastSyncInfo();
          const driveLastSynced = getStoredDriveSyncMeta().lastSyncedAt;
          const remoteChanged = Boolean(
            info?.lastModified &&
              (!driveLastSynced ||
                Date.parse(info.lastModified) !== Date.parse(driveLastSynced))
          );
          if (remoteChanged || options?.manual || options?.pushAfterMerge) {
            const res = await googleDriveSyncProvider.restore();
            remoteEnvelope = res.envelope;
            remoteModifiedIso = res.lastModified;
          }
        } else if (providerId === 'dropbox') {
          const info = await dropboxSyncProvider.getLastSyncInfo();
          const dbxLastSynced = getStoredDropboxSyncMeta().lastSyncedAt;
          const remoteChanged = Boolean(
            info?.lastModified &&
              (!dbxLastSynced ||
                Date.parse(info.lastModified) !== Date.parse(dbxLastSynced))
          );
          if (remoteChanged || options?.manual || options?.pushAfterMerge) {
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
          hasUnsyncedChangesRef.current = false;
          saveUnifiedSyncSettings({
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            lastError: null,
          });
          if (options?.manual) {
            showAndroidToast(`Synced with ${PROVIDER_LABELS[providerId]}`, 2200, 'success');
          }
          return;
        }

        let mergedPayload = localData;
        let didChangeLocal = false;
        let localContributedToRemote = false;

        if (remoteEnvelope && remoteEnvelope.data) {
          const beforeHash = computeBackupContentHash(localData);
          const remoteHash = computeBackupContentHash(remoteEnvelope.data);
          mergedPayload = mergeDriveData(localData, remoteEnvelope.data);
          const afterHash = computeBackupContentHash(mergedPayload);
          didChangeLocal = beforeHash !== afterHash;
          localContributedToRemote = afterHash !== remoteHash;

          if (didChangeLocal) {
            applyingRemoteDataRef.current = true;
            if (remoteApplyTimerRef.current !== null) {
              window.clearTimeout(remoteApplyTimerRef.current);
            }
            appApiRef.current.replaceAllAppDataFromBackup(JSON.stringify(mergedPayload));
            lastObservedHashRef.current = afterHash;
            remoteApplyTimerRef.current = window.setTimeout(() => {
              lastObservedHashRef.current = computeBackupContentHash(getLocalDataObject());
              applyingRemoteDataRef.current = false;
              remoteApplyTimerRef.current = null;
            }, 900);
          }

          const resolvedSyncIso =
            remoteModifiedIso || remoteEnvelope.updatedAt || new Date().toISOString();
          if (providerId === 'gdrive') {
            updateStoredDriveSyncMeta({ lastSyncedAt: resolvedSyncIso, lastError: null });
          } else if (providerId === 'dropbox') {
            updateStoredDropboxSyncMeta({ lastSyncedAt: resolvedSyncIso, lastError: null });
          }

          saveUnifiedSyncSettings({
            status: hasUnsyncedChangesRef.current ? 'waiting' : 'synced',
            lastSyncedAt: resolvedSyncIso,
            lastError: null,
          });
        }

        const shouldPush =
          Boolean(options?.manual) ||
          Boolean(options?.pushAfterMerge) ||
          hasUnsyncedChangesRef.current ||
          localContributedToRemote;

        if (shouldPush) {
          await runSyncPush({
            manual: options?.manual,
            providerIdOverride: providerId,
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
    [ensureActiveProviderIfConnected, getLocalDataObject, runSyncPush]
  );

  // 1. Joplin-Style Instant Debounced Sync on Every Change (~3s after edit)
  useEffect(() => {
    if (applyingRemoteDataRef.current) return;

    if (hashCheckTimerRef.current !== null) {
      window.clearTimeout(hashCheckTimerRef.current);
    }

    // Short 600ms quiet check so rapid keystrokes stay 60fps
    hashCheckTimerRef.current = window.setTimeout(() => {
      hashCheckTimerRef.current = null;
      if (applyingRemoteDataRef.current) return;

      const currentData = getLocalDataObject();
      const hash = computeBackupContentHash(currentData);

      // Baseline hash on first mount without triggering an edit push
      if (lastObservedHashRef.current === null) {
        lastObservedHashRef.current = hash;
        return;
      }

      if (hash === lastObservedHashRef.current) return;
      lastObservedHashRef.current = hash;

      const nowIso = new Date().toISOString();
      hasUnsyncedChangesRef.current = true;

      const activeProvider = ensureActiveProviderIfConnected();
      if (activeProvider === 'none') {
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
      // Automatically pull-merge & push 2.5 seconds after user finishes editing (Joplin-style)
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runSyncPull({ manual: false, pushAfterMerge: true });
      }, 2500);
    }, 600);

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
    trashBin,
    profile.updatedAt,
    ensureActiveProviderIfConnected,
    getLocalDataObject,
    runSyncPull,
  ]);

  // 2. Receive on app open, window focus, network reconnect, foreground resume, and flush on hide
  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void runSyncPull({ manual: false });
    }, 1500);

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

    const handleWindowFocus = () => {
      void runSyncPull({ manual: false });
    };

    const handleOnline = () => {
      void runSyncPull({ manual: false, pushAfterMerge: hasUnsyncedChangesRef.current });
    };

    const handlePageHide = () => {
      if (hasUnsyncedChangesRef.current) {
        void runSyncPush({ manual: false, fromBackground: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearTimeout(initTimer);
      if (remoteApplyTimerRef.current !== null) {
        window.clearTimeout(remoteApplyTimerRef.current);
        remoteApplyTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [runSyncPull, runSyncPush]);

  // 3. Automatic periodic receive polling while app is open (defaults to every 2 minutes)
  const [syncConfigTick, setSyncConfigTick] = useState(0);
  useEffect(() => {
    const bump = () => setSyncConfigTick((t) => t + 1);
    window.addEventListener(UNIFIED_SYNC_STATE_EVENT, bump);
    return () => window.removeEventListener(UNIFIED_SYNC_STATE_EVENT, bump);
  }, []);

  useEffect(() => {
    const settings = getUnifiedSyncSettings();
    const activeProvider =
      settings.activeProvider !== 'none'
        ? settings.activeProvider
        : ensureActiveProviderIfConnected();

    if (activeProvider === 'none' || settings.receiveIntervalMinutes <= 0) {
      return;
    }

    const effectiveMinutes =
      activeProvider === 'telegram'
        ? Math.max(2, settings.receiveIntervalMinutes)
        : Math.max(1, settings.receiveIntervalMinutes);

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void runSyncPull({ manual: false });
    }, effectiveMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [syncConfigTick, ensureActiveProviderIfConnected, runSyncPull]);

  // 4. Listen for explicit "Sync now" and "Back up now" triggers (including per-provider popups)
  useEffect(() => {
    const onTriggerSyncNow = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const manual = Boolean(detail.manual ?? true);
      const providerIdOverride = detail.providerId as ActiveSyncProviderId | undefined;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void runSyncPull({ manual, pushAfterMerge: true, providerIdOverride });
    };

    const onTriggerBackupNow = async (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const targetDestination = detail.targetDestination as BackupDestinationId | undefined;
      const res = await executeMultiDestinationBackup({
        rawData: getLocalDataObject(),
        password: detail.password,
        isManual: true,
        targetDestinations: targetDestination ? [targetDestination] : undefined,
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
          const firstError = Object.values(res.results).find((r) => r && !r.ok)?.error;
          showAndroidToast(
            firstError || `Backed up to ${okCount} destination(s); ${failedCount} had an error`,
            3200,
            'error'
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
