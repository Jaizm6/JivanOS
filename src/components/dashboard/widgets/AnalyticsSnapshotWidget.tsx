import React from 'react';
import { BarChart3, TrendingUp, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useApp } from '../../../context/AppContext';

export const AnalyticsSnapshotWidget: React.FC = () => {
  const { setActiveTab, theme } = useApp();

  // Synthetic 7-day trend data
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartData = [
    { day: 'Mon', tasks: 5, meds: 100, hydration: 85 },
    { day: 'Tue', tasks: 7, meds: 100, hydration: 90 },
    { day: 'Wed', tasks: 4, meds: 66, hydration: 75 },
    { day: 'Thu', tasks: 8, meds: 100, hydration: 100 },
    { day: 'Fri', tasks: 6, meds: 100, hydration: 95 },
    { day: 'Sat', tasks: 3, meds: 100, hydration: 80 },
    { day: 'Sun', tasks: 5, meds: 100, hydration: 100 },
  ];

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-violet-50 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400 border border-violet-100/60 dark:border-violet-900/60 shrink-0">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>7-Day Adherence & Task Velocity</span>
          </span>
        </div>
        <button
          id="btn-goto-analytics"
          onClick={() => setActiveTab('analytics')}
          className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 cursor-pointer transition"
        >
          <span>Detailed Reports</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Metric summary pills */}
        <div className="space-y-2.5 flex flex-col justify-center">
          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">
              Medication Adherence
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              95.2%
            </div>
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
              <TrendingUp className="w-3 h-3" /> +4.1% vs last week
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
              Weekly Tasks Completed
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              38 Tasks
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Avg 5.4 tasks / day
            </div>
          </div>
        </div>

        {/* Chart representation */}
        <div className="lg:col-span-3 h-48 sm:h-52 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                  borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="tasks" name="Tasks Done" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="hydration" name="Water %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
