import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FolderOpen,
  FolderSync,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Wifi,
  Zap,
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
  BackupScheduleMinutes,
  SYNCTHING_FOLDER_STATE_EVENT,
  SyncReceiveIntervalMinutes,
  UNIFIED_BACKUP_STATE_EVENT,
  UNIFIED_SYNC_STATE_EVENT,
  computeNextScheduledBackupIso,
  disconnectSyncthingFolder,
  getSyncthingFolderState,
  getUnifiedBackupSettings,
  getUnifiedSyncSettings,
  pickCustomLocalBackupFolder,
  pickSyncthingFolder,
  pullFromSyncthingFolder,
  pushToSyncthingFolder,
  saveUnifiedBackupSettings,
  saveUnifiedSyncSettings,
} from '../../sync/unifiedSyncBackupEngine';
import {
  triggerUnifiedBackupNow,
  triggerUnifiedSyncNow,
} from '../../sync/UnifiedSyncBackupCoordinator';

interface BackupSyncScreenProps {
  onBack: () => void;
}

const SYNC_PROVIDER_OPTIONS: Array<{
  id: ActiveSyncProviderId;
  label: string;
  badge?: string;
}> = [
  { id: 'none', label: 'Off (No active sync)' },
  { id: 'firebase', label: 'JivanOS Cloud' },
  { id: 'gdrive', label: 'Google Drive' },
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'webdav', label: 'WebDAV / Nextcloud' },
  { id: 'telegram', label: 'Telegram (Basic)', badge: 'Basic' },
  { id: 'local_folder', label: 'Local / Syncthing folder' },
  { id: 'mega', label: 'MEGA' },
  { id: 's3', label: 'S3 / MinIO' },
];

