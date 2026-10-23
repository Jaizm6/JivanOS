import React from 'react';
import { Flame, Check, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { IconRenderer } from '../../common/IconRenderer';
import { getFontInlineStyle, getFontTypeClass, getCardThemeStyles } from '../../../utils/activityStyles';
import { isHabitScheduledForDate, getHabitFrequencyLabel } from '../../../utils/habitSchedule';

export const HabitsWidget: React.FC = () => {
  const { habits, toggleHabitDay, setActiveTab } = useApp();
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-100/60 dark:border-amber-900/60 shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Daily Habits & Streaks</span>
            <span className="text-[9.5px] font-medium font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/50 hidden sm:inline">
              {habits.length} Active
            </span>
          </span>
        </div>
        <button
          onClick={() => setActiveTab('habits')}
          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition"
        >
          <span>All Habits</span>
          <Sparkles className="w-3 h-3" />
        </button>
      </div>

      <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto">
        {habits.map(habit => {
          const isDoneToday = !!habit.completionHistory[todayStr];
          const isScheduledToday = isHabitScheduledForDate(habit, todayStr);
          const freqLabel = getHabitFrequencyLabel(habit);

          const habitAccent = habit.accentColor || habit.color || '#10b981';
          const themeStyles = getCardThemeStyles(habitAccent, 'clean');
          const fontInlineStyle = getFontInlineStyle({
            fontColor: habit.fontColor,
            fallbackColor: habit.fontColor ? habit.fontColor : undefined,
            isBold: habit.isBold,
          });

          return (
            <div
              key={habit.id}
              style={isDoneToday ? undefined : themeStyles.cardStyle}
              className={`p-2.5 sm:p-3 rounded-xl transition flex items-center justify-between gap-3 shadow-2xs ${
                !isScheduledToday
                  ? 'opacity-50 grayscale-[30%] bg-slate-100/70 dark:bg-zinc-900/50'
                  : isDoneToday
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  id={`btn-toggle-habit-${habit.id}`}
                  onClick={() => toggleHabitDay(habit.id, todayStr)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 ${
                    isDoneToday
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                  }`}
                >
                  {isDoneToday && <Check className="w-4 h-4" />}
                </button>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold border"
                  style={themeStyles.iconBox}
                >
                  <IconRenderer icon={habit.icon} className="w-3.5 h-3.5" fallback="🎯" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-sans font-semibold truncate ${
                      isDoneToday ? 'line-through opacity-75' : ''
                    }`}
                    style={fontInlineStyle}
                  >
                    {habit.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="uppercase font-bold tracking-wider">
                      {habit.tags && habit.tags.length > 0 ? `#${habit.tags[0]}` : habit.category}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-500 dark:text-zinc-400">{freqLabel}</span>
                    {!isScheduledToday && (
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100/80 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                        Off Day
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Streak badge */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-400 text-xs font-bold shrink-0">
                <Flame className="w-3 h-3 fill-current" />
                <span>{habit.currentStreak} d</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
