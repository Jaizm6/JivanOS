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
  ExternalLink,
  Download,
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  History,
  Radio,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../../components/common/AndroidToast';
import { resendEmailVerification } from '../../lib/firebase';
import {
  DriveBackupEnvelope,
  computeInitials,
  formatDriveFileSize,
  formatRelativeSyncTime,
  isRemoteNewerThanLocal,
  mergeDriveData,
} from '../../utils/googleDriveSync';
import {
  JIVANOS_SUBSCRIBE_URL,
  useSubscription,
} from '../hooks/useSubscription';
import {
  CloudSyncHistoryItem,
  JIVANOS_CLOUD_STATE_EVENT,
  StoredJivanCloudMeta,
  firestoreSyncProvider,
  getStoredCloudMeta,
  updateStoredCloudMeta,
} from '../providers/FirestoreSyncProvider';

interface CloudConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
  localLastSyncedAt: string | null;
}

const JivanOSMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path
      d="M12 2.75L4.5 6.8v6.1c0 4.3 3.15 7.75 7.5 8.85 4.35-1.1 7.5-4.55 7.5-8.85V6.8L12 2.75z"
      fill="currentColor"
      fillOpacity="0.16"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M9.2 12.2l2 2.1 3.8-4.2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GoogleLogoSmall: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export const JivanOSCloudSection: React.FC = () => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();
  const sub = useSubscription();

  const [meta, setMeta] = useState<StoredJivanCloudMeta>(() => getStoredCloudMeta());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'syncing' | 'error'>(() => {
    const initial = getStoredCloudMeta();
    if (initial.lastError) return 'error';
    if (initial.lastSyncedAt) return 'synced';
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(() => getStoredCloudMeta().lastError);
  const [isListening, setIsListening] = useState<boolean>(
    () => firestoreSyncProvider.isListeningRealtime
  );
  const [history, setHistory] = useState<CloudSyncHistoryItem[]>([]);
  const [conflictState, setConflictState] = useState<CloudConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [isExportingLastBackup, setIsExportingLastBackup] = useState(false);

  // Auth Sheet state (Google + Email/Password)
  const [authSheetMode, setAuthSheetMode] = useState<'trial' | 'signin' | null>(null);
  const [emailTab, setEmailTab] = useState<'signin' | 'signup'>('signup');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSheetError, setAuthSheetError] = useState<string | null>(null);
  const [, setRelativeTick] = useState(0);

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const interval = window.setInterval(() => setRelativeTick((t) => t + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Sync local metadata state when provider emits updates
  useEffect(() => {
    const onStateUpdate = () => {
      const next = getStoredCloudMeta();
      setMeta(next);
      setIsListening(firestoreSyncProvider.isListeningRealtime);
      if (next.lastError) {
        setSyncStatus('error');
        setErrorMessage(next.lastError);
      } else if (next.lastSyncedAt) {
        setSyncStatus((prev) => (prev === 'syncing' ? prev : 'synced'));
        setErrorMessage(null);
      }
    };
    window.addEventListener(JIVANOS_CLOUD_STATE_EVENT, onStateUpdate);
    return () => window.removeEventListener(JIVANOS_CLOUD_STATE_EVENT, onStateUpdate);
  }, []);

  const refreshSyncHistory = useCallback(async () => {
    try {
      const items = await firestoreSyncProvider.syncHistory();
      setHistory(items);
    } catch {
      // Keep previous history if offline
    }
  }, []);

  // Attach real-time onSnapshot listener when user is entitled (active or trial)
  useEffect(() => {
    if (!sub.user || !sub.emailVerified || !sub.isPremium) {
      firestoreSyncProvider.stopRealtimeListener();
      setIsListening(false);
      return;
    }

    let mounted = true;
    firestoreSyncProvider.silentReAuth().catch(() => {});
    firestoreSyncProvider.getLastSyncInfo().catch(() => {});
    refreshSyncHistory();

    if (meta.realtimeEnabled) {
      firestoreSyncProvider
        .setAutoSync(true, 15)
        .then(() => {
          if (mounted) setIsListening(firestoreSyncProvider.isListeningRealtime);
        })
        .catch(() => {});
    }

    const unsubRemote = firestoreSyncProvider.onRemoteChange((remoteResult) => {
      if (!mounted || !remoteResult.found || !remoteResult.envelope) return;
      const localData = getLocalAppDataObject();
      const merged = mergeDriveData(localData, remoteResult.envelope.data);
      const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
      if (ok) {
        setSyncStatus('synced');
        refreshSyncHistory();
        showAndroidToast('Synced live update from another device', 2600, 'success');
      }
    });

    return () => {
      mounted = false;
      unsubRemote();
    };
  }, [
    sub.user?.uid,
    sub.emailVerified,
    sub.isPremium,
    meta.realtimeEnabled,
    getLocalAppDataObject,
    replaceAllAppDataFromBackup,
    refreshSyncHistory,
  ]);

  const handleOpenAuthSheet = (mode: 'trial' | 'signin') => {
    setAuthSheetError(null);
    setEmailTab(mode === 'trial' ? 'signup' : 'signin');
    setAuthSheetMode(mode);
  };

  const handleGoogleConnect = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthSheetError(null);
    try {
      await firestoreSyncProvider.connect({ method: 'google' });
      setAuthSheetMode(null);
      showAndroidToast('Signed in to JivanOS Cloud', 2600, 'success');
      await refreshSyncHistory();
    } catch (err: any) {
      setAuthSheetError(err?.message || 'Google sign-in failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthSheetError(null);
    try {
      await firestoreSyncProvider.connect({
        method: emailTab === 'signup' ? 'email-signup' : 'email-signin',
        email: emailInput,
        password: passwordInput,
        displayName: nameInput,
      });
      setAuthSheetMode(null);
      setPasswordInput('');
      if (emailTab === 'signup') {
        showAndroidToast('Account created! Check your email to verify & activate trial.', 4000, 'success');
      } else {
        showAndroidToast('Signed in to JivanOS Cloud', 2600, 'success');
      }
      await refreshSyncHistory();
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/email-already-in-use') {
        setAuthSheetError('An account with this email already exists. Switch to Sign In.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setAuthSheetError('Incorrect email or password.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthSheetError(
          'Email/Password sign-in is not yet enabled in Firebase Console. Use Google Sign-In or enable Email/Password under Authentication → Sign-in method.'
        );
      } else {
        setAuthSheetError(err?.message || 'Authentication failed.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      const localLastSyncedAt = getStoredCloudMeta().lastSyncedAt;
      const remote = await firestoreSyncProvider.restore();

      if (remote.found && remote.envelope) {
        const remoteLastModified = remote.lastModified || remote.envelope.updatedAt;
        const remoteIsNewer = isRemoteNewerThanLocal(remoteLastModified, localLastSyncedAt);
        if (remoteIsNewer) {
          setConflictState({
            remoteEnvelope: remote.envelope,
            remoteLastModified,
            remoteSizeBytes: remote.fileSizeBytes,
            localLastSyncedAt,
          });
          setSyncStatus('idle');
          return;
        }
      }

      const localData = getLocalAppDataObject();
      await firestoreSyncProvider.backup(localData);
      setMeta(getStoredCloudMeta());
      setSyncStatus('synced');
      await refreshSyncHistory();
      showAndroidToast('Synced to JivanOS Cloud', 2400, 'success');
    } catch (err: any) {
      const msg = err?.message || 'JivanOS Cloud sync failed.';
      updateStoredCloudMeta({ lastError: msg });
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3200, 'error');
    }
  };

  const handleResolveConflict = async (choice: 'restore-cloud' | 'keep-device' | 'merge-both') => {
    if (!conflictState || isResolvingConflict) return;
    setIsResolvingConflict(true);
    setSyncStatus('syncing');
    try {
      if (choice === 'restore-cloud') {
        const ok = replaceAllAppDataFromBackup(JSON.stringify(conflictState.remoteEnvelope.data));
        if (!ok) throw new Error('Cloud backup could not be applied.');
        updateStoredCloudMeta({
          lastSyncedAt: conflictState.remoteLastModified,
          lastFileSizeBytes: conflictState.remoteSizeBytes,
          lastError: null,
        });
        showAndroidToast('Restored from JivanOS Cloud', 2600, 'success');
      } else if (choice === 'keep-device') {
        const localData = getLocalAppDataObject();
        await firestoreSyncProvider.backup(localData);
        showAndroidToast('Kept this device & updated Cloud', 2600, 'success');
      } else {
        const localData = getLocalAppDataObject();
        const merged = mergeDriveData(localData, conflictState.remoteEnvelope.data);
        const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
        if (!ok) throw new Error('Could not apply merged data.');
        await firestoreSyncProvider.backup(merged);
        showAndroidToast('Merged both devices & synced', 2600, 'success');
      }
      setConflictState(null);
      setMeta(getStoredCloudMeta());
      setSyncStatus('synced');
      await refreshSyncHistory();
    } catch (err: any) {
      const msg = err?.message || 'Conflict resolution failed.';
      setSyncStatus('error');
      setErrorMessage(msg);
      showAndroidToast(msg, 3200, 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleToggleRealtime = async () => {
    const nextEnabled = !meta.realtimeEnabled;
    await firestoreSyncProvider.setAutoSync(nextEnabled, 15);
    setMeta(getStoredCloudMeta());
    setIsListening(firestoreSyncProvider.isListeningRealtime);
    showAndroidToast(
      nextEnabled ? 'Real-time cloud sync enabled' : 'Real-time cloud sync paused',
      2200,
      'default'
    );
  };

  const handleExportLastBackup = async () => {
    if (isExportingLastBackup) return;
    setIsExportingLastBackup(true);
    try {
      const res = await firestoreSyncProvider.restore();
      if (!res.found || !res.envelope) {
        showAndroidToast('No saved JivanOS Cloud backup found to export.', 3000, 'error');
        return;
      }
      const jsonStr = JSON.stringify(res.envelope.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JivanOS-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAndroidToast('Last cloud backup exported', 2600, 'success');
    } catch (err: any) {
      showAndroidToast(err?.message || 'Could not export last backup.', 3200, 'error');
    } finally {
      setIsExportingLastBackup(false);
    }
  };

  const handleSignOut = async () => {
    await firestoreSyncProvider.disconnect();
    setHistory([]);
    setSyncStatus('idle');
    setErrorMessage(null);
    showAndroidToast('Signed out of JivanOS Cloud', 2400, 'default');
  };

  const displayName =
    sub.user?.displayName ||
    (sub.user?.email ? sub.user.email.split('@')[0] : 'JivanOS Member');
  const displayEmail = sub.user?.email || '';
  const initials = computeInitials(displayName, displayEmail);
  const lastSyncLabel = meta.lastSyncedAt
    ? formatRelativeSyncTime(meta.lastSyncedAt) === 'Just now'
      ? 'Synced just now'
      : `Last synced ${formatRelativeSyncTime(meta.lastSyncedAt)}`
    : 'Not synced yet';

  return (
    <>
      <section
        aria-label="JivanOS Cloud"
        style={
          sub.user && sub.emailVerified
            ? { borderLeftWidth: 3, borderLeftColor: '#4F46E5' }
            : undefined
        }
        className="rounded-3xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4 w-full min-w-0"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-[#4F46E5] text-white flex items-center justify-center shrink-0 relative">
              <JivanOSMark className="w-5 h-5" />
              <Cloud className="w-3.5 h-3.5 absolute -bottom-1 -right-1 text-[#4F46E5] dark:text-indigo-300 bg-white dark:bg-zinc-900 rounded-full p-0.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                  JivanOS Cloud
                </h3>

                {/* Tier Status Chips */}
                {!sub.user && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300">
                    Premium · ₹99/month
                  </span>
                )}
                {sub.user && sub.emailVerified && sub.status === 'active' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white">
                    <Check className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                )}
                {sub.user && sub.emailVerified && sub.status === 'trial' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                    <Sparkles className="w-3 h-3" />
                    <span>Trial</span>
                  </span>
                )}
                {sub.user && sub.emailVerified && sub.status === 'expired' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-rose-600 text-white">
                    <X className="w-3 h-3" />
                    <span>Expired</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Real-time encrypted sync across all your devices
              </p>
            </div>
          </div>

          {/* Live Sync Status Chip */}
          <div className="shrink-0">
            {!sub.user ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                Not connected
              </span>
            ) : sub.user && sub.emailVerified && sub.isPremium ? (
              <>
                {syncStatus === 'syncing' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing…</span>
                  </span>
                )}
                {syncStatus === 'synced' && meta.lastSyncedAt && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white">
                    <Check className="w-3.5 h-3.5" />
                    <span>Synced ✓</span>
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 text-white">
                    <X className="w-3.5 h-3.5" />
                    <span>Error ✗</span>
                  </span>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* STATE 1: NOT SIGNED IN */}
        {!sub.user && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-100 dark:border-indigo-900/60">
                Real-time sync
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium border border-amber-200/70 dark:border-amber-900/60">
                14-day free trial
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium border border-slate-200/80 dark:border-zinc-700">
                ₹99/month · ₹499/year
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                id="btn-jivanos-cloud-start-trial"
                onClick={() => handleOpenAuthSheet('trial')}
                className="min-h-[48px] px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Cloud className="w-4 h-4 shrink-0" />
                <span>Start Free Trial</span>
              </button>

              <button
                type="button"
                id="btn-jivanos-cloud-signin"
                onClick={() => handleOpenAuthSheet('signin')}
                className="min-h-[44px] px-4 py-2.5 rounded-full text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer whitespace-nowrap"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* STATE 1B: SIGNED IN WITH UNVERIFIED EMAIL */}
        {sub.user && !sub.emailVerified && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Verify your email to activate your 14-day free trial
            </div>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              We sent a verification link to <span className="font-semibold">{displayEmail}</span>.
              Verify your inbox, then tap &ldquo;I&rsquo;ve Verified&rdquo;.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const verified = await sub.refreshUserVerification();
                  if (verified) {
                    showAndroidToast('Email verified! Activating JivanOS Cloud...', 2600, 'success');
                  } else {
                    showAndroidToast('Still waiting for email verification.', 2600, 'default');
                  }
                }}
                className="min-h-[40px] px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                I&rsquo;ve Verified
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendEmailVerification();
                    showAndroidToast('Verification email resent', 2400, 'success');
                  } catch (err: any) {
                    showAndroidToast(err?.message || 'Could not resend email.', 2800, 'error');
                  }
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-3.5 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ml-auto"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* LOADING SUBSCRIPTION STATE */}
        {sub.user && sub.emailVerified && sub.loading && (
          <div className="py-5 text-center text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Checking JivanOS Cloud subscription status…</span>
          </div>
        )}

        {/* STATE 2 & 3: TRIAL ACTIVE OR SUBSCRIBED ACTIVE */}
        {sub.user && sub.emailVerified && !sub.loading && sub.isPremium && (
          <div className="space-y-4">
            {/* Trial Days Remaining Banner */}
            {sub.status === 'trial' && (
              <div className="rounded-2xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/35 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">
                  {sub.trialDaysRemaining}{' '}
                  {sub.trialDaysRemaining === 1 ? 'day' : 'days'} remaining in trial
                </span>
                <span className="text-amber-700 dark:text-amber-300/90">All sync features unlocked</span>
              </div>
            )}

            {/* User Account Bar + Sync Now */}
            <div className="rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {sub.user.photoURL ? (
                  <img
                    src={sub.user.photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {displayEmail}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 tabular-nums flex-wrap">
                    <span>{lastSyncLabel}</span>
                    {meta.lastFileSizeBytes !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatDriveFileSize(meta.lastFileSizeBytes)}</span>
                      </>
                    )}
                    {isListening && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Live</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-jivanos-cloud-sync-now"
                onClick={handleSyncNow}
                disabled={syncStatus === 'syncing'}
                title="Sync Now"
                aria-label="Sync Now"
                className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 text-white flex items-center justify-center shrink-0 shadow-xs transition cursor-pointer"
              >
                <RefreshCw className={`w-4.5 h-4.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Real-time Sync Toggle */}
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio
                  className={`w-4 h-4 shrink-0 ${
                    isListening ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Real-time cross-device sync
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {isListening
                      ? 'Listening live via Firestore across your devices'
                      : 'Paused — tap Sync Now to sync manually'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={meta.realtimeEnabled}
                onClick={handleToggleRealtime}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  meta.realtimeEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                    meta.realtimeEnabled ? 'translate-x-5.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Sync History (last 3 entries) */}
            {history.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  <History className="w-3.5 h-3.5" />
                  <span>Recent Cloud Syncs</span>
                </div>
                <div className="divide-y divide-slate-200/60 dark:divide-zinc-800/80">
                  {history.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">
                        {item.deviceName}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
                        {formatRelativeSyncTime(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/35 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Upgrade Card (Trial State Only) */}
            {sub.status === 'trial' && (
              <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-indigo-950 dark:text-indigo-100">
                    Upgrade to keep syncing
                  </div>
                  <div className="text-[11px] text-indigo-700/90 dark:text-indigo-300/90 mt-0.5">
                    ₹99/month or ₹499/year (save 58%) · Instant multi-device cloud sync
                  </div>
                </div>
                <a
                  href={JIVANOS_SUBSCRIBE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0 whitespace-nowrap"
                >
                  <span>Upgrade</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <a
                href={JIVANOS_SUBSCRIBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                <span>Manage Subscription</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: EXPIRED OR NON-PREMIUM PAYWALL */}
        {sub.user && sub.emailVerified && !sub.loading && !sub.isPremium && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-4 space-y-2">
              <div className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                {sub.status === 'expired'
                  ? 'Your subscription ended. Your last backup is safe.'
                  : 'JivanOS Cloud is a premium feature'}
              </div>
              <p className="text-xs text-rose-800/85 dark:text-rose-300/85 leading-relaxed">
                Unlock instant real-time Firestore sync across Android, Web, and Desktop for{' '}
                <span className="font-semibold">₹99/month</span> or{' '}
                <span className="font-semibold">₹499/year</span>. Syncing is paused, but you can
                still export your last cloud backup anytime.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={JIVANOS_SUBSCRIBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span>Renew — ₹99/month</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                disabled={isExportingLastBackup}
                onClick={handleExportLastBackup}
                className="min-h-[46px] px-5 py-2.5 rounded-full bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 text-sm font-semibold transition inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingLastBackup ? 'Exporting…' : 'Export last backup'}</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-3 py-2 rounded-full text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer ml-auto"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sign-In / Free Trial Sheet (Google + Email/Password) */}
      {authSheetMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="jivanos-cloud-auth-title"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !isAuthenticating && setAuthSheetMode(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[420px] rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="jivanos-cloud-auth-title"
                  className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
                >
                  {authSheetMode === 'trial'
                    ? 'Start Your 14-Day Free Trial'
                    : 'Sign In to JivanOS Cloud'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {authSheetMode === 'trial'
                    ? 'No credit card required · ₹99/month or ₹499/year after trial'
                    : 'Access your real-time JivanOS Cloud sync'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isAuthenticating && setAuthSheetMode(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={isAuthenticating}
              onClick={handleGoogleConnect}
              className="w-full min-h-[48px] px-4 py-3 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 text-sm font-semibold shadow-2xs transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <GoogleLogoSmall />
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
              <span>or use Email &amp; Password</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
            </div>

            <div className="grid grid-cols-2 rounded-full bg-slate-100 dark:bg-zinc-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setEmailTab('signup');
                  setAuthSheetError(null);
                }}
                className={`py-2 rounded-full transition cursor-pointer ${
                  emailTab === 'signup'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailTab('signin');
                  setAuthSheetError(null);
                }}
                className={`py-2 rounded-full transition cursor-pointer ${
                  emailTab === 'signin'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {emailTab === 'signup' && (
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                />
              )}

              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email address"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password (min 6 characters)"
                  className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authSheetError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                  {authSheetError}
                </p>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full min-h-[48px] px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {isAuthenticating
                  ? 'Please wait…'
                  : emailTab === 'signup'
                  ? 'Create Account & Start Trial'
                  : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Resolution Dialog (Restore from Cloud / Keep This Device / Merge Both) */}
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
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Newer Cloud Backup Found
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                JivanOS Cloud was updated{' '}
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
                onClick={() => handleResolveConflict('merge-both')}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <GitMerge className="w-4 h-4" />
                <span>Merge Both (Recommended)</span>
              </button>

              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('restore-cloud')}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <CloudDownload className="w-4 h-4" />
                <span>Restore from Cloud</span>
              </button>

              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('keep-device')}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-full text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <Smartphone className="w-4 h-4" />
                <span>Keep This Device</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
