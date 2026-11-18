import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  Cloud,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  Shield,
  Clock,
  FileText,
  RotateCcw,
  Mail,
  Server,
  Plus,
  Trash2,
  CheckCircle2,
  FolderSync,
  Cpu,
  Eye,
  ExternalLink,
  Smartphone,
  Lock,
  Copy,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CloudBackupProvider, SyncDriveId } from '../../types';
import { ProviderLogo } from './ProviderLogo';
import { SnapshotInspectorModal } from './SnapshotInspectorModal';

interface BackupSnapshot {
  version: number;
  timestamp: string;
  source: string;
  provider: string;
  accountEmail?: string;
  sizeBytes: number;
}

const JOPLIN_DRIVE_META: Array<{
  id: SyncDriveId;
  name: string;
  subtitle: string;
  protocol: string;
}> = [
  {
    id: 'jivanos_vault',
    name: 'JivanOS Private Vault',
    subtitle: 'Zero-Login Key • Any OS',
    protocol: 'Vault API + E2EE',
  },
  {
    id: 'local_folder',
    name: 'Local / Syncthing Folder',
    subtitle: 'Device Folder • Syncthing • iCloud',
    protocol: 'File System API',
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    subtitle: 'Joplin AppRoot Sync',
    protocol: 'Graph REST v1.0',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    subtitle: 'Personal Drive Vault',
    protocol: 'Drive API v3',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    subtitle: 'App Folder Sync',
    protocol: 'Dropbox API v2',
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    subtitle: 'Self-Hosted Cloud',
    protocol: 'WebDAV DAV',
  },
  {
    id: 'webdav',
    name: 'WebDAV / Koofr / NAS',
    subtitle: 'Synology • pCloud • Koofr',
    protocol: 'Standard WebDAV',
  },
  {
    id: 's3',
    name: 'S3 / R2 / MinIO / B2',
    subtitle: 'AWS • Cloudflare R2 • MinIO',
    protocol: 'AWS SigV4 S3',
  },
  {
    id: 'firebase',
    name: 'JivanOS Cloud',
    subtitle: 'Optional Google Auth DB',
    protocol: 'Firestore Live',
  },
];

