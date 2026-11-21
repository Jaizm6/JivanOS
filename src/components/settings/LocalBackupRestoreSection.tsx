import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Upload,
  History,
  RotateCcw,
  AlertTriangle,
  HardDrive,
  Share2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../common/AndroidToast';
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
import { JivanOSCloudSection } from '../../sync/ui/JivanOSCloudSection';
import { GoogleDriveSyncSection } from './GoogleDriveSyncSection';
import { DropboxSyncSection } from './DropboxSyncSection';
import { TelegramSyncSection } from '../../sync/ui/TelegramSyncSection';

interface PendingRestorePayload {
  sourceLabel: string;
  rawJson: string;
  summary: BackupValidationSummary;
}

export const LocalBackupRestoreSection: React.FC = () => {
  const { exportEncryptedJSON, replaceAllAppDataFromBackup } = useApp();

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
        // Ensure an initial silent baseline snapshot exists on first visit
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
    return () => {
      window.removeEventListener(LOCAL_SNAPSHOTS_UPDATED_EVENT, handleUpdated);
    };
  }, [refreshSnapshots]);

  // 1. EXPORT BACKUP
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

  // 2. RESTORE FROM FILE (JSON ONLY)
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
    reader.onerror = () => {
      showAndroidToast('Invalid backup file', 3000, 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. RESTORE FROM SNAPSHOT TILE
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

  // CONFIRM FULL REPLACE RESTORE
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

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 1. JivanOS Cloud — premium, top position */}
      <JivanOSCloudSection />

      {/* 2. Google Drive — free */}
      <GoogleDriveSyncSection />

      {/* 3. Dropbox — free */}
      <DropboxSyncSection />

      {/* 4. Telegram — free, power users */}
      <TelegramSyncSection />

      <div className="py-1">
        <div className="h-px bg-slate-200/90 dark:bg-zinc-800" />
      </div>

      {/* 5. Local Backup — always available, bottom */}
      <section
        aria-label="Backup and Restore"
        className="rounded-2xl sm:rounded-[28px] border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6 w-full min-w-0"
      >
        {/* Material Design 3 Section Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100 leading-snug">
                Backup &amp; Restore
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                100% offline local JSON backups to Downloads and automatic private snapshots.
              </p>
            </div>
          </div>
        </div>

        {/* Two Primary Material 3 Actions: Filled + Outlined */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            id="btn-m3-export-backup"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="min-h-[48px] px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isExporting ? 'Saving Backup...' : 'Export Backup'}</span>
            {isNativeAndroid && <Share2 className="w-3.5 h-3.5 opacity-85 shrink-0" />}
          </button>

          <button
            type="button"
            id="btn-m3-restore-from-file"
            onClick={handleOpenFilePicker}
            className="min-h-[48px] px-5 py-3 rounded-full bg-transparent hover:bg-slate-100/90 dark:hover:bg-zinc-800/80 active:scale-[0.99] text-indigo-700 dark:text-indigo-300 border border-slate-300 dark:border-zinc-700 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
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

        <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          {isNativeAndroid
            ? 'Exports JivanOS-backup-YYYY-MM-DD-HHmm.json directly to your Downloads folder and opens Android Share Sheet for WhatsApp, email, or local transfer.'
            : 'Exports JivanOS-backup-YYYY-MM-DD-HHmm.json directly to your Downloads folder. Works fully offline with zero cloud dependencies.'}
        </p>

        {/* Hairline Section Divider */}
        <div className="h-px bg-slate-200/80 dark:bg-zinc-800" />

        {/* Recent Snapshots (3 rotating private slots) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Recent Snapshots
            </h4>
            <span className="text-[11.5px] text-slate-500 dark:text-zinc-400 tabular-nums">
              Auto-saved on change · Last 3 kept
            </span>
          </div>

          {isLoadingSnapshots ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
              Loading recent snapshots...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 p-5 text-center text-xs text-slate-500 dark:text-zinc-400">
              No automatic snapshots recorded yet. Any change you make will create snapshot-1.json automatically.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/90 rounded-2xl border border-slate-200/85 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 overflow-hidden">
              {snapshots.slice(0, 3).map(snap => (
                <button
                  key={snap.filename}
                  type="button"
                  onClick={() => handleSelectSnapshot(snap)}
                  className="w-full min-h-[60px] px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-indigo-50/60 dark:hover:bg-zinc-800/70 active:bg-indigo-100/60 dark:active:bg-zinc-800 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        snap.slot === 1
                          ? 'bg-indigo-100 dark:bg-indigo-950/75 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      <History className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                        {formatSnapshotTimestamp(snap.timestamp)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 tabular-nums truncate">
                        <span>{snap.filename}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatSnapshotSize(snap.sizeBytes)}</span>
                        {snap.slot === 1 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                              Latest
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shrink-0 whitespace-nowrap">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Material Design 3 Confirmation Dialog (shared by Restore from File & Snapshots) */}
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
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[28px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-6 shadow-2xl space-y-4"
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
                This will replace all current data. Are you sure?
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 px-3.5 py-2.5 text-xs text-slate-600 dark:text-zinc-400 space-y-1 tabular-nums">
              <div className="font-medium text-slate-800 dark:text-zinc-200 truncate">
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
                className="min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
