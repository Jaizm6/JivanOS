import React, { useState } from 'react';
import {
  Check,
  CloudDownload,
  Download,
  FolderOpen,
  HardDriveDownload,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  ActiveSyncProviderId,
  BackupDestinationId,
  BackupScheduleMinutes,
  SyncReceiveIntervalMinutes,
  UnifiedBackupSettings,
  UnifiedSyncSettings,
  computeNextScheduledBackupIso,
  getUnifiedBackupSettings,
  pickCustomLocalBackupFolder,
  saveUnifiedBackupSettings,
  saveUnifiedSyncSettings,
} from '../../sync/unifiedSyncBackupEngine';
import {
  triggerUnifiedBackupNow,
  triggerUnifiedSyncNow,
} from '../../sync/UnifiedSyncBackupCoordinator';
import { formatRelativeSyncTime } from '../../utils/googleDriveSync';
import { showAndroidToast } from '../common/AndroidToast';

export type ProviderPopupTarget =
  | {
      mode: 'sync';
      providerId?: Exclude<ActiveSyncProviderId, 'none'>;
      providerName: string;
      connectedProviders?: Array<{
        id: Exclude<ActiveSyncProviderId, 'none'>;
        name: string;
      }>;
    }
  | {
      mode: 'backup';
      destinationId?: BackupDestinationId;
      providerName: string;
      connectedDestinations?: Array<{
        id: BackupDestinationId;
        name: string;
      }>;
      onRestoreFromProvider?: () => void;
    };

interface ProviderSyncBackupModalsProps {
  target: ProviderPopupTarget | null;
  onClose: () => void;
  syncSettings: UnifiedSyncSettings;
  backupSettings: UnifiedBackupSettings;
  onSettingsChanged: () => void;
}

