import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  X,
  AlertTriangle,
  CloudDownload,
  GitMerge,
  Smartphone,
  LogOut,
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
  completeDropboxManualCodePkce,
  formatDriveFileSize,
  formatRelativeSyncTime,
  getConnectedDropboxAccount,
  getDropboxWebRedirectUri,
  getStoredDropboxSyncMeta,
  isDropboxPopupModeEnabled,
  isNativeAndroidDropboxAvailable,
  isRemoteNewerThanLocal,
  mergeDriveData,
  setDropboxPopupModeEnabled,
  startDropboxManualCodePkce,
  updateStoredDropboxSyncMeta,
} from '../../utils/dropboxSync';
import { dropboxSyncProvider } from '../../sync/providers/DropboxProvider';
import { getCachedDesktopOAuthAccount } from '../../sync/desktop/DesktopSyncTransport';
import { isDesktop } from '../../desktop/KeychainService';

import { SyncProviderRow } from './SyncProviderRow';

interface DropboxConflictDialogState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
  localLastSyncedAt: string | null;
}

export interface DropboxSyncSectionProps {
  isFirst?: boolean;
  isLast?: boolean;
}

const DropboxLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M6.004 2L0 5.83l6.004 3.83L12 5.83 6.004 2zm11.992 0L12 5.83l5.996 3.83L24 5.83 17.996 2zM0 13.49l6.004 3.83L12 13.49 6.004 9.66 0 13.49zm17.996-3.83L12 13.49l5.996 3.83L24 13.49l-6.004-3.83zM6.004 18.59L12 22.42l5.996-3.83-5.996-3.83-5.996 3.83z" />
  </svg>
);

