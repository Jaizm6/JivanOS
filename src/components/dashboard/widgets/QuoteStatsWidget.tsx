import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Quote } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const QuoteStatsWidget: React.FC = () => {
  const { quotes, favoriteQuoteIds } = useApp();

  const totalQuotes = quotes.length;
  
  // Calculate distribution by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    quotes.forEach((q) => {
      counts[q.category] = (counts[q.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [quotes]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899'];

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60">
            <Quote className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Wisdom Library
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center mt-4">
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalQuotes}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Quotes</div>
        </div>

        <div className="w-full h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryCounts}
                innerRadius={30}
                outerRadius={50}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryCounts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
