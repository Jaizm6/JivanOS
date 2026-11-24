import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Database,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  FileText,
  RotateCcw,
  FolderSync,
  Cpu,
  Eye,
  ExternalLink,
  Smartphone,
  Lock,
  Copy,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyncDriveId } from '../../types';
import { ProviderLogo } from './ProviderLogo';
import { SnapshotInspectorModal } from './SnapshotInspectorModal';
import { LocalBackupRestoreSection } from '../settings/LocalBackupRestoreSection';
import { isRunningInIframe, isCapacitorNative } from '../../lib/firebase';
import {
  DROPBOX_SYNC_STATE_EVENT,
  DropboxAccount,
  completeDropboxManualCodePkce,
  disconnectDropbox,
  getConnectedDropboxAccount,
  getDropboxWebRedirectUri,
  isDropboxPopupModeEnabled,
  isNativeAndroidDropboxAvailable,
  setDropboxPopupModeEnabled,
  silentReAuthDropbox,
  startDropboxManualCodePkce,
} from '../../utils/dropboxSync';

interface BackupSnapshot {
  version: number;
  timestamp: string;
  source: string;
  provider: string;
  accountEmail?: string;
  sizeBytes: number;
}

interface DriveMeta {
  id: SyncDriveId;
  name: string;
  subtitle: string;
}

const PRIMARY_DRIVES: DriveMeta[] = [
  {
    id: 'jivanos_vault',
    name: 'JivanOS Private Vault',
    subtitle: 'Zero-login pairing key',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    subtitle: 'Personal Drive folder',
  },
  {
    id: 'firebase',
    name: 'JivanOS Cloud',
    subtitle: 'Signed-in account sync',
  },
  {
    id: 'local_folder',
    name: 'Local / Syncthing Folder',
    subtitle: 'Device folder archive',
  },
];

const EXTRA_DRIVES: DriveMeta[] = [
  {
    id: 'dropbox',
    name: 'Dropbox',
    subtitle: 'App folder sync',
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    subtitle: 'Self-hosted WebDAV',
  },
  {
    id: 'webdav',
    name: 'WebDAV / NAS',
    subtitle: 'Koofr, pCloud, Synology',
  },
  {
    id: 's3',
    name: 'S3 / R2 / MinIO',
    subtitle: 'S3-compatible object store',
  },
];

const ALL_DRIVES: DriveMeta[] = [...PRIMARY_DRIVES, ...EXTRA_DRIVES];

const GoogleGIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const BackupModal: React.FC = () => {
  const {
    isBackupModalOpen,
    setIsBackupModalOpen,
    restoreCloudBackup,
    downloadLocalBackupFile,
    importBackupJSON,
    syncEmail,
    habits,
    tasks,
    scheduleItems,
    firebaseUser,
    authError,
    loginWithGoogle,
    joplinSyncSettings,
    updateJoplinSyncSettings,
    updateDriveConfig,
    syncDriveNow,
    checkDriveConfiguration,
    pickLocalFolderForSync,
    connectDriveOAuth,
    isGDriveConnected,
    setGDriveManualToken,
    disconnectGDrive,
  } = useApp();

  const activeAccountIdentifier = syncEmail || firebaseUser?.email || 'local_vault';
  const inIframe = isRunningInIframe();
  const inNativeApk = isCapacitorNative();

  const [activeTab, setActiveTab] = useState<'backup' | 'drives' | 'history' | 'mobile_apk'>('backup');
  const [selectedDriveId, setSelectedDriveId] = useState<SyncDriveId>(
    joplinSyncSettings.primaryTarget === 'none' ? 'gdrive' : joplinSyncSettings.primaryTarget
  );
  const [showMoreDrives, setShowMoreDrives] = useState<boolean>(() =>
    EXTRA_DRIVES.some(
      (d) =>
        joplinSyncSettings.primaryTarget === d.id ||
        joplinSyncSettings.drives[d.id]?.enabled ||
        joplinSyncSettings.drives[d.id]?.autoBackupEnabled
    )
  );
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [manualGDriveTokenInput, setManualGDriveTokenInput] = useState('');

  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [dropboxAccount, setDropboxAccount] = useState<DropboxAccount | null>(() =>
    getConnectedDropboxAccount()
  );
  const [dropboxManualAuthUrl, setDropboxManualAuthUrl] = useState('');
  const [dropboxManualCode, setDropboxManualCode] = useState('');
  const [dropboxPopupModeEnabled, setDropboxPopupModeEnabledState] = useState<boolean>(() =>
    isDropboxPopupModeEnabled()
  );
  const [copiedCallback, setCopiedCallback] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [inspectingVersion, setInspectingVersion] = useState<number | null>(null);

  // Explicit user confirmation for mutating/destructive operations
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedDrivePanelRef = useRef<HTMLDivElement>(null);

  const fetchSnapshots = async () => {
    try {
      setIsLoadingSnapshots(true);
      const res = await fetch(`/api/backup/list/${encodeURIComponent(activeAccountIdentifier)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        setSnapshots(data.backups);
      }
    } catch {
      // ignore offline snapshot fetch error
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (isBackupModalOpen) {
      fetchSnapshots();
      setSuccessMessage(null);
      setErrorMessage(null);
      setPendingConfirm(null);
      setShowAdvancedOAuth(false);
      setManualGDriveTokenInput('');
      setDropboxAccount(getConnectedDropboxAccount());
      silentReAuthDropbox()
        .then((acc) => setDropboxAccount(acc))
        .catch(() => {});
    }
  }, [isBackupModalOpen, activeAccountIdentifier]);

  useEffect(() => {
    if (!isBackupModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isBackupModalOpen]);

  useEffect(() => {
    const syncDropboxState = () => setDropboxAccount(getConnectedDropboxAccount());
    window.addEventListener(DROPBOX_SYNC_STATE_EVENT, syncDropboxState);
    return () => window.removeEventListener(DROPBOX_SYNC_STATE_EVENT, syncDropboxState);
  }, []);

  useEffect(() => {
    if (!isBackupModalOpen || selectedDriveId !== 'dropbox' || dropboxAccount?.connected) return;
    startDropboxManualCodePkce({ forceNew: false })
      .then(({ authUrl }) => setDropboxManualAuthUrl(authUrl))
      .catch(() => {});
  }, [isBackupModalOpen, selectedDriveId, dropboxAccount?.connected]);

  if (!isBackupModalOpen) return null;

  const selectedDriveConfig = joplinSyncSettings.drives[selectedDriveId];
  const selectedDriveMeta = ALL_DRIVES.find((d) => d.id === selectedDriveId) || ALL_DRIVES[0];
  const oauthCallbackUrl = `${window.location.origin}/auth/oauth-callback`;

  const isDriveConnected = (id: SyncDriveId): boolean => {
    const cfg = joplinSyncSettings.drives[id];
    switch (id) {
      case 'gdrive':
        return isGDriveConnected;
      case 'firebase':
        return Boolean(firebaseUser?.uid);
      case 'jivanos_vault':
        return Boolean(cfg?.vaultId && cfg.vaultId.trim().length >= 4);
      case 'local_folder':
        return Boolean(cfg?.folderName);
      case 'dropbox':
        return Boolean(dropboxAccount?.connected);
      case 'nextcloud':
      case 'webdav':
        return Boolean(cfg?.serverUrl?.trim());
      case 's3':
        return Boolean(cfg?.s3Endpoint?.trim() && cfg?.s3Bucket?.trim());
      default:
        return false;
    }
  };

  const activeDriveCount = ALL_DRIVES.filter(
    (d) =>
      joplinSyncSettings.primaryTarget === d.id ||
      joplinSyncSettings.drives[d.id]?.autoBackupEnabled ||
      isDriveConnected(d.id)
  ).length;

  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportHabitsCSV = () => {
    const headers = ['Habit Name', 'Category', 'Type', 'Target Days/Week', 'Current Streak', 'Completion Dates'];
    const rows = habits.map((h) => [
      `"${h.name.replace(/"/g, '""')}"`,
      h.category,
      h.habitType || 'boolean',
      h.targetDaysPerWeek || 7,
      h.currentStreak || 0,
      `"${Object.keys(h.completionHistory || {})
        .filter((d) => h.completionHistory[d])
        .join(', ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`habits_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportTasksCSV = () => {
    const headers = ['Task Title', 'Category', 'Priority', 'Status', 'Project', 'Due Date', 'Completed'];
    const rows = tasks.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      t.category,
      t.priority || 'P2',
      t.status || 'todo',
      `"${t.project || 'General'}"`,
      t.dueDate || '',
      t.completed ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`tasks_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportScheduleCSV = () => {
    const headers = ['Title', 'Date', 'Start Time', 'End Time', 'Category', 'Priority', 'Completed'];
    const rows = scheduleItems.map((s) => [
      `"${s.title.replace(/"/g, '""')}"`,
      s.date,
      s.startTime,
      s.endTime,
      s.category,
      s.priority || 'P2',
      s.completed ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(`schedule_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportCombinedBundle = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      habits,
      tasks,
      scheduleItems,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `jivanos_combined_bundle_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(oauthCallbackUrl);
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const executeSyncDrive = async (target?: SyncDriveId) => {
    setIsSyncingDrive(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await syncDriveNow(target);
      if (res?.success) {
        setSuccessMessage(res.message || 'Synchronized cleanly.');
      } else {
        setErrorMessage(
          res?.message || 'Sync could not complete. Verify your drive settings below.'
        );
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Drive sync failed.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleSyncSelectedDrive = (target?: SyncDriveId) => {
    const resolvedTarget = target || joplinSyncSettings.primaryTarget;
    if (resolvedTarget === 'gdrive') {
      if (!isGDriveConnected) {
        setErrorMessage('Click Sign in with Google first to authorize Google Drive for this session.');
        return;
      }
      setPendingConfirm({
        title: 'Sync Snapshot to Google Drive?',
        message:
          'This will merge your local items with jivanos-sync.json on Google Drive and save the updated backup file.',
        confirmLabel: 'Sync Google Drive',
        onConfirm: async () => {
          setPendingConfirm(null);
          await executeSyncDrive('gdrive');
        },
      });
      return;
    }
    void executeSyncDrive(target);
  };

  const handleCheckConfiguration = async (target: SyncDriveId) => {
    setIsCheckingConfig(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await checkDriveConfiguration(target);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.message);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Configuration check failed.');
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const handleConnectDriveOAuth = async (driveId: 'gdrive' | 'dropbox', customClientId?: string) => {
    setIsConnectingOAuth(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await connectDriveOAuth(driveId, customClientId);
      if (res.success) {
        if (driveId === 'dropbox') {
          const connected = getConnectedDropboxAccount();
          setDropboxAccount(connected);
          setSuccessMessage(
            connected?.email
              ? `Connected as ${connected.email}`
              : 'Dropbox connected cleanly.'
          );
        } else {
          setSuccessMessage('Google Drive connected for this session.');
        }
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not connect drive.');
    } finally {
      setIsConnectingOAuth(false);
    }
  };

  const handleCompleteDropboxManualCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnectingOAuth) return;
    setIsConnectingOAuth(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const account = await completeDropboxManualCodePkce(dropboxManualCode);
      setDropboxAccount(account);
      setDropboxManualCode('');
      updateDriveConfig('dropbox', {
        enabled: true,
        clientId: '',
        accessToken: '',
        accountEmail: account.email || account.name || undefined,
        lastStatus: 'synced',
        lastError: undefined,
      });
      if (joplinSyncSettings.primaryTarget === 'none') {
        updateJoplinSyncSettings({ primaryTarget: 'dropbox' });
      }
      setSuccessMessage(
        account.email ? `Connected as ${account.email}` : 'Dropbox connected cleanly.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not connect Dropbox.');
      startDropboxManualCodePkce({ forceNew: true })
        .then(({ authUrl }) => setDropboxManualAuthUrl(authUrl))
        .catch(() => {});
    } finally {
      setIsConnectingOAuth(false);
    }
  };

  const handleToggleDropboxPopupMode = () => {
    const next = !dropboxPopupModeEnabled;
    setDropboxPopupModeEnabledState(next);
    setDropboxPopupModeEnabled(next);
  };

  const handleDisconnectDropbox = async () => {
    try {
      await disconnectDropbox();
      setDropboxAccount(null);
      updateDriveConfig('dropbox', {
        enabled: false,
        clientId: '',
        accessToken: '',
        accountEmail: undefined,
        lastStatus: 'idle',
        lastError: undefined,
      });
      setSuccessMessage('Dropbox disconnected.');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not disconnect Dropbox.');
    }
  };

  const handleDisconnectGDrive = () => {
    setPendingConfirm({
      title: 'Disconnect Google Drive?',
      message: 'This clears the current session access for Google Drive. Your existing Drive files remain untouched.',
      confirmLabel: 'Disconnect',
      onConfirm: () => {
        disconnectGDrive();
        setManualGDriveTokenInput('');
        setPendingConfirm(null);
        setSuccessMessage('Google Drive session disconnected.');
      },
    });
  };

  const handleRestoreSnapshot = (version: number) => {
    setPendingConfirm({
      title: `Restore Snapshot #${version}?`,
      message: 'Restoring merges and updates your current tasks, habits, and profile from this snapshot.',
      confirmLabel: 'Restore Snapshot',
      onConfirm: async () => {
        setPendingConfirm(null);
        setRestoringVersion(version);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
          const success = await restoreCloudBackup(version);
          if (success) {
            setSuccessMessage(`Snapshot #${version} restored successfully.`);
          } else {
            setErrorMessage(`Failed to restore snapshot #${version}.`);
          }
        } catch (e: any) {
          setErrorMessage(e?.message || 'Restore failed.');
        } finally {
          setRestoringVersion(null);
        }
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('File is empty.');
        const ok = importBackupJSON(content);
        if (ok) {
          setSuccessMessage(`Restored backup from ${file.name}.`);
        } else {
          setErrorMessage('Invalid backup file format.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderDriveCard = (drive: DriveMeta) => {
    const cfg = joplinSyncSettings.drives[drive.id];
    const isPrimary = joplinSyncSettings.primaryTarget === drive.id;
    const isSelected = selectedDriveId === drive.id;
    const isMirror = Boolean(cfg?.autoBackupEnabled);
    const connected = isDriveConnected(drive.id);

    const statusText = isPrimary
      ? 'Primary'
      : isMirror
      ? 'Mirror'
      : connected
      ? 'Ready'
      : drive.subtitle;

    return (
      <button
        key={drive.id}
        type="button"
        onClick={() => {
          setSelectedDriveId(drive.id);
          setErrorMessage(null);
          setSuccessMessage(null);
          setPendingConfirm(null);
          window.requestAnimationFrame(() => {
            selectedDrivePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }}
        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
          isSelected
            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/35 ring-1 ring-indigo-500/30'
            : connected || isPrimary
            ? 'border-emerald-300/80 dark:border-emerald-800/80 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <ProviderLogo provider={drive.id} className="w-4 h-4 shrink-0" />
          {(connected || isPrimary) && (
            <span
              className={`text-[11px] font-semibold whitespace-nowrap ${
                isPrimary
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isPrimary ? 'Primary' : 'Connected'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {drive.name}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {cfg?.lastSyncedAt
              ? `Synced ${new Date(cfg.lastSyncedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : statusText}
          </div>
        </div>
      </button>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sync and Backups"
      className="fixed inset-0 z-[99990] bg-black/60 backdrop-blur-xs sm:p-4 md:p-6 flex items-stretch sm:items-center justify-center animate-in fade-in duration-150"
      onClick={() => setIsBackupModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-[100dvh] sm:h-auto sm:max-h-[88dvh] sm:max-w-3xl rounded-none sm:rounded-2xl bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Clean Header */}
        <div className="px-4 sm:px-5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <FolderSync className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                Sync &amp; Backups
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Cloud, Drive, Dropbox, Telegram &amp; local backups
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            aria-label="Close Sync and Backups"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Responsive Navigation Tabs (4 equal columns on mobile, zero horizontal clipping) */}
        <div className="px-2 sm:px-5 pt-1.5 grid grid-cols-4 sm:flex sm:items-center sm:gap-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 pt-1 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold transition border-b-2 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drives')}
            className={`pb-2.5 pt-1 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold transition border-b-2 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'drives'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>Drives{activeDriveCount > 0 ? ` (${activeDriveCount})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchSnapshots();
            }}
            className={`pb-2.5 pt-1 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold transition border-b-2 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer tabular-nums ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>History{snapshots.length > 0 ? ` (${snapshots.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mobile_apk')}
            className={`pb-2.5 pt-1 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold transition border-b-2 flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'mobile_apk'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>APK</span>
          </button>
        </div>

        {/* Inline Confirmation Prompt */}
        {pendingConfirm && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                {pendingConfirm.title}
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                {pendingConfirm.message}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void pendingConfirm.onConfirm()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        )}

        {/* Alert Notifications */}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="px-3.5 py-4 sm:p-5 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0 space-y-4 sm:space-y-5 bg-slate-50/40 dark:bg-slate-950/30">
          {/* TAB 1 (DEFAULT): UNIFIED 5-PROVIDER BACKUP & SYNC (Cloud, Drive, Dropbox, Telegram, Local) */}
          {activeTab === 'backup' && (
            <div className="space-y-4 sm:space-y-5 pb-2">
              <LocalBackupRestoreSection />

              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-[28px] border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 space-y-3 shadow-xs">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>CSV &amp; Bundle Exports</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Export habits, tasks, or schedule logs as spreadsheets.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={exportHabitsCSV}
                    className="min-h-[40px] py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    Habits CSV
                  </button>

                  <button
                    type="button"
                    onClick={exportTasksCSV}
                    className="min-h-[40px] py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    Tasks CSV
                  </button>

                  <button
                    type="button"
                    onClick={exportScheduleCSV}
                    className="min-h-[40px] py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    Schedule CSV
                  </button>
                </div>

                <button
                  type="button"
                  onClick={exportCombinedBundle}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Combined JSON Archive</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCED MULTI-DRIVE SYNC (Vault, Syncthing, Nextcloud, WebDAV, S3) */}
          {activeTab === 'drives' && (
            <div className="space-y-4 sm:space-y-5 pb-2">
              {/* Step 1: Compact Sync Overview & Quick Preferences */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Auto-sync:</span>
                    <select
                      value={joplinSyncSettings.autoSyncIntervalMinutes}
                      onChange={(e) =>
                        updateJoplinSyncSettings({
                          autoSyncIntervalMinutes: Number(e.target.value) as any,
                        })
                      }
                      className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value={0}>Manual</option>
                      <option value={5}>Every 5 min</option>
                      <option value={15}>Every 15 min</option>
                      <option value={30}>Every 30 min</option>
                      <option value={60}>Every 60 min</option>
                    </select>
                  </div>

                  <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joplinSyncSettings.syncOnChange}
                      onChange={(e) =>
                        updateJoplinSyncSettings({ syncOnChange: e.target.checked })
                      }
                      className="w-3.5 h-3.5 accent-indigo-600 rounded"
                    />
                    <span>Sync on edit</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joplinSyncSettings.syncPersonalDetails}
                      onChange={(e) =>
                        updateJoplinSyncSettings({ syncPersonalDetails: e.target.checked })
                      }
                      className="w-3.5 h-3.5 accent-indigo-600 rounded"
                    />
                    <span>Include profile</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={isSyncingDrive}
                  onClick={() => handleSyncSelectedDrive()}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                  <span>{isSyncingDrive ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              {/* Step 2: Clean 4-Option Primary Drive Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Choose a Drive
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    Primary:{' '}
                    <strong className="text-slate-900 dark:text-white font-semibold">
                      {joplinSyncSettings.primaryTarget === 'none'
                        ? 'This device only'
                        : ALL_DRIVES.find((d) => d.id === joplinSyncSettings.primaryTarget)?.name}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRIMARY_DRIVES.map((drive) => renderDriveCard(drive))}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowMoreDrives((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer py-1"
                  >
                    {showMoreDrives ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {showMoreDrives
                        ? 'Hide extra drives'
                        : 'More drives (Dropbox, Nextcloud, WebDAV, S3)'}
                    </span>
                  </button>

                  {showMoreDrives && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                      {EXTRA_DRIVES.map((drive) => renderDriveCard(drive))}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Clean Selected Drive Setup */}
              <div
                ref={selectedDrivePanelRef}
                className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 scroll-mt-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <ProviderLogo provider={selectedDriveId} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {selectedDriveMeta.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {selectedDriveConfig?.lastSyncedAt
                          ? `Last synced ${new Date(selectedDriveConfig.lastSyncedAt).toLocaleString()}`
                          : selectedDriveMeta.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const nextPrimary =
                          joplinSyncSettings.primaryTarget === selectedDriveId
                            ? 'none'
                            : selectedDriveId;
                        updateJoplinSyncSettings({ primaryTarget: nextPrimary });
                        if (nextPrimary !== 'none') {
                          updateDriveConfig(selectedDriveId, { enabled: true });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                        joplinSyncSettings.primaryTarget === selectedDriveId
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {joplinSyncSettings.primaryTarget === selectedDriveId
                        ? 'Primary Sync'
                        : 'Set as Primary'}
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedDriveConfig?.autoBackupEnabled)}
                        onChange={(e) =>
                          updateDriveConfig(selectedDriveId, {
                            autoBackupEnabled: e.target.checked,
                            enabled: e.target.checked || selectedDriveConfig?.enabled,
                          })
                        }
                        className="w-3.5 h-3.5 accent-emerald-600 rounded"
                      />
                      <span>Auto-Mirror</span>
                    </label>
                  </div>
                </div>

                {/* Google Drive Setup */}
                {selectedDriveId === 'gdrive' && (
                  <div className="space-y-3">
                    {inNativeApk && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                        Google Drive sign-in popup is restricted inside Android APK WebViews. Open JivanOS in your mobile browser to sync Google Drive, or use <strong>JivanOS Private Vault</strong> / <strong>Local Folder</strong> on Android.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {!isGDriveConnected ? (
                        <button
                          type="button"
                          disabled={isConnectingOAuth}
                          onClick={() => handleConnectDriveOAuth('gdrive', '')}
                          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <GoogleGIcon />
                          <span>{isConnectingOAuth ? 'Connecting...' : 'Sign in with Google'}</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <Check className="w-4 h-4 shrink-0" />
                            <span>
                              Connected
                              {selectedDriveConfig?.accountEmail
                                ? ` · ${selectedDriveConfig.accountEmail}`
                                : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={handleDisconnectGDrive}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Disconnect</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowAdvancedOAuth((prev) => !prev)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        {showAdvancedOAuth ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>Advanced options</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Saves <code className="font-mono text-slate-700 dark:text-slate-300">jivanos-sync.json</code> to your Google Drive with your permission. Access remains in memory for this session only.
                    </p>

                    {showAdvancedOAuth && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                              Custom Client ID (Optional)
                            </label>
                            <input
                              type="text"
                              value={selectedDriveConfig?.clientId || ''}
                              onChange={(e) =>
                                updateDriveConfig('gdrive', { clientId: e.target.value })
                              }
                              placeholder="Leave blank for built-in Google sign-in"
                              className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                              Session Access Token (Memory-Only)
                            </label>
                            <input
                              type="password"
                              value={manualGDriveTokenInput}
                              onChange={(e) => {
                                setManualGDriveTokenInput(e.target.value);
                                setGDriveManualToken(e.target.value);
                              }}
                              placeholder="Optional Bearer token for this tab session"
                              className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {selectedDriveConfig?.clientId?.trim() ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleConnectDriveOAuth('gdrive', selectedDriveConfig.clientId)
                              }
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Connect with Custom Client ID</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Leave Custom Client ID empty to use the standard Sign in with Google button above.
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={handleCopyCallbackUrl}
                            className="text-xs font-mono text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCallback ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedCallback ? 'Copied URI' : 'Copy Redirect URI'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* JivanOS Private Vault Setup */}
                {selectedDriveId === 'jivanos_vault' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Enter any shared Vault Key across Android, iOS, or desktop browsers to sync without signing in.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                          Vault Key (min 4 characters)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={selectedDriveConfig?.vaultId || ''}
                            onChange={(e) =>
                              updateDriveConfig('jivanos_vault', {
                                vaultId: e.target.value,
                                enabled: e.target.value.trim().length >= 4,
                              })
                            }
                            placeholder="e.g. my-jivan-vault-942"
                            className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const rand = `jivan-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
                              updateDriveConfig('jivanos_vault', { vaultId: rand, enabled: true });
                            }}
                            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                          >
                            Generate
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                          Optional Access PIN
                        </label>
                        <input
                          type="password"
                          value={selectedDriveConfig?.vaultPin || ''}
                          onChange={(e) =>
                            updateDriveConfig('jivanos_vault', { vaultPin: e.target.value })
                          }
                          placeholder="Optional 4-12 char PIN"
                          className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Local / Syncthing Folder Setup */}
                {selectedDriveId === 'local_folder' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Pick a folder on your device (such as Syncthing, iCloud Drive, or Drive Desktop). JivanOS reads and writes{' '}
                      <code className="font-mono text-indigo-600 dark:text-indigo-400">jivanos-sync.json</code> inside it.
                    </p>

                    {inIframe ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Direct folder pickers are blocked inside embedded preview frames. Open JivanOS in a full browser tab to choose a local folder, or use Google Drive / Private Vault here.
                        </p>
                        <a
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0 whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Full Tab</span>
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await pickLocalFolderForSync();
                            if (res?.success) {
                              setSuccessMessage(`Local sync folder "${res.folderName}" connected.`);
                            } else if (res?.error) {
                              setErrorMessage(res.error);
                            }
                          }}
                          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>
                            {selectedDriveConfig?.folderName
                              ? `Change Folder (${selectedDriveConfig.folderName})`
                              : 'Choose Sync Folder'}
                          </span>
                        </button>
                        {selectedDriveConfig?.folderName && (
                          <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                            Folder: {selectedDriveConfig.folderName}/jivanos-sync.json
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* JivanOS Cloud (Firebase) */}
                {selectedDriveId === 'firebase' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {firebaseUser
                          ? `Signed in as ${firebaseUser.email || firebaseUser.displayName}`
                          : 'Sign in with Google to sync directly with JivanOS Cloud.'}
                      </p>
                      {!firebaseUser && (
                        <button
                          type="button"
                          onClick={loginWithGoogle}
                          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <GoogleGIcon />
                          <span>Sign in with Google</span>
                        </button>
                      )}
                    </div>
                    {authError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        {authError}
                      </p>
                    )}
                  </div>
                )}

                {/* Dropbox — OAuth2 PKCE (zero manual keys or tokens) */}
                {selectedDriveId === 'dropbox' && (
                  <div className="space-y-3">
                    {dropboxAccount?.connected ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {dropboxAccount.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              Connected as {dropboxAccount.email || dropboxAccount.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              App folder: /Apps/JivanOS/backup.json
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDisconnectDropbox}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    ) : isNativeAndroidDropboxAvailable() ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Sign in to your Dropbox account to back up privately inside your sandboxed{' '}
                          <span className="font-mono text-[11px]">/Apps/JivanOS/</span> folder.
                        </p>
                        <button
                          type="button"
                          disabled={isConnectingOAuth}
                          onClick={() => handleConnectDriveOAuth('dropbox')}
                          className="px-4 py-2 rounded-lg bg-[#0061FF] hover:bg-[#0051D5] text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                        >
                          <ProviderLogo provider="dropbox" className="w-4 h-4 text-white" />
                          <span>{isConnectingOAuth ? 'Connecting…' : 'Connect Dropbox'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          1. Tap <strong>Open Dropbox Authorization</strong>, sign in, and click{' '}
                          <strong>Allow</strong>. 2. Copy the code shown by Dropbox and paste it
                          below (no redirect URI setup required).
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={dropboxManualAuthUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!dropboxManualAuthUrl) {
                                e.preventDefault();
                                startDropboxManualCodePkce({ forceNew: false })
                                  .then(({ authUrl }) => setDropboxManualAuthUrl(authUrl))
                                  .catch(() => {});
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0061FF] hover:bg-[#0051D5] text-white text-xs font-semibold transition"
                          >
                            <ProviderLogo provider="dropbox" className="w-4 h-4 text-white" />
                            <span>Open Dropbox Authorization</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <form
                          onSubmit={handleCompleteDropboxManualCode}
                          className="flex flex-col sm:flex-row gap-2"
                        >
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            spellCheck={false}
                            value={dropboxManualCode}
                            onChange={(e) => {
                              setDropboxManualCode(e.target.value);
                              setErrorMessage(null);
                            }}
                            placeholder="Paste Dropbox authorization code…"
                            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-[#0061FF]"
                          />
                          <button
                            type="submit"
                            disabled={isConnectingOAuth || !dropboxManualCode.trim()}
                            className="px-4 py-2 rounded-lg bg-[#0061FF] hover:bg-[#0051D5] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                          >
                            {isConnectingOAuth ? 'Connecting…' : 'Connect Dropbox'}
                          </button>
                        </form>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Enable 1-Click Popup Mode (optional, requires Redirect URI)
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={dropboxPopupModeEnabled}
                              onClick={handleToggleDropboxPopupMode}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                dropboxPopupModeEnabled
                                  ? 'bg-[#0061FF]'
                                  : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  dropboxPopupModeEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </label>

                          {dropboxPopupModeEnabled && (
                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Redirect URI:{' '}
                                <code className="font-mono text-[10px] select-all break-all">
                                  {getDropboxWebRedirectUri()}
                                </code>
                              </p>
                              <button
                                type="button"
                                disabled={isConnectingOAuth}
                                onClick={() => handleConnectDriveOAuth('dropbox')}
                                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                              >
                                {isConnectingOAuth ? 'Connecting…' : 'Connect with 1-Click Popup'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Nextcloud & WebDAV */}
                {(selectedDriveId === 'nextcloud' || selectedDriveId === 'webdav') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        {selectedDriveId === 'nextcloud'
                          ? 'Nextcloud WebDAV URL'
                          : 'WebDAV Server URL'}
                      </label>
                      <input
                        type="url"
                        value={selectedDriveConfig?.serverUrl || ''}
                        onChange={(e) =>
                          updateDriveConfig(selectedDriveId, { serverUrl: e.target.value })
                        }
                        placeholder={
                          selectedDriveId === 'nextcloud'
                            ? 'https://cloud.example.com/remote.php/dav/files/username/'
                            : 'https://app.koofr.net/dav/Koofr/'
                        }
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        Username
                      </label>
                      <input
                        type="text"
                        value={selectedDriveConfig?.username || ''}
                        onChange={(e) =>
                          updateDriveConfig(selectedDriveId, { username: e.target.value })
                        }
                        placeholder="username"
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        App Password
                      </label>
                      <input
                        type="password"
                        value={selectedDriveConfig?.password || ''}
                        onChange={(e) =>
                          updateDriveConfig(selectedDriveId, {
                            password: e.target.value,
                            enabled: Boolean(e.target.value),
                          })
                        }
                        placeholder="••••••••••••"
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* S3 Compatible */}
                {selectedDriveId === 's3' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        S3 Endpoint URL
                      </label>
                      <input
                        type="url"
                        value={selectedDriveConfig?.s3Endpoint || selectedDriveConfig?.serverUrl || ''}
                        onChange={(e) =>
                          updateDriveConfig('s3', {
                            s3Endpoint: e.target.value,
                            serverUrl: e.target.value,
                          })
                        }
                        placeholder="https://s3.us-east-1.amazonaws.com"
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                          Bucket
                        </label>
                        <input
                          type="text"
                          value={selectedDriveConfig?.s3Bucket || ''}
                          onChange={(e) =>
                            updateDriveConfig('s3', { s3Bucket: e.target.value })
                          }
                          placeholder="jivanos-sync"
                          className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                          Region
                        </label>
                        <input
                          type="text"
                          value={selectedDriveConfig?.s3Region || 'us-east-1'}
                          onChange={(e) =>
                            updateDriveConfig('s3', { s3Region: e.target.value })
                          }
                          placeholder="us-east-1"
                          className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        Access Key ID
                      </label>
                      <input
                        type="text"
                        value={selectedDriveConfig?.s3AccessKey || selectedDriveConfig?.username || ''}
                        onChange={(e) =>
                          updateDriveConfig('s3', {
                            s3AccessKey: e.target.value,
                            username: e.target.value,
                          })
                        }
                        placeholder="AKIA..."
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                        Secret Access Key
                      </label>
                      <input
                        type="password"
                        value={selectedDriveConfig?.s3SecretKey || selectedDriveConfig?.password || ''}
                        onChange={(e) =>
                          updateDriveConfig('s3', {
                            s3SecretKey: e.target.value,
                            password: e.target.value,
                            enabled: Boolean(e.target.value),
                          })
                        }
                        placeholder="••••••••••••"
                        className="w-full text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Actions & Optional Encryption */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={joplinSyncSettings.e2eeEnabled}
                        onChange={(e) =>
                          updateJoplinSyncSettings({ e2eeEnabled: e.target.checked })
                        }
                        className="w-3.5 h-3.5 accent-indigo-600 rounded"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Encrypt sync (AES-256)</span>
                    </label>
                    {joplinSyncSettings.e2eeEnabled && (
                      <input
                        type="password"
                        value={joplinSyncSettings.e2eePassphrase || ''}
                        onChange={(e) =>
                          updateJoplinSyncSettings({ e2eePassphrase: e.target.value })
                        }
                        placeholder="Encryption passphrase"
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-800 dark:text-slate-200 font-mono w-44"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isCheckingConfig || isSyncingDrive}
                      onClick={() => handleCheckConfiguration(selectedDriveId)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${isCheckingConfig ? 'animate-spin' : ''}`} />
                      <span>{isCheckingConfig ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSyncingDrive}
                      onClick={() => handleSyncSelectedDrive(selectedDriveId)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                      <span>Sync {selectedDriveMeta.name}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SNAPSHOT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Account: <strong className="font-mono text-slate-900 dark:text-white">{activeAccountIdentifier}</strong>
                </span>
                <button
                  type="button"
                  onClick={fetchSnapshots}
                  disabled={isLoadingSnapshots}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Database className="w-7 h-7 text-slate-400 mx-auto opacity-60" />
                  <p className="text-xs text-slate-500">
                    No snapshots saved yet for {activeAccountIdentifier}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {snapshots.map((snap) => {
                    const isRestoring = restoringVersion === snap.version;
                    return (
                      <div
                        key={snap.version}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                            <ProviderLogo provider={snap.provider} className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate tabular-nums">
                              Snapshot #{snap.version} · {snap.provider}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                              {new Date(snap.timestamp).toLocaleString()} · {(snap.sizeBytes / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectingVersion(snap.version)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Inspect</span>
                          </button>

                          <button
                            type="button"
                            disabled={isRestoring}
                            onClick={() => handleRestoreSnapshot(snap.version)}
                            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Restore</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANDROID APK */}
          {activeTab === 'mobile_apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    JivanOS Android APK &amp; Multi-Device Sync
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  v3.0.x builds share a consistent signing certificate (<code className="font-mono">com.jaiz.jivanos</code>) for smooth in-place updates. Pair Android and desktop devices using <strong>JivanOS Private Vault</strong> or <strong>Local / Syncthing Folder</strong>.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  Upgrading from an older v2.1.x APK? Export a JSON backup first, uninstall the old v2.1.x APK once if Android shows a package conflict, then install v3.0.x — all future updates install cleanly in-place.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2 border border-slate-800 font-mono text-xs">
                <div className="text-emerald-400 font-sans font-semibold">
                  Build APK locally with Capacitor
                </div>
                <pre className="p-2.5 rounded-lg bg-black/50 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
{`npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "JivanOS" "com.jaiz.jivanos" --web-dir "dist"
npm run build && npx cap add android && npx cap sync
cd android && ./gradlew assembleRelease`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="px-4 sm:px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 dark:text-slate-400 truncate tabular-nums">
            <span>Storage: </span>
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              Local-First{activeDriveCount > 0 ? ` · ${activeDriveCount} drive${activeDriveCount === 1 ? '' : 's'} ready` : ''}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            className="min-h-[38px] px-5 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      {/* Snapshot Inspector Modal */}
      <SnapshotInspectorModal
        isOpen={inspectingVersion !== null}
        onClose={() => setInspectingVersion(null)}
        version={inspectingVersion}
        accountEmail={activeAccountIdentifier}
        onRestore={(version) => handleRestoreSnapshot(version)}
      />
    </div>,
    document.body
  );
};
