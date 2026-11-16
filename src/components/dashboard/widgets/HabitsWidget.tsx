import React from 'react';
import { Flame, Check, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { IconRenderer } from '../../common/IconRenderer';
import { getFontInlineStyle, getFontTypeClass, getCardThemeStyles, getSafeFontColor } from '../../../utils/activityStyles';
import { isHabitScheduledForDate, getHabitFrequencyLabel } from '../../../utils/habitSchedule';
import { PetalShapeBadge, getHabitExpressiveShape } from '../../common/PetalExpressive';
import { formatTagLabel } from '../../common/TagVisuals';

export const HabitsWidget: React.FC = () => {
  const { habits, toggleHabitDay, setActiveTab, theme } = useApp();
  const isDarkMode = theme === 'dark';
  const todayStr = new Date().toISOString().split('T')[0];
  const activeHabits = habits.filter(h => !h.archived);

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
              {activeHabits.length} Active
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
        {activeHabits.map((habit, habitIdx) => {
          const isDoneToday = !!habit.completionHistory[todayStr];
          const isScheduledToday = isHabitScheduledForDate(habit, todayStr);
          const freqLabel = getHabitFrequencyLabel(habit);

          const habitAccent = habit.accentColor || habit.color || '#10b981';
          const themeStyles = getCardThemeStyles(habitAccent, 'clean');
          const safeFontColor = getSafeFontColor(habit.fontColor, isDarkMode);
          const fontInlineStyle = getFontInlineStyle({
            fontColor: safeFontColor,
            fallbackColor: safeFontColor ? safeFontColor : undefined,
            isBold: habit.isBold,
          }, isDarkMode);

          return (
            <div
              key={habit.id}
              style={themeStyles.cardStyle}
              className={`p-2 sm:p-2.5 rounded-xl transition flex items-center justify-between gap-2.5 shadow-2xs ${
                !isScheduledToday
                  ? 'opacity-50 grayscale-[30%] bg-slate-100/70 dark:bg-zinc-900/50'
                  : isDoneToday
                    ? 'bg-[#f8fafd] dark:bg-[#0f1219]'
                    : 'bg-white dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  id={`btn-toggle-habit-${habit.id}`}
                  onClick={() => toggleHabitDay(habit.id, todayStr)}
                  style={
                    isDoneToday
                      ? { backgroundColor: habitAccent === '#ffffff' ? '#4f46e5' : habitAccent }
                      : undefined
                  }
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                    isDoneToday
                      ? 'text-white shadow-xs'
                      : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                  }`}
                >
                  {isDoneToday && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                </button>
                <PetalShapeBadge
                  shape={getHabitExpressiveShape(habit.id, habitIdx)}
                  sizeClass="w-8 h-8"
                  fillColor={themeStyles.iconBox.backgroundColor as string | undefined}
                  strokeColor={themeStyles.iconBox.borderColor as string | undefined}
                >
                  <span style={{ color: themeStyles.iconBox.color }}>
                    <IconRenderer icon={habit.icon} className="w-3.5 h-3.5" fallback="🎯" />
                  </span>
                </PetalShapeBadge>
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
                    <span className="font-bold tracking-tight">
                      {habit.tags && habit.tags.length > 0 ? formatTagLabel(habit.tags[0]) : habit.category}
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
