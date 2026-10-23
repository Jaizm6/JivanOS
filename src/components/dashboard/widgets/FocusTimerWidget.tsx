import React, { useState } from 'react';
import { Timer, Play, Pause, RotateCcw, Briefcase, Check, History, Trash2, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const FocusTimerWidget: React.FC = () => {
  const {
    pomodoro,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    switchPomodoroMode,
    completePomodoroSession,
    setPomodoroTask,
    tasks,
    pomodoroLogs,
    deletePomodoroLog,
    resetPomodoroLogs,
  } = useApp();

  const [showLogs, setShowLogs] = useState(false);

  const activeTask = tasks.find(t => t.id === pomodoro.taskId);
  const uncompletedTasks = tasks.filter(t => !t.completed);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress =
    pomodoro.initialDuration > 0
      ? ((pomodoro.initialDuration - pomodoro.timeRemaining) / pomodoro.initialDuration) * 100
      : 0;

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0">
            <Timer className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Focus & Productivity Timer</span>
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => switchPomodoroMode('work')}
            className={`px-2 py-1 rounded-md transition whitespace-nowrap ${
              pomodoro.mode === 'work'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            Work (25m)
          </button>
          <button
            type="button"
            onClick={() => switchPomodoroMode('break')}
            className={`px-2 py-1 rounded-md transition whitespace-nowrap ${
              pomodoro.mode === 'break'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            Break (5m)
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center justify-center flex-1 w-full min-w-0">
        {/* Linked Task Selector */}
        <div className="w-full mb-2 flex items-center gap-1.5 min-w-0">
          <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <select
            id="focus-widget-select-task"
            value={pomodoro.taskId || ''}
            onChange={e => {
              const val = e.target.value;
              setPomodoroTask(val ? val : null);
            }}
            className="flex-1 min-w-0 w-full text-xs py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium truncate focus:outline-hidden"
          >
            <option value="">No task linked (Free Sprint)</option>
            {uncompletedTasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.completedPomodoros}/{t.estimatedPomodoros} 🍅)
              </option>
            ))}
          </select>
        </div>

        {activeTask && (
          <div className="mb-1 text-center">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              Logged: {activeTask.completedPomodoros} of {activeTask.estimatedPomodoros} Pomodoros 🍅
            </span>
          </div>
        )}

        {/* Big Timer Display */}
        <div className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white my-1">
          {formatTime(pomodoro.timeRemaining)}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 my-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              pomodoro.mode === 'work' ? 'bg-indigo-600' : 'bg-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Play / Pause / Complete / Reset Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            id="btn-pomodoro-main-toggle"
            type="button"
            onClick={() => {
              if (pomodoro.isRunning) {
                pausePomodoro();
              } else {
                startPomodoro(pomodoro.taskId || undefined, Math.ceil(pomodoro.timeRemaining / 60));
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition ${
              pomodoro.isRunning
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {pomodoro.isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{pomodoro.timeRemaining < pomodoro.initialDuration ? 'Resume' : 'Start Focus'}</span>
              </>
            )}
          </button>

          <button
            id="btn-pomodoro-complete-block"
            type="button"
            onClick={completePomodoroSession}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
            title="Log finished Pomodoro session (+1 🍅)"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Finish (+1 🍅)</span>
          </button>

          <button
            id="btn-pomodoro-reset"
            type="button"
            onClick={() => resetPomodoro({ restart: false })}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="btn-pomodoro-logs"
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className={`p-2 rounded-xl border transition flex items-center gap-1 text-xs font-semibold ${
              showLogs
                ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="View Pomodoro Session Logs"
          >
            <History className="w-4 h-4" />
            <span className="font-mono text-[11px]">{pomodoroLogs.length}</span>
          </button>
        </div>

        {/* Expandable Session Logs Panel */}
        {showLogs && (
          <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🍅 Completed Sessions</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                  {pomodoroLogs.length}
                </span>
              </span>

              {pomodoroLogs.length > 0 && (
                <button
                  type="button"
                  id="btn-reset-all-pomodoros"
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all Pomodoro session logs?')) {
                      resetPomodoroLogs();
                    }
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Reset Logs</span>
                </button>
              )}
            </div>

            {pomodoroLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                No Pomodoro logs yet. Finish a sprint to log!
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {pomodoroLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-rose-500 shrink-0">🍅</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {log.taskTitle}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{log.durationMinutes} mins</span>
                        <span>•</span>
                        <span>{formatTimestamp(log.completedAt)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      id={`btn-del-pomo-${log.id}`}
                      onClick={() => deletePomodoroLog(log.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="Delete this session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
