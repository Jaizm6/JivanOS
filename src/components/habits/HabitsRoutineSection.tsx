import React, { useState, useMemo } from 'react';
import {
  Plus,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Play,
  Pause,
  Edit3,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { Routine, RoutineItem, Habit } from '../../types';
import { IconRenderer } from '../common/IconRenderer';
import { ActivityManager } from '../common/ActivityManager';
import { HabitDetailModal } from './HabitDetailModal';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { getCardThemeStyles, getFontInlineStyle } from '../../utils/activityStyles';
import { haptics } from '../../utils/haptics';
import { motion } from 'framer-motion';

export const HabitsRoutineSection: React.FC = () => {
  const {
    routines,
    habits,
    toggleRoutineItem,
    addRoutineItem,
    deleteRoutineItem,
    deleteHabit,
    toggleHabitDay,
    soundEngine,
    selectedDate: selectedDateStr,
  } = useApp();

  const { session, startSession, pauseSession, resumeSession, sessions } = useActiveSession();

  const [collapsedRoutines, setCollapsedRoutines] = useState<Record<string, boolean>>({});
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [activeRoutineForAdd, setActiveRoutineForAdd] = useState<Routine | null>(null);

  // Micro-interaction states for checkmark celebrations
  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null);
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const toggleCollapse = (id: string) => {
    setCollapsedRoutines(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getRoutineIcon = (r: Routine) => {
    if (r.timeOfDay === 'morning') return <Sun className="w-5 h-5 text-amber-500" />;
    if (r.timeOfDay === 'evening') return <Moon className="w-5 h-5 text-indigo-400" />;
    return <Heart className="w-5 h-5 text-rose-400" />;
  };

  const getRoutineColor = (r: Routine) => {
    if (r.timeOfDay === 'morning') return '#f59e0b';
    if (r.timeOfDay === 'evening') return '#6366f1';
    return '#ec4899';
  };

  /**
   * Unifies RoutineItem into a full-featured Habit representation
   * so every item in the routine possesses full habit capabilities (theming, streaks, modals, timer, form).
   */
  const getHabitForItem = (item: RoutineItem, routine: Routine): Habit => {
    const todayStr = selectedDateStr || new Date().toISOString().split('T')[0];
    const defaultColor = getRoutineColor(routine);

    const found = habits.find(
      h => h.id === item.id || h.name.toLowerCase().trim() === item.title.toLowerCase().trim()
    );

    if (found) {
      return {
        ...found,
        reminderTime: found.reminderTime || item.scheduledTime,
        durationMinutes: found.durationMinutes || item.durationMinutes || found.timerMinutes,
        timerMinutes: found.timerMinutes || item.durationMinutes,
        targetTimeOfDay: found.targetTimeOfDay || (routine.timeOfDay === 'custom' ? 'anytime' : routine.timeOfDay),
        fontColor: found.fontColor !== undefined ? found.fontColor : item.fontColor,
        accentColor: found.accentColor || item.accentColor || defaultColor,
        color: found.color || item.color || defaultColor,
        isBold: found.isBold !== undefined ? found.isBold : (item.isBold ?? true),
        cardTheme: 'clean',
      };
    }

    return {
      id: item.id,
      name: item.title,
      icon: item.icon || (routine.timeOfDay === 'morning' ? '🌅' : routine.timeOfDay === 'evening' ? '🌙' : '💆'),
      category: (routine.timeOfDay === 'morning' ? 'routine' : routine.timeOfDay === 'evening' ? 'routine' : 'health') as any,
      frequency: 'daily',
      targetDaysPerWeek: 7,
      targetTimeOfDay: routine.timeOfDay === 'custom' ? 'anytime' : routine.timeOfDay,
      reminderTime: item.scheduledTime,
      timerMinutes: item.durationMinutes,
      durationMinutes: item.durationMinutes,
      currentStreak: item.completed ? 1 : 0,
      bestStreak: 1,
      completionHistory: { [todayStr]: Boolean(item.completed) },
      color: item.color || defaultColor,
      accentColor: item.accentColor || defaultColor,
      cardTheme: 'clean',
      fontColor: item.fontColor,
      isBold: item.isBold ?? true,
      tags: item.tags || [routine.name, 'routine'],
      createdAt: '2026-08-01',
    };
  };

  const handleStartTimer = (habit: Habit) => {
    const mins = habit.timerMinutes || habit.durationMinutes || 15;
    startSession(habit.id, 'habit', habit.name, 'focus', mins * 60);
  };

  const handleToggleHabit = (routineId: string, habit: Habit) => {
    const todayStr = selectedDateStr || new Date().toISOString().split('T')[0];
    const isCompleted = Boolean(habit.completionHistory?.[todayStr]);
    const nextCompleted = !isCompleted;

    // 1. If present in habits list, toggle via habit day history
    const foundInHabits = habits.find(h => h.id === habit.id);
    if (foundInHabits) {
      toggleHabitDay(habit.id, todayStr);
    }

    // 2. If present in routine items, toggle routine completion
    const targetRoutine = routines.find(r => r.id === routineId);
    const itemInRoutine = targetRoutine?.items.find(
      i => i.id === habit.id || i.title.toLowerCase().trim() === habit.name.toLowerCase().trim()
    );
    if (itemInRoutine && targetRoutine) {
      toggleRoutineItem(targetRoutine.id, itemInRoutine.id);
    }

    // 3. Audio & animations
    setAnimatingHabitId(habit.id);
    if (nextCompleted) {
      setCelebratingHabitId(habit.id);
      setCelebrationKey(prev => prev + 1);
      try {
        soundEngine.playWaterDropNotification();
        haptics.complete();
      } catch {}
      setTimeout(() => setAnimatingHabitId(null), 450);
      setTimeout(() => setCelebratingHabitId(null), 1400);
    } else {
      try {
        haptics.toggle();
      } catch {}
      setTimeout(() => setAnimatingHabitId(null), 300);
    }
  };

  const handleDeleteHabit = (routineId: string, habitId: string) => {
    deleteRoutineItem(routineId, habitId);
    if (habits.some(h => h.id === habitId)) {
      deleteHabit(habitId);
    }
  };

  const openAddHabitForRoutine = (routine: Routine) => {
    const routineColor = getRoutineColor(routine);
    setActiveRoutineForAdd(routine);
    setEditingHabit({
      id: '',
      name: '',
      category: (routine.timeOfDay === 'morning' ? 'routine' : routine.timeOfDay === 'evening' ? 'routine' : 'health') as any,
      frequency: 'daily',
      targetDaysPerWeek: 7,
      targetTimeOfDay: routine.timeOfDay === 'custom' ? 'anytime' : routine.timeOfDay,
      color: routineColor,
      accentColor: routineColor,
      cardTheme: 'clean',
      isBold: true,
      tags: [routine.name, 'routine'],
      currentStreak: 0,
      bestStreak: 0,
      completionHistory: {},
      createdAt: new Date().toISOString(),
    } as Habit);
    setShowHabitForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-indigo-950/40 p-4 sm:p-5 rounded-3xl border border-emerald-500/20">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Daily Routines & Rituals
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Seamlessly build structured morning, evening, and wellness routines with full Habit features, timers, and detail tracking.
          </p>
        </div>
      </div>

      {/* Routine Cards List */}
      <div className="space-y-5">
        {routines.map(routine => {
          const todayStr = selectedDateStr || new Date().toISOString().split('T')[0];

          // Combine items in routine with any habits tagged with this routine
          const routineHabits: Habit[] = (() => {
            const itemHabits = routine.items.map(item => getHabitForItem(item, routine));
            const taggedHabits = habits.filter(
              h =>
                h.tags?.some(t => t.toLowerCase() === routine.name.toLowerCase()) &&
                !itemHabits.some(ih => ih.id === h.id || ih.name.toLowerCase() === h.name.toLowerCase())
            );
            return [...itemHabits, ...taggedHabits];
          })();

          const completedCount = routineHabits.filter(h => Boolean(h.completionHistory?.[todayStr])).length;
          const totalCount = routineHabits.length;
          const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const isCollapsed = collapsedRoutines[routine.id] || false;
          const routineAccent = getRoutineColor(routine);

          return (
            <div
              key={routine.id}
              className="bg-white dark:bg-zinc-900/90 rounded-3xl border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 shadow-xs transition-all hover:border-indigo-500/40"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-2xs border"
                    style={{
                      backgroundColor: `${routineAccent}18`,
                      borderColor: `${routineAccent}40`,
                    }}
                  >
                    <IconRenderer icon={routine.icon} className="w-5 h-5" fallback={getRoutineIcon(routine)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base truncate">
                        {routine.name}
                      </h4>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 shrink-0">
                        {completedCount}/{totalCount}
                      </span>
                    </div>
                    {/* Routine Completion Progress Bar */}
                    <div className="w-full max-w-xs bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: routineAccent,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleCollapse(routine.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    title={isCollapsed ? 'Expand routine' : 'Collapse routine'}
                  >
                    {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Items List (Full-featured Habit Cards) */}
              {!isCollapsed && (
                <div className="mt-4 space-y-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                  {routineHabits.map(habit => {
                    const isCheckedToday = Boolean(habit.completionHistory?.[todayStr]);
                    const habitAccent = habit.accentColor || habit.color || routineAccent;
                    const themeStyles = getCardThemeStyles(habitAccent, 'clean');
                    const fontInlineStyle = getFontInlineStyle({
                      fontColor: habit.fontColor,
                      fallbackColor: habit.fontColor ? habit.fontColor : undefined,
                      isBold: habit.isBold,
                    });
                    const isRunningInPiP = session.activeId === habit.id || (sessions && sessions.some(s => s.activeId === habit.id));

                    return (
                      <div
                        key={habit.id}
                        onClick={() => setSelectedDetailHabit(habit)}
                        style={themeStyles.cardStyle}
                        className={`relative rounded-xl transition-all duration-200 py-2 px-2.5 sm:py-2.5 sm:px-3 flex flex-col gap-1 shadow-2xs hover:shadow-xs cursor-pointer bg-white dark:bg-zinc-900 ${
                          isRunningInPiP
                            ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/50 shadow-md'
                            : ''
                        } ${isCheckedToday ? 'opacity-95' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between gap-3 pl-0">
                          {/* Left: Icon, Title, Streak, Time */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs border"
                              style={themeStyles.iconBox}
                            >
                              <IconRenderer icon={habit.icon} className="w-4.5 h-4.5 sm:w-5 sm:h-5" fallback="🎯" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4
                                  className={`font-black text-xs sm:text-base font-sans tracking-tight truncate leading-snug transition-colors ${
                                    habit.fontColor ? '' : 'text-slate-900 dark:text-white'
                                  }`}
                                  style={fontInlineStyle}
                                >
                                  {habit.name}
                                </h4>
                                {isRunningInPiP && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 rounded-full shrink-0">
                                    <span className="w-1.2 h-1.2 rounded-full bg-amber-500 animate-ping inline-block" />
                                    PiP Active
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[10.5px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400 pt-0.5 flex-wrap">
                                <AnimatedStreakBadge
                                  streak={habit.currentStreak || 0}
                                  isCompleted={isCheckedToday}
                                  isAnimating={animatingHabitId === habit.id}
                                  size="xs"
                                  showZero={true}
                                />
                                {habit.reminderTime && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[10.5px] font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                                      {habit.reminderTime}
                                    </span>
                                  </>
                                )}
                                {(habit.durationMinutes || habit.timerMinutes) && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                                      <Clock className="w-3 h-3 text-emerald-500" />
                                      {habit.durationMinutes || habit.timerMinutes}m
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Timer, Checkmark, Actions */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            {/* Focus Timer Button */}
                            {Boolean(habit.timerMinutes || habit.durationMinutes) && (
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
                                className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                                  session.activeId === habit.id && session.isRunning
                                    ? 'bg-amber-500 text-white animate-pulse'
                                    : session.activeId === habit.id
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                                }`}
                                title={
                                  session.activeId === habit.id
                                    ? session.isRunning
                                      ? 'Pause focus timer'
                                      : 'Resume focus timer'
                                    : `Start ${habit.timerMinutes || habit.durationMinutes}m focus timer`
                                }
                              >
                                {session.activeId === habit.id && session.isRunning ? (
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                                {session.activeId === habit.id && (
                                  <span className="text-[10px] font-mono font-bold">
                                    {Math.floor(session.timeRemaining / 60)}:
                                    {(session.timeRemaining % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </button>
                            )}

                            {/* Checkmark Celebration Button */}
                            <div className="relative flex items-center justify-center">
                              <CheckmarkCelebration
                                activeKey={celebratingHabitId === habit.id ? celebrationKey : null}
                                badgeText={`Done🔥 ${Math.max(1, (habit.currentStreak || 0) + (isCheckedToday ? 0 : 1))}D`}
                                ringColor="border-emerald-500"
                                align="right"
                              />
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.85 }}
                                animate={animatingHabitId === habit.id ? { scale: [1, 1.22, 0.94, 1] } : {}}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                                onClick={() => handleToggleHabit(routine.id, habit)}
                                className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer ${
                                  isCheckedToday
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-slate-100 dark:bg-zinc-800/90 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/60 text-slate-400 dark:text-zinc-300 border border-slate-200/70 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-500'
                                }`}
                                title={isCheckedToday ? 'Completed! Click to uncheck' : 'Click to check off'}
                              >
                                {isCheckedToday ? (
                                  <AnimatedCheckIcon
                                    className="w-5 h-5 text-white"
                                    strokeWidth={2.75}
                                    animate={animatingHabitId === habit.id}
                                  />
                                ) : (
                                  <AnimatedCheckIcon
                                    className="w-5 h-5 stroke-[2] opacity-50 dark:opacity-75 text-slate-500 dark:text-zinc-300"
                                    strokeWidth={2.2}
                                    animate={false}
                                  />
                                )}
                              </motion.button>
                            </div>

                            {/* Edit in HabitForm */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingHabit(habit);
                                setShowHabitForm(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                              title="Edit habit in HabitForm"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteHabit(routine.id, habit.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                              title="Delete habit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom Micro Progress Bar Track */}
                        <div className="absolute bottom-0 inset-x-2 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden pointer-events-none">
                          <div
                            className="h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                            style={{
                              width: `${isCheckedToday ? 100 : 0}%`,
                              backgroundColor: habitAccent,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Habit to Routine using HabitForm */}
                  <button
                    onClick={() => openAddHabitForRoutine(routine)}
                    className="w-full py-2.5 mt-3 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Habit to {routine.name} (Open HabitForm)</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Real HabitForm (ActivityManager) Modal */}
      {showHabitForm && (
        <ActivityManager
          isOpen={showHabitForm}
          onClose={() => {
            setShowHabitForm(false);
            setEditingHabit(null);
            setActiveRoutineForAdd(null);
          }}
          type="habit"
          activityToEdit={editingHabit}
        />
      )}

      {/* Real Habit Detail Modal with Heatmap, Streaks, Notes, and Edit */}
      {selectedDetailHabit && (
        <HabitDetailModal
          habit={selectedDetailHabit}
          onClose={() => setSelectedDetailHabit(null)}
          onEdit={h => {
            setSelectedDetailHabit(null);
            setEditingHabit(h);
            setShowHabitForm(true);
          }}
        />
      )}
    </div>
  );
};