export const BackupModal: React.FC = () => {
  const {
    isBackupModalOpen,
    setIsBackupModalOpen,
    createCloudBackup,
    restoreCloudBackup,
    downloadLocalBackupFile,
    importBackupJSON,
    syncEmail,
    savedSyncEmails,
    setSyncEmail,
    addSyncEmail,
    removeSyncEmail,
    openSourceCloudConfig,
    updateOpenSourceCloudConfig,
    testOpenSourceCloudConnection,
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
  } = useApp();

  const activeAccountIdentifier = syncEmail || firebaseUser?.email || 'local_vault';

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

  const [activeTab, setActiveTab] = useState<
    'joplin_sync' | 'local' | 'history' | 'mobile_apk'
  >('joplin_sync');
  const [selectedDriveId, setSelectedDriveId] = useState<SyncDriveId>(
    joplinSyncSettings.primaryTarget === 'none' ? 'jivanos_vault' : joplinSyncSettings.primaryTarget
  );
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [inspectingVersion, setInspectingVersion] = useState<number | null>(null);

  // Email selector states
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');

  // Open source / drive test state
  const [isTestingOpenSource, setIsTestingOpenSource] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSnapshots = async () => {
    try {
      setIsLoadingSnapshots(true);
      const res = await fetch(`/api/backup/list/${encodeURIComponent(activeAccountIdentifier)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        setSnapshots(data.backups);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (isBackupModalOpen) {
      fetchSnapshots();
      setSuccessMessage(null);
      setErrorMessage(null);
      setTestResult(null);
    }
  }, [isBackupModalOpen, activeAccountIdentifier]);

  if (!isBackupModalOpen) return null;

  const selectedDriveConfig = joplinSyncSettings.drives[selectedDriveId];
  const selectedDriveMeta =
    JOPLIN_DRIVE_META.find((d) => d.id === selectedDriveId) || JOPLIN_DRIVE_META[0];
  const oauthCallbackUrl = `${window.location.origin}/auth/oauth-callback`;

  const handleCopyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(oauthCallbackUrl);
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSyncSelectedDrive = async (target?: SyncDriveId) => {
    setIsSyncingDrive(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await syncDriveNow(target);
      if (res?.success) {
        setSuccessMessage(res.message || 'Synchronized cleanly!');
      } else {
        setErrorMessage(
          res?.message || 'Sync could not complete. Check the selected drive configuration below.'
        );
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Drive sync failed.');
    } finally {
      setIsSyncingDrive(false);
    }
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

  const handleProviderBackup = async (providerId: CloudBackupProvider) => {
    setLoadingProvider(providerId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const success = await createCloudBackup(providerId, 'manual');
      if (success) {
        const nameMap: Record<string, string> = {
          firebase: 'Firebase Cloud (Firestore)',
          gdrive: 'Google Drive',
          onedrive: 'OneDrive',
          mega: 'MEGA Cloud',
          proton: 'Proton Drive',
          nextcloud: 'Nextcloud',
          webdav: 'WebDAV Storage',
          minio_s3: 'MinIO S3',
          omni_cloud: 'Omni Cloud Vault',
        };
        setSuccessMessage(
          `Encrypted snapshot uploaded to ${nameMap[providerId] || providerId} for vault: ${activeAccountIdentifier}`
        );
        await fetchSnapshots();
      } else {
        setErrorMessage(`Unable to upload backup to ${providerId}. Please try again.`);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Backup failed.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleRestoreSnapshot = async (version: number) => {
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
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailInput || !newEmailInput.trim()) {
      setErrorMessage('Please enter a valid vault identifier or email address.');
      return;
    }
    addSyncEmail(newEmailInput.trim());
    setSuccessMessage(`Vault identifier switched to: ${newEmailInput.trim()}`);
    setNewEmailInput('');
    setIsAddingEmail(false);
  };

  const handleTestOpenSource = async () => {
    setIsTestingOpenSource(true);
    setTestResult(null);
    try {
      const res = await testOpenSourceCloudConnection();
      setTestResult(res);
      if (res.success) {
        setSuccessMessage(res.message || 'Connection verified successfully!');
      } else {
        setErrorMessage(res.error || 'Connection failed.');
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Test connection failed.' });
    } finally {
      setIsTestingOpenSource(false);
    }
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
          setSuccessMessage(`Successfully imported and restored backup from ${file.name}!`);
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

  const proprietaryProviders = [
    {
      id: 'firebase' as const,
      name: 'Firebase Cloud (Firestore)',
      badge: 'Real-Time Sync',
      desc: 'Seamless Google-backed Firestore cloud database synchronization across web and Android APK app.',
      color: 'border-amber-300/80 dark:border-amber-700/60 bg-amber-500/5',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    {
      id: 'gdrive' as const,
      name: 'Google Drive',
      badge: 'Cloud Sync',
      desc: 'Backup tasks, habits, medications, and private reflections directly into your Google Drive.',
      color: 'border-amber-200/80 dark:border-amber-800/60',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    {
      id: 'onedrive' as const,
      name: 'Microsoft OneDrive',
      badge: 'Personal Vault',
      desc: 'Save redundant snapshot archives securely into Microsoft OneDrive cloud documents.',
      color: 'border-blue-200/80 dark:border-blue-800/60',
      btnColor: 'bg-blue-600 hover:bg-blue-500 text-white',
    },
    {
      id: 'mega' as const,
      name: 'MEGA Cloud',
      badge: 'Zero-Knowledge',
      desc: 'High-security end-to-end user-encrypted backup snapshot to your MEGA storage container.',
      color: 'border-rose-200/80 dark:border-rose-800/60',
      btnColor: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    {
      id: 'proton' as const,
      name: 'Proton Drive',
      badge: 'Swiss Privacy',
      desc: 'Zero-access encryption snapshot compatible with Proton Drive privacy standards.',
      color: 'border-purple-200/80 dark:border-purple-800/60',
      btnColor: 'bg-purple-600 hover:bg-purple-500 text-white',
    },
    {
      id: 'omni_cloud' as const,
      name: 'Omni Cloud Vault',
      badge: 'Fast Sync',
      desc: 'Continuous real-time encrypted server backup with auto-sync and instant device restoration.',
      color: 'border-indigo-200/80 dark:border-indigo-800/60',
      btnColor: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    },
  ];

  const activeMirrorCount = Object.values(joplinSyncSettings.drives).filter(
    (d) => d.enabled || d.autoBackupEnabled
  ).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-xs">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Local-First &amp; Multi-Drive Sync Hub
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Joplin Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zero mandatory login &bull; Sync tasks, habits, meds, bills &amp; personal profile across any drive
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsBackupModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-2.5 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('joplin_sync')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'joplin_sync'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FolderSync className="w-4 h-4 text-indigo-500" />
            <span>Multi-Drive Sync ({activeMirrorCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'local'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Export &amp; Import</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              fetchSnapshots();
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Snapshots ({snapshots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile_apk')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'mobile_apk'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>Android APK</span>
          </button>
        </div>

        {/* Alert Notifications */}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 0: JOPLIN-STYLE MULTI-DRIVE SYNC & AUTO-BACKUP */}
          {activeTab === 'joplin_sync' && (
            <div className="space-y-4">
              {/* Top Control Bar: Interval, Sync on Change, Personal Profile Sync, Sync All Now */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Auto-Sync Interval */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Interval:
                    </span>
                    <select
                      value={joplinSyncSettings.autoSyncIntervalMinutes}
                      onChange={(e) =>
                        updateJoplinSyncSettings({
                          autoSyncIntervalMinutes: Number(e.target.value) as any,
                        })
                      }
                      className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value={0}>Manual Only</option>
                      <option value={5}>Every 5 mins</option>
                      <option value={15}>Every 15 mins</option>
                      <option value={30}>Every 30 mins</option>
                      <option value={60}>Every 60 mins</option>
                    </select>
                  </div>

                  {/* Sync on Change */}
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joplinSyncSettings.syncOnChange}
                      onChange={(e) =>
                        updateJoplinSyncSettings({ syncOnChange: e.target.checked })
                      }
                      className="w-3.5 h-3.5 accent-indigo-600 rounded"
                    />
                    <span>Auto-Sync on Edit</span>
                  </label>

                  {/* Sync Personal Details (Photo, Name, DOB, Bio) */}
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joplinSyncSettings.syncPersonalDetails}
                      onChange={(e) =>
                        updateJoplinSyncSettings({ syncPersonalDetails: e.target.checked })
                      }
                      className="w-3.5 h-3.5 accent-emerald-600 rounded"
                    />
                    <UserCheck className="w-3 h-3" />
                    <span>Sync Personal Profile (Photo, DOB, Name)</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={isSyncingDrive}
                  onClick={() => handleSyncSelectedDrive()}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                  <span>{isSyncingDrive ? 'Syncing Drives...' : 'Sync All Active Drives'}</span>
                </button>
              </div>

              {/* Minimal 8-Drive Selector Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Select Drive to Configure (Click any drive &bull; Toggle multiple drives for Auto-Backup Mirroring)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Primary:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      {joplinSyncSettings.primaryTarget === 'none'
                        ? 'Local-Only'
                        : JOPLIN_DRIVE_META.find((d) => d.id === joplinSyncSettings.primaryTarget)?.name}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {JOPLIN_DRIVE_META.map((drive) => {
                    const cfg = joplinSyncSettings.drives[drive.id];
                    const isPrimary = joplinSyncSettings.primaryTarget === drive.id;
                    const isSelected = selectedDriveId === drive.id;
                    const isMirror = cfg?.autoBackupEnabled;
                    const isActive = isPrimary || cfg?.enabled || isMirror;

                    return (
                      <button
                        key={drive.id}
                        type="button"
                        onClick={() => setSelectedDriveId(drive.id)}
                        className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                            : isActive
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <ProviderLogo provider={drive.id} className="w-4 h-4 shrink-0" />
                          <div className="flex items-center gap-1">
                            {isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-600 text-white">
                                PRIMARY
                              </span>
                            )}
                            {isMirror && !isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                MIRROR
                              </span>
                            )}
                            {cfg?.lastStatus === 'synced' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {drive.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {cfg?.lastSyncedAt
                              ? `Synced ${new Date(cfg.lastSyncedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : drive.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Drive Configuration Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                      <ProviderLogo provider={selectedDriveId} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {selectedDriveMeta.name}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {selectedDriveMeta.protocol}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedDriveConfig?.lastSyncedAt
                          ? `Last synced: ${new Date(selectedDriveConfig.lastSyncedAt).toLocaleString()}`
                          : 'Not synced yet — configure below and click Sync This Drive'}
                      </p>
                    </div>
                  </div>

                  {/* Drive Role Switches */}
                  <div className="flex items-center gap-2 flex-wrap">
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
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                        joplinSyncSettings.primaryTarget === selectedDriveId
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {joplinSyncSettings.primaryTarget === selectedDriveId
                        ? '✓ Primary Sync Target'
                        : 'Set as Primary Target'}
                    </button>

                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer">
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
                      <span>Auto-Backup Mirror</span>
                    </label>
                  </div>
                </div>

                {/* Drive-Specific Minimal Fields */}
                {selectedDriveId === 'jivanos_vault' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>Zero-Login Cross-Device Vault (Joplin Server style):</strong> Enter any shared Vault Pairing Key on your Android APK, iOS, Windows, macOS, or Linux browser to sync &amp; auto-backup smoothly without needing Google or OAuth developer credentials.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          Vault Pairing Key (min 4 characters)
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
                            className="flex-1 min-w-0 text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const rand = `jivan-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
                              updateDriveConfig('jivanos_vault', { vaultId: rand, enabled: true });
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold hover:bg-indigo-100 transition shrink-0 cursor-pointer"
                            title="Generate a unique random Vault Key"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          Optional Access PIN (server verification)
                        </label>
                        <input
                          type="password"
                          value={selectedDriveConfig?.vaultPin || ''}
                          onChange={(e) =>
                            updateDriveConfig('jivanos_vault', { vaultPin: e.target.value })
                          }
                          placeholder="Optional 4-12 char PIN"
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedDriveId === 'local_folder' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>Joplin File System Sync:</strong> Pick any folder on your device (such as a{' '}
                      <strong>Syncthing</strong> shared folder, <strong>OneDrive</strong> folder,{' '}
                      <strong>Google Drive</strong> desktop folder, or <strong>iCloud Drive</strong>). JivanOS reads and writes{' '}
                      <code className="font-mono text-indigo-600 dark:text-indigo-400">jivanos-sync.json</code> directly inside it.
                    </p>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await pickLocalFolderForSync();
                          if (res?.success) {
                            setSuccessMessage(`Local sync folder "${res.folderName}" connected!`);
                          } else if (res?.error) {
                            setErrorMessage(res.error);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>
                          {selectedDriveConfig?.folderName
                            ? `Change Folder (${selectedDriveConfig.folderName})`
                            : 'Choose Local Sync Folder'}
                        </span>
                      </button>
                      {selectedDriveConfig?.folderName && (
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          Active Folder: {selectedDriveConfig.folderName}/jivanos-sync.json
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(selectedDriveId === 'onedrive' ||
                  selectedDriveId === 'gdrive' ||
                  selectedDriveId === 'dropbox') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          OAuth App Client ID (for 1-Click Popup Connect)
                        </label>
                        <input
                          type="text"
                          value={selectedDriveConfig?.clientId || ''}
                          onChange={(e) =>
                            updateDriveConfig(selectedDriveId, { clientId: e.target.value })
                          }
                          placeholder={
                            selectedDriveId === 'onedrive'
                              ? 'Azure App (Client) ID'
                              : selectedDriveId === 'gdrive'
                              ? 'Google OAuth Client ID'
                              : 'Dropbox App Key'
                          }
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          Or Paste Direct Access Token
                        </label>
                        <input
                          type="password"
                          value={selectedDriveConfig?.accessToken || ''}
                          onChange={(e) =>
                            updateDriveConfig(selectedDriveId, {
                              accessToken: e.target.value,
                              enabled: Boolean(e.target.value.trim()),
                            })
                          }
                          placeholder="Bearer token (auto-filled by OAuth popup)"
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => connectDriveOAuth(selectedDriveId)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Connect {selectedDriveMeta.name} via OAuth Popup</span>
                        </button>

                        {selectedDriveConfig?.accessToken && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Token Connected</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyCallbackUrl}
                        className="text-[11px] font-mono text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                        title="Copy OAuth Redirect URI for your Azure/Google/Dropbox App"
                      >
                        {copiedCallback ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedCallback ? 'Copied Redirect URI!' : 'Copy OAuth Redirect URI'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {(selectedDriveId === 'nextcloud' || selectedDriveId === 'webdav') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                        {selectedDriveId === 'nextcloud'
                          ? 'Nextcloud WebDAV URL'
                          : 'WebDAV Server Endpoint (Koofr, pCloud, Synology, OwnCloud)'}
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
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                        Username
                      </label>
                      <input
                        type="text"
                        value={selectedDriveConfig?.username || ''}
                        onChange={(e) =>
                          updateDriveConfig(selectedDriveId, { username: e.target.value })
                        }
                        placeholder="username"
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                        App Password / Token
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
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedDriveId === 's3' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                        S3 / R2 / MinIO Endpoint URL
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
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          Bucket Name
                        </label>
                        <input
                          type="text"
                          value={selectedDriveConfig?.s3Bucket || ''}
                          onChange={(e) =>
                            updateDriveConfig('s3', { s3Bucket: e.target.value })
                          }
                          placeholder="jivanos-sync"
                          className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                          Region
                        </label>
                        <input
                          type="text"
                          value={selectedDriveConfig?.s3Region || 'us-east-1'}
                          onChange={(e) =>
                            updateDriveConfig('s3', { s3Region: e.target.value })
                          }
                          placeholder="us-east-1"
                          className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
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
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
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
                        placeholder="••••••••••••••••"
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedDriveId === 'firebase' && (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {firebaseUser
                          ? `Connected to JivanOS Cloud as ${firebaseUser.email || firebaseUser.displayName}`
                          : 'Optional: Sign in with Google on web browsers to sync with JivanOS Cloud Firestore.'}
                      </p>
                      {!firebaseUser && (
                        <button
                          type="button"
                          onClick={loginWithGoogle}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                        >
                          Sign in with Google
                        </button>
                      )}
                    </div>
                    {authError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        {authError}
                      </p>
                    )}
                  </div>
                )}

                {/* Bottom Action Bar for Selected Drive + Check Config + Optional E2EE */}
                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={joplinSyncSettings.e2eeEnabled}
                        onChange={(e) =>
                          updateJoplinSyncSettings({ e2eeEnabled: e.target.checked })
                        }
                        className="w-3.5 h-3.5 accent-indigo-600 rounded"
                      />
                      <Lock className="w-3 h-3 text-indigo-500" />
                      <span>AES-256 E2EE Passphrase</span>
                    </label>
                    {joplinSyncSettings.e2eeEnabled && (
                      <input
                        type="password"
                        value={joplinSyncSettings.e2eePassphrase || ''}
                        onChange={(e) =>
                          updateJoplinSyncSettings({ e2eePassphrase: e.target.value })
                        }
                        placeholder="Enter encryption password"
                        className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-800 dark:text-slate-200 font-mono w-44"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isCheckingConfig || isSyncingDrive}
                      onClick={() => handleCheckConfiguration(selectedDriveId)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Cpu className={`w-3.5 h-3.5 text-indigo-500 ${isCheckingConfig ? 'animate-spin' : ''}`} />
                      <span>{isCheckingConfig ? 'Checking...' : 'Check Configuration'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSyncingDrive}
                      onClick={() => handleSyncSelectedDrive(selectedDriveId)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                      <span>Sync {selectedDriveMeta.name} Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* TAB 3: LOCAL BACKUP & RESTORE */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Export Local JSON File
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Download an offline copy of all your JivanOS data (tasks, habits, medications, bills, and personal profile) directly to your device.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={downloadLocalBackupFile}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Import &amp; Restore from File
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Select any previously exported JivanOS JSON backup file to instantly restore your data.
                    </p>
                  </div>

                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="input-restore-backup"
                    />
                    <label
                      htmlFor="input-restore-backup"
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Backup File</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>CSV &amp; Combined Archive Exports</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Export your habit completion logs, tasks, and schedule items as separate CSV spreadsheets or a combined JSON bundle.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={exportHabitsCSV}
                    className="py-2 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Habits CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportTasksCSV}
                    className="py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Tasks CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportScheduleCSV}
                    className="py-2 px-3 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Schedule CSV</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={exportCombinedBundle}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Combined Full Data Archive (JSON Bundle)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SNAPSHOT HISTORY & RESTORE */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Snapshots for:
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                    {activeAccountIdentifier}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchSnapshots}
                  disabled={isLoadingSnapshots}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Database className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                  <p className="text-xs text-slate-500 font-medium">
                    No snapshots recorded yet for {activeAccountIdentifier}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {snapshots.map((snap) => {
                    const isRestoring = restoringVersion === snap.version;
                    return (
                      <div
                        key={snap.version}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                            <ProviderLogo provider={snap.provider} className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                Snapshot #{snap.version}
                              </h5>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                                {snap.provider}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span>{new Date(snap.timestamp).toLocaleString()}</span>
                              <span>•</span>
                              <span>{(snap.sizeBytes / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectingVersion(snap.version)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="hidden sm:inline">Inspect</span>
                          </button>

                          <button
                            type="button"
                            disabled={isRestoring}
                            onClick={() => handleRestoreSnapshot(snap.version)}
                            className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1"
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

          {/* TAB 5: MOBILE APK BUILD */}
          {activeTab === 'mobile_apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Universal Local-First Android APK &amp; Multi-OS App</span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-md">
                        Zero Personal Data Baked In
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Anyone can install the APK or PWA on Android, iOS, Windows, macOS, or Linux. It starts as a clean Local-First vault and lets each user connect JivanOS Private Vault, OneDrive, Google Drive, Dropbox, Nextcloud, WebDAV, S3, or Syncthing.
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 rounded-xl px-3 py-2">
                      <strong>Updating from legacy v2.1.x APKs:</strong> v3.0.0+ pins a deterministic release keystore (<code className="font-mono">com.jivanos.lifesystem</code>) so future updates install in-place without uninstalling. If updating from an older v2.1.x APK triggers a package conflict, export a JSON backup (or sync to a drive), uninstall v2.1.x once, and install v3.0.x.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 space-y-3 border border-slate-800 font-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-sans font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Build Clean Multi-User Android APK with Capacitor:</span>
                </div>
                <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
{`npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "JivanOS" "com.jivanos.lifesystem" --web-dir "dist"
npm run build && npx cap add android && npx cap sync
cd android && ./gradlew assembleRelease`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Mode:</span>
            <strong className="text-slate-800 dark:text-slate-200">
              Local-First + {activeMirrorCount} Connected Drive{activeMirrorCount === 1 ? '' : 's'}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
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
        onRestore={handleRestoreSnapshot}
      />
    </div>
  );
};
