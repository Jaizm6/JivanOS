import React, { useState, useMemo } from 'react';
import {
  Award,
  TrendingUp,
  Flame,
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Download,
  Database,
} from 'lucide-react';
import { Habit, HabitCategory } from '../../types';
import { IconRenderer } from '../common/IconRenderer';
import { useApp } from '../../context/AppContext';

interface HabitsReportSectionProps {
  habits: Habit[];
}

export const HabitsReportSection: React.FC<HabitsReportSectionProps> = ({ habits }) => {
  const { setActiveTab } = useApp();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'overall'>('weekly');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Time calculations based on selected period
  const daysInScope = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 90;

  const datesInScope = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    for (let i = daysInScope - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, [daysInScope]);

  // Total possible & actual completions
  const totalPossible = Math.max(1, habits.length * datesInScope.length);
  let totalDone = 0;
  habits.forEach(h => {
    datesInScope.forEach(dStr => {
      if (h.completionHistory?.[dStr]) totalDone++;
    });
  });

  const completionRate = Math.round((totalDone / totalPossible) * 100);

  // Best streak and active streaks
  const bestStreakOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak || 0), 0);
  const activeStreaksCount = habits.filter(h => (h.currentStreak || 0) > 0).length;

  // Category breakdown
  const categoryStats = useMemo(() => {
    const categories: HabitCategory[] = ['fitness', 'health', 'mind', 'learning', 'productivity'];
    return categories
      .map(cat => {
        const catHabits = habits.filter(h => h.category === cat);
        if (catHabits.length === 0) return null;

        const catPossible = catHabits.length * datesInScope.length;
        let catDone = 0;
        catHabits.forEach(h => {
          datesInScope.forEach(dStr => {
            if (h.completionHistory?.[dStr]) catDone++;
          });
        });

        const rate = Math.round((catDone / catPossible) * 100);
        return {
          category: cat,
          habitsCount: catHabits.length,
          rate,
          color:
            cat === 'fitness'
              ? '#10b981'
              : cat === 'health'
              ? '#06b6d4'
              : cat === 'mind'
              ? '#8b5cf6'
              : cat === 'learning'
              ? '#f59e0b'
              : '#6366f1',
        };
      })
      .filter(Boolean) as {
      category: HabitCategory;
      habitsCount: number;
      rate: number;
      color: string;
    }[];
  }, [habits, datesInScope]);

  // Per-habit breakdown
  const habitPerformance = useMemo(() => {
    return habits.map(h => {
      let done = 0;
      datesInScope.forEach(dStr => {
        if (h.completionHistory?.[dStr]) done++;
      });
      const rate = Math.round((done / datesInScope.length) * 100);
      return {
        habit: h,
        done,
        rate,
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [habits, datesInScope]);

  const starPerformer = habitPerformance[0];
  const attentionNeeded = habitPerformance.slice().reverse().find(h => h.rate < 60) || habitPerformance[habitPerformance.length - 1];

  // Day of Week Analysis
  const dayOfWeekStats = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    datesInScope.forEach(dStr => {
      const dayIdx = new Date(dStr + 'T00:00:00').getDay();
      totals[dayIdx] += habits.length;
      habits.forEach(h => {
        if (h.completionHistory?.[dStr]) counts[dayIdx]++;
      });
    });

    let bestDayIdx = 1;
    let maxRate = -1;

    const mapped = days.map((dayName, idx) => {
      const total = totals[idx] || 1;
      const done = counts[idx] || 0;
      const rate = Math.round((done / total) * 100);
      if (rate > maxRate) {
        maxRate = rate;
        bestDayIdx = idx;
      }
      return { dayName, rate };
    });

    return { mapped, bestDayName: days[bestDayIdx], bestRate: maxRate };
  }, [habits, datesInScope]);

  // Heatmap generation for current selected month
  const heatmapData = useMemo(() => {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthYearStr = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string; dayNum: number; rate: number; isCurrentMonth: boolean }[] = [];

    // Preceding blanks
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dateStr: `blank_${i}`, dayNum: 0, rate: -1, isCurrentMonth: false });
    }

    // Days in target month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let done = 0;
      habits.forEach(h => {
        if (h.completionHistory?.[dStr]) done++;
      });
      const rate = habits.length > 0 ? Math.round((done / habits.length) * 100) : 0;
      cells.push({ dateStr: dStr, dayNum: d, rate, isCurrentMonth: true });
    }

    return { monthYearStr, cells };
  }, [habits, calendarMonthOffset]);

  // Selected Day Report Computation
  const selectedDayReport = useMemo(() => {
    const habitsDone = habits.filter(h => h.completionHistory?.[selectedDateStr]);
    const habitsMissed = habits.filter(h => !h.completionHistory?.[selectedDateStr]);
    const total = habits.length;
    const rate = total > 0 ? Math.round((habitsDone.length / total) * 100) : 0;

    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      dateStr: selectedDateStr,
      formattedDate,
      habitsDone,
      habitsMissed,
      total,
      rate,
    };
  }, [habits, selectedDateStr]);

  return (
    <div className="space-y-6">
      {/* Top Selector & Period Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Habits Analytics & Reports
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visualize your streak consistency, category distribution, and completion rates
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 self-start sm:self-auto">
          {(['weekly', 'monthly', 'overall'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                period === p
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Stats Grid (Screenshots 7, 9 & 10 Inspiration) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Completion Rate Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:via-emerald-900/20 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {completionRate}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalDone} of {totalPossible} habit targets completed
            </p>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Best Streak Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-900/20 border border-amber-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Best Streak
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {bestStreakOverall} <span className="text-base font-medium text-slate-400">days</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeStreaksCount} active habit streaks going
            </p>
          </div>
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> High discipline momentum
          </div>
        </div>

        {/* Total Done Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-950/40 dark:via-indigo-900/20 border border-indigo-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Check-Ins
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {totalDone}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              across {habits.length} configured habits
            </p>
          </div>
          <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Tracked consistently
          </div>
        </div>
      </div>

      {/* Period Analysis: Star Performer & Attention Needed (Screenshot 7 Inspiration) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {starPerformer && (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center text-xl shrink-0">
              <IconRenderer icon={starPerformer.habit.icon} className="w-6 h-6" fallback="⭐" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Star Performer
              </div>
              <h5 className="font-bold text-slate-900 dark:text-white text-sm truncate mt-0.5">
                {starPerformer.habit.name}
              </h5>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{starPerformer.rate}%</span>
                <span>•</span>
                <span>{starPerformer.done} completions in period</span>
              </div>
            </div>
          </div>
        )}

        {attentionNeeded && (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center text-xl shrink-0">
              <IconRenderer icon={attentionNeeded.habit.icon} className="w-6 h-6" fallback="⚠️" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Attention Needed
              </div>
              <h5 className="font-bold text-slate-900 dark:text-white text-sm truncate mt-0.5">
                {attentionNeeded.habit.name}
              </h5>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="font-bold text-amber-600 dark:text-amber-400">{attentionNeeded.rate}%</span>
                <span>•</span>
                <span>Schedule a reminder or reduce friction</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day of Week Analysis Bar Chart (Screenshot 8 Inspiration) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Day of the Week Consistency
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Best day: <span className="font-bold text-emerald-600 dark:text-emerald-400">{dayOfWeekStats.bestDayName} ({dayOfWeekStats.bestRate}%)</span>
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {period === 'weekly' ? 'This Week' : 'Period Avg'}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4">
          {dayOfWeekStats.mapped.map(item => (
            <div key={item.dayName} className="flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {item.rate}%
              </span>
              <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex flex-col justify-end h-24">
                <div
                  className="w-full bg-emerald-500 rounded-t-xl transition-all duration-500"
                  style={{ height: `${Math.max(4, item.rate)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {item.dayName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Analysis Progress Bars (Screenshot 10 Inspiration) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Category Breakdown
          </h4>
          <span className="text-xs text-slate-500">
            {categoryStats.length} active categories
          </span>
        </div>

        <div className="space-y-3">
          {categoryStats.map(cat => (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                  {cat.category} ({cat.habitsCount} habits)
                </span>
                <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                  {cat.rate}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${cat.rate}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Consistency Heatmap & Selected Day Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Medium/Compact Calendar */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {heatmapData.monthYearStr}
              </h4>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalendarMonthOffset(prev => prev - 1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setCalendarMonthOffset(0);
                  setSelectedDateStr(new Date().toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarMonthOffset(prev => prev + 1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Select any day to view its detailed breakdown.
          </p>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 py-1 border-b border-slate-100 dark:border-slate-800">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          {/* Heatmap Day Squares */}
          <div className="grid grid-cols-7 gap-1">
            {heatmapData.cells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <div key={`blank-${idx}`} className="aspect-square rounded-lg bg-transparent" />;
              }

              const isSelected = selectedDateStr === cell.dateStr;
              let bgClass = 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700';
              if (cell.rate >= 80) {
                bgClass = 'bg-emerald-500 text-white font-bold shadow-2xs hover:bg-emerald-600';
              } else if (cell.rate >= 50) {
                bgClass = 'bg-emerald-300 dark:bg-emerald-600/60 text-slate-900 dark:text-white font-semibold hover:bg-emerald-400';
              } else if (cell.rate > 0) {
                bgClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200';
              }

              return (
                <button
                  type="button"
                  key={`habit-heat-${cell.dateStr}-${idx}`}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  title={`${cell.dateStr}: ${cell.rate}% completion`}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition cursor-pointer ${bgClass} ${
                    isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 scale-105 font-black z-10' : ''
                  }`}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400">Activity Level</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800" />
                <span>0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 dark:bg-amber-900" />
                <span>&lt;50%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-300 dark:bg-emerald-600" />
                <span>50-80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>80%+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Day Large Data Report */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Selected Date Report</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedDayReport.formattedDate}
              </h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
              selectedDayReport.rate >= 80
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                : selectedDayReport.rate >= 50
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {selectedDayReport.rate === 100
                ? '⭐ Perfect Day'
                : selectedDayReport.rate >= 80
                ? '🔥 High Discipline'
                : selectedDayReport.rate >= 50
                ? '⚡ Moderate'
                : '🌱 Low Activity'}
            </span>
          </div>

          {/* Large Data KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Completion Rate
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {selectedDayReport.rate}%
              </div>
              <div className="w-full bg-emerald-200/80 dark:bg-emerald-900/60 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${selectedDayReport.rate}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Completed
              </span>
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {selectedDayReport.habitsDone.length}
                <span className="text-base sm:text-lg font-bold text-indigo-400 ml-1">/ {selectedDayReport.total}</span>
              </div>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-2 font-medium">
                Habits logged done
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Pending / Missed
              </span>
              <div className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                {selectedDayReport.habitsMissed.length}
              </div>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-2 font-medium">
                {selectedDayReport.habitsMissed.length === 0 ? 'All completed!' : 'Habits remaining'}
              </p>
            </div>
          </div>

          {/* Habit Details for the Selected Day */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Habits Detail Breakdown ({selectedDayReport.total})
            </h4>

            {selectedDayReport.total === 0 ? (
              <p className="text-xs text-slate-400 italic">No habits registered in the system yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {/* Completed first */}
                {selectedDayReport.habitsDone.map(h => (
                  <div
                    key={h.id}
                    className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                        <IconRenderer icon={h.icon} className="w-3.5 h-3.5" fallback="✨" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {h.name}
                        </div>
                        <div className="text-[10px] text-slate-500 capitalize">{h.category}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  </div>
                ))}

                {/* Missed */}
                {selectedDayReport.habitsMissed.map(h => (
                  <div
                    key={h.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 opacity-70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-500 text-sm shrink-0">
                        <IconRenderer icon={h.icon} className="w-3.5 h-3.5" fallback="📌" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                          {h.name}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">{h.category}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-medium shrink-0">
                      Missed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Export Notice */}
      <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200/60 dark:border-zinc-800 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">Looking to Export Habits & Data?</h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              All multi-app exports (Loop Habit, Super Productivity, Todoist, CSV & Master Backups) are centralized in Settings.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer shrink-0"
        >
          Open Settings Export Hub
        </button>
      </div>
    </div>
  );
};
