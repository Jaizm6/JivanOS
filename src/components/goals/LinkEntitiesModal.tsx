import React, { useState, useMemo } from 'react';
import {
  Search,
  Check,
  Link2,
  Unlink,
  X,
  Target,
  CheckSquare,
  Calendar,
  Flame,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskItem, ScheduleItem, Habit, Goal } from '../../types';

interface LinkEntitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  initialTab?: 'tasks' | 'events' | 'habits';
  onOpenCreateTask?: () => void;
  onOpenCreateEvent?: () => void;
  onOpenCreateHabit?: () => void;
}

export const LinkEntitiesModal: React.FC<LinkEntitiesModalProps> = ({
  isOpen,
  onClose,
  goal,
  initialTab = 'tasks',
  onOpenCreateTask,
  onOpenCreateEvent,
  onOpenCreateHabit,
}) => {
  const {
    tasks = [],
    scheduleItems = [],
    habits = [],
    updateTask,
    updateScheduleItem,
    updateHabit,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'tasks' | 'events' | 'habits'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'unlinked'>('all');

  if (!isOpen || !goal) return null;

  const targetId = goal.id;
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper link checkers
  const isTaskLinked = (t: TaskItem) => t.goalId === targetId;
  const isEventLinked = (e: ScheduleItem) => e.goalId === targetId;
  const isHabitLinked = (h: Habit) => h.goalId === targetId;

  // Toggle handlers
  const handleToggleTaskLink = (t: TaskItem) => {
    updateTask({
      ...t,
      goalId: isTaskLinked(t) ? undefined : targetId,
    });
  };

  const handleToggleEventLink = (e: ScheduleItem) => {
    updateScheduleItem({
      ...e,
      goalId: isEventLinked(e) ? undefined : targetId,
    });
  };

  const handleToggleHabitLink = (h: Habit) => {
    updateHabit({
      ...h,
      goalId: isHabitLinked(h) ? undefined : targetId,
    });
  };

  // Counts
  const linkedTasksCount = tasks.filter(isTaskLinked).length;
  const linkedEventsCount = scheduleItems.filter(isEventLinked).length;
  const linkedHabitsCount = habits.filter(isHabitLinked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-2xs font-bold"
              style={{ backgroundColor: goal.color || '#6366f1' }}
            >
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  Link Items to Goal
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                Goal: <span className="font-semibold text-slate-700 dark:text-slate-300">{goal.title}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation: Tasks, Events, Habits */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tasks</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {linkedTasksCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'events'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Events</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {linkedEventsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('habits')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'habits'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-emerald-500" />
              <span>Habits</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {linkedHabitsCount}
              </span>
            </button>
          </div>

          {/* Quick Create Action */}
          {activeTab === 'tasks' && onOpenCreateTask && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateTask();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Task</span>
            </button>
          )}

          {activeTab === 'events' && onOpenCreateEvent && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateEvent();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Event</span>
            </button>
          )}

          {activeTab === 'habits' && onOpenCreateHabit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateHabit();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Habit</span>
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab} by name or details...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('linked')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  filterMode === 'linked'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Linked Only
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unlinked')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  filterMode === 'unlinked'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Unlinked
              </button>
            </div>

            <span className="text-[10px] text-slate-400">
              Click &apos;Link&apos; button to attach or detach
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {activeTab === 'tasks' && (
            <>
              {tasks
                .filter(t => {
                  const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
                  const linked = isTaskLinked(t);
                  if (!matchSearch) return false;
                  if (filterMode === 'linked') return linked;
                  if (filterMode === 'unlinked') return !linked;
                  return true;
                })
                .map(t => {
                  const linked = isTaskLinked(t);
                  return (
                    <div
                      key={`task-row-${t.id}`}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition ${
                        linked
                          ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/50'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              t.priority === 'high'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : t.priority === 'medium'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {t.priority || 'medium'}
                          </span>
                          <h4
                            className={`text-xs font-semibold truncate ${
                              t.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {t.title}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Due {t.dueDate || 'No due date'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTaskLink(t)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          linked
                            ? 'bg-indigo-600 text-white hover:bg-rose-600 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {linked ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Linked</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Link Task</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              {tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400 italic">No tasks found.</p>
              )}
            </>
          )}

          {activeTab === 'events' && (
            <>
              {scheduleItems
                .filter(e => {
                  const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
                  const linked = isEventLinked(e);
                  if (!matchSearch) return false;
                  if (filterMode === 'linked') return linked;
                  if (filterMode === 'unlinked') return !linked;
                  return true;
                })
                .map(e => {
                  const linked = isEventLinked(e);
                  return (
                    <div
                      key={`event-row-${e.id}`}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition ${
                        linked
                          ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/50'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            e.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {e.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {e.date} • {e.startTime || '09:00'} - {e.endTime || '10:00'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleEventLink(e)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          linked
                            ? 'bg-amber-600 text-white hover:bg-rose-600 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {linked ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Linked</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Link Event</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              {scheduleItems.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400 italic">No events found.</p>
              )}
            </>
          )}

          {activeTab === 'habits' && (
            <>
              {habits
                .filter(h => {
                  const matchSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const linked = isHabitLinked(h);
                  if (!matchSearch) return false;
                  if (filterMode === 'linked') return linked;
                  if (filterMode === 'unlinked') return !linked;
                  return true;
                })
                .map(h => {
                  const linked = isHabitLinked(h);
                  return (
                    <div
                      key={`habit-row-${h.id}`}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition ${
                        linked
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/50'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="text-sm shrink-0">{h.icon || '🎯'}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {h.name}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            {h.frequency || 'daily'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleHabitLink(h)}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          linked
                            ? 'bg-emerald-600 text-white hover:bg-rose-600 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {linked ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Linked</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Link Habit</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              {habits.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400 italic">No habits found.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Goal items: {linkedTasksCount} tasks • {linkedEventsCount} events • {linkedHabitsCount} habits
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs hover:opacity-90 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
