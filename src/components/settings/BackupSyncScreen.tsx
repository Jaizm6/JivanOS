import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Globe,
  HardDrive,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Server,
  Share2,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyncDriveId } from '../../types';
import { showAndroidToast } from '../common/AndroidToast';
import { M3Switch } from '../common/PetalExpressive';
import { JivanOSCloudSection } from '../../sync/ui/JivanOSCloudSection';
import { GoogleDriveSyncSection } from './GoogleDriveSyncSection';
import { DropboxSyncSection } from './DropboxSyncSection';
import { TelegramSyncSection } from '../../sync/ui/TelegramSyncSection';
import { MEGASyncSection } from '../../sync/ui/MEGASyncSection';
import { SyncProviderCard } from './SyncProviderCard';
import { SettingsSubpageHeader } from './SettingsSubpageHeader';
import {
  DRIVE_SYNC_STATE_EVENT,
  formatRelativeSyncTime,
} from '../../utils/googleDriveSync';
import { DROPBOX_SYNC_STATE_EVENT } from '../../utils/dropboxSync';
import { TELEGRAM_SYNC_STATE_EVENT, telegramSyncProvider } from '../../sync/providers/TelegramSyncProvider';
import { MEGA_SYNC_STATE_EVENT, megaSyncProvider } from '../../sync/providers/MEGASyncProvider';
import { JIVANOS_CLOUD_STATE_EVENT, firestoreSyncProvider } from '../../sync/providers/FirestoreSyncProvider';
import {
  LOCAL_SNAPSHOTS_UPDATED_EVENT,
  LocalSnapshotMeta,
  BackupValidationSummary,
  exportLocalBackup,
  formatSnapshotSize,
  formatSnapshotTimestamp,
  isAndroidNativeBackupAvailable,
  listLocalSnapshots,
  readLocalSnapshot,
  saveRotatingAutoSnapshot,
  validateBackupPayload,
} from '../../utils/localBackupEngine';
import {
  UnifiedProviderId,
  getRealSyncOverview,
} from '../../sync/syncConnectionState';

interface BackupSyncScreenProps {
  onBack: () => void;
}

interface PendingRestorePayload {
  sourceLabel: string;
  rawJson: string;
  summary: BackupValidationSummary;
}

const WEBDAV_PRESETS: { label: string; urlTemplate: string }[] = [
  { label: 'Nextcloud', urlTemplate: 'https://your-server.com/remote.php/dav/files/USERNAME/' },
  { label: 'Koofr', urlTemplate: 'https://app.koofr.net/dav/Koofr' },
  { label: 'Box', urlTemplate: 'https://dav.box.com/dav' },
  { label: 'Hetzner', urlTemplate: 'https://uXXXXXX.your-storagebox.de' },
];

const INTERVAL_SEGMENTS: { label: string; value: 15 | 30 | 60 | 0 }[] = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: 'Manual', value: 0 },
];

