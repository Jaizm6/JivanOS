import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Clock,
  Trash2,
  ChevronDown,
  Sun,
  Sunset,
  Moon,
  Heart,
  Play,
  Pause,
  Edit3,
  Archive,
  ArchiveRestore,
  FileText,
  Check,
  Sparkles,
  Link2,
  X,
  ArrowUpDown,
  Unlink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { Routine, RoutineItem, Habit } from '../../types';
import { IconRenderer } from '../common/IconRenderer';
import { HabitFormModal } from './HabitFormModal';
import { HabitDetailModal } from './HabitDetailModal';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import {
  getCardThemeStyles,
  getFontInlineStyle,
  getSafeFontColor,
  isWhiteColor,
  isBlackColor,
} from '../../utils/activityStyles';
import {
  PetalShapeBadge,
  getHabitExpressiveShape,
  getPetalGroupRadiusClass,
  SmoothCollapse,
} from '../common/PetalExpressive';
import { isHabitScheduledForDate, getHabitFrequencyLabel } from '../../utils/habitSchedule';
import { formatLocalDate } from '../../utils/date';
import { haptics } from '../../utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  CRISP_TRANSFORM_TEMPLATE,
  UNIFIED_MODAL_POSITION_CLASS,
  useModalScrollLock,
} from '../common/FormPrimitives';

export interface RoutineWeekDay {
  dateStr: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
  isSelected: boolean;
}

interface HabitsRoutineSectionProps {
  selectedDateStr: string;
  weekDays: RoutineWeekDay[];
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
  isCreateRoutineOpen?: boolean;
  onCloseCreateRoutine?: () => void;
}

const ROUTINE_ACCENTS = [
  { id: 'morning', label: 'Morning', icon: '🌅', color: '#f59e0b' },
  { id: 'afternoon', label: 'Afternoon', icon: '☀️', color: '#0ea5e9' },
  { id: 'evening', label: 'Evening', icon: '🌙', color: '#6366f1' },
  { id: 'custom', label: 'Custom Ritual', icon: '✨', color: '#ec4899' },
] as const;

