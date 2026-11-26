import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CloudDownload,
  Eye,
  EyeOff,
  GitMerge,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../../components/common/AndroidToast';
import { M3Switch } from '../../components/common/PetalExpressive';
import {
  AutoSyncIntervalMinutes,
  DriveBackupEnvelope,
  formatDriveFileSize,
  formatRelativeSyncTime,
  isRemoteNewerThanLocal,
  mergeDriveData,
} from '../../utils/googleDriveSync';
import {
  MEGA_SYNC_STATE_EVENT,
  StoredMegaAuth,
  getStoredMegaAuth,
  hasActiveMegaSession,
  megaSyncProvider,
} from '../providers/MEGASyncProvider';

import { SyncProviderRow } from '../../components/settings/SyncProviderRow';
import { activateSyncProviderIfNone } from '../unifiedSyncBackupEngine';

const MEGA_RED = '#D9272E';

interface MegaConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
}

export interface MEGASyncSectionProps {
  isFirst?: boolean;
  isLast?: boolean;
  onBackupNow?: () => void;
  isBackingUp?: boolean;
  onOpenSyncOptions?: () => void;
  onOpenBackupOptions?: (onRestore?: () => void) => void;
  isActiveSyncProvider?: boolean;
  isBackupEnabled?: boolean;
}

const MegaLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill={MEGA_RED} />
    <path
      d="M6.5 16.2V7.8h2.3l3.2 4.35L15.2 7.8h2.3v8.4h-2.15v-4.95l-2.6 3.55h-1.5l-2.6-3.55v4.95H6.5z"
      fill="#FFFFFF"
    />
  </svg>
);

