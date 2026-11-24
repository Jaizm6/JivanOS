import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  Globe,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyncDriveId } from '../../types';
import { showAndroidToast } from '../common/AndroidToast';
import { JivanOSCloudSection } from '../../sync/ui/JivanOSCloudSection';
import { GoogleDriveSyncSection } from './GoogleDriveSyncSection';
import { DropboxSyncSection } from './DropboxSyncSection';
import { TelegramSyncSection } from '../../sync/ui/TelegramSyncSection';
import { MEGASyncSection } from '../../sync/ui/MEGASyncSection';
import { SyncProviderRow } from './SyncProviderRow';
import { SyncSettingsCard } from './SyncSettingsCard';
import { LocalBackupCard } from './LocalBackupCard';
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

  // ── WebDAV / Nextcloud (merged single row) local form state ──
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

  // ── Advanced S3 / R2 / MinIO (collapsed by default, zero pre-filled defaults) ──
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

  // ── Local Backup & Recent Snapshots (last 3 rotating) ──
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
    <div className="px-4 py-2 pb-10 max-w-4xl mx-auto w-full min-w-0 animate-view-enter">
      {/* Compact Material 3 Expressive Sub-Screen Header */}
      <SettingsSubpageHeader
        title="Backup & Sync"
        subtitle={
          overview.hasAnyConnected
            ? `${overview.connectedCount} connected · ${
                overview.latestSyncedAt
                  ? `Last synced ${formatRelativeSyncTime(overview.latestSyncedAt)}`
                  : 'Ready to sync'
              }`
            : 'Choose a sync provider or save a local backup.'
        }
        onBack={onBack}
        actions={
          overview.hasAnyConnected ? (
            <button
              type="button"
              onClick={handleHeaderSyncNow}
              disabled={isHeaderSyncing}
              className="h-9 px-4 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.98] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHeaderSyncing ? 'animate-spin' : ''}`} />
              <span>{isHeaderSyncing ? 'Syncing…' : 'Sync Now'}</span>
            </button>
          ) : undefined
        }
      />

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — SYNC PROVIDERS (Single Compact ColorOS Card, Always Full Width)
         ═══════════════════════════════════════════════════════════ */}
      <section aria-labelledby="section-sync-providers-label" className="min-w-0">
        <h2
          id="section-sync-providers-label"
          className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-zinc-400 mt-5 mb-1 px-1"
        >
          Sync Providers
        </h2>

        <LayoutGroup id="backup-sync-providers">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#E5E7EB]/80 dark:divide-zinc-800/80">
            {/* 1. JivanOS Cloud */}
            <JivanOSCloudSection isFirst />

            {/* 2. Google Drive */}
            <GoogleDriveSyncSection />

            {/* 3. Dropbox */}
            <DropboxSyncSection />

            {/* 4. Telegram */}
            <TelegramSyncSection />

            {/* 5. WebDAV / Nextcloud */}
            <SyncProviderRow
              name="WebDAV / Nextcloud"
              description="Self-hosted server sync"
              logo={<Globe className="w-4.5 h-4.5 text-[#0082C9]" />}
              logoBgClass="bg-sky-50 dark:bg-sky-950/60"
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
              metaLine={
                isWebDavConnected
                  ? existingDav?.lastSyncedAt
                    ? `Last synced ${formatRelativeSyncTime(existingDav.lastSyncedAt)} · ${existingDav.serverUrl}`
                    : existingDav?.serverUrl || 'Connected'
                  : undefined
              }
              connectLabel={davFormOpen ? 'Hide' : 'Connect →'}
              onConnect={isWebDavConnected ? undefined : () => setDavFormOpen((v) => !v)}
              onSyncNow={isWebDavConnected ? handleSyncWebDav : undefined}
              isSyncing={davStatus === 'syncing'}
              onRetry={handleSyncWebDav}
              onDisconnect={isWebDavConnected ? handleDisconnectWebDav : undefined}
              errorMessage={davError}
              isExpanded={!isWebDavConnected && davFormOpen}
              expandedContent={
                <form
                  onSubmit={handleConnectWebDav}
                  className="pt-2.5 border-t border-[#E5E7EB]/80 dark:border-zinc-800 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mr-0.5">
                      Presets:
                    </span>
                    {WEBDAV_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setDavUrl(preset.urlTemplate)}
                        className="h-7 px-2.5 rounded-md border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 text-[11px] font-semibold text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="url"
                    value={davUrl}
                    onChange={(e) => setDavUrl(e.target.value)}
                    placeholder="https://cloud.example.com/remote.php/dav/files/user/"
                    aria-label="WebDAV Server URL"
                    className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-[#0082C9]"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      autoComplete="off"
                      value={davUsername}
                      onChange={(e) => setDavUsername(e.target.value)}
                      placeholder="Username or email"
                      aria-label="WebDAV Username"
                      className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0082C9]"
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={davPassword}
                      onChange={(e) => setDavPassword(e.target.value)}
                      placeholder="Password or app token"
                      aria-label="WebDAV Password"
                      className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#0082C9]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDavFormOpen(false);
                        setDavError(null);
                      }}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={davStatus === 'syncing'}
                      className="h-8 px-3.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      {davStatus === 'syncing' ? 'Connecting…' : 'Save & Connect'}
                    </button>
                  </div>
                </form>
              }
            />

            {/* 6. MEGA */}
            <MEGASyncSection isLast />
          </div>
        </LayoutGroup>

        {/* Advanced Expandable Accordion (Collapsed by default): S3 / R2 / MinIO */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowAdvancedS3((prev) => !prev)}
            aria-expanded={showAdvancedS3}
            className="h-9 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60 transition cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showAdvancedS3 ? 'rotate-180' : ''
              }`}
            />
            <span>Advanced (S3 / R2 / MinIO)</span>
          </button>

          <AnimatePresence initial={false}>
            {showAdvancedS3 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-1.5 rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <SyncProviderRow
                    name="S3 / MinIO"
                    description="AWS S3, Cloudflare R2, or MinIO"
                    logo={<Server className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />}
                    logoBgClass="bg-amber-50 dark:bg-amber-950/60"
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
                    metaLine={
                      isS3Connected
                        ? s3Cfg?.lastSyncedAt
                          ? `Last synced ${formatRelativeSyncTime(s3Cfg.lastSyncedAt)} · ${s3Cfg.s3Endpoint}`
                          : s3Cfg?.s3Endpoint || 'Connected'
                        : undefined
                    }
                    connectLabel={s3FormOpen ? 'Hide' : 'Connect →'}
                    onConnect={isS3Connected ? undefined : () => setS3FormOpen((v) => !v)}
                    onSyncNow={isS3Connected ? handleSyncS3 : undefined}
                    isSyncing={s3Status === 'syncing'}
                    onRetry={handleSyncS3}
                    onDisconnect={isS3Connected ? handleDisconnectS3 : undefined}
                    errorMessage={s3Error}
                    isExpanded={!isS3Connected && s3FormOpen}
                    isFirst
                    isLast
                    expandedContent={
                      <form
                        onSubmit={handleConnectS3}
                        className="pt-2.5 border-t border-[#E5E7EB]/80 dark:border-zinc-800 space-y-2.5"
                      >
                        <input
                          type="url"
                          value={s3Endpoint}
                          onChange={(e) => setS3Endpoint(e.target.value)}
                          placeholder="Endpoint URL (e.g. https://s3.us-east-1.amazonaws.com)"
                          aria-label="S3 Endpoint URL"
                          className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-600"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={s3Bucket}
                            onChange={(e) => setS3Bucket(e.target.value)}
                            placeholder="Bucket name"
                            aria-label="S3 Bucket Name"
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-600"
                          />
                          <input
                            type="text"
                            value={s3Region}
                            onChange={(e) => setS3Region(e.target.value)}
                            placeholder="Region (e.g. us-east-1 or auto)"
                            aria-label="S3 Region"
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-600"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            autoComplete="off"
                            value={s3AccessKey}
                            onChange={(e) => setS3AccessKey(e.target.value)}
                            placeholder="Access Key ID"
                            aria-label="S3 Access Key ID"
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-600"
                          />
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={s3SecretKey}
                            onChange={(e) => setS3SecretKey(e.target.value)}
                            placeholder="Secret Access Key"
                            aria-label="S3 Secret Access Key"
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-600"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setS3FormOpen(false);
                              setS3Error(null);
                            }}
                            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={s3Status === 'syncing'}
                            className="h-8 px-3.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            {s3Status === 'syncing' ? 'Connecting…' : 'Save & Connect'}
                          </button>
                        </div>
                      </form>
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTIONS 2 & 3 — SYNC SETTINGS + LOCAL BACKUP
          Phone (<600px): Single column stacked
          Tablet / Desktop (>=600px): 2-column 50/50 side-by-side grid
         ═══════════════════════════════════════════════════════════ */}
      <div
        className={
          overview.hasAnyConnected
            ? 'grid grid-cols-1 min-[600px]:grid-cols-2 gap-4 items-start'
            : ''
        }
      >
        {overview.hasAnyConnected && (
          <SyncSettingsCard
            connectedProviders={overview.connectedProviders}
            primaryProviderId={activePrimaryProviderId}
            onSelectPrimaryProvider={handleSelectPrimaryProvider}
            intervalMinutes={normalizedInterval}
            onChangeInterval={(interval) =>
              updateJoplinSyncSettings({ autoSyncIntervalMinutes: interval })
            }
            syncOnChange={joplinSyncSettings.syncOnChange}
            onToggleSyncOnChange={(val) => updateJoplinSyncSettings({ syncOnChange: val })}
            syncOnStartup={joplinSyncSettings.syncOnStartup}
            onToggleSyncOnStartup={(val) => updateJoplinSyncSettings({ syncOnStartup: val })}
            e2eeEnabled={joplinSyncSettings.e2eeEnabled}
            onToggleE2ee={(val) => updateJoplinSyncSettings({ e2eeEnabled: val })}
            e2eePassphrase={joplinSyncSettings.e2eePassphrase || ''}
            onChangeE2eePassphrase={(val) => updateJoplinSyncSettings({ e2eePassphrase: val })}
          />
        )}

        <LocalBackupCard
          snapshots={snapshots}
          isLoadingSnapshots={isLoadingSnapshots}
          isExporting={isExporting}
          isNativeAndroid={isNativeAndroid}
          fileInputRef={fileInputRef}
          onExportBackup={handleExportBackup}
          onOpenFilePicker={handleOpenFilePicker}
          onFileChange={handleFileChange}
          onSelectSnapshot={handleSelectSnapshot}
        />
      </div>

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
