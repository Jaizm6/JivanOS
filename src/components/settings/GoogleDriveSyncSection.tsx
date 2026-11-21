import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  CloudDownload,
  GitMerge,
  Smartphone,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../common/AndroidToast';
import {
  AutoSyncIntervalMinutes,
  DRIVE_SYNC_STATE_EVENT,
  DriveAccountInfo,
  DriveBackupEnvelope,
  DriveSyncStatus,
  StoredDriveSyncMeta,
  autoSync,
  formatDriveFileSize,
  formatRelativeSyncTime,
  getConnectedDriveAccount,
  getStoredDriveSyncMeta,
  isNativeAndroidDriveAvailable,
  isRemoteNewerThanLocal,
  mergeDriveData,
  updateStoredDriveSyncMeta,
} from '../../utils/googleDriveSync';
import { googleDriveSyncProvider } from '../../sync/providers/GoogleDriveProvider';
import { getCachedDesktopOAuthAccount } from '../../sync/desktop/DesktopSyncTransport';
import { isDesktop } from '../../desktop/KeychainService';

const INTERVAL_OPTIONS: { label: string; value: AutoSyncIntervalMinutes }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: 'Manual', value: 0 },
];

interface ConflictDialogState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteUpdatedAt: string;
  remoteSizeBytes: number;
  localLastSyncedAt: string | null;
}

const GoogleLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

