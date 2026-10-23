import React from 'react';
import {
  Calendar,
  Check,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScheduleItem } from '../../types';
import { OverdueIcon } from '../common/OverdueIcon';

interface DeadlineScheduleViewProps {
  selectedDate: string;
  items: ScheduleItem[];
  onAddNew: () => void;
  onEditItem: (item: ScheduleItem) => void;
}

export const DeadlineScheduleView: React.FC<DeadlineScheduleViewProps> = ({
  selectedDate,
  items,
  onAddNew,
  onEditItem,
}) => {
  const { scheduleItems, toggleScheduleItem, deleteScheduleItem, tasks } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Group all schedule items by date bucket: Overdue, Today, Tomorrow, Upcoming, Flexible/N/A
  const todayItems = scheduleItems.filter(i => i.date === todayStr);
  const tomorrowItems = scheduleItems.filter(i => i.date === tomorrow);
  const upcomingItems = scheduleItems.filter(i => i.date > tomorrow);
  const overdueItems = scheduleItems.filter(i => !i.completed && i.date < todayStr);

  const formatShortDate = (dateStr: string) => {
    try {
      const [, m, d] = dateStr.split('-');
      return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
    } catch {
      return dateStr;
    }
  };

  const renderSection = (
    title: React.ReactNode,
    badgeText: string,
    sectionItems: ScheduleItem[],
    themeColor: 'rose' | 'indigo' | 'amber' | 'emerald' | 'slate'
  ) => {
    const badgeColors = {
      rose: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400',
      indigo: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400',
      amber: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
      emerald: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',
      slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    };

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {title}
            </span>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeColors[themeColor]}`}>
            {badgeText} ({sectionItems.length})
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {sectionItems.length > 0 ? (
            sectionItems.map(item => (
              <div
                key={item.id}
                className={`p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition ${
                  item.completed ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleScheduleItem(item.id)}
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                      item.completed
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500'
                    }`}
                    title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Date/Deadline tag matching Reference 2 (e.g. 1/21, 1/22, N/A) */}
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1">
                    <span>{formatShortDate(item.date)}</span>
                    {!item.completed && item.date < todayStr && (
                      <OverdueIcon className="w-3.5 h-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs sm:text-sm font-medium truncate ${
                          item.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.startTime}
                    </span>
                    <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditItem(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteScheduleItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
              No items in this deadline period
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Reference 2 "By deadline" explanation banner */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              By Deadline Schedule Template
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Organizes events, deadlines, and milestones sequentially by due date so you never miss an upcoming deliverable.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Scheduled Action</span>
        </button>
      </div>

      {/* Overdue Section (if any) */}
      {overdueItems.length > 0 && renderSection(
        <div className="flex items-center gap-1.5">
          <OverdueIcon className="w-5 h-5" />
        </div>,
        'Needs Immediate Attention',
        overdueItems,
        'rose'
      )}

      {/* Today Section */}
      {renderSection("Today's Deadlines & Events", 'Due Today', todayItems, 'indigo')}

      {/* Tomorrow Section */}
      {renderSection("Tomorrow's Scheduled Deliverables", 'Due Tomorrow', tomorrowItems, 'amber')}

      {/* Later This Week & Upcoming */}
      {renderSection('Upcoming Deadlines', 'Later This Week', upcomingItems, 'emerald')}
    </div>
  );
};