export const DropboxSyncSection: React.FC<DropboxSyncSectionProps> = ({
  isFirst = false,
  isLast = false,
}) => {
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

  // Web/mobile-preview paste-code PKCE modal state (default flow)
  const [isConnectSheetOpen, setIsConnectSheetOpen] = useState(false);
  const [manualAuthUrl, setManualAuthUrl] = useState('');
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isCompletingManual, setIsCompletingManual] = useState(false);
  const [manualSetupError, setManualSetupError] = useState<string | null>(null);
  const [popupModeEnabled, setPopupModeEnabled] = useState<boolean>(() =>
    isDropboxPopupModeEnabled()
  );
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  const prepareManualAuthUrl = useCallback(async (forceNew = false) => {
    try {
      const { authUrl } = await startDropboxManualCodePkce({ forceNew });
      setManualAuthUrl(authUrl);
    } catch (err: any) {
      setManualSetupError(err?.message || 'Could not initialize Dropbox authorization link.');
    }
  }, []);

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

  // Silent Joplin-style bidirectional sync (pull + item-level merge + push) for after-connect & sync-now;
  // only explicit 'restore-check' opens the restore modal.
  const runSyncOrInspect = useCallback(
    async (mode: 'after-connect' | 'sync-now' | 'restore-check') => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        const localLastSyncedAt = getStoredDropboxSyncMeta().lastSyncedAt;
        const remote = await dropboxSyncProvider.restore();

        if (mode === 'restore-check') {
          if (remote.found && remote.envelope) {
            const remoteLastModified = remote.lastModified || remote.envelope.updatedAt || '';
            setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
            setConflictState({
              remoteEnvelope: remote.envelope,
              remoteLastModified,
              remoteSizeBytes: remote.fileSizeBytes,
              localLastSyncedAt,
            });
            return;
          }
          setSyncStatus(localLastSyncedAt ? 'synced' : 'idle');
          showAndroidToast('No backup found in /Apps/JivanOS/backup.json yet', 2800, 'default');
          return;
        }

        // Silent Joplin-style bidirectional merge & push
        let localData = getLocalAppDataObject();
        if (remote.found && remote.envelope && remote.envelope.data) {
          localData = mergeDriveData(localData, remote.envelope.data);
          replaceAllAppDataFromBackup(JSON.stringify(localData));
        }

        await dropboxSyncProvider.backup(localData);
        setMeta(getStoredDropboxSyncMeta());
        setSyncStatus('synced');

        if (mode === 'sync-now') {
          showAndroidToast('Synced with Dropbox (items merged)', 2400, 'success');
        }
      } catch (err: any) {
        const msg = err?.message || 'Unable to sync with Dropbox.';
        updateStoredDropboxSyncMeta({ lastError: msg });
        setSyncStatus('error');
        setErrorMessage(msg);
        showAndroidToast(msg, 3400, 'error');
      }
    },
    [getLocalAppDataObject, replaceAllAppDataFromBackup]
  );

  // 1. CONNECT DROPBOX (Native Android / Desktop direct, Web/Preview opens zero-config PKCE modal)
  const handleDirectPopupConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setErrorMessage(null);
    setManualSetupError(null);
    try {
      const connectedAcc = await dropboxSyncProvider.connect();
      setAccount(connectedAcc);
      setIsConnectSheetOpen(false);
      showAndroidToast(`Connected Dropbox as ${connectedAcc.email || connectedAcc.name}`, 2800, 'success');
      await runSyncOrInspect('after-connect');
    } catch (err: any) {
      const msg = err?.message || 'Could not connect to Dropbox.';
      setErrorMessage(msg);
      setManualSetupError(msg);
      setSyncStatus('error');
      showAndroidToast(msg, 3400, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (isNativeAndroidDropboxAvailable() || isDesktop()) {
      await handleDirectPopupConnect();
      return;
    }
    setManualCodeInput('');
    setManualSetupError(null);
    setCopiedRedirectUri(false);
    setIsConnectSheetOpen(true);
    await prepareManualAuthUrl(false);
  };

  const handleTogglePopupMode = () => {
    const next = !popupModeEnabled;
    setPopupModeEnabled(next);
    setDropboxPopupModeEnabled(next);
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompletingManual) return;
    setIsCompletingManual(true);
    setManualSetupError(null);
    try {
      const connectedAcc = await completeDropboxManualCodePkce(manualCodeInput);
      setAccount(connectedAcc);
      setManualCodeInput('');
      setIsConnectSheetOpen(false);
      setErrorMessage(null);
      showAndroidToast(`Connected Dropbox as ${connectedAcc.email || connectedAcc.name}`, 2800, 'success');
      await runSyncOrInspect('after-connect');
    } catch (err: any) {
      const msg = err?.message || 'Could not verify Dropbox authorization code.';
      setManualSetupError(msg);
      // Generate a fresh PKCE challenge + verifier so the next tap of Open Dropbox Authorization gets a valid pair
      await prepareManualAuthUrl(true);
    } finally {
      setIsCompletingManual(false);
    }
  };

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(getDropboxWebRedirectUri());
      setCopiedRedirectUri(true);
      showAndroidToast('Redirect URI copied', 2000, 'success');
      window.setTimeout(() => setCopiedRedirectUri(false), 2400);
    } catch {
      showAndroidToast('Select and copy the Redirect URI manually', 2400, 'default');
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

  // 3. AUTO-SYNC INTERVAL SELECTOR
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

  const isConnected = Boolean(account?.connected);
  const activeInterval: AutoSyncIntervalMinutes = meta.autoSyncEnabled
    ? meta.autoSyncIntervalMinutes
    : 0;

  const rowStatus = !isConnected
    ? syncStatus === 'error'
      ? 'error'
      : 'disconnected'
    : syncStatus === 'syncing'
      ? 'syncing'
      : syncStatus === 'error'
        ? 'error'
        : meta.lastSyncedAt
          ? 'synced'
          : 'connected';

  const metaLine = meta.lastSyncedAt
    ? `Last synced ${formatRelativeSyncTime(meta.lastSyncedAt)}${
        meta.lastFileSizeBytes != null && meta.lastFileSizeBytes > 0
          ? ` · ${formatDriveFileSize(meta.lastFileSizeBytes)}`
          : ''
      }`
    : 'Connected · /Apps/JivanOS/';

  return (
    <>
      <SyncProviderRow
        name="Dropbox"
        description="Sandboxed App Folder sync"
        logo={<DropboxLogoSvg className="w-4.5 h-4.5 text-[#0061FF] dark:text-[#60A5FA]" />}
        logoBgClass="bg-[#0061FF]/10 dark:bg-[#0061FF]/20"
        brandColor="#0061FF"
        isConnected={isConnected}
        status={rowStatus}
        accountLabel={isConnected ? account?.email || account?.name : undefined}
        metaLine={isConnected ? metaLine : undefined}
        connectLabel={isConnecting ? 'Connecting…' : 'Connect →'}
        connectDisabled={isConnecting}
        connectButtonId="btn-m3-connect-dropbox"
        onConnect={handleConnect}
        onSyncNow={isConnected ? () => runSyncOrInspect('sync-now') : undefined}
        syncButtonId="btn-m3-dropbox-sync-now"
        isSyncing={syncStatus === 'syncing'}
        onRetry={() => (isConnected ? runSyncOrInspect('sync-now') : handleConnect())}
        autoSyncInterval={activeInterval}
        onSelectInterval={isConnected ? handleSelectInterval : undefined}
        onRestore={isConnected ? () => runSyncOrInspect('restore-check') : undefined}
        onDisconnect={isConnected ? () => setShowDisconnectConfirm(true) : undefined}
        errorMessage={errorMessage}
        isFirst={isFirst}
        isLast={isLast}
      />

      {/* CONNECT DROPBOX BOTTOM SHEET (Web / Mobile Preview) */}
      {isConnectSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="m3-dropbox-connect-title"
          className="fixed inset-0 z-[100002] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !isCompletingManual && !isConnecting && setIsConnectSheetOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-[440px] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0061FF]/10 dark:bg-[#0061FF]/20 text-[#0061FF] dark:text-[#60A5FA] flex items-center justify-center">
                  <DropboxLogoSvg className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="m3-dropbox-connect-title"
                    className="text-base font-semibold text-slate-900 dark:text-zinc-100"
                  >
                    Connect Dropbox
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Sandboxed sync to /Apps/JivanOS/backup.json
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isCompletingManual && !isConnecting && setIsConnectSheetOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualCodeSubmit} className="space-y-3.5">
              {/* Step 1: Authorize on Dropbox */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0061FF] dark:text-[#60A5FA]">
                  Step 1 · Authorize on Dropbox
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Tap below to sign in to Dropbox and click <strong>Allow</strong>. Dropbox will display a
                  one-time authorization code on screen (works on any URL with zero redirect setup).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={manualAuthUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => {
                      if (!manualAuthUrl) {
                        e.preventDefault();
                        prepareManualAuthUrl();
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-full bg-[#0061FF] hover:bg-[#0052D9] text-white text-xs font-semibold shadow-xs transition ${
                      !manualAuthUrl ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <span>Open Dropbox Authorization</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 2: Paste Code */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0061FF] dark:text-[#60A5FA]">
                  Step 2 · Paste Authorization Code
                </div>
                <label
                  htmlFor="dropbox-manual-auth-code"
                  className="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  Dropbox Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="dropbox-manual-auth-code"
                    type="text"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={manualCodeInput}
                    onChange={e => {
                      setManualCodeInput(e.target.value);
                      setManualSetupError(null);
                    }}
                    placeholder="Paste the code shown by Dropbox…"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-zinc-100 outline-none focus:border-[#0061FF]"
                  />
                </div>
              </div>

              {manualSetupError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  {manualSetupError}
                </div>
              )}

              <button
                type="submit"
                disabled={isCompletingManual || isConnecting || !manualCodeInput.trim()}
                className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#0061FF] hover:bg-[#0052D9] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCompletingManual ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Dropbox…</span>
                  </>
                ) : (
                  <span>Connect Dropbox</span>
                )}
              </button>
            </form>

            {/* Optional 1-Click Popup Mode (off by default — runs only when explicitly turned on) */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800 space-y-2.5">
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none py-1">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    1-Click Popup Mode (optional)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Off by default · requires Redirect URI in Dropbox App Console
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={popupModeEnabled}
                  onClick={handleTogglePopupMode}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    popupModeEnabled
                      ? 'bg-[#0061FF]'
                      : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      popupModeEnabled ? 'translate-x-5.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {popupModeEnabled && (
                <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3 space-y-2.5">
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                    Add this exact URL in{' '}
                    <strong>Dropbox App Console → Settings → OAuth 2 → Redirect URIs</strong>:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[10px] font-mono text-slate-800 dark:text-zinc-200 break-all select-all">
                      {getDropboxWebRedirectUri()}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="shrink-0 min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      aria-label="Copy Redirect URI"
                    >
                      {copiedRedirectUri ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isConnecting || isCompletingManual}
                    onClick={handleDirectPopupConnect}
                    className="w-full min-h-[40px] px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Waiting for Dropbox popup…</span>
                      </>
                    ) : (
                      <span>Connect with 1-Click Popup</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
