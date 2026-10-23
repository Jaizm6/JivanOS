import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';

export const FocusBar: React.FC = () => {
  const {
    pomodoro,
    tasks,
    pausePomodoro,
    startPomodoro,
    resetPomodoro,
    stopPomodoro,
    completePomodoroSession,
    setActiveTab,
  } = useApp();

  const { pauseSession, resumeSession, stopSession: stopActiveSession } = useActiveSession();

  // Show whenever a task is actively focused OR pomodoro is running
  const hasActiveSession = Boolean(pomodoro.taskId || pomodoro.isRunning);

  if (!hasActiveSession) {
    return null;
  }

  const activeTask = tasks.find(t => t.id === pomodoro.taskId);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress =
    pomodoro.initialDuration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((pomodoro.initialDuration - pomodoro.timeRemaining) / pomodoro.initialDuration) * 100
          )
        )
      : 0;

  return (
    <AnimatePresence>
      <div
        id="global-floating-focus-timer"
        className="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-40 w-[95vw] sm:w-auto max-w-2xl pointer-events-auto select-none"
      >
        <motion.div
          initial={{ y: -40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="rounded-2xl border border-indigo-200/90 dark:border-indigo-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden"
        >
          {/* Subtle Progress Bar */}
          <div className="w-full bg-indigo-100/60 dark:bg-slate-800 h-1">
            <div
              className={`h-1 transition-all duration-300 ${
                pomodoro.mode === 'work' ? 'bg-indigo-600' : 'bg-emerald-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-3 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 sm:gap-4">
            {/* Left: Stopwatch icon + Status + Task Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                  pomodoro.isRunning
                    ? pomodoro.mode === 'work'
                      ? 'bg-indigo-600 animate-pulse'
                      : 'bg-emerald-600 animate-pulse'
                    : 'bg-slate-700'
                }`}
              >
                <Timer className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {pomodoro.mode === 'work' ? 'ACTIVE FOCUS ON TASK' : 'RESTORATIVE BREAK'}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-black text-indigo-600 dark:text-indigo-300 tabular-nums">
                    {formatTimer(pomodoro.timeRemaining)}
                  </span>
                </div>
                <h4
                  onClick={() => {
                    if (activeTask) setActiveTab('tasks');
                  }}
                  className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate mt-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                  title={activeTask ? activeTask.title : 'Free Focus Sprint'}
                >
                  {activeTask ? activeTask.title : 'Free Focus Sprint'}
                </h4>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Pause / Resume */}
              <button
                type="button"
                id="btn-floating-pomodoro-pause-resume"
                onClick={() => {
                  if (pomodoro.isRunning) {
                    pausePomodoro();
                    pauseSession();
                  } else {
                    startPomodoro(pomodoro.taskId || undefined);
                    resumeSession();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs text-white shadow-xs transition cursor-pointer ${
                  pomodoro.isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                title={pomodoro.isRunning ? 'Pause Timer' : 'Resume Timer'}
              >
                {pomodoro.isRunning ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{pomodoro.isRunning ? 'Pause' : 'Resume'}</span>
              </button>

              {/* Log Pomodoro (+1 🍅) */}
              <button
                type="button"
                id="btn-floating-pomodoro-log"
                onClick={completePomodoroSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                title="Log completed Pomodoro sprint (+1 🍅)"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden xs:inline">Log Pomodoro (+1 🍅)</span>
                <span className="xs:hidden">+1 🍅</span>
              </button>

              {/* Restart / Reset Sprint */}
              <button
                type="button"
                id="btn-floating-pomodoro-reset"
                onClick={() => resetPomodoro()}
                className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-90"
                title="Restart Sprint (Reset to 25:00)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Dismiss / Close Floating Bar - Stops timer immediately */}
              <button
                type="button"
                id="btn-floating-pomodoro-dismiss"
                onClick={() => {
                  stopPomodoro();
                  stopActiveSession();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Stop and Dismiss Focus Timer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