export const MEGASyncSection: React.FC<MEGASyncSectionProps> = ({
  isFirst = false,
  isLast = false,
  onBackupNow,
  isBackingUp = false,
  onOpenSyncOptions,
  onOpenBackupOptions,
  isActiveSyncProvider = false,
  isBackupEnabled = false,
}) => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();

  const [storedAuth, setStoredAuth] = useState<StoredMegaAuth | null>(() => getStoredMegaAuth());
  const [sessionActive, setSessionActive] = useState<boolean>(() => hasActiveMegaSession());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'syncing' | 'error'>(() => {
    const initial = getStoredMegaAuth();
    if (initial?.lastError) return 'error';
    if (initial?.lastSyncedAt && hasActiveMegaSession()) return 'synced';
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => getStoredMegaAuth()?.lastError || null
  );

  // Inline connect form state (not a modal)
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Session-expired inline resume password state
  const [resumePassword, setResumePassword] = useState('');
  const [showResumePassword, setShowResumePassword] = useState(false);

  // Conflict & disconnect dialog state
  const [conflictState, setConflictState] = useState<MegaConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [, setRelativeTick] = useState(0);

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  useEffect(() => {
    const interval = window.setInterval(() => setRelativeTick((t) => t + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      const next = getStoredMegaAuth();
      const active = hasActiveMegaSession();
      setStoredAuth(next);
      setSessionActive(active);
      if (next?.lastError) {
        setSyncStatus('error');
        setErrorMessage(next.lastError);
      } else if (next?.lastSyncedAt && active) {
        setSyncStatus((prev) => (prev === 'syncing' ? prev : 'synced'));
        setErrorMessage(null);
      }
    };
    window.addEventListener(MEGA_SYNC_STATE_EVENT, handleUpdate);
    return () => window.removeEventListener(MEGA_SYNC_STATE_EVENT, handleUpdate);
  }, []);

  // Silent re-auth within current session; marks expired on fresh app session
  useEffect(() => {
    let mounted = true;
    const existing = getStoredMegaAuth();
    if (!existing) return;

    megaSyncProvider
      .silentReAuth()
      .then((acc) => {
        if (!mounted) return;
        const active = Boolean(acc?.connected && hasActiveMegaSession());
        setSessionActive(active);
        setStoredAuth(getStoredMegaAuth());
        if (active && existing.autoSyncEnabled && existing.autoSyncIntervalMinutes > 0) {
          megaSyncProvider.setAutoSync(
            true,
            existing.autoSyncIntervalMinutes,
            getLocalAppDataObject
          );
        }
      })
      .catch(() => {
        if (mounted) setSessionActive(false);
      });

    return () => {
      mounted = false;
    };
  }, [getLocalAppDataObject]);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setFormError(null);

    const submittedPassword = passwordInput;
    try {
      const account = await megaSyncProvider.connect(emailInput, submittedPassword);
      // Immediately clear password from React state (never stored anywhere)
      setPasswordInput('');
      setEmailInput('');
      setShowPassword(false);
      setShowInlineForm(false);
      setStoredAuth(getStoredMegaAuth());
      setSessionActive(true);
      setSyncStatus('idle');
      setErrorMessage(null);
      activateSyncProviderIfNone('mega');
      showAndroidToast(`Connected MEGA as ${account.email}`, 2800, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Could not connect to MEGA.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResumeSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storedAuth?.email || isAuthenticating) return;
    setIsAuthenticating(true);
    setFormError(null);

    const submittedPassword = resumePassword;
    try {
      await megaSyncProvider.connect(storedAuth.email, submittedPassword);
      // Immediately clear password from state
      setResumePassword('');
      setShowResumePassword(false);
      const updated = getStoredMegaAuth();
      setStoredAuth(updated);
      setSessionActive(true);
      setSyncStatus(updated?.lastSyncedAt ? 'synced' : 'idle');
      setErrorMessage(null);
      if (updated?.autoSyncEnabled && updated.autoSyncIntervalMinutes > 0) {
        await megaSyncProvider.setAutoSync(
          true,
          updated.autoSyncIntervalMinutes,
          getLocalAppDataObject
        );
      }
      showAndroidToast('MEGA sync session resumed', 2600, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Could not resume MEGA session.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      let localData = getLocalAppDataObject();
      try {
        const remote = await megaSyncProvider.restore();
        if (remote.found && remote.envelope && remote.envelope.data) {
          localData = mergeDriveData(localData, remote.envelope.data);
          replaceAllAppDataFromBackup(JSON.stringify(localData));
        }
      } catch {
        // Proceed to push if no remote file exists yet
      }

      await megaSyncProvider.backup(localData);
      setStoredAuth(getStoredMegaAuth());
      setSyncStatus('synced');
      showAndroidToast('Synced with MEGA (items merged)', 2400, 'success');
    } catch (err: any) {
      const msg = err?.message || 'MEGA sync failed.';
      setSessionActive(hasActiveMegaSession());
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3200, 'error');
    }
  };

  const handleCheckRestore = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      const remote = await megaSyncProvider.restore();
      if (!remote.found || !remote.envelope) {
        setSyncStatus(storedAuth?.lastSyncedAt ? 'synced' : 'idle');
        showAndroidToast('No backup.json found in /JivanOS/ on MEGA yet.', 2800, 'default');
        return;
      }
      setConflictState({
        remoteEnvelope: remote.envelope,
        remoteLastModified: remote.lastModified || remote.envelope.updatedAt,
        remoteSizeBytes: remote.fileSizeBytes,
      });
      setSyncStatus('idle');
    } catch (err: any) {
      const msg = err?.message || 'Could not restore from MEGA.';
      setSessionActive(hasActiveMegaSession());
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3200, 'error');
    }
  };

  const handleResolveConflict = async (choice: 'restore-mega' | 'keep-device' | 'merge') => {
    if (!conflictState || isResolvingConflict) return;
    setIsResolvingConflict(true);
    setSyncStatus('syncing');
    try {
      if (choice === 'restore-mega') {
        const ok = replaceAllAppDataFromBackup(JSON.stringify(conflictState.remoteEnvelope.data));
        if (!ok) throw new Error('Backup from MEGA could not be applied.');
        showAndroidToast('Restored from MEGA backup', 2600, 'success');
      } else if (choice === 'keep-device') {
        await megaSyncProvider.backup(getLocalAppDataObject());
        showAndroidToast('Uploaded this device backup to MEGA', 2600, 'success');
      } else {
        const merged = mergeDriveData(getLocalAppDataObject(), conflictState.remoteEnvelope.data);
        const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
        if (!ok) throw new Error('Could not apply merged backup.');
        await megaSyncProvider.backup(merged);
        showAndroidToast('Merged both & uploaded to MEGA', 2600, 'success');
      }
      setConflictState(null);
      setStoredAuth(getStoredMegaAuth());
      setSyncStatus('synced');
    } catch (err: any) {
      const msg = err?.message || 'Conflict resolution failed.';
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3200, 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleSelectInterval = async (interval: AutoSyncIntervalMinutes) => {
    await megaSyncProvider.setAutoSync(interval > 0, interval, getLocalAppDataObject);
    setStoredAuth(getStoredMegaAuth());
    showAndroidToast(
      interval === 0
        ? 'MEGA sync set to Manual'
        : `MEGA auto-sync every ${interval === 60 ? '1 hr' : `${interval} min`}`,
      2200,
      'default'
    );
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    await megaSyncProvider.disconnect();
    setStoredAuth(null);
    setSessionActive(false);
    setPasswordInput('');
    setResumePassword('');
    setFormError(null);
    setErrorMessage(null);
    setSyncStatus('idle');
    showAndroidToast('Disconnected MEGA', 2400, 'default');
  };

  const isConnected = Boolean(storedAuth?.email && sessionActive);
  const isSessionExpired = Boolean(storedAuth?.email && !sessionActive);
  const activeInterval: AutoSyncIntervalMinutes =
    storedAuth?.autoSyncEnabled ? storedAuth.autoSyncIntervalMinutes : 0;

  const rowStatus = isSessionExpired
    ? 'trial'
    : !isConnected
      ? 'disconnected'
      : syncStatus === 'syncing'
        ? 'syncing'
        : syncStatus === 'error'
          ? 'error'
          : storedAuth?.lastSyncedAt
            ? 'synced'
            : 'connected';

  const metaLine = isSessionExpired
    ? 'Re-enter password to resume sync'
    : storedAuth?.lastSyncedAt
      ? `Last synced ${formatRelativeSyncTime(storedAuth.lastSyncedAt)}${
          storedAuth.lastFileSizeBytes !== null
            ? ` · ${formatDriveFileSize(storedAuth.lastFileSizeBytes)}`
            : ''
        }`
      : 'Connected · /JivanOS/backup.json';

  const inlineConnectForm = !isConnected && !isSessionExpired && showInlineForm ? (
    <form
      onSubmit={handleConnectSubmit}
      className="pt-2.5 border-t border-[#E5E7EB]/80 dark:border-zinc-800 space-y-2.5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          id="mega-email-input"
          type="email"
          required
          autoComplete="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="MEGA email"
          aria-label="MEGA email"
          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
        />
        <div className="relative">
          <input
            id="mega-password-input"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="MEGA password"
            aria-label="MEGA password"
            className="w-full h-9 pl-3 pr-9 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {formError && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1.5 text-[11.5px] text-rose-700 dark:text-rose-300">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-slate-500 dark:text-zinc-400 inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Password is never stored (session only).</span>
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            disabled={isAuthenticating}
            onClick={() => {
              setShowInlineForm(false);
              setPasswordInput('');
              setFormError(null);
            }}
            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isAuthenticating || !emailInput.trim() || !passwordInput}
            className="h-8 px-3.5 rounded-lg bg-[#D9272E] hover:bg-[#b81e24] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting…</span>
              </>
            ) : (
              <span>Connect MEGA</span>
            )}
          </button>
        </div>
      </div>
    </form>
  ) : null;

  const sessionResumeForm = isSessionExpired && storedAuth ? (
    <form
      onSubmit={handleResumeSessionSubmit}
      className="pt-2.5 border-t border-amber-200/80 dark:border-amber-900/50 space-y-2"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type={showResumePassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={resumePassword}
            onChange={(e) => setResumePassword(e.target.value)}
            placeholder={`Password for ${storedAuth.email}`}
            className="w-full h-9 pl-8 pr-9 rounded-lg border border-amber-300/80 dark:border-amber-800/80 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
          />
          <button
            type="button"
            onClick={() => setShowResumePassword((v) => !v)}
            aria-label={showResumePassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            {showResumePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          type="submit"
          disabled={isAuthenticating || !resumePassword}
          className="h-9 px-3.5 rounded-lg bg-[#D9272E] hover:bg-[#b81e24] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
        >
          {isAuthenticating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resuming…</span>
            </>
          ) : (
            <span>Resume</span>
          )}
        </button>
      </div>

      {formError && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1.5 text-[11.5px] text-rose-700 dark:text-rose-300">
          {formError}
        </div>
      )}
    </form>
  ) : null;

  return (
    <>
      <SyncProviderRow
        name="MEGA"
        description="E2E encrypted"
        logo={<MegaLogoSvg className="w-5 h-5" />}
        logoBgClass="bg-red-50 dark:bg-red-950/50"
        brandColor={isSessionExpired ? '#D97706' : MEGA_RED}
        isConnected={isConnected || isSessionExpired}
        status={rowStatus}
        statusLabel={isSessionExpired ? 'Session expired' : undefined}
        accountLabel={storedAuth?.email}
        metaLine={isConnected || isSessionExpired ? metaLine : undefined}
        connectLabel={showInlineForm ? 'Hide' : 'Connect →'}
        connectButtonId="btn-connect-mega"
        onConnect={() => {
          setFormError(null);
          setShowInlineForm((v) => !v);
        }}
        onSyncNow={isConnected ? handleSyncNow : undefined}
        onBackupNow={isConnected ? onBackupNow : undefined}
        onOpenSyncOptions={isConnected ? onOpenSyncOptions : undefined}
        onOpenBackupOptions={
          isConnected && onOpenBackupOptions
            ? () => onOpenBackupOptions(handleCheckRestore)
            : undefined
        }
        isActiveSyncProvider={isActiveSyncProvider}
        isBackupEnabled={isBackupEnabled}
        syncButtonId="btn-mega-sync-now"
        backupButtonId="btn-mega-backup"
        isSyncing={syncStatus === 'syncing'}
        isBackingUp={isBackingUp}
        onRetry={handleSyncNow}
        autoSyncInterval={activeInterval}
        onSelectInterval={isConnected ? handleSelectInterval : undefined}
        onRestore={isConnected ? handleCheckRestore : undefined}
        onDisconnect={isConnected || isSessionExpired ? () => setShowDisconnectConfirm(true) : undefined}
        errorMessage={errorMessage}
        isExpanded={Boolean(inlineConnectForm || sessionResumeForm)}
        expandedContent={inlineConnectForm || sessionResumeForm}
        isFirst={isFirst}
        isLast={isLast}
      />

      {/* Conflict Resolution Dialog */}
      {conflictState && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isResolvingConflict && setConflictState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-4"
          >
            <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-950/70 text-[#D9272E] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Newer MEGA Backup Found
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Backup in <span className="font-mono">/JivanOS/backup.json</span> from{' '}
                <span className="font-semibold">
                  {formatRelativeSyncTime(conflictState.remoteLastModified)}
                </span>{' '}
                ({formatDriveFileSize(conflictState.remoteSizeBytes)}). Choose how to sync:
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('merge')}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-full bg-[#D9272E] hover:bg-[#b81e24] text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <GitMerge className="w-4 h-4" />
                <span>Merge</span>
              </button>
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('restore-mega')}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <CloudDownload className="w-4 h-4" />
                <span>Restore from MEGA</span>
              </button>
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('keep-device')}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-full text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <Smartphone className="w-4 h-4" />
                <span>Keep Device</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation */}
      {showDisconnectConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              Disconnect MEGA?
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Your MEGA session and sync settings will be cleared from this device. Your encrypted
              backup in <span className="font-mono">/JivanOS/backup.json</span> will remain on
              MEGA.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
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
