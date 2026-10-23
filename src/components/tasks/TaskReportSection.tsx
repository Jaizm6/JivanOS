import React, { useMemo } from 'react';
import {
  CheckCircle2,
  TrendingUp,
  Clock,
  Layers,
  Flag,
  Calendar,
  Zap,
  Target,
  BarChart3,
  History,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { TaskItem, EisenhowerQuadrant, Priority } from '../../types';
import { useApp } from '../../context/AppContext';

interface TaskReportSectionProps {
  tasks: TaskItem[];
  taskTimers?: Record<string, { timeRemaining: number; mode: 'work' | 'break'; initialDuration: number }>;
}

export const TaskReportSection: React.FC<TaskReportSectionProps> = ({ tasks, taskTimers = {} }) => {
  const { pomodoroLogs, deletePomodoroLog, resetPomodoroLogs } = useApp();
  // Core counts
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total Pomodoros across all tasks
  const totalCompletedPomodoros = tasks.reduce((sum, t) => sum + (t.completedPomodoros || 0), 0);
  const totalEstimatedPomodoros = tasks.reduce((sum, t) => sum + (t.estimatedPomodoros || 1), 0);
  const totalFocusHours = ((totalCompletedPomodoros * 25) / 60).toFixed(1);

  // Active per-task timers count
  const activeTimersCount = Object.keys(taskTimers).length;

  // 14-day completion velocity
  const last14Days = useMemo(() => {
    const dates: { dateStr: string; label: string; completedCount: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      // count completed tasks due or completed around this date
      const count = tasks.filter(t => t.completed && t.dueDate === dateStr).length;
      dates.push({ dateStr, label, completedCount: count });
    }
    return dates;
  }, [tasks]);

  const maxVelocity = Math.max(4, ...last14Days.map(d => d.completedCount));

  // Priority distribution
  const priorityStats = useMemo(() => {
    const list: { priority: Priority; label: string; count: number; color: string; bg: string }[] = [
      { priority: 'high', label: 'High Priority', count: tasks.filter(t => t.priority === 'high').length, color: '#f43f5e', bg: 'bg-rose-500' },
      { priority: 'medium', label: 'Medium Priority', count: tasks.filter(t => t.priority === 'medium').length, color: '#f59e0b', bg: 'bg-amber-500' },
      { priority: 'low', label: 'Low Priority', count: tasks.filter(t => t.priority === 'low').length, color: '#3b82f6', bg: 'bg-blue-500' },
    ];
    return list;
  }, [tasks]);

  // Project distribution
  const projectStats = useMemo(() => {
    const map: Record<string, { total: number; completed: number; pomodoros: number }> = {};
    tasks.forEach(t => {
      const p = t.project || 'General';
      if (!map[p]) map[p] = { total: 0, completed: 0, pomodoros: 0 };
      map[p].total++;
      if (t.completed) map[p].completed++;
      map[p].pomodoros += t.completedPomodoros || 0;
    });
    return Object.entries(map).map(([project, data]) => ({
      project,
      ...data,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [tasks]);

  // Eisenhower Matrix distribution
  const quadrantStats = useMemo(() => {
    const q1 = tasks.filter(t => t.quadrant === 'urgent_important').length;
    const q2 = tasks.filter(t => t.quadrant === 'not_urgent_important').length;
    const q3 = tasks.filter(t => t.quadrant === 'urgent_not_important').length;
    const q4 = tasks.filter(t => t.quadrant === 'neither' || t.quadrant === 'not_urgent_not_important').length;
    return [
      { label: 'Q1: DO · Urgent & Important', count: q1, color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
      { label: 'Q2: PLAN · Important (Not Urgent)', count: q2, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
      { label: 'Q3: PASS · Urgent (Not Important)', count: q3, color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
      { label: 'Q4: SKIP · Not Urgent & Not Important', count: q4, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    ];
  }, [tasks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {completionRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {completedTasks} completed of {totalTasks} total
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Focus Time Logged</span>
            <span className="text-rose-500">🍅</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {totalFocusHours}h
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalCompletedPomodoros} pomodoro sprints ({totalEstimatedPomodoros} est.)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Pending Backlog</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {pendingTasks}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {tasks.filter(t => !t.completed && t.priority === 'high').length} high priority items pending
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Active Task Timers</span>
            <Zap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {activeTimersCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Per-task saved timer states in memory
          </div>
        </div>
      </div>

      {/* Velocity Graph & Eisenhower Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-Day Velocity Bar Graph */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>14-Day Task Completion Velocity</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tasks marked completed per calendar day
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              Avg: {(completedTasks / 14).toFixed(1)} / day
            </span>
          </div>

          <div className="h-44 flex items-end justify-between gap-1.5 pt-4">
            {last14Days.map((item, idx) => {
              const heightPct = Math.max(10, Math.round((item.completedCount / maxVelocity) * 100));
              const isToday = idx === last14Days.length - 1;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[28px] rounded-t-lg transition-all relative ${
                      isToday
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : item.completedCount > 0
                        ? 'bg-indigo-500/80 hover:bg-indigo-500 dark:bg-indigo-600'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono pointer-events-none transition whitespace-nowrap z-10 shadow-md">
                      {item.completedCount} done ({item.label})
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">
                    {item.label.split(',')[0].slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Eisenhower Quadrant Breakdown */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <span>Eisenhower Matrix Balance</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Task distribution across urgency & importance
            </p>
          </div>

          <div className="my-4 space-y-3">
            {quadrantStats.map(q => {
              const pct = totalTasks > 0 ? Math.round((q.count / totalTasks) * 100) : 0;
              return (
                <div key={q.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]">
                      {q.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {q.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${q.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            Optimal goal: Keep 60%+ in <strong>Q2 (Important, Not Urgent)</strong> for proactive growth.
          </div>
        </div>
      </div>

      {/* Project & Priority Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Workload & Focus Hours */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Project Focus & Progress</span>
          </h3>
          <div className="space-y-3">
            {projectStats.map(p => (
              <div key={p.project} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">{p.project}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({p.completed}/{p.total} tasks)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-rose-500 flex items-center gap-0.5">
                      🍅 {p.pomodoros}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{p.rate}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500" style={{ width: `${p.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-amber-500" />
            <span>Priority Distribution</span>
          </h3>
          <div className="space-y-3">
            {priorityStats.map(p => {
              const pct = totalTasks > 0 ? Math.round((p.count / totalTasks) * 100) : 0;
              return (
                <div key={p.priority} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${p.bg}`} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{p.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">{pct}%</span>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                      {p.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pomodoro Focus Sessions Log & Audit Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-rose-500" />
              <span>Pomodoro Focus Logs & Sprint Audit</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              History of all logged focus intervals. Sessions can be individually deleted or reset.
            </p>
          </div>
          {pomodoroLogs.length > 0 && (
            <button
              type="button"
              id="btn-report-reset-pomodoro"
              onClick={() => {
                if (confirm('Are you sure you want to reset all Pomodoro session logs?')) {
                  resetPomodoroLogs();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Sprints</span>
            </button>
          )}
        </div>

        <div className="mt-4">
          {pomodoroLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="text-2xl block mb-1">🍅</span>
              <p className="text-xs italic">No Pomodoro sprints logged yet. Use the timer on the dashboard to log focus blocks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pomodoroLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-500 shrink-0">🍅</span>
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {log.taskTitle}
                      </h4>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 font-mono">
                      <span>{log.durationMinutes}m duration</span>
                      <span>•</span>
                      <span>
                        {new Date(log.completedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    id={`btn-report-del-pomo-${log.id}`}
                    onClick={() => deletePomodoroLog(log.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0"
                    title="Delete log entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
