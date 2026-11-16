import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Share2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Habit } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatLocalDate } from '../../utils/date';
import { haptics } from '../../utils/haptics';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import { IconRenderer } from '../common/IconRenderer';
import { getFontInlineStyle, getSafeFontColor } from '../../utils/activityStyles';
import { InlineTagMeta } from '../common/TagVisuals';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import { FORM_SPRING, FORM_EXIT_TRANSITION } from '../common/FormPrimitives';

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
  const { habits, tags = [], toggleHabitDay, deleteHabit, updateHabit, updateHabitSubSteps, soundEngine, theme } = useApp();
  const [historyTab, setHistoryTab] = useState<'month' | '13weeks' | '12months'>('month');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());
  const [celebrationKey, setCelebrationKey] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const themeStyles = useMemo(() => {
    if (isDark) {
      return {
        backdrop: '#050507',
        textColor: '#f4f4f5',
        titleColor: '#ffffff',
        sectionTitle: '#ffffff',
        subText: '#a1a1aa',
        cardBg: '#0c0c0f',
        cardBorder: '#27272a',
        cardInnerBg: '#141418',
        cardInnerBorder: '#27272a',
        notesText: '#e4e4e7',
        backBtnBg: '#18181b',
        backBtnColor: '#f4f4f5',
        backBtnBorder: '#27272a',
        progressTrack: '#1f1f25',
        progressFill: '#5c7cfa',
        numberColor: '#ffffff',
        flameBg: '#18181b',
        flameColor: '#f4f4f5',
        flameWarning: '#fca5a5',
        tabContainerBg: '#141418',
        tabContainerBorder: '#27272a',
        tabActiveBg: '#27272a',
        tabActiveText: '#ffffff',
        tabInactiveText: '#a1a1aa',
        calDayBg: '#141418',
        calDayBorder: '#27272a',
        calDayText: '#f4f4f5',
        calDayInactive: '#52525b',
        calDoneBg: '#4c6ef5',
        calDoneText: '#ffffff',
        calMissedBorder: '#3f3f46',
        toolbarBg: 'rgba(12, 12, 15, 0.96)',
        toolbarBorder: '#27272a',
        toolbarBtnBg: '#18181b',
        toolbarBtnColor: '#f4f4f5',
        btnCheckEmptyBg: '#141418',
        btnCheckEmptyBorder: '#3f3f46',
        btnCheckEmptyIcon: '#71717a',
        barChartTrack: '#18181b',
        barChartPct: '#e4e4e7',
      };
    } else {
      return {
        backdrop: '#f4f6fb',
        textColor: '#0f172a',
        titleColor: '#0f172a',
        sectionTitle: '#0f172a',
        subText: '#475569',
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
        toolbarBg: 'rgba(255, 255, 255, 0.96)',
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

  const habit = habits.find(h => h.id === initialHabit.id) || initialHabit;
  const todayStr = formatLocalDate();
  const isCheckedToday = !!habit.completionHistory?.[todayStr];
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

  const periodProgress = (days: number) => {
    let done = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (completionHistory[formatLocalDate(d)]) done++;
    }
    return Math.round((done / days) * 100);
  };

  const weekProgress = useMemo(() => periodProgress(7), [completionHistory]);
  const monthProgress = useMemo(() => periodProgress(30), [completionHistory]);
  const quarterProgress = useMemo(() => periodProgress(90), [completionHistory]);
  const yearProgress = useMemo(() => periodProgress(365), [completionHistory]);

  const dayOfWeekStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 84; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIdx = d.getDay();
      totals[dayIdx]++;
      if (completionHistory[formatLocalDate(d)]) {
        counts[dayIdx]++;
      }
    }

    const percentages = counts.map((count, idx) => Math.round((count / (totals[idx] || 1)) * 100));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let lowestIdx = 0;
    let lowestVal = 101;
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

  // Real 13-week historical breakdown
  const thirteenWeeksData = useMemo(() => {
    const weeks: { label: string; pct: number }[] = [];
    for (let w = 12; w >= 0; w--) {
      let done = 0;
      for (let dOffset = 0; dOffset < 7; dOffset++) {
        const d = new Date();
        d.setDate(d.getDate() - (w * 7 + dOffset));
        if (completionHistory[formatLocalDate(d)]) done++;
      }
      weeks.push({
        label: w === 0 ? 'Now' : `-${w}w`,
        pct: Math.round((done / 7) * 100),
      });
    }
    return weeks;
  }, [completionHistory]);

  // Real 12-month historical breakdown
  const twelveMonthsData = useMemo(() => {
    const months: { label: string; pct: number }[] = [];
    const base = new Date();
    for (let m = 11; m >= 0; m--) {
      const target = new Date(base.getFullYear(), base.getMonth() - m, 1);
      const year = target.getFullYear();
      const month = target.getMonth();
      const daysInM = new Date(year, month + 1, 0).getDate();
      let done = 0;
      for (let day = 1; day <= daysInM; day++) {
        const dStr = formatLocalDate(new Date(year, month, day));
        if (completionHistory[dStr]) done++;
      }
      months.push({
        label: target.toLocaleDateString('en-US', { month: 'short' }).slice(0, 1),
        pct: Math.round((done / daysInM) * 100),
      });
    }
    return months;
  }, [completionHistory]);

  // Calendar grid for selected month
  const calendarDays = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isDone: boolean;
      isToday: boolean;
      isMissed: boolean;
    }[] = [];

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

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 1; i <= daysInMonth; i++) {
      const curDate = new Date(year, month, i);
      const dStr = formatLocalDate(curDate);
      const isPast = curDate < todayMidnight;
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

  const calendarRowCount = Math.ceil(calendarDays.length / 7);

  const handleDelete = () => setShowDeleteConfirm(true);

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
      setToastMessage('Copied streak summary to clipboard');
    }
  };

  const executeArchiveToggle = (nextArchived: boolean) => {
    updateHabit({
      ...habit,
      archived: nextArchived,
      archivedAt: nextArchived ? new Date().toISOString() : undefined,
    });
    setToastMessage(nextArchived ? 'Habit archived' : 'Habit restored');
  };

  const handleArchive = () => {
    if (habit.archived) {
      executeArchiveToggle(false);
    } else {
      setShowArchiveConfirm(true);
    }
  };

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const currentStreak = habit.currentStreak || 0;
  const milestoneMod = currentStreak % 7;
  const milestoneRemaining = 7 - milestoneMod;
  const milestonePct = Math.min(100, Math.round((milestoneMod / 7) * 100));

  const safeFontColor = getSafeFontColor(habit.fontColor, isDark);
  const fontInlineStyle = getFontInlineStyle(
    {
      fontColor: safeFontColor,
      fallbackColor: safeFontColor ? safeFontColor : undefined,
      isBold: habit.isBold,
    },
    isDark
  );

  const habitTypeLabel =
    habit.habitType === 'counter' ? 'Measurable' : habit.habitType === 'timer' ? 'Timed' : 'Daily';

  const hasSubSteps = Boolean(habit.subSteps && habit.subSteps.length > 0);
  const hasNotes = Boolean(habit.notes && habit.notes.trim().length > 0);

  const modalContent = (
    <motion.div
      data-unified-modal="true"
      data-habit-detail-modal="true"
      data-dark-modal={isDark ? 'true' : undefined}
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
      exit={{ opacity: 0, y: 14, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
      style={{ backgroundColor: themeStyles.backdrop, color: themeStyles.textColor, willChange: 'transform, opacity' }}
      className={`fixed inset-0 z-[100] h-[100dvh] flex flex-col overflow-hidden ${
        isDark ? 'modal-dark' : 'modal-light'
      }`}
    >
      {/* Unified Sticky Top Bar: Back + Habit Icon & Title + Metadata + Complete Toggle */}
      <header
        className="shrink-0 w-full border-b px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5"
        style={{
          backgroundColor: themeStyles.cardBg,
          borderColor: themeStyles.cardBorder,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to habits"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer border active:scale-95"
            style={{
              backgroundColor: themeStyles.backBtnBg,
              color: themeStyles.backBtnColor,
              borderColor: themeStyles.backBtnBorder,
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: isDark ? 'rgba(59, 91, 219, 0.22)' : 'rgba(67, 97, 238, 0.1)',
              borderColor: isDark ? 'rgba(76, 110, 245, 0.35)' : 'rgba(67, 97, 238, 0.22)',
              color: isDark ? '#748ffc' : '#4361ee',
            }}
          >
            <IconRenderer icon={habit.icon} className="w-4.5 h-4.5" fallback="🔥" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1
                className={`text-base sm:text-xl font-extrabold font-sans tracking-tight truncate ${
                  safeFontColor ? '' : 'text-slate-900 dark:text-white'
                }`}
                style={fontInlineStyle}
              >
                {habit.name}
              </h1>
              <div className="shrink-0">
                <AnimatedStreakBadge
                  streak={currentStreak}
                  isCompleted={isCheckedToday}
                  size="sm"
                  showZero={true}
                />
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 text-[11px] font-medium truncate tabular-nums"
              style={{ color: themeStyles.subText }}
            >
              <span>{habitTypeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Target {habit.targetCount || 1}</span>
              {habit.reminderTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{habit.reminderTime}</span>
                </>
              )}
              {habit.tags && habit.tags.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5 truncate">
                    {habit.tags.slice(0, 3).map(t => (
                      <InlineTagMeta key={t} tag={t} appTags={tags} className="text-[11px]" />
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Today Check Toggle */}
        <div className="relative flex items-center justify-center shrink-0">
          <CheckmarkCelebration
            activeKey={celebrationKey}
            badgeText={`Done🔥 ${Math.max(1, currentStreak + (isCheckedToday ? 0 : 1))}D`}
            ringColor="border-[#4c6ef5]"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            animate={celebrationKey ? { scale: [1, 1.18, 0.95, 1] } : {}}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => handleToggleDone(todayStr)}
            aria-label={isCheckedToday ? 'Mark incomplete for today' : 'Mark complete for today'}
            className="w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer relative overflow-hidden"
            style={{
              backgroundColor: isCheckedToday ? '#4c6ef5' : themeStyles.btnCheckEmptyBg,
              borderColor: isCheckedToday ? '#5c7cfa' : themeStyles.btnCheckEmptyBorder,
              color: isCheckedToday ? '#ffffff' : themeStyles.btnCheckEmptyIcon,
              boxShadow: isCheckedToday ? '0 8px 20px -4px rgba(76, 110, 245, 0.45)' : 'none',
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
                className="w-4.5 h-4.5 rounded-full border-2"
                style={{ borderColor: themeStyles.btnCheckEmptyIcon }}
              />
            )}
          </motion.button>
        </div>
      </header>

      {/* Main Single-Page Canvas: Fits 1 viewport on mobile & 2-col grid on desktop */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-2 sm:py-4 flex flex-col">
        <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:items-stretch gap-2 sm:gap-4">
          {/* LEFT COLUMN: Notes / Sub-habits + Stats & Consistency */}
          <div className="lg:col-span-5 flex flex-col gap-2 shrink-0">
            {/* Compact Notes & Sub-habits Row (Only shown when present) */}
            {(hasNotes || hasSubSteps) && (
              <div
                data-habit-card="true"
                data-dark-card={isDark ? 'true' : undefined}
                className="rounded-2xl px-3 py-2 border space-y-1.5"
                style={{
                  backgroundColor: themeStyles.cardBg,
                  borderColor: themeStyles.cardBorder,
                }}
              >
                {hasNotes && (
                  <div className="flex items-start justify-between gap-2">
                    <p
                      onClick={() => setNotesExpanded(prev => !prev)}
                      className={`text-[11.5px] leading-snug cursor-pointer ${
                        notesExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'
                      }`}
                      style={{ color: themeStyles.notesText }}
                      title="Tap to expand/collapse note"
                    >
                      <span className="font-semibold mr-1.5" style={{ color: themeStyles.subText }}>
                        Note:
                      </span>
                      {habit.notes}
                    </p>
                  </div>
                )}

                {hasSubSteps && (
                  <div
                    className={`${hasNotes ? 'pt-1.5 border-t' : ''} space-y-1`}
                    style={{ borderColor: themeStyles.cardBorder }}
                  >
                    <div
                      className="flex items-center justify-between text-[10.5px] font-semibold"
                      style={{ color: themeStyles.subText }}
                    >
                      <span className="flex items-center gap-1">
                        <SubtaskBranchIcon className="w-3 h-3 text-indigo-500" />
                        <span>Sub-steps</span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {habit.subSteps!.filter(s => s.completed).length}/{habit.subSteps!.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {habit.subSteps!.map(step => (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => {
                            const updatedSteps =
                              habit.subSteps?.map(s =>
                                s.id === step.id ? { ...s, completed: !s.completed } : s
                              ) || [];
                            let shouldComplete = false;
                            if (habit.doneWhen === 'any') {
                              shouldComplete = updatedSteps.some(s => s.completed);
                            } else {
                              shouldComplete =
                                updatedSteps.length > 0 && updatedSteps.every(s => s.completed);
                            }
                            const wasChecked = !!habit.completionHistory?.[todayStr];
                            updateHabitSubSteps(habit.id, updatedSteps, todayStr);
                            if (shouldComplete && !wasChecked) {
                              setCelebrationKey(prev => prev + 1);
                            }
                            try {
                              soundEngine?.playWaterDropNotification?.();
                            } catch {}
                          }}
                          className="px-2 py-1 rounded-lg border flex items-center gap-1.5 transition text-[11px] text-left cursor-pointer max-w-full"
                          style={{
                            backgroundColor: step.completed
                              ? isDark
                                ? 'rgba(76, 110, 245, 0.16)'
                                : 'rgba(67, 97, 238, 0.08)'
                              : themeStyles.cardInnerBg,
                            borderColor: step.completed
                              ? isDark
                                ? 'rgba(76, 110, 245, 0.4)'
                                : 'rgba(67, 97, 238, 0.3)'
                              : themeStyles.cardInnerBorder,
                            color: step.completed
                              ? isDark
                                ? '#748ffc'
                                : '#4361ee'
                              : themeStyles.notesText,
                          }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: step.completed ? themeStyles.progressFill : 'transparent',
                              borderColor: step.completed
                                ? themeStyles.progressFill
                                : isDark
                                ? '#475569'
                                : '#cbd5e1',
                            }}
                          >
                            {step.completed && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                          </span>
                          <span className={`truncate ${step.completed ? 'line-through opacity-75' : ''}`}>
                            {step.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compact Activity & Consistency Card */}
            <section
              data-habit-card="true"
              data-dark-card={isDark ? 'true' : undefined}
              className="rounded-2xl p-2.5 sm:p-3.5 space-y-2 border"
              style={{
                backgroundColor: themeStyles.cardBg,
                borderColor: themeStyles.cardBorder,
              }}
            >
              {/* Inline Streak + KPI Summary */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: themeStyles.flameBg }}
                  >
                    <Flame
                      className={`w-3.5 h-3.5 fill-current ${
                        isCheckedToday ? 'text-amber-500' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-sm sm:text-base font-extrabold" style={{ color: themeStyles.numberColor }}>
                      {currentStreak}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: themeStyles.subText }}>
                      day streak
                    </span>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2 text-[11px] tabular-nums"
                  style={{ color: themeStyles.subText }}
                >
                  <span>
                    Best <strong style={{ color: themeStyles.numberColor }}>{habit.bestStreak || 0}d</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Done <strong style={{ color: themeStyles.numberColor }}>{completedTotal}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Rate <strong style={{ color: themeStyles.numberColor }}>{successRate}%</strong>
                  </span>
                </div>
              </div>

              {/* Slim 7-Day Milestone Bar */}
              <div className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: themeStyles.subText }}>
                <span className="shrink-0">{milestoneRemaining}d to 7-day goal</span>
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: themeStyles.progressTrack }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${milestonePct}%`, backgroundColor: themeStyles.progressFill }}
                  />
                </div>
                <span className="font-mono font-semibold shrink-0">{milestonePct}%</span>
              </div>

              {/* 5-Period Completion Row */}
              <div
                className="grid grid-cols-5 gap-1 p-1.5 rounded-xl border"
                style={{
                  backgroundColor: themeStyles.cardInnerBg,
                  borderColor: themeStyles.cardInnerBorder,
                }}
              >
                {[
                  { label: 'Today', val: todayProgress },
                  { label: 'Week', val: weekProgress },
                  { label: 'Month', val: monthProgress },
                  { label: 'Qtr', val: quarterProgress },
                  { label: 'Year', val: yearProgress },
                ].map(period => (
                  <div key={period.label} className="flex flex-col items-center justify-center py-0.5">
                    <span className="text-[9.5px] font-semibold" style={{ color: themeStyles.subText }}>
                      {period.label}
                    </span>
                    <span
                      className="text-xs font-extrabold tabular-nums leading-tight my-0.5"
                      style={{ color: themeStyles.numberColor }}
                    >
                      {period.val}%
                    </span>
                    <div
                      className="w-full h-1 rounded-full overflow-hidden"
                      style={{ backgroundColor: themeStyles.progressTrack }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${period.val}%`, backgroundColor: themeStyles.progressFill }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Compact By Day of Week Bars */}
              <div className="pt-1.5 border-t space-y-1" style={{ borderColor: themeStyles.cardBorder }}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-bold" style={{ color: themeStyles.sectionTitle }}>
                    By day of week
                  </span>
                  <span className="font-medium tabular-nums" style={{ color: themeStyles.flameWarning }}>
                    {dayOfWeekStats.lowestDayName} lowest ({dayOfWeekStats.lowestPct}%)
                  </span>
                </div>

                <div className="flex items-end justify-between gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLabel, idx) => {
                    const pct = dayOfWeekStats.percentages[idx] || 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                        <span
                          className="text-[8.5px] font-mono font-semibold tabular-nums leading-none"
                          style={{ color: themeStyles.barChartPct }}
                        >
                          {pct}%
                        </span>
                        <div
                          className="w-full rounded-xs overflow-hidden h-4 flex items-end border"
                          style={{
                            backgroundColor: themeStyles.barChartTrack,
                            borderColor: themeStyles.cardBorder,
                          }}
                        >
                          <div
                            className="w-full transition-all duration-300"
                            style={{
                              height: `${Math.max(12, pct)}%`,
                              backgroundColor: themeStyles.progressFill,
                            }}
                          />
                        </div>
                        <span
                          className={`text-[9.5px] leading-none ${idx === 0 ? 'font-black' : 'font-bold'}`}
                          style={{ color: idx === 0 ? '#ef4444' : themeStyles.subText }}
                        >
                          {dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN / BOTTOM FLEX CARD: History & Calendar */}
          <section
            data-habit-card="true"
            data-dark-card={isDark ? 'true' : undefined}
            className="lg:col-span-7 rounded-2xl p-2.5 sm:p-4 border flex flex-col justify-between min-h-0 flex-1"
            style={{
              backgroundColor: themeStyles.cardBg,
              borderColor: themeStyles.cardBorder,
            }}
          >
            {/* History Header + Segmented Filter on 1 single row */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold leading-tight" style={{ color: themeStyles.sectionTitle }}>
                  History
                </h2>
              </div>

              <div
                className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl border shrink-0"
                style={{
                  backgroundColor: themeStyles.tabContainerBg,
                  borderColor: themeStyles.tabContainerBorder,
                }}
              >
                {[
                  { id: 'month' as const, label: 'Month' },
                  { id: '13weeks' as const, label: '13w' },
                  { id: '12months' as const, label: '12m' },
                ].map(tab => {
                  const active = historyTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistoryTab(tab.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                      style={{
                        backgroundColor: active ? themeStyles.tabActiveBg : 'transparent',
                        color: active ? themeStyles.tabActiveText : themeStyles.tabInactiveText,
                      }}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Month Calendar View */}
            {historyTab === 'month' && (
              <div className="flex-1 min-h-0 flex flex-col justify-between pt-1.5 gap-1">
                {/* Month Nav + Compact Inline Legend */}
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                      }
                      aria-label="Previous month"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer hover:opacity-80"
                      style={{ color: themeStyles.subText }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-xs sm:text-sm tabular-nums" style={{ color: themeStyles.numberColor }}>
                      {currentCalendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                      }
                      aria-label="Next month"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer hover:opacity-80"
                      style={{ color: themeStyles.subText }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inline Legend */}
                  <div className="flex items-center gap-2.5 text-[10px] font-medium shrink-0" style={{ color: themeStyles.subText }}>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeStyles.calDoneBg }} />
                      Done
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full border" style={{ borderColor: themeStyles.calMissedBorder }} />
                      Miss
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full border"
                        style={{ backgroundColor: themeStyles.calDayBg, borderColor: themeStyles.calDayBorder }}
                      />
                      Rest
                    </span>
                  </div>
                </div>

                {/* Day Matrix */}
                <div className="grid grid-cols-7 gap-1 text-center my-auto">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div
                      key={i}
                      className={`text-[10px] leading-tight py-0.5 ${i === 0 ? 'font-black' : 'font-semibold'}`}
                      style={{ color: i === 0 ? '#ef4444' : themeStyles.subText }}
                    >
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (d.isCurrentMonth && d.dateStr === todayStr) {
                          handleToggleDone(d.dateStr);
                        }
                      }}
                      className={`${
                        calendarRowCount >= 6 ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-9 sm:h-9'
                      } mx-auto rounded-full text-[11px] font-bold tabular-nums transition flex items-center justify-center border ${
                        d.isCurrentMonth && d.dateStr === todayStr ? 'cursor-pointer ring-2 ring-indigo-500/40' : 'cursor-default'
                      }`}
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
                      {d.dayNum}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 13 Weeks / 12 Months Real Completion Bars */}
            {(historyTab === '13weeks' || historyTab === '12months') && (
              <div className="flex-1 flex flex-col justify-center pt-2 space-y-2 min-h-[160px]">
                <div className="h-32 sm:h-40 flex items-end justify-between gap-1.5 pt-2">
                  {(historyTab === '13weeks' ? thirteenWeeksData : twelveMonthsData).map((bar, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span
                        className="text-[8.5px] font-mono tabular-nums"
                        style={{ color: themeStyles.subText }}
                      >
                        {bar.pct > 0 ? `${bar.pct}%` : ''}
                      </span>
                      <div
                        className="w-full flex-1 flex items-end rounded-t-md overflow-hidden"
                        style={{ backgroundColor: themeStyles.barChartTrack }}
                      >
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${Math.max(4, bar.pct)}%`,
                            backgroundColor: themeStyles.progressFill,
                            opacity: bar.pct > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                      <span
                        className="text-[9px] font-semibold tabular-nums"
                        style={{ color: themeStyles.subText }}
                      >
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-center font-medium" style={{ color: themeStyles.subText }}>
                  {historyTab === '13weeks' ? 'Weekly' : 'Monthly'} completion consistency
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Docked Bottom Action Bar (Never covers calendar) */}
      <footer
        className="shrink-0 w-full border-t px-3 sm:px-6 py-2 flex items-center justify-center backdrop-blur-md"
        style={{
          backgroundColor: themeStyles.toolbarBg,
          borderColor: themeStyles.toolbarBorder,
        }}
      >
        <div className="w-full max-w-md grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onEdit(habit)}
            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer border active:scale-95"
            style={{
              backgroundColor: themeStyles.toolbarBtnBg,
              color: themeStyles.toolbarBtnColor,
              borderColor: themeStyles.toolbarBorder,
            }}
            title="Edit Habit"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer border active:scale-95"
            style={{
              backgroundColor: themeStyles.toolbarBtnBg,
              color: themeStyles.toolbarBtnColor,
              borderColor: themeStyles.toolbarBorder,
            }}
            title="Share Habit"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer border active:scale-95"
            style={{
              backgroundColor: themeStyles.toolbarBtnBg,
              color: themeStyles.toolbarBtnColor,
              borderColor: themeStyles.toolbarBorder,
            }}
            title={habit.archived ? 'Restore Habit' : 'Archive Habit'}
          >
            {habit.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            <span>{habit.archived ? 'Restore' : 'Archive'}</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition cursor-pointer active:scale-95"
            style={{ backgroundColor: '#dc2626' }}
            title="Delete Habit"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </footer>

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
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black tracking-tight mb-2">Delete Habit?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-800 dark:text-zinc-200">"{habit.name}"</strong>?
                All completion history and streak progress will be removed.
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

      <ArchiveConfirmModal
        isOpen={showArchiveConfirm}
        itemName={habit.name}
        itemType="Habit"
        onConfirm={() => {
          setShowArchiveConfirm(false);
          executeArchiveToggle(true);
        }}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[210] px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-xl flex items-center gap-2 border border-white/10 dark:border-black/10 text-xs font-bold whitespace-nowrap"
          >
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-600" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
