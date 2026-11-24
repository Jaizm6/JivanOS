import React from 'react';
import { Download, FileJson, RotateCcw, Share2, Upload } from 'lucide-react';
import {
  LocalSnapshotMeta,
  formatSnapshotSize,
  formatSnapshotTimestamp,
} from '../../utils/localBackupEngine';

export interface LocalBackupCardProps {
  snapshots: LocalSnapshotMeta[];
  isLoadingSnapshots: boolean;
  isExporting: boolean;
  isNativeAndroid: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onExportBackup: () => void;
  onOpenFilePicker: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSnapshot: (snap: LocalSnapshotMeta) => void;
}

export const LocalBackupCard: React.FC<LocalBackupCardProps> = ({
  snapshots,
  isLoadingSnapshots,
  isExporting,
  isNativeAndroid,
  fileInputRef,
  onExportBackup,
  onOpenFilePicker,
  onFileChange,
  onSelectSnapshot,
}) => {
  return (
    <section aria-labelledby="section-local-backup-label" className="min-w-0">
      <h2
        id="section-local-backup-label"
        className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-zinc-400 mt-5 mb-1 px-1"
      >
        Local Backup
      </h2>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#E5E7EB]/80 dark:divide-zinc-800/80 overflow-hidden">
        {/* Top Row: Two side-by-side 50% width action buttons */}
        <div className="p-3.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            id="btn-m3-export-backup"
            onClick={onExportBackup}
            disabled={isExporting}
            className="h-10 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isExporting ? 'Saving…' : 'Export Backup'}</span>
            {isNativeAndroid && <Share2 className="w-3 h-3 opacity-85 shrink-0" />}
          </button>

          <button
            type="button"
            id="btn-m3-restore-from-file"
            onClick={onOpenFilePicker}
            className="h-10 px-3 rounded-lg bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-[0.99] text-[#4F46E5] dark:text-indigo-300 border border-slate-300 dark:border-zinc-700 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-0"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Restore from File</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
            className="hidden"
            aria-label="Select JivanOS JSON backup file"
          />
        </div>

        {/* Sub-label strip: RECENT SNAPSHOTS */}
        <div>
          <div className="px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400 dark:text-zinc-500 bg-slate-50/70 dark:bg-zinc-950/50 border-b border-[#E5E7EB]/70 dark:border-zinc-800/70">
            Recent Snapshots
          </div>

          {isLoadingSnapshots ? (
            <div className="min-h-[48px] px-4 py-3 text-center text-xs text-slate-500 dark:text-zinc-400">
              Loading snapshots…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="min-h-[48px] px-4 py-3 text-center text-xs text-slate-500 dark:text-zinc-400">
              No auto-saved snapshots yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]/70 dark:divide-zinc-800/70">
              {snapshots.slice(0, 3).map((snap) => (
                <div
                  key={snap.filename}
                  className="min-h-[48px] px-4 py-2 flex items-center justify-between gap-2 hover:bg-slate-50/75 dark:hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <FileJson
                      className={`w-4 h-4 shrink-0 ${
                        snap.slot === 1
                          ? 'text-[#4F46E5] dark:text-indigo-400'
                          : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-slate-800 dark:text-zinc-100 truncate">
                        {snap.filename}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                        {formatSnapshotTimestamp(snap.timestamp)} · {formatSnapshotSize(snap.sizeBytes)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectSnapshot(snap)}
                    className="h-8 px-2.5 rounded-lg text-[12px] font-semibold text-[#4F46E5] dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition inline-flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
