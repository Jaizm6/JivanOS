import React from 'react';
import { CheckCircle2, Pill, Droplets, BookLock, Sparkles, MoreHorizontal, ArrowRight, Activity } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const DailySummaryWidget: React.FC = () => {
  const { tasks, medications, doseLogs, hydration, journalEntries, profile, setActiveTab } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  // Tasks stats
  const todayTasks = tasks.filter(t => t.dueDate === todayStr);
  const completedTasksToday = todayTasks.filter(t => t.completed).length;
  const pendingTasksCount = todayTasks.length - completedTasksToday;
  const taskPct = todayTasks.length > 0 ? Math.round((completedTasksToday / todayTasks.length) * 100) : 100;

  // Meds stats
  const activeMeds = medications.filter(m => m.active);
  const takenMedsToday = doseLogs.filter(d => d.status === 'taken' && d.loggedAt.startsWith(todayStr)).length;
  const medPct = activeMeds.length > 0 ? Math.min(100, Math.round((takenMedsToday / activeMeds.length) * 100)) : 100;

  // Hydration stats
  const currentWater = hydration.todayLogs.reduce((acc, c) => acc + c.amountMl, 0);
  const waterPct = Math.min(100, Math.round((currentWater / hydration.targetMl) * 100));

  // Journal stats
  const hasJournalToday = journalEntries.some(j => j.date === todayStr);

  const overallScore = Math.round((taskPct + medPct + waterPct + (hasJournalToday ? 100 : 0)) / 4);

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-md transition-all">
      <div className="flex flex-col gap-3.5 sm:gap-4">
        {/* Card Header (Matches Daily Wisdom title color palette & squircle pill structure) */}
        <div className="flex items-center justify-between pb-1 text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
              <span>Daily Harmony & Vitals</span>
              <span className="text-[9.5px] font-medium font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/50 hidden sm:inline">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="View Analytics & Trends"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Metric & Floating Gradient Badge (Unified with Wisdom Palette) */}
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Today's Rhythm Score
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight bento-stat-num">
                {overallScore}%
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/80">
                {overallScore >= 80 ? 'Optimal' : overallScore >= 50 ? 'Steady' : 'In Progress'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
              {overallScore >= 80
                ? `You're in great rhythm today! All health targets and priority tasks are progressing smoothly.`
                : pendingTasksCount > 0
                ? `You have ${pendingTasksCount} priority task${pendingTasksCount > 1 ? 's' : ''} left today. Take steady steps to wrap up your day.`
                : `Hydration and regimen active. Check in on your journal or focus timers when ready.`}
            </p>
          </div>

          {/* Floating Circle Badge in Theme-Reactive Accent Palette */}
          <div className="shrink-0 flex items-center justify-center">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: 'linear-gradient(135deg, var(--primary-accent) 0%, var(--primary-accent-hover) 100%)',
                boxShadow: '0 4px 14px var(--primary-accent-ring)',
              }}
              title="Daily Harmony Status"
              onClick={() => setActiveTab('analytics')}
            >
              <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* 4 Core Pillars Pills - Solid, crisp high-contrast cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 w-full pt-1">
          {/* Tasks */}
          <button
            id="summary-pill-tasks"
            onClick={() => setActiveTab('tasks')}
            className="flex items-center gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-750 transition text-left cursor-pointer min-w-0 group"
            title="Go to Task Manager"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                {completedTasksToday}/{todayTasks.length}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold truncate leading-tight">
                Tasks Done
              </div>
            </div>
          </button>

          {/* Meds */}
          <button
            id="summary-pill-meds"
            onClick={() => setActiveTab('medications')}
            className="flex items-center gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-750 transition text-left cursor-pointer min-w-0 group"
            title="Go to Medication Tracker"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/90 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Pill className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {takenMedsToday}/{activeMeds.length}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold truncate leading-tight">
                Meds Taken
              </div>
            </div>
          </button>

          {/* Water */}
          <button
            id="summary-pill-water"
            onClick={() => setActiveTab('medications')}
            className="flex items-center gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-white dark:hover:bg-slate-750 transition text-left cursor-pointer min-w-0 group"
            title="Check Hydration Status"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/90 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Droplets className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                {currentWater} ml
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold truncate leading-tight">
                Water ({waterPct}%)
              </div>
            </div>
          </button>

          {/* Journal */}
          <button
            id="summary-pill-journal"
            onClick={() => setActiveTab('journal')}
            className="flex items-center gap-2.5 p-2 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-amber-400 dark:hover:border-amber-500 hover:bg-white dark:hover:bg-slate-750 transition text-left cursor-pointer min-w-0 group"
            title="Open Encrypted Journal"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/90 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
              <BookLock className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                {hasJournalToday ? 'Logged' : 'Pending'}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold truncate leading-tight">
                Daily Log
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

