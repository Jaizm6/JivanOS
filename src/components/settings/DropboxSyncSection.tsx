import React, { useCallback, useEffect, useState } from 'react';
import {
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
import type { AutoSyncIntervalMinutes, DriveBackupEnvelope } from '../../utils/googleDriveSync';
import {
  DROPBOX_SYNC_STATE_EVENT,
  DropboxAccount,
  DropboxSyncStatus,
  StoredDropboxSyncMeta,
  autoSync,
  formatDriveFileSize,
  formatRelativeSyncTime,
  getConnectedDropboxAccount,
  getStoredDropboxSyncMeta,
  isNativeAndroidDropboxAvailable,
  isRemoteNewerThanLocal,
  mergeDriveData,
  updateStoredDropboxSyncMeta,
} from '../../utils/dropboxSync';
import { dropboxSyncProvider } from '../../sync/providers/DropboxProvider';
import { getCachedDesktopOAuthAccount } from '../../sync/desktop/DesktopSyncTransport';
import { isDesktop } from '../../desktop/KeychainService';

const INTERVAL_OPTIONS: { label: string; value: AutoSyncIntervalMinutes }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: 'Manual', value: 0 },
];

interface DropboxConflictDialogState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
  localLastSyncedAt: string | null;
}

const DropboxLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M6.004 2L0 5.83l6.004 3.83L12 5.83 6.004 2zm11.992 0L12 5.83l5.996 3.83L24 5.83 17.996 2zM0 13.49l6.004 3.83L12 13.49 6.004 9.66 0 13.49zm17.996-3.83L12 13.49l5.996 3.83L24 13.49l-6.004-3.83zM6.004 18.59L12 22.42l5.996-3.83-5.996-3.83-5.996 3.83z" />
  </svg>
);

