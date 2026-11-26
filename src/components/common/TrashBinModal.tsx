import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  Flame,
  Folder,
  Hash,
  Inbox,
  List,
  Pill,
  Quote,
  Receipt,
  RotateCcw,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TrashBinItem, TrashItemType } from '../../types';
import { showAndroidToast } from './AndroidToast';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_META: Record<
  TrashItemType,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  task: { label: 'Task', icon: CheckSquare, colorClass: 'text-indigo-600 dark:text-indigo-400' },
  habit: { label: 'Habit', icon: Flame, colorClass: 'text-orange-600 dark:text-orange-400' },
  medication: { label: 'Med', icon: Pill, colorClass: 'text-rose-600 dark:text-rose-400' },
  goal: { label: 'Goal', icon: Target, colorClass: 'text-emerald-600 dark:text-emerald-400' },
  bill: { label: 'Bill', icon: Receipt, colorClass: 'text-amber-600 dark:text-amber-400' },
  schedule: { label: 'Schedule', icon: Calendar, colorClass: 'text-sky-600 dark:text-sky-400' },
  quote: { label: 'Quote', icon: Quote, colorClass: 'text-violet-600 dark:text-violet-400' },
  tag: { label: 'Tag', icon: Hash, colorClass: 'text-cyan-600 dark:text-cyan-400' },
  list: { label: 'List', icon: List, colorClass: 'text-blue-600 dark:text-blue-400' },
  list_group: { label: 'Folder', icon: Folder, colorClass: 'text-slate-600 dark:text-zinc-400' },
  inbox: { label: 'Inbox', icon: Inbox, colorClass: 'text-teal-600 dark:text-teal-400' },
};

function getDaysRemaining(expiresAt: string): number {
  const diffMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function formatDeletedWhen(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({ isOpen, onClose }) => {
  const { trashBin, restoreFromTrash, permanentlyDeleteFromTrash, emptyTrashBin } = useApp();
  const [filterType, setFilterType] = useState<'all' | TrashItemType>('all');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const presentTypes = useMemo(() => {
    const set = new Set<TrashItemType>();
    trashBin.forEach((item) => set.add(item.type));
    return Array.from(set);
  }, [trashBin]);

  const filteredItems = useMemo(() => {
    const list =
      filterType === 'all' ? trashBin : trashBin.filter((item) => item.type === filterType);
    return [...list].sort(
      (a, b) => (Date.parse(b.deletedAt) || 0) - (Date.parse(a.deletedAt) || 0)
    );
  }, [trashBin, filterType]);

  if (!isOpen) return null;

  const handleRestore = (item: TrashBinItem) => {
    const ok = restoreFromTrash(item.id);
    if (ok) {
      showAndroidToast(`Restored "${item.title}"`, 2400, 'success');
    }
  };

  const handleDeleteForever = (item: TrashBinItem) => {
    permanentlyDeleteFromTrash(item.id);
    showAndroidToast(`Deleted "${item.title}" permanently`, 2200, 'default');
  };

  const handleConfirmEmpty = () => {
    emptyTrashBin();
    setConfirmEmpty(false);
    showAndroidToast('Bin emptied', 2200, 'default');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trash-bin-modal-title"
      className="fixed inset-0 z-[100005] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[500px] max-h-[88dvh] flex flex-col rounded-t-[24px] sm:rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="trash-bin-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-zinc-100 leading-tight"
              >
                Bin {trashBin.length > 0 ? `(${trashBin.length})` : ''}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Deleted items stay here for 30 days before vanishing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bin"
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Tabs (only when >1 type exists) */}
        {presentTypes.length > 1 && (
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              All ({trashBin.length})
            </button>
            {presentTypes.map((t) => {
              const count = trashBin.filter((i) => i.type === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                    filterType === t
                      ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {TYPE_META[t]?.label || t} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Item List */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-zinc-800/80">
          {filteredItems.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Bin is empty
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-[260px] mx-auto leading-relaxed">
                Any tasks, habits, medications, goals, bills, or quotes you delete will be kept here
                for 30 days.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.task;
              const Icon = meta.icon;
              const daysLeft = getDaysRemaining(item.expiresAt);
              const deletedWhen = formatDeletedWhen(item.deletedAt);

              return (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-zinc-800/35 transition"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${meta.colorClass}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-slate-900 dark:text-zinc-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 truncate mt-0.5 tabular-nums">
                        {meta.label}
                        {item.subtitle ? ` · ${item.subtitle}` : ''}
                        {deletedWhen ? ` · ${deletedWhen}` : ''} · {daysLeft}d left
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className="min-h-[36px] px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteForever(item)}
                      aria-label={`Delete ${item.title} permanently`}
                      title="Delete permanently"
                      className="w-9 h-9 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {trashBin.length > 0 && (
          <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between gap-2 shrink-0">
            {confirmEmpty ? (
              <>
                <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  Permanently delete all {trashBin.length} items?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmEmpty(false)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmEmpty}
                    className="min-h-[36px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Empty Bin
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Auto-clears items older than 30 days
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(true)}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer whitespace-nowrap"
                >
                  Empty Bin
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