export const BackupSyncScreen: React.FC<BackupSyncScreenProps> = ({ onBack }) => {
  const {
    firebaseUser,
    joplinSyncSettings,
    updateJoplinSyncSettings,
    updateDriveConfig,
    syncDriveNow,
    exportEncryptedJSON,
    replaceAllAppDataFromBackup,
  } = useApp();

  // Trigger live re-evaluation whenever any provider's real auth/sync state changes
  const [, setSyncStateVersion] = useState(0);
  useEffect(() => {
    const bump = () => setSyncStateVersion((v) => v + 1);
    window.addEventListener(DRIVE_SYNC_STATE_EVENT, bump);
    window.addEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
    window.addEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
    window.addEventListener(MEGA_SYNC_STATE_EVENT, bump);
    window.addEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    return () => {
      window.removeEventListener(DRIVE_SYNC_STATE_EVENT, bump);
      window.removeEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
      window.removeEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
      window.removeEventListener(MEGA_SYNC_STATE_EVENT, bump);
      window.removeEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    };
  }, []);

  const overview = useMemo(
    () => getRealSyncOverview(firebaseUser, joplinSyncSettings),
    [firebaseUser, joplinSyncSettings]
  );

  // Header "Sync Now" state (only active when a connected provider exists)
  const [isHeaderSyncing, setIsHeaderSyncing] = useState(false);

  // ── WebDAV / Nextcloud (merged single card) local form state ──
  const existingDav = useMemo(() => {
    const w = joplinSyncSettings.drives.webdav;
    const n = joplinSyncSettings.drives.nextcloud;
    if (w?.serverUrl?.trim() && w?.username?.trim() && w?.password?.trim()) return w;
    if (n?.serverUrl?.trim() && n?.username?.trim() && n?.password?.trim()) return n;
    return w;
  }, [joplinSyncSettings.drives.webdav, joplinSyncSettings.drives.nextcloud]);

  const isWebDavConnected = Boolean(
    existingDav?.serverUrl?.trim() &&
      existingDav?.username?.trim() &&
      existingDav?.password?.trim()
  );

  const [davFormOpen, setDavFormOpen] = useState(false);
  const [davUrl, setDavUrl] = useState(existingDav?.serverUrl || '');
  const [davUsername, setDavUsername] = useState(existingDav?.username || '');
  const [davPassword, setDavPassword] = useState('');
  const [davStatus, setDavStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>(() =>
    existingDav?.lastSyncedAt ? 'synced' : 'idle'
  );
  const [davError, setDavError] = useState<string | null>(null);

  // ── Advanced S3 / R2 / MinIO (expandable, zero pre-filled defaults) ──
  const s3Cfg = joplinSyncSettings.drives.s3;
  const isS3Connected = Boolean(
    s3Cfg?.s3Endpoint?.trim() &&
      s3Cfg?.s3Bucket?.trim() &&
      s3Cfg?.s3AccessKey?.trim() &&
      s3Cfg?.s3SecretKey?.trim()
  );
  const [showAdvancedS3, setShowAdvancedS3] = useState(isS3Connected);
  const [s3FormOpen, setS3FormOpen] = useState(false);
  const [s3Endpoint, setS3Endpoint] = useState(s3Cfg?.s3Endpoint || '');
  const [s3Bucket, setS3Bucket] = useState(
    s3Cfg?.s3Bucket && s3Cfg.s3Bucket !== 'jivanos-sync' ? s3Cfg.s3Bucket : ''
  );
  const [s3Region, setS3Region] = useState(
    s3Cfg?.s3Region && s3Cfg.s3Region !== 'auto' && s3Cfg.s3Region !== 'us-east-1'
      ? s3Cfg.s3Region
      : ''
  );
  const [s3AccessKey, setS3AccessKey] = useState(s3Cfg?.s3AccessKey || '');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3Status, setS3Status] = useState<'idle' | 'syncing' | 'synced' | 'error'>(() =>
    s3Cfg?.lastSyncedAt ? 'synced' : 'idle'
  );
  const [s3Error, setS3Error] = useState<string | null>(null);

  // ── Section 3: Local Backup & Recent Snapshots (last 3 rotating) ──
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [snapshots, setSnapshots] = useState<LocalSnapshotMeta[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestorePayload | null>(null);
  const isNativeAndroid = isAndroidNativeBackupAvailable();

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await listLocalSnapshots();
      if (list.length === 0) {
        const seeded = await saveRotatingAutoSnapshot(exportEncryptedJSON());
        setSnapshots(seeded);
      } else {
        setSnapshots(list);
      }
    } catch {
      setSnapshots([]);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [exportEncryptedJSON]);

  useEffect(() => {
    refreshSnapshots();
    const handleUpdated = () => {
      listLocalSnapshots()
        .then(setSnapshots)
        .catch(() => {});
    };
    window.addEventListener(LOCAL_SNAPSHOTS_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(LOCAL_SNAPSHOTS_UPDATED_EVENT, handleUpdated);
  }, [refreshSnapshots]);

  // Active primary target among connected providers
  const activePrimaryProviderId: UnifiedProviderId | null = useMemo(() => {
    if (!overview.hasAnyConnected) return null;
    const current = joplinSyncSettings.primaryTarget;
    const normalized: UnifiedProviderId | null =
      current === 'nextcloud' ? 'webdav' : (current as UnifiedProviderId);
    if (normalized && overview.connectedProviders.some((p) => p.id === normalized)) {
      return normalized;
    }
    return overview.connectedProviders[0]?.id || null;
  }, [overview, joplinSyncSettings.primaryTarget]);

  const handleSelectPrimaryProvider = (id: UnifiedProviderId) => {
    if (id === 'telegram' || id === 'mega') {
      // Telegram and MEGA use their own SyncProvider schedulers; keep joplin primary target cleanly synced
      updateJoplinSyncSettings({ primaryTarget: 'none' });
      showAndroidToast(
        `Primary sync set to ${id === 'mega' ? 'MEGA' : 'Telegram'}`,
        2200,
        'default'
      );
      return;
    }
    updateJoplinSyncSettings({ primaryTarget: id as SyncDriveId });
    showAndroidToast(
      `Primary sync set to ${overview.connectedProviders.find((p) => p.id === id)?.label || id}`,
      2200,
      'default'
    );
  };

  const handleHeaderSyncNow = async () => {
    if (!activePrimaryProviderId || isHeaderSyncing) return;
    setIsHeaderSyncing(true);
    try {
      if (activePrimaryProviderId === 'telegram') {
        const localData = JSON.parse(exportEncryptedJSON());
        await telegramSyncProvider.backup(localData);
        showAndroidToast('Backup sent to Telegram', 2600, 'success');
      } else if (activePrimaryProviderId === 'mega') {
        const localData = JSON.parse(exportEncryptedJSON());
        await megaSyncProvider.backup(localData);
        showAndroidToast('Encrypted backup synced to MEGA', 2600, 'success');
      } else if (activePrimaryProviderId === 'firebase') {
        const localData = JSON.parse(exportEncryptedJSON());
        await firestoreSyncProvider.backup(localData);
        showAndroidToast('Synced to JivanOS Cloud', 2600, 'success');
      } else {
        const res = await syncDriveNow(activePrimaryProviderId as SyncDriveId);
        showAndroidToast(res.message, 2800, res.success ? 'success' : 'error');
      }
    } catch (err: any) {
      showAndroidToast(err?.message || 'Sync failed', 3200, 'error');
    } finally {
      setIsHeaderSyncing(false);
    }
  };

  // WebDAV / Nextcloud handlers
  const handleConnectWebDav = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = davUrl.trim();
    const user = davUsername.trim();
    const pass = davPassword;
    if (!url || !user || !pass) {
      setDavError('Please enter Server URL, Username, and Password / App Token.');
      return;
    }
    setDavError(null);
    setDavStatus('syncing');
    updateDriveConfig('webdav', {
      serverUrl: url,
      username: user,
      password: pass,
      remotePath: '/JivanOS',
      enabled: true,
    });
    // Clear legacy duplicate nextcloud config so only one WebDAV / Nextcloud entry exists
    updateDriveConfig('nextcloud', {
      serverUrl: '',
      username: '',
      password: '',
      enabled: false,
      autoBackupEnabled: false,
    });

    try {
      const res = await syncDriveNow('webdav');
      if (res.success) {
        setDavStatus('synced');
        setDavFormOpen(false);
        setDavPassword('');
        showAndroidToast('Connected & synced WebDAV / Nextcloud', 2600, 'success');
      } else {
        setDavStatus('error');
        setDavError(res.message || 'Could not reach WebDAV server.');
      }
    } catch (err: any) {
      setDavStatus('error');
      setDavError(err?.message || 'WebDAV connection failed.');
    }
  };

  const handleSyncWebDav = async () => {
    setDavStatus('syncing');
    setDavError(null);
    try {
      const res = await syncDriveNow('webdav');
      if (res.success) {
        setDavStatus('synced');
        showAndroidToast('Synced to WebDAV / Nextcloud', 2600, 'success');
      } else {
        setDavStatus('error');
        setDavError(res.message || 'WebDAV sync failed.');
      }
    } catch (err: any) {
      setDavStatus('error');
      setDavError(err?.message || 'WebDAV sync failed.');
    }
  };

  const handleDisconnectWebDav = () => {
    updateDriveConfig('webdav', {
      serverUrl: '',
      username: '',
      password: '',
      enabled: false,
      autoBackupEnabled: false,
      lastSyncedAt: undefined,
      lastStatus: 'idle',
    });
    updateDriveConfig('nextcloud', {
      serverUrl: '',
      username: '',
      password: '',
      enabled: false,
      autoBackupEnabled: false,
      lastSyncedAt: undefined,
      lastStatus: 'idle',
    });
    if (
      joplinSyncSettings.primaryTarget === 'webdav' ||
      joplinSyncSettings.primaryTarget === 'nextcloud'
    ) {
      updateJoplinSyncSettings({ primaryTarget: 'none' });
    }
    setDavUrl('');
    setDavUsername('');
    setDavPassword('');
    setDavStatus('idle');
    setDavError(null);
    setDavFormOpen(false);
    showAndroidToast('Disconnected WebDAV / Nextcloud', 2400, 'default');
  };

  // S3 / MinIO handlers
  const handleConnectS3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s3Endpoint.trim() || !s3Bucket.trim() || !s3AccessKey.trim() || !s3SecretKey.trim()) {
      setS3Error('Please complete Endpoint URL, Bucket, Access Key ID, and Secret Access Key.');
      return;
    }
    setS3Error(null);
    setS3Status('syncing');
    updateDriveConfig('s3', {
      s3Endpoint: s3Endpoint.trim(),
      serverUrl: s3Endpoint.trim(),
      s3Bucket: s3Bucket.trim(),
      s3Region: s3Region.trim(),
      s3AccessKey: s3AccessKey.trim(),
      username: s3AccessKey.trim(),
      s3SecretKey: s3SecretKey.trim(),
      password: s3SecretKey.trim(),
      enabled: true,
    });
    try {
      const res = await syncDriveNow('s3');
      if (res.success) {
        setS3Status('synced');
        setS3FormOpen(false);
        setS3SecretKey('');
        showAndroidToast('Connected & synced S3 / MinIO', 2600, 'success');
      } else {
        setS3Status('error');
        setS3Error(res.message || 'Could not reach S3 bucket.');
      }
    } catch (err: any) {
      setS3Status('error');
      setS3Error(err?.message || 'S3 connection failed.');
    }
  };

  const handleSyncS3 = async () => {
    setS3Status('syncing');
    setS3Error(null);
    try {
      const res = await syncDriveNow('s3');
      if (res.success) {
        setS3Status('synced');
        showAndroidToast('Synced to S3 / MinIO', 2600, 'success');
      } else {
        setS3Status('error');
        setS3Error(res.message || 'S3 sync failed.');
      }
    } catch (err: any) {
      setS3Status('error');
      setS3Error(err?.message || 'S3 sync failed.');
    }
  };

  const handleDisconnectS3 = () => {
    updateDriveConfig('s3', {
      s3Endpoint: '',
      serverUrl: '',
      s3Bucket: '',
      s3Region: '',
      s3AccessKey: '',
      username: '',
      s3SecretKey: '',
      password: '',
      enabled: false,
      autoBackupEnabled: false,
      lastSyncedAt: undefined,
      lastStatus: 'idle',
    });
    if (joplinSyncSettings.primaryTarget === 's3') {
      updateJoplinSyncSettings({ primaryTarget: 'none' });
    }
    setS3Endpoint('');
    setS3Bucket('');
    setS3Region('');
    setS3AccessKey('');
    setS3SecretKey('');
    setS3Status('idle');
    setS3Error(null);
    setS3FormOpen(false);
    showAndroidToast('Disconnected S3 / MinIO', 2400, 'default');
  };

  // Local Backup & Snapshots handlers
  const handleExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const jsonStr = exportEncryptedJSON();
      const result = await exportLocalBackup(jsonStr);
      if (result.success) {
        showAndroidToast('Backup saved to Downloads', 3000, 'success');
      } else {
        showAndroidToast(result.error || 'Failed to save backup', 3200, 'error');
      }
    } catch {
      showAndroidToast('Failed to save backup', 3200, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.json') && file.type && file.type !== 'application/json') {
      showAndroidToast('Invalid backup file', 3000, 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const validation = validateBackupPayload(text);
      if (!validation.valid) {
        showAndroidToast('Invalid backup file', 3000, 'error');
        return;
      }
      setPendingRestore({
        sourceLabel: file.name,
        rawJson: text,
        summary: validation.summary,
      });
    };
    reader.onerror = () => showAndroidToast('Invalid backup file', 3000, 'error');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectSnapshot = async (snap: LocalSnapshotMeta) => {
    try {
      const content = await readLocalSnapshot(snap.filename);
      if (!content) {
        showAndroidToast('Invalid backup file', 3000, 'error');
        return;
      }
      const validation = validateBackupPayload(content);
      if (!validation.valid) {
        showAndroidToast('Invalid backup file', 3000, 'error');
        return;
      }
      setPendingRestore({
        sourceLabel: `${snap.filename} (${formatSnapshotTimestamp(snap.timestamp)})`,
        rawJson: content,
        summary: validation.summary,
      });
    } catch {
      showAndroidToast('Invalid backup file', 3000, 'error');
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore || isRestoring) return;
    setIsRestoring(true);
    try {
      const ok = replaceAllAppDataFromBackup(pendingRestore.rawJson);
      if (ok) {
        setPendingRestore(null);
        showAndroidToast('Backup restored successfully', 2800, 'success');
      } else {
        setPendingRestore(null);
        showAndroidToast('Invalid backup file', 3000, 'error');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const normalizedInterval: 0 | 15 | 30 | 60 =
    joplinSyncSettings.autoSyncIntervalMinutes === 15 ||
    joplinSyncSettings.autoSyncIntervalMinutes === 30 ||
    joplinSyncSettings.autoSyncIntervalMinutes === 60
      ? joplinSyncSettings.autoSyncIntervalMinutes
      : 0;

  return (
    <div className="px-4 py-2 pb-10 space-y-6 max-w-4xl mx-auto w-full min-w-0 animate-view-enter">
      {/* Shared Material 3 Expressive Stacked Sub-Screen Header */}
      <SettingsSubpageHeader
        title="Backup & Sync"
        subtitle={
          overview.hasAnyConnected
            ? `${overview.connectedCount} provider${overview.connectedCount === 1 ? '' : 's'} connected · ${
                overview.latestSyncedAt
                  ? `Last synced ${formatRelativeSyncTime(overview.latestSyncedAt)}`
                  : 'Never synced'
              }`
            : 'Connect a cloud provider or export a local backup anytime.'
        }
        onBack={onBack}
        actions={
          overview.hasAnyConnected ? (
            <button
              type="button"
              onClick={handleHeaderSyncNow}
              disabled={isHeaderSyncing}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold transition inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isHeaderSyncing ? 'animate-spin' : ''}`} />
              <span>{isHeaderSyncing ? 'Syncing…' : 'Sync Now'}</span>
            </button>
          ) : undefined
        }
      />

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — SYNC PROVIDERS
         ═══════════════════════════════════════════════════════════ */}
      <section aria-labelledby="section-sync-providers-heading" className="space-y-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4F46E5] dark:text-indigo-400">
            Sync Providers
          </div>
          <h2
            id="section-sync-providers-heading"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Cloud &amp; Private Drives
          </h2>
        </div>

        {/* Single column on mobile (<600dp), two-column adaptive grid on tablet/desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {/* 1. JivanOS Cloud (Firebase) — Premium · ₹99/month */}
          <div className="md:col-span-2 w-full min-w-0">
            <JivanOSCloudSection />
          </div>

          {/* 2. Google Drive */}
          <div className="w-full min-w-0">
            <GoogleDriveSyncSection />
          </div>

          {/* 3. Dropbox */}
          <div className="w-full min-w-0">
            <DropboxSyncSection />
          </div>

          {/* 4. Telegram */}
          <div className="w-full min-w-0">
            <TelegramSyncSection />
          </div>

          {/* 5. WebDAV / Nextcloud (ONE merged card, not two) */}
          <div className="w-full min-w-0">
            <SyncProviderCard
              name="WebDAV / Nextcloud"
              description="Sync with Nextcloud, Koofr, Box, Hetzner, or any WebDAV server."
              logo={<Globe className="w-5 h-5 text-[#0082C9]" />}
              brandColor="#0082C9"
              isConnected={isWebDavConnected}
              status={
                davStatus === 'syncing'
                  ? 'syncing'
                  : davStatus === 'error'
                  ? 'error'
                  : isWebDavConnected
                  ? existingDav?.lastSyncedAt
                    ? 'synced'
                    : 'connected'
                  : 'disconnected'
              }
              accountLabel={isWebDavConnected ? existingDav?.username : undefined}
              accountSublabel={isWebDavConnected ? existingDav?.serverUrl : undefined}
              lastSyncedAt={isWebDavConnected ? existingDav?.lastSyncedAt || null : null}
              errorMessage={davError}
              connectLabel={davFormOpen ? 'Hide Setup' : 'Connect'}
              onConnect={isWebDavConnected ? undefined : () => setDavFormOpen((v) => !v)}
              onSyncNow={isWebDavConnected ? handleSyncWebDav : undefined}
              onDisconnect={isWebDavConnected ? handleDisconnectWebDav : undefined}
              onRetry={handleSyncWebDav}
            >
              {!isWebDavConnected && davFormOpen && (
                <form
                  onSubmit={handleConnectWebDav}
                  className="pt-2 border-t border-[#E5E7EB] dark:border-zinc-800 space-y-3"
                >
                  {/* Quick-fill URL template chips */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 block">
                      Quick-fill URL template
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {WEBDAV_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setDavUrl(preset.urlTemplate)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 text-xs font-semibold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Server URL
                    </label>
                    <input
                      type="url"
                      value={davUrl}
                      onChange={(e) => setDavUrl(e.target.value)}
                      placeholder="https://cloud.example.com/remote.php/dav/files/user/"
                      className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Username
                      </label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={davUsername}
                        onChange={(e) => setDavUsername(e.target.value)}
                        placeholder="Username or email"
                        className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Password / App Password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={davPassword}
                        onChange={(e) => setDavPassword(e.target.value)}
                        placeholder="Enter password or app token"
                        className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDavFormOpen(false);
                        setDavError(null);
                      }}
                      className="min-h-[48px] px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={davStatus === 'syncing'}
                      className="min-h-[48px] px-5 py-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      {davStatus === 'syncing' ? 'Connecting…' : 'Save & Connect'}
                    </button>
                  </div>
                </form>
              )}
            </SyncProviderCard>
          </div>

          {/* 6. MEGA (20 GB free · End-to-end encrypted by default) */}
          <div className="w-full min-w-0">
            <MEGASyncSection />
          </div>
        </div>

        {/* Advanced Expandable: S3 / R2 / MinIO */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvancedS3((prev) => !prev)}
            className="min-h-[48px] px-3 py-2 rounded-xl inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition cursor-pointer"
          >
            {showAdvancedS3 ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>Advanced (S3 / R2 / MinIO)</span>
          </button>

          {showAdvancedS3 && (
            <div className="mt-2">
              <SyncProviderCard
                name="S3 / MinIO"
                description="S3-compatible object storage such as AWS S3, Cloudflare R2, or MinIO."
                logo={<Server className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                brandColor="#D97706"
                isConnected={isS3Connected}
                status={
                  s3Status === 'syncing'
                    ? 'syncing'
                    : s3Status === 'error'
                    ? 'error'
                    : isS3Connected
                    ? s3Cfg?.lastSyncedAt
                      ? 'synced'
                      : 'connected'
                    : 'disconnected'
                }
                accountLabel={isS3Connected ? s3Cfg?.s3Bucket : undefined}
                accountSublabel={isS3Connected ? s3Cfg?.s3Endpoint : undefined}
                lastSyncedAt={isS3Connected ? s3Cfg?.lastSyncedAt || null : null}
                errorMessage={s3Error}
                connectLabel={s3FormOpen ? 'Hide Setup' : 'Connect'}
                onConnect={isS3Connected ? undefined : () => setS3FormOpen((v) => !v)}
                onSyncNow={isS3Connected ? handleSyncS3 : undefined}
                onDisconnect={isS3Connected ? handleDisconnectS3 : undefined}
                onRetry={handleSyncS3}
              >
                {!isS3Connected && s3FormOpen && (
                  <form
                    onSubmit={handleConnectS3}
                    className="pt-2 border-t border-[#E5E7EB] dark:border-zinc-800 space-y-3"
                  >
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Endpoint URL
                      </label>
                      <input
                        type="url"
                        value={s3Endpoint}
                        onChange={(e) => setS3Endpoint(e.target.value)}
                        placeholder="https://s3.us-east-1.amazonaws.com"
                        className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Bucket Name
                        </label>
                        <input
                          type="text"
                          value={s3Bucket}
                          onChange={(e) => setS3Bucket(e.target.value)}
                          placeholder="my-jivanos-backups"
                          className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Region
                        </label>
                        <input
                          type="text"
                          value={s3Region}
                          onChange={(e) => setS3Region(e.target.value)}
                          placeholder="us-east-1 or auto"
                          className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Access Key ID
                        </label>
                        <input
                          type="text"
                          autoComplete="off"
                          value={s3AccessKey}
                          onChange={(e) => setS3AccessKey(e.target.value)}
                          placeholder="AKIA..."
                          className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Secret Access Key
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={s3SecretKey}
                          onChange={(e) => setS3SecretKey(e.target.value)}
                          placeholder="Enter secret access key"
                          className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setS3FormOpen(false);
                          setS3Error(null);
                        }}
                        className="min-h-[48px] px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={s3Status === 'syncing'}
                        className="min-h-[48px] px-5 py-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        {s3Status === 'syncing' ? 'Connecting…' : 'Save & Connect'}
                      </button>
                    </div>
                  </form>
                )}
              </SyncProviderCard>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — AUTO-SYNC SETTINGS
          (Only rendered if at least one provider is genuinely connected)
         ═══════════════════════════════════════════════════════════ */}
      {overview.hasAnyConnected && (
        <section
          aria-labelledby="section-autosync-heading"
          className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-5"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4F46E5] dark:text-indigo-400">
              Auto-Sync Settings
            </div>
            <h2
              id="section-autosync-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Schedule, Security &amp; Sync Preferences
            </h2>
          </div>

          {/* Primary Sync Target — ONLY connected providers */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Primary Sync Target
            </div>
            <div className="flex flex-wrap gap-2">
              {overview.connectedProviders.map((provider) => {
                const selected = activePrimaryProviderId === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleSelectPrimaryProvider(provider.id)}
                    className={`min-h-[48px] px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      selected
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                        : 'bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 border-[#E5E7EB] dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {provider.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sync Interval Segmented Button: 15m | 30m | 1h | Manual */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Sync Interval
            </div>
            <div className="grid grid-cols-4 rounded-full border border-[#E5E7EB] dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70 p-1 gap-1">
              {INTERVAL_SEGMENTS.map((seg) => {
                const isSelected = normalizedInterval === seg.value;
                return (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() =>
                      updateJoplinSyncSettings({ autoSyncIntervalMinutes: seg.value })
                    }
                    className={`min-h-[44px] rounded-full text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#4F46E5] text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Auto-sync on edit
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Upload changes automatically after edits
                </p>
              </div>
              <M3Switch
                checked={joplinSyncSettings.syncOnChange}
                onChange={(val) => updateJoplinSyncSettings({ syncOnChange: val })}
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sync on app launch
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Check for newer updates when opening JivanOS
                </p>
              </div>
              <M3Switch
                checked={joplinSyncSettings.syncOnStartup}
                onChange={(val) => updateJoplinSyncSettings({ syncOnStartup: val })}
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  E2E Encryption (AES-256)
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Encrypt backups before uploading
                </p>
              </div>
              <M3Switch
                checked={joplinSyncSettings.e2eeEnabled}
                onChange={(val) => updateJoplinSyncSettings({ e2eeEnabled: val })}
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Include profile in sync
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Sync avatar, profile details &amp; currency
                </p>
              </div>
              <M3Switch
                checked={joplinSyncSettings.syncPersonalDetails}
                onChange={(val) => updateJoplinSyncSettings({ syncPersonalDetails: val })}
              />
            </div>
          </div>

          {joplinSyncSettings.e2eeEnabled && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <Lock className="w-3.5 h-3.5" />
                <span>Encryption Passphrase</span>
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={joplinSyncSettings.e2eePassphrase || ''}
                onChange={(e) => updateJoplinSyncSettings({ e2eePassphrase: e.target.value })}
                placeholder="Enter a passphrase shared across your devices"
                className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
              />
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — LOCAL BACKUP (Always Available)
         ═══════════════════════════════════════════════════════════ */}
      <section
        aria-labelledby="section-local-backup-heading"
        className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-400 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4F46E5] dark:text-indigo-400">
              Local Backup
            </div>
            <h2
              id="section-local-backup-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Offline Backup &amp; Recent Snapshots
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {isNativeAndroid
                ? 'Save a JSON backup to Downloads with Share Sheet, or restore any snapshot.'
                : 'Save a JSON backup to your device or restore from a saved file.'}
            </p>
          </div>
        </div>

        {/* One FilledButton + One OutlinedButton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            id="btn-m3-export-backup"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="min-h-[48px] px-5 py-3 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isExporting ? 'Saving Backup…' : 'Export Backup'}</span>
            {isNativeAndroid && <Share2 className="w-3.5 h-3.5 opacity-85 shrink-0" />}
          </button>

          <button
            type="button"
            id="btn-m3-restore-from-file"
            onClick={handleOpenFilePicker}
            className="min-h-[48px] px-5 py-3 rounded-full bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.99] text-[#4F46E5] dark:text-indigo-300 border border-slate-300 dark:border-zinc-700 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Restore from File</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Select JivanOS JSON backup file"
          />
        </div>

        <div className="h-px bg-[#E5E7EB] dark:bg-zinc-800" />

        {/* Recent Snapshots (last 3 rotating) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Recent Snapshots
            </h3>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Last 3 auto-saved snapshots
            </span>
          </div>

          {isLoadingSnapshots ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
              Loading recent snapshots…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] dark:border-zinc-800 p-5 text-center text-xs text-slate-500 dark:text-zinc-400">
              No automatic snapshots recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB] dark:divide-zinc-800 rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 overflow-hidden">
              {snapshots.slice(0, 3).map((snap) => (
                <button
                  key={snap.filename}
                  type="button"
                  onClick={() => handleSelectSnapshot(snap)}
                  className="w-full min-h-[60px] px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-indigo-50/60 dark:hover:bg-zinc-800/70 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        snap.slot === 1
                          ? 'bg-indigo-100 dark:bg-indigo-950/75 text-[#4F46E5] dark:text-indigo-300'
                          : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      <History className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {formatSnapshotTimestamp(snap.timestamp)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        {formatSnapshotSize(snap.sizeBytes)}
                        {snap.slot === 1 ? ' · Latest' : ''}
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] dark:text-indigo-300 shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Restore Confirmation Dialog */}
      {pendingRestore && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="m3-restore-dialog-title"
          aria-describedby="m3-restore-dialog-desc"
          className="fixed inset-0 z-[100001] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isRestoring && setPendingRestore(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-3xl bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-6 shadow-2xl space-y-4"
          >
            <div className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-2">
              <h3
                id="m3-restore-dialog-title"
                className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
              >
                Restore Backup?
              </h3>
              <p
                id="m3-restore-dialog-desc"
                className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed"
              >
                This will replace all current data on this device. Are you sure?
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-[#E5E7EB] dark:border-zinc-800 px-3.5 py-2.5 text-xs text-slate-600 dark:text-zinc-400 space-y-1 tabular-nums">
              <div className="font-semibold text-slate-800 dark:text-zinc-200 break-words">
                {pendingRestore.sourceLabel}
              </div>
              <div>
                {pendingRestore.summary.tasksCount} tasks · {pendingRestore.summary.habitsCount} habits ·{' '}
                {pendingRestore.summary.billsCount} bills · {pendingRestore.summary.medicationsCount} meds ·{' '}
                {formatSnapshotSize(pendingRestore.summary.sizeBytes)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingRestore(null)}
                className="min-h-[48px] px-5 py-2.5 rounded-full text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="min-h-[48px] px-5 py-2.5 rounded-full text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer disabled:opacity-60"
              >
                {isRestoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
