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

const MEGA_RED = '#D9272E';

const INTERVAL_OPTIONS: { label: string; value: AutoSyncIntervalMinutes }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: 'Manual', value: 0 },
];

interface MegaConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
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

export const MEGASyncSection: React.FC = () => {
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
      const localLastSyncedAt = getStoredMegaAuth()?.lastSyncedAt || null;
      const remoteInfo = await megaSyncProvider.getLastSyncInfo();

      if (remoteInfo && isRemoteNewerThanLocal(remoteInfo.lastModified, localLastSyncedAt)) {
        const remote = await megaSyncProvider.restore();
        if (remote.found && remote.envelope) {
          setConflictState({
            remoteEnvelope: remote.envelope,
            remoteLastModified: remote.lastModified || remote.envelope.updatedAt,
            remoteSizeBytes: remote.fileSizeBytes,
          });
          setSyncStatus('idle');
          return;
        }
      }

      const localData = getLocalAppDataObject();
      await megaSyncProvider.backup(localData);
      setStoredAuth(getStoredMegaAuth());
      setSyncStatus('synced');
      showAndroidToast('Encrypted backup synced to MEGA', 2600, 'success');
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

  const handleToggleAutoSync = async (nextEnabled: boolean) => {
    if (!storedAuth) return;
    const nextInterval: AutoSyncIntervalMinutes = nextEnabled
      ? storedAuth.autoSyncIntervalMinutes > 0
        ? storedAuth.autoSyncIntervalMinutes
        : 30
      : 0;
    await megaSyncProvider.setAutoSync(nextEnabled, nextInterval, getLocalAppDataObject);
    setStoredAuth(getStoredMegaAuth());
  };

  const handleSelectInterval = async (interval: AutoSyncIntervalMinutes) => {
    await megaSyncProvider.setAutoSync(interval > 0, interval, getLocalAppDataObject);
    setStoredAuth(getStoredMegaAuth());
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

  return (
    <>
      <section
        aria-label="MEGA"
        style={
          isConnected
            ? { borderLeftWidth: 3, borderLeftColor: MEGA_RED }
            : isSessionExpired
              ? { borderLeftWidth: 3, borderLeftColor: '#D97706' }
              : undefined
        }
        className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4 w-full min-w-0"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0">
              <MegaLogoSvg className="w-6 h-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                  MEGA
                </h3>

                {isConnected && storedAuth && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/70 text-[#D9272E] dark:text-red-300 max-w-full truncate">
                    {storedAuth.email}
                  </span>
                )}

                {isSessionExpired && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                    Session expired
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {isConnected && storedAuth
                  ? `Connected · 20 GB free · ${
                      storedAuth.lastSyncedAt
                        ? `Last synced ${formatRelativeSyncTime(storedAuth.lastSyncedAt)}`
                        : 'Ready for first backup'
                    }`
                  : isSessionExpired && storedAuth
                    ? `${storedAuth.email} · 20 GB free · End-to-end encrypted`
                    : '20 GB free · End-to-end encrypted by default'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {!isConnected && !isSessionExpired ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                Not connected
              </span>
            ) : isConnected && syncStatus === 'syncing' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#D9272E] text-white animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing…</span>
              </span>
            ) : isConnected && syncStatus === 'synced' && storedAuth?.lastSyncedAt ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white">
                <Check className="w-3.5 h-3.5" />
                <span>Synced</span>
              </span>
            ) : isConnected && syncStatus === 'error' ? (
              <button
                type="button"
                onClick={handleSyncNow}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                title="Tap to retry"
              >
                <X className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* 1. Disconnected State */}
        {!isConnected && !isSessionExpired && (
          <div className="space-y-3">
            {!showInlineForm ? (
              <button
                type="button"
                id="btn-connect-mega"
                onClick={() => {
                  setFormError(null);
                  setShowInlineForm(true);
                }}
                className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-full border-2 border-[#D9272E] text-[#D9272E] dark:text-red-400 dark:border-red-500/80 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.99] text-sm font-semibold transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <MegaLogoSvg className="w-4.5 h-4.5" />
                <span>Connect MEGA</span>
              </button>
            ) : (
              <form
                onSubmit={handleConnectSubmit}
                className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="mega-email-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    Email
                  </label>
                  <input
                    id="mega-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="mega-password-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="mega-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter your MEGA password"
                      className="w-full min-h-[46px] pl-3.5 pr-11 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    {formError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={() => {
                      setShowInlineForm(false);
                      setPasswordInput('');
                      setFormError(null);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticating || !emailInput.trim() || !passwordInput}
                    className="min-h-[44px] px-5 py-2 rounded-full bg-[#D9272E] hover:bg-[#b81e24] disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting…</span>
                      </>
                    ) : (
                      <span>Connect MEGA</span>
                    )}
                  </button>
                </div>

                <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 flex items-start gap-1.5 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Your password is never stored. You&apos;ll enter it once per app session.
                  </span>
                </p>
              </form>
            )}
          </div>
        )}

        {/* 2. Session Expired State (New App Session) */}
        {isSessionExpired && storedAuth && (
          <form
            onSubmit={handleResumeSessionSubmit}
            className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-3"
          >
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Re-enter your MEGA password to resume sync
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  MEGA requires your password each session for end-to-end encryption. It is never
                  stored.
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type={showResumePassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={resumePassword}
                onChange={(e) => setResumePassword(e.target.value)}
                placeholder={`Password for ${storedAuth.email}`}
                className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-white dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#D9272E]"
              />
              <button
                type="button"
                onClick={() => setShowResumePassword((v) => !v)}
                aria-label={showResumePassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                {showResumePassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>

              <button
                type="submit"
                disabled={isAuthenticating || !resumePassword}
                className="min-h-[42px] px-5 py-2 rounded-full bg-[#D9272E] hover:bg-[#b81e24] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center gap-2 cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resuming…</span>
                  </>
                ) : (
                  <span>Resume Sync</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* 3. Connected State */}
        {isConnected && storedAuth && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 p-3.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">/JivanOS/backup.json · End-to-end encrypted</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span>
                    {storedAuth.lastSyncedAt
                      ? `Last synced ${formatRelativeSyncTime(storedAuth.lastSyncedAt)}`
                      : 'Not backed up yet'}
                  </span>
                  {storedAuth.lastFileSizeBytes !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatDriveFileSize(storedAuth.lastFileSizeBytes)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCheckRestore}
                  disabled={syncStatus === 'syncing'}
                  className="min-h-[40px] px-3.5 py-2 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  Restore
                </button>
                <button
                  type="button"
                  id="btn-mega-sync-now"
                  onClick={handleSyncNow}
                  disabled={syncStatus === 'syncing'}
                  className="min-h-[40px] px-4 py-2 rounded-full bg-[#D9272E] hover:bg-[#b81e24] active:scale-95 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/35 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Auto-sync toggle + segmented interval */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Auto-sync to MEGA
                </span>
                <M3Switch
                  checked={storedAuth.autoSyncEnabled}
                  onChange={handleToggleAutoSync}
                />
              </div>

              <div className="grid grid-cols-4 rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 p-1 gap-1">
                {INTERVAL_OPTIONS.map((opt) => {
                  const selected =
                    (storedAuth.autoSyncEnabled ? storedAuth.autoSyncIntervalMinutes : 0) ===
                    opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectInterval(opt.value)}
                      className={`min-h-[34px] rounded-full text-xs font-semibold transition cursor-pointer ${
                        selected
                          ? 'bg-[#D9272E] text-white shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </section>

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
