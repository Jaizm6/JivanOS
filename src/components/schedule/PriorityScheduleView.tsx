import React from 'react';
import { Check, Clock, Plus, Trash2, Edit2, Play, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Priority, ScheduleItem } from '../../types';

interface PriorityScheduleViewProps {
  items: ScheduleItem[];
  onAddNew: () => void;
  onEditItem: (item: ScheduleItem) => void;
}

interface PriorityGroupConfig {
  key: Priority;
  title: string;
  dotColor: string;
  ringColor: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  desc: string;
}

const PRIORITY_GROUPS: PriorityGroupConfig[] = [
  {
    key: 'high',
    title: 'Urgent & Critical (High)',
    dotColor: 'bg-rose-500',
    ringColor: 'ring-rose-300 dark:ring-rose-900',
    headerBg: 'bg-rose-500 text-white',
    headerText: 'text-rose-900 dark:text-rose-200',
    badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 font-bold border border-rose-300 dark:border-rose-800',
    badgeText: 'High',
    desc: 'High-impact deadlines & critical obligations',
  },
  {
    key: 'medium',
    title: 'Medium Priority',
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-300 dark:ring-amber-900',
    headerBg: 'bg-amber-500 text-white',
    headerText: 'text-amber-900 dark:text-amber-200',
    badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800',
    badgeText: 'Medium',
    desc: 'Key operations, scheduled calls & errands',
  },
  {
    key: 'low',
    title: 'Low Priority (Routine & Flexible)',
    dotColor: 'bg-blue-500',
    ringColor: 'ring-blue-300 dark:ring-blue-900',
    headerBg: 'bg-blue-600 text-white',
    headerText: 'text-blue-900 dark:text-blue-200',
    badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 font-bold border border-blue-300 dark:border-blue-800',
    badgeText: 'Low',
    desc: 'Routine items, low pressure tasks & flexible activities',
  },
];

export const PriorityScheduleView: React.FC<PriorityScheduleViewProps> = ({
  items,
  onAddNew,
  onEditItem,
}) => {
  const { toggleScheduleItem, deleteScheduleItem, startPomodoro, setPomodoroTask } = useApp();

  const handleStartFocus = (item: ScheduleItem) => {
    if (item.taskId) {
      setPomodoroTask(item.taskId);
    }
    startPomodoro();
  };

  return (
    <div className="space-y-6">
      {/* Template Explanation Banner (Matches Reference 2 "By priority" column) */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            <div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            <div className="w-3 h-3 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              By Priority Schedule Template
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Orders your daily plan by importance so you tackle high-impact items first before low-priority tasks.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Priority Item</span>
        </button>
      </div>

      {/* 3 Priority Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRIORITY_GROUPS.map(group => {
          const groupItems = items.filter(i => {
            const p = (i.priority || '').toLowerCase();
            return p === group.key || (group.key === 'high' && p === 'p1') || (group.key === 'medium' && p === 'p2') || (group.key === 'low' && (p === 'p3' || p === 'p4'));
          });
          const completedCount = groupItems.filter(i => i.completed).length;

          return (
            <div
              key={group.key}
              className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden"
            >
              {/* Card Header (Matches Asana/Reference 2 column header style) */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${group.dotColor} ${group.ringColor} ring-2 shrink-0`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    {group.badgeText}
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${group.badgeBg}`}>
                  {completedCount}/{groupItems.length}
                </span>
              </div>

              {/* Items List */}
              <div className="p-3 flex-1 space-y-2 min-h-[160px]">
                {groupItems.length > 0 ? (
                  groupItems.map(item => (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all ${
                        item.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleScheduleItem(item.id)}
                          className={`w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center transition shrink-0 ${
                            item.completed
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500'
                          }`}
                          title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {/* Signature reference colored dot */}
                            <span
                              className={`w-2 h-2 rounded-full ${group.dotColor} shrink-0`}
                            />
                            <h4
                              className={`text-xs font-semibold truncate ${
                                item.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {item.title}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {item.startTime}
                            </span>
                            <span className="capitalize text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Micro Action Buttons */}
                      <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => handleStartFocus(item)}
                          className="p-1.5 rounded text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition mr-auto"
                          title="Focus"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteScheduleItem(item.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-6 text-center text-slate-400">
                    <p className="text-xs">No {group.badgeText} items</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
