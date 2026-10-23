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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CloudBackupProvider, OpenSourceCloudConfig } from '../../types';
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
    journalEntries,
    scheduleItems,
  } = useApp();

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
    const rows = habits.map(h => [
      `"${h.name.replace(/"/g, '""')}"`,
      h.category,
      h.habitType || 'boolean',
      h.targetDaysPerWeek || 7,
      h.currentStreak || 0,
      `"${Object.keys(h.completionHistory || {}).filter(d => h.completionHistory[d]).join(', ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(`habits_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportTasksCSV = () => {
    const headers = ['Task Title', 'Category', 'Priority', 'Status', 'Project', 'Due Date', 'Completed'];
    const rows = tasks.map(t => [
      `"${t.title.replace(/"/g, '""')}"`,
      t.category,
      t.priority || 'P2',
      t.status || 'todo',
      `"${t.project || 'General'}"`,
      t.dueDate || '',
      t.completed ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(`tasks_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportJournalCSV = () => {
    const headers = ['Date', 'Title', 'Mood', 'Template', 'Tags', 'Content'];
    const rows = journalEntries.map(j => [
      j.date || '',
      `"${(j.title || '').replace(/"/g, '""')}"`,
      j.mood || '',
      j.templateType || '',
      `"${(j.tags || []).join(', ')}"`,
      `"${(j.content || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(`journal_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportScheduleCSV = () => {
    const headers = ['Title', 'Date', 'Start Time', 'End Time', 'Category', 'Priority', 'Completed'];
    const rows = scheduleItems.map(s => [
      `"${s.title.replace(/"/g, '""')}"`,
      s.date,
      s.startTime,
      s.endTime,
      s.category,
      s.priority || 'P2',
      s.completed ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(`schedule_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportCombinedBundle = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      habits,
      tasks,
      journalEntries,
      scheduleItems,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `omnilifeos_combined_bundle_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activeTab, setActiveTab] = useState<'cloud' | 'opensource' | 'local' | 'history' | 'mobile_apk'>('cloud');
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

  // Open source test state
  const [isTestingOpenSource, setIsTestingOpenSource] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSnapshots = async () => {
    try {
      setIsLoadingSnapshots(true);
      const res = await fetch(`/api/backup/list/${encodeURIComponent(syncEmail || 'jaiprakashog@gmail.com')}`);
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
  }, [isBackupModalOpen, syncEmail]);

  if (!isBackupModalOpen) return null;

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
        setSuccessMessage(`Encrypted snapshot uploaded to ${nameMap[providerId] || providerId} for account: ${syncEmail}`);
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
    if (!window.confirm(`Are you sure you want to restore Snapshot Version ${version}? Current data will be replaced by this backup snapshot.`)) {
      return;
    }

    setRestoringVersion(version);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const success = await restoreCloudBackup(version);
      if (success) {
        setSuccessMessage(`Snapshot #${version} restored successfully for ${syncEmail}.`);
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
    if (!newEmailInput || !newEmailInput.trim() || !newEmailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address (e.g. user@example.com)');
      return;
    }
    addSyncEmail(newEmailInput.trim());
    setSuccessMessage(`Sync target account switched to: ${newEmailInput.trim()}`);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Backup & Cloud Storage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sync with open-source Nextcloud, MinIO, WebDAV, or commercial cloud drives
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

        {/* Selected Email Identity Bar - Prominent & Visible */}
        <div className="px-5 py-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100/80 dark:border-indigo-900/40 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Selected Sync Account:
                  </span>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-mono truncate bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-xs">
                    {syncEmail}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Target
                  </span>
                </div>
              </div>
            </div>

            {/* Email Switcher Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="relative">
                <select
                  value={syncEmail}
                  onChange={(e) => setSyncEmail(e.target.value)}
                  className="text-xs font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                  title="Switch target email account"
                >
                  {savedSyncEmails.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>
              </div>

              {!isAddingEmail ? (
                <button
                  type="button"
                  onClick={() => setIsAddingEmail(true)}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition flex items-center gap-1 shrink-0"
                  title="Add another email ID to sync/backup"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Email</span>
                </button>
              ) : (
                <form onSubmit={handleAddEmail} className="flex items-center gap-1.5">
                  <input
                    type="email"
                    placeholder="name@email.com"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    className="w-36 sm:w-44 text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 shadow-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingEmail(false);
                      setNewEmailInput('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {savedSyncEmails.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSyncEmail(syncEmail)}
                  title={`Remove ${syncEmail} from list`}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cloud'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Commercial Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('opensource')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'opensource'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Server className="w-4 h-4 text-emerald-500" />
            <span className="flex items-center gap-1">
              <span>Open Source Cloud</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold uppercase">
                Self-Hosted
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'local'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Local Archive</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              fetchSnapshots();
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
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
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'mobile_apk'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span className="flex items-center gap-1">
              <span>Android APK Build</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold uppercase">
                Native App
              </span>
            </span>
          </button>
        </div>

        {/* Alert Notifications */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
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
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
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
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: COMMERCIAL CLOUD DRIVES */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              {/* Informative Google Drive & Account Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <ProviderLogo provider="gdrive" className="w-4 h-4 shrink-0" />
                    <span>Google Drive &amp; Cloud Sync Guide</span>
                  </div>
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline"
                  >
                    <span>drive.google.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  Clicking <strong>Google Drive</strong> creates a complete, timestamped encrypted snapshot in your workspace cloud vault tied to <strong>{syncEmail}</strong>. To keep a direct file copy in your personal Google Drive folder, click <strong>Snapshot History</strong> below to inspect your data or download the JSON file anytime.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {proprietaryProviders.map((p) => {
                  const isLoading = loadingProvider === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border ${p.color} bg-white dark:bg-slate-800/50 flex flex-col justify-between gap-3 shadow-xs transition hover:shadow-md`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <ProviderLogo provider={p.id} className="w-5 h-5 shrink-0" />
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {p.name}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {p.desc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Target: {syncEmail.split('@')[0]}
                        </span>
                        <button
                          type="button"
                          disabled={!!loadingProvider}
                          onClick={() => handleProviderBackup(p.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${p.btnColor}`}
                        >
                          {isLoading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3.5 h-3.5" />
                              <span>Backup Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: OPEN SOURCE CLOUD BACKUP & SYNC */}
          {activeTab === 'opensource' && (
            <div className="space-y-4">
              {/* Introduction Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>Open Source Cloud & Self-Hosted Synchronization</span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  Store and sync your Jivan snapshots directly to your own self-hosted infrastructure. Completely sovereign, non-proprietary, and zero-vendor-lockin.
                </p>
              </div>

              {/* Provider Selection Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'nextcloud' as const,
                    title: 'Nextcloud',
                    subtitle: 'WebDAV Protocol',
                    desc: 'Official Nextcloud / ownCloud instance',
                  },
                  {
                    id: 'minio_s3' as const,
                    title: 'MinIO S3',
                    subtitle: 'Object Storage',
                    desc: 'High-performance S3 compatible storage',
                  },
                  {
                    id: 'webdav' as const,
                    title: 'Generic WebDAV',
                    subtitle: 'NAS / Synology / Apache',
                    desc: 'Standard WebDAV compliant drive',
                  },
                ].map((item) => {
                  const isSelected = openSourceCloudConfig.provider === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateOpenSourceCloudConfig({ provider: item.id })}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <ProviderLogo provider={item.id} className="w-5 h-5 shrink-0" />
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {item.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Provider Configuration Form */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-indigo-500" />
                    <span>
                      Configure {openSourceCloudConfig.provider === 'nextcloud' ? 'Nextcloud' : openSourceCloudConfig.provider === 'minio_s3' ? 'MinIO S3' : 'WebDAV'} Server
                    </span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Account: {syncEmail}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Server Endpoint URL */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {openSourceCloudConfig.provider === 'minio_s3' ? 'S3 Endpoint URL / Host' : 'WebDAV Server URL / Endpoint'}
                    </label>
                    <input
                      type="url"
                      value={openSourceCloudConfig.serverUrl}
                      onChange={(e) => updateOpenSourceCloudConfig({ serverUrl: e.target.value })}
                      placeholder={
                        openSourceCloudConfig.provider === 'nextcloud'
                          ? 'https://your-nextcloud.domain.com/remote.php/dav/files/username/'
                          : openSourceCloudConfig.provider === 'minio_s3'
                          ? 'https://minio.your-domain.com:9000'
                          : 'https://webdav.your-nas.local/remote.php/webdav/'
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Username / Access Key */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {openSourceCloudConfig.provider === 'minio_s3' ? 'Access Key ID' : 'Username / Login Email'}
                    </label>
                    <input
                      type="text"
                      value={openSourceCloudConfig.username}
                      onChange={(e) => updateOpenSourceCloudConfig({ username: e.target.value })}
                      placeholder={syncEmail}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Auth Secret / App Password */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {openSourceCloudConfig.provider === 'minio_s3' ? 'Secret Access Key' : 'App Password / Auth Token'}
                    </label>
                    <input
                      type="password"
                      value={openSourceCloudConfig.authSecret}
                      onChange={(e) => updateOpenSourceCloudConfig({ authSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  {/* Target Folder or Bucket */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {openSourceCloudConfig.provider === 'minio_s3' ? 'S3 Bucket Name' : 'Remote Storage Directory'}
                    </label>
                    <input
                      type="text"
                      value={openSourceCloudConfig.provider === 'minio_s3' ? (openSourceCloudConfig.s3Bucket || 'omnilife-backups') : openSourceCloudConfig.remotePath}
                      onChange={(e) => {
                        if (openSourceCloudConfig.provider === 'minio_s3') {
                          updateOpenSourceCloudConfig({ s3Bucket: e.target.value });
                        } else {
                          updateOpenSourceCloudConfig({ remotePath: e.target.value });
                        }
                      }}
                      placeholder={openSourceCloudConfig.provider === 'minio_s3' ? 'omnilife-backups' : '/OmniLifeOS_Backups'}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  {/* S3 Region if applicable */}
                  {openSourceCloudConfig.provider === 'minio_s3' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Region (Optional)
                      </label>
                      <input
                        type="text"
                        value={openSourceCloudConfig.s3Region || 'us-east-1'}
                        onChange={(e) => updateOpenSourceCloudConfig({ s3Region: e.target.value })}
                        placeholder="us-east-1"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Connection Test & Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <button
                    type="button"
                    disabled={isTestingOpenSource || !openSourceCloudConfig.serverUrl}
                    onClick={handleTestOpenSource}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingOpenSource ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Test Server Ping</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!!loadingProvider}
                    onClick={() => handleProviderBackup(openSourceCloudConfig.provider)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {loadingProvider === openSourceCloudConfig.provider ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Syncing to {openSourceCloudConfig.provider.toUpperCase()}...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Backup to {openSourceCloudConfig.provider === 'nextcloud' ? 'Nextcloud' : openSourceCloudConfig.provider === 'minio_s3' ? 'MinIO' : 'WebDAV'} Now</span>
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message || testResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LOCAL BACKUP & RESTORE */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Download Local Backup */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Export Local JSON File
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Download an offline copy of all your OmniLifeOS data (tasks, habits, journal, health trackers, and configurations) directly to your computer or mobile device.
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

                {/* Restore From File */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Import & Restore from File
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Select any previously exported OmniLifeOS JSON backup file to instantly restore your data.
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

              {/* CSV & Separate/Combined Record Keeping Exports */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>CSV & Separate/Combined Record Keeping Exports</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Export your personal habit completion logs, tasks, journal entries, and schedule items as separate CSV files or as a combined archive for long-term record keeping.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={exportHabitsCSV}
                    className="py-2 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🎯 Habits CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportTasksCSV}
                    className="py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📋 Tasks CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportJournalCSV}
                    className="py-2 px-3 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📖 Journal CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportScheduleCSV}
                    className="py-2 px-3 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📅 Schedule CSV</span>
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
                    {syncEmail}
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

              {/* Informational banner about data inspection and Google Drive */}
              <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ProviderLogo provider="gdrive" className="w-4 h-4 shrink-0" />
                  <span>
                    Need to check your data or move it to your Google Drive? Click <strong>Inspect</strong> to view inside, or <strong>Download</strong> to save the JSON file directly.
                  </span>
                </div>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Database className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                  <p className="text-xs text-slate-500 font-medium">No snapshots recorded yet for {syncEmail}.</p>
                  <p className="text-[11px] text-slate-400">
                    Trigger a backup using the Commercial Cloud or Open Source tabs to record your first snapshot!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {snapshots.map((snap) => {
                    const isRestoring = restoringVersion === snap.version;
                    const providerLabel =
                      snap.provider === 'gdrive' ? 'Google Drive' :
                      snap.provider === 'onedrive' ? 'OneDrive' :
                      snap.provider === 'mega' ? 'MEGA' :
                      snap.provider === 'proton' ? 'Proton Drive' :
                      snap.provider === 'nextcloud' ? 'Nextcloud (WebDAV)' :
                      snap.provider === 'minio_s3' ? 'MinIO S3' :
                      snap.provider === 'webdav' ? 'WebDAV Storage' : 'Omni Cloud';

                    return (
                      <div
                        key={snap.version}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                            <ProviderLogo provider={snap.provider} className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                Snapshot #{snap.version}
                              </h5>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                                {providerLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span>{new Date(snap.timestamp).toLocaleString()}</span>
                              <span>•</span>
                              <span>{(snap.sizeBytes / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                                {snap.accountEmail || syncEmail}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Inspect / View Data button */}
                          <button
                            type="button"
                            onClick={() => setInspectingVersion(snap.version)}
                            title="Inspect snapshot payload"
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="hidden sm:inline">Inspect</span>
                          </button>

                          {/* Download JSON button */}
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/backup/download/${encodeURIComponent(
                                  snap.accountEmail || syncEmail
                                )}/${snap.version}`,
                                '_blank'
                              )
                            }
                            title="Download JSON snapshot"
                            className="px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-semibold transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Download</span>
                          </button>

                          {/* Restore button */}
                          <button
                            type="button"
                            disabled={isRestoring || !!loadingProvider}
                            onClick={() => handleRestoreSnapshot(snap.version)}
                            className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold transition flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            {isRestoring ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="hidden sm:inline">Restoring...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Restore</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Mobile APK Build & Sync Tab */}
          {activeTab === 'mobile_apk' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Real Native Android App (.APK)</span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-md">
                        Offline-First + Cloud Sync
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Compile this exact application into an installable Android APK package using Capacitor. The mobile app stores all data locally in high-speed device storage (SQLite/LocalStorage) and automatically synchronizes with the web application via Google Firebase Firestore.
                    </p>
                  </div>
                </div>
              </div>

              {/* Real-Time Sync Architecture Clarification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Database className="w-4 h-4" />
                    <span>How Local &amp; Web Data Syncs</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    When you run the app on Android, any offline actions (completing tasks, logging medicine doses, drinking water, journaling) are saved instantly on device. Once connected to WiFi or mobile data, changes automatically upload to your Firebase Firestore document:
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-[11px] font-mono text-indigo-600 dark:text-indigo-300">
                    users/{syncEmail || 'your_account'}/payload
                  </code>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <Cloud className="w-4 h-4" />
                    <span>Where Google Drive Saves</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    When you click "Google Drive Backup", your encrypted JSON snapshot is stored directly in your root Google Drive under an application data directory:
                  </p>
                  <code className="block p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-[11px] font-mono text-emerald-600 dark:text-emerald-300">
                    Google Drive &gt; OmniLifeOS_Backups &gt; snapshot.json
                  </code>
                </div>
              </div>

              {/* Step-by-Step Compilation Commands */}
              <div className="p-5 rounded-2xl bg-slate-900 text-slate-100 space-y-4 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Step-by-Step: Generate .APK File
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Run on your computer with Node.js &amp; Android Studio</span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 font-sans block text-[11px] mb-1">
                      1. Export the project (Settings &rarr; Export ZIP) and install Capacitor:
                    </span>
                    <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
npm install @capacitor/core @capacitor/cli @capacitor/android
                    </pre>
                  </div>

                  <div>
                    <span className="text-slate-400 font-sans block text-[11px] mb-1">
                      2. Initialize Capacitor configuration:
                    </span>
                    <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
npx cap init "OmniLifeOS" "com.omnilife.app" --web-dir "dist"
                    </pre>
                  </div>

                  <div>
                    <span className="text-slate-400 font-sans block text-[11px] mb-1">
                      3. Build production web assets and attach Android project:
                    </span>
                    <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
npm run build && npx cap add android && npx cap sync
                    </pre>
                  </div>

                  <div>
                    <span className="text-slate-400 font-sans block text-[11px] mb-1">
                      4. Open in Android Studio or compile debug APK directly:
                    </span>
                    <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-emerald-300 select-all overflow-x-auto">
# Option A: Open Android Studio to build &amp; sign APK
npx cap open android

# Option B: Direct CLI build (if Android SDK is installed)
cd android && ./gradlew assembleDebug
# Generated APK: android/app/build/outputs/apk/debug/app-debug.apk
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Target Account:</span>
            <strong className="font-mono text-slate-800 dark:text-slate-200">{syncEmail}</strong>
          </div>
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Snapshot Inspector Modal */}
      <SnapshotInspectorModal
        isOpen={inspectingVersion !== null}
        onClose={() => setInspectingVersion(null)}
        version={inspectingVersion}
        accountEmail={syncEmail}
        onRestore={handleRestoreSnapshot}
      />
    </div>
  );
};
