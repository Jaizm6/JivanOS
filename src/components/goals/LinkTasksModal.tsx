import React, { useState, useMemo } from 'react';
import { Search, Check, Link2, Unlink, X, Target, Briefcase } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskItem } from '../../types';

interface LinkTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'goal';
  targetId: string;
  targetTitle: string;
  targetColor?: string;
}

export const LinkTasksModal: React.FC<LinkTasksModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  targetColor = '#6366f1',
}) => {
  const { tasks, linkTaskToGoal, goals } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'unlinked'>('all');

  const isTaskLinked = (t: TaskItem): boolean => {
    return t.goalId === targetId;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const linked = isTaskLinked(t);
      if (filterMode === 'linked') return linked;
      if (filterMode === 'unlinked') return !linked;
      return true;
    });
  }, [tasks, searchQuery, filterMode, targetId]);

  const linkedCount = useMemo(() => {
    return tasks.filter(t => isTaskLinked(t)).length;
  }, [tasks, targetId]);

  const handleToggleLink = (task: TaskItem) => {
    const linked = isTaskLinked(task);
    linkTaskToGoal(task.id, linked ? undefined : targetId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: targetColor }}
            >
              {targetType === 'goal' ? <Target className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Link Tasks to {targetType === 'goal' ? 'Strategic Goal' : 'Workspace Project'}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  {linkedCount} linked
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
                Target: <span className="font-semibold text-slate-700 dark:text-slate-300">{targetTitle}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title, category, or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-200/60 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Tasks ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('linked')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'linked'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Linked Only ({linkedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unlinked')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'unlinked'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Unlinked ({tasks.length - linkedCount})
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Click &apos;Link&apos; to attach task instantly
            </span>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <p className="font-semibold">No tasks found matching criteria</p>
              <p className="text-[11px] mt-1">Try changing your search term or filter selection</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const linked = isTaskLinked(task);
              const currentGoal = task.goalId ? goals.find(g => g.id === task.goalId) : null;

              return (
                <div
                  key={task.id}
                  className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-2xl transition ${
                    linked
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <h4
                        className={`text-xs font-semibold truncate ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                      {currentGoal && (
                        <span className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400">
                          <Target className="w-2.5 h-2.5" />
                          {currentGoal.title}
                        </span>
                      )}
                      <span>Due: {task.dueDate}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleLink(task)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      linked
                        ? 'bg-indigo-600 text-white hover:bg-rose-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700'
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
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-800/20">
          <span className="text-slate-500 dark:text-slate-400">
            {linkedCount} of {tasks.length} tasks linked to this {targetType}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-xs hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
