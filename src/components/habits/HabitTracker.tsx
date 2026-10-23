import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Flame,
  Plus,
  Check,
  Calendar as CalendarIcon,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Edit2,
  TrendingUp,
  Award,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  Tag,
  X,
  BarChart3,
  Droplets,
  Moon,
  Dumbbell,
  Heart,
  Minus,
  Quote,
  RefreshCw,
  Zap,
  Bell,
  AlarmClock,
  Target,
  ChevronDown,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { Habit, HabitCategory, HabitFrequency, HabitType, ReminderType } from '../../types';
import { soundEngine } from '../../utils/audio';
import { HabitsRoutineSection } from './HabitsRoutineSection';
import {
  getCardThemeStyles,
  getFontInlineStyle,
  getFontSizeClass,
  getFontTypeClass,
  isWhiteColor,
  isBlackColor,
} from '../../utils/activityStyles';
import { HabitsSelfCareSection } from './HabitsSelfCareSection';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';
import { HabitsReportSection } from './HabitsReportSection';
import { IconRenderer } from '../common/IconRenderer';
import { QuoteBanner } from '../common/QuoteBanner';
import { ActivityManager } from '../common/ActivityManager';
import { HabitDetailModal } from './HabitDetailModal';
import { formatLocalDate } from '../../utils/date';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { isHabitScheduledForDate, getHabitFrequencyLabel } from '../../utils/habitSchedule';
import { haptics } from '../../utils/haptics';
import { motion } from 'framer-motion';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { CircularProgress } from '../common/CircularProgress';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';