const RECEIVE_INTERVAL_OPTIONS: Array<{
  value: SyncReceiveIntervalMinutes;
  label: string;
}> = [
  { value: 1, label: 'Every 1 minute' },
  { value: 2, label: 'Every 2 minutes (default)' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every 1 hour' },
  { value: 0, label: 'Manual only' },
];

const BACKUP_SCHEDULE_OPTIONS: Array<{
  value: BackupScheduleMinutes;
  label: string;
}> = [
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours (default)' },
  { value: 2880, label: 'Every 48 hours' },
  { value: 10080, label: 'Every 7 days' },
  { value: 0, label: 'Manual only' },
];

export const ProviderSyncBackupModals: React.FC<ProviderSyncBackupModalsProps> = ({
  target,
  onClose,
  syncSettings,
  backupSettings,
  onSettingsChanged,
}) => {
  const [backupPassword, setBackupPassword] = useState('');

  if (!target) return null;

  if (target.mode === 'sync') {
    const isGlobalSyncRules = !target.providerId;
    const effectiveProviderId: ActiveSyncProviderId =
      target.providerId || syncSettings.activeProvider;
    const isActive =
      target.providerId
        ? syncSettings.activeProvider === target.providerId
        : syncSettings.activeProvider !== 'none';
    const isSyncing = isActive && syncSettings.status === 'syncing';
    const connectedList = target.connectedProviders || [];

    const handleToggleActiveSync = () => {
      if (isActive) {
        saveUnifiedSyncSettings({ activeProvider: 'none' });
        showAndroidToast(
          target.providerId
            ? `Paused auto-sync for ${target.providerName}`
            : 'Auto-sync paused',
          2200,
          'default'
        );
      } else {
        const nextProvider =
          target.providerId || connectedList[0]?.id || 'none';
        if (nextProvider === 'none') {
          showAndroidToast('Connect a sync provider first', 2400, 'error');
          return;
        }
        saveUnifiedSyncSettings({
          activeProvider: nextProvider,
          status: 'synced',
          lastError: null,
        });
        showAndroidToast('Auto-sync enabled', 2200, 'success');
        triggerUnifiedSyncNow(false, nextProvider);
      }
      onSettingsChanged();
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-sync-modal-title"
        className="fixed inset-0 z-[100004] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-[430px] max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[24px] sm:rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                {isGlobalSyncRules ? (
                  <SlidersHorizontal className="w-4.5 h-4.5" />
                ) : (
                  <RefreshCw className={`w-4.5 h-4.5 ${isSyncing ? 'animate-spin' : ''}`} />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="provider-sync-modal-title"
                  className="text-base font-semibold text-slate-900 dark:text-zinc-100 truncate"
                >
                  {isGlobalSyncRules ? 'Sync Rules' : `${target.providerName} · Sync Rules`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {isActive && syncSettings.lastSyncedAt
                    ? `Last synced ${formatRelativeSyncTime(syncSettings.lastSyncedAt)}`
                    : 'Automatic Joplin-style silent sync across devices'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Primary Action: Sync Now */}
          {effectiveProviderId !== 'none' && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => {
                if (target.providerId && syncSettings.activeProvider !== target.providerId) {
                  saveUnifiedSyncSettings({ activeProvider: target.providerId });
                  onSettingsChanged();
                }
                triggerUnifiedSyncNow(
                  true,
                  target.providerId ||
                    (syncSettings.activeProvider !== 'none'
                      ? syncSettings.activeProvider
                      : undefined)
                );
              }}
              className="w-full min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Syncing…'
                  : isGlobalSyncRules
                    ? 'Sync Active Provider Now'
                    : `Sync ${target.providerName} Now`}
              </span>
            </button>
          )}

          {/* Options List */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
            {/* Global Active Sync Provider selector */}
            {isGlobalSyncRules && (
              <div className="px-3.5 py-3 space-y-2">
                <div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                    Active auto-sync provider
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                    Choose which connected drive syncs changes in real time
                  </div>
                </div>
                <select
                  aria-label="Active auto-sync provider"
                  value={syncSettings.activeProvider}
                  onChange={(e) => {
                    const next = e.target.value as ActiveSyncProviderId;
                    saveUnifiedSyncSettings({
                      activeProvider: next,
                      status: 'synced',
                      lastError: null,
                    });
                    onSettingsChanged();
                    if (next !== 'none') {
                      triggerUnifiedSyncNow(false, next);
                    }
                  }}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
                >
                  <option value="none">Off (manual sync only)</option>
                  {connectedList.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-sync active switch */}
            <label className="px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Auto-sync on every edit
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 leading-snug mt-0.5">
                  Automatically pushes changes ~3s after saving and merges updates silently without popups
                </div>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={handleToggleActiveSync}
              />
            </label>

            {/* Stacked Receive Interval */}
            <div className="px-3.5 py-3 space-y-2">
              <div>
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Check other devices for changes
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Also checks automatically on app open &amp; focus
                </div>
              </div>
              <select
                aria-label="Check other devices for changes"
                value={syncSettings.receiveIntervalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value) as SyncReceiveIntervalMinutes;
                  saveUnifiedSyncSettings({ receiveIntervalMinutes: val });
                  onSettingsChanged();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
              >
                {RECEIVE_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Stacked Network Preference */}
            <div className="px-3.5 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Sync network
                </div>
              </div>
              <select
                aria-label="Sync network"
                value={syncSettings.wifiOnly ? 'wifi' : 'both'}
                onChange={(e) => {
                  saveUnifiedSyncSettings({ wifiOnly: e.target.value === 'wifi' });
                  onSettingsChanged();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
              >
                <option value="both">Wi-Fi &amp; Mobile data (recommended)</option>
                <option value="wifi">Wi-Fi only</option>
              </select>
            </div>
          </div>

          {syncSettings.lastError && isActive && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {syncSettings.lastError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // BACKUP OPTIONS / BACKUP RULES MODAL
  const isGlobalBackupRules = !target.destinationId;
  const destId: BackupDestinationId = target.destinationId || 'local';
  const isLocal = destId === 'local';
  const isScheduled = isLocal ? true : Boolean(backupSettings.destinations[destId]);
  const destStatus = backupSettings.destinationStatuses[destId];
  const isBackingUp = destStatus?.state === 'running';
  const connectedDestinations = target.connectedDestinations || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-backup-modal-title"
      className="fixed inset-0 z-[100004] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[440px] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[24px] sm:rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HardDriveDownload className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3
                id="provider-backup-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-zinc-100 truncate"
              >
                {isGlobalBackupRules
                  ? 'Backup Rules'
                  : `${target.providerName} · Backup Rules`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {destStatus?.lastBackupAt
                  ? `Last backed up ${formatRelativeSyncTime(destStatus.lastBackupAt)} · Keeps last 4`
                  : 'Timestamped history copies · Keeps last 4 backups'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isBackingUp}
            onClick={() => {
              triggerUnifiedBackupNow(
                backupPassword || undefined,
                isGlobalBackupRules ? undefined : destId
              );
            }}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
          >
            {isBackingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isBackingUp
                ? 'Backing up…'
                : isGlobalBackupRules
                  ? 'Back up all enabled now'
                  : `Back up ${target.providerName} now`}
            </span>
          </button>

          {target.onRestoreFromProvider && (
            <button
              type="button"
              onClick={() => {
                onClose();
                target.onRestoreFromProvider?.();
              }}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <CloudDownload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Restore</span>
            </button>
          )}
        </div>

        {destStatus?.state === 'error' && destStatus.lastError && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {destStatus.lastError}
          </div>
        )}

        {/* Settings Card — Cleanly Stacked Controls */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
          {/* Global Backup Destinations Checklist */}
          {isGlobalBackupRules && connectedDestinations.length > 0 && (
            <div className="px-3.5 py-3 space-y-2">
              <div>
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Scheduled backup destinations
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Choose which connected providers receive scheduled history snapshots
                </div>
              </div>
              <div className="space-y-1.5 pt-0.5">
                {connectedDestinations.map((dest) => {
                  const checked =
                    dest.id === 'local'
                      ? true
                      : Boolean(backupSettings.destinations[dest.id]);
                  return (
                    <label
                      key={dest.id}
                      className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60 cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        {dest.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={dest.id === 'local'}
                        onChange={(e) => {
                          if (dest.id === 'local') return;
                          saveUnifiedBackupSettings({
                            destinations: {
                              ...backupSettings.destinations,
                              [dest.id]: e.target.checked,
                            },
                          });
                          onSettingsChanged();
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-Cloud Provider: Include in Scheduled Backups */}
          {!isGlobalBackupRules && !isLocal && (
            <label className="px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Include in scheduled backups
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Automatically save history snapshots to {target.providerName}
                </div>
              </div>
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => {
                  saveUnifiedBackupSettings({
                    destinations: {
                      ...backupSettings.destinations,
                      [destId]: e.target.checked,
                    },
                  });
                  onSettingsChanged();
                }}
              />
            </label>
          )}

          {/* Local Folder Destination (shown for Local or Global Backup Rules) */}
          {(isLocal || isGlobalBackupRules) && (
            <div className="px-3.5 py-3 space-y-2.5">
              <div>
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Local backup folder
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {backupSettings.localFolderMode === 'custom' &&
                  backupSettings.localCustomFolderName
                    ? `Custom: ${backupSettings.localCustomFolderName}/Backups`
                    : 'Documents/JivanOS/Backups · survives uninstall'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    saveUnifiedBackupSettings({
                      localFolderMode: 'jivanos_default',
                      firstRunCompleted: true,
                    });
                    onSettingsChanged();
                  }}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    backupSettings.localFolderMode === 'jivanos_default'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  {backupSettings.localFolderMode === 'jivanos_default' && (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>JivanOS folder</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const folderName = await pickCustomLocalBackupFolder();
                      onSettingsChanged();
                      if (folderName) {
                        showAndroidToast(`Custom folder: ${folderName}`, 2400, 'success');
                      }
                    } catch {
                      // Cancelled
                    }
                  }}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    backupSettings.localFolderMode === 'custom'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {backupSettings.localCustomFolderName || 'Pick folder…'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Schedule: Back up every + Time */}
          <div className="px-3.5 py-3 space-y-2.5">
            <div>
              <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                Back up every
              </div>
              <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Missed scheduled backups run automatically next time you open the app
              </div>
            </div>
            <div
              className={`grid gap-2 ${
                backupSettings.scheduleMinutes >= 1440 ? 'grid-cols-[1fr_110px]' : 'grid-cols-1'
              }`}
            >
              <select
                aria-label="Back up every"
                value={backupSettings.scheduleMinutes}
                onChange={(e) => {
                  const mins = Number(e.target.value) as BackupScheduleMinutes;
                  const nextIso = computeNextScheduledBackupIso(
                    mins,
                    backupSettings.scheduledTime
                  );
                  saveUnifiedBackupSettings({
                    scheduleMinutes: mins,
                    nextScheduledBackupAt: nextIso,
                  });
                  onSettingsChanged();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
              >
                {BACKUP_SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {backupSettings.scheduleMinutes >= 1440 && (
                <input
                  type="time"
                  aria-label="Scheduled backup time"
                  value={backupSettings.scheduledTime || '01:00'}
                  onChange={(e) => {
                    const t = e.target.value || '01:00';
                    const nextIso = computeNextScheduledBackupIso(
                      backupSettings.scheduleMinutes,
                      t
                    );
                    saveUnifiedBackupSettings({
                      scheduledTime: t,
                      nextScheduledBackupAt: nextIso,
                    });
                    onSettingsChanged();
                  }}
                  className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none tabular-nums"
                />
              )}
            </div>
          </div>

          {/* Only if something changed */}
          <label className="px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                Only if something changed
              </div>
              <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Skips scheduled backup when nothing changed
              </div>
            </div>
            <input
              type="checkbox"
              checked={backupSettings.onlyIfChanged}
              onChange={(e) => {
                saveUnifiedBackupSettings({ onlyIfChanged: e.target.checked });
                onSettingsChanged();
              }}
            />
          </label>

          {/* AES-256 Password protection */}
          <div className="px-3.5 py-3 space-y-2">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Lock className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                    Password-protect (AES-256)
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Encrypt backup snapshots before saving
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={backupSettings.passwordProtected}
                onChange={(e) => {
                  saveUnifiedBackupSettings({ passwordProtected: e.target.checked });
                  onSettingsChanged();
                }}
              />
            </label>

            {backupSettings.passwordProtected && (
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter AES-256 backup password…"
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
              />
            )}
          </div>

          {/* Backup network connection */}
          <div className="px-3.5 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                Backup network
              </div>
            </div>
            <select
              aria-label="Backup network"
              value={backupSettings.wifiOnly ? 'wifi' : 'both'}
              onChange={(e) => {
                saveUnifiedBackupSettings({ wifiOnly: e.target.value === 'wifi' });
                onSettingsChanged();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
            >
              <option value="wifi">Wi-Fi only (default)</option>
              <option value="both">Wi-Fi &amp; Mobile data</option>
            </select>
          </div>

          {/* Only while charging */}
          <label className="px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100">
                  Only while charging
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Delay scheduled backups until plugged in
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={backupSettings.onlyWhileCharging}
              onChange={(e) => {
                saveUnifiedBackupSettings({ onlyWhileCharging: e.target.checked });
                onSettingsChanged();
              }}
            />
          </label>
        </div>

        {/* Refresh helper for lint completeness */}
        {(() => {
          void getUnifiedBackupSettings;
          return null;
        })()}
      </div>
    </div>
  );
};
