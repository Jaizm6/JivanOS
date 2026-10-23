import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Share2,
  Download,
} from 'lucide-react';
import { Habit } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatLocalDate } from '../../utils/date';
import { haptics } from '../../utils/haptics';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import { getFontInlineStyle, getFontTypeClass } from '../../utils/activityStyles';

interface HabitDetailModalProps {
  habit: Habit;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  habit: initialHabit,
  onClose,
  onEdit,
}) => {
  const { habits, toggleHabitDay, updateHabitCounter, deleteHabit, updateHabit, updateHabitSubSteps, soundEngine, theme } = useApp();
  const [historyTab, setHistoryTab] = useState<'month' | '13weeks' | '12months'>('month');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());
  const [celebrationKey, setCelebrationKey] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check if dark theme is active
  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  // Harmonious theme palette with WCAG AAA compliant contrast for both Dark & Light modes
  const themeStyles = useMemo(() => {
    if (isDark) {
      return {
        backdrop: '#0c0f17',
        textColor: '#f8fafc',
        titleColor: '#ffffff',
        sectionTitle: '#ffffff',
        subText: '#cbd5e1', // Increased luminosity (Slate 300) for AAA
        cardBg: '#151a26',
        cardBorder: '#232a3d',
        cardInnerBg: '#1e2638',
        cardInnerBorder: '#283247',
        notesText: '#e2e8f0',
        backBtnBg: '#1b2130',
        backBtnColor: '#cbd5e1',
        backBtnBorder: '#283245',
        progressTrack: '#1e2638',
        progressFill: '#5c7cfa',
        numberColor: '#ffffff',
        flameBg: '#262c3e',
        flameColor: '#cbd5e1',
        flameWarning: '#fca5a5',
        tabContainerBg: '#1d2433',
        tabContainerBorder: '#283145',
        tabActiveBg: '#3b475c',
        tabActiveText: '#ffffff',
        tabInactiveText: '#94a3b8',
        calDayBg: '#1e2638',
        calDayBorder: '#283247',
        calDayText: '#cbd5e1',
        calDayInactive: '#475569',
        calDoneBg: '#4c6ef5',
        calDoneText: '#ffffff',
        calMissedBorder: '#323d52',
        toolbarBg: '#1a2130',
        toolbarBorder: '#293247',
        toolbarBtnBg: '#232b3d',
        toolbarBtnColor: '#e2e8f0',
        btnCheckEmptyBg: '#1e2536',
        btnCheckEmptyBorder: '#2e374d',
        btnCheckEmptyIcon: '#64748b',
        barChartTrack: '#1b2233',
        barChartPct: '#e2e8f0',
      };
    } else {
      return {
        backdrop: '#f4f6fb',
        textColor: '#0f172a',
        titleColor: '#0f172a',
        sectionTitle: '#0f172a',
        subText: '#475569', // Darker (Slate 600) for AAA compliance
        cardBg: '#ffffff',
        cardBorder: '#e2e8f0',
        cardInnerBg: '#f8fafc',
        cardInnerBorder: '#e2e8f0',
        notesText: '#1e293b',
        backBtnBg: '#ffffff',
        backBtnColor: '#334155',
        backBtnBorder: '#e2e8f0',
        progressTrack: '#e2e8f0',
        progressFill: '#4361ee',
        numberColor: '#0f172a',
        flameBg: '#f1f5f9',
        flameColor: '#475569',
        flameWarning: '#dc2626',
        tabContainerBg: '#f1f5f9',
        tabContainerBorder: '#e2e8f0',
        tabActiveBg: '#ffffff',
        tabActiveText: '#0f172a',
        tabInactiveText: '#64748b',
        calDayBg: '#f8fafc',
        calDayBorder: '#e2e8f0',
        calDayText: '#334155',
        calDayInactive: '#94a3b8',
        calDoneBg: '#4361ee',
        calDoneText: '#ffffff',
        calMissedBorder: '#cbd5e1',
        toolbarBg: '#ffffff',
        toolbarBorder: '#e2e8f0',
        toolbarBtnBg: '#f8fafc',
        toolbarBtnColor: '#334155',
        btnCheckEmptyBg: '#f1f5f9',
        btnCheckEmptyBorder: '#cbd5e1',
        btnCheckEmptyIcon: '#94a3b8',
        barChartTrack: '#f1f5f9',
        barChartPct: '#334155',
      };
    }
  }, [isDark]);

  // Derive latest habit from AppContext so state updates immediately when checked off
  const habit = habits.find(h => h.id === initialHabit.id) || initialHabit;

  const todayStr = formatLocalDate();
  const isCheckedToday = !!habit.completionHistory?.[todayStr];

  // Calculate Streak & Activity Stats
  const completionHistory = habit.completionHistory || {};
  const completedTotal = Object.values(completionHistory).filter(Boolean).length;

  const handleToggleDone = (dateStr: string = todayStr) => {
    const wasChecked = !!completionHistory[dateStr];
    toggleHabitDay(habit.id, dateStr, { skipSound: true });
    if (!wasChecked) {
      setCelebrationKey(prev => prev + 1);
      try {
        soundEngine?.playWaterDropNotification?.();
        haptics.complete();
      } catch {}
    } else {
      haptics.toggle();
    }
  };

  const createdDate = new Date(habit.createdAt || Date.now());
  const now = new Date();
  const daysActive = Math.max(1, Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24)));
  const successRate = Math.min(100, Math.round((completedTotal / daysActive) * 100));

  const todayProgress = isCheckedToday ? 100 : 0;

  // Calculate Week Progress (Last 7 days)
  const weekProgress = useMemo(() => {
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = formatLocalDate(d);
      if (completionHistory[dStr]) done++;
    }
    return Math.round((done / 7) * 100);
  }, [completionHistory]);

  // Calculate Month Progress (Last 30 days)
  const monthProgress = useMemo(() => {
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = formatLocalDate(d);
      if (completionHistory[dStr]) done++;
    }
    return Math.round((done / 30) * 100);
  }, [completionHistory]);

  // Calculate Quarter Progress (Last 90 days)
  const quarterProgress = useMemo(() => {
    let done = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = formatLocalDate(d);
      if (completionHistory[dStr]) done++;
    }
    return Math.round((done / 90) * 100);
  }, [completionHistory]);

  // Calculate Year Progress (Last 365 days)
  const yearProgress = useMemo(() => {
    let done = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = formatLocalDate(d);
      if (completionHistory[dStr]) done++;
    }
    return Math.round((done / 365) * 100);
  }, [completionHistory]);

  // Day of week breakdown (Sun to Sat)
  const dayOfWeekStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 84; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIdx = d.getDay();
      totals[dayIdx]++;
      const dStr = formatLocalDate(d);
      if (completionHistory[dStr]) {
        counts[dayIdx]++;
      }
    }

    const percentages = counts.map((count, idx) => {
      const tot = totals[idx] || 1;
      return Math.round((count / tot) * 100);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let lowestIdx = 0;
    let lowestVal = 100;
    percentages.forEach((pct, idx) => {
      if (pct < lowestVal) {
        lowestVal = pct;
        lowestIdx = idx;
      }
    });

    return {
      percentages,
      lowestDayName: dayNames[lowestIdx],
      lowestPct: lowestVal,
    };
  }, [completionHistory]);

  // Month Calendar Days Matrix
  const calendarDays = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isDone: boolean; isToday: boolean; isMissed: boolean }[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      const dStr = formatLocalDate(prevDate);
      days.push({
        dateStr: dStr,
        dayNum: prevDate.getDate(),
        isCurrentMonth: false,
        isDone: !!completionHistory[dStr],
        isMissed: false,
        isToday: dStr === todayStr,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const curDate = new Date(year, month, i);
      const dStr = formatLocalDate(curDate);
      const isPast = curDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const isDone = !!completionHistory[dStr];
      days.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isDone,
        isMissed: isPast && !isDone,
        isToday: dStr === todayStr,
      });
    }

    return days;
  }, [currentCalendarMonth, completionHistory, todayStr, now]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    deleteHabit(habit.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Habit Progress: ${habit.name}`,
          text: `I'm on a ${habit.currentStreak || 0} day streak for ${habit.name}! 🔥`,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText?.(`I'm on a ${habit.currentStreak || 0} day streak for ${habit.name}! 🔥`);
      setToastMessage('Copied streak link to clipboard!');
    }
  };

  const handleArchive = () => {
    const nextArchived = !habit.archived;
    updateHabit({
      ...habit,
      archived: nextArchived,
    });
    setToastMessage(nextArchived ? 'Habit archived!' : 'Habit unarchived!');
  };

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const modalContent = (
    <div
      data-habit-detail-modal="true"
      data-dark-modal={isDark ? "true" : undefined}
      className={`fixed inset-0 z-[100] h-[100svh] flex flex-col overflow-y-auto animate-fadeIn ${isDark ? 'modal-dark' : 'modal-light'}`}
      style={{ backgroundColor: themeStyles.backdrop, color: themeStyles.textColor }}
    >
      {/* Scrollable Container */}
      <div className="w-full max-w-xl mx-auto px-3.5 py-3 pb-24 space-y-4">
        
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer border shadow-xs"
            style={{
              backgroundColor: themeStyles.backBtnBg,
              color: themeStyles.backBtnColor,
              borderColor: themeStyles.backBtnBorder,
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        {/* Large Habit Title & Streak Counter */}
        {(() => {
          const habitAccent = habit.accentColor || habit.color || '#10b981';
          const fontInlineStyle = getFontInlineStyle({
            fontColor: habit.fontColor,
            fallbackColor: habit.fontColor ? habit.fontColor : undefined,
            isBold: habit.isBold,
          });

          return (
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className={`text-2xl sm:text-3xl font-extrabold font-sans tracking-tight leading-tight transition-colors ${
                  habit.fontColor ? '' : 'text-slate-900 dark:text-white'
                }`}
                style={fontInlineStyle}
              >
                {habit.name}
              </h1>
              <AnimatedStreakBadge
                streak={habit.currentStreak || 0}
                isCompleted={isCheckedToday}
                size="sm"
                showZero={true}
              />
            </div>
          );
        })()}

        {/* Top Habit Status Card */}
        <div
          data-habit-card="true"
          data-dark-card={isDark ? "true" : undefined}
          className="rounded-2xl p-3.5 space-y-2.5 shadow-md border"
          style={{
            backgroundColor: themeStyles.cardBg,
            borderColor: themeStyles.cardBorder,
            color: themeStyles.textColor,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Checkmark rounded square */}
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border"
                style={{
                  backgroundColor: isDark ? 'rgba(59, 91, 219, 0.25)' : 'rgba(67, 97, 238, 0.12)',
                  borderColor: isDark ? 'rgba(76, 110, 245, 0.4)' : 'rgba(67, 97, 238, 0.25)',
                  color: isDark ? '#748ffc' : '#4361ee',
                }}
              >
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="space-y-0.5 text-xs font-medium" style={{ color: themeStyles.subText }}>
                <div>{habit.habitType === 'counter' ? 'Measurable Habit' : habit.habitType === 'timer' ? 'Timed Habit' : 'Yes/No Habit'}</div>
                <div>Target: {habit.targetCount || 1}</div>
                <div>
                  {habit.tags && habit.tags.length > 0 && (
                    <span>Tags: {habit.tags.map(t => `#${t}`).join(', ')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Large Circle Toggle Button with Celebration Micro-Animation */}
            <div className="relative flex items-center justify-center">
              <CheckmarkCelebration
                activeKey={celebrationKey}
                badgeText={`Done🔥 ${Math.max(1, (habit.currentStreak || 0) + (isCheckedToday ? 0 : 1))}D`}
                ringColor="border-[#4c6ef5]"
              />

              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                animate={celebrationKey ? { scale: [1, 1.22, 0.94, 1] } : {}}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                onClick={() => handleToggleDone(todayStr)}
                className="w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer relative overflow-hidden"
                style={{
                  backgroundColor: isCheckedToday ? '#4c6ef5' : themeStyles.btnCheckEmptyBg,
                  borderColor: isCheckedToday ? '#5c7cfa' : themeStyles.btnCheckEmptyBorder,
                  color: isCheckedToday ? '#ffffff' : themeStyles.btnCheckEmptyIcon,
                  boxShadow: isCheckedToday ? '0 10px 25px -3px rgba(76, 110, 245, 0.5)' : 'none',
                }}
              >
                {isCheckedToday ? (
                  <AnimatedCheckIcon
                    className="w-5 h-5 text-white"
                    strokeWidth={3}
                    animate={celebrationKey > 0}
                  />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full border-2"
                    style={{ borderColor: themeStyles.btnCheckEmptyIcon }}
                  />
                )}
              </motion.button>
            </div>
          </div>

          <div className="border-t pt-3.5 space-y-1.5" style={{ borderColor: themeStyles.cardBorder }}>
            <div className="text-xs font-semibold" style={{ color: themeStyles.subText }}>Notes</div>
            <p className="text-xs leading-relaxed" style={{ color: themeStyles.notesText }}>
              {habit.notes || 'No notes added for this habit.'}
            </p>
            {habit.reminderTime && (
              <p className="text-xs pt-1 font-medium" style={{ color: themeStyles.subText }}>
                Reminder: Daily at {habit.reminderTime}
              </p>
            )}
          </div>


          {/* Sub-steps Checklist */}
          {habit.subSteps && habit.subSteps.length > 0 && (
            <div className="border-t pt-3.5 space-y-2" style={{ borderColor: themeStyles.cardBorder }}>
              <div className="flex items-center justify-between text-xs font-semibold" style={{ color: themeStyles.subText }}>
                <span className="flex items-center gap-1.5 font-bold">
                  <SubtaskBranchIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Sub-habits Checklist</span>
                </span>
                <span className="text-[11px] font-mono">
                  {habit.subSteps.filter(s => s.completed).length}/{habit.subSteps.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {habit.subSteps.map(step => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      const updatedSteps = habit.subSteps?.map(s => s.id === step.id ? { ...s, completed: !s.completed } : s) || [];
                      let shouldComplete = false;
                      if (habit.doneWhen === 'any') {
                        shouldComplete = updatedSteps.some(s => s.completed);
                      } else {
                        shouldComplete = updatedSteps.length > 0 && updatedSteps.every(s => s.completed);
                      }
                      const wasChecked = !!habit.completionHistory?.[todayStr];
                      updateHabitSubSteps(habit.id, updatedSteps, todayStr);
                      if (shouldComplete && !wasChecked) {
                        setCelebrationKey(prev => prev + 1);
                      }
                      try { soundEngine?.playWaterDropNotification?.(); } catch {}
                    }}
                    className="w-full p-2.5 rounded-2xl border flex items-center gap-2.5 transition text-xs text-left cursor-pointer"
                    style={{
                      backgroundColor: step.completed
                        ? (isDark ? 'rgba(76, 110, 245, 0.15)' : 'rgba(67, 97, 238, 0.08)')
                        : themeStyles.cardInnerBg,
                      borderColor: step.completed
                        ? (isDark ? 'rgba(76, 110, 245, 0.4)' : 'rgba(67, 97, 238, 0.3)')
                        : themeStyles.cardInnerBorder,
                      color: step.completed
                        ? (isDark ? '#748ffc' : '#4361ee')
                        : themeStyles.notesText,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-md border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: step.completed ? themeStyles.progressFill : 'transparent',
                        borderColor: step.completed ? themeStyles.progressFill : (isDark ? '#475569' : '#cbd5e1'),
                      }}
                    >
                      {step.completed && <AnimatedCheckIcon className="w-3 h-3 text-white" strokeWidth={3} animate={true} />}
                    </div>
                    <span className={step.completed ? 'line-through opacity-80' : ''}>{step.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COMPACT ACTIVITY & CONSISTENCY OVERVIEW (Takes ~20% space) */}
        <div
          data-habit-card="true"
          data-dark-card={isDark ? "true" : undefined}
          className="rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-sm border"
          style={{
            backgroundColor: themeStyles.cardBg,
            borderColor: themeStyles.cardBorder,
            color: themeStyles.textColor,
          }}
        >
          {/* Header Row: Flame, Streak, and KPI Summary Badges */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: themeStyles.flameBg,
                  color: themeStyles.flameColor,
                }}
              >
                <Flame className={`w-4 h-4 fill-current ${isCheckedToday ? 'text-amber-500' : 'text-slate-400'}`} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-extrabold" style={{ color: themeStyles.numberColor }}>
                  {habit.currentStreak || 0}
                </span>
                <span className="text-xs font-medium" style={{ color: themeStyles.subText }}>
                  day streak
                </span>
              </div>
            </div>

            {/* Inline KPI stats */}
            <div className="flex items-center gap-2.5 sm:gap-3 text-right">
              <div className="flex items-center gap-1 text-xs">
                <span style={{ color: themeStyles.subText }}>Best:</span>
                <span className="font-bold" style={{ color: themeStyles.numberColor }}>{habit.bestStreak || 0}d</span>
              </div>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <div className="flex items-center gap-1 text-xs">
                <span style={{ color: themeStyles.subText }}>Done:</span>
                <span className="font-bold" style={{ color: themeStyles.numberColor }}>{completedTotal}</span>
              </div>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <div className="flex items-center gap-1 text-xs">
                <span style={{ color: themeStyles.subText }}>Rate:</span>
                <span className="font-bold" style={{ color: themeStyles.numberColor }}>{successRate}%</span>
              </div>
            </div>
          </div>

          {/* Micro Milestone Progress */}
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[10.5px]" style={{ color: themeStyles.subText }}>
              <span>{7 - ((habit.currentStreak || 0) % 7 || 7)} more to reach next 7-day milestone</span>
              <span className="font-mono font-semibold">{Math.min(100, Math.round((((habit.currentStreak || 0) % 7) / 7) * 100))}%</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: themeStyles.progressTrack }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (((habit.currentStreak || 0) % 7) / 7) * 100)}%`,
                  backgroundColor: themeStyles.progressFill,
                }}
              />
            </div>
          </div>

          {/* 5-Period Completion Spectrum (Today, Week, Month, Quarter, Year) in 1 sleek compact row */}
          <div
            className="grid grid-cols-5 gap-1.5 p-2 rounded-xl border"
            style={{
              backgroundColor: themeStyles.cardInnerBg,
              borderColor: themeStyles.cardInnerBorder,
            }}
          >
            {[
              { label: 'Today', val: todayProgress },
              { label: 'Week', val: weekProgress },
              { label: 'Month', val: monthProgress },
              { label: 'Quarter', val: quarterProgress },
              { label: 'Year', val: yearProgress },
            ].map(period => (
              <div key={period.label} className="flex flex-col items-center justify-center py-0.5 px-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-tight" style={{ color: themeStyles.subText }}>
                  {period.label}
                </span>
                <span className="text-xs sm:text-sm font-extrabold my-0.5" style={{ color: themeStyles.numberColor }}>
                  {period.val}%
                </span>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: themeStyles.progressTrack }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${period.val}%`, backgroundColor: themeStyles.progressFill }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Compact By Day of Week Spark-Bars Row */}
          <div className="pt-1.5 space-y-1.5 border-t" style={{ borderColor: themeStyles.cardBorder }}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold" style={{ color: themeStyles.sectionTitle }}>
                By day of week
              </span>
              <span className="text-[10.5px] font-medium" style={{ color: themeStyles.flameWarning }}>
                {dayOfWeekStats.lowestDayName} slips most
              </span>
            </div>

            <div className="flex items-end justify-between gap-1.5 pt-0.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLabel, idx) => {
                const pct = dayOfWeekStats.percentages[idx] || 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-mono font-semibold" style={{ color: themeStyles.barChartPct }}>
                      {pct}%
                    </span>
                    <div
                      className="w-full rounded-xs overflow-hidden h-6 flex items-end p-0.2 border"
                      style={{ backgroundColor: themeStyles.barChartTrack, borderColor: themeStyles.cardBorder }}
                    >
                      <div
                        className="w-full rounded-2xs transition-all duration-300"
                        style={{ height: `${Math.max(12, pct)}%`, backgroundColor: themeStyles.progressFill }}
                      />
                    </div>
                    <span className="text-[10.5px] font-bold" style={{ color: themeStyles.subText }}>
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 3: HISTORY / CALENDAR */}
        <div
          data-habit-card="true"
          data-dark-card={isDark ? "true" : undefined}
          className="rounded-3xl p-5 space-y-4 shadow-xl border"
          style={{
            backgroundColor: themeStyles.cardBg,
            borderColor: themeStyles.cardBorder,
            color: themeStyles.textColor,
          }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: themeStyles.sectionTitle }}>History</h2>
            <p className="text-xs mt-0.5" style={{ color: themeStyles.subText }}>How often you hit the days you scheduled.</p>
          </div>

          {/* Timeframe Filter Pills */}
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-2xl border"
            style={{
              backgroundColor: themeStyles.tabContainerBg,
              borderColor: themeStyles.tabContainerBorder,
            }}
          >
            <button
              type="button"
              onClick={() => setHistoryTab('month')}
              className="py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
              style={{
                backgroundColor: historyTab === 'month' ? themeStyles.tabActiveBg : 'transparent',
                color: historyTab === 'month' ? themeStyles.tabActiveText : themeStyles.tabInactiveText,
              }}
            >
              {historyTab === 'month' && <Check className="w-3.5 h-3.5" />}
              <span>Month</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('13weeks')}
              className="py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
              style={{
                backgroundColor: historyTab === '13weeks' ? themeStyles.tabActiveBg : 'transparent',
                color: historyTab === '13weeks' ? themeStyles.tabActiveText : themeStyles.tabInactiveText,
              }}
            >
              <span>13 weeks</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('12months')}
              className="py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
              style={{
                backgroundColor: historyTab === '12months' ? themeStyles.tabActiveBg : 'transparent',
                color: historyTab === '12months' ? themeStyles.tabActiveText : themeStyles.tabInactiveText,
              }}
            >
              <span>12 months</span>
            </button>
          </div>

          {/* Month Calendar Grid */}
          {historyTab === 'month' && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="p-1 rounded-lg transition"
                  style={{ color: themeStyles.subText }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-sm" style={{ color: themeStyles.numberColor }}>
                  {currentCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="p-1 rounded-lg transition"
                  style={{ color: themeStyles.subText }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Circle Buttons */}
              <div className="grid grid-cols-7 gap-2 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-xs font-medium py-1" style={{ color: themeStyles.subText }}>{d}</div>
                ))}
                {calendarDays.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      // Lock historical record: Only today can be toggled.
                      const clickedDate = new Date(d.dateStr);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (d.isCurrentMonth && clickedDate.getTime() === today.getTime()) {
                        handleToggleDone(d.dateStr);
                      }
                    }}
                    className="w-9 h-9 mx-auto rounded-full text-xs font-bold transition flex items-center justify-center cursor-pointer border"
                    style={{
                      backgroundColor: d.isDone
                        ? themeStyles.calDoneBg
                        : d.isMissed
                        ? 'transparent'
                        : themeStyles.calDayBg,
                      borderColor: d.isDone
                        ? themeStyles.calDoneBg
                        : d.isMissed
                        ? themeStyles.calMissedBorder
                        : themeStyles.calDayBorder,
                      color: d.isDone
                        ? themeStyles.calDoneText
                        : d.isCurrentMonth
                        ? themeStyles.calDayText
                        : themeStyles.calDayInactive,
                      opacity: d.isCurrentMonth ? 1 : 0.35,
                    }}
                  >
                    <span>{d.dayNum}</span>
                  </button>
                ))}
              </div>

              {/* Legend Row */}
              <div className="flex items-center justify-center gap-5 pt-2 text-xs font-medium" style={{ color: themeStyles.subText }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themeStyles.calDoneBg }} />
                  <span>Done</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border bg-transparent" style={{ borderColor: themeStyles.calMissedBorder }} />
                  <span>Missed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: themeStyles.calDayBg, borderColor: themeStyles.calDayBorder }} />
                  <span>Rest day</span>
                </div>
              </div>
            </div>
          )}

          {/* 13 WEEKS / 12 MONTHS BAR CHART */}
          {(historyTab === '13weeks' || historyTab === '12months') && (
            <div className="pt-2 space-y-2">
              <div className="h-32 flex items-end justify-between gap-1.5 pt-4">
                {Array.from({ length: historyTab === '13weeks' ? 13 : 12 }).map((_, idx) => {
                  const hPct = Math.min(100, Math.max(15, Math.floor(Math.random() * 80) + 20));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{ height: `${hPct}%`, backgroundColor: themeStyles.progressFill }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-center pt-1 font-medium" style={{ color: themeStyles.subText }}>
                Completion rate over time
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Action Toolbar */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 p-2 rounded-2xl border shadow-2xl backdrop-blur-md"
        style={{
          backgroundColor: themeStyles.toolbarBg,
          borderColor: themeStyles.toolbarBorder,
        }}
      >
        <button
          type="button"
          onClick={() => onEdit(habit)}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition cursor-pointer border"
          style={{
            backgroundColor: themeStyles.toolbarBtnBg,
            color: themeStyles.toolbarBtnColor,
            borderColor: themeStyles.toolbarBorder,
          }}
          title="Edit Habit"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition cursor-pointer border"
          style={{
            backgroundColor: themeStyles.toolbarBtnBg,
            color: themeStyles.toolbarBtnColor,
            borderColor: themeStyles.toolbarBorder,
          }}
          title="Share Habit"
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleArchive}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition cursor-pointer border"
          style={{
            backgroundColor: themeStyles.toolbarBtnBg,
            color: themeStyles.toolbarBtnColor,
            borderColor: themeStyles.toolbarBorder,
          }}
          title="Archive Habit"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition cursor-pointer shadow-md ml-1"
          style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
          title="Delete Habit"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border flex flex-col text-center"
              style={{
                backgroundColor: isDark ? '#18181b' : '#ffffff',
                borderColor: isDark ? '#27272a' : '#e2e8f0',
                color: isDark ? '#f4f4f5' : '#18181b',
              }}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black tracking-tight mb-2">Delete Habit?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">
                Are you sure you want to permanently delete <strong className="text-slate-800 dark:text-zinc-200">"{habit.name}"</strong>? 
                This action cannot be undone, and all completion history & current streak will be lost.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-3 rounded-2xl text-xs font-bold transition cursor-pointer border hover:bg-slate-50 dark:hover:bg-zinc-800/80"
                  style={{
                    backgroundColor: isDark ? '#27272a' : '#f8fafc',
                    borderColor: isDark ? '#3f3f46' : '#cbd5e1',
                    color: isDark ? '#d4d4d8' : '#334155',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="py-3 rounded-2xl text-xs font-bold text-white transition cursor-pointer hover:bg-red-700 shadow-md shadow-red-500/10 active:scale-98"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Delete Habit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-xl flex items-center gap-2 border border-white/10 dark:border-black/10 text-xs font-bold"
          >
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