export const HabitTracker: React.FC = () => {
  const { habits, addHabit, updateHabit, deleteHabit, toggleHabitDay, updateHabitCounter, updateHabitSubSteps, soundEngine, selectedDate: selectedDateStr, setSelectedDate: setSelectedDateStr, tags, hydration, addWater, openEntitiesModal } = useApp();
  const { session, sessions, startSession, pauseSession, resumeSession, stopSession } = useActiveSession();

  const currentTotalMl = hydration?.todayLogs?.reduce((acc, curr) => acc + (curr.amountMl || 0), 0) || 0;
  const targetMl = hydration?.targetMl || 3000;

  // Navigation tab: 'habits' | 'routines' | 'selfcare' | 'reports'
  const [activeTab, setActiveTab] = useState<'habits' | 'routines' | 'selfcare' | 'reports'>('habits');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [habitSort, setHabitSort] = useState<'custom' | 'alphabetical' | 'completion' | 'recent'>('custom');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [expandedSubStepHabitId, setExpandedSubStepHabitId] = useState<string | null>(null);
  const [showQuickTypePicker, setShowQuickTypePicker] = useState(false);

  // Quick Daily Counters State
  const [waterGlasses, setWaterGlasses] = useState(() => {
    try {
      const saved = localStorage.getItem('omni_quick_water');
      return saved ? Number(saved) : 4;
    } catch {
      return 4;
    }
  });
  const [sleepHours, setSleepHours] = useState(() => {
    try {
      const saved = localStorage.getItem('omni_quick_sleep');
      return saved ? Number(saved) : 7.5;
    } catch {
      return 7.5;
    }
  });
  const [exerciseMins, setExerciseMins] = useState(() => {
    try {
      const saved = localStorage.getItem('omni_quick_exercise');
      return saved ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });

  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null);
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState<number>(0);

  const animationTimeoutRef = useRef<any>(null);
  const celebrationTimeoutRef = useRef<any>(null);
  const clearAnimatingTimeoutRef = useRef<any>(null);
  const clearCelebratingTimeoutRef = useRef<any>(null);

  const clearAllToggleTimeouts = () => {
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    if (clearAnimatingTimeoutRef.current) clearTimeout(clearAnimatingTimeoutRef.current);
    if (clearCelebratingTimeoutRef.current) clearTimeout(clearCelebratingTimeoutRef.current);
  };

  useEffect(() => {
    return () => {
      clearAllToggleTimeouts();
    };
  }, []);

  const handleToggleHabitWithAnimation = (habitId: string, dateStr: string) => {
    const habit = habits.find(h => h.id === habitId);
    const wasChecked = !!habit?.completionHistory?.[dateStr];

    clearAllToggleTimeouts();

    setAnimatingHabitId(null);
    setCelebratingHabitId(null);

    toggleHabitDay(habitId, dateStr, { skipSound: true });
    if (!wasChecked) {
      animationTimeoutRef.current = setTimeout(() => {
        setAnimatingHabitId(habitId);
      }, 20);
      try {
        soundEngine.playWaterDropNotification();
        haptics.complete();
      } catch {}
      celebrationTimeoutRef.current = setTimeout(() => {
        setCelebratingHabitId(habitId);
        setCelebrationKey(prev => prev + 1);
      }, 280);
      clearAnimatingTimeoutRef.current = setTimeout(() => setAnimatingHabitId(null), 450);
      clearCelebratingTimeoutRef.current = setTimeout(() => setCelebratingHabitId(null), 1400);
    } else {
      setCelebratingHabitId(null);
      setAnimatingHabitId(null);
      haptics.toggle();
    }
  };

  // Date strip offset & selected date
  const [dateOffset, setDateOffset] = useState(0); // in weeks
  const todayStr = formatLocalDate();

  // Form State for modal
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('fitness');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(7);
  const [habitType, setHabitType] = useState<HabitType>('boolean');
  const [timerMinutes, setTimerMinutes] = useState<string>('30');
  const [unit, setUnit] = useState('min');
  const [targetCount, setTargetCount] = useState<number>(0);
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('🎯');
  const [notes, setNotes] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('notification');

  // Weekly Date strip generation (7 days according to dateOffset)
  const weekDays = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNumber: string; isToday: boolean; isSelected: boolean }[] = [];
    const base = new Date();
    base.setDate(base.getDate() + dateOffset * 7);

    // Get Sunday of current week
    const currentDayOfWeek = base.getDay();
    const sunday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - currentDayOfWeek);

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      const dStr = formatLocalDate(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = d.getDate().toString();
      days.push({
        dateStr: dStr,
        dayName,
        dayNumber,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }
    return days;
  }, [dateOffset, todayStr, selectedDateStr]);

  const [customHabits, setCustomHabits] = useState<Habit[]>(habits);
  useEffect(() => {
    setCustomHabits(habits);
  }, [habits]);

  const [activeNoteHabitId, setActiveNoteHabitId] = useState<string | null>(null);
  const [habitNoteInput, setHabitNoteInput] = useState<string>('');

  const handleReorderHabits = (draggedId: string, targetId: string) => {
    const idx1 = customHabits.findIndex(h => h.id === draggedId);
    const idx2 = customHabits.findIndex(h => h.id === targetId);
    if (idx1 === -1 || idx2 === -1) return;
    const updated = [...customHabits];
    const [moved] = updated.splice(idx1, 1);
    updated.splice(idx2, 0, moved);
    setCustomHabits(updated);
    updated.forEach((h, index) => {
      if (h.order !== index) {
        updateHabit({ ...h, order: index });
      }
    });
  };

  // All unique tags across all habits
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    habits.forEach(h => {
      (h.tags || []).forEach(t => t && set.add(t));
      if ((!h.tags || h.tags.length === 0) && h.category) {
        set.add(h.category.charAt(0).toUpperCase() + h.category.slice(1));
      }
    });
    return Array.from(set).sort();
  }, [habits]);

  // Filtered & Sorted habits
  const filteredHabits = useMemo(() => {
    let list = customHabits.filter(h => {
      if (selectedCategory === 'all') return true;
      const tagMatch = h.tags?.some(t => t.toLowerCase() === selectedCategory.toLowerCase());
      const catMatch = h.category?.toLowerCase() === selectedCategory.toLowerCase();
      return tagMatch || catMatch;
    });
    if (habitSort === 'alphabetical') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (habitSort === 'completion') {
      list = [...list].sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));
    } else if (habitSort === 'recent') {
      list = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (habitSort === 'custom') {
      list = [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return list;
  }, [customHabits, selectedCategory, habitSort]);

  // Group habits by Tag (Replacing Category grouping as requested)
  const habitsByTag = useMemo(() => {
    const groups: Record<string, Habit[]> = {};
    filteredHabits.forEach(h => {
      const primaryTag = (h.tags && h.tags.length > 0)
        ? h.tags[0]
        : (h.category ? (h.category.charAt(0).toUpperCase() + h.category.slice(1)) : 'General');
      const tagLabel = primaryTag.startsWith('#') ? primaryTag : `#${primaryTag}`;
      if (!groups[tagLabel]) groups[tagLabel] = [];
      groups[tagLabel].push(h);
    });
    return groups;
  }, [filteredHabits]);

  // Today's completed habits calculation
  const completedTodayCount = habits.filter(h => !!h.completionHistory?.[selectedDateStr]).length;
  const totalHabitsCount = habits.length;
  const todayProgressPercent = totalHabitsCount > 0 ? Math.round((completedTodayCount / totalHabitsCount) * 100) : 0;
  const activeStreaksCount = habits.filter(h => (h.currentStreak || 0) > 0).length;

  // Auto log habit when active habit session hits 0
  useEffect(() => {
    if (session.type === 'habit' && session.activeId && !session.isRunning && session.timeRemaining === 0 && session.initialDuration > 0) {
      const activeHabitId = session.activeId;
      toggleHabitDay(activeHabitId, selectedDateStr);
      soundEngine.playWaterDropNotification();
      stopSession();
    }
  }, [session.type, session.activeId, session.isRunning, session.timeRemaining, session.initialDuration, toggleHabitDay, selectedDateStr, soundEngine, stopSession]);

  // Ensure habit is visible if jumped to from PiP widget
  useEffect(() => {
    const handleJumpToHabit = (e: Event) => {
      const customEv = e as CustomEvent<{ habitId: string }>;
      const habitId = customEv.detail?.habitId;
      if (!habitId) return;
      if (selectedCategory !== 'all') {
        setSelectedCategory('all');
      }
    };
    window.addEventListener('omni-jump-to-habit', handleJumpToHabit);
    return () => window.removeEventListener('omni-jump-to-habit', handleJumpToHabit);
  }, [selectedCategory]);

  const handleStartTimer = (habit: Habit) => {
    const mins = habit.timerMinutes || habit.durationMinutes || 15;
    startSession(habit.id, 'habit', habit.name, 'focus', mins * 60);
  };

  const openAddModal = () => {
    setEditingHabit(null);
    setShowAddModal(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setShowAddModal(true);
  };

  const scrollToSection = (secId: string, tab: 'habits' | 'routines' | 'selfcare' | 'reports') => {
    setActiveTab(tab);
    haptics.toggle();
  };

  const handleSaveHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedMins = habitType === 'timer' && timerMinutes ? parseInt(timerMinutes, 10) : undefined;

    if (editingHabit) {
      updateHabit({
        ...editingHabit,
        name: name.trim(),
        category,
        frequency,
        targetDaysPerWeek,
        habitType,
        timerMinutes: parsedMins,
        durationMinutes: parsedMins,
        unit: habitType === 'quit' || habitType === 'counter' ? unit : undefined,
        targetCount: habitType === 'quit' || habitType === 'counter' ? targetCount : undefined,
        icon,
        color,
        notes: notes.trim() || undefined,
        reminderTime: reminderTime.trim() || undefined,
        reminderType: reminderTime.trim() ? reminderType : undefined,
      });
    } else {
      addHabit({
        name: name.trim(),
        category,
        frequency,
        targetDaysPerWeek,
        habitType,
        timerMinutes: parsedMins,
        durationMinutes: parsedMins,
        unit: habitType === 'quit' || habitType === 'counter' ? unit : undefined,
        targetCount: habitType === 'quit' || habitType === 'counter' ? targetCount : undefined,
        counterValue: 0,
        icon,
        color,
        notes: notes.trim() || undefined,
        reminderTime: reminderTime.trim() || undefined,
        reminderType: reminderTime.trim() ? reminderType : undefined,
      });
    }

    setShowAddModal(false);
  };

  return (
    <div className="space-y-2.5 sm:space-y-3 max-w-6xl mx-auto pb-8">
      {/* Habits Page Title Banner */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-zinc-900 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
            <Flame className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight truncate">
                Habits Tracker
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {activeStreaksCount} active
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-zinc-400 font-normal leading-tight truncate">
              Track habits, streaks, and routines
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => openEntitiesModal('tags')}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer flex items-center justify-center"
            title="Manage Tags Hub"
          >
            <Tag className="w-4 h-4 text-emerald-500" />
          </button>
          <button
            onClick={() => openAddModal()}
            className="p-1.5 sm:p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8"
            title="Add Habit"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget (Positioned under the top habits header) */}
      <QuoteBanner />

      {/* Scrollable Compact Date Strip with Custom Shape & Dual-Tone Color Picker */}
      <ScrollableCompactDateStrip selectedDateStr={selectedDateStr} onSelectDate={setSelectedDateStr} className="my-1.5" />

      {/* Daily Summary & Quick Counters Banner Card */}
      <div className="bg-white dark:bg-black rounded-xl border border-slate-200/80 dark:border-zinc-900 p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Daily Completion
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {completedTodayCount} of {totalHabitsCount} completed
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-64 sm:w-80 bg-slate-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${todayProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Status Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const prefUnit = (hydration?.preferredUnit || 'ml').toLowerCase().trim();
              const isLitre = prefUnit === 'l' || prefUnit === 'litre' || prefUnit === 'litres';
              const isGlasses = prefUnit === 'glasses' || prefUnit === 'glass' || prefUnit === 'gl';

              const currentDisplay = isLitre
                ? `${(currentTotalMl / 1000).toFixed(1).replace(/\.0$/, '')}L`
                : isGlasses
                  ? `${currentTotalMl % 250 === 0 ? Math.round(currentTotalMl / 250) : (currentTotalMl / 250).toFixed(1)} gl`
                  : `${currentTotalMl}ml`;

              const targetDisplay = isLitre
                ? `${(targetMl / 1000).toFixed(1).replace(/\.0$/, '')}L`
                : isGlasses
                  ? `${Math.round(targetMl / 250)} gl`
                  : `${targetMl}ml`;

              return (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900 text-xs font-bold text-sky-700 dark:text-sky-300"
                  title="Water intake details"
                >
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  <span>Water: {currentDisplay}/{targetDisplay}</span>
                </div>
              );
            })()}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Sleep: {sleepHours}h</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Dumbbell className="w-3.5 h-3.5 text-emerald-500" />
              <span>Exercise: {exerciseMins}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Segmented Navigation Bar (Jump-To Scroll Anchors) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 shadow-xs">
        <button
          onClick={() => scrollToSection('habits', 'habits')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 cursor-pointer ${
            activeTab === 'habits'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          <span>🔥 Habits</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeTab === 'habits' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}>
            {habits.length}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('routines', 'routines')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 cursor-pointer ${
            activeTab === 'routines'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          <span>✨ Routines</span>
        </button>

        <button
          onClick={() => scrollToSection('selfcare', 'selfcare')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 cursor-pointer ${
            activeTab === 'selfcare'
              ? 'bg-rose-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          <span>💚 Self-Care</span>
        </button>

        <button
          onClick={() => scrollToSection('reports', 'reports')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Reports</span>
        </button>
      </div>

      {/* SEGMENTED TAB CONTENT VIEWS */}
      {activeTab === 'habits' && (
        <div id="section-habits" className="space-y-4">
          <div className="bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 p-3 sm:p-4 shadow-2xs space-y-3.5">
            {/* Tags Filter Dropdown & Sorting Dropdown */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Daily Habits</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedCategory}
                  onChange={e => {
                    haptics.toggle();
                    setSelectedCategory(e.target.value);
                  }}
                  className="px-2 py-1 rounded-xl text-[11px] font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
                  title="Filter by Tag"
                >
                  <option value="all">🏷️ All Tags ({habits.length})</option>
                  {allUniqueTags.map(t => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>

                <select
                  value={habitSort}
                  onChange={e => {
                    haptics.toggle();
                    setHabitSort(e.target.value as any);
                  }}
                  className="px-2 py-1 rounded-xl text-[11px] font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-900 text-slate-700 dark:text-zinc-300 focus:outline-hidden shrink-0 cursor-pointer"
                >
                  <option value="custom">Sort: Default</option>
                  <option value="alphabetical">Sort: A-Z</option>
                  <option value="completion">Sort: Streak</option>
                  <option value="recent">Sort: New</option>
                </select>
              </div>
            </div>

            {/* Habits Cards Grouped by Tag */}
            <div className="space-y-4">
              {filteredHabits.length === 0 ? (
                <div className="col-span-full py-12 text-center rounded-3xl bg-white dark:bg-black border border-dashed border-slate-300 dark:border-zinc-900 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 mx-auto flex items-center justify-center">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-zinc-100">No habits found</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                    Start tracking small daily disciplines to build effortless positive momentum.
                  </p>
                  <button
                    onClick={() => openAddModal()}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-xs cursor-pointer"
                  >
                    Create Habit
                  </button>
                </div>
              ) : (
                Object.entries(habitsByTag).map(([tagGroup, groupHabits]) => (
                  <div key={tagGroup} className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider px-1 pt-1 flex items-center justify-between">
                      <span className="font-mono text-indigo-600 dark:text-indigo-300 font-black tracking-wide text-xs">{tagGroup}</span>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-zinc-500">
                        {groupHabits.filter(h => !!h.completionHistory?.[selectedDateStr]).length}/{groupHabits.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupHabits.map(habit => {
                        const isSyncedWaterHabit =
                          Boolean(habit.syncHydration) &&
                          (habit.habitType === 'counter' || habit.habitType === 'measurement');
                        const cleanHabitName = habit.name;
                        const isCheckedToday = !!habit.completionHistory?.[selectedDateStr] || (isSyncedWaterHabit && currentTotalMl >= targetMl);
                        const isQuit = habit.habitType === 'quit';
                        const isCounter = habit.habitType === 'counter' || habit.habitType === 'measurement';
                        const habitAccent = habit.accentColor || habit.color || '#10b981';
                        const themeStyles = getCardThemeStyles(habitAccent, 'clean');
                        const fontInlineStyle = getFontInlineStyle({
                          fontColor: habit.fontColor,
                          fallbackColor: habit.fontColor ? habit.fontColor : undefined,
                          isBold: habit.isBold,
                        });
                        const hasSubSteps = habit.subSteps && habit.subSteps.length > 0;
                        const completedStepsCount = habit.subSteps ? habit.subSteps.filter(s => s.completed).length : 0;
                        const cardProgressRatio = isSyncedWaterHabit
                          ? (targetMl > 0 ? Math.min(1, Math.max(0, currentTotalMl / targetMl)) : 0)
                          : (isQuit || isCounter)
                            ? ((habit.targetCount || 100) > 0 ? Math.min(1, Math.max(0, (habit.counterValue || 0) / (habit.targetCount || 100))) : 0)
                            : hasSubSteps
                              ? (completedStepsCount / (habit.subSteps?.length || 1))
                              : (isCheckedToday ? 1 : 0);
                        const progressRatio = cardProgressRatio;
                        const isSubStepsExpanded = expandedSubStepHabitId === habit.id;
                        const isRunningInPiP = session.activeId === habit.id || (sessions && sessions.some(s => s.activeId === habit.id));
                        const isScheduledForDate = isHabitScheduledForDate(habit, selectedDateStr);
                        const freqLabel = getHabitFrequencyLabel(habit);

                        return (
                          <div
                            key={habit.id}
                            id={`habit-${habit.id}`}
                            data-habit-id={habit.id}
                            draggable={habitSort === 'custom'}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', habit.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const draggedId = e.dataTransfer.getData('text/plain');
                              handleReorderHabits(draggedId, habit.id);
                            }}
                            onClick={() => setSelectedDetailHabit(habit)}
                            style={themeStyles.cardStyle}
                            className={`relative rounded-xl transition-all duration-200 py-2 px-2.5 sm:py-2.5 sm:px-3 flex flex-col gap-1 shadow-2xs hover:shadow-xs cursor-pointer bg-white dark:bg-zinc-900 ${
                              !isScheduledForDate
                                ? 'opacity-50 grayscale-[35%] hover:opacity-85 hover:grayscale-0 bg-slate-100/70 dark:bg-zinc-900/50'
                                : isCheckedToday
                                  ? 'opacity-95'
                                  : 'opacity-100'
                            } ${
                              isRunningInPiP
                                ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/50 shadow-md'
                                : ''
                            } ${habitSort === 'custom' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-3 pl-0">
                              {/* Left: Icon, Title, Streak */}
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
                                      {cleanHabitName}
                                    </h4>
                                    {isRunningInPiP && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 rounded-full shrink-0">
                                        <span className="w-1.2 h-1.2 rounded-full bg-amber-500 animate-ping inline-block" />
                                        PiP Active
                                      </span>
                                    )}
                                    {isQuit && (
                                      <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                        QUIT
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10.5px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400 pt-0.5 shrink-0">
                                    <AnimatedStreakBadge
                                      streak={habit.currentStreak || 0}
                                      isCompleted={isCheckedToday}
                                      isAnimating={animatingHabitId === habit.id}
                                      size="xs"
                                      showZero={true}
                                    />
                                    <span>•</span>
                                    <span className="capitalize text-[10.5px] sm:text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                                      {freqLabel}
                                    </span>
                                    {!isScheduledForDate && (
                                      <>
                                        <span>•</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100/80 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shrink-0">
                                          Off Day
                                        </span>
                                      </>
                                    )}
                                    {hasSubSteps && (
                                      <>
                                        <span>•</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedSubStepHabitId(isSubStepsExpanded ? null : habit.id);
                                          }}
                                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
                                          title={isSubStepsExpanded ? 'Collapse sub-habits' : 'Expand sub-habits'}
                                        >
                                          <SubtaskBranchIcon className="w-2.5 h-2.5 text-indigo-500" />
                                          <span>{completedStepsCount}/{habit.subSteps?.length} ({habit.doneWhen === 'any' ? 'any' : 'all'})</span>
                                          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isSubStepsExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Actions / Checkmark / Counter */}
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {habit.timerMinutes && (
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
                                        : `Start ${habit.timerMinutes}m focus`
                                    }
                                  >
                                    {session.activeId === habit.id && session.isRunning ? (
                                      <Pause className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    )}
                                    {session.activeId === habit.id && (
                                      <span className="text-[10px] font-mono font-bold">
                                        {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')}
                                      </span>
                                    )}
                                  </button>
                                )}

                                {isSyncedWaterHabit ? (() => {
                                  const rawUnit = (habit.unit || hydration?.preferredUnit || 'ml').toLowerCase().trim();
                                  const isLitre = rawUnit === 'l' || rawUnit === 'litre' || rawUnit === 'litres';
                                  const isGlasses = rawUnit === 'glasses' || rawUnit === 'glass' || rawUnit === 'gl';

                                  let currentDisplay = `${currentTotalMl}`;
                                  let targetDisplay = `${targetMl}`;
                                  let unitDisplay = 'ml';
                                  let stepVal = habit.incrementStep && habit.incrementStep > 0 ? habit.incrementStep : 250;
                                  let stepUnit = 'ml';

                                  if (isLitre) {
                                    currentDisplay = (currentTotalMl / 1000).toFixed(1).replace(/\.0$/, '');
                                    targetDisplay = (targetMl / 1000).toFixed(1).replace(/\.0$/, '');
                                    unitDisplay = 'L';
                                    stepVal = stepVal >= 50 ? stepVal / 1000 : stepVal;
                                    stepUnit = 'litres';
                                  } else if (isGlasses) {
                                    currentDisplay = currentTotalMl % 250 === 0
                                      ? String(Math.round(currentTotalMl / 250))
                                      : (currentTotalMl / 250).toFixed(1).replace(/\.0$/, '');
                                    targetDisplay = String(Math.round(targetMl / 250));
                                    unitDisplay = 'gl';
                                    stepVal = stepVal >= 50 ? Math.round(stepVal / 250) : (stepVal > 0 ? stepVal : 1);
                                    stepUnit = 'glasses';
                                  }

                                  const waterProgressRatio = Math.min(1, Math.max(0, targetMl > 0 ? currentTotalMl / targetMl : 0));
                                  const waterAccent = habit.accentColor || habit.color || '#06b6d4';

                                  return (
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                      {/* Micro progress bar shifted right above counter widget in place of marked blue line */}
                                      <div className="w-[76%] mx-auto h-1 bg-cyan-200/80 dark:bg-zinc-700/80 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                                          style={{
                                            width: `${Math.min(100, Math.round(waterProgressRatio * 100))}%`,
                                            backgroundColor: waterAccent,
                                          }}
                                        />
                                      </div>
                                      <div className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-cyan-50/90 dark:bg-zinc-800/95 border border-cyan-200/80 dark:border-cyan-800/80 shadow-2xs select-none">
                                        {/* "-" Button */}
                                        <button
                                          type="button"
                                          onClick={() => currentTotalMl > 0 && addWater(-stepVal, stepUnit)}
                                          disabled={currentTotalMl <= 0}
                                          className={`relative z-10 w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-xl flex items-center justify-center transition text-sm font-black active:scale-95 ${
                                            currentTotalMl <= 0
                                              ? 'opacity-40 cursor-not-allowed bg-slate-200/80 dark:bg-zinc-700/60 text-slate-500 dark:text-zinc-400'
                                              : 'bg-cyan-200/80 dark:bg-cyan-900/80 hover:bg-cyan-300 dark:hover:bg-cyan-800 text-cyan-950 dark:text-cyan-100 cursor-pointer shadow-2xs'
                                          }`}
                                          title={currentTotalMl <= 0 ? 'Minimum reached' : `Subtract ${stepVal} ${unitDisplay}`}
                                        >
                                          -
                                        </button>

                                        {/* Counter Number */}
                                        <div className="relative z-10 flex flex-col items-center justify-center min-w-[48px] px-1 text-center">
                                          <span className="text-sm sm:text-base font-mono font-black text-cyan-900 dark:text-cyan-100 leading-none">
                                            {currentDisplay}
                                          </span>
                                          <span className="text-[9.5px] sm:text-[10.5px] font-mono font-bold text-cyan-700 dark:text-cyan-300 leading-tight mt-0.5">
                                            /{targetDisplay}{unitDisplay ? ` ${unitDisplay}` : ''}
                                          </span>
                                        </div>

                                        {/* "+" Button */}
                                        <button
                                          type="button"
                                          onClick={() => addWater(stepVal, stepUnit)}
                                          className="relative z-10 px-2 py-1 rounded-xl flex items-center justify-center transition text-xs sm:text-sm font-black cursor-pointer active:scale-95 shadow-2xs gap-0.5 hover:opacity-95 text-white"
                                          style={{ backgroundColor: waterAccent }}
                                          title={`Add ${stepVal} ${unitDisplay}`}
                                        >
                                          <span>+ {stepVal}</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })() : isQuit || isCounter ? (() => {
                                    const countVal = habit.counterValue || 0;
                                    const targetVal = habit.targetCount || 100;
                                    const progressRatio = Math.min(1, Math.max(0, targetVal > 0 ? countVal / targetVal : 0));
                                    const unitStr = habit.unit || '';

                                    return (
                                      <div className="flex flex-col items-center gap-1 shrink-0">
                                        {/* Micro progress bar shifted right above counter widget in place of marked blue line */}
                                        <div className="w-[92%] mx-auto h-1 bg-slate-200/90 dark:bg-zinc-700/80 rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                                            style={{
                                              width: `${Math.min(100, Math.round(progressRatio * 100))}%`,
                                              backgroundColor: habitAccent,
                                            }}
                                          />
                                        </div>
                                        <div className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-100/90 dark:bg-zinc-800/95 border border-slate-300/80 dark:border-zinc-700/80 shadow-2xs select-none">
                                          {/* "-" Button */}
                                          <button
                                            type="button"
                                            onClick={() => countVal > 0 && updateHabitCounter(habit.id, -(habit.incrementStep || 1))}
                                            disabled={countVal <= 0}
                                            className={`relative z-10 w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-xl flex items-center justify-center transition text-sm font-black active:scale-95 ${
                                              countVal <= 0
                                                ? 'opacity-40 cursor-not-allowed bg-slate-200/80 dark:bg-zinc-700/60 text-slate-500 dark:text-zinc-400'
                                                : 'bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-900 dark:text-zinc-100 cursor-pointer shadow-2xs'
                                            }`}
                                            title={`Subtract ${habit.incrementStep || 1} ${unitStr}`}
                                          >
                                            -
                                          </button>

                                          {/* Counter Number + Data Below Number */}
                                          <div className="relative z-10 flex flex-col items-center justify-center min-w-[48px] px-1 text-center">
                                            <span className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-white leading-none">
                                              {countVal}
                                            </span>
                                            <span className="text-[9.5px] sm:text-[10.5px] font-mono font-bold text-slate-700 dark:text-zinc-200 leading-tight mt-0.5">
                                              /{targetVal}{unitStr ? ` ${unitStr}` : ''}
                                            </span>
                                          </div>

                                          {/* "+" Button */}
                                          <button
                                            type="button"
                                            onClick={() => updateHabitCounter(habit.id, habit.incrementStep || 1)}
                                            className={`relative z-10 px-2 py-1 rounded-xl flex items-center justify-center transition text-xs sm:text-sm font-black cursor-pointer active:scale-95 shadow-2xs gap-0.5 hover:opacity-95 ${
                                              isWhiteColor(habitAccent) ? 'text-slate-900 border border-slate-300 dark:border-zinc-600' : 'text-white'
                                            }`}
                                            style={{ backgroundColor: habitAccent }}
                                            title={`Add ${habit.incrementStep || 1} ${unitStr}`}
                                          >
                                            <span>+ {habit.incrementStep && habit.incrementStep > 1 ? habit.incrementStep : ''}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })() : (
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
                                      onClick={() => handleToggleHabitWithAnimation(habit.id, selectedDateStr)}
                                      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer ${
                                        isCheckedToday
                                          ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                          : 'bg-slate-100 dark:bg-zinc-800/90 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/60 text-slate-400 dark:text-zinc-300 border border-slate-200/70 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-500'
                                      }`}
                                      title={isCheckedToday ? 'Completed! Click to uncheck' : 'Click to check off today'}
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
                                )}
                              </div>
                            </div>

                            {/* Note row shifted below */}
                            {habit.notes && habit.notes.trim().length > 0 && (
                              <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                                <FileText className="w-3 h-3 shrink-0 text-slate-400 dark:text-zinc-500" />
                                <span className="truncate">{habit.notes}</span>
                              </div>
                            )}

                            {/* Expanded Sub-steps checklist with smooth height transition */}
                            {hasSubSteps && isSubStepsExpanded && (
                              <div className="pt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sub-habits Checklist</span>
                                  <CardCalendarButton
                                    item={{
                                      id: habit.id,
                                      title: habit.name,
                                      type: 'habit',
                                      color: habit.color || habit.accentColor,
                                      frequency: habit.frequency,
                                      customDays: habit.customDays,
                                      reminderType: habit.reminderType || (habit.reminderTime ? 'notification' : 'none'),
                                      dueTime: habit.reminderTime,
                                    }}
                                    className="h-4.5 text-[9px] px-1.5"
                                  />
                                </div>
                                {habit.subSteps?.map(step => (
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
                                      const wasChecked = !!habit.completionHistory?.[selectedDateStr];

                                      setAnimatingHabitId(null);
                                      setCelebratingHabitId(null);

                                      updateHabitSubSteps(habit.id, updatedSteps, selectedDateStr);

                                      if (shouldComplete && !wasChecked) {
                                        setTimeout(() => {
                                          setAnimatingHabitId(habit.id);
                                        }, 20);
                                        try {
                                          soundEngine.playWaterDropNotification();
                                          haptics.complete();
                                        } catch {}
                                        setTimeout(() => {
                                          setCelebratingHabitId(habit.id);
                                          setCelebrationKey(prev => prev + 1);
                                        }, 280);
                                        setTimeout(() => setAnimatingHabitId(null), 450);
                                        setTimeout(() => setCelebratingHabitId(null), 1400);
                                      } else {
                                        haptics.toggle();
                                        try {
                                          soundEngine.playWaterDropNotification();
                                        } catch {}
                                      }
                                    }}
                                    className={`w-full p-2 rounded-xl border flex items-center gap-2 transition text-xs text-left cursor-pointer ${
                                      step.completed
                                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                      step.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-zinc-700'
                                    }`}>
                                      {step.completed && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className={step.completed ? 'line-through opacity-75' : ''}>{step.text}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Routine Tab Section */}
      {activeTab === 'routines' && (
        <div id="section-routines" className="bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 p-4 shadow-2xs space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            ✨ Daily Routines & Rituals
          </h3>
          <HabitsRoutineSection />
        </div>
      )}

      {/* Self-Care Tab Section */}
      {activeTab === 'selfcare' && (
        <div id="section-selfcare" className="bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 p-4 shadow-2xs space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            💚 Wellness & Daily Self-Care
          </h3>
          <HabitsSelfCareSection />
        </div>
      )}

      {/* Reports Tab Section */}
      {activeTab === 'reports' && (
        <div id="section-reports" className="bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 p-4 shadow-2xs space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            📊 Reports & Progress Analytics
          </h3>
          <HabitsReportSection habits={habits} />
        </div>
      )}

      {/* Add / Edit Habit Modal */}
      {showAddModal && (
        <ActivityManager
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          type="habit"
          activityToEdit={editingHabit}
        />
      )}

      {/* Habit Detailed View Modal (Pixel Habit Tracker Style) */}
      {selectedDetailHabit && (
        <HabitDetailModal
          habit={selectedDetailHabit}
          onClose={() => setSelectedDetailHabit(null)}
          onEdit={(h) => {
            setSelectedDetailHabit(null);
            openEditModal(h);
          }}
        />
      )}
    </div>
  );
};
