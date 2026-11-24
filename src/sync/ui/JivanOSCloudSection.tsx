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

import {
  SyncProviderMenuItem,
  SyncProviderRow,
  SyncRowStatus,
} from '../../components/settings/SyncProviderRow';

interface CloudConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
  localLastSyncedAt: string | null;
}

export interface JivanOSCloudSectionProps {
  isFirst?: boolean;
  isLast?: boolean;
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

export const JivanOSCloudSection: React.FC<JivanOSCloudSectionProps> = ({
  isFirst = false,
  isLast = false,
}) => {
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
  const [showHistory, setShowHistory] = useState(false);
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
    setShowHistory(false);
    setSyncStatus('idle');
    setErrorMessage(null);
    showAndroidToast('Signed out of JivanOS Cloud', 2400, 'default');
  };

  const displayName =
    sub.user?.displayName ||
    (sub.user?.email ? sub.user.email.split('@')[0] : 'JivanOS Member');
  const displayEmail = sub.user?.email || '';
  const lastSyncLabel = meta.lastSyncedAt
    ? formatRelativeSyncTime(meta.lastSyncedAt) === 'Just now'
      ? 'Synced just now'
      : `Last synced ${formatRelativeSyncTime(meta.lastSyncedAt)}`
    : 'Not synced yet';

  const isSignedIn = Boolean(sub.user);
  const isUnverified = Boolean(sub.user && !sub.emailVerified);
  const isCheckingSub = Boolean(sub.user && sub.emailVerified && sub.loading);
  const isEntitled = Boolean(sub.user && sub.emailVerified && !sub.loading && sub.isPremium);
  const isExpiredOrPaywall = Boolean(
    sub.user && sub.emailVerified && !sub.loading && !sub.isPremium
  );

  // Derive compact status & label
  let rowStatus: SyncRowStatus = 'disconnected';
  let statusLabel: string | undefined;

  if (isUnverified) {
    rowStatus = 'trial';
    statusLabel = 'Verify email';
  } else if (isCheckingSub) {
    rowStatus = 'syncing';
    statusLabel = 'Checking…';
  } else if (isExpiredOrPaywall) {
    rowStatus = 'expired';
    statusLabel = 'Expired';
  } else if (isEntitled) {
    if (syncStatus === 'syncing') {
      rowStatus = 'syncing';
      statusLabel = 'Syncing…';
    } else if (syncStatus === 'error') {
      rowStatus = 'error';
      statusLabel = 'Error';
    } else if (sub.status === 'trial') {
      rowStatus = 'trial';
      statusLabel = `Trial · ${sub.trialDaysRemaining}d left`;
    } else {
      rowStatus = 'synced';
      statusLabel = 'Active ✓';
    }
  }

  // Compact metadata line when signed in
  const metaLine = isUnverified
    ? 'Verify inbox to activate 14-day free trial'
    : isCheckingSub
      ? 'Checking subscription status…'
      : isExpiredOrPaywall
        ? 'Sync paused · Your last backup is safe'
        : sub.status === 'trial'
          ? isListening
            ? `Syncing in real-time · ${lastSyncLabel}`
            : lastSyncLabel
          : `${lastSyncLabel}${isListening ? ' · Real-time live' : ''}${
              meta.lastFileSizeBytes !== null
                ? ` · ${formatDriveFileSize(meta.lastFileSizeBytes)}`
                : ''
            }`;

  // Overflow menu items for signed-in states
  const extraMenuItems: SyncProviderMenuItem[] = [];
  if (isEntitled) {
    extraMenuItems.push({
      id: 'realtime-toggle',
      label: 'Real-time sync',
      sublabel: meta.realtimeEnabled ? 'On' : 'Off',
      icon: (
        <Radio
          className={`w-3.5 h-3.5 shrink-0 ${
            isListening ? 'text-emerald-500' : 'text-slate-400'
          }`}
        />
      ),
      onClick: handleToggleRealtime,
    });
    if (history.length > 0) {
      extraMenuItems.push({
        id: 'sync-history',
        label: showHistory ? 'Hide recent syncs' : 'Recent cloud syncs',
        icon: <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
        onClick: () => setShowHistory((v) => !v),
      });
    }
    extraMenuItems.push({
      id: 'manage-sub',
      label: sub.status === 'trial' ? 'Upgrade (₹99/mo · ₹499/yr)' : 'Manage Subscription',
      icon: <ExternalLink className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400 shrink-0" />,
      href: JIVANOS_SUBSCRIBE_URL,
      onClick: () => {},
    });
  }

