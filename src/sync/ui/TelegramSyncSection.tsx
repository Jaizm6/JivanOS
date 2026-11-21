import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Check,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  LogOut,
  AlertTriangle,
  CloudDownload,
  GitMerge,
  Smartphone,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../../components/common/AndroidToast';
import {
  AutoSyncIntervalMinutes,
  DriveBackupEnvelope,
  formatDriveFileSize,
  formatRelativeSyncTime,
  isRemoteNewerThanLocal,
  mergeDriveData,
} from '../../utils/googleDriveSync';
import {
  StoredTelegramAuth,
  TELEGRAM_SYNC_STATE_EVENT,
  getStoredTelegramAuth,
  telegramSyncProvider,
} from '../providers/TelegramSyncProvider';

const INTERVAL_OPTIONS: { label: string; value: AutoSyncIntervalMinutes }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: 'Manual', value: 0 },
];

interface TelegramConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
}

const TelegramLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export const TelegramSyncSection: React.FC = () => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();

  const [storedAuth, setStoredAuth] = useState<StoredTelegramAuth | null>(() =>
    getStoredTelegramAuth()
  );
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'syncing' | 'error'>(() => {
    const initial = getStoredTelegramAuth();
    if (initial?.lastError) return 'error';
    if (initial?.lastSyncedAt) return 'synced';
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => getStoredTelegramAuth()?.lastError || null
  );

  // Step-by-step bottom sheet state
  const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Conflict & disconnect state
  const [conflictState, setConflictState] = useState<TelegramConflictState | null>(null);
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
      const next = getStoredTelegramAuth();
      setStoredAuth(next);
      if (next?.lastError) {
        setSyncStatus('error');
        setErrorMessage(next.lastError);
      } else if (next?.lastSyncedAt) {
        setSyncStatus((prev) => (prev === 'syncing' ? prev : 'synced'));
        setErrorMessage(null);
      }
    };
    window.addEventListener(TELEGRAM_SYNC_STATE_EVENT, handleUpdate);
    return () => window.removeEventListener(TELEGRAM_SYNC_STATE_EVENT, handleUpdate);
  }, []);

  // Silent re-auth check + auto-sync timer rehydration on mount
  useEffect(() => {
    let active = true;
    const existing = getStoredTelegramAuth();
    if (!existing) return;

    telegramSyncProvider
      .silentReAuth()
      .then((acc) => {
        if (!active || !acc?.connected) return;
        setStoredAuth(getStoredTelegramAuth());
        if (existing.autoSyncEnabled && existing.autoSyncIntervalMinutes > 0) {
          telegramSyncProvider.setAutoSync(
            true,
            existing.autoSyncIntervalMinutes,
            getLocalAppDataObject
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [getLocalAppDataObject]);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnecting) return;
    setIsConnecting(true);
    setSetupError(null);
    try {
      const account = await telegramSyncProvider.connect(tokenInput);
      setTokenInput('');
      setIsSetupSheetOpen(false);
      setStoredAuth(getStoredTelegramAuth());
      setSyncStatus('idle');
      setErrorMessage(null);
      showAndroidToast(`Connected ${account.name}`, 2800, 'success');
    } catch (err: any) {
      setSetupError(err?.message || 'Could not connect Telegram bot.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      const localLastSyncedAt = getStoredTelegramAuth()?.lastSyncedAt || null;
      const remoteInfo = await telegramSyncProvider.getLastSyncInfo();

      if (remoteInfo && isRemoteNewerThanLocal(remoteInfo.lastModified, localLastSyncedAt)) {
        const remote = await telegramSyncProvider.restore();
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
      await telegramSyncProvider.backup(localData);
      setStoredAuth(getStoredTelegramAuth());
      setSyncStatus('synced');
      showAndroidToast('Backup sent to your Telegram bot', 2600, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Telegram backup failed.';
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
      const remote = await telegramSyncProvider.restore();
      if (!remote.found || !remote.envelope) {
        setSyncStatus(storedAuth?.lastSyncedAt ? 'synced' : 'idle');
        showAndroidToast('No Telegram backup file found yet.', 2800, 'default');
        return;
      }
      setConflictState({
        remoteEnvelope: remote.envelope,
        remoteLastModified: remote.lastModified || remote.envelope.updatedAt,
        remoteSizeBytes: remote.fileSizeBytes,
      });
      setSyncStatus('idle');
    } catch (err: any) {
      const msg = err?.message || 'Could not restore from Telegram.';
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
        if (!ok) throw new Error('Backup could not be applied.');
        showAndroidToast('Restored from Telegram backup', 2600, 'success');
      } else if (choice === 'keep-device') {
        await telegramSyncProvider.backup(getLocalAppDataObject());
        showAndroidToast('Sent this device backup to Telegram', 2600, 'success');
      } else {
        const merged = mergeDriveData(getLocalAppDataObject(), conflictState.remoteEnvelope.data);
        const ok = replaceAllAppDataFromBackup(JSON.stringify(merged));
        if (!ok) throw new Error('Could not apply merged backup.');
        await telegramSyncProvider.backup(merged);
        showAndroidToast('Merged both & uploaded to Telegram', 2600, 'success');
      }
      setConflictState(null);
      setStoredAuth(getStoredTelegramAuth());
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

  const handleToggleAutoSync = async () => {
    if (!storedAuth) return;
    const nextEnabled = !storedAuth.autoSyncEnabled;
    const nextInterval: AutoSyncIntervalMinutes = nextEnabled
      ? storedAuth.autoSyncIntervalMinutes > 0
        ? storedAuth.autoSyncIntervalMinutes
        : 30
      : 0;
    await telegramSyncProvider.setAutoSync(nextEnabled, nextInterval, getLocalAppDataObject);
    setStoredAuth(getStoredTelegramAuth());
  };

  const handleSelectInterval = async (interval: AutoSyncIntervalMinutes) => {
    await telegramSyncProvider.setAutoSync(interval > 0, interval, getLocalAppDataObject);
    setStoredAuth(getStoredTelegramAuth());
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    await telegramSyncProvider.disconnect();
    setStoredAuth(null);
    setSyncStatus('idle');
    setErrorMessage(null);
    showAndroidToast('Telegram backup disconnected', 2400, 'default');
  };

  const isConnected = Boolean(storedAuth?.botToken && storedAuth?.chatId);

  return (
    <>
      <section
        aria-label="Telegram"
        style={
          isConnected
            ? { borderLeftWidth: 3, borderLeftColor: '#229ED9' }
            : undefined
        }
        className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4 w-full min-w-0"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-[#229ED9] flex items-center justify-center shrink-0">
              <TelegramLogoSvg className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                  Telegram
                </h3>
                {isConnected && storedAuth && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300">
                    @{storedAuth.botUsername}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {isConnected
                  ? 'Backups sent to your private bot chat'
                  : 'Free private JSON backups sent to your own Telegram bot'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {!isConnected ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                Not connected
              </span>
            ) : syncStatus === 'syncing' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing…</span>
              </span>
            ) : syncStatus === 'synced' && storedAuth?.lastSyncedAt ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white">
                <Check className="w-3.5 h-3.5" />
                <span>Synced ✓</span>
              </span>
            ) : syncStatus === 'error' ? (
              <button
                type="button"
                onClick={handleSyncNow}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                title="Tap to retry"
              >
                <X className="w-3.5 h-3.5" />
                <span>Error ✗</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Disconnected State */}
        {!isConnected && (
          <div className="space-y-3">
            <button
              type="button"
              id="btn-connect-telegram"
              onClick={() => {
                setSetupError(null);
                setIsSetupSheetOpen(true);
              }}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] active:scale-[0.99] text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
            >
              <TelegramLogoSvg className="w-4.5 h-4.5" />
              <span>Connect Telegram</span>
            </button>
            <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              No server, no middleman. Create a free private bot via @BotFather and keep your
              backups in your own Telegram chat.
            </p>
          </div>
        )}

        {/* Connected State */}
        {isConnected && storedAuth && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                  {storedAuth.lastSyncedAt
                    ? `Last synced ${formatRelativeSyncTime(storedAuth.lastSyncedAt)}`
                    : 'Connected — ready for your first backup'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <span>@{storedAuth.botUsername}</span>
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
                  id="btn-telegram-sync-now"
                  onClick={handleSyncNow}
                  disabled={syncStatus === 'syncing'}
                  title="Sync Now"
                  aria-label="Sync Now"
                  className="w-10 h-10 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] active:scale-95 disabled:opacity-60 text-white flex items-center justify-center shrink-0 shadow-xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
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
                  Auto-sync to Telegram
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={storedAuth.autoSyncEnabled}
                  onClick={handleToggleAutoSync}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    storedAuth.autoSyncEnabled ? 'bg-[#229ED9]' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      storedAuth.autoSyncEnabled ? 'translate-x-5.5' : 'translate-x-1'
                    }`}
                  />
                </button>
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
                          ? 'bg-[#229ED9] text-white shadow-2xs'
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

      {/* Step-by-Step Bottom Sheet: Connect Telegram Backup */}
      {isSetupSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-setup-sheet-title"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !isConnecting && setIsSetupSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[420px] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-[#229ED9] flex items-center justify-center">
                  <TelegramLogoSvg className="w-5 h-5" />
                </div>
                <h3
                  id="telegram-setup-sheet-title"
                  className="text-base font-semibold text-slate-900 dark:text-zinc-100"
                >
                  Connect Telegram Backup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isConnecting && setIsSetupSheetOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              {/* Step 1 */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 1
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="tg://resolve?domain=BotFather"
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] text-white text-xs font-semibold transition"
                  >
                    <span>Open @BotFather</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Open in browser
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 2
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                  Send <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800">/newbot</span> and follow steps
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Then open your new bot in Telegram and tap <strong>Start</strong> once so JivanOS
                  can auto-detect your private Chat ID.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 3
                </div>
                <label
                  htmlFor="telegram-bot-token-input"
                  className="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  Paste your Bot Token:
                </label>
                <div className="relative">
                  <input
                    id="telegram-bot-token-input"
                    type={showToken ? 'text' : 'password'}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNO..."
                    className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-zinc-100 outline-none focus:border-[#229ED9]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {setupError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  {setupError}
                </div>
              )}

              <button
                type="submit"
                disabled={isConnecting || !tokenInput.trim()}
                className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Detecting Chat ID…</span>
                  </>
                ) : (
                  <span>Connect</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

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
            <div className="w-11 h-11 rounded-full bg-sky-100 dark:bg-sky-950/70 text-[#229ED9] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Telegram Backup Found
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Latest backup from{' '}
                <span className="font-semibold">
                  {formatRelativeSyncTime(conflictState.remoteLastModified)}
                </span>{' '}
                ({formatDriveFileSize(conflictState.remoteSizeBytes)}). Choose how to proceed:
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isResolvingConflict}
                onClick={() => handleResolveConflict('merge-both')}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <GitMerge className="w-4 h-4" />
                <span>Merge Both</span>
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
              Disconnect Telegram Backup?
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Your bot token will be removed from this device. Existing backup files inside your
              Telegram chat will remain untouched.
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
