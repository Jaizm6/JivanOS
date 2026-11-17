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
  Sliders,
  Archive,
  ArchiveRestore,
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
  getSafeFontColor,
} from '../../utils/activityStyles';
import { HabitsSelfCareSection } from './HabitsSelfCareSection';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';
import { HabitsReportSection } from './HabitsReportSection';
import { IconRenderer } from '../common/IconRenderer';
import { QuoteBanner } from '../common/QuoteBanner';
import { ActivityManager } from '../common/ActivityManager';
import { HabitFormModal } from './HabitFormModal';
import { HabitDetailModal } from './HabitDetailModal';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import { formatLocalDate } from '../../utils/date';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import {
  SmoothCollapse,
  PetalShapeBadge,
  getHabitExpressiveShape,
  getPetalGroupRadiusClass,
} from '../common/PetalExpressive';
import { isHabitScheduledForDate, getHabitFrequencyLabel } from '../../utils/habitSchedule';
import { haptics } from '../../utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { CircularProgress } from '../common/CircularProgress';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import {
  TagSectionHeader,
  cleanTagName,
  dedupeTagsCaseInsensitive,
  formatTagLabel,
} from '../common/TagVisuals';

export const HabitTracker: React.FC = () => {
  const {
    habits,
    routines,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitDay,
    updateHabitCounter,
    updateHabitSubSteps,
    soundEngine,
    selectedDate: selectedDateStr,
    setSelectedDate: setSelectedDateStr,
    tags,
    hydration,
    addWater,
    openEntitiesModal,
    pushNotification,
    theme,
  } = useApp();
  const isDarkMode = theme === 'dark';
  const { session, sessions, startSession, pauseSession, resumeSession, stopSession } = useActiveSession();

  const currentTotalMl = hydration?.todayLogs?.reduce((acc, curr) => acc + (curr.amountMl || 0), 0) || 0;
  const targetMl = hydration?.targetMl || 3000;

  // Navigation tab: 'habits' | 'routines' | 'selfcare' | 'reports'
  const [activeTab, setActiveTab] = useState<'habits' | 'routines' | 'selfcare' | 'reports'>('habits');
  const [showArchivedHabits, setShowArchivedHabits] = useState(false);
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [habitSort, setHabitSort] = useState<'custom' | 'alphabetical' | 'completion' | 'recent'>('custom');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [expandedSubStepHabitId, setExpandedSubStepHabitId] = useState<string | null>(null);
  const [showQuickTypePicker, setShowQuickTypePicker] = useState(false);
  const [isHabitFilterOpen, setIsHabitFilterOpen] = useState(false);
  const [, setPaletteTick] = useState(0);

  useEffect(() => {
    const handlePalette = () => setPaletteTick(t => t + 1);
    window.addEventListener('omni-palette-change', handlePalette);
    return () => window.removeEventListener('omni-palette-change', handlePalette);
  }, []);

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

    toggleHabitDay(habitId, dateStr, { skipSound: true, skipUndoSnackbar: true });
    if (!wasChecked) {
      setAnimatingHabitId(habitId);
      try {
        soundEngine.playWaterDropNotification();
        haptics.complete();
      } catch {}
      celebrationTimeoutRef.current = setTimeout(() => {
        setCelebratingHabitId(habitId);
        setCelebrationKey(prev => prev + 1);
      }, 120);
      clearAnimatingTimeoutRef.current = setTimeout(() => setAnimatingHabitId(null), 420);
      clearCelebratingTimeoutRef.current = setTimeout(() => setCelebratingHabitId(null), 1250);
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

  const activeHabits = useMemo(() => habits.filter(h => !h.archived), [habits]);
  const archivedHabits = useMemo(() => habits.filter(h => Boolean(h.archived)), [habits]);
  const [pendingArchiveHabit, setPendingArchiveHabit] = useState<Habit | null>(null);

  const executeToggleArchiveHabit = (habit: Habit) => {
    const wasArchived = Boolean(habit.archived);
    updateHabit({
      ...habit,
      archived: !wasArchived,
      archivedAt: !wasArchived ? new Date().toISOString() : undefined,
    });
    haptics.toggle();
    pushNotification(
      wasArchived ? 'Habit Restored' : 'Habit Archived',
      wasArchived
        ? `"${habit.name}" restored to your active habits.`
        : `"${habit.name}" moved to Archived Habits.`,
      'habit'
    );
  };

  const handleToggleArchiveHabit = (habit: Habit) => {
    if (habit.archived) {
      executeToggleArchiveHabit(habit);
    } else {
      setPendingArchiveHabit(habit);
    }
  };

  const [customHabits, setCustomHabits] = useState<Habit[]>(activeHabits);
  useEffect(() => {
    setCustomHabits(showArchivedHabits ? archivedHabits : activeHabits);
  }, [activeHabits, archivedHabits, showArchivedHabits]);

  const [activeNoteHabitId, setActiveNoteHabitId] = useState<string | null>(null);
  const [habitNoteInput, setHabitNoteInput] = useState<string>('');

  const handleReorderHabits = (draggedId: string, targetId: string) => {
    if (showArchivedHabits) return;
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

  // All unique tags across current view habits (case-insensitive deduplicated)
  const allUniqueTags = useMemo(() => {
    const raw: string[] = [];
    (showArchivedHabits ? archivedHabits : activeHabits).forEach(h => {
      (h.tags || []).forEach(t => {
        if (t) raw.push(t);
      });
      if ((!h.tags || h.tags.length === 0) && h.category) {
        raw.push(h.category);
      }
    });
    return dedupeTagsCaseInsensitive(raw).sort((a, b) =>
      formatTagLabel(a).localeCompare(formatTagLabel(b))
    );
  }, [activeHabits, archivedHabits, showArchivedHabits]);

  // Filtered & Sorted habits
  const filteredHabits = useMemo(() => {
    let list = customHabits.filter(h => {
      if (selectedCategory === 'all') return true;
      const target = cleanTagName(selectedCategory).toLowerCase();
      const tagMatch = h.tags?.some(t => cleanTagName(t).toLowerCase() === target);
      const catMatch = h.category?.toLowerCase() === target;
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

  // Group habits by Tag (case-insensitive canonical grouping)
  const habitsByTag = useMemo(() => {
    const groups: Record<string, Habit[]> = {};
    const canonicalByKey = new Map<string, string>();
    filteredHabits.forEach(h => {
      const rawTag =
        h.tags && h.tags.length > 0
          ? h.tags[0]
          : h.category || 'General';
      const cleaned = cleanTagName(rawTag) || 'General';
      const key = cleaned.toLowerCase();
      if (!canonicalByKey.has(key)) {
        canonicalByKey.set(key, formatTagLabel(cleaned));
      }
      const groupLabel = canonicalByKey.get(key)!;
      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(h);
    });
    return groups;
  }, [filteredHabits]);

  // Today's completed habits calculation (excluding archived)
  const completedTodayCount = activeHabits.filter(h => !!h.completionHistory?.[selectedDateStr]).length;
  const totalHabitsCount = activeHabits.length;
  const todayProgressPercent = totalHabitsCount > 0 ? Math.round((completedTodayCount / totalHabitsCount) * 100) : 0;
  const activeStreaksCount = activeHabits.filter(h => (h.currentStreak || 0) > 0).length;

  // Routine tab summary counts synchronized to selectedDateStr
  const { routineCompletedCount, routineTotalCount } = useMemo(() => {
    let total = 0;
    let done = 0;
    routines.forEach(r => {
      const seenKeys = new Set<string>();
      r.items.forEach(item => {
        if (item.archived) return;
        const linked = habits.find(
          h => h.id === item.id || h.name.toLowerCase().trim() === item.title.toLowerCase().trim()
        );
        if (linked?.archived) return;
        seenKeys.add(item.id);
        seenKeys.add(item.title.toLowerCase().trim());
        total += 1;
        const isDone = linked
          ? Boolean(linked.completionHistory?.[selectedDateStr])
          : Boolean(
              item.completionHistory?.[selectedDateStr] ??
                (selectedDateStr === todayStr && item.completed)
            );
        if (isDone) done += 1;
      });
      const rNameLower = r.name.toLowerCase().trim();
      habits.forEach(h => {
        if (h.archived) return;
        if (
          h.tags?.some(t => t.toLowerCase().trim() === rNameLower) &&
          !seenKeys.has(h.id) &&
          !seenKeys.has(h.name.toLowerCase().trim())
        ) {
          total += 1;
          if (h.completionHistory?.[selectedDateStr]) done += 1;
        }
      });
    });
    return { routineCompletedCount: done, routineTotalCount: total };
  }, [routines, habits, selectedDateStr, todayStr]);

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
    <div className="space-y-1.5 max-w-6xl mx-auto pb-8 w-full min-w-0 overflow-x-hidden">
      {/* Scrollable Compact Date Strip (Independent customization per Habits subpage) */}
      <ScrollableCompactDateStrip
        selectedDateStr={selectedDateStr}
        onSelectDate={setSelectedDateStr}
        storageKey={`habits_${activeTab}`}
        defaultFinish={activeTab === 'habits' ? 'dualtone' : 'clean'}
        defaultShape={
          activeTab === 'habits'
            ? 'clover'
            : activeTab === 'routines'
            ? 'cookie12'
            : activeTab === 'selfcare'
            ? 'scallop'
            : 'hexagon'
        }
        defaultTheme={
          activeTab === 'habits'
            ? 'sage'
            : activeTab === 'routines'
            ? 'plum'
            : activeTab === 'selfcare'
            ? 'rosewood'
            : 'cerulean'
        }
        className="my-0"
      />

      {/* Single Compact Material 4 Control Bar: Connected Segmented Sub-Tabs + Filter + Add */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="p-1 rounded-[18px] flex items-center justify-between gap-1.5 w-full min-w-0 max-w-full relative z-30"
      >
        {/* Left: Material 4 Connected Segmented Sub-Tabs */}
        <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-slate-100/95 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 overflow-x-auto no-scrollbar min-w-0">
          <button
            type="button"
            onClick={() => scrollToSection('habits', 'habits')}
            className={`py-1 px-2.5 sm:px-3 ${
              activeTab === 'habits' ? 'rounded-full' : 'rounded-l-full rounded-r-[6px]'
            } text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'habits'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>Habits</span>
            <span className={`text-[10px] px-1 py-0.1 rounded-full font-mono ${
              activeTab === 'habits' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}>
              {completedTodayCount}/{totalHabitsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('routines', 'routines')}
            className={`py-1 px-2.5 sm:px-3 ${
              activeTab === 'routines' ? 'rounded-full' : 'rounded-[6px]'
            } text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'routines'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Routines</span>
            <span
              className={`text-[10px] px-1 py-0.1 rounded-full font-mono ${
                activeTab === 'routines'
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              {routineCompletedCount}/{routineTotalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('selfcare', 'selfcare')}
            className={`py-1 px-2.5 sm:px-3 ${
              activeTab === 'selfcare' ? 'rounded-full' : 'rounded-[6px]'
            } text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'selfcare'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Self-Care</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('reports', 'reports')}
            className={`py-1 px-2.5 sm:px-3 ${
              activeTab === 'reports' ? 'rounded-full' : 'rounded-r-full rounded-l-[6px]'
            } text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Reports</span>
          </button>
        </div>

        {/* Right: Archived Toggle, Filter Popover & Simple + Action */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {(activeTab === 'habits' || activeTab === 'routines') && (
            <button
              type="button"
              onClick={() => {
                haptics.toggle();
                setShowArchivedHabits(prev => !prev);
                setSelectedCategory('all');
              }}
              className={`h-7 px-2 inline-flex items-center gap-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                showArchivedHabits
                  ? 'bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-slate-800 dark:border-zinc-200 shadow-2xs'
                  : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              title={showArchivedHabits ? 'Back to Active' : 'View Archived'}
            >
              <Archive className="w-3.5 h-3.5 shrink-0" />
              <span className={showArchivedHabits ? 'inline' : 'hidden md:inline'}>Archived</span>
              {archivedHabits.length > 0 && activeTab === 'habits' && (
                <span className="font-mono text-[10px] opacity-80">{archivedHabits.length}</span>
              )}
            </button>
          )}

          {activeTab === 'habits' && (
            <>
              {(selectedCategory !== 'all' || habitSort !== 'custom') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setHabitSort('custom');
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:underline px-1 cursor-pointer hidden sm:inline"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsHabitFilterOpen(prev => !prev)}
                className={`h-7 px-2 inline-flex items-center gap-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                  isHabitFilterOpen || selectedCategory !== 'all' || habitSort !== 'custom'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
                title="Filter by Tag, Sort & Manage Tags"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Filter</span>
              </button>

              {isHabitFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsHabitFilterOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-50 p-3 space-y-3 text-xs animate-view-enter">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Filter by Tag
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={e => {
                          haptics.toggle();
                          setSelectedCategory(e.target.value);
                        }}
                        className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 font-medium cursor-pointer focus:outline-hidden"
                      >
                        <option value="all">
                          All Tags ({showArchivedHabits ? archivedHabits.length : activeHabits.length})
                        </option>
                        {allUniqueTags.map(t => (
                          <option key={t} value={t}>
                            {formatTagLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Sort Order
                      </label>
                      <select
                        value={habitSort}
                        onChange={e => {
                          haptics.toggle();
                          setHabitSort(e.target.value as any);
                        }}
                        className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 font-medium cursor-pointer focus:outline-hidden"
                      >
                        <option value="custom">Default (Drag Order)</option>
                        <option value="alphabetical">Alphabetical (A-Z)</option>
                        <option value="completion">Highest Streak</option>
                        <option value="recent">Recently Added</option>
                      </select>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsHabitFilterOpen(false);
                          setShowArchivedHabits(prev => !prev);
                          setSelectedCategory('all');
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Archive className="w-3.5 h-3.5 text-slate-500" />
                          <span>{showArchivedHabits ? 'View Active Habits' : 'View Archived Habits'}</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {showArchivedHabits ? activeHabits.length : archivedHabits.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsHabitFilterOpen(false);
                          openEntitiesModal('tags');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium transition cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Manage Tags Hub</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'routines') {
                setIsCreateRoutineOpen(true);
              } else {
                openAddModal();
              }
            }}
            className="h-7 w-7 sm:w-auto sm:px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
            title={activeTab === 'routines' ? 'New Routine' : 'Add Habit'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">{activeTab === 'routines' ? 'Routine' : 'Add'}</span>
          </button>
        </div>
      </div>

      {/* SEGMENTED TAB CONTENT VIEWS */}
      {activeTab === 'habits' && (
        <div id="section-habits" className="space-y-1.5 w-full min-w-0 max-w-full">
          {showArchivedHabits && (
            <div
              data-m3-tonal-card="true"
              data-tonal-tone="archived"
              className="px-3 py-1.5 rounded-[16px] flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 text-slate-700 dark:text-zinc-200 font-semibold">
                <Archive className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                <span className="truncate">Viewing Archived Habits · {archivedHabits.length}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowArchivedHabits(false)}
                className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                Back to Active
              </button>
            </div>
          )}

          {/* Each Tag Group renders inside its own dedicated Card containing its linked habits */}
          <div className="space-y-1.5 w-full min-w-0">
            {filteredHabits.length === 0 ? (
              <div
                data-m3-tonal-card="true"
                data-tonal-tone="neutral"
                className="col-span-full py-10 text-center rounded-[22px] p-7 space-y-2.5"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 mx-auto flex items-center justify-center">
                  {showArchivedHabits ? <Archive className="w-6 h-6 text-slate-500" /> : <Flame className="w-6 h-6" />}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-zinc-100">
                  {showArchivedHabits ? 'No archived habits' : 'No habits found'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  {showArchivedHabits
                    ? 'Habits you archive because you achieved or paused them will appear here so you can restore them anytime.'
                    : 'Start tracking small daily disciplines to build effortless positive momentum.'}
                </p>
                {showArchivedHabits ? (
                  <button
                    type="button"
                    onClick={() => setShowArchivedHabits(false)}
                    className="px-4 py-2 rounded-full bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition shadow-xs cursor-pointer"
                  >
                    Back to Active Habits
                  </button>
                ) : (
                  <button
                    onClick={() => openAddModal()}
                    className="px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-xs cursor-pointer"
                  >
                    Create Habit
                  </button>
                )}
              </div>
            ) : (
              Object.entries(habitsByTag).map(([tagGroup, groupHabits], groupIdx) => (
                <div
                  key={tagGroup}
                  data-m3-tonal-card="true"
                  data-tonal-tone="subcard"
                  className="rounded-[18px] p-1.5 sm:p-2 space-y-1 w-full min-w-0 overflow-visible"
                >
                  <TagSectionHeader
                    tag={tagGroup}
                    completedCount={groupHabits.filter(h => !!h.completionHistory?.[selectedDateStr]).length}
                    totalCount={groupHabits.length}
                    appTags={tags}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[3px] sm:gap-1.5 w-full min-w-0">
                      {groupHabits.map((habit, habitIdx) => {
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
                        }, isDarkMode);
                        const hasSubSteps = habit.subSteps && habit.subSteps.length > 0;
                        const completedStepsCount = habit.subSteps ? habit.subSteps.filter(s => s.completed).length : 0;
                        const isSubStepsExpanded = expandedSubStepHabitId === habit.id;
                        const isRunningInPiP = session.activeId === habit.id || (sessions && sessions.some(s => s.activeId === habit.id));
                        const isScheduledForDate = isHabitScheduledForDate(habit, selectedDateStr);
                        const freqLabel = getHabitFrequencyLabel(habit);
                        const weekCompletedCount = weekDays.filter(d => Boolean(habit.completionHistory?.[d.dateStr])).length;
                        const petalRadius = getPetalGroupRadiusClass(habitIdx, groupHabits.length, true);
                        const tonalTone = habit.archived ? 'archived' : isCheckedToday ? 'done' : 'neutral';
                        const doneCheckBg = isWhiteColor(habitAccent)
                          ? isDarkMode ? '#f8fafc' : '#4f46e5'
                          : isBlackColor(habitAccent)
                            ? isDarkMode ? '#6366f1' : '#0f172a'
                            : habitAccent;
                        const doneCheckFg = isWhiteColor(doneCheckBg) ? '#090d16' : '#ffffff';

                        return (
                          <div
                            key={habit.id}
                            id={`habit-${habit.id}`}
                            data-habit-id={habit.id}
                            data-m3-tonal-card="true"
                            data-tonal-tone={tonalTone}
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
                            className={`group relative w-full min-w-0 max-w-full overflow-visible ${petalRadius} sm:rounded-[18px] lg:rounded-[22px] transition-[opacity,border-color,box-shadow,transform] duration-200 px-2 pt-1.5 pb-1.5 sm:px-3 sm:pt-2.5 sm:pb-2 lg:px-3.5 lg:py-3 flex flex-col cursor-pointer hover:shadow-xs ${
                              celebratingHabitId === habit.id ? 'z-20' : ''
                            } ${
                              !isScheduledForDate
                                ? 'opacity-60 grayscale-[20%] hover:opacity-85 hover:grayscale-0'
                                : 'opacity-100'
                            } ${
                              isRunningInPiP
                                ? 'ring-2 ring-amber-400/70'
                                : ''
                            } ${habitSort === 'custom' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 w-full">
                              {/* Left: Compact Material 3 Expressive Shape Icon, Title & Single-Line Metadata */}
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
                                <div className={isCheckedToday ? 'opacity-75 transition-opacity' : ''}>
                                  <PetalShapeBadge
                                    shape={getHabitExpressiveShape(habit.id, groupIdx * 3 + habitIdx)}
                                    sizeClass="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9"
                                    fillColor={themeStyles.iconBox.backgroundColor as string | undefined}
                                    strokeColor={themeStyles.iconBox.borderColor as string | undefined}
                                  >
                                    <span style={{ color: themeStyles.iconBox.color }}>
                                      <IconRenderer icon={habit.icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4" fallback="🎯" />
                                    </span>
                                  </PetalShapeBadge>
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className="flex items-center gap-1.5 min-w-0 w-full">
                                    <h4
                                      className={`font-bold text-[13px] sm:text-[13.5px] lg:text-[14.5px] font-sans tracking-tight truncate min-w-0 leading-tight transition-colors ${
                                        isCheckedToday
                                          ? 'text-slate-500 dark:text-zinc-400 line-through decoration-slate-400/50'
                                          : getSafeFontColor(habit.fontColor, isDarkMode) ? '' : 'text-slate-900 dark:text-white'
                                      }`}
                                      style={isCheckedToday ? undefined : fontInlineStyle}
                                    >
                                      {cleanHabitName}
                                    </h4>
                                    {isRunningInPiP && (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                                        PiP
                                      </span>
                                    )}
                                    {isQuit && (
                                      <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                                        Quit
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10.5px] lg:text-[11px] leading-none font-medium text-slate-500 dark:text-zinc-400 pt-0.5 flex-nowrap overflow-hidden min-w-0">
                                    <AnimatedStreakBadge
                                      streak={habit.currentStreak || 0}
                                      isCompleted={isCheckedToday}
                                      isAnimating={animatingHabitId === habit.id}
                                      size="xs"
                                      showZero={true}
                                    />
                                    {habit.reminderTime && (
                                      <>
                                        <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                        <span className="font-mono text-[10px] tabular-nums shrink-0">{habit.reminderTime}</span>
                                      </>
                                    )}
                                    {freqLabel.toLowerCase() !== 'daily' && (
                                      <>
                                        <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                        <span className="capitalize truncate max-w-[72px] sm:max-w-none">
                                          {freqLabel}
                                        </span>
                                      </>
                                    )}
                                    {!isScheduledForDate && (
                                      <>
                                        <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                        <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                          Off Day
                                        </span>
                                      </>
                                    )}
                                    {/* Desktop M3 Expressive 7-day consistency indicator */}
                                    <div className="hidden lg:inline-flex items-center gap-0.5 ml-1 pl-1.5 border-l border-slate-200 dark:border-zinc-700/80 shrink-0" title={`${weekCompletedCount}/7 days completed this week`}>
                                      {weekDays.map((wd) => {
                                        const doneOnDay = Boolean(habit.completionHistory?.[wd.dateStr]);
                                        return (
                                          <span
                                            key={wd.dateStr}
                                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                              doneOnDay
                                                ? ''
                                                : 'bg-slate-200 dark:bg-zinc-700/80'
                                            }`}
                                            style={doneOnDay ? { backgroundColor: habitAccent } : undefined}
                                          />
                                        );
                                      })}
                                      <span className="text-[9.5px] font-mono font-bold text-slate-400 dark:text-zinc-500 ml-0.5 tabular-nums">
                                        {weekCompletedCount}/7
                                      </span>
                                    </div>
                                    <span aria-hidden="true" className="opacity-45 shrink-0">·</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedSubStepHabitId(isSubStepsExpanded ? null : habit.id);
                                      }}
                                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0"
                                      title={isSubStepsExpanded ? 'Hide details' : 'Show actions, sub-steps & notes'}
                                    >
                                      {hasSubSteps && (
                                        <>
                                          <SubtaskBranchIcon className="w-2.5 h-2.5 shrink-0" />
                                          <span className="tabular-nums">{completedStepsCount}/{habit.subSteps?.length}</span>
                                        </>
                                      )}
                                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSubStepsExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Right: 1-tap Restore/Delete (when archived) OR Running Timer + Counter/Checkmark */}
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {habit.archived ? (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleArchiveHabit(habit)}
                                      className="h-6.5 px-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                                      title="Restore habit"
                                    >
                                      <ArchiveRestore className="w-3 h-3 shrink-0" />
                                      <span>Restore</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteHabit(habit.id)}
                                      className="w-6.5 h-6.5 rounded-full inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                                      title="Delete habit permanently"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                {habit.timerMinutes && session.activeId === habit.id && (
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
                                    title={session.isRunning ? 'Pause focus timer' : 'Resume focus timer'}
                                  >
                                    {session.isRunning ? (
                                      <Pause className="w-2.5 h-2.5 fill-current" />
                                    ) : (
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                    )}
                                    <span className="text-[10px] font-mono font-bold tabular-nums">
                                      {Math.floor(session.timeRemaining / 60)}:{(session.timeRemaining % 60).toString().padStart(2, '0')}
                                    </span>
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
                                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                                      <div className="w-[82%] mx-auto h-0.5 bg-cyan-200/80 dark:bg-zinc-700/80 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-300 ease-out"
                                          style={{
                                            width: `${Math.min(100, Math.round(waterProgressRatio * 100))}%`,
                                            backgroundColor: waterAccent,
                                          }}
                                        />
                                      </div>
                                      <div className="relative flex items-center gap-1 px-1 py-0.5 rounded-full bg-cyan-50/90 dark:bg-zinc-800/95 border border-cyan-200/80 dark:border-cyan-800/80 select-none">
                                        <button
                                          type="button"
                                          onClick={() => currentTotalMl > 0 && addWater(-stepVal, stepUnit)}
                                          disabled={currentTotalMl <= 0}
                                          className={`w-5 h-5 rounded-full flex items-center justify-center transition text-[11px] font-black active:scale-95 ${
                                            currentTotalMl <= 0
                                              ? 'opacity-40 cursor-not-allowed bg-slate-200/80 dark:bg-zinc-700/60 text-slate-500'
                                              : 'bg-cyan-200/80 dark:bg-cyan-900/80 hover:bg-cyan-300 text-cyan-950 dark:text-cyan-100 cursor-pointer'
                                          }`}
                                          title={currentTotalMl <= 0 ? 'Minimum reached' : `Subtract ${stepVal} ${unitDisplay}`}
                                        >
                                          -
                                        </button>
                                        <div className="flex flex-col items-center justify-center min-w-[30px] sm:min-w-[36px] px-0.5 text-center">
                                          <span className="text-[10.5px] sm:text-[11px] font-mono font-black text-cyan-900 dark:text-cyan-100 leading-none">
                                            {currentDisplay}
                                          </span>
                                          <span className="text-[8px] font-mono font-bold text-cyan-700 dark:text-cyan-300 leading-tight">
                                            /{targetDisplay}{unitDisplay ? `${unitDisplay}` : ''}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => addWater(stepVal, stepUnit)}
                                          className="px-1.5 py-0.5 rounded-full flex items-center justify-center transition text-[10px] font-black cursor-pointer active:scale-95 text-white"
                                          style={{ backgroundColor: waterAccent }}
                                          title={`Add ${stepVal} ${unitDisplay}`}
                                        >
                                          <span>+{stepVal}</span>
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
                                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                                        <div className="w-[85%] mx-auto h-0.5 bg-slate-200/90 dark:bg-zinc-700/80 rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all duration-300 ease-out"
                                            style={{
                                              width: `${Math.min(100, Math.round(progressRatio * 100))}%`,
                                              backgroundColor: habitAccent,
                                            }}
                                          />
                                        </div>
                                        <div className="relative flex items-center gap-1 px-1 py-0.5 rounded-full bg-slate-100/90 dark:bg-zinc-800/95 border border-slate-300/80 dark:border-zinc-700/80 select-none">
                                          <button
                                            type="button"
                                            onClick={() => countVal > 0 && updateHabitCounter(habit.id, -(habit.incrementStep || 1))}
                                            disabled={countVal <= 0}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center transition text-[11px] font-black active:scale-95 ${
                                              countVal <= 0
                                                ? 'opacity-40 cursor-not-allowed bg-slate-200/80 dark:bg-zinc-700/60 text-slate-500'
                                                : 'bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-900 dark:text-zinc-100 cursor-pointer'
                                            }`}
                                            title={`Subtract ${habit.incrementStep || 1} ${unitStr}`}
                                          >
                                            -
                                          </button>
                                          <div className="flex flex-col items-center justify-center min-w-[30px] sm:min-w-[36px] px-0.5 text-center">
                                            <span className="text-[10.5px] sm:text-[11px] font-mono font-black text-slate-900 dark:text-white leading-none">
                                              {countVal}
                                            </span>
                                            <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-zinc-200 leading-tight">
                                              /{targetVal}{unitStr ? ` ${unitStr}` : ''}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => updateHabitCounter(habit.id, habit.incrementStep || 1)}
                                            className={`px-1.5 py-0.5 rounded-full flex items-center justify-center transition text-[10px] font-black cursor-pointer active:scale-95 ${
                                              isWhiteColor(habitAccent) ? 'text-slate-900 border border-slate-300 dark:border-zinc-600' : 'text-white'
                                            }`}
                                            style={{ backgroundColor: habitAccent }}
                                            title={`Add ${habit.incrementStep || 1} ${unitStr}`}
                                          >
                                            <span>+{habit.incrementStep && habit.incrementStep > 1 ? habit.incrementStep : ''}</span>
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
                                      style={
                                        isCheckedToday
                                          ? {
                                              backgroundColor: doneCheckBg,
                                              color: doneCheckFg,
                                              boxShadow: `0 2px 8px -2px ${doneCheckBg}66`,
                                            }
                                          : undefined
                                      }
                                      className={`relative w-8 h-8 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                                        isCheckedToday
                                          ? 'rounded-full'
                                          : 'rounded-[11px] bg-slate-100/95 dark:bg-zinc-800/90 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-500 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700'
                                      }`}
                                      title={isCheckedToday ? 'Completed! Click to uncheck' : 'Click to check off today'}
                                    >
                                      <AnimatedCheckIcon
                                        className={`w-4 h-4 ${
                                          isCheckedToday
                                            ? ''
                                            : 'opacity-55 dark:opacity-75 text-slate-500 dark:text-zinc-300'
                                        }`}
                                        strokeWidth={isCheckedToday ? 2.8 : 2.2}
                                        animate={animatingHabitId === habit.id}
                                      />
                                    </motion.button>
                                  </div>
                                )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Thin Grey Divider Line (Matching Bills Card Language) + Slim 7D Dots */}
                            <div
                              className="mt-1 pt-1 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-1"
                              onClick={e => e.stopPropagation()}
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
                                      onClick={() => handleToggleHabitWithAnimation(habit.id, d.dateStr)}
                                      title={`${d.dayName} (${d.dateStr}): ${isDoneOnDay ? 'Completed' : 'Tap to complete'}`}
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
                                      style={isDoneOnDay ? { backgroundColor: isSunday ? '#e11d48' : habitAccent } : undefined}
                                    >
                                      {d.dayName.charAt(0)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Expanded Progressive-Disclosure Drawer: Notes, Sub-steps & Secondary Actions */}
                            <SmoothCollapse
                              isOpen={isSubStepsExpanded}
                              onClick={(e) => e.stopPropagation()}
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
                                    {hasSubSteps ? `Checklist (${habit.doneWhen === 'any' ? 'any' : 'all'})` : 'Habit Actions'}
                                  </span>
                                  <div className="flex items-center gap-1 flex-wrap">
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
                                        className="h-5.5 px-2 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                      >
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                        <span>{habit.timerMinutes}m</span>
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
                                        reminderType: habit.reminderType || (habit.reminderTime ? 'notification' : 'none'),
                                        dueTime: habit.reminderTime,
                                      }}
                                      className="h-5.5 text-[9.5px] px-2 rounded-full"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleToggleArchiveHabit(habit)}
                                      className={`h-5.5 px-2 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
                                        habit.archived
                                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                                          : 'bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                                      }`}
                                      title={habit.archived ? 'Restore Habit' : 'Archive Habit'}
                                    >
                                      {habit.archived ? <ArchiveRestore className="w-2.5 h-2.5" /> : <Archive className="w-2.5 h-2.5" />}
                                      <span>{habit.archived ? 'Restore' : 'Archive'}</span>
                                    </button>
                                  </div>
                                </div>

                                {hasSubSteps && habit.subSteps?.map(step => (
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
                                    className={`w-full p-1.5 rounded-[10px] flex items-center gap-2 transition text-[11px] text-left cursor-pointer ${
                                      step.completed
                                        ? 'bg-indigo-50/90 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-[#f3f6fc] dark:bg-zinc-900/75 text-slate-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                      step.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-zinc-700'
                                    }`}>
                                      {step.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                    <span className={step.completed ? 'line-through opacity-75' : ''}>{step.text}</span>
                                  </button>
                                ))}
                              </div>
                            </SmoothCollapse>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
      )}

      {/* Routine Tab Section (Unified with Habit Page System & M3 Card Layout) */}
      {activeTab === 'routines' && (
        <div id="section-routines" className="animate-view-enter w-full min-w-0">
          <HabitsRoutineSection
            selectedDateStr={selectedDateStr}
            weekDays={weekDays}
            showArchived={showArchivedHabits}
            onToggleShowArchived={() => setShowArchivedHabits(prev => !prev)}
            isCreateRoutineOpen={isCreateRoutineOpen}
            onCloseCreateRoutine={() => setIsCreateRoutineOpen(false)}
          />
        </div>
      )}

      {/* Self-Care Tab Section */}
      {activeTab === 'selfcare' && (
        <div id="section-selfcare" data-m3-tonal-card="true" data-tonal-tone="neutral" className="animate-view-enter rounded-[22px] p-3 sm:p-4 space-y-2.5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-200/70 dark:border-zinc-800 flex items-center gap-2">
            💚 Wellness & Daily Self-Care
          </h3>
          <HabitsSelfCareSection />
        </div>
      )}

      {/* Reports Tab Section */}
      {activeTab === 'reports' && (
        <div id="section-reports" data-m3-tonal-card="true" data-tonal-tone="neutral" className="animate-view-enter rounded-[22px] p-3 sm:p-4 space-y-2.5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 pb-2 border-b border-slate-200/70 dark:border-zinc-800 flex items-center gap-2">
            📊 Reports & Progress Analytics
          </h3>
          <HabitsReportSection habits={activeHabits} />
        </div>
      )}

      {/* Add / Edit Habit Modal (kept mounted so AnimatePresence animates closed) */}
      <HabitFormModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingHabit(null);
        }}
        habitToEdit={editingHabit}
      />

      {/* Habit Detailed View Modal (Pixel Habit Tracker Style) */}
      <AnimatePresence>
        {selectedDetailHabit && (
          <HabitDetailModal
            key={selectedDetailHabit.id}
            habit={selectedDetailHabit}
            onClose={() => setSelectedDetailHabit(null)}
            onEdit={(h) => {
              setSelectedDetailHabit(null);
              openEditModal(h);
            }}
          />
        )}
      </AnimatePresence>

      {/* Archive Habit Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveHabit)}
        itemName={pendingArchiveHabit?.name}
        itemType="Habit"
        onConfirm={() => {
          if (pendingArchiveHabit) {
            executeToggleArchiveHabit(pendingArchiveHabit);
            setPendingArchiveHabit(null);
          }
        }}
        onCancel={() => setPendingArchiveHabit(null)}
      />
    </div>
  );
};