  // Compact expandable content for unverified / expired / optional history drawer
  let expandedContent: React.ReactNode = null;
  if (isUnverified) {
    expandedContent = (
      <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/50 flex flex-wrap items-center gap-2">
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
          className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
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
          className="h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition cursor-pointer"
        >
          Resend Email
        </button>
      </div>
    );
  } else if (isExpiredOrPaywall) {
    expandedContent = (
      <div className="pt-2 border-t border-rose-200/80 dark:border-rose-900/50 flex flex-wrap items-center gap-2">
        <a
          href={JIVANOS_SUBSCRIBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>Renew — ₹99/mo</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          disabled={isExportingLastBackup}
          onClick={handleExportLastBackup}
          className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          <Download className="w-3 h-3" />
          <span>{isExportingLastBackup ? 'Exporting…' : 'Export last backup'}</span>
        </button>
      </div>
    );
  } else if (isEntitled && showHistory && history.length > 0) {
    expandedContent = (
      <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/50 space-y-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-zinc-400">
          Recent Cloud Syncs
        </div>
        <div className="divide-y divide-slate-200/60 dark:divide-zinc-800/70">
          {history.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="py-1 flex items-center justify-between gap-2 text-[11.5px]"
            >
              <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">
                {item.deviceName}
              </span>
              <span className="text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
                {formatRelativeSyncTime(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <SyncProviderRow
        name="JivanOS Cloud"
        description="Real-time sync · 14-day free trial"
        extraLine={!isSignedIn ? '₹99/month · ₹499/year' : undefined}
        badge={
          !isSignedIn ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-300 shrink-0">
              Premium
            </span>
          ) : undefined
        }
        logo={<JivanOSMark className="w-4.5 h-4.5 text-[#4F46E5] dark:text-indigo-300" />}
        logoBgClass="bg-indigo-100/80 dark:bg-indigo-950/70"
        brandColor={isExpiredOrPaywall ? '#E11D48' : '#4F46E5'}
        isConnected={isSignedIn}
        prominent={!isSignedIn}
        status={rowStatus}
        statusLabel={statusLabel}
        accountLabel={isSignedIn ? displayEmail || displayName : undefined}
        metaLine={isSignedIn ? metaLine : undefined}
        disconnectedActions={
          !isSignedIn ? (
            <>
              <button
                type="button"
                id="btn-jivanos-cloud-start-trial"
                onClick={() => handleOpenAuthSheet('trial')}
                className="h-8 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.98] text-white text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Start Free Trial</span>
              </button>
              <button
                type="button"
                id="btn-jivanos-cloud-signin"
                onClick={() => handleOpenAuthSheet('signin')}
                className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-indigo-700 dark:text-indigo-300 transition cursor-pointer whitespace-nowrap"
              >
                Sign In
              </button>
            </>
          ) : undefined
        }
        onSyncNow={isEntitled ? handleSyncNow : undefined}
        syncButtonId="btn-jivanos-cloud-sync-now"
        isSyncing={syncStatus === 'syncing'}
        onRetry={isEntitled ? handleSyncNow : undefined}
        extraMenuItems={extraMenuItems}
        onDisconnect={isSignedIn ? handleSignOut : undefined}
        disconnectLabel="Sign Out"
        errorMessage={errorMessage}
        isExpanded={Boolean(expandedContent)}
        expandedContent={expandedContent}
        isFirst={isFirst}
        isLast={isLast}
      />

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
