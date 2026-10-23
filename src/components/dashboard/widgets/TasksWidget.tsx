import React, { useState } from 'react';
import { CheckSquare, Plus, ArrowRight, Play, Pause, Check, Calendar, Flag, Edit2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Priority } from '../../../types';

export const TasksWidget: React.FC = () => {
  const { tasks, toggleTask, addTask, startPomodoro, pausePomodoro, pomodoro, setActiveTab } = useApp();
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Active tasks sorted by priority (high -> medium -> low)
  const priorityOrder: Record<Priority, number> = { high: 1, medium: 2, low: 3 };
  const pendingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    addTask({
      title: quickTitle.trim(),
      priority: quickPriority,
      status: 'todo',
      quadrant: 'urgent_important',
      project: 'General',
      dueDate: todayStr,
      completed: false,
      subtasks: [],
      estimatedPomodoros: 1,
      recurring: 'none',
    });
    setQuickTitle('');
  };

  const priorityColors: Record<Priority, { text: string; bg: string; border: string }> = {
    high: { text: 'text-rose-700 dark:text-rose-300 font-bold', bg: 'bg-rose-50 dark:bg-rose-950/80', border: 'border-rose-300 dark:border-rose-800' },
    medium: { text: 'text-amber-700 dark:text-amber-300 font-bold', bg: 'bg-amber-50 dark:bg-amber-950/80', border: 'border-amber-300 dark:border-amber-800' },
    low: { text: 'text-blue-700 dark:text-blue-300 font-bold', bg: 'bg-blue-50 dark:bg-blue-950/80', border: 'border-blue-300 dark:border-blue-800' },
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/60 shrink-0">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Tasks & Priorities</span>
            <span className="text-[9.5px] font-medium font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50 hidden sm:inline">
              {pendingTasks.length} pending
            </span>
          </span>
        </div>
        <button
          id="btn-goto-tasks"
          onClick={() => setActiveTab('tasks')}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition"
        >
          <span>All Tasks</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Task List */}
      <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-72">
        {pendingTasks.length === 0 ? (
          <div className="py-8 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            No pending tasks! All caught up.
          </div>
        ) : (
          pendingTasks.slice(0, 5).map(task => {
            const pStyle = priorityColors[task.priority];
            const completedSubs = task.subtasks.filter(s => s.completed).length;

            return (
              <div
                key={task.id}
                className="group p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition flex items-center justify-between gap-2.5 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    id={`btn-complete-task-${task.id}`}
                    onClick={() => toggleTask(task.id)}
                    title={`Priority: ${task.priority} — Click to complete`}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 cursor-pointer ${
                      task.completed
                        ? 'bg-emerald-600 border-2 border-emerald-600 text-white'
                        : task.priority === 'high'
                        ? 'border-2 border-rose-500 dark:border-rose-400 bg-white dark:bg-slate-800 hover:scale-105'
                        : task.priority === 'medium'
                        ? 'border-2 border-amber-500 dark:border-amber-400 bg-white dark:bg-slate-800 hover:scale-105'
                        : 'border-2 border-emerald-500 dark:border-emerald-400 bg-white dark:bg-slate-800 hover:scale-105'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                  <div className="min-w-0">
                    <p
                      onClick={() => setActiveTab('tasks')}
                      className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      title="Click to edit task in Tasks"
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                      <span className={`px-1.5 py-0.2 rounded border text-[10px] flex items-center gap-0.5 ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                        <Flag className="w-2.5 h-2.5" />
                        {task.priority}
                      </span>
                      <span>&bull;</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{task.project}</span>
                      {task.subtasks.length > 0 && (
                        <>
                          <span>&bull;</span>
                          <span>{completedSubs}/{task.subtasks.length} subs</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Edit task in Tasks"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Pomodoro Focus Action */}
                  {pomodoro.taskId === task.id ? (
                    <button
                      id={`btn-focus-task-${task.id}`}
                      onClick={() => {
                        if (pomodoro.isRunning) {
                          pausePomodoro();
                        } else {
                          startPomodoro(task.id);
                        }
                      }}
                      title={pomodoro.isRunning ? 'Pause Pomodoro' : 'Resume Pomodoro'}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-white transition text-xs font-semibold shrink-0 shadow-xs ${
                        pomodoro.isRunning
                          ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {pomodoro.isRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      <span>{formatTimer(pomodoro.timeRemaining)}</span>
                    </button>
                  ) : (
                    <button
                      id={`btn-focus-task-${task.id}`}
                      onClick={() => startPomodoro(task.id)}
                      title="Launch 25-minute Pomodoro for this task"
                      className="opacity-80 group-hover:opacity-100 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition shrink-0"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Inline */}
      <form onSubmit={handleQuickAdd} className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 min-w-0">
        <input
          id="input-quick-task"
          type="text"
          placeholder="Add quick task (Press Enter)..."
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
        />
        <select
          id="select-quick-task-priority"
          value={quickPriority}
          onChange={e => setQuickPriority(e.target.value as Priority)}
          className="shrink-0 px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
        >
          <option value="high">🔥 High</option>
          <option value="medium">📅 Medium</option>
          <option value="low">👥 Low</option>
        </select>
        <button
          id="btn-submit-quick-task"
          type="submit"
          className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