const RECEIVE_INTERVAL_OPTIONS: Array<{
  value: SyncReceiveIntervalMinutes;
  label: string;
}> = [
  { value: 0, label: 'Manual only' },
  { value: 5, label: 'Every 5 min' },
  { value: 15, label: 'Every 15 min (default)' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every 1 hour' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' },
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

const BACKUP_DESTINATIONS_META: Array<{
  id: BackupDestinationId;
  label: string;
  sublabel: string;
  required?: boolean;
}> = [
  {
    id: 'local',
    label: 'Local folder',
    sublabel: 'Documents/JivanOS/Backups (Always on & required)',
    required: true,
  },
  {
    id: 'gdrive',
    label: 'Google Drive',
    sublabel: 'Backups/JivanOS-YYYY-MM-DD-HHmm.json',
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    sublabel: '/Backups/JivanOS-YYYY-MM-DD-HHmm.json',
  },
  {
    id: 'telegram',
    label: 'Telegram (Basic)',
    sublabel: 'History copy in bot chat (tries deleteMessage > 4)',
  },
  {
    id: 'webdav',
    label: 'WebDAV / Nextcloud',
    sublabel: 'Backups/JivanOS-YYYY-MM-DD-HHmm.json',
  },
  {
    id: 'local_folder',
    label: 'Local / Syncthing folder',
    sublabel: 'Backups/JivanOS-YYYY-MM-DD-HHmm.json',
  },
  {
    id: 'firebase',
    label: 'JivanOS Cloud',
    sublabel: 'Cloud backup snapshot',
  },
];

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
  const [backupPasswordInput, setBackupPasswordInput] = useState('');
  const [showAdvancedBackup, setShowAdvancedBackup] = useState(false);

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

  // Auto-select the first connected provider if activeProvider is 'none' or disconnected
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
      await syncDriveNow(activeDavId);
      setIsWebdavExpanded(false);
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
      await syncDriveNow('s3');
      setIsS3Expanded(false);
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
    showAndroidToast('S3 / MinIO disconnected', 2200, 'default');
  };

  // Local / Syncthing folder handlers
  const handlePickSyncthingFolder = async () => {
    try {
      const next = await pickSyncthingFolder();
      setSyncthingState(next);
      const localObj = JSON.parse(exportEncryptedJSON());
      await pushToSyncthingFolder(localObj);
      await pullFromSyncthingFolder(localObj);
      setSyncthingState(getSyncthingFolderState());
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

  // Render Sync Status Chip: Synced / Syncing / Changes waiting to sync / Error
  const renderUnifiedSyncStatusChip = () => {
    const st = syncSettings.status;
    if (st === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 text-[11.5px] font-bold">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Syncing</span>
        </span>
      );
    }
    if (st === 'waiting') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 text-[11.5px] font-bold">
          <Clock className="w-3 h-3" />
          <span>Changes waiting to sync</span>
        </span>
      );
    }
    if (st === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11.5px] font-bold">
          <AlertCircle className="w-3 h-3" />
          <span>Error</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 text-[11.5px] font-bold">
        <CheckCircle2 className="w-3 h-3" />
        <span>Synced</span>
      </span>
    );
  };

  // Hide 5 min option when Telegram is the active sync provider (min pull interval for Telegram is 15m)
  const visibleReceiveIntervals = useMemo(
    () =>
      RECEIVE_INTERVAL_OPTIONS.filter((opt) =>
        syncSettings.activeProvider === 'telegram' ? opt.value !== 5 : true
      ),
    [syncSettings.activeProvider]
  );

  return (
    <div className="w-full max-w-[640px] mx-auto pb-8 animate-view-enter">
      <SettingsSubpageHeader title="Sync & Backup" onBack={onBack} />

      <div className="space-y-6 pt-1">
        {/* FIRST-RUN SETUP BANNER (Asks for local backup folder & shows defaults) */}
        {!backupSettings.firstRunCompleted && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/75 dark:bg-indigo-950/35 p-4 space-y-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-zinc-100">
                  First-Run Backup &amp; Sync Setup
                </h3>
                <p className="text-[11.5px] text-slate-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
                  Choose your local backup folder. Defaults: Receive sync every{' '}
                  <span className="font-semibold">15 min</span> · History backup every{' '}
                  <span className="font-semibold">24 hours at 1:00 AM</span> (only if changed, keeps
                  last 4) · Network: <span className="font-semibold">Wi-Fi by default</span>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const next = saveUnifiedBackupSettings({
                    localFolderMode: 'jivanos_default',
                    firstRunCompleted: true,
                  });
                  setBackupSettings(next);
                  showAndroidToast(
                    'Using JivanOS folder (Documents/JivanOS/Backups)',
                    2400,
                    'success'
                  );
                }}
                className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Use JivanOS Folder (Documents/JivanOS/Backups)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const folderName = await pickCustomLocalBackupFolder();
                    setBackupSettings(getUnifiedBackupSettings());
                    if (folderName) {
                      showAndroidToast(`Local backup folder: ${folderName}`, 2400, 'success');
                    } else {
                      const next = saveUnifiedBackupSettings({
                        localFolderMode: 'jivanos_default',
                        firstRunCompleted: true,
                      });
                      setBackupSettings(next);
                    }
                  } catch {
                    // User cancelled picker
                  }
                }}
                className="h-9 px-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Pick Custom Folder…</span>
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            SECTION A: SYNC (Keeps devices identical)
           ===================================================================== */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-indigo-600 dark:text-indigo-400">
                A. Sync · Keeps Devices Identical
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                Pushes ~30s after edits &amp; on background · Pulls on open, foreground &amp; timer
              </p>
            </div>
            {renderUnifiedSyncStatusChip()}
          </div>

          {/* Compact M3 Sync Settings Card */}
          <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#F0F0F0] dark:divide-zinc-800/80 overflow-hidden">
            {/* Row 1: Active Sync Provider (Pick ONE) + Sync Now button */}
            <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-slate-900 dark:text-zinc-100">
                  Active sync provider
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Pick one connected provider to keep devices identical
                  {syncSettings.lastSyncedAt
                    ? ` · Last synced ${formatRelativeSyncTime(syncSettings.lastSyncedAt)}`
                    : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Active sync provider"
                  value={syncSettings.activeProvider}
                  onChange={(e) => {
                    const nextProvider = e.target.value as ActiveSyncProviderId;
                    if (nextProvider !== 'none' && !connectedIdSet.has(nextProvider)) {
                      showAndroidToast(
                        'Connect that provider in the list below first.',
                        2600,
                        'default'
                      );
                      return;
                    }
                    const next = saveUnifiedSyncSettings({
                      activeProvider: nextProvider,
                      lastError: null,
                    });
                    setSyncSettings(next);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none"
                >
                  {SYNC_PROVIDER_OPTIONS.map((opt) => {
                    const isConn = opt.id === 'none' || connectedIdSet.has(opt.id);
                    return (
                      <option key={opt.id} value={opt.id} disabled={!isConn}>
                        {opt.label}
                        {!isConn ? ' (Connect below)' : ''}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  id="btn-unified-sync-now"
                  disabled={
                    syncSettings.activeProvider === 'none' || syncSettings.status === 'syncing'
                  }
                  onClick={() => triggerUnifiedSyncNow(true)}
                  className="h-9 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncSettings.status === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Sync now</span>
                </button>
              </div>
            </div>

            {/* Row 2: Receive (Pull) Interval Dropdown */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                  Receive updates while app is open
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {syncSettings.activeProvider === 'telegram'
                    ? 'Telegram minimum pull interval is 15 minutes (uses pinned live message)'
                    : 'Also receives automatically on app open and return to foreground'}
                </div>
              </div>

              <select
                aria-label="Receive sync interval"
                value={syncSettings.receiveIntervalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value) as SyncReceiveIntervalMinutes;
                  const next = saveUnifiedSyncSettings({ receiveIntervalMinutes: val });
                  setSyncSettings(next);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 outline-none shrink-0"
              >
                {visibleReceiveIntervals.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 3: Sync Network Mode (Wi-Fi only default ON vs Wi-Fi & Mobile data) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                    Sync network connection
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {syncSettings.wifiOnly
                      ? 'Wi-Fi only (default)'
                      : 'Wi-Fi & Mobile data enabled'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Sync network preference"
                  value={syncSettings.wifiOnly ? 'wifi' : 'both'}
                  onChange={(e) => {
                    const wifiOnly = e.target.value === 'wifi';
                    const next = saveUnifiedSyncSettings({ wifiOnly });
                    setSyncSettings(next);
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 outline-none"
                >
                  <option value="wifi">Wi-Fi only (default)</option>
                  <option value="both">Wi-Fi &amp; Mobile data</option>
                </select>
              </div>
            </div>

            {syncSettings.lastError && (
              <div className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-[11.5px] text-rose-700 dark:text-rose-300">
                {syncSettings.lastError}
              </div>
            )}
          </div>

          {/* Connected & Available Providers List (Compact ColorOS-style rows) */}
          <div className="pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-zinc-500 px-1 mb-1.5">
              Connect &amp; Manage Providers
            </div>

            <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#F0F0F0] dark:divide-zinc-800/80">
              {/* 1. JivanOS Cloud */}
              <JivanOSCloudSection />

              {/* 2. Google Drive */}
              <GoogleDriveSyncSection />

              {/* 3. Dropbox */}
              <DropboxSyncSection />

              {/* 4. Telegram (labeled Basic) */}
              <TelegramSyncSection />

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
                      ? `Last synced ${formatRelativeSyncTime(davCfg.lastSyncedAt)}`
                      : 'Connected · Ready to sync'
                    : undefined
                }
                connectLabel={isWebdavExpanded ? 'Close' : 'Connect →'}
                connectButtonId="btn-connect-webdav"
                onConnect={() => setIsWebdavExpanded((v) => !v)}
                onSyncNow={isWebdavConnected ? handleSyncWebdavNow : undefined}
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
                        className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
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
                          className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
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
                          className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsWebdavExpanded(false)}
                        className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAndConnectWebdav}
                        disabled={isTestingWebdav}
                        className="h-8 px-3.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
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

              {/* 6. Local / Syncthing folder (writes ONLY sync-<deviceId>.json, pulls other sync-*.json & *.sync-conflict-*) */}
              <SyncProviderRow
                name="Local / Syncthing folder"
                description={`Writes ${syncthingState.deviceFileName} · merges peer sync-*.json files`}
                extraLine="Tip: Add this folder to Syncthing on all your devices."
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
                    ? `${
                        syncthingState.lastSyncedAt
                          ? `Last synced ${formatRelativeSyncTime(syncthingState.lastSyncedAt)}`
                          : 'Folder ready'
                      } · Tip: Add this folder to Syncthing on all your devices.`
                    : undefined
                }
                connectLabel="Pick Folder →"
                connectButtonId="btn-connect-syncthing-folder"
                onConnect={handlePickSyncthingFolder}
                onSyncNow={syncthingState.connected ? handleSyncSyncthingNow : undefined}
                onDisconnect={
                  syncthingState.connected
                    ? async () => {
                        await disconnectSyncthingFolder();
                        setSyncthingState(getSyncthingFolderState());
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
              <MEGASyncSection isLast />
            </div>

            {/* Optional Advanced S3 / MinIO */}
            <div className="mt-2">
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
                <div className="mt-1 rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900">
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
                          ? `Last synced ${formatRelativeSyncTime(s3Cfg.lastSyncedAt)}`
                          : 'Connected · Ready to sync'
                        : undefined
                    }
                    connectLabel={isS3Expanded ? 'Close' : 'Connect →'}
                    onConnect={() => setIsS3Expanded((v) => !v)}
                    onSyncNow={isS3Connected ? handleSyncS3Now : undefined}
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
                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
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
                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
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
                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
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
                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsS3Expanded(false)}
                            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveAndConnectS3}
                            disabled={isTestingS3}
                            className="h-8 px-3.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
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
          </div>
        </section>

        {/* =====================================================================
            SECTION B: BACKUP (History copies, separate from sync)
           ===================================================================== */}
        <section className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                B. Backup · History Copies (Separate from Sync)
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                Saves Backups/JivanOS-YYYY-MM-DD-HHmm.json · Keeps last 4 backups per destination
              </p>
            </div>
            <button
              type="button"
              id="btn-unified-backup-now"
              onClick={() => triggerUnifiedBackupNow(backupPasswordInput || undefined)}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Back up now</span>
            </button>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#F0F0F0] dark:divide-zinc-800/80 overflow-hidden">
            {/* 1. Multi-select Backup Destinations Checklist */}
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-slate-900 dark:text-zinc-100">
                  Backup destinations (Multi-select · Keeps last 4 each)
                </span>
                {backupSettings.lastBackupAt && (
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Last run {formatRelativeSyncTime(backupSettings.lastBackupAt)}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {BACKUP_DESTINATIONS_META.map((dest) => {
                  const isConnected = dest.required || connectedIdSet.has(dest.id);
                  const isChecked = dest.required
                    ? true
                    : Boolean(backupSettings.destinations[dest.id]) && isConnected;
                  const st = backupSettings.destinationStatuses[dest.id];

                  return (
                    <div
                      key={dest.id}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border transition ${
                        isChecked
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                          : 'bg-slate-50/70 dark:bg-zinc-950/40 border-slate-200/70 dark:border-zinc-800/70'
                      } ${!isConnected ? 'opacity-60' : ''}`}
                    >
                      <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          data-raw-checkbox="true"
                          checked={isChecked}
                          disabled={dest.required || !isConnected}
                          onChange={(e) => {
                            if (dest.required || !isConnected) return;
                            const next = saveUnifiedBackupSettings({
                              destinations: {
                                ...backupSettings.destinations,
                                [dest.id]: e.target.checked,
                              },
                            });
                            setBackupSettings(next);
                          }}
                          className="w-4 h-4 rounded accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                              {dest.label}
                            </span>
                            {dest.required && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 text-[9.5px] font-bold uppercase text-slate-700 dark:text-zinc-300">
                                Required
                              </span>
                            )}
                            {!isConnected && (
                              <span className="text-[10.5px] text-slate-400 dark:text-zinc-500">
                                (Connect above to enable)
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                            {dest.sublabel}
                            {st?.keptFiles?.length
                              ? ` · ${st.keptFiles.length}/4 kept`
                              : ''}
                          </div>
                        </div>
                      </label>

                      {/* Per-Destination Status Chip */}
                      <div className="shrink-0">
                        {st?.state === 'running' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Backing up…</span>
                          </span>
                        ) : st?.state === 'error' ? (
                          <span
                            title={st.lastError || 'Backup failed'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10.5px] font-bold"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Error</span>
                          </span>
                        ) : st?.state === 'success' && st.lastBackupAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/75 text-emerald-800 dark:text-emerald-300 text-[10.5px] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Backed up</span>
                          </span>
                        ) : isChecked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold">
                            <span>Ready</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Local Destination Folder Selector */}
            <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                  Local backup destination
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {backupSettings.localFolderMode === 'custom' &&
                  backupSettings.localCustomFolderName
                    ? `Custom folder: ${backupSettings.localCustomFolderName}/Backups`
                    : 'JivanOS folder (Documents/JivanOS/Backups · survives uninstall)'}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = saveUnifiedBackupSettings({
                      localFolderMode: 'jivanos_default',
                      firstRunCompleted: true,
                    });
                    setBackupSettings(next);
                  }}
                  className={`h-8 px-2.5 rounded-lg text-[11.5px] font-semibold border transition cursor-pointer ${
                    backupSettings.localFolderMode === 'jivanos_default'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  JivanOS folder
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const folderName = await pickCustomLocalBackupFolder();
                      setBackupSettings(getUnifiedBackupSettings());
                      if (folderName) {
                        showAndroidToast(`Custom backup folder: ${folderName}`, 2400, 'success');
                      }
                    } catch {
                      // Cancelled
                    }
                  }}
                  className={`h-8 px-2.5 rounded-lg text-[11.5px] font-semibold border inline-flex items-center gap-1 transition cursor-pointer ${
                    backupSettings.localFolderMode === 'custom'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>
                    {backupSettings.localCustomFolderName || 'Pick folder…'}
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Schedule: "Back up every" dropdown + Time picker (default 1:00 AM for >= 24h) */}
            <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                  Back up every
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Missed scheduled backups run automatically the next time the app opens
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Back up every"
                  value={backupSettings.scheduleMinutes}
                  onChange={(e) => {
                    const mins = Number(e.target.value) as BackupScheduleMinutes;
                    const nextIso = computeNextScheduledBackupIso(
                      mins,
                      backupSettings.scheduledTime
                    );
                    const next = saveUnifiedBackupSettings({
                      scheduleMinutes: mins,
                      nextScheduledBackupAt: nextIso,
                    });
                    setBackupSettings(next);
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 outline-none"
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
                      const next = saveUnifiedBackupSettings({
                        scheduledTime: t,
                        nextScheduledBackupAt: nextIso,
                      });
                      setBackupSettings(next);
                    }}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 outline-none"
                  />
                )}
              </div>
            </div>

            {/* 4. "Only if something changed" (default ON) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                  Only if something changed
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Skips scheduled history backup when no data changed since the last backup
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Only if something changed"
                checked={backupSettings.onlyIfChanged}
                onChange={(e) => {
                  const next = saveUnifiedBackupSettings({
                    onlyIfChanged: e.target.checked,
                  });
                  setBackupSettings(next);
                }}
              />
            </div>

            {/* 5. "Password-protect backups (AES-256)" (default OFF) */}
            <div className="px-3.5 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Lock className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                      Password-protect backups (AES-256)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Encrypts history backup files with AES-256-GCM before saving
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Password-protect backups (AES-256)"
                  checked={backupSettings.passwordProtected}
                  onChange={(e) => {
                    const next = saveUnifiedBackupSettings({
                      passwordProtected: e.target.checked,
                    });
                    setBackupSettings(next);
                  }}
                />
              </div>

              {backupSettings.passwordProtected && (
                <div className="pt-1">
                  <input
                    type="password"
                    value={backupPasswordInput}
                    onChange={(e) => setBackupPasswordInput(e.target.value)}
                    placeholder="Enter AES-256 backup password…"
                    className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                  />
                </div>
              )}
            </div>

            {/* 6. Backup Network Preference (Wi-Fi only default ON vs Wi-Fi & Mobile data) */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-900 dark:text-zinc-100">
                    Backup network connection
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {backupSettings.wifiOnly
                      ? 'Wi-Fi only (default)'
                      : 'Wi-Fi & Mobile data enabled'}
                  </div>
                </div>
              </div>

              <select
                aria-label="Backup network preference"
                value={backupSettings.wifiOnly ? 'wifi' : 'both'}
                onChange={(e) => {
                  const wifiOnly = e.target.value === 'wifi';
                  const next = saveUnifiedBackupSettings({ wifiOnly });
                  setBackupSettings(next);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 outline-none shrink-0"
              >
                <option value="wifi">Wi-Fi only (default)</option>
                <option value="both">Wi-Fi &amp; Mobile data</option>
              </select>
            </div>

            {/* 7. Advanced -> "Only while charging" toggle (default OFF) */}
            <div className="px-3.5 py-2">
              <button
                type="button"
                onClick={() => setShowAdvancedBackup((v) => !v)}
                className="py-1 text-[11.5px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 inline-flex items-center gap-1 transition cursor-pointer"
              >
                {showAdvancedBackup ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>Advanced backup options</span>
              </button>

              {showAdvancedBackup && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-slate-900 dark:text-zinc-100">
                        Only while charging
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Runs scheduled background backups only when device is plugged in
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Only while charging"
                    checked={backupSettings.onlyWhileCharging}
                    onChange={(e) => {
                      const next = saveUnifiedBackupSettings({
                        onlyWhileCharging: e.target.checked,
                      });
                      setBackupSettings(next);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Manual File Export / Restore & 3 Rotating Auto-Snapshots */}
          <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                id="btn-local-export-backup"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="h-10 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Export Backup</span>
              </button>

              <button
                type="button"
                id="btn-local-restore-file"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-60 text-slate-800 dark:text-zinc-200 text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
                ) : (
                  <Upload className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400" />
                )}
                <span>Restore from File</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {pendingRestore && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-amber-950 dark:text-amber-200">
                  Replace current data with{' '}
                  <span className="font-semibold">{pendingRestore.sourceLabel}</span>?
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPendingRestore(null)}
                    className="h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100/70 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Replace &amp; Restore
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible "Recent Auto-Snapshots (3)" */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowSnapshots((v) => !v)}
                className="text-[12px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 inline-flex items-center gap-1 transition cursor-pointer"
              >
                {showSnapshots ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>Recent Auto-Snapshots ({snapshots.length})</span>
              </button>

              {showSnapshots && (
                <div className="mt-2 divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden">
                  {snapshots.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-zinc-400">
                      No local auto-snapshots yet.
                    </div>
                  ) : (
                    snapshots.map((snap) => (
                      <div
                        key={snap.filename}
                        className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-zinc-950/40"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">
                            Snapshot #{snap.slot} · {formatRelativeSyncTime(snap.timestamp)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                            {formatDriveFileSize(snap.sizeBytes)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStageSnapshotRestore(snap)}
                          className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[11.5px] font-medium text-indigo-600 dark:text-indigo-400 transition cursor-pointer shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
