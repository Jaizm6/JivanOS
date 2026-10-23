import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Laptop,
  User,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  UploadCloud,
  DownloadCloud,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { TaskSyncDiagnosticPanel } from '../../tasks/TaskSyncDiagnosticPanel';

export const SyncStatusWidget: React.FC = () => {
  const {
    syncStatus,
    lastSyncTime,
    syncWithCloud,
    restoreCloudBackup,
    userProfile,
    firebaseUser,
    loginWithGoogle,
    isOnline,
    tasks,
    medications,
    journalEntries,
    habits,
    bills,
    pushNotification,
    setIsAuthModalOpen,
  } = useApp();

  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [isRestoringManual, setIsRestoringManual] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update relative time every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Never synced';
    try {
      const date = new Date(isoString);
      const diffMs = currentTime - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 10) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const formatExactTime = (isoString?: string | null) => {
    if (!isoString) return 'Not recorded';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleManualPush = async () => {
    try {
      setIsSyncingManual(true);
      await syncWithCloud();
      pushNotification('Cloud Sync Complete', 'All tasks, meds, journal & profile saved to Firestore.', 'system');
    } catch (e: any) {
      pushNotification('Sync Failed', e?.message || 'Could not sync to cloud.', 'system');
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleManualPull = async () => {
    try {
      setIsRestoringManual(true);
      const ok = await restoreCloudBackup();
      if (ok) {
        pushNotification('Sync Restored', 'Latest data successfully pulled from cloud Firestore.', 'system');
      } else {
        pushNotification('Restore Info', 'No newer remote snapshot found or already up-to-date.', 'system');
      }
    } catch (e: any) {
      pushNotification('Pull Failed', e?.message || 'Could not retrieve cloud data.', 'system');
    } finally {
      setIsRestoringManual(false);
    }
  };

  const handleCopyAppUrl = async () => {
    try {
      const appUrl = window.location.origin;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = appUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      pushNotification('URL Copied', 'App web URL copied to clipboard. Open this on your Android phone.', 'system');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setIsCopied(true);
      pushNotification('App URL', window.location.origin, 'system');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const isBusy = syncStatus === 'syncing' || isSyncingManual || isRestoringManual;

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-md transition-all">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0">
            <Cloud className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] sm:text-[13px] font-bold text-slate-900 dark:text-white tracking-tight">
                Cloud & Cross-Platform Sync Status
              </span>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                  !isOnline
                    ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    : isBusy
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    : syncStatus === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !isOnline
                      ? 'bg-slate-400'
                      : isBusy
                      ? 'bg-amber-500 animate-ping'
                      : syncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span>
                  {!isOnline
                    ? 'Offline'
                    : isBusy
                    ? 'Syncing...'
                    : syncStatus === 'error'
                    ? 'Sync Warning'
                    : 'Real-time Synced'}
                </span>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              Live Firestore persistence & instant device pairing across PC & Android
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleManualPush}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Push current local tasks, meds, and profile data to Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAndroidGuide(!showAndroidGuide)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition active:scale-95 cursor-pointer"
            title="Mobile APK & Device Setup Guide"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Android & Mobile Guide</span>
            {showAndroidGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Info Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
        {/* 1. Firestore Cloud Database Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-750 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <Database className="w-4 h-4" />
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Firestore Cloud DB
                </span>
              </div>
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold">
                Live Listener Active
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Last Cloud Sync:
                </span>
                <span className="font-bold text-slate-900 dark:text-white" title={formatExactTime(lastSyncTime)}>
                  {formatRelativeTime(lastSyncTime)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Exact Timestamp:</span>
                <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={lastSyncTime || ''}>
                  {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Database Name:</span>
                <span className="font-mono text-[9.5px] text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]" title="ai-studio-remixremixomnili-9010b5de-bad6-48f4-8e1f-5c9740929002">
                  omnili-9010b5de
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handleManualPull}
              disabled={isBusy}
              className="text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className="w-3 h-3" />
              <span>Pull Latest from Cloud</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDiagnosticModal(true)}
              className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Diagnostics
            </button>
          </div>
        </div>

        {/* 2. User Profile & Identity Sync Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-750 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <User className="w-4 h-4" />
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  User Profile Sync
                </span>
              </div>
              {firebaseUser ? (
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Google Auth
                </span>
              ) : (
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold">
                  Local Session
                </span>
              )}
            </div>

            {/* Profile Avatar & Details */}
            <div className="flex items-center gap-2.5 py-1">
              {userProfile?.avatarPhoto ? (
                <img
                  src={userProfile.avatarPhoto}
                  alt={userProfile?.name || 'User'}
                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs text-sm">
                  {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userProfile?.name || 'OmniLife User'}
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate font-mono">
                  {firebaseUser?.email || userProfile?.email || userProfile?.identifier || 'jaiprakashog@gmail.com'}
                </p>
              </div>
            </div>

            <div className="space-y-1 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Profile Synced:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200" title={formatExactTime(userProfile?.lastSyncedAt || lastSyncTime)}>
                  {formatRelativeTime(userProfile?.lastSyncedAt || lastSyncTime)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Avatar State:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {userProfile?.avatarPhoto ? 'Photo Synced' : 'Default Avatar'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            {!firebaseUser ? (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Sign in with Google</span>
              </button>
            ) : (
              <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Account Verified</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Account Settings
            </button>
          </div>
        </div>

        {/* 3. Cross-Platform Snapshot Counts */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-750 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <div className="flex items-center -space-x-1">
                  <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                  <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Synced Modules
                </span>
              </div>
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold">
                Unified Snapshot
              </span>
            </div>

            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 pb-1.5">
              These items are saved together so PC and Mobile show identical data:
            </p>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Tasks:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{(tasks || []).length}</span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Meds:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{(medications || []).length}</span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Journal:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{(journalEntries || []).length}</span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Habits & Bills:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{((habits || []).length) + ((bills || []).length)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyAppUrl}
              className="text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{isCopied ? 'Link Copied!' : 'Copy Mobile Link'}</span>
            </button>
            <span className="text-[10px] text-slate-400">PWA Ready</span>
          </div>
        </div>
      </div>

      {/* Expandable Android / Mobile Installation & Sync Guide */}
      {showAndroidGuide && (
        <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/70 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200">
                Android Installation & Cross-Platform Alignment Guide
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAndroidGuide(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
            {/* Question 1: Do I have to make another APK again? */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[12px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Do I need to make another APK whenever changes happen?</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="text-indigo-600 dark:text-indigo-400">NO, never!</strong> This application is built as a cloud-synchronized Progressive Web App (PWA). Every time code updates or features change, your mobile app automatically receives the latest version live from the web server upon opening or refreshing. You do not need to rebuild or install a new APK.
              </p>
            </div>

            {/* Question 2: Why weren't tasks/meds/journal visible on mobile? */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[12px]">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>How to see your PC tasks, meds & profile picture on mobile:</span>
              </div>
              <ol className="text-[11.5px] list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                <li>
                  Open Chrome on your phone with the app URL:{' '}
                  <button
                    onClick={handleCopyAppUrl}
                    className="font-mono text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                  >
                    {isCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </li>
                <li>Tap <strong>Sign in with Google</strong> (or use the same email <code>jaiprakashog@gmail.com</code>).</li>
                <li>Tap <strong>Pull Latest from Cloud</strong> in this widget to immediately mirror all PC changes.</li>
                <li>Tap Chrome Menu (⋮) &gt; <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong> for full-screen native mobile experience!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Sync Diagnostic Modal */}
      {showDiagnosticModal && (
        <TaskSyncDiagnosticPanel
          tasks={tasks}
          onClose={() => setShowDiagnosticModal(false)}
        />
      )}
    </div>
  );
};
