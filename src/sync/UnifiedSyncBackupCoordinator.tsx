import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CloudDownload, GitMerge, Upload } from 'lucide-react';
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
  formatRelativeSyncTime,
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

interface OlderCloudPromptState {
  providerLabel: string;
  remoteEnvelope: DriveBackupEnvelope;
  remoteUpdatedAt: string;
  localUpdatedAt: string;
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
    medications,
    doseLogs,
    bills,
    goals,
    quotes,
    tags,
    todoLists,
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  } = useApp();

  const [olderCloudPrompt, setOlderCloudPrompt] = useState<OlderCloudPromptState | null>(null);

  const isUploadingRef = useRef(false);
  const isPullingRef = useRef(false);
  const pendingReuploadRef = useRef(false);
  const hasUnsyncedChangesRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const telegramCooldownTimerRef = useRef<number | null>(null);
  const lastObservedHashRef = useRef<string | null>(null);
  const applyingRemoteDataRef = useRef(false);

  const getLocalDataObject = useCallback((): Record<string, unknown> => {
    try {
      return JSON.parse(exportEncryptedJSON()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [exportEncryptedJSON]);

  /**
   * SEND (Push) to the ONE active sync provider.
   * If more edits arrive during an upload, uploads again immediately when it finishes.
   */
  const runSyncPush = useCallback(
    async (options?: { manual?: boolean; fromBackground?: boolean }) => {
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
        const payload = getLocalDataObject();
        let syncedIso = new Date().toISOString();

        if (providerId === 'telegram') {
          const res = await telegramSyncProvider.syncPush(payload, {
            force: Boolean(options?.manual),
          });
          if (res.rateLimited && res.nextAllowedInMs) {
            // Queue push for when the 5-minute Telegram cooldown expires
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
          await syncDriveNow(providerId);
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
        // If more edits arrived during the upload, upload again immediately!
        if (pendingReuploadRef.current) {
          pendingReuploadRef.current = false;
          void runSyncPush({ manual: false });
        }
      }
    },
    [getLocalDataObject, syncDriveNow]
  );

  /**
   * RECEIVE (Pull) from the ONE active sync provider:
   * - On app open, on return to foreground, and every N minutes while app is open.
   * - Merges per item by updatedAt.
   * - Asks before replacing local data with an older cloud copy.
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
            replaceAllAppDataFromBackup(JSON.stringify(pulled.mergedData));
            lastObservedHashRef.current = computeBackupContentHash(pulled.mergedData);
            window.setTimeout(() => {
              applyingRemoteDataRef.current = false;
            }, 300);
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
          // Telegram as SYNC: NEVER uses getUpdates. Uses getChat -> pinned_message -> getFile if newer.
          const pulled = await telegramSyncProvider.syncPull(
            options?.manual ? null : settings.lastSyncedAt
          );
          if (pulled.skippedNotNewer) {
            if (options?.manual) {
              await runSyncPush({ manual: true });
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
          if (options?.manual) {
            await runSyncPush({ manual: true });
          }
          return;
        }

        if (remoteEnvelope && remoteEnvelope.data) {
          const remoteTs = Date.parse(remoteModifiedIso || remoteEnvelope.updatedAt || '');
          const localEditTs = Date.parse(settings.lastLocalEditAt || '');

          // If cloud copy is older than local unsynced edits during a manual or initial pull, ask before replacing
          if (
            Number.isFinite(remoteTs) &&
            Number.isFinite(localEditTs) &&
            remoteTs + 5000 < localEditTs &&
            hasUnsyncedChangesRef.current
          ) {
            setOlderCloudPrompt({
              providerLabel: PROVIDER_LABELS[providerId],
              remoteEnvelope,
              remoteUpdatedAt: remoteModifiedIso || remoteEnvelope.updatedAt,
              localUpdatedAt: settings.lastLocalEditAt || new Date().toISOString(),
            });
            saveUnifiedSyncSettings({ status: 'waiting' });
            return;
          }

          // Merge per item by updatedAt
          const merged = mergeDriveData(localData, remoteEnvelope.data);
          applyingRemoteDataRef.current = true;
          replaceAllAppDataFromBackup(JSON.stringify(merged));
          lastObservedHashRef.current = computeBackupContentHash(merged);
          window.setTimeout(() => {
            applyingRemoteDataRef.current = false;
          }, 300);

          saveUnifiedSyncSettings({
            status: hasUnsyncedChangesRef.current ? 'waiting' : 'synced',
            lastSyncedAt: remoteModifiedIso || remoteEnvelope.updatedAt || new Date().toISOString(),
            lastError: null,
          });
        }

        if (options?.manual || hasUnsyncedChangesRef.current) {
          await runSyncPush({ manual: options?.manual });
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
    [getLocalDataObject, replaceAllAppDataFromBackup, runSyncPush]
  );

  // 1. Debounced Send (~30 seconds after last edit)
  useEffect(() => {
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
  }, [
    tasks,
    habits,
    medications,
    doseLogs,
    bills,
    goals,
    quotes,
    tags,
    todoLists,
    getLocalDataObject,
    runSyncPush,
  ]);

  // 2. Receive on app open, on return to foreground, and Send when going to background
  useEffect(() => {
    // Initial pull on app open
    const initTimer = window.setTimeout(() => {
      void runSyncPull({ manual: false });
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Send when the app goes to the background
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (hasUnsyncedChangesRef.current) {
          void runSyncPush({ manual: false, fromBackground: true });
        }
      } else if (document.visibilityState === 'visible') {
        // Receive on return to the foreground
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
        firebaseUser,
        joplinSyncSettings,
        syncDriveNow,
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
  }, [firebaseUser, getLocalDataObject, joplinSyncSettings, runSyncPull, syncDriveNow]);

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
          firebaseUser,
          joplinSyncSettings,
          syncDriveNow,
        });
      }
    };

    // Catch-up check shortly after app opens
    const catchUpTimer = window.setTimeout(() => {
      void checkAndRunScheduledBackup();
    }, 3500);

    // Periodic check while app is open
    const intervalTimer = window.setInterval(() => {
      void checkAndRunScheduledBackup();
    }, 60000);

    return () => {
      window.clearTimeout(catchUpTimer);
      window.clearInterval(intervalTimer);
    };
  }, [backupConfigTick, firebaseUser, getLocalDataObject, joplinSyncSettings, syncDriveNow]);

  if (!olderCloudPrompt) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Older Cloud Copy Found on {olderCloudPrompt.providerLabel}
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
              The cloud copy was updated{' '}
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {formatRelativeSyncTime(olderCloudPrompt.remoteUpdatedAt)}
              </span>
              , which is older than your latest edits on this device (
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {formatRelativeSyncTime(olderCloudPrompt.localUpdatedAt)}
              </span>
              ). How would you like to proceed?
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={async () => {
              const promptData = olderCloudPrompt;
              setOlderCloudPrompt(null);
              const merged = mergeDriveData(getLocalDataObject(), promptData.remoteEnvelope.data);
              applyingRemoteDataRef.current = true;
              replaceAllAppDataFromBackup(JSON.stringify(merged));
              window.setTimeout(() => {
                applyingRemoteDataRef.current = false;
              }, 300);
              await runSyncPush({ manual: true });
            }}
            className="w-full h-10 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <GitMerge className="w-4 h-4" />
            <span>Merge Per Item by Updated Time (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setOlderCloudPrompt(null);
              await runSyncPush({ manual: true });
            }}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Keep Local Data &amp; Overwrite Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const promptData = olderCloudPrompt;
              setOlderCloudPrompt(null);
              applyingRemoteDataRef.current = true;
              replaceAllAppDataFromBackup(JSON.stringify(promptData.remoteEnvelope.data));
              window.setTimeout(() => {
                applyingRemoteDataRef.current = false;
              }, 300);
              hasUnsyncedChangesRef.current = false;
              saveUnifiedSyncSettings({
                status: 'synced',
                lastSyncedAt: promptData.remoteUpdatedAt,
                lastError: null,
              });
              showAndroidToast('Replaced local data with cloud copy', 2400, 'default');
            }}
            className="w-full h-10 px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <CloudDownload className="w-4 h-4" />
            <span>Replace Local Data with Older Cloud Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
};
