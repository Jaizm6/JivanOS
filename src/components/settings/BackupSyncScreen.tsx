import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FolderSync,
  Globe,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyncDriveId } from '../../types';
import { SettingsSubpageHeader } from './SettingsSubpageHeader';
import { JivanOSCloudSection } from '../../sync/ui/JivanOSCloudSection';
import { GoogleDriveSyncSection } from './GoogleDriveSyncSection';
import { DropboxSyncSection } from './DropboxSyncSection';
import { TelegramSyncSection } from '../../sync/ui/TelegramSyncSection';
import { MEGASyncSection } from '../../sync/ui/MEGASyncSection';
import { SyncProviderRow, SyncRowStatus } from './SyncProviderRow';
import {
  ProviderPopupTarget,
  ProviderSyncBackupModals,
} from './ProviderSyncBackupModals';
import { showAndroidToast } from '../common/AndroidToast';
import {
  DRIVE_SYNC_STATE_EVENT,
  formatDriveFileSize,
  formatRelativeSyncTime,
} from '../../utils/googleDriveSync';
import { DROPBOX_SYNC_STATE_EVENT } from '../../utils/dropboxSync';
import { TELEGRAM_SYNC_STATE_EVENT } from '../../sync/providers/TelegramSyncProvider';
import { MEGA_SYNC_STATE_EVENT } from '../../sync/providers/MEGASyncProvider';
import { JIVANOS_CLOUD_STATE_EVENT } from '../../sync/providers/FirestoreSyncProvider';
import {
  LocalSnapshotMeta,
  exportLocalBackup,
  listLocalSnapshots,
  readLocalSnapshot,
  saveRotatingAutoSnapshot,
  validateBackupPayload,
} from '../../utils/localBackupEngine';
import { getRealSyncOverview } from '../../sync/syncConnectionState';
import {
  ActiveSyncProviderId,
  BackupDestinationId,
  SYNCTHING_FOLDER_STATE_EVENT,
  UNIFIED_BACKUP_STATE_EVENT,
  UNIFIED_SYNC_STATE_EVENT,
  activateSyncProviderIfNone,
  disconnectSyncthingFolder,
  getSyncthingFolderState,
  getUnifiedBackupSettings,
  getUnifiedSyncSettings,
  pickSyncthingFolder,
  pullFromSyncthingFolder,
  pushToSyncthingFolder,
  saveUnifiedSyncSettings,
} from '../../sync/unifiedSyncBackupEngine';
import {
  triggerUnifiedBackupNow,
  triggerUnifiedSyncNow,
} from '../../sync/UnifiedSyncBackupCoordinator';

interface BackupSyncScreenProps {
  onBack: () => void;
}

const PROVIDER_DISPLAY_NAMES: Record<Exclude<ActiveSyncProviderId, 'none'>, string> = {
  firebase: 'JivanOS Cloud',
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  telegram: 'Telegram',
  webdav: 'WebDAV / Nextcloud',
  local_folder: 'Local / Syncthing',
  mega: 'MEGA',
  s3: 'S3 / MinIO',
};

