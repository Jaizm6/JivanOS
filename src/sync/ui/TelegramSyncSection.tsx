import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
  CloudDownload,
  GitMerge,
  Smartphone,
  Loader2,
  MessageCircle,
  RefreshCw,
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
  TELEGRAM_NO_BACKUP_FOUND_MESSAGE,
  TELEGRAM_NO_MESSAGES_PROMPT,
  TELEGRAM_SYNC_STATE_EVENT,
  getStoredTelegramAuth,
  sanitizeTelegramError,
  telegramSyncProvider,
} from '../providers/TelegramSyncProvider';

import { SyncProviderRow } from '../../components/settings/SyncProviderRow';

interface TelegramConflictState {
  remoteEnvelope: DriveBackupEnvelope;
  remoteLastModified: string;
  remoteSizeBytes: number;
}

export interface TelegramSyncSectionProps {
  isFirst?: boolean;
  isLast?: boolean;
}

const TelegramLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export const TelegramSyncSection: React.FC<TelegramSyncSectionProps> = ({
  isFirst = false,
  isLast = false,
}) => {
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedBot, setVerifiedBot] = useState<{ botUsername: string; firstName: string } | null>(
    null
  );
  const [showManualChatId, setShowManualChatId] = useState(false);
  const [manualChatId, setManualChatId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Conflict & disconnect state
  const [conflictState, setConflictState] = useState<TelegramConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [, setRelativeTick] = useState(0);

  const resetSetupModal = useCallback(() => {
    setSetupError(null);
    setVerifiedBot(null);
    setManualChatId('');
    setShowManualChatId(false);
    setIsVerifying(false);
  }, []);

  const getLocalAppDataObject = useCallback((): Record<string, any> => {
    const raw = exportEncryptedJSON();
    return JSON.parse(raw);
  }, [exportEncryptedJSON]);

  const getLocalAppDataObjectRef = React.useRef(getLocalAppDataObject);
  getLocalAppDataObjectRef.current = getLocalAppDataObject;

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

  // Silent re-auth check + auto-sync timer rehydration once on mount
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
            () => getLocalAppDataObjectRef.current()
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleVerifyBot = async () => {
    if (isVerifying || isConnecting) return;
    setIsVerifying(true);
    setSetupError(null);
    try {
      const info = await telegramSyncProvider.verifyBotToken(tokenInput);
      setVerifiedBot(info);
    } catch (err: any) {
      setVerifiedBot(null);
      setSetupError(sanitizeTelegramError(err?.message || 'Could not verify Telegram Bot Token.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const performSilentJoplinTelegramSync = useCallback(
    async (showToast = true) => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      try {
        let localData = getLocalAppDataObjectRef.current();
        const pulled = await telegramSyncProvider.syncPull(null);

        if (pulled.found && pulled.envelope && pulled.envelope.data) {
          localData = mergeDriveData(localData, pulled.envelope.data);
          replaceAllAppDataFromBackup(JSON.stringify(localData));
        }

        await telegramSyncProvider.syncPush(localData, { force: true });
        const latestAuth = getStoredTelegramAuth();
        setStoredAuth(latestAuth);
        setSyncStatus('synced');

        // Also keep unified sync settings updated if Telegram is active or no active provider was chosen yet
        try {
          const rawSync = localStorage.getItem('jivanos_unified_sync_settings_v1');
          const parsedSync = rawSync ? JSON.parse(rawSync) : {};
          const nextActive =
            !parsedSync.activeProvider || parsedSync.activeProvider === 'none'
              ? 'telegram'
              : parsedSync.activeProvider;
          localStorage.setItem(
            'jivanos_unified_sync_settings_v1',
            JSON.stringify({
              ...parsedSync,
              activeProvider: nextActive,
              status: 'synced',
              lastSyncedAt: latestAuth?.lastSyncedAt || new Date().toISOString(),
              lastError: null,
            })
          );
          window.dispatchEvent(new CustomEvent('jivanos:unified-sync-state-changed'));
        } catch {}

        if (showToast) {
          showAndroidToast('Synced with Telegram (items merged)', 2400, 'success');
        }
      } catch (err: any) {
        const msg = err?.message || 'Telegram sync failed.';
        setSyncStatus('error');
        setErrorMessage(msg);
        if (showToast) {
          showAndroidToast(msg, 3200, 'error');
        }
      }
    },
    [replaceAllAppDataFromBackup]
  );

  const runConnectAndDetect = async () => {
    if (isConnecting || isVerifying || !tokenInput.trim()) return;
    setIsConnecting(true);
    setSetupError(null);
    try {
      const account = await telegramSyncProvider.connect(
        tokenInput,
        showManualChatId ? manualChatId : undefined
      );
      setTokenInput('');
      resetSetupModal();
      setIsSetupSheetOpen(false);
      setStoredAuth(getStoredTelegramAuth());
      setSyncStatus('idle');
      setErrorMessage(null);
      showAndroidToast(`Connected ${account.name}`, 2800, 'success');
      await performSilentJoplinTelegramSync(false);
    } catch (err: any) {
      const msg = sanitizeTelegramError(err?.message || 'Could not connect Telegram bot.');
      setSetupError(msg);
      if (err?.botUsername) {
        setVerifiedBot({ botUsername: String(err.botUsername), firstName: String(err.botUsername) });
      } else if (!verifiedBot) {
        const match = /@([A-Za-z0-9_]+)/.exec(msg);
        if (match?.[1]) {
          setVerifiedBot({ botUsername: match[1], firstName: match[1] });
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runConnectAndDetect();
  };

  const handleSyncNow = async () => {
    if (syncStatus === 'syncing') return;
    await performSilentJoplinTelegramSync(true);
  };

  const handleCheckRestore = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setErrorMessage(null);
    try {
      const remote = await telegramSyncProvider.restore();
      if (!remote.found || !remote.envelope) {
        setSyncStatus(storedAuth?.lastSyncedAt ? 'synced' : 'idle');
        setErrorMessage(TELEGRAM_NO_BACKUP_FOUND_MESSAGE);
        showAndroidToast(TELEGRAM_NO_BACKUP_FOUND_MESSAGE, 3400, 'default');
        return;
      }
      setConflictState({
        remoteEnvelope: remote.envelope,
        remoteLastModified: remote.lastModified || remote.envelope.updatedAt,
        remoteSizeBytes: remote.fileSizeBytes,
      });
      setSyncStatus('idle');
    } catch (err: any) {
      const msg = sanitizeTelegramError(err?.message || 'Could not restore from Telegram.');
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

  const handleSelectInterval = async (interval: AutoSyncIntervalMinutes) => {
    await telegramSyncProvider.setAutoSync(interval > 0, interval, getLocalAppDataObject);
    setStoredAuth(getStoredTelegramAuth());
    showAndroidToast(
      interval === 0
        ? 'Telegram sync set to Manual'
        : `Telegram auto-sync every ${interval === 60 ? '1 hr' : `${interval} min`}`,
      2200,
      'default'
    );
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
  const activeInterval: AutoSyncIntervalMinutes =
    storedAuth?.autoSyncEnabled ? storedAuth.autoSyncIntervalMinutes : 0;

  const rowStatus = !isConnected
    ? 'disconnected'
    : syncStatus === 'syncing'
      ? 'syncing'
      : syncStatus === 'error'
        ? 'error'
        : storedAuth?.lastSyncedAt
          ? 'synced'
          : 'connected';

  const metaLine = storedAuth?.lastSyncedAt
    ? `Last synced ${formatRelativeSyncTime(storedAuth.lastSyncedAt)}${
        storedAuth.lastFileSizeBytes !== null
          ? ` · ${formatDriveFileSize(storedAuth.lastFileSizeBytes)}`
          : ''
      }`
    : 'Connected · Ready for first backup';

  return (
    <>
      <SyncProviderRow
        name="Telegram"
        badge={
          <span className="px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/75 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/70 text-[10px] font-bold uppercase tracking-wider leading-none">
            Basic
          </span>
        }
        description="Pinned live message sync & backup to your bot chat"
        logo={<TelegramLogoSvg className="w-4.5 h-4.5 text-[#229ED9]" />}
        logoBgClass="bg-sky-50 dark:bg-sky-950/60"
        brandColor="#229ED9"
        isConnected={isConnected}
        status={rowStatus}
        accountLabel={isConnected && storedAuth ? `@${storedAuth.botUsername}` : undefined}
        metaLine={isConnected ? metaLine : undefined}
        connectLabel="Connect →"
        connectButtonId="btn-connect-telegram"
        onConnect={() => {
          resetSetupModal();
          setIsSetupSheetOpen(true);
        }}
        onSyncNow={isConnected ? handleSyncNow : undefined}
        syncButtonId="btn-telegram-sync-now"
        isSyncing={syncStatus === 'syncing'}
        onRetry={handleSyncNow}
        autoSyncInterval={activeInterval}
        onSelectInterval={isConnected ? handleSelectInterval : undefined}
        onRestore={isConnected ? handleCheckRestore : undefined}
        onDisconnect={isConnected ? () => setShowDisconnectConfirm(true) : undefined}
        errorMessage={errorMessage}
        isFirst={isFirst}
        isLast={isLast}
      />

      {/* Step-by-Step Bottom Sheet: Connect Telegram Backup */}
      {isSetupSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-setup-sheet-title"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            if (!isConnecting && !isVerifying) {
              resetSetupModal();
              setIsSetupSheetOpen(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[440px] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-[#229ED9] flex items-center justify-center">
                  <TelegramLogoSvg className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="telegram-setup-sheet-title"
                    className="text-base font-semibold text-slate-900 dark:text-zinc-100"
                  >
                    Connect Telegram Backup
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Free private backup to your own Telegram bot chat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isConnecting && !isVerifying) {
                    resetSetupModal();
                    setIsSetupSheetOpen(false);
                  }
                }}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-3.5">
              {/* Step 1: Create Bot in @BotFather */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 1 · Create your private bot
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <li>
                    Open <strong>@BotFather</strong> and send{' '}
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 text-[11px]">
                      /newbot
                    </span>
                  </li>
                  <li>
                    Pick any display name (e.g. <em>My JivanOS Backup</em>)
                  </li>
                  <li>
                    Pick a username ending in{' '}
                    <span className="font-mono px-1 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 text-[11px]">
                      bot
                    </span>{' '}
                    (e.g. <span className="font-mono text-[11px]">my_jivanos_bot</span>)
                  </li>
                  <li>
                    Copy the <strong>HTTP API Token</strong> that @BotFather replies with
                  </li>
                </ol>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <a
                    href="tg://resolve?domain=BotFather"
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] text-white text-xs font-semibold transition"
                  >
                    <span>Open @BotFather</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline px-1"
                  >
                    Open in browser
                  </a>
                </div>
              </div>

              {/* Step 2: Paste Token & Verify + Start your new bot */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 2 · Paste token &amp; message your new bot
                </div>
                <label
                  htmlFor="telegram-bot-token-input"
                  className="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  Bot HTTP API Token
                </label>
                <div className="flex items-stretch gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      id="telegram-bot-token-input"
                      type={showToken ? 'text' : 'password'}
                      required
                      autoComplete="off"
                      spellCheck={false}
                      value={tokenInput}
                      onChange={(e) => {
                        setTokenInput(e.target.value);
                        setVerifiedBot(null);
                        setSetupError(null);
                      }}
                      placeholder="123456789:ABCdefGHIjklMNO..."
                      className="w-full min-h-[44px] pl-3 pr-10 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-zinc-100 outline-none focus:border-[#229ED9]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isVerifying || isConnecting || !tokenInput.trim()}
                    onClick={handleVerifyBot}
                    className="shrink-0 min-h-[44px] px-3.5 rounded-2xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 disabled:opacity-50 text-sky-700 dark:text-sky-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isVerifying ? 'Checking…' : 'Verify Bot'}</span>
                  </button>
                </div>

                {verifiedBot ? (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Found @{verifiedBot.botUsername || verifiedBot.firstName}</span>
                    </div>
                    <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                      <strong>Required:</strong> Telegram blocks bots from starting a chat with you.
                      Open your new bot below and tap <strong>Start</strong> (or send <strong>Hi</strong>), then come back and tap Connect.
                    </p>
                    {verifiedBot.botUsername && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <a
                          href={`tg://resolve?domain=${verifiedBot.botUsername}`}
                          className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Open @{verifiedBot.botUsername}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={`https://t.me/${verifiedBot.botUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline px-1"
                        >
                          Open in browser
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Tap <strong>Verify Bot</strong> after pasting your token to get a 1-tap button
                    to open your new bot and press <strong>Start</strong> (required so Telegram can
                    detect your private Chat ID).
                  </p>
                )}
              </div>

              {/* Step 3: Detect Chat ID & Connect + Optional Manual Chat ID */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Step 3 · Detect Chat ID &amp; Connect
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualChatId((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 py-1 cursor-pointer"
                >
                  <span>Can&apos;t auto-detect? Enter Chat ID manually</span>
                  {showManualChatId ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {showManualChatId && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 p-3 space-y-2">
                    <label
                      htmlFor="telegram-manual-chat-id"
                      className="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
                    >
                      Your numeric Telegram Chat ID (optional)
                    </label>
                    <input
                      id="telegram-manual-chat-id"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={manualChatId}
                      onChange={(e) => {
                        setManualChatId(e.target.value);
                        setSetupError(null);
                      }}
                      placeholder="e.g. 123456789"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs font-mono text-slate-900 dark:text-zinc-100 outline-none focus:border-[#229ED9]"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Helpful if you tapped Start more than 24 hours ago. Message{' '}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sky-600 dark:text-sky-400 underline"
                      >
                        @userinfobot
                      </a>{' '}
                      on Telegram to view your numeric ID (you still need to tap Start in your own
                      bot once).
                    </p>
                  </div>
                )}

                {setupError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed space-y-2">
                    <div>{setupError}</div>
                    {setupError === TELEGRAM_NO_MESSAGES_PROMPT && (
                      <button
                        type="button"
                        disabled={isConnecting || isVerifying}
                        onClick={runConnectAndDetect}
                        className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Detect Again</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isConnecting || isVerifying || !tokenInput.trim()}
                  className="w-full min-h-[48px] px-5 py-3 rounded-full bg-[#229ED9] hover:bg-[#1c8cc2] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Detecting Chat ID…</span>
                    </>
                  ) : (
                    <span>
                      {showManualChatId && manualChatId.trim()
                        ? 'Connect with Chat ID'
                        : setupError === TELEGRAM_NO_MESSAGES_PROMPT
                          ? 'Detect Again'
                          : 'Connect & Detect Chat ID'}
                    </span>
                  )}
                </button>
              </div>
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