export const DropboxSyncSection: React.FC = () => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();

  const [account, setAccount] = useState<DropboxAccount | null>(() =>
    isDesktop() ? getCachedDesktopOAuthAccount('dropbox') : getConnectedDropboxAccount()
  );
  const [meta, setMeta] = useState<StoredDropboxSyncMeta>(() => getStoredDropboxSyncMeta());
  const [syncStatus, setSyncStatus] = useState<DropboxSyncStatus>(() => {
    const initial = getStoredDropboxSyncMeta();
    if (initial.lastError) return 'error';
    if (initial.lastSyncedAt) return 'synced';
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(() => getStoredDropboxSyncMeta().lastError);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [conflictState, setConflictState] = useState<DropboxConflictDialogState | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [, setRelativeTick] = useState(0);

  const isNativeAndroid = isNativeAndroidDropboxAvailable();

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  // Refresh "Last synced X min ago" every 30s
  useEffect(() => {
    const interval = window.setInterval(() => setRelativeTick(t => t + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Listen to Dropbox sync metadata updates from background workers or AppContext
  useEffect(() => {
    const handleMetaUpdate = () => {
      const next = getStoredDropboxSyncMeta();
      setMeta(next);
      if (next.lastError) {
        setSyncStatus('error');
        setErrorMessage(next.lastError);
      } else if (next.lastSyncedAt) {
        setSyncStatus(prev => (prev === 'syncing' ? prev : 'synced'));
        setErrorMessage(null);
      }
    };
    window.addEventListener(DROPBOX_SYNC_STATE_EVENT, handleMetaUpdate);
    return () => window.removeEventListener(DROPBOX_SYNC_STATE_EVENT, handleMetaUpdate);
  }, []);

  // Silent re-auth on mount
  useEffect(() => {
    let active = true;
    dropboxSyncProvider
      .silentReAuth()
      .then(async acc => {
        if (!active) return;
        setAccount(acc);
        if (acc?.connected) {
          try {
            const info = await dropboxSyncProvider.getLastSyncInfo();
            if (active && info) {
              setMeta(getStoredDropboxSyncMeta());
              setSyncStatus('synced');
              setErrorMessage(null);
            }
          } catch {
            // Retain cached sync metadata if temporarily offline
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
      await dropboxSyncProvider.backup(localData);
      setMeta(getStoredDropboxSyncMeta());
      setSyncStatus('synced');
      setErrorMessage(null);
    } catch (err: any) {
      const msg = err?.message || 'Background Dropbox sync failed.';
      updateStoredDropboxSyncMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
    }
  }, [getLocalAppDataObject]);

  // Compare remote lastModified vs local lastSyncedAt before restore/sync
  const runSyncOrInspect = useCallback(
    async (mode: 'after-connect' | 'sync-now' | 'restore-check') => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        const localLastSyncedAt = getStoredDropboxSyncMeta().lastSyncedAt;
        const remote = await dropboxSyncProvider.restore();

        if (remote.found && remote.envelope) {
          const remoteLastModified = remote.lastModified || remote.envelope.updatedAt || '';
          const remoteIsNewer = isRemoteNewerThanLocal(remoteLastModified, localLastSyncedAt);

          if (remoteIsNewer || mode === 'restore-check') {
            setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
            setConflictState({
              remoteEnvelope: remote.envelope,
              remoteLastModified,
              remoteSizeBytes: remote.fileSizeBytes,
              localLastSyncedAt,
            });
            return;
          }
        }

        if (mode === 'restore-check') {
          setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
          showAndroidToast('No backup found in /Apps/JivanOS/backup.json yet', 2800, 'default');
          return;
        }

        if (mode === 'sync-now') {
          const localData = getLocalAppDataObject();
          await dropboxSyncProvider.backup(localData);
          setMeta(getStoredDropboxSyncMeta());
          setSyncStatus('synced');
          showAndroidToast('Synced to Dropbox (/Apps/JivanOS/backup.json)', 2800, 'success');
          return;
        }

        // after-connect with no newer cloud backup
        setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
      } catch (err: any) {
        const msg = err?.message || 'Unable to sync with Dropbox.';
        updateStoredDropboxSyncMeta({ lastError: msg });
        setSyncStatus('error');
        setErrorMessage(msg);
        showAndroidToast(msg, 3400, 'error');
      }
    },
    [getLocalAppDataObject]
  );

  // 1. CONNECT DROPBOX (OAuth2 PKCE)
  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const connectedAcc = await dropboxSyncProvider.connect();
      setAccount(connectedAcc);
      showAndroidToast(`Connected Dropbox as ${connectedAcc.email || connectedAcc.name}`, 2800, 'success');
      await runSyncOrInspect('after-connect');
    } catch (err: any) {
      const msg = err?.message || 'Could not connect to Dropbox.';
      setErrorMessage(msg);
      setSyncStatus('error');
      showAndroidToast(msg, 3400, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. CONFLICT RESOLUTION: Restore from Cloud / Keep This Device / Merge Both
  const handleResolveConflict = async (choice: 'restore_cloud' | 'keep_device' | 'merge_both') => {
    if (!conflictState || isResolvingConflict) return;
    setIsResolvingConflict(true);
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      if (choice === 'restore_cloud') {
        const ok = replaceAllAppDataFromBackup(JSON.stringify(conflictState.remoteEnvelope.data));
        if (!ok) {
          throw new Error('Dropbox backup payload could not be restored.');
        }
        updateStoredDropboxSyncMeta({
          lastSyncedAt: conflictState.remoteLastModified || new Date().toISOString(),
          lastFileSizeBytes: conflictState.remoteSizeBytes,
          lastError: null,
        });
        setMeta(getStoredDropboxSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Restored backup from Dropbox', 2800, 'success');
      } else if (choice === 'keep_device') {
        const localData = getLocalAppDataObject();
        await dropboxSyncProvider.backup(localData);
        setMeta(getStoredDropboxSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Kept this device and updated Dropbox backup', 2800, 'success');
      } else {
        const localData = getLocalAppDataObject();
        const merged = mergeDriveData(localData, conflictState.remoteEnvelope.data);
        const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
        if (!ok) {
          throw new Error('Failed to apply merged backup locally.');
        }
        await dropboxSyncProvider.backup(merged);
        setMeta(getStoredDropboxSyncMeta());
        setSyncStatus('synced');
        setConflictState(null);
        showAndroidToast('Merged Dropbox & local data and synced', 3000, 'success');
      }
    } catch (err: any) {
      const msg = err?.message || 'Conflict resolution failed.';
      updateStoredDropboxSyncMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3400, 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // 3. AUTO-SYNC TOGGLE & SEGMENTED INTERVAL SELECTOR
  const handleToggleAutoSync = async () => {
    const nextEnabled = !meta.autoSyncEnabled;
    const nextInterval: AutoSyncIntervalMinutes = nextEnabled
      ? meta.autoSyncIntervalMinutes > 0
        ? meta.autoSyncIntervalMinutes
        : 30
      : 0;
    try {
      await autoSync(nextInterval, performWebBackgroundTick);
      setMeta(getStoredDropboxSyncMeta());
      showAndroidToast(
        nextInterval > 0
          ? `Dropbox auto-sync enabled (every ${nextInterval === 60 ? '1 hr' : `${nextInterval} min`})`
          : 'Dropbox auto-sync set to Manual',
        2400,
        'default'
      );
    } catch (err: any) {
      showAndroidToast(err?.message || 'Could not update Dropbox auto-sync schedule', 3000, 'error');
    }
  };

  const handleSelectInterval = async (intervalMinutes: AutoSyncIntervalMinutes) => {
    try {
      await autoSync(intervalMinutes, performWebBackgroundTick);
      setMeta(getStoredDropboxSyncMeta());
      showAndroidToast(
        intervalMinutes === 0
          ? 'Dropbox sync set to Manual'
          : `Dropbox auto-sync scheduled every ${intervalMinutes === 60 ? '1 hr' : `${intervalMinutes} min`}`,
        2400,
        'default'
      );
    } catch (err: any) {
      showAndroidToast(err?.message || 'Could not schedule Dropbox auto-sync', 3000, 'error');
    }
  };

  // 4. DISCONNECT (CLEARS ALL STORED TOKENS)
  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    try {
      await dropboxSyncProvider.disconnect();
      setAccount(null);
      setMeta(getStoredDropboxSyncMeta());
      setSyncStatus('idle');
      setErrorMessage(null);
      showAndroidToast('Disconnected Dropbox & cleared stored tokens', 2800, 'default');
    } catch (err: any) {
      showAndroidToast(err?.message || 'Failed to disconnect Dropbox', 3000, 'error');
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
          onClick={() => (account?.connected ? runSyncOrInspect('sync-now') : handleConnect())}
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
        aria-label="Dropbox Sync"
        style={
          account?.connected
            ? { borderLeftWidth: 3, borderLeftColor: '#0061FF' }
            : undefined
        }
        className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4 w-full min-w-0"
      >
        {/* Material Design 3 Section Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-[#0061FF]/10 dark:bg-[#0061FF]/20 text-[#0061FF] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
              <DropboxLogoSvg className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                Dropbox
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Sandboxed App Folder sync inside <code className="font-mono text-xs">/Apps/JivanOS/</code>.
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
              id="btn-m3-connect-dropbox"
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#0061FF] hover:bg-[#0052D9] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
            >
              <DropboxLogoSvg className="w-4.5 h-4.5 shrink-0" />
              <span>{isConnecting ? 'Connecting Dropbox…' : 'Connect Dropbox'}</span>
            </button>

            <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Uses OAuth 2.0 PKCE with App Folder access only. JivanOS can only access{' '}
                <code className="font-mono text-[11px]">/Apps/JivanOS/</code> and cannot read your other Dropbox files.
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
            <div className="rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-full bg-[#0061FF] text-white font-semibold text-base flex items-center justify-center shrink-0 tracking-wide shadow-xs"
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

              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-m3-dropbox-sync-now"
                  onClick={() => runSyncOrInspect('sync-now')}
                  disabled={syncStatus === 'syncing'}
                  title="Sync Now"
                  aria-label="Sync Now"
                  className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-[#0061FF] hover:bg-[#0052D9] active:scale-[0.98] disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  id="btn-m3-dropbox-restore-check"
                  onClick={() => runSyncOrInspect('restore-check')}
                  disabled={syncStatus === 'syncing'}
                  title="Restore or merge from Dropbox"
                  aria-label="Restore from Dropbox"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 text-slate-700 dark:text-zinc-200 transition inline-flex items-center justify-center cursor-pointer"
                >
                  <CloudDownload className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  id="btn-m3-dropbox-disconnect"
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
                      ? 'Scheduled via Android WorkManager using encrypted tokens.'
                      : 'Automatically backs up to /Apps/JivanOS/backup.json.'}
                  </div>
                </div>

                {/* Material Design 3 Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={meta.autoSyncEnabled}
                  aria-label="Toggle Dropbox Auto-sync"
                  onClick={handleToggleAutoSync}
                  className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors cursor-pointer ${
                    meta.autoSyncEnabled
                      ? 'bg-[#0061FF] border-[#0061FF]'
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

              {/* Segmented Interval Selector: 15 min | 30 min | 1 hr | Manual */}
              <div
                role="radiogroup"
                aria-label="Dropbox auto-sync interval"
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
                          ? 'bg-[#0061FF]/15 dark:bg-[#0061FF]/30 text-[#0052D9] dark:text-blue-200'
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

      {/* CONFLICT RESOLUTION DIALOG */}
      {conflictState && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-dropbox-conflict-title"
          aria-describedby="m3-dropbox-conflict-desc"
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
                id="m3-dropbox-conflict-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Newer Dropbox Backup Found
              </h3>
              <p
                id="m3-dropbox-conflict-desc"
                className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed"
              >
                Your Dropbox backup is newer than this device&apos;s last sync. Choose how to proceed:
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 px-4 py-3 text-xs text-slate-600 dark:text-zinc-400 space-y-1 tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 dark:text-zinc-200">Dropbox backup</span>
                <span>
                  {formatRelativeSyncTime(conflictState.remoteLastModified)} ·{' '}
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
                className="w-full min-h-[48px] px-4 py-2.5 rounded-full bg-[#0061FF] hover:bg-[#0052D9] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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
                <CloudDownload className="w-4 h-4 shrink-0 text-[#0061FF] dark:text-[#60A5FA]" />
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

      {/* DISCONNECT CONFIRMATION DIALOG */}
      {showDisconnectConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-dropbox-disconnect-title"
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
                id="m3-dropbox-disconnect-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Disconnect Dropbox?
              </h3>
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                This revokes access, cancels background WorkManager sync, and clears all stored Dropbox tokens. Your local data stays safe.
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