export const HabitsRoutineSection: React.FC<HabitsRoutineSectionProps> = ({
  selectedDateStr,
  weekDays,
  showArchived = false,
  onToggleShowArchived,
  isCreateRoutineOpen = false,
  onCloseCreateRoutine,
}) => {
  const {
    routines,
    habits,
    toggleRoutineItem,
    toggleHabitDay,
    updateHabit,
    deleteHabit,
    deleteRoutineItem,
    updateRoutineItem,
    addRoutine,
    deleteRoutine,
    reorderRoutineItems,
    updateRoutineItemSubSteps,
    soundEngine,
    theme,
    pushNotification,
  } = useApp();

  const isDarkMode = theme === 'dark';
  const { session, startSession, pauseSession, resumeSession, sessions } = useActiveSession();

  const [collapsedRoutines, setCollapsedRoutines] = useState<Record<string, boolean>>({});
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [sortBySequence, setSortBySequence] = useState<boolean>(true);
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);

  // Add / Edit Habit Form Modal state (follows Habit page HabitFormModal system)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [targetRoutineForCreate, setTargetRoutineForCreate] = useState<Routine | null>(null);

  // Add Step / Link Existing Habit Picker state
  const [stepPickerRoutine, setStepPickerRoutine] = useState<Routine | null>(null);

  // Archive / Remove Confirmation state
  const [pendingArchiveTarget, setPendingArchiveTarget] = useState<{
    routineId: string;
    habit: Habit;
    isLinkedOnly: boolean;
  } | null>(null);
  const [pendingDeleteRoutine, setPendingDeleteRoutine] = useState<Routine | null>(null);

  // Create Routine Modal state
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineTimeOfDay, setNewRoutineTimeOfDay] = useState<Routine['timeOfDay']>('morning');
  const [newRoutineIcon, setNewRoutineIcon] = useState('🌅');
  const [newRoutineColor, setNewRoutineColor] = useState('#f59e0b');

  // Micro-interaction states for checkmark celebrations (zero-lag matching HabitTracker)
  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null);
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const animTimerRef = useRef<any>(null);
  const celebStartRef = useRef<any>(null);
  const celebClearRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (celebStartRef.current) clearTimeout(celebStartRef.current);
      if (celebClearRef.current) clearTimeout(celebClearRef.current);
    };
  }, []);

  useModalScrollLock(isCreateRoutineOpen || Boolean(stepPickerRoutine));

  const todayKey = formatLocalDate();

  const toggleCollapse = (id: string) => {
    setCollapsedRoutines(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getRoutineIcon = (r: Routine) => {
    if (r.timeOfDay === 'morning') return <Sun className="w-4 h-4 text-amber-500" />;
    if (r.timeOfDay === 'afternoon') return <Sunset className="w-4 h-4 text-sky-500" />;
    if (r.timeOfDay === 'evening') return <Moon className="w-4 h-4 text-indigo-500" />;
    return <Heart className="w-4 h-4 text-rose-500" />;
  };

  const getRoutineColor = (r: Routine) => {
    if (r.color) return r.color;
    if (r.timeOfDay === 'morning') return '#f59e0b';
    if (r.timeOfDay === 'afternoon') return '#0ea5e9';
    if (r.timeOfDay === 'evening') return '#6366f1';
    return '#ec4899';
  };

  /**
   * Unifies RoutineItem + linked Habit so every routine card carries full Habit capabilities:
   * per-date completionHistory, streaks, sub-steps, frequency, focus timers, archive state, and theming.
   */
  const resolveHabitForItem = (item: RoutineItem, routine: Routine): Habit => {
    const defaultColor = getRoutineColor(routine);
    const titleNorm = item.title.toLowerCase().trim();
    const found = habits.find(
      h => h.id === item.id || h.name.toLowerCase().trim() === titleNorm
    );

    if (found) {
      return {
        ...found,
        reminderTime: found.reminderTime || item.scheduledTime || item.reminderTime,
        durationMinutes: found.durationMinutes || item.durationMinutes || found.timerMinutes,
        timerMinutes: found.timerMinutes || item.durationMinutes,
        targetTimeOfDay:
          found.targetTimeOfDay || (routine.timeOfDay === 'custom' ? 'anytime' : routine.timeOfDay),
        fontColor: found.fontColor !== undefined ? found.fontColor : item.fontColor,
        accentColor: found.accentColor || item.accentColor || defaultColor,
        color: found.color || item.color || defaultColor,
        isBold: found.isBold !== undefined ? found.isBold : (item.isBold ?? true),
        cardTheme: 'clean',
      };
    }

    const baseHistory: Record<string, boolean> = { ...(item.completionHistory || {}) };
    if (baseHistory[todayKey] === undefined && item.completed) {
      baseHistory[todayKey] = true;
    }

    return {
      id: item.id,
      name: item.title,
      icon:
        item.icon ||
        (routine.timeOfDay === 'morning'
          ? '🌅'
          : routine.timeOfDay === 'afternoon'
          ? '☀️'
          : routine.timeOfDay === 'evening'
          ? '🌙'
          : '💆'),
      category:
        routine.timeOfDay === 'morning' || routine.timeOfDay === 'evening' ? 'routine' : 'health',
      frequency: item.frequency || 'daily',
      customDays: item.customDays,
      targetDaysPerWeek: 7,
      targetTimeOfDay: routine.timeOfDay === 'custom' ? 'anytime' : routine.timeOfDay,
      reminderTime: item.scheduledTime || item.reminderTime,
      reminderType: item.reminderType || (item.scheduledTime ? 'notification' : 'none'),
      timerMinutes: item.durationMinutes || item.timerMinutes,
      durationMinutes: item.durationMinutes || item.timerMinutes,
      currentStreak: item.currentStreak ?? (baseHistory[todayKey] ? 1 : 0),
      bestStreak: item.bestStreak ?? (baseHistory[todayKey] ? 1 : 0),
      completionHistory: baseHistory,
      color: item.color || defaultColor,
      accentColor: item.accentColor || defaultColor,
      cardTheme: 'clean',
      fontColor: item.fontColor,
      isBold: item.isBold ?? true,
      tags: item.tags || [routine.name, 'routine'],
      notes: item.notes,
      subSteps: item.subSteps,
      archived: item.archived,
      archivedAt: item.archivedAt,
      createdAt: '2026-08-01',
    };
  };

  // Compute unified routine entries with chronological sorting & Next Up detection
  const enrichedRoutines = useMemo(() => {
    return routines.map(routine => {
      const itemHabits = routine.items.map(item => ({
        habit: resolveHabitForItem(item, routine),
        inRoutineItems: true,
        linkedHabitExists: habits.some(
          h => h.id === item.id || h.name.toLowerCase().trim() === item.title.toLowerCase().trim()
        ),
      }));

      const routineNameLower = routine.name.toLowerCase().trim();
      const taggedHabits = habits
        .filter(
          h =>
            h.tags?.some(t => t.toLowerCase().trim() === routineNameLower) &&
            !itemHabits.some(
              ih => ih.habit.id === h.id || ih.habit.name.toLowerCase().trim() === h.name.toLowerCase().trim()
            )
        )
        .map(h => ({
          habit: h,
          inRoutineItems: false,
          linkedHabitExists: true,
        }));

      const combined = [...itemHabits, ...taggedHabits].filter(entry =>
        showArchived ? Boolean(entry.habit.archived) : !entry.habit.archived
      );

      if (sortBySequence) {
        combined.sort((a, b) => {
          const ta = a.habit.reminderTime || '99:99';
          const tb = b.habit.reminderTime || '99:99';
          return ta.localeCompare(tb);
        });
      }

      const completedCount = combined.filter(e =>
        Boolean(e.habit.completionHistory?.[selectedDateStr])
      ).length;
      const totalCount = combined.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      const totalMinutes = combined.reduce(
        (acc, e) => acc + (e.habit.durationMinutes || e.habit.timerMinutes || 0),
        0
      );
      const remainingMinutes = combined
        .filter(e => !e.habit.completionHistory?.[selectedDateStr])
        .reduce((acc, e) => acc + (e.habit.durationMinutes || e.habit.timerMinutes || 0), 0);

      const scheduledTimes = combined
        .map(e => e.habit.reminderTime)
        .filter((t): t is string => Boolean(t))
        .sort();
      const timeWindow =
        scheduledTimes.length >= 2
          ? `${scheduledTimes[0]}–${scheduledTimes[scheduledTimes.length - 1]}`
          : scheduledTimes[0] || '';

      const nextUpEntry = combined.find(
        e => !e.habit.completionHistory?.[selectedDateStr] && isHabitScheduledForDate(e.habit, selectedDateStr)
      );

      return {
        routine,
        entries: combined,
        completedCount,
        totalCount,
        progressPercent,
        totalMinutes,
        remainingMinutes,
        timeWindow,
        nextUpId: nextUpEntry?.habit.id || null,
        accent: getRoutineColor(routine),
      };
    });
  }, [routines, habits, selectedDateStr, showArchived, sortBySequence]);

  const totalStepsAcrossRoutines = useMemo(
    () => enrichedRoutines.reduce((sum, r) => sum + r.totalCount, 0),
    [enrichedRoutines]
  );
  const completedStepsAcrossRoutines = useMemo(
    () => enrichedRoutines.reduce((sum, r) => sum + r.completedCount, 0),
    [enrichedRoutines]
  );
  const totalRemainingMinutes = useMemo(
    () => enrichedRoutines.reduce((sum, r) => sum + r.remainingMinutes, 0),
    [enrichedRoutines]
  );

  const handleStartTimer = (habit: Habit) => {
    const mins = habit.timerMinutes || habit.durationMinutes || 15;
    startSession(habit.id, 'habit', habit.name, 'focus', mins * 60);
  };

  const triggerToggleCelebration = (habitId: string, willComplete: boolean) => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (celebStartRef.current) clearTimeout(celebStartRef.current);
    if (celebClearRef.current) clearTimeout(celebClearRef.current);

    if (willComplete) {
      setAnimatingHabitId(habitId);
      try {
        soundEngine.playWaterDropNotification();
        haptics.complete();
      } catch {}
      celebStartRef.current = setTimeout(() => {
        setCelebratingHabitId(habitId);
        setCelebrationKey(prev => prev + 1);
      }, 120);
      animTimerRef.current = setTimeout(() => setAnimatingHabitId(null), 420);
      celebClearRef.current = setTimeout(() => setCelebratingHabitId(null), 1250);
    } else {
      setAnimatingHabitId(null);
      setCelebratingHabitId(null);
      try {
        haptics.toggle();
      } catch {}
    }
  };

  const handleToggleRoutineStep = (
    routineId: string,
    habit: Habit,
    inRoutineItems: boolean,
    dateStr: string
  ) => {
    const wasChecked = Boolean(habit.completionHistory?.[dateStr]);
    if (inRoutineItems) {
      toggleRoutineItem(routineId, habit.id, dateStr, { skipSound: true });
    } else {
      toggleHabitDay(habit.id, dateStr, { skipSound: true, skipUndoSnackbar: true });
    }
    triggerToggleCelebration(habit.id, !wasChecked);
  };

  const handleToggleArchiveOrRemove = (routineId: string, habit: Habit, inRoutineItems: boolean) => {
    if (habit.archived) {
      // Restore immediately
      if (habits.some(h => h.id === habit.id)) {
        updateHabit({ ...habit, archived: false, archivedAt: undefined });
      }
      if (inRoutineItems) {
        const targetRoutine = routines.find(r => r.id === routineId);
        const rawItem = targetRoutine?.items.find(i => i.id === habit.id);
        if (rawItem) {
          updateRoutineItem(routineId, { ...rawItem, archived: false, archivedAt: undefined });
        }
      }
      haptics.toggle();
      pushNotification('Routine Step Restored', `"${habit.name}" restored.`, 'habit');
      return;
    }

    setPendingArchiveTarget({
      routineId,
      habit,
      isLinkedOnly: !inRoutineItems,
    });
  };

  const confirmArchiveOrUnlink = () => {
    if (!pendingArchiveTarget) return;
    const { routineId, habit, isLinkedOnly } = pendingArchiveTarget;

    if (isLinkedOnly) {
      // Unlink routine tag from habit cleanly without deleting the habit itself
      const routine = routines.find(r => r.id === routineId);
      const rName = routine?.name.toLowerCase().trim() || '';
      const updatedTags = (habit.tags || []).filter(t => t.toLowerCase().trim() !== rName);
      updateHabit({ ...habit, tags: updatedTags });
      pushNotification('Unlinked from Routine', `"${habit.name}" removed from ${routine?.name || 'routine'}.`, 'habit');
    } else {
      if (habits.some(h => h.id === habit.id)) {
        updateHabit({ ...habit, archived: true, archivedAt: new Date().toISOString() });
      }
      const targetRoutine = routines.find(r => r.id === routineId);
      const rawItem = targetRoutine?.items.find(i => i.id === habit.id);
      if (rawItem) {
        updateRoutineItem(routineId, {
          ...rawItem,
          archived: true,
          archivedAt: new Date().toISOString(),
        });
      }
      pushNotification('Step Archived', `"${habit.name}" moved to Archived.`, 'habit');
    }

    haptics.toggle();
    setPendingArchiveTarget(null);
  };

  const handleToggleLinkExistingHabit = (routine: Routine, habit: Habit) => {
    const routineNameLower = routine.name.toLowerCase().trim();
    const isAlreadyInItems = routine.items.some(
      i => i.id === habit.id || i.title.toLowerCase().trim() === habit.name.toLowerCase().trim()
    );
    const hasTag = Boolean(habit.tags?.some(t => t.toLowerCase().trim() === routineNameLower));

    if (isAlreadyInItems || hasTag) {
      if (isAlreadyInItems) {
        deleteRoutineItem(routine.id, habit.id);
      }
      if (hasTag) {
        updateHabit({
          ...habit,
          tags: (habit.tags || []).filter(t => t.toLowerCase().trim() !== routineNameLower),
        });
      }
      haptics.toggle();
    } else {
      const nextTags = Array.from(new Set([...(habit.tags || []), routine.name]));
      updateHabit({ ...habit, tags: nextTags });
      haptics.complete();
      soundEngine.playSuccessChime();
    }
  };

  const handleCreateRoutineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    addRoutine({
      name: newRoutineName.trim(),
      icon: newRoutineIcon,
      timeOfDay: newRoutineTimeOfDay,
      color: newRoutineColor,
    });
    setNewRoutineName('');
    setNewRoutineTimeOfDay('morning');
    setNewRoutineIcon('🌅');
    setNewRoutineColor('#f59e0b');
    onCloseCreateRoutine?.();
  };

  return (
    <div className="space-y-1.5 w-full min-w-0">
      {/* 1. Material 3 Compact Routine Metrics + Sequence Toggle Strip */}
      <div className="grid grid-cols-3 gap-1 w-full min-w-0">
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="indigo"
          className="px-2 py-1.5 rounded-[14px] flex items-center gap-1.5 min-w-0"
        >
          <PetalShapeBadge
            shape="cookie12"
            sizeClass="w-6 h-6 hidden sm:flex"
            fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.35)' : 'rgba(79, 70, 229, 0.25)'}
          >
            <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400 block truncate leading-tight">
              Completed
            </span>
            <div className="text-[12.5px] sm:text-[13px] font-extrabold text-slate-900 dark:text-white leading-tight truncate tabular-nums">
              {completedStepsAcrossRoutines}/{totalStepsAcrossRoutines}
            </div>
          </div>
        </div>

        <div
          data-m3-tonal-card="true"
          data-tonal-tone="done"
          className="px-2 py-1.5 rounded-[14px] flex items-center gap-1.5 min-w-0"
        >
          <PetalShapeBadge
            shape="clover"
            sizeClass="w-6 h-6 hidden sm:flex"
            fillColor={isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)'}
          >
            <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate leading-tight">
              Time Left
            </span>
            <div className="text-[12.5px] sm:text-[13px] font-extrabold text-slate-900 dark:text-white leading-tight truncate tabular-nums">
              {totalRemainingMinutes > 0 ? `${totalRemainingMinutes}m` : 'All Done'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            haptics.toggle();
            setSortBySequence(prev => !prev);
          }}
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="px-2 py-1.5 rounded-[14px] flex items-center justify-center sm:justify-start gap-1.5 min-w-0 cursor-pointer hover:ring-1 hover:ring-indigo-400/50 transition text-left"
          title="Toggle between chronological time order and custom drag order"
        >
          <ArrowUpDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0 hidden sm:block" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[9.5px] font-semibold text-slate-500 dark:text-zinc-400 block truncate leading-tight">
              Order
            </span>
            <div className="text-[11.5px] sm:text-[12.5px] font-extrabold text-slate-900 dark:text-white leading-tight truncate">
              {sortBySequence ? 'Timed Flow' : 'Drag Order'}
            </div>
          </div>
        </button>
      </div>

      {/* Archived Banner when viewing archived routine steps */}
      {showArchived && (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="archived"
          className="px-2.5 py-1 rounded-[14px] flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-1.5 min-w-0 text-slate-700 dark:text-zinc-200 font-semibold">
            <Archive className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
            <span className="truncate">Viewing Archived Routine Steps</span>
          </div>
          {onToggleShowArchived && (
            <button
              type="button"
              onClick={onToggleShowArchived}
              className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 text-[10.5px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              Back to Active
            </button>
          )}
        </div>
      )}

      {/* 2. Routine Groups (Compact Material 3 Expressive Grouped Containment) */}
      <div className="space-y-1.5 w-full min-w-0">
        {enrichedRoutines.map(group => {
          const {
            routine,
            entries,
            completedCount,
            totalCount,
            progressPercent,
            totalMinutes,
            timeWindow,
            nextUpId,
            accent,
          } = group;
          const isCollapsed = Boolean(collapsedRoutines[routine.id]);
          const nextUpEntry = entries.find(e => e.habit.id === nextUpId);
          const isCustomRoutine =
            routine.id !== 'routine_morning' &&
            routine.id !== 'routine_evening' &&
            routine.id !== 'routine_sunday';

          return (
            <div
              key={routine.id}
              data-m3-tonal-card="true"
              data-tonal-tone="subcard"
              className="rounded-[18px] p-1.5 sm:p-2 space-y-1 w-full min-w-0"
            >
              {/* Compact Routine Group Header */}
              <div className="flex items-center justify-between gap-1.5 px-0.5 py-0 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleCollapse(routine.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <PetalShapeBadge
                    shape={
                      routine.timeOfDay === 'morning'
                        ? 'scallop'
                        : routine.timeOfDay === 'evening'
                        ? 'arch'
                        : 'cookie12'
                    }
                    sizeClass="w-7 h-7"
                    fillColor={`${accent}${isDarkMode ? '28' : '18'}`}
                    strokeColor={`${accent}${isDarkMode ? '60' : '45'}`}
                  >
                    <IconRenderer
                      icon={routine.icon}
                      className="w-3.5 h-3.5"
                      fallback={getRoutineIcon(routine)}
                    />
                  </PetalShapeBadge>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-[13px] sm:text-[13.5px] tracking-tight truncate leading-tight">
                        {routine.name}
                      </h4>
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full tabular-nums shrink-0 leading-tight"
                        style={{
                          backgroundColor: `${accent}${isDarkMode ? '26' : '1a'}`,
                          color: accent,
                        }}
                      >
                        {completedCount}/{totalCount}
                      </span>
                    </div>

                    {/* Clean Unboxed Metadata + Slim Progress Track */}
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <div className="w-16 sm:w-24 h-1 rounded-full bg-slate-200/80 dark:bg-zinc-800 overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progressPercent}%`, backgroundColor: accent }}
                        />
                      </div>
                      <span className="text-[10px] leading-none font-medium text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                        {timeWindow || (routine.timeOfDay !== 'custom' ? routine.timeOfDay : 'Ritual')}
                        {totalMinutes > 0 ? ` · ${totalMinutes}m` : ''}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Header Right Actions: Run Next Timer, + Add Step, Delete Custom, Collapse */}
                <div className="flex items-center gap-1 shrink-0">
                  {nextUpEntry && (nextUpEntry.habit.timerMinutes || nextUpEntry.habit.durationMinutes) && (
                    <button
                      type="button"
                      onClick={() => handleStartTimer(nextUpEntry.habit)}
                      className="h-6.5 px-2 rounded-full bg-white/90 dark:bg-zinc-800/90 border border-slate-200/80 dark:border-zinc-700/80 text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
                      title={`Start next timed step: ${nextUpEntry.habit.name}`}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" style={{ color: accent }} />
                      <span className="hidden xs:inline">Next</span>
                    </button>
                  )}

                  {!showArchived && (
                    <button
                      type="button"
                      onClick={() => setStepPickerRoutine(routine)}
                      className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-white transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                      style={{ backgroundColor: accent }}
                      title={`Add or link habit to ${routine.name}`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
                    </button>
                  )}

                  {isCustomRoutine && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteRoutine(routine)}
                      className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                      title={`Delete ${routine.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleCollapse(routine.id)}
                    className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                    title={isCollapsed ? 'Expand routine' : 'Collapse routine'}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isCollapsed ? '' : 'rotate-180'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Routine Cards Grid (Compact Material 3 Expressive Card Layout Matching Habits) */}
              <SmoothCollapse isOpen={!isCollapsed} eager={true}>
                {entries.length === 0 ? (
                  <div className="py-3.5 px-3 text-center rounded-[14px] bg-white/60 dark:bg-zinc-900/50 border border-dashed border-slate-200/80 dark:border-zinc-800 space-y-1">
                    <p className="text-[11.5px] font-semibold text-slate-500 dark:text-zinc-400">
                      {showArchived
                        ? `No archived steps in ${routine.name}`
                        : `No active steps in ${routine.name} yet`}
                    </p>
                    {!showArchived && (
                      <button
                        type="button"
                        onClick={() => setStepPickerRoutine(routine)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-white cursor-pointer active:scale-95 transition"
                        style={{ backgroundColor: accent }}
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                        <span>Add or Link Habit</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[3px] sm:gap-1.5 w-full min-w-0">
                    {entries.map((entry, idx) => {
                      const { habit, inRoutineItems } = entry;
                      const isCheckedOnDate = Boolean(habit.completionHistory?.[selectedDateStr]);
                      const habitAccent = habit.accentColor || habit.color || accent;
                      const themeStyles = getCardThemeStyles(habitAccent, 'clean');
                      const safeFontColor = getSafeFontColor(habit.fontColor, isDarkMode);
                      const fontInlineStyle = getFontInlineStyle(
                        {
                          fontColor: safeFontColor,
                          fallbackColor: safeFontColor ? safeFontColor : undefined,
                          isBold: habit.isBold,
                        },
                        isDarkMode
                      );
                      const isRunningInPiP =
                        session.activeId === habit.id ||
                        (sessions && sessions.some(s => s.activeId === habit.id));
                      const isNextUp = nextUpId === habit.id && !isCheckedOnDate;
                      const isScheduled = isHabitScheduledForDate(habit, selectedDateStr);
                      const freqLabel = getHabitFrequencyLabel(habit);
                      const hasSubSteps = Boolean(habit.subSteps && habit.subSteps.length > 0);
                      const completedSubCount = habit.subSteps
                        ? habit.subSteps.filter(s => s.completed).length
                        : 0;
                      const isExpanded = expandedStepId === habit.id;
                      const weekCompletedCount = weekDays.filter(d =>
                        Boolean(habit.completionHistory?.[d.dateStr])
                      ).length;

                      const petalRadius = getPetalGroupRadiusClass(idx, entries.length, true);
                      const tonalTone = habit.archived
                        ? 'archived'
                        : isCheckedOnDate
                        ? 'done'
                        : 'neutral';
                      const doneCheckBg = isWhiteColor(habitAccent)
                        ? isDarkMode ? '#f8fafc' : '#4f46e5'
                        : isBlackColor(habitAccent)
                          ? isDarkMode ? '#6366f1' : '#0f172a'
                          : habitAccent;
                      const doneCheckFg = isWhiteColor(doneCheckBg) ? '#090d16' : '#ffffff';

                      return (
                        <div
                          key={habit.id}
                          data-m3-tonal-card="true"
                          data-tonal-tone={tonalTone}
                          draggable={!sortBySequence && !showArchived && inRoutineItems}
                          onDragStart={e => e.dataTransfer.setData('text/plain', habit.id)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            if (!sortBySequence && inRoutineItems) {
                              const draggedId = e.dataTransfer.getData('text/plain');
                              reorderRoutineItems(routine.id, draggedId, habit.id);
                            }
                          }}
                          onClick={() => setSelectedDetailHabit(habit)}
                          style={themeStyles.cardStyle}
                          className={`group relative w-full min-w-0 max-w-full overflow-visible ${petalRadius} sm:rounded-[18px] px-2 pt-1.5 pb-1.5 sm:px-2.5 sm:pt-2 sm:pb-1.5 flex flex-col cursor-pointer transition-[opacity,border-color,box-shadow] duration-200 ${
                            celebratingHabitId === habit.id ? 'z-20' : ''
                          } ${
                            !isScheduled
                              ? 'opacity-60 grayscale-[20%]'
                              : 'opacity-100'
                          } ${
                            isRunningInPiP
                              ? 'ring-2 ring-amber-400/70'
                              : isNextUp
                              ? 'ring-1 ring-indigo-400/45 dark:ring-indigo-500/40'
                              : ''
                          }`}
                        >
                          {/* Top Primary Row: Compact Petal Icon + Title & Single-Line Metadata + M3 Morph Check */}
                          <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              <div className={isCheckedOnDate ? 'opacity-75 transition-opacity' : ''}>
                                <PetalShapeBadge
                                  shape={getHabitExpressiveShape(habit.id, idx)}
                                  sizeClass="w-7 h-7"
                                  fillColor={themeStyles.iconBox.backgroundColor as string | undefined}
                                  strokeColor={themeStyles.iconBox.borderColor as string | undefined}
                                >
                                  <span style={{ color: themeStyles.iconBox.color }}>
                                    <IconRenderer icon={habit.icon} className="w-3.5 h-3.5" fallback="✨" />
                                  </span>
                                </PetalShapeBadge>
                              </div>

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center gap-1 min-w-0">
                                  <h4
                                    className={`font-bold text-[13px] sm:text-[13.5px] tracking-tight truncate min-w-0 leading-tight transition-colors ${
                                      isCheckedOnDate
                                        ? 'text-slate-500 dark:text-zinc-400 line-through decoration-slate-400/50'
                                        : safeFontColor ? '' : 'text-slate-900 dark:text-white'
                                    }`}
                                    style={isCheckedOnDate ? undefined : fontInlineStyle}
                                  >
                                    {habit.name}
                                  </h4>
                                  {isNextUp && (
                                    <span
                                      className="text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: `${accent}${isDarkMode ? '28' : '1a'}`,
                                        color: accent,
                                      }}
                                    >
                                      Next
                                    </span>
                                  )}
                                  {isRunningInPiP && (
                                    <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                                      PiP
                                    </span>
                                  )}
                                </div>

                                {/* Single-Line Quiet Unboxed Typographic Metadata */}
                                <div className="flex items-center gap-1 text-[10.5px] leading-none font-medium text-slate-500 dark:text-zinc-400 pt-0.5 flex-nowrap overflow-hidden min-w-0">
                                  <AnimatedStreakBadge
                                    streak={habit.currentStreak || 0}
                                    isCompleted={isCheckedOnDate}
                                    isAnimating={animatingHabitId === habit.id}
                                    size="xs"
                                    showZero={true}
                                  />
                                  {habit.reminderTime && (
                                    <>
                                      <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                      <span className="font-mono text-[10px] tabular-nums shrink-0">
                                        {habit.reminderTime}
                                      </span>
                                    </>
                                  )}
                                  {(habit.durationMinutes || habit.timerMinutes) && (
                                    <>
                                      <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                                        {habit.durationMinutes || habit.timerMinutes}m
                                      </span>
                                    </>
                                  )}
                                  {freqLabel.toLowerCase() !== 'daily' && (
                                    <>
                                      <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                      <span className="capitalize truncate max-w-[68px]">{freqLabel}</span>
                                    </>
                                  )}
                                  {!isScheduled && (
                                    <>
                                      <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                                        Off Day
                                      </span>
                                    </>
                                  )}
                                  <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setExpandedStepId(isExpanded ? null : habit.id);
                                    }}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0"
                                    title={isExpanded ? 'Hide options' : 'Show notes, sub-steps & actions'}
                                  >
                                    {hasSubSteps && (
                                      <>
                                        <SubtaskBranchIcon className="w-2.5 h-2.5 shrink-0" />
                                        <span className="tabular-nums">
                                          {completedSubCount}/{habit.subSteps?.length}
                                        </span>
                                      </>
                                    )}
                                    <ChevronDown
                                      className={`w-3 h-3 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Trailing Action: Timer + M3 Shape-Morph Checkmark OR Restore */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              {habit.archived ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleArchiveOrRemove(routine.id, habit, inRoutineItems)
                                    }
                                    className="h-6.5 px-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition"
                                  >
                                    <ArchiveRestore className="w-3 h-3" />
                                    <span>Restore</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (inRoutineItems) deleteRoutineItem(routine.id, habit.id);
                                      if (habits.some(h => h.id === habit.id)) deleteHabit(habit.id);
                                    }}
                                    className="w-6.5 h-6.5 rounded-full inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
                                    title="Delete permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {Boolean(habit.timerMinutes || habit.durationMinutes) &&
                                    session.activeId === habit.id && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (session.isRunning) pauseSession();
                                          else resumeSession();
                                        }}
                                        className={`h-7 px-2 rounded-full transition cursor-pointer flex items-center gap-1 ${
                                          session.isRunning
                                            ? 'bg-amber-500 text-white animate-pulse'
                                            : 'bg-indigo-600 text-white'
                                        }`}
                                        title={
                                          session.isRunning ? 'Pause focus timer' : 'Resume focus timer'
                                        }
                                      >
                                        {session.isRunning ? (
                                          <Pause className="w-2.5 h-2.5 fill-current" />
                                        ) : (
                                          <Play className="w-2.5 h-2.5 fill-current" />
                                        )}
                                        <span className="text-[10px] font-mono font-bold tabular-nums">
                                          {Math.floor(session.timeRemaining / 60)}:
                                          {(session.timeRemaining % 60).toString().padStart(2, '0')}
                                        </span>
                                      </button>
                                    )}

                                  <div className="relative flex items-center justify-center">
                                    <CheckmarkCelebration
                                      activeKey={celebratingHabitId === habit.id ? celebrationKey : null}
                                      badgeText={`Done🔥 ${Math.max(
                                        1,
                                        (habit.currentStreak || 0) + (isCheckedOnDate ? 0 : 1)
                                      )}D`}
                                      ringColor="border-emerald-500"
                                      align="right"
                                    />
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.86 }}
                                      animate={
                                        animatingHabitId === habit.id
                                          ? { scale: [1, 1.2, 0.94, 1] }
                                          : {}
                                      }
                                      transition={{ duration: 0.32, ease: 'easeOut' }}
                                      onClick={() =>
                                        handleToggleRoutineStep(
                                          routine.id,
                                          habit,
                                          inRoutineItems,
                                          selectedDateStr
                                        )
                                      }
                                      style={
                                        isCheckedOnDate
                                          ? {
                                              backgroundColor: doneCheckBg,
                                              color: doneCheckFg,
                                              boxShadow: `0 2px 8px -2px ${doneCheckBg}66`,
                                            }
                                          : undefined
                                      }
                                      className={`relative w-8 h-8 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                                        isCheckedOnDate
                                          ? 'rounded-full'
                                          : 'rounded-[11px] bg-slate-100/95 dark:bg-zinc-800/90 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-500 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700'
                                      }`}
                                      title={
                                        isCheckedOnDate
                                          ? 'Completed! Tap to uncheck'
                                          : 'Tap to complete step'
                                      }
                                    >
                                      <AnimatedCheckIcon
                                        className={`w-4 h-4 ${
                                          isCheckedOnDate
                                            ? ''
                                            : 'opacity-55 dark:opacity-75 text-slate-500 dark:text-zinc-300'
                                        }`}
                                        strokeWidth={isCheckedOnDate ? 2.8 : 2.2}
                                        animate={animatingHabitId === habit.id}
                                      />
                                    </motion.button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Thin Grey Divider Line (Matching Bills Card Language) + Slim 7D Dots */}
                          <div
                            onClick={e => e.stopPropagation()}
                            className="mt-1 pt-1 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-1"
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 tabular-nums shrink-0">
                              7D · {weekCompletedCount}/7
                            </span>
                            <div className="flex items-center gap-1">
                              {weekDays.map(d => {
                                const isDoneOnDay = Boolean(habit.completionHistory?.[d.dateStr]);
                                const isSelectedDay = d.dateStr === selectedDateStr;
                                const isSunday = d.dayName === 'Sun';

                                return (
                                  <button
                                    key={d.dateStr}
                                    type="button"
                                    onClick={() =>
                                      handleToggleRoutineStep(
                                        routine.id,
                                        habit,
                                        inRoutineItems,
                                        d.dateStr
                                      )
                                    }
                                    title={`${d.dayName} (${d.dateStr}): ${
                                      isDoneOnDay ? 'Completed' : 'Tap to complete'
                                    }`}
                                    className={`w-5 h-5 rounded-full text-[8.5px] font-mono flex items-center justify-center transition-transform cursor-pointer active:scale-90 ${
                                      isDoneOnDay
                                        ? isSunday
                                          ? 'text-white font-black ring-1 ring-rose-400/70'
                                          : 'text-white font-bold'
                                        : isSelectedDay
                                        ? isSunday
                                          ? 'bg-rose-100/90 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 font-black ring-1 ring-rose-400/80'
                                          : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-extrabold ring-1 ring-slate-400/80 dark:ring-zinc-500'
                                        : isSunday
                                        ? 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 font-bold hover:bg-rose-100/80'
                                        : 'bg-slate-100/90 dark:bg-zinc-800/70 text-slate-500 dark:text-zinc-400 font-bold hover:bg-slate-200/70 dark:hover:bg-zinc-700'
                                    }`}
                                    style={
                                      isDoneOnDay
                                        ? { backgroundColor: isSunday ? '#e11d48' : habitAccent }
                                        : undefined
                                    }
                                  >
                                    {d.dayName.charAt(0)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Expandable Material 3 Action & Sub-Step Drawer */}
                          <SmoothCollapse
                            isOpen={isExpanded}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="mt-1 pt-1 border-t border-slate-200/60 dark:border-zinc-800/70 space-y-1">
                              {habit.notes && habit.notes.trim().length > 0 && (
                                <div className="py-1 px-2 rounded-[10px] bg-[#f3f6fc] dark:bg-zinc-900/75 text-[10.5px] font-medium text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                                  <FileText className="w-3 h-3 shrink-0 text-slate-400" />
                                  <span className="truncate">{habit.notes}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <span className="text-[9.5px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                  {hasSubSteps
                                    ? `Checklist (${habit.doneWhen === 'any' ? 'any' : 'all'})`
                                    : 'Step Actions'}
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {(habit.timerMinutes || habit.durationMinutes) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (session.activeId === habit.id) {
                                          if (session.isRunning) pauseSession();
                                          else resumeSession();
                                        } else {
                                          handleStartTimer(habit);
                                        }
                                      }}
                                      className="h-5.5 px-2 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      <span>{habit.timerMinutes || habit.durationMinutes}m</span>
                                    </button>
                                  )}

                                  <CardCalendarButton
                                    item={{
                                      id: habit.id,
                                      title: habit.name,
                                      type: 'habit',
                                      color: habit.color || habit.accentColor,
                                      frequency: habit.frequency,
                                      customDays: habit.customDays,
                                      reminderType:
                                        habit.reminderType ||
                                        (habit.reminderTime ? 'notification' : 'none'),
                                      dueTime: habit.reminderTime,
                                    }}
                                    className="h-5.5 text-[9.5px] px-2 rounded-full"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingHabit(habit);
                                      setTargetRoutineForCreate(routine);
                                      setShowHabitForm(true);
                                    }}
                                    className="h-5.5 px-2 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                    title="Edit step"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleArchiveOrRemove(routine.id, habit, inRoutineItems)
                                    }
                                    className="h-5.5 px-2 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                    title={inRoutineItems ? 'Archive step' : 'Unlink from routine'}
                                  >
                                    {inRoutineItems ? (
                                      <>
                                        <Archive className="w-2.5 h-2.5" />
                                        <span>Archive</span>
                                      </>
                                    ) : (
                                      <>
                                        <Unlink className="w-2.5 h-2.5" />
                                        <span>Unlink</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {hasSubSteps &&
                                habit.subSteps?.map(step => (
                                  <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => {
                                      const updatedSteps =
                                        habit.subSteps?.map(s =>
                                          s.id === step.id ? { ...s, completed: !s.completed } : s
                                        ) || [];
                                      const shouldComplete =
                                        habit.doneWhen === 'any'
                                          ? updatedSteps.some(s => s.completed)
                                          : updatedSteps.length > 0 &&
                                            updatedSteps.every(s => s.completed);
                                      const wasChecked = Boolean(
                                        habit.completionHistory?.[selectedDateStr]
                                      );

                                      updateRoutineItemSubSteps(
                                        routine.id,
                                        habit.id,
                                        updatedSteps,
                                        selectedDateStr
                                      );
                                      if (shouldComplete && !wasChecked) {
                                        triggerToggleCelebration(habit.id, true);
                                      } else {
                                        haptics.toggle();
                                      }
                                    }}
                                    className={`w-full p-1.5 rounded-[10px] flex items-center gap-2 transition text-[11px] text-left cursor-pointer ${
                                      step.completed
                                        ? 'bg-indigo-50/90 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-[#f3f6fc] dark:bg-zinc-900/75 text-slate-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                        step.completed
                                          ? 'bg-indigo-600 border-indigo-600 text-white'
                                          : 'border-slate-300 dark:border-zinc-700'
                                      }`}
                                    >
                                      {step.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                    <span className={step.completed ? 'line-through opacity-75' : ''}>
                                      {step.text}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          </SmoothCollapse>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SmoothCollapse>
            </div>
          );
        })}
      </div>

      {/* Unified HabitFormModal (preserves routine defaultTags, timeOfDay & accent when adding) */}
      <HabitFormModal
        isOpen={showHabitForm}
        onClose={() => {
          setShowHabitForm(false);
          setEditingHabit(null);
          setTargetRoutineForCreate(null);
        }}
        editingHabit={editingHabit}
        defaultTags={
          targetRoutineForCreate ? [targetRoutineForCreate.name, 'routine'] : ['routine']
        }
        defaultTimeOfDay={
          targetRoutineForCreate
            ? targetRoutineForCreate.timeOfDay === 'custom'
              ? 'anytime'
              : targetRoutineForCreate.timeOfDay
            : undefined
        }
        defaultColor={
          targetRoutineForCreate ? getRoutineColor(targetRoutineForCreate) : undefined
        }
      />

      {/* Unified HabitDetailModal (full streak/heatmap/edit experience) */}
      <AnimatePresence>
        {selectedDetailHabit && (
          <HabitDetailModal
            key={selectedDetailHabit.id}
            habit={selectedDetailHabit}
            onClose={() => setSelectedDetailHabit(null)}
            onEdit={h => {
              setSelectedDetailHabit(null);
              setEditingHabit(h);
              setShowHabitForm(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Archive / Unlink Step Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveTarget)}
        itemName={pendingArchiveTarget?.habit.name}
        itemType={pendingArchiveTarget?.isLinkedOnly ? 'Routine Link' : 'Routine Step'}
        onConfirm={confirmArchiveOrUnlink}
        onCancel={() => setPendingArchiveTarget(null)}
      />

      {/* Delete Custom Routine Confirmation */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingDeleteRoutine)}
        itemName={pendingDeleteRoutine?.name}
        itemType="Routine"
        onConfirm={() => {
          if (pendingDeleteRoutine) {
            deleteRoutine(pendingDeleteRoutine.id);
            pushNotification(
              'Routine Removed',
              `"${pendingDeleteRoutine.name}" was removed.`,
              'habit'
            );
            setPendingDeleteRoutine(null);
          }
        }}
        onCancel={() => setPendingDeleteRoutine(null)}
      />

      {/* Add or Link Habit to Routine Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {stepPickerRoutine && (
              <div
                key="routine-step-picker-root"
                data-unified-modal="true"
                className={UNIFIED_MODAL_POSITION_CLASS}
              >
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
                  exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
                  className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
                  onClick={() => setStepPickerRoutine(null)}
                />
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
                  exit={{ opacity: 0, y: 8, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
                  transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                  onClick={e => e.stopPropagation()}
                  className="relative z-10 w-full max-w-md bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 rounded-t-[26px] sm:rounded-[24px] p-4 shadow-2xl space-y-3 max-h-[82dvh] flex flex-col"
                >
                  <div className="flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        Add to {stepPickerRoutine.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Create a new habit or link an existing habit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStepPickerRoutine(null)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Create New Habit button */}
                  <button
                    type="button"
                    onClick={() => {
                      const routine = stepPickerRoutine;
                      setStepPickerRoutine(null);
                      setEditingHabit(null);
                      setTargetRoutineForCreate(routine);
                      setShowHabitForm(true);
                    }}
                    className="w-full py-2.5 px-3.5 rounded-[16px] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shrink-0 shadow-2xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Create New Habit in {stepPickerRoutine.name}</span>
                  </button>

                  {/* Link Existing Habits List */}
                  <div className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 block">
                      Link / Unlink Existing Habits
                    </span>
                    {habits.filter(h => !h.archived).length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 py-4 text-center">
                        No habits created yet.
                      </p>
                    ) : (
                      habits
                        .filter(h => !h.archived)
                        .map(h => {
                          const rName = stepPickerRoutine.name.toLowerCase().trim();
                          const isLinked =
                            stepPickerRoutine.items.some(
                              i =>
                                i.id === h.id ||
                                i.title.toLowerCase().trim() === h.name.toLowerCase().trim()
                            ) || Boolean(h.tags?.some(t => t.toLowerCase().trim() === rName));

                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => handleToggleLinkExistingHabit(stepPickerRoutine, h)}
                              className={`w-full p-2 rounded-[14px] flex items-center justify-between gap-2 text-left transition cursor-pointer border ${
                                isLinked
                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/35 border-indigo-200 dark:border-indigo-800/70'
                                  : 'bg-[#f3f6fc] dark:bg-zinc-900/70 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-base shrink-0">{h.icon || '🎯'}</span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {h.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                    {h.reminderTime ? `${h.reminderTime} · ` : ''}
                                    {h.currentStreak || 0}d streak
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                  isLinked
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700'
                                }`}
                              >
                                {isLinked ? (
                                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                                ) : (
                                  <Link2 className="w-3 h-3" />
                                )}
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Create New Custom Routine Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isCreateRoutineOpen && (
              <div
                key="create-routine-modal-root"
                data-unified-modal="true"
                className={UNIFIED_MODAL_POSITION_CLASS}
              >
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
                  exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
                  className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
                  onClick={onCloseCreateRoutine}
                />
                <motion.form
                  onSubmit={handleCreateRoutineSubmit}
                  data-unified-modal="true"
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
                  exit={{ opacity: 0, y: 8, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
                  transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                  onClick={e => e.stopPropagation()}
                  className="relative z-10 w-full max-w-sm bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 rounded-t-[26px] sm:rounded-[24px] p-4 shadow-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Create New Routine
                    </h4>
                    <button
                      type="button"
                      onClick={onCloseCreateRoutine}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                      Routine Name
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g., Deep Work Warmup, Workout Flow..."
                      value={newRoutineName}
                      onChange={e => setNewRoutineName(e.target.value)}
                      className="w-full h-9 px-3 rounded-[12px] bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                      Time Window & Theme
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ROUTINE_ACCENTS.map(opt => {
                        const active = newRoutineTimeOfDay === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setNewRoutineTimeOfDay(opt.id);
                              setNewRoutineIcon(opt.icon);
                              setNewRoutineColor(opt.color);
                            }}
                            className={`py-2 px-2.5 rounded-[12px] text-xs font-bold flex items-center gap-2 transition cursor-pointer border ${
                              active
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 text-indigo-700 dark:text-indigo-200'
                                : 'bg-[#f3f6fc] dark:bg-zinc-900 border-transparent text-slate-700 dark:text-zinc-300 hover:bg-slate-200/60'
                            }`}
                          >
                            <span>{opt.icon}</span>
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={onCloseCreateRoutine}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-2xs"
                    >
                      Create Routine
                    </button>
                  </div>
                </motion.form>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
