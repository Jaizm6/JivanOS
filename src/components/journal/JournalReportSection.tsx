import React, { useMemo, useState } from 'react';
import {
  Smile,
  Calendar,
  Sparkles,
  TrendingUp,
  Heart,
  ShieldCheck,
  Award,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  Activity,
  BarChart2,
  LineChart as LineChartIcon,
  Flame,
  CheckCircle2,
  Check,
  Target,
} from 'lucide-react';
import { JournalEntry, MoodType } from '../../types';
import { useApp } from '../../context/AppContext';

interface JournalReportSectionProps {
  entries: JournalEntry[];
}

export const JournalReportSection: React.FC<JournalReportSectionProps> = ({ entries }) => {
  const { habits } = useApp();
  const [timeHorizon, setTimeHorizon] = useState<'14d' | '30d' | 'all'>('14d');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const daysCount = timeHorizon === '14d' ? 14 : timeHorizon === '30d' ? 30 : 90;

  // Filter entries within time horizon
  const filteredEntries = useMemo(() => {
    if (timeHorizon === 'all') return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysCount);
    return entries.filter(e => {
      const d = new Date(e.date || e.createdAt);
      return d >= cutoff;
    });
  }, [entries, timeHorizon, daysCount]);

  // Mood scores mapping
  const moodScoreMap: Record<MoodType, number> = {
    ecstatic: 5,
    great: 5,
    good: 4,
    calm: 4,
    neutral: 3,
    okay: 3,
    anxious: 2,
    stressed: 2,
    bad: 2,
    down: 1,
    awful: 1,
  };

  const moodMeta: Record<
    MoodType,
    { label: string; emoji: string; color: string; bg: string }
  > = {
    ecstatic: { label: 'Ecstatic', emoji: '🤩', color: '#f59e0b', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    great: { label: 'Great', emoji: '😄', color: '#f59e0b', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    good: { label: 'Good', emoji: '😊', color: '#10b981', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
    calm: { label: 'Calm', emoji: '😌', color: '#3b82f6', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
    neutral: { label: 'Neutral', emoji: '😐', color: '#64748b', bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    okay: { label: 'Okay', emoji: '🙂', color: '#64748b', bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    anxious: { label: 'Anxious', emoji: '😰', color: '#8b5cf6', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
    stressed: { label: 'Stressed', emoji: '😣', color: '#8b5cf6', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
    bad: { label: 'Bad', emoji: '🙁', color: '#f43f5e', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
    down: { label: 'Down', emoji: '😔', color: '#f43f5e', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
    awful: { label: 'Awful', emoji: '😫', color: '#e11d48', bg: 'bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-200' },
  };

  // Distribution counts
  const moodCounts = useMemo(() => {
    const counts: Record<MoodType, number> = {
      ecstatic: 0,
      great: 0,
      good: 0,
      calm: 0,
      neutral: 0,
      okay: 0,
      anxious: 0,
      stressed: 0,
      bad: 0,
      down: 0,
      awful: 0,
    };
    filteredEntries.forEach(e => {
      if (counts[e.mood] !== undefined) {
        counts[e.mood]++;
      }
    });
    return counts;
  }, [filteredEntries]);

  // Positivity rate (ecstatic + great + good + calm)
  const positiveCount =
    (moodCounts.ecstatic || 0) +
    (moodCounts.great || 0) +
    (moodCounts.good || 0) +
    (moodCounts.calm || 0);
  const positivityRate =
    filteredEntries.length > 0
      ? Math.round((positiveCount / filteredEntries.length) * 100)
      : 0;

  // Average mood score
  const avgMoodScore = useMemo(() => {
    if (filteredEntries.length === 0) return 0;
    const totalScore = filteredEntries.reduce((sum, e) => sum + (moodScoreMap[e.mood] || 3), 0);
    return (totalScore / filteredEntries.length).toFixed(1);
  }, [filteredEntries]);

  // Word count & reflections stats
  const wordStats = useMemo(() => {
    let totalWords = 0;
    filteredEntries.forEach(e => {
      const text = e.content || '';
      if (!e.isEncrypted) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        totalWords += words;
      }
    });
    const avgWords = filteredEntries.length > 0 ? Math.round(totalWords / filteredEntries.length) : 0;
    return { totalWords, avgWords };
  }, [filteredEntries]);

  // Consecutive journaling streak calculation
  const streakStats = useMemo(() => {
    const datesSet = new Set(
      entries.map(e => (e.date ? e.date : e.createdAt.split('T')[0]))
    );
    let currentStreak = 0;
    const cursor = new Date();

    while (true) {
      const dStr = cursor.toISOString().split('T')[0];
      if (datesSet.has(dStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        // Check if today was missed but yesterday was logged
        if (currentStreak === 0) {
          cursor.setDate(cursor.getDate() - 1);
          const yesterdayStr = cursor.toISOString().split('T')[0];
          if (datesSet.has(yesterdayStr)) {
            currentStreak++;
            cursor.setDate(cursor.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return { currentStreak, totalDaysWithEntries: datesSet.size };
  }, [entries]);

  // Timeline Trend Data (past N days)
  const trendDays = useMemo(() => {
    const result: {
      dateStr: string;
      label: string;
      mood: MoodType | null;
      score: number;
      entryTitle?: string;
    }[] = [];

    const today = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

      // Find entry on this date
      const match = entries.find(e => (e.date || e.createdAt.split('T')[0]) === dateStr);
      if (match) {
        result.push({
          dateStr,
          label,
          mood: match.mood,
          score: moodScoreMap[match.mood] || 3,
          entryTitle: match.title,
        });
      } else {
        result.push({
          dateStr,
          label,
          mood: null,
          score: 0,
        });
      }
    }
    return result;
  }, [entries, daysCount]);

  // Day of Week Distribution
  const dayOfWeekStats = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredEntries.forEach(e => {
      const d = new Date(e.date || e.createdAt);
      counts[d.getDay()]++;
    });
    const max = Math.max(1, ...counts);
    return days.map((day, idx) => ({
      day,
      count: counts[idx],
      heightPct: Math.max(12, Math.round((counts[idx] / max) * 100)),
    }));
  }, [filteredEntries]);

  // Tags sentiment
  const tagStats = useMemo(() => {
    const map: Record<string, { count: number; totalScore: number }> = {};
    filteredEntries.forEach(e => {
      e.tags.forEach(t => {
        if (!map[t]) map[t] = { count: 0, totalScore: 0 };
        map[t].count++;
        map[t].totalScore += moodScoreMap[e.mood] || 3;
      });
    });
    return Object.entries(map)
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        avgScore: (data.totalScore / data.count).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredEntries]);

  // Gratitude List Entries
  const gratitudeHighlights = useMemo(() => {
    return filteredEntries
      .filter(e => e.tags.includes('Gratitude') || e.title.toLowerCase().includes('grateful') || e.title.toLowerCase().includes('gratitude'))
      .slice(0, 5);
  }, [filteredEntries]);

  // Monthly Calendar Data
  const journalCalendarData = useMemo(() => {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthYearStr = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string; dayNum: number; entryCount: number; topMood?: MoodType; isCurrentMonth: boolean }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dateStr: `blank_${i}`, dayNum: 0, entryCount: 0, isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEntries = entries.filter(e => {
        const entryDate = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
        return entryDate === dStr;
      });
      const topMood = dayEntries[0]?.mood;
      cells.push({
        dateStr: dStr,
        dayNum: d,
        entryCount: dayEntries.length,
        topMood,
        isCurrentMonth: true,
      });
    }

    return { monthYearStr, cells };
  }, [entries, calendarMonthOffset]);

  // Selected Day Report Computation
  const selectedDayReport = useMemo(() => {
    const dayEntries = entries.filter(e => {
      const entryDate = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      return entryDate === selectedDateStr;
    });

    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const totalWords = dayEntries.reduce((acc, e) => {
      if (e.isEncrypted) return acc;
      return acc + (e.content ? e.content.trim().split(/\s+/).filter(Boolean).length : 0);
    }, 0);

    const primaryMood = dayEntries[0]?.mood;

    return {
      dateStr: selectedDateStr,
      formattedDate,
      entries: dayEntries,
      hasEntries: dayEntries.length > 0,
      totalWords,
      primaryMood,
    };
  }, [entries, selectedDateStr]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Time Horizon Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Journal & Mood Analytics
          </h3>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTimeHorizon('14d')}
            className={`px-3 py-1 rounded-lg transition ${
              timeHorizon === '14d'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            14 Days
          </button>
          <button
            onClick={() => setTimeHorizon('30d')}
            className={`px-3 py-1 rounded-lg transition ${
              timeHorizon === '30d'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeHorizon('all')}
            className={`px-3 py-1 rounded-lg transition ${
              timeHorizon === 'all'
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Positivity Index</span>
            <Smile className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {positivityRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Avg Score: <strong>{avgMoodScore}</strong> / 5.0
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Writing Streak</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {streakStats.currentStreak}d
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {streakStats.totalDaysWithEntries} total reflection days
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Reflections</span>
            <BookOpen className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {filteredEntries.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ~{wordStats.avgWords} words avg per reflection
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Encrypted Privacy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            {filteredEntries.filter(e => e.isEncrypted).length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            AES-256 E2E encrypted entries
          </div>
        </div>
      </div>

      {/* Interactive Medium Calendar & Selected Day Reflection Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Medium/Compact Month Calendar */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {journalCalendarData.monthYearStr}
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
            Click any day to view reflections and emotional metrics.
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

          {/* Calendar Day Squares */}
          <div className="grid grid-cols-7 gap-1">
            {journalCalendarData.cells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <div key={`journal-blank-${idx}`} className="aspect-square rounded-lg bg-transparent" />;
              }

              const isSelected = selectedDateStr === cell.dateStr;
              const hasEntries = cell.entryCount > 0;
              const moodMetaItem = cell.topMood ? moodMeta[cell.topMood] : null;

              return (
                <button
                  type="button"
                  key={`journal-heat-${cell.dateStr}-${idx}`}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  title={`${cell.dateStr}: ${cell.entryCount} entries`}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-medium transition cursor-pointer relative ${
                    hasEntries
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/50 hover:bg-purple-100'
                      : 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                  } ${
                    isSelected ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-slate-900 scale-105 font-black z-10' : ''
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {hasEntries && (
                    <span className="text-[9px] leading-none mt-0.5">
                      {moodMetaItem ? moodMetaItem.emoji : '📝'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Large Data Report */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Selected Date Report</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedDayReport.formattedDate}
              </h3>
            </div>
            {selectedDayReport.hasEntries && selectedDayReport.primaryMood ? (
              <span className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto flex items-center gap-1.5 ${moodMeta[selectedDayReport.primaryMood]?.bg || 'bg-slate-100 text-slate-700'}`}>
                <span>{moodMeta[selectedDayReport.primaryMood]?.emoji}</span>
                <span>{moodMeta[selectedDayReport.primaryMood]?.label}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 self-start sm:self-auto">
                No entry on this date
              </span>
            )}
          </div>

          {/* Large Data KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Reflections
              </span>
              <div className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                {selectedDayReport.entries.length}
              </div>
              <p className="text-[11px] text-purple-600/80 dark:text-purple-400 mt-2 font-medium">
                {selectedDayReport.entries.length === 1 ? '1 entry recorded' : `${selectedDayReport.entries.length} entries recorded`}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Words Written
              </span>
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {selectedDayReport.totalWords}
              </div>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-2 font-medium">
                Words in thoughts
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  Sentiment
                </span>
                <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                  {selectedDayReport.primaryMood ? (
                    <>
                      <span>{moodMeta[selectedDayReport.primaryMood]?.emoji}</span>
                      <span className="text-sm font-bold capitalize">{moodMeta[selectedDayReport.primaryMood]?.label}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm font-medium">Unlogged</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400 font-medium">
                {selectedDayReport.primaryMood ? `Mood Score: ${moodScoreMap[selectedDayReport.primaryMood]}/5` : 'No mood logged'}
              </p>
            </div>
          </div>

          {/* List of Entries for the Selected Day */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reflections Logged on {selectedDayReport.formattedDate}
            </h4>

            {!selectedDayReport.hasEntries ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
                <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  No reflection entry recorded for this date.
                </p>
                <p className="text-[11px] text-slate-400">
                  Select a highlighted day on the calendar or navigate to Journal to add a reflection.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {selectedDayReport.entries.map(e => (
                  <div
                    key={e.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{moodMeta[e.mood]?.emoji || '📝'}</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {e.title}
                        </span>
                      </div>
                      {e.isEncrypted && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3" /> Encrypted
                        </span>
                      )}
                    </div>
                    {e.content && !e.isEncrypted && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {e.content}
                      </p>
                    )}
                    {e.tags && e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {e.tags.map(t => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 font-medium"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DAYLIO-INSPIRED EXPLORE CHARTS & MOOD COUNT (Screenshot 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1 & 2: Mood Chart (Line & Bar modes) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Mood Chart
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tap on any day to view detailed reflections and emotional score
              </p>
            </div>

            {/* Chart Type Toggle & Timeframe (Screenshot 1) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    chartType === 'line'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                  title="Line Curve Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                    chartType === 'bar'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                  title="Bar Columns Chart"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                {(['14d', '30d', 'all'] as const).map(horizon => (
                  <button
                    key={horizon}
                    type="button"
                    onClick={() => setTimeHorizon(horizon)}
                    className={`px-2.5 py-1 rounded-lg uppercase tracking-wider text-[11px] transition ${
                      timeHorizon === horizon
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {horizon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Canvas with 5 Y-Axis Mood Tiers */}
          <div className="pt-2 flex gap-3">
            {/* Left Y-Axis: rad, good, meh, bad, awful */}
            <div className="flex flex-col justify-between h-48 py-1 text-right select-none text-[11px] font-bold text-slate-400 shrink-0">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="text-xs">🤩</span> <span className="hidden sm:inline">rad</span>
              </span>
              <span className="flex items-center gap-1 text-lime-600 dark:text-lime-400">
                <span className="text-xs">😊</span> <span className="hidden sm:inline">good</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                <span className="text-xs">😐</span> <span className="hidden sm:inline">meh</span>
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="text-xs">🙁</span> <span className="hidden sm:inline">bad</span>
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span className="text-xs">😫</span> <span className="hidden sm:inline">awful</span>
              </span>
            </div>

            {/* Chart Grid & Drawing Area */}
            <div className="flex-1 relative h-48 border-l border-b border-slate-200 dark:border-slate-800">
              {/* Horizontal Guidelines for 5 Tiers */}
              {[0, 25, 50, 75, 100].map(topPct => (
                <div
                  key={topPct}
                  className="absolute left-0 right-0 border-t border-dashed border-slate-100 dark:border-slate-800/80 pointer-events-none"
                  style={{ top: `${topPct}%` }}
                />
              ))}

              {chartType === 'line' ? (
                // SVG Line Curve Mode (Screenshot 1)
                <div className="absolute inset-0">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Build SVG polyline points for logged days */}
                    {(() => {
                      const pointsWithData = trendDays
                        .map((item, idx) => {
                          if (item.score <= 0) return null;
                          const x = ((idx + 0.5) / trendDays.length) * 100;
                          // Invert Y: 5 => 5%, 1 => 95%
                          const y = 95 - ((item.score - 1) / 4) * 90;
                          return { x, y, item, idx };
                        })
                        .filter(Boolean) as { x: number; y: number; item: (typeof trendDays)[0]; idx: number }[];

                      if (pointsWithData.length < 2) return null;

                      const svgPath = pointsWithData
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`)
                        .join(' ');

                      return (
                        <path
                          d={svgPath}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-300 drop-shadow-xs"
                        />
                      );
                    })()}
                  </svg>

                  {/* Render node circles and hover tooltips */}
                  <div className="absolute inset-0 flex">
                    {trendDays.map((item, idx) => {
                      const hasEntry = item.score > 0;
                      const yPosPct = hasEntry ? 95 - ((item.score - 1) / 4) * 90 : 50;
                      const meta = item.mood ? moodMeta[item.mood] : null;

                      return (
                        <div
                          key={idx}
                          className="flex-1 relative h-full flex flex-col items-center group"
                        >
                          {hasEntry && (
                            <div
                              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-md transition-transform group-hover:scale-150 cursor-pointer -translate-y-1/2"
                              style={{
                                top: `${yPosPct}%`,
                                backgroundColor: meta ? meta.color : '#6366f1',
                              }}
                            >
                              {/* Hover tooltip */}
                              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-[11px] font-semibold pointer-events-none transition whitespace-nowrap z-20 shadow-xl flex items-center gap-1.5">
                                <span>{meta?.emoji}</span>
                                <span>{meta?.label}</span>
                                <span className="text-slate-400 font-normal">({item.label})</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Bar Mode
                <div className="absolute inset-0 flex items-end justify-between gap-1 sm:gap-1.5 px-1">
                  {trendDays.map((item, idx) => {
                    const hasEntry = item.score > 0;
                    const heightPct = hasEntry ? Math.max(12, Math.round((item.score / 5) * 100)) : 6;
                    const meta = item.mood ? moodMeta[item.mood] : null;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative"
                      >
                        <div
                          className={`w-full max-w-[24px] rounded-t-lg transition-all ${
                            hasEntry && meta ? 'shadow-xs' : 'bg-slate-100 dark:bg-slate-800/60'
                          }`}
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor: hasEntry && meta ? meta.color : undefined,
                          }}
                        >
                          {hasEntry && (
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[10px] font-medium pointer-events-none transition whitespace-nowrap z-20 shadow-lg flex items-center gap-1">
                              <span>{meta?.emoji}</span>
                              <span>{meta?.label}</span>
                              <span className="text-slate-400">({item.label})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* X-Axis Date Labels */}
          <div className="flex justify-between pl-10 text-[10px] text-slate-400 font-mono">
            {trendDays
              .filter((_, i) => i % Math.max(1, Math.floor(trendDays.length / 7)) === 0)
              .map((d, i) => (
                <span key={i}>{d.label}</span>
              ))}
          </div>
        </div>

        {/* Card 3: Mood Count Gauge & Goals (Screenshot 1) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-5">
          {/* Mood Count Arc Gauge */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smile className="w-4 h-4 text-purple-500" />
                <span>Mood Count</span>
              </h4>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                {timeHorizon.toUpperCase()}
              </span>
            </div>

            {/* Semicircle Arc Graphic with Center Total Number */}
            <div className="relative flex flex-col items-center justify-center pt-2">
              <svg className="w-48 h-28 overflow-visible" viewBox="0 0 200 110">
                {/* Background Arc */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="dark:stroke-slate-800"
                />

                {/* Segmented Color Arcs for the 5 moods */}
                {(() => {
                  const total = filteredEntries.length || 1;
                  const radCount = moodCounts.ecstatic + (moodCounts.great || 0);
                  const goodCount = moodCounts.good;
                  const mehCount = moodCounts.calm + (moodCounts.neutral || 0);
                  const badCount = moodCounts.anxious;
                  const awfulCount = moodCounts.down + (moodCounts.stressed || 0);

                  const segments = [
                    { count: radCount, color: '#10b981' }, // rad (emerald)
                    { count: goodCount, color: '#84cc16' }, // good (lime)
                    { count: mehCount, color: '#06b6d4' }, // meh (cyan)
                    { count: badCount, color: '#f59e0b' }, // bad (amber)
                    { count: awfulCount, color: '#ef4444' }, // awful (rose)
                  ];

                  const radius = 80;
                  const arcLength = Math.PI * radius; // 251.3
                  let accumulatedPct = 0;

                  return segments.map((seg, idx) => {
                    const pct = seg.count / total;
                    const strokeDash = pct * arcLength;
                    const strokeOffset = -accumulatedPct * arcLength;
                    accumulatedPct += pct;

                    if (seg.count === 0) return null;

                    return (
                      <path
                        key={idx}
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={`${strokeDash} ${arcLength}`}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>

              {/* Total Number in Center of Arch */}
              <div className="absolute top-10 flex flex-col items-center">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {filteredEntries.length}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Logs
                </span>
              </div>

              {/* 5 Circular Mood Badges with Counter Notification Pills (Screenshot 1) */}
              <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 w-full">
                {[
                  { label: 'rad', emoji: '🤩', count: moodCounts.ecstatic + (moodCounts.great || 0), bg: 'bg-emerald-500' },
                  { label: 'good', emoji: '😊', count: moodCounts.good, bg: 'bg-lime-500' },
                  { label: 'meh', emoji: '😐', count: moodCounts.calm + (moodCounts.neutral || 0), bg: 'bg-cyan-500' },
                  { label: 'bad', emoji: '🙁', count: moodCounts.anxious, bg: 'bg-amber-500' },
                  { label: 'awful', emoji: '😫', count: moodCounts.down + (moodCounts.stressed || 0), bg: 'bg-rose-500' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center group">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm shadow-2xs group-hover:scale-110 transition">
                        {item.emoji}
                      </div>
                      {/* Notification Count Badge */}
                      <span
                        className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold text-white px-1.5 py-0.2 rounded-full shadow-xs ${item.bg}`}
                      >
                        {item.count}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 mt-1 capitalize">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Goals & Habit Streaks (Screenshot 1) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                <span>Goals & Habit Streaks</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Synced with habits</span>
            </div>

            <div className="space-y-1.5">
              {(habits && habits.length > 0 ? habits.slice(0, 3) : [
                { id: '1', title: 'Exercise', streak: 1, color: '#10b981' },
                { id: '2', title: 'Daily Reading', streak: 4, color: '#6366f1' },
                { id: '3', title: 'Mindfulness Meditation', streak: 7, color: '#ec4899' },
              ]).map((h: any) => (
                <div
                  key={h.id}
                  className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {h.title}
                    </span>
                  </div>
                  <span className="font-bold text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-500" />
                    <span>{h.streak || 1}-Day Streak</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mood Distribution & Day-of-Week Habits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mood Balance Distribution */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Smile className="w-4 h-4 text-purple-500" />
            <span>Mood Distribution Spectrum</span>
          </h4>

          <div className="space-y-3">
            {(['ecstatic', 'good', 'calm', 'anxious', 'down'] as MoodType[]).map(m => {
              const meta = moodMeta[m];
              const count = moodCounts[m];
              const pct = filteredEntries.length > 0 ? Math.round((count / filteredEntries.length) * 100) : 0;

              return (
                <div key={m} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="font-mono text-slate-500">
                      {count} logs ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day-of-Week Journaling Pattern */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Weekly Journaling Rhythm</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reflection volume across each day of the week
            </p>
          </div>

          <div className="my-6 h-36 flex items-end justify-between gap-2">
            {dayOfWeekStats.map(item => (
              <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  style={{ height: `${item.heightPct}%` }}
                  className="w-full max-w-[28px] rounded-t-lg bg-indigo-500 dark:bg-indigo-600 hover:bg-indigo-400 transition-all relative group"
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono pointer-events-none transition z-10 whitespace-nowrap">
                    {item.count} logs
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{item.day}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            Consistency is key: Daily reflection builds emotional clarity and mental resilience.
          </div>
        </div>
      </div>

      {/* Top Reflection Tags & Gratitude Wall */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reflection Topics & Themes */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Themes & Tag Sentiment</span>
          </h4>
          <div className="space-y-2.5">
            {tagStats.length === 0 ? (
              <p className="text-xs text-slate-400">No tagged reflections yet.</p>
            ) : (
              tagStats.map(t => (
                <div
                  key={t.tag}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    #{t.tag}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono">{t.count} entries</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-bold">
                      ⭐ {t.avgScore}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gratitude Wall Highlights */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>Gratitude Reflections</span>
          </h4>
          <div className="space-y-2.5">
            {gratitudeHighlights.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                Add gratitude reflections using the Gratitude box in Journal to view them here!
              </div>
            ) : (
              gratitudeHighlights.map(g => (
                <div
                  key={g.id}
                  className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {g.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {g.date || g.createdAt.split('T')[0]}
                    </div>
                  </div>
                  <span className="text-sm shrink-0">
                    {moodMeta[g.mood]?.emoji || '✨'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