export const BackupSyncScreen: React.FC<BackupSyncScreenProps> = ({ onBack }) => {
  const {
    firebaseUser,
    joplinSyncSettings,
    updateDriveConfig,
    checkDriveConfiguration,
    syncDriveNow,
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
  } = useApp();

  // Live state ticks
  const [providerTick, setProviderTick] = useState(0);
  const [syncSettings, setSyncSettings] = useState(() => getUnifiedSyncSettings());
  const [backupSettings, setBackupSettings] = useState(() => getUnifiedBackupSettings());
  const [syncthingState, setSyncthingState] = useState(() => getSyncthingFolderState());

  // Unified popup target for per-provider [Sync] and [Backup] buttons
  const [popupTarget, setPopupTarget] = useState<ProviderPopupTarget | null>(null);

  // WebDAV / Nextcloud state
  const [isWebdavExpanded, setIsWebdavExpanded] = useState(false);
  const [isTestingWebdav, setIsTestingWebdav] = useState(false);
  const [isSyncingWebdav, setIsSyncingWebdav] = useState(false);
  const [webdavError, setWebdavError] = useState<string | null>(null);

  // Advanced S3 / MinIO state
  const [showAdvancedS3, setShowAdvancedS3] = useState(false);
  const [isS3Expanded, setIsS3Expanded] = useState(false);
  const [isTestingS3, setIsTestingS3] = useState(false);
  const [isSyncingS3, setIsSyncingS3] = useState(false);
  const [s3Error, setS3Error] = useState<string | null>(null);

  // Local Backup & Auto-Snapshots state
  const [snapshots, setSnapshots] = useState<LocalSnapshotMeta[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    sourceLabel: string;
    normalizedJsonString: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshAllStates = useCallback(() => {
    setProviderTick((t) => t + 1);
    setSyncSettings(getUnifiedSyncSettings());
    setBackupSettings(getUnifiedBackupSettings());
    setSyncthingState(getSyncthingFolderState());
  }, []);

  useEffect(() => {
    const events = [
      DRIVE_SYNC_STATE_EVENT,
      DROPBOX_SYNC_STATE_EVENT,
      TELEGRAM_SYNC_STATE_EVENT,
      MEGA_SYNC_STATE_EVENT,
      JIVANOS_CLOUD_STATE_EVENT,
      UNIFIED_SYNC_STATE_EVENT,
      UNIFIED_BACKUP_STATE_EVENT,
      SYNCTHING_FOLDER_STATE_EVENT,
    ];
    events.forEach((ev) => window.addEventListener(ev, refreshAllStates));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, refreshAllStates));
    };
  }, [refreshAllStates]);

  const realOverview = useMemo(
    () => getRealSyncOverview(firebaseUser, joplinSyncSettings),
    [firebaseUser, joplinSyncSettings, providerTick]
  );

  const connectedIdSet = useMemo(() => {
    const s = new Set<string>(['local']);
    realOverview.connectedProviders.forEach((p) => s.add(p.id));
    if (syncthingState.connected) s.add('local_folder');
    return s;
  }, [realOverview.connectedProviders, syncthingState.connected]);

  // Keep activeProvider valid if a provider was disconnected
  useEffect(() => {
    if (
      syncSettings.activeProvider !== 'none' &&
      !connectedIdSet.has(syncSettings.activeProvider)
    ) {
      const fallback = (realOverview.connectedProviders[0]?.id as ActiveSyncProviderId) || 'none';
      const updated = saveUnifiedSyncSettings({ activeProvider: fallback });
      setSyncSettings(updated);
    }
  }, [connectedIdSet, realOverview.connectedProviders, syncSettings.activeProvider]);

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await listLocalSnapshots();
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    }
  }, []);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  // WebDAV merged config
  const webdavCfg = joplinSyncSettings.drives.webdav;
  const nextcloudCfg = joplinSyncSettings.drives.nextcloud;
  const activeDavId: SyncDriveId =
    !webdavCfg?.serverUrl && nextcloudCfg?.serverUrl ? 'nextcloud' : 'webdav';
  const davCfg = joplinSyncSettings.drives[activeDavId] || webdavCfg;

  const isWebdavConnected = Boolean(
    davCfg?.serverUrl?.trim() &&
      davCfg?.username?.trim() &&
      davCfg?.password?.trim() &&
      (davCfg?.enabled || davCfg?.lastStatus === 'synced' || davCfg?.lastSyncedAt)
  );

  const webdavHost = useMemo(() => {
    if (!davCfg?.serverUrl) return '';
    try {
      return new URL(davCfg.serverUrl).hostname;
    } catch {
      return davCfg.serverUrl;
    }
  }, [davCfg?.serverUrl]);

  const webdavStatus: SyncRowStatus = !isWebdavConnected
    ? 'disconnected'
    : isSyncingWebdav || davCfg?.lastStatus === 'syncing'
      ? 'syncing'
      : webdavError || davCfg?.lastStatus === 'error'
        ? 'error'
        : davCfg?.lastSyncedAt
          ? 'synced'
          : 'connected';

  const handleSaveAndConnectWebdav = async () => {
    if (!davCfg?.serverUrl?.trim() || !davCfg?.username?.trim() || !davCfg?.password?.trim()) {
      setWebdavError('Enter Server URL, Username, and App Password.');
      return;
    }
    setIsTestingWebdav(true);
    setWebdavError(null);
    try {
      const res = await checkDriveConfiguration(activeDavId);
      if (!res.success) {
        setWebdavError(res.message);
        return;
      }
      updateDriveConfig(activeDavId, {
        enabled: true,
        lastStatus: 'synced',
        lastError: undefined,
      });
      activateSyncProviderIfNone('webdav');
      await syncDriveNow(activeDavId);
      setIsWebdavExpanded(false);
      refreshAllStates();
      showAndroidToast('Connected & synced to WebDAV / Nextcloud', 2600, 'success');
    } catch (err: any) {
      setWebdavError(err?.message || 'Could not connect to WebDAV server.');
    } finally {
      setIsTestingWebdav(false);
    }
  };

  const handleSyncWebdavNow = async () => {
    if (isSyncingWebdav) return;
    setIsSyncingWebdav(true);
    setWebdavError(null);
    try {
      await syncDriveNow(activeDavId);
      showAndroidToast('Synced to WebDAV / Nextcloud', 2400, 'success');
    } catch (err: any) {
      const msg = err?.message || 'WebDAV sync failed.';
      setWebdavError(msg);
      showAndroidToast(msg, 3000, 'error');
    } finally {
      setIsSyncingWebdav(false);
    }
  };

  const handleDisconnectWebdav = () => {
    updateDriveConfig('webdav', {
      enabled: false,
      lastStatus: 'idle',
      password: '',
      lastSyncedAt: undefined,
      lastError: undefined,
    });
    updateDriveConfig('nextcloud', {
      enabled: false,
      lastStatus: 'idle',
      password: '',
      lastSyncedAt: undefined,
      lastError: undefined,
    });
    setIsWebdavExpanded(false);
    setWebdavError(null);
    refreshAllStates();
    showAndroidToast('WebDAV / Nextcloud disconnected', 2200, 'default');
  };

  // S3 / MinIO state
  const s3Cfg = joplinSyncSettings.drives.s3;
  const isS3Connected = Boolean(
    s3Cfg?.s3Endpoint?.trim() &&
      s3Cfg?.s3Bucket?.trim() &&
      s3Cfg?.s3AccessKey?.trim() &&
      s3Cfg?.s3SecretKey?.trim() &&
      (s3Cfg?.enabled || s3Cfg?.lastStatus === 'synced' || s3Cfg?.lastSyncedAt)
  );

  const s3Status: SyncRowStatus = !isS3Connected
    ? 'disconnected'
    : isSyncingS3 || s3Cfg?.lastStatus === 'syncing'
      ? 'syncing'
      : s3Error || s3Cfg?.lastStatus === 'error'
        ? 'error'
        : s3Cfg?.lastSyncedAt
          ? 'synced'
          : 'connected';

  const handleSaveAndConnectS3 = async () => {
    if (
      !s3Cfg?.s3Endpoint?.trim() ||
      !s3Cfg?.s3Bucket?.trim() ||
      !s3Cfg?.s3AccessKey?.trim() ||
      !s3Cfg?.s3SecretKey?.trim()
    ) {
      setS3Error('Enter Endpoint, Bucket, Access Key, and Secret Key.');
      return;
    }
    setIsTestingS3(true);
    setS3Error(null);
    try {
      const res = await checkDriveConfiguration('s3');
      if (!res.success) {
        setS3Error(res.message);
        return;
      }
      updateDriveConfig('s3', {
        enabled: true,
        lastStatus: 'synced',
        lastError: undefined,
      });
      activateSyncProviderIfNone('s3');
      await syncDriveNow('s3');
      setIsS3Expanded(false);
      refreshAllStates();
      showAndroidToast('Connected & synced to S3 / MinIO', 2600, 'success');
    } catch (err: any) {
      setS3Error(err?.message || 'Could not connect to S3 bucket.');
    } finally {
      setIsTestingS3(false);
    }
  };

  const handleSyncS3Now = async () => {
    if (isSyncingS3) return;
    setIsSyncingS3(true);
    setS3Error(null);
    try {
      await syncDriveNow('s3');
      showAndroidToast('Synced to S3 / MinIO', 2400, 'success');
    } catch (err: any) {
      const msg = err?.message || 'S3 sync failed.';
      setS3Error(msg);
      showAndroidToast(msg, 3000, 'error');
    } finally {
      setIsSyncingS3(false);
    }
  };

  const handleDisconnectS3 = () => {
    updateDriveConfig('s3', {
      enabled: false,
      lastStatus: 'idle',
      s3AccessKey: '',
      s3SecretKey: '',
      lastSyncedAt: undefined,
      lastError: undefined,
    });
    setIsS3Expanded(false);
    setS3Error(null);
    refreshAllStates();
    showAndroidToast('S3 / MinIO disconnected', 2200, 'default');
  };

  // Local / Syncthing folder handlers
  const handlePickSyncthingFolder = async () => {
    try {
      const next = await pickSyncthingFolder();
      setSyncthingState(next);
      activateSyncProviderIfNone('local_folder');
      const localObj = JSON.parse(exportEncryptedJSON());
      await pushToSyncthingFolder(localObj);
      await pullFromSyncthingFolder(localObj);
      refreshAllStates();
      showAndroidToast(`Connected folder: ${next.folderName}`, 2500, 'success');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showAndroidToast(err?.message || 'Could not select folder', 2800, 'error');
      }
    }
  };

  const handleSyncSyncthingNow = async () => {
    try {
      const localObj = JSON.parse(exportEncryptedJSON());
      const pulled = await pullFromSyncthingFolder(localObj);
      if (pulled.peerFilesMerged > 0) {
        replaceAllAppDataFromBackup(JSON.stringify(pulled.mergedData));
      }
      await pushToSyncthingFolder(pulled.mergedData);
      setSyncthingState(getSyncthingFolderState());
      showAndroidToast(
        pulled.peerFilesMerged > 0
          ? `Synced & merged ${pulled.peerFilesMerged} device file(s)`
          : `Updated ${syncthingState.deviceFileName}`,
        2500,
        'success'
      );
    } catch (err: any) {
      showAndroidToast(err?.message || 'Local folder sync failed', 2800, 'error');
    }
  };

  // Local export/restore handlers
  const handleExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const payload = exportEncryptedJSON();
      await saveRotatingAutoSnapshot(payload);
      await refreshSnapshots();
      const res = await exportLocalBackup(payload);
      if (res.success) {
        showAndroidToast(`Exported ${res.filename}`, 2600, 'success');
      } else {
        showAndroidToast(res.error || 'Export failed', 3000, 'error');
      }
    } catch (err: any) {
      showAndroidToast(err?.message || 'Export failed', 3000, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const rawText = await file.text();
      const validation = validateBackupPayload(rawText);
      if (!validation.valid) {
        const errMsg = 'error' in validation ? validation.error : 'Invalid backup file';
        showAndroidToast(errMsg, 3200, 'error');
        return;
      }
      setPendingRestore({
        sourceLabel: file.name,
        normalizedJsonString: JSON.stringify(validation.data),
      });
    } catch (err: any) {
      showAndroidToast(err?.message || 'Failed to read backup file', 3000, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleStageSnapshotRestore = async (snap: LocalSnapshotMeta) => {
    const raw = await readLocalSnapshot(snap.filename);
    if (!raw) {
      showAndroidToast('Could not load auto-snapshot', 2800, 'error');
      return;
    }
    const validation = validateBackupPayload(raw);
    if (!validation.valid) {
      showAndroidToast('Auto-snapshot is corrupted', 3000, 'error');
      return;
    }
    setPendingRestore({
      sourceLabel: `Snapshot #${snap.slot}`,
      normalizedJsonString: JSON.stringify(validation.data),
    });
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      await saveRotatingAutoSnapshot(exportEncryptedJSON());
    } catch {}
    const ok = replaceAllAppDataFromBackup(pendingRestore.normalizedJsonString);
    if (ok) {
      setPendingRestore(null);
      await refreshSnapshots();
      showAndroidToast(`Restored from ${pendingRestore.sourceLabel}`, 2800, 'success');
    } else {
      showAndroidToast('Could not restore backup data', 3200, 'error');
    }
  };

  const activeProviderName =
    syncSettings.activeProvider !== 'none'
      ? PROVIDER_DISPLAY_NAMES[syncSettings.activeProvider]
      : null;

  const connectedSyncProvidersList = useMemo(() => {
    const list: Array<{ id: Exclude<ActiveSyncProviderId, 'none'>; name: string }> = [];
    const order: Array<Exclude<ActiveSyncProviderId, 'none'>> = [
      'firebase',
      'gdrive',
      'dropbox',
      'telegram',
      'webdav',
      'local_folder',
      'mega',
      's3',
    ];
    order.forEach((id) => {
      if (connectedIdSet.has(id)) {
        list.push({ id, name: PROVIDER_DISPLAY_NAMES[id] });
      }
    });
    return list;
  }, [connectedIdSet]);

  const connectedBackupDestinationsList = useMemo(() => {
    const list: Array<{ id: BackupDestinationId; name: string }> = [
      { id: 'local', name: 'Local Device (Always enabled)' },
    ];
    connectedSyncProvidersList.forEach((p) => {
      list.push({ id: p.id, name: p.name });
    });
    return list;
  }, [connectedSyncProvidersList]);

  const handleManualProviderBackup = useCallback(
    (destId: BackupDestinationId, label: string) => {
      showAndroidToast(`Taking manual backup to ${label}…`, 2200, 'default');
      triggerUnifiedBackupNow(undefined, destId);
    },
    []
  );

  const localBackupStatus = backupSettings.destinationStatuses.local;
  const localFolderLabel =
    backupSettings.localFolderMode === 'custom' && backupSettings.localCustomFolderName
      ? `${backupSettings.localCustomFolderName}/Backups`
      : 'Documents/JivanOS/Backups';

  return (
    <div className="w-full max-w-[640px] mx-auto pb-8 animate-view-enter">
      <SettingsSubpageHeader title="Sync & Backup" onBack={onBack} />

      <div className="space-y-4 pt-1">
        {/* Compact Auto-Sync Status & Rules Bar */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          {/* Top line on mobile / Left side on desktop */}
          <div className="flex items-center justify-between gap-2.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  !activeProviderName
                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                    : syncSettings.status === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : syncSettings.status === 'waiting'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {syncSettings.status === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : syncSettings.status === 'error' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : syncSettings.status === 'waiting' ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {activeProviderName
                    ? `Auto-sync · ${activeProviderName}`
                    : 'Auto-sync off'}
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                  {!activeProviderName
                    ? 'Connect a provider below to sync automatically'
                    : syncSettings.status === 'syncing'
                      ? 'Syncing across devices…'
                      : syncSettings.status === 'waiting'
                        ? 'Saving recent changes…'
                        : syncSettings.status === 'error' && syncSettings.lastError
                          ? syncSettings.lastError
                          : syncSettings.lastSyncedAt
                            ? `Synced ${formatRelativeSyncTime(syncSettings.lastSyncedAt)} · Silent merge`
                            : 'Ready · Auto-syncs edits in background'}
                </div>
              </div>
            </div>

            {/* Mobile-only Sync Now button on top right so status + primary action stay on line 1 */}
            {activeProviderName && (
              <button
                type="button"
                disabled={syncSettings.status === 'syncing'}
                onClick={() => triggerUnifiedSyncNow(true)}
                className="sm:hidden h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncSettings.status === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                <span>Sync now</span>
              </button>
            )}
          </div>

          {/* Rules & Desktop Sync Now Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 sm:pl-0 pl-10">
            <button
              type="button"
              id="btn-open-sync-rules"
              onClick={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerName: activeProviderName || 'Auto-Sync',
                  connectedProviders: connectedSyncProvidersList,
                })
              }
              className="h-7.5 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sync Rules</span>
            </button>

            <button
              type="button"
              id="btn-open-backup-rules"
              onClick={() =>
                setPopupTarget({
                  mode: 'backup',
                  providerName: 'Backup Rules',
                  connectedDestinations: connectedBackupDestinationsList,
                })
              }
              className="h-7.5 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Backup Rules</span>
            </button>

            {activeProviderName && (
              <button
                type="button"
                id="btn-unified-sync-now"
                disabled={syncSettings.status === 'syncing'}
                onClick={() => triggerUnifiedSyncNow(true)}
                className="hidden sm:inline-flex h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold items-center gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncSettings.status === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                <span>Sync now</span>
              </button>
            )}
          </div>
        </div>

        {/* Cloud & Sync Providers — Unified Compact List */}
        <section className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-zinc-500 px-1">
            Cloud &amp; Sync Providers
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800/80">
            {/* 1. JivanOS Cloud */}
            <JivanOSCloudSection
              isFirst
              isActiveSyncProvider={syncSettings.activeProvider === 'firebase'}
              isBackupEnabled={Boolean(backupSettings.destinations.firebase)}
              isBackingUp={backupSettings.destinationStatuses.firebase?.state === 'running'}
              onBackupNow={() => handleManualProviderBackup('firebase', 'JivanOS Cloud')}
              onOpenSyncOptions={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerId: 'firebase',
                  providerName: 'JivanOS Cloud',
                })
              }
              onOpenBackupOptions={(onRestore) =>
                setPopupTarget({
                  mode: 'backup',
                  destinationId: 'firebase',
                  providerName: 'JivanOS Cloud',
                  onRestoreFromProvider: onRestore,
                })
              }
            />

            {/* 2. Google Drive */}
            <GoogleDriveSyncSection
              isActiveSyncProvider={syncSettings.activeProvider === 'gdrive'}
              isBackupEnabled={Boolean(backupSettings.destinations.gdrive)}
              isBackingUp={backupSettings.destinationStatuses.gdrive?.state === 'running'}
              onBackupNow={() => handleManualProviderBackup('gdrive', 'Google Drive')}
              onOpenSyncOptions={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerId: 'gdrive',
                  providerName: 'Google Drive',
                })
              }
              onOpenBackupOptions={(onRestore) =>
                setPopupTarget({
                  mode: 'backup',
                  destinationId: 'gdrive',
                  providerName: 'Google Drive',
                  onRestoreFromProvider: onRestore,
                })
              }
            />

            {/* 3. Dropbox */}
            <DropboxSyncSection
              isActiveSyncProvider={syncSettings.activeProvider === 'dropbox'}
              isBackupEnabled={Boolean(backupSettings.destinations.dropbox)}
              isBackingUp={backupSettings.destinationStatuses.dropbox?.state === 'running'}
              onBackupNow={() => handleManualProviderBackup('dropbox', 'Dropbox')}
              onOpenSyncOptions={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerId: 'dropbox',
                  providerName: 'Dropbox',
                })
              }
              onOpenBackupOptions={(onRestore) =>
                setPopupTarget({
                  mode: 'backup',
                  destinationId: 'dropbox',
                  providerName: 'Dropbox',
                  onRestoreFromProvider: onRestore,
                })
              }
            />

            {/* 4. Telegram */}
            <TelegramSyncSection
              isActiveSyncProvider={syncSettings.activeProvider === 'telegram'}
              isBackupEnabled={Boolean(backupSettings.destinations.telegram)}
              isBackingUp={backupSettings.destinationStatuses.telegram?.state === 'running'}
              onBackupNow={() => handleManualProviderBackup('telegram', 'Telegram')}
              onOpenSyncOptions={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerId: 'telegram',
                  providerName: 'Telegram',
                })
              }
              onOpenBackupOptions={(onRestore) =>
                setPopupTarget({
                  mode: 'backup',
                  destinationId: 'telegram',
                  providerName: 'Telegram',
                  onRestoreFromProvider: onRestore,
                })
              }
            />

            {/* 5. WebDAV / Nextcloud */}
            <SyncProviderRow
              name="WebDAV / Nextcloud"
              description="Self-hosted server sync"
              logo={<Globe className="w-4.5 h-4.5 text-[#0082C9]" />}
              logoBgClass="bg-sky-50 dark:bg-sky-950/60"
              brandColor="#0082C9"
              isConnected={isWebdavConnected}
              status={webdavStatus}
              accountLabel={
                isWebdavConnected ? `${davCfg.username}@${webdavHost}` : undefined
              }
              metaLine={
                isWebdavConnected
                  ? davCfg?.lastSyncedAt
                    ? `Synced ${formatRelativeSyncTime(davCfg.lastSyncedAt)}`
                    : 'Ready to sync'
                  : undefined
              }
              connectLabel={isWebdavExpanded ? 'Close' : 'Connect'}
              connectButtonId="btn-connect-webdav"
              onConnect={() => setIsWebdavExpanded((v) => !v)}
              onSyncNow={isWebdavConnected ? handleSyncWebdavNow : undefined}
              onBackupNow={
                isWebdavConnected
                  ? () => handleManualProviderBackup('webdav', 'WebDAV / Nextcloud')
                  : undefined
              }
              isBackingUp={backupSettings.destinationStatuses.webdav?.state === 'running'}
              onOpenSyncOptions={
                isWebdavConnected
                  ? () =>
                       setPopupTarget({
                        mode: 'sync',
                        providerId: 'webdav',
                        providerName: 'WebDAV / Nextcloud',
                      })
                  : undefined
              }
              onOpenBackupOptions={
                isWebdavConnected
                  ? () =>
                      setPopupTarget({
                        mode: 'backup',
                        destinationId: 'webdav',
                        providerName: 'WebDAV / Nextcloud',
                      })
                  : undefined
              }
              isActiveSyncProvider={syncSettings.activeProvider === 'webdav'}
              isBackupEnabled={Boolean(backupSettings.destinations.webdav)}
              isSyncing={isSyncingWebdav}
              onRetry={handleSyncWebdavNow}
              onDisconnect={isWebdavConnected ? handleDisconnectWebdav : undefined}
              extraMenuItems={
                isWebdavConnected
                  ? [
                      {
                        id: 'edit-webdav',
                        label: isWebdavExpanded
                          ? 'Hide server settings'
                          : 'Edit server settings',
                        onClick: () => setIsWebdavExpanded((v) => !v),
                      },
                    ]
                  : []
              }
              errorMessage={webdavError || davCfg?.lastError || null}
              isExpanded={isWebdavExpanded}
              expandedContent={
                <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 p-3 space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Server URL (Nextcloud, OwnCloud, Synology, or WebDAV)
                    </label>
                    <input
                      type="url"
                      value={davCfg?.serverUrl || ''}
                      onChange={(e) =>
                        updateDriveConfig(activeDavId, { serverUrl: e.target.value })
                      }
                      placeholder="https://cloud.example.com/remote.php/dav/files/user/JivanOS"
                      className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={davCfg?.username || ''}
                        onChange={(e) =>
                          updateDriveConfig(activeDavId, { username: e.target.value })
                        }
                        placeholder="username"
                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                        App Password
                      </label>
                      <input
                        type="password"
                        value={davCfg?.password || ''}
                        onChange={(e) =>
                          updateDriveConfig(activeDavId, { password: e.target.value })
                        }
                        placeholder="••••••••••••"
                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsWebdavExpanded(false)}
                      className="h-9 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAndConnectWebdav}
                      disabled={isTestingWebdav}
                      className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {isTestingWebdav ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying…</span>
                        </>
                      ) : (
                        <span>Verify &amp; Connect</span>
                      )}
                    </button>
                  </div>
                </div>
              }
            />

            {/* 6. Local / Syncthing folder */}
            <SyncProviderRow
              name="Local / Syncthing folder"
              description="Shared local or Syncthing folder"
              logo={<FolderSync className="w-4.5 h-4.5 text-[#0891B2]" />}
              logoBgClass="bg-cyan-50 dark:bg-cyan-950/60"
              brandColor="#0891B2"
              isConnected={syncthingState.connected}
              status={
                !syncthingState.connected
                  ? 'disconnected'
                  : syncthingState.lastError
                    ? 'error'
                    : syncthingState.lastSyncedAt
                      ? 'synced'
                      : 'connected'
              }
              accountLabel={
                syncthingState.connected
                  ? `${syncthingState.folderName} (${syncthingState.deviceFileName})`
                  : undefined
              }
              metaLine={
                syncthingState.connected
                  ? syncthingState.lastSyncedAt
                    ? `Synced ${formatRelativeSyncTime(syncthingState.lastSyncedAt)}`
                    : 'Folder ready'
                  : undefined
              }
              connectLabel="Connect"
              connectButtonId="btn-connect-syncthing-folder"
              onConnect={handlePickSyncthingFolder}
              onSyncNow={syncthingState.connected ? handleSyncSyncthingNow : undefined}
              onBackupNow={
                syncthingState.connected
                  ? () => handleManualProviderBackup('local_folder', 'Local / Syncthing')
                  : undefined
              }
              isBackingUp={
                backupSettings.destinationStatuses.local_folder?.state === 'running'
              }
              onOpenSyncOptions={
                syncthingState.connected
                  ? () =>
                      setPopupTarget({
                        mode: 'sync',
                        providerId: 'local_folder',
                        providerName: 'Local / Syncthing',
                      })
                  : undefined
              }
              onOpenBackupOptions={
                syncthingState.connected
                  ? () =>
                      setPopupTarget({
                        mode: 'backup',
                        destinationId: 'local_folder',
                        providerName: 'Local / Syncthing',
                      })
                  : undefined
              }
              isActiveSyncProvider={syncSettings.activeProvider === 'local_folder'}
              isBackupEnabled={Boolean(backupSettings.destinations.local_folder)}
              onDisconnect={
                syncthingState.connected
                  ? async () => {
                      await disconnectSyncthingFolder();
                      refreshAllStates();
                      showAndroidToast('Local / Syncthing folder disconnected', 2200, 'default');
                    }
                  : undefined
              }
              extraMenuItems={
                syncthingState.connected
                  ? [
                      {
                        id: 'change-syncthing-folder',
                        label: 'Change folder…',
                        onClick: handlePickSyncthingFolder,
                      },
                    ]
                  : []
              }
            />

            {/* 7. MEGA */}
            <MEGASyncSection
              isLast
              isActiveSyncProvider={syncSettings.activeProvider === 'mega'}
              isBackupEnabled={Boolean(backupSettings.destinations.mega)}
              isBackingUp={backupSettings.destinationStatuses.mega?.state === 'running'}
              onBackupNow={() => handleManualProviderBackup('mega', 'MEGA')}
              onOpenSyncOptions={() =>
                setPopupTarget({
                  mode: 'sync',
                  providerId: 'mega',
                  providerName: 'MEGA',
                })
              }
              onOpenBackupOptions={(onRestore) =>
                setPopupTarget({
                  mode: 'backup',
                  destinationId: 'mega',
                  providerName: 'MEGA',
                  onRestoreFromProvider: onRestore,
                })
              }
            />
          </div>

          {/* Optional Advanced S3 / MinIO */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowAdvancedS3((v) => !v)}
              className="px-1 py-1 text-[11.5px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 inline-flex items-center gap-1 transition cursor-pointer"
            >
              {showAdvancedS3 || isS3Connected ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>Advanced (S3 / R2 / MinIO)</span>
            </button>

            {(showAdvancedS3 || isS3Connected) && (
              <div className="mt-1 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <SyncProviderRow
                  name="S3 / MinIO"
                  description="AWS S3, Cloudflare R2, or MinIO"
                  logo={<Server className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />}
                  logoBgClass="bg-amber-50 dark:bg-amber-950/60"
                  brandColor="#D97706"
                  isConnected={isS3Connected}
                  status={s3Status}
                  accountLabel={isS3Connected ? s3Cfg?.s3Bucket : undefined}
                  metaLine={
                    isS3Connected
                      ? s3Cfg?.lastSyncedAt
                        ? `Synced ${formatRelativeSyncTime(s3Cfg.lastSyncedAt)}`
                        : 'Ready to sync'
                      : undefined
                  }
                  connectLabel={isS3Expanded ? 'Close' : 'Connect'}
                  onConnect={() => setIsS3Expanded((v) => !v)}
                  onSyncNow={isS3Connected ? handleSyncS3Now : undefined}
                  onBackupNow={
                    isS3Connected
                      ? () => handleManualProviderBackup('s3', 'S3 / MinIO')
                      : undefined
                  }
                  isBackingUp={backupSettings.destinationStatuses.s3?.state === 'running'}
                  onOpenSyncOptions={
                    isS3Connected
                      ? () =>
                          setPopupTarget({
                            mode: 'sync',
                            providerId: 's3',
                            providerName: 'S3 / MinIO',
                          })
                      : undefined
                  }
                  onOpenBackupOptions={
                    isS3Connected
                      ? () =>
                          setPopupTarget({
                            mode: 'backup',
                            destinationId: 's3',
                            providerName: 'S3 / MinIO',
                          })
                      : undefined
                  }
                  isActiveSyncProvider={syncSettings.activeProvider === 's3'}
                  isBackupEnabled={Boolean(backupSettings.destinations.s3)}
                  isSyncing={isSyncingS3}
                  onRetry={handleSyncS3Now}
                  onDisconnect={isS3Connected ? handleDisconnectS3 : undefined}
                  errorMessage={s3Error || s3Cfg?.lastError || null}
                  isExpanded={isS3Expanded}
                  isFirst
                  isLast
                  expandedContent={
                    <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 p-3 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                            Endpoint URL
                          </label>
                          <input
                            type="url"
                            value={s3Cfg?.s3Endpoint || ''}
                            onChange={(e) =>
                              updateDriveConfig('s3', { s3Endpoint: e.target.value })
                            }
                            placeholder="https://s3.us-east-1.amazonaws.com"
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                            Bucket Name
                          </label>
                          <input
                            type="text"
                            value={s3Cfg?.s3Bucket || ''}
                            onChange={(e) =>
                              updateDriveConfig('s3', { s3Bucket: e.target.value })
                            }
                            placeholder="jivanos-backups"
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                            Access Key ID
                          </label>
                          <input
                            type="text"
                            value={s3Cfg?.s3AccessKey || ''}
                            onChange={(e) =>
                              updateDriveConfig('s3', { s3AccessKey: e.target.value })
                            }
                            placeholder="AKIA..."
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                            Secret Access Key
                          </label>
                          <input
                            type="password"
                            value={s3Cfg?.s3SecretKey || ''}
                            onChange={(e) =>
                              updateDriveConfig('s3', { s3SecretKey: e.target.value })
                            }
                            placeholder="••••••••••••••••"
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsS3Expanded(false)}
                          className="h-9 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAndConnectS3}
                          disabled={isTestingS3}
                          className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {isTestingS3 ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying…</span>
                            </>
                          ) : (
                            <span>Verify &amp; Connect</span>
                          )}
                        </button>
                      </div>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </section>

        {/* Compact Local Device Backup & File Export/Restore */}
        <section className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-zinc-500 px-1">
            Local Device Backup
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800/80 overflow-hidden">
            {/* Local Backup Row with [Backup] popup trigger */}
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    This Device
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                    {localFolderLabel}
                    {localBackupStatus?.lastBackupAt
                      ? ` · ${formatRelativeSyncTime(localBackupStatus.lastBackupAt)}`
                      : ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-local-backup-options"
                onClick={() =>
                  setPopupTarget({
                    mode: 'backup',
                    destinationId: 'local',
                    providerName: 'Local Device',
                  })
                }
                className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Backup</span>
              </button>
            </div>

            {/* Export / Restore File Row */}
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-export-local-file"
                disabled={isExporting}
                onClick={handleExportBackup}
                className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>Export File</span>
              </button>

              <button
                type="button"
                id="btn-restore-local-file"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                {isImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>Restore File</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Pending Restore Confirmation Banner */}
            {pendingRestore && (
              <div className="px-4 py-3 bg-amber-50/90 dark:bg-amber-950/35 space-y-2.5">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Restore from <span className="underline">{pendingRestore.sourceLabel}</span>?
                </div>
                <p className="text-[11.5px] text-amber-800/90 dark:text-amber-300/90 leading-snug">
                  Your current data will be saved as an auto-snapshot first, then replaced with this
                  backup.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingRestore(null)}
                    className="h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    className="h-9 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Confirm Restore
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Auto-Snapshots */}
            {snapshots.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSnapshots((v) => !v)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition cursor-pointer"
                >
                  <span>Recent Auto-Snapshots ({snapshots.length})</span>
                  {showSnapshots ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showSnapshots && (
                  <div className="px-4 pb-3 space-y-2">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.filename}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">
                            Snapshot #{snap.slot}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {formatRelativeSyncTime(snap.timestamp)} ·{' '}
                            {formatDriveFileSize(snap.sizeBytes)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStageSnapshotRestore(snap)}
                          className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition cursor-pointer shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Unified Per-Provider [Sync] & [Backup] Popup Modal */}
      <ProviderSyncBackupModals
        target={popupTarget}
        onClose={() => setPopupTarget(null)}
        syncSettings={syncSettings}
        backupSettings={backupSettings}
        onSettingsChanged={refreshAllStates}
      />
    </div>
  );
};