export const GoogleDriveSyncSection: React.FC = () => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();

  const [account, setAccount] = useState<DriveAccountInfo | null>(() =>
    isDesktop() ? getCachedDesktopOAuthAccount('gdrive') : getConnectedDriveAccount()
  );
  const [meta, setMeta] = useState<StoredDriveSyncMeta>(() => getStoredDriveSyncMeta());
  const [syncStatus, setSyncStatus] = useState<DriveSyncStatus>(() => {
    const initialMeta = getStoredDriveSyncMeta();
    if (initialMeta.lastError) return 'error';
    if (initialMeta.lastSyncedAt) return 'synced';
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(() => getStoredDriveSyncMeta().lastError);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [, setRelativeTick] = useState(0);

  const isNativeAndroid = isNativeAndroidDriveAvailable();

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  // Keep relative "Last synced X min ago" text fresh every 30 seconds
  useEffect(() => {
    const interval = window.setInterval(() => setRelativeTick(t => t + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Listen to metadata updates from background sync or AppContext
  useEffect(() => {
    const handleMetaEvent = () => {
      const next = getStoredDriveSyncMeta();
      setMeta(next);
      if (next.lastError) {
        setSyncStatus('error');
        setErrorMessage(next.lastError);
      } else if (next.lastSyncedAt) {
        setSyncStatus(prev => (prev === 'syncing' ? prev : 'synced'));
        setErrorMessage(null);
      }
    };
    window.addEventListener(DRIVE_SYNC_STATE_EVENT, handleMetaEvent);
    return () => window.removeEventListener(DRIVE_SYNC_STATE_EVENT, handleMetaEvent);
  }, []);

  // Silent re-auth when opening Backup & Restore screen
  useEffect(() => {
    let active = true;
    googleDriveSyncProvider
      .silentReAuth()
      .then(async acc => {
        if (!active) return;
        setAccount(acc);
        if (acc?.connected) {
          try {
            const info = await googleDriveSyncProvider.getLastSyncInfo();
            if (active && info) {
              setMeta(getStoredDriveSyncMeta());
              setSyncStatus('synced');
              setErrorMessage(null);
            }
          } catch {
            // Keep cached sync metadata when offline
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const performWebBackgroundTick = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const localData = getLocalAppDataObject();
      await googleDriveSyncProvider.backup(localData);
      setMeta(getStoredDriveSyncMeta());
      setSyncStatus('synced');
      setErrorMessage(null);
    } catch (err: any) {
      const msg = err?.message || 'Background Google Drive sync failed.';
      updateStoredDriveSyncMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
    }
  }, [getLocalAppDataObject]);

  // Check remote backup.json timestamp vs local lastSyncedAt
  const inspectRemoteBeforeSync = useCallback(
    async (mode: 'after-connect' | 'sync-now' | 'restore-check') => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        const localLastSyncedAt = getStoredDriveSyncMeta().lastSyncedAt;
        const remote = await googleDriveSyncProvider.restore();

        if (remote.found && remote.envelope) {
          const remoteUpdatedAt = remote.envelope.updatedAt || remote.lastModified || '';
          const remoteIsNewer = isRemoteNewerThanLocal(remoteUpdatedAt, localLastSyncedAt);

          if (remoteIsNewer || mode === 'restore-check') {
            setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
            setConflictState({
              remoteEnvelope: remote.envelope,
              remoteUpdatedAt,
              remoteSizeBytes: remote.fileSizeBytes,
              localLastSyncedAt,
            });
            return;
          }
        }

        if (mode === 'restore-check') {
          setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
          showAndroidToast('No cloud backup found in Drive AppData yet', 2800, 'default');
          return;
        }

        if (mode === 'sync-now') {
          setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
          setShowUploadConfirm(true);
          return;
        }

        // after-connect when no newer cloud backup exists
        setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
      } catch (err: any) {
        const msg = err?.message || 'Unable to check Google Drive backup.';
        updateStoredDriveSyncMeta({ lastError: msg });
        setSyncStatus('error');
        setErrorMessage(msg);
        showAndroidToast(msg, 3400, 'error');
      }
    },
    []
  );

  // 1. CONNECT GOOGLE DRIVE
  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const connectedAcc = await googleDriveSyncProvider.connect();
      setAccount(connectedAcc);
      showAndroidToast(`Connected as ${connectedAcc.email || connectedAcc.name}`, 2800, 'success');
      // Automatically check if a newer cloud backup exists before overwriting anything
      await inspectRemoteBeforeSync('after-connect');
    } catch (err: any) {
      const msg = err?.message || 'Could not connect to Google Drive.';
      setErrorMessage(msg);
      setSyncStatus('error');
      showAndroidToast(msg, 3400, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. CONFIRMED UPLOAD (backupToDrive)
  const handleConfirmUploadBackup = async () => {
    setShowUploadConfirm(false);
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      const localData = getLocalAppDataObject();
      await googleDriveSyncProvider.backup(localData);
      setMeta(getStoredDriveSyncMeta());
      setSyncStatus('synced');
      showAndroidToast('Synced to Google Drive', 2600, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload backup to Google Drive.';
      updateStoredDriveSyncMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3400, 'error');
    }
  };

  // 3. CONFLICT RESOLUTION OPTIONS
  const handleResolveConflict = async (choice: 'restore_cloud' | 'keep_device' | 'merge_both') => {
    if (!conflictState || isResolvingConflict) return;
    setIsResolvingConflict(true);
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      if (choice === 'restore_cloud') {
        const ok = replaceAllAppDataFromBackup(JSON.stringify(conflictState.remoteEnvelope.data));
        if (!ok) {
          throw new Error('Cloud backup payload could not be restored.');
        }
        updateStoredDriveSyncMeta({
          lastSyncedAt: conflictState.remoteUpdatedAt || new Date().toISOString(),
          lastFileSizeBytes: conflictState.remoteSizeBytes,
          lastError: null,
        });
        setMeta(getStoredDriveSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Restored backup from Google Drive', 2800, 'success');
      } else if (choice === 'keep_device') {
        const localData = getLocalAppDataObject();
        await googleDriveSyncProvider.backup(localData);
        setMeta(getStoredDriveSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Kept this device and updated Drive backup', 2800, 'success');
      } else {
        const localData = getLocalAppDataObject();
        const merged = mergeDriveData(localData, conflictState.remoteEnvelope.data);
        const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
        if (!ok) {
          throw new Error('Failed to apply merged backup locally.');
        }
        await googleDriveSyncProvider.backup(merged);
        setMeta(getStoredDriveSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Merged cloud & local data and synced', 3000, 'success');
      }
    } catch (err: any) {
      const msg = err?.message || 'Conflict resolution failed.';
      updateStoredDriveSyncMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3400, 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // 4. AUTO-SYNC TOGGLE & SEGMENTED INTERVAL SELECTOR
  const handleToggleAutoSync = async () => {
    const nextEnabled = !meta.autoSyncEnabled;
    const nextInterval: AutoSyncIntervalMinutes = nextEnabled
      ? meta.autoSyncIntervalMinutes > 0
        ? meta.autoSyncIntervalMinutes
        : 30
      : 0;
    try {
      await autoSync(nextInterval, performWebBackgroundTick);
      setMeta(getStoredDriveSyncMeta());
      showAndroidToast(
        nextInterval > 0
          ? `Auto-sync enabled (every ${nextInterval === 60 ? '1 hr' : `${nextInterval} min`})`
          : 'Auto-sync switched to Manual',
        2400,
        'default'
      );
    } catch (err: any) {
      showAndroidToast(err?.message || 'Could not update auto-sync schedule', 3000, 'error');
    }
  };

  const handleSelectInterval = async (intervalMinutes: AutoSyncIntervalMinutes) => {
    try {
      await autoSync(intervalMinutes, performWebBackgroundTick);
      setMeta(getStoredDriveSyncMeta());
      showAndroidToast(
        intervalMinutes === 0
          ? 'Sync mode set to Manual'
          : `Auto-sync scheduled every ${intervalMinutes === 60 ? '1 hr' : `${intervalMinutes} min`}`,
        2400,
        'default'
      );
    } catch (err: any) {
      showAndroidToast(err?.message || 'Could not schedule auto-sync', 3000, 'error');
    }
  };

  // 5. DISCONNECT (REVOKES ACCESS & CLEARS TOKENS)
  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    try {
      await googleDriveSyncProvider.disconnect();
      setAccount(null);
      setMeta(getStoredDriveSyncMeta());
      setSyncStatus('idle');
      setErrorMessage(null);
      showAndroidToast('Disconnected Google Drive & revoked access', 2800, 'default');
    } catch (err: any) {
      showAndroidToast(err?.message || 'Failed to disconnect Google Drive', 3000, 'error');
    }
  };

  const renderStatusChip = () => {
    if (!account?.connected && syncStatus !== 'error') {
      return (
        <span
          role="status"
          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 whitespace-nowrap shrink-0"
        >
          Not connected
        </span>
      );
    }
    if (syncStatus === 'syncing') {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white animate-pulse whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing…</span>
        </span>
      );
    }
    if (syncStatus === 'error') {
      return (
        <button
          type="button"
          onClick={() => (account?.connected ? inspectRemoteBeforeSync('sync-now') : handleConnect())}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
          title="Tap to retry"
        >
          <X className="w-3.5 h-3.5" />
          <span>Error ✗</span>
        </button>
      );
    }
    if (syncStatus === 'synced' && account?.connected && meta.lastSyncedAt) {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white whitespace-nowrap shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Synced ✓</span>
        </span>
      );
    }
    return null;
  };

  const activeInterval: AutoSyncIntervalMinutes = meta.autoSyncEnabled
    ? meta.autoSyncIntervalMinutes
    : 0;

  return (
    <>
      <section
        aria-label="Google Drive Sync"
        style={
          account?.connected
            ? { borderLeftWidth: 3, borderLeftColor: '#4285F4' }
            : undefined
        }
        className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4 w-full min-w-0"
      >
        {/* Material Design 3 Section Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <GoogleLogoSvg className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                Google Drive
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Private AppData backup hidden from your Drive files.
              </p>
            </div>
          </div>

          {renderStatusChip()}
        </div>

        {/* DISCONNECTED STATE */}
        {!account?.connected ? (
          <div className="space-y-3.5">
            <button
              type="button"
              id="btn-m3-connect-google-drive"
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full min-h-[48px] px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap"
            >
              <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                <GoogleLogoSvg className="w-4 h-4" />
              </span>
              <span>{isConnecting ? 'Connecting Google Drive…' : 'Connect Google Drive'}</span>
            </button>

            <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Uses least-privilege <code className="font-mono text-[11px]">drive.appdata</code> scope only.
                JivanOS cannot see or modify any of your other Google Drive files.
              </span>
            </div>

            {errorMessage && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          /* CONNECTED STATE */
          <div className="space-y-5">
            {/* Connected Account Card */}
            <div className="rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-semibold text-base flex items-center justify-center shrink-0 tracking-wide shadow-xs"
                >
                  {account.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {account.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                    {account.email}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                    <span>
                      {meta.lastSyncedAt
                        ? `Last synced ${formatRelativeSyncTime(meta.lastSyncedAt)}`
                        : 'Not synced yet'}
                    </span>
                    {meta.lastFileSizeBytes != null && meta.lastFileSizeBytes > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatDriveFileSize(meta.lastFileSizeBytes)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Sync Now icon button + Check Cloud + Disconnect text button */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-m3-drive-sync-now"
                  onClick={() => inspectRemoteBeforeSync('sync-now')}
                  disabled={syncStatus === 'syncing'}
                  title="Sync Now"
                  aria-label="Sync Now"
                  className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  id="btn-m3-drive-restore-check"
                  onClick={() => inspectRemoteBeforeSync('restore-check')}
                  disabled={syncStatus === 'syncing'}
                  title="Restore or merge from Google Drive"
                  aria-label="Restore from Google Drive"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 text-slate-700 dark:text-zinc-200 transition inline-flex items-center justify-center cursor-pointer"
                >
                  <CloudDownload className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  id="btn-m3-drive-disconnect"
                  onClick={() => setShowDisconnectConfirm(true)}
                  disabled={syncStatus === 'syncing'}
                  className="min-h-[44px] px-3 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Hairline Divider */}
            <div className="h-px bg-slate-200/80 dark:bg-zinc-800" />

            {/* Auto-sync Toggle + Segmented Interval Selector */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Auto-sync
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {isNativeAndroid
                      ? 'Scheduled via Android WorkManager when connected to a network.'
                      : 'Automatically backs up to your private Drive AppData folder.'}
                  </div>
                </div>

                {/* Material Design 3 Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={meta.autoSyncEnabled}
                  aria-label="Toggle Google Drive Auto-sync"
                  onClick={handleToggleAutoSync}
                  className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors cursor-pointer ${
                    meta.autoSyncEnabled
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-slate-200 dark:bg-zinc-800 border-slate-400 dark:border-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block rounded-full transition-transform ${
                      meta.autoSyncEnabled
                        ? 'h-6 w-6 translate-x-5 bg-white shadow-xs'
                        : 'h-4 w-4 translate-x-1 bg-slate-600 dark:bg-zinc-400'
                    }`}
                  />
                </button>
              </div>

              {/* Material Design 3 Segmented Button Group: 15 min | 30 min | 1 hr | Manual */}
              <div
                role="radiogroup"
                aria-label="Auto-sync interval"
                className="grid grid-cols-4 rounded-full border border-slate-300 dark:border-zinc-700 overflow-hidden divide-x divide-slate-300 dark:divide-zinc-700"
              >
                {INTERVAL_OPTIONS.map(opt => {
                  const selected = activeInterval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleSelectInterval(opt.value)}
                      className={`min-h-[44px] px-2 text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap tabular-nums ${
                        selected
                          ? 'bg-indigo-100 dark:bg-indigo-950/90 text-indigo-800 dark:text-indigo-200'
                          : 'bg-transparent text-slate-700 dark:text-zinc-300 hover:bg-slate-100/80 dark:hover:bg-zinc-800/70'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CONFLICT RESOLUTION DIALOG (Remote updatedAt > Local lastSyncedAt) */}
      {conflictState && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-drive-conflict-title"
          aria-describedby="m3-drive-conflict-desc"
          className="fixed inset-0 z-[100002] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isResolvingConflict && setConflictState(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-5"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-2">
              <h3
                id="m3-drive-conflict-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Newer Cloud Backup Found
              </h3>
              <p
                id="m3-drive-conflict-desc"
                className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed"
              >
                Your Google Drive backup is newer than this device&apos;s last sync. Choose how to proceed:
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 px-4 py-3 text-xs text-slate-600 dark:text-zinc-400 space-y-1 tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 dark:text-zinc-200">Cloud backup</span>
                <span>
                  {formatRelativeSyncTime(conflictState.remoteUpdatedAt)} ·{' '}
                  {formatDriveFileSize(conflictState.remoteSizeBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 dark:text-zinc-200">This device</span>
                <span>
                  {conflictState.localLastSyncedAt
                    ? `Synced ${formatRelativeSyncTime(conflictState.localLastSyncedAt)}`
                    : 'Not synced yet'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('merge_both')}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <GitMerge className="w-4 h-4 shrink-0" />
                <span>Merge Both</span>
              </button>

              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('restore_cloud')}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 text-slate-900 dark:text-zinc-100 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <CloudDownload className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>Restore from Cloud</span>
              </button>

              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('keep_device')}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 text-slate-900 dark:text-zinc-100 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Smartphone className="w-4 h-4 shrink-0 text-slate-600 dark:text-zinc-400" />
                <span>Keep This Device</span>
              </button>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => setConflictState(null)}
                className="min-h-[40px] px-4 rounded-full text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPLICIT CONFIRMATION DIALOG FOR UPLOADING / OVERWRITING DRIVE BACKUP */}
      {showUploadConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-drive-upload-title"
          className="fixed inset-0 z-[100002] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowUploadConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-4"
          >
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center mx-auto">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1.5">
              <h3
                id="m3-drive-upload-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Sync Backup to Google Drive?
              </h3>
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                This will save your current JivanOS data to your private Drive AppData folder (
                <code className="font-mono text-xs">backup.json</code>).
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadConfirm(false)}
                className="min-h-[44px] px-5 rounded-full text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUploadBackup}
                className="min-h-[44px] px-5 rounded-full text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPLICIT CONFIRMATION DIALOG FOR DISCONNECT */}
      {showDisconnectConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-drive-disconnect-title"
          className="fixed inset-0 z-[100002] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-4"
          >
            <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 flex items-center justify-center mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1.5">
              <h3
                id="m3-drive-disconnect-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Disconnect Google Drive?
              </h3>
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                This revokes JivanOS access, cancels scheduled auto-sync, and clears all stored tokens. Your local data stays safe on this device.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="min-h-[44px] px-5 rounded-full text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="min-h-[44px] px-5 rounded-full text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
