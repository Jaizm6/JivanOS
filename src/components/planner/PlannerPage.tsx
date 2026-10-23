import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Flame,
  CheckSquare,
  Target,
  CreditCard,
  BookLock,
  Clock,
  Filter,
  Plus,
  ArrowRight,
  Star,
  Search,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Bell,
  AlarmClock,
  ListTodo,
  Tag,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  ChevronUp,
  CalendarClock,
  Printer,
  Download,
  Inbox,
  Moon,
  Zap,
  Award,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskItem, Habit, Goal, Bill, ScheduleItem, JournalEntry, Priority, ReminderType } from '../../types';
import { QuoteBanner } from '../common/QuoteBanner';
import { soundEngine } from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { formatLocalDate, toDateString } from '../../utils/date';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { VisualTimeBlockingGrid } from './VisualTimeBlockingGrid';
import { HabitDetailModal } from '../habits/HabitDetailModal';
import { ActivityManager } from '../common/ActivityManager';
import { PriorityScheduleView } from '../schedule/PriorityScheduleView';
import { DeadlineScheduleView } from '../schedule/DeadlineScheduleView';
import { PrintableScheduleView } from '../schedule/PrintableScheduleView';
import { ScheduleEventModal } from '../schedule/ScheduleEventModal';
import { isScheduleItemOnDate } from '../../utils/scheduleRecurrence';
import { motion } from 'framer-motion';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';

export type PlannerViewMode = 'day' | 'inbox' | 'timeline' | 'hourly' | 'week' | 'month' | 'priority' | 'deadlines' | 'printable';

export interface TimelineUnifiedItem {
  id: string;
  sourceType: 'task' | 'event' | 'habit' | 'reminder';
  title: string;
  startTime?: string;
  endTime?: string;
  completed: boolean;
  category?: string;
  priority?: Priority;
  notes?: string;
  subtasks?: { id: string; title: string; completed: boolean }[];
  reminderType?: ReminderType;
  rawTask?: TaskItem;
  rawSchedule?: ScheduleItem;
  rawHabit?: Habit;
}

export interface MasterEventItem {
  id: string;
  type: 'task' | 'habit' | 'goal' | 'bill' | 'schedule' | 'journal';
  title: string;
  date: string;
  time?: string;
  completed: boolean;
  color: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
  subtitle?: string;
  rawItem: any;
}

export const PlannerPage: React.FC = () => {
  const {
    tasks,
    toggleTask,
    updateTask,
    deleteTask,
    toggleStarTask,
    addTask,
    habits,
    toggleHabitDay,
    goals,
    toggleGoalMilestone,
    bills,
    markBillPaid,
    formatCurrency,
    scheduleItems,
    toggleScheduleItem,
    addScheduleItem,
    updateScheduleItem,
    autoScheduleTasksForDate,
    journalEntries,
    startPomodoro,
    stopPomodoro,
    pomodoro,
    setPomodoroTask,
    pushNotification,
    selectedDate,
    setSelectedDate,
  } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Primary Planner View Tabs: 'day' (unified Day & Week), 'month', 'priority', 'deadlines', 'printable'
  const [activeView, setActiveView] = useState<PlannerViewMode>('day');
  const [dayViewMode, setDayViewMode] = useState<'grid' | 'day' | 'week'>('grid');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Filter systems
  const [filterTasks, setFilterTasks] = useState(true);
  const [filterHabits, setFilterHabits] = useState(true);
  const [filterGoals, setFilterGoals] = useState(true);
  const [filterBills, setFilterBills] = useState(true);
  const [filterSchedule, setFilterSchedule] = useState(true);
  const [filterJournal, setFilterJournal] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Drawers and quick adds
  const [isUnplannedOpen, setIsUnplannedOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Modals for editing task & schedule items
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [universalModalType, setUniversalModalType] = useState<'event' | 'task' | 'habit' | 'goal' | 'medication' | 'bill' | 'journal' | null>(null);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [initialHourForAdd, setInitialHourForAdd] = useState<string | undefined>(undefined);

  // Micro-celebration interaction state for planner items
  const [celebratingPlannerId, setCelebratingPlannerId] = useState<string | null>(null);
  const [plannerCelebrationKey, setPlannerCelebrationKey] = useState<number>(0);
  const [plannerBadgeText, setPlannerBadgeText] = useState<string>('Done✅');

  const [selectedDetailHabit, setSelectedDetailHabit] = useState<Habit | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showHabitForm, setShowHabitForm] = useState(false);

  // Sunsama & Akiflow style Daily Agenda interactive states
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'scheduled' | 'habits' | 'tasks'>('all');
  const [timeblockDropdownTaskId, setTimeblockDropdownTaskId] = useState<string | null>(null);
  const [showShutdownModal, setShowShutdownModal] = useState<boolean>(false);

  const handleRolloverTasks = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);
    const incompleteTasks = tasks.filter(t => !t.completed && t.dueDate === selectedDate);
    if (incompleteTasks.length === 0) {
      pushNotification('All Tasks Completed', 'No pending tasks to roll over for this date.', 'task');
      return;
    }
    incompleteTasks.forEach(t => {
      updateTask({ ...t, dueDate: tomorrowStr });
    });
    soundEngine?.playSuccessChime?.();
    pushNotification('Tasks Rolled Over', `Moved ${incompleteTasks.length} pending task${incompleteTasks.length === 1 ? '' : 's'} to tomorrow (${tomorrowStr}).`, 'task');
  };

  const handleQuickTimeblock = (task: TaskItem, hour: string) => {
    const startH = hour.padStart(2, '0');
    const endH = String(Number(startH) + 1).padStart(2, '0');
    addScheduleItem({
      title: task.title,
      date: selectedDate,
      startTime: `${startH}:00`,
      endTime: `${endH}:00`,
      category: 'work',
      priority: task.priority || 'medium',
      completed: task.completed,
      taskId: task.id,
      notes: task.notes,
    });
    soundEngine?.playSuccessChime?.();
    pushNotification('Task Time-Blocked', `"${task.title}" scheduled for ${startH}:00.`, 'calendar');
    setTimeblockDropdownTaskId(null);
  };

  const handleToggleWithCelebration = (id: string, type: 'task' | 'schedule' | 'habit') => {
    if (type === 'task') {
      const t = tasks.find(item => item.id === id);
      const wasCompleted = t?.completed;
      toggleTask(id, { skipSound: true });
      if (!wasCompleted) {
        setPlannerBadgeText('Done✅');
        setCelebratingPlannerId(id);
        setPlannerCelebrationKey(k => k + 1);
        try {
          soundEngine.playWaterDropNotification();
          haptics.complete();
        } catch {}
        setTimeout(() => setCelebratingPlannerId(null), 1200);
      } else {
        haptics.toggle();
      }
    } else if (type === 'schedule') {
      const s = scheduleItems.find(item => item.id === id);
      const wasCompleted = s?.completed;
      toggleScheduleItem(id);
      if (!wasCompleted) {
        setPlannerBadgeText('Done✔️');
        setCelebratingPlannerId(id);
        setPlannerCelebrationKey(k => k + 1);
        try {
          soundEngine.playWaterDropNotification();
          haptics.complete();
        } catch {}
        setTimeout(() => setCelebratingPlannerId(null), 1200);
      } else {
        haptics.toggle();
      }
    } else if (type === 'habit') {
      const habit = habits.find(item => item.id === id);
      const wasChecked = !!habit?.completionHistory?.[selectedDate];
      toggleHabitDay(id, selectedDate, { skipSound: true });
      if (!wasChecked) {
        const streakNum = (habit?.currentStreak || 0) + 1;
        setPlannerBadgeText(`Done🔥 ${Math.max(1, streakNum)}D`);
        setCelebratingPlannerId(id);
        setPlannerCelebrationKey(k => k + 1);
        try {
          soundEngine.playWaterDropNotification();
          haptics.complete();
        } catch {}
        setTimeout(() => setCelebratingPlannerId(null), 1200);
      } else {
        haptics.toggle();
      }
    }
  };

  // Month navigation
  const monthYear = currentMonthDate.getFullYear();
  const monthNum = currentMonthDate.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(monthYear, monthNum - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(monthYear, monthNum + 1, 1));
  };

  const handleToday = () => {
    setCurrentMonthDate(new Date());
    setSelectedDate(todayStr);
  };

  // Stepper for selected date (prev / next day)
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const newStr = formatLocalDate(d);
    setSelectedDate(newStr);
    setCurrentMonthDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const newStr = formatLocalDate(d);
    setSelectedDate(newStr);
    setCurrentMonthDate(d);
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    const newStr = formatLocalDate(d);
    setSelectedDate(newStr);
    setCurrentMonthDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const newStr = formatLocalDate(d);
    setSelectedDate(newStr);
    setCurrentMonthDate(d);
  };

  // Compile Unified Master Events Map for Month / Week view
  const masterEvents = useMemo(() => {
    const list: MasterEventItem[] = [];

    // 1. Tasks
    if (filterTasks) {
      tasks.forEach(t => {
        if (!t.dueDate) return;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'pending' && !t.completed) ||
          (statusFilter === 'completed' && t.completed);
        const matchesSearch =
          searchQuery === '' ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesStatus || !matchesSearch) return;

        list.push({
          id: `task-${t.id}`,
          type: 'task',
          title: t.title,
          date: t.dueDate,
          time: t.dueTime,
          completed: t.completed,
          color: '#06b6d4',
          badgeBg: 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-200 dark:border-cyan-800',
          badgeText: 'text-cyan-950 dark:text-cyan-200 font-semibold',
          icon: <CheckSquare className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />,
          subtitle: `${t.priority} • ${t.project || 'General'}`,
          rawItem: t,
        });
      });
    }

    // 2. Habits
    if (filterHabits) {
      habits.forEach(h => {
        Object.entries(h.completionHistory).forEach(([dateStr, isDone]) => {
          if (!isDone) return;
          const matchesStatus = statusFilter === 'all' || (statusFilter === 'completed' && isDone);
          const matchesSearch = searchQuery === '' || h.name.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchesStatus || !matchesSearch) return;

          list.push({
            id: `habit-${h.id}-${dateStr}`,
            type: 'habit',
            title: h.name,
            date: dateStr,
            completed: true,
            color: '#10b981',
            badgeBg: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800',
            badgeText: 'text-emerald-950 dark:text-emerald-200 font-semibold',
            icon: <Flame className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />,
            subtitle: `${h.currentStreak} day streak`,
            rawItem: h,
          });
        });
      });
    }

    // 3. Goals & Milestones
    if (filterGoals) {
      goals.forEach(g => {
        if (g.targetDate) {
          const isDone = g.status === 'completed' || g.progress >= 100;
          const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'pending' && !isDone) ||
            (statusFilter === 'completed' && isDone);
          const matchesSearch = searchQuery === '' || g.title.toLowerCase().includes(searchQuery.toLowerCase());
          if (matchesStatus && matchesSearch) {
            list.push({
              id: `goal-${g.id}`,
              type: 'goal',
              title: `Goal: ${g.title}`,
              date: g.targetDate,
              completed: isDone,
              color: '#8b5cf6',
              badgeBg: 'bg-purple-50 dark:bg-purple-950/80 border-purple-200 dark:border-purple-800',
              badgeText: 'text-purple-950 dark:text-purple-200 font-semibold',
              icon: <Target className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />,
              subtitle: `${g.progress}% completed`,
              rawItem: g,
            });
          }
        }

        (g.milestones || []).forEach(m => {
          if (!m.dueDate) return;
          const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'pending' && !m.completed) ||
            (statusFilter === 'completed' && m.completed);
          const matchesSearch = searchQuery === '' || m.title.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchesStatus || !matchesSearch) return;

          list.push({
            id: `milestone-${g.id}-${m.id}`,
            type: 'goal',
            title: `Milestone: ${m.title}`,
            date: m.dueDate,
            completed: m.completed,
            color: '#a855f7',
            badgeBg: 'bg-purple-50 dark:bg-purple-950/80 border-purple-200 dark:border-purple-800',
            badgeText: 'text-purple-950 dark:text-purple-200 font-semibold',
            icon: <Target className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />,
            subtitle: `For ${g.title}`,
            rawItem: { goal: g, milestone: m },
          });
        });
      });
    }

    // 4. Bills
    if (filterBills) {
      bills.forEach(b => {
        if (!b.dueDate) return;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'pending' && !b.isPaid) ||
          (statusFilter === 'completed' && b.isPaid);
        const matchesSearch = searchQuery === '' || b.title.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesStatus || !matchesSearch) return;

        list.push({
          id: `bill-${b.id}`,
          type: 'bill',
          title: `Bill: ${b.title}`,
          date: b.dueDate,
          completed: b.isPaid,
          color: '#f43f5e',
          badgeBg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800',
          badgeText: 'text-rose-950 dark:text-rose-200 font-semibold',
          icon: <CreditCard className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />,
          subtitle: `${formatCurrency(b.amount)} • ${b.isPaid ? 'Paid' : 'Due'}`,
          rawItem: b,
        });
      });
    }

    // 5. Schedule Items
    if (filterSchedule) {
      scheduleItems.forEach(s => {
        if (!s.date) return;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'pending' && !s.completed) ||
          (statusFilter === 'completed' && s.completed);
        const matchesSearch =
          searchQuery === '' ||
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesStatus || !matchesSearch) return;

        list.push({
          id: `schedule-${s.id}`,
          type: 'schedule',
          title: s.title,
          date: s.date,
          time: `${s.startTime} - ${s.endTime}`,
          completed: s.completed,
          color: '#f59e0b',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800',
          badgeText: 'text-amber-950 dark:text-amber-200 font-semibold',
          icon: <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />,
          subtitle: `${s.category || 'General'}`,
          rawItem: s,
        });
      });
    }

    // 6. Journal Entries
    if (filterJournal) {
      journalEntries.forEach(j => {
        const matchesSearch =
          searchQuery === '' ||
          j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.content.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return;

        list.push({
          id: `journal-${j.id}`,
          type: 'journal',
          title: `Reflected: ${j.title || 'Journal Entry'}`,
          date: j.date,
          completed: true,
          color: '#6366f1',
          badgeBg: 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800',
          badgeText: 'text-indigo-950 dark:text-indigo-200 font-semibold',
          icon: <BookLock className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />,
          subtitle: `${j.mood || 'Reflection'}`,
          rawItem: j,
        });
      });
    }

    return list;
  }, [
    tasks,
    habits,
    goals,
    bills,
    scheduleItems,
    journalEntries,
    filterTasks,
    filterHabits,
    filterGoals,
    filterBills,
    filterSchedule,
    filterJournal,
    statusFilter,
    searchQuery,
    formatCurrency,
  ]);

  // Calendar Month Grid Generator
  const monthGridDays = useMemo(() => {
    const firstDayIndex = new Date(monthYear, monthNum, 1).getDay();
    const daysInMonth = new Date(monthYear, monthNum + 1, 0).getDate();
    const daysInPrevMonth = new Date(monthYear, monthNum, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month tail days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = monthNum === 0 ? 11 : monthNum - 1;
      const prevYear = monthNum === 0 ? monthYear - 1 : monthYear;
      const dateStr = toDateString(prevYear, prevMonth, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateString(monthYear, monthNum, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Next month starting days to complete grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = monthNum === 11 ? 0 : monthNum + 1;
      const nextYear = monthNum === 11 ? monthYear + 1 : monthYear;
      const dateStr = toDateString(nextYear, nextMonth, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return days;
  }, [monthYear, monthNum]);

  // Week View Days (7 days centered around selectedDate)
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const startOfWeek = new Date(y, m - 1, d - dayOfWeek);
    const days: { dateStr: string; dayNum: number; dayName: string }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const iterDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
      const dateStr = formatLocalDate(iterDate);
      days.push({
        dateStr,
        dayNum: iterDate.getDate(),
        dayName: dayNames[i],
      });
    }
    return days;
  }, [selectedDate]);

  // Index events by date string (including recurring schedule events across visible grid)
  const eventsByDate = useMemo(() => {
    const map: Record<string, MasterEventItem[]> = {};

    masterEvents.forEach(item => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });

    if (filterSchedule) {
      const allDates = new Set<string>([
        selectedDate,
        todayStr,
        ...monthGridDays.map(d => d.dateStr),
        ...weekDays.map(d => d.dateStr),
      ]);

      const recurringItems = scheduleItems.filter(s => s.repeatType && s.repeatType !== 'none');

      allDates.forEach(dateStr => {
        recurringItems.forEach(s => {
          if (dateStr === s.date) return; // already added in masterEvents for initial date
          if (isScheduleItemOnDate(s, dateStr)) {
            const matchesStatus =
              statusFilter === 'all' ||
              (statusFilter === 'pending' && !s.completed) ||
              (statusFilter === 'completed' && s.completed);
            const matchesSearch =
              searchQuery === '' ||
              s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

            if (matchesStatus && matchesSearch) {
              if (!map[dateStr]) map[dateStr] = [];
              map[dateStr].push({
                id: `schedule-rec-${s.id}-${dateStr}`,
                type: 'schedule',
                title: s.title,
                date: dateStr,
                time: `${s.startTime} - ${s.endTime}`,
                completed: s.completed,
                color: '#f59e0b',
                badgeBg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800',
                badgeText: 'text-amber-950 dark:text-amber-200 font-semibold',
                icon: <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />,
                subtitle: `${s.category || 'General'} (Repeats)`,
                rawItem: s,
              });
            }
          }
        });
      });
    }

    return map;
  }, [masterEvents, filterSchedule, scheduleItems, monthGridDays, weekDays, selectedDate, todayStr, statusFilter, searchQuery]);

  // Schedule items for selectedDate (including recurrence)
  const scheduleDateItems = useMemo(() => {
    return scheduleItems.filter(item => {
      const matchesDate = isScheduleItemOnDate(item, selectedDate);
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDate && matchesSearch;
    });
  }, [scheduleItems, selectedDate, searchQuery]);

  // Formatted date title
  const formattedDateTitle = useMemo(() => {
    try {
      const [year, month, day] = selectedDate.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      const full = d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${day}/${month}/${year} • ${full}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Chronological unified items for Timeline view
  const timelineItems = useMemo(() => {
    const list: TimelineUnifiedItem[] = [];

    // 1. Tasks due on this day (exclude tasks already scheduled as scheduleItems on this date)
    if (filterTasks) {
      const scheduledTaskIds = new Set(
        scheduleItems
          .filter(s => isScheduleItemOnDate(s, selectedDate) && s.taskId)
          .map(s => s.taskId)
      );

      tasks
        .filter(t => t.dueDate === selectedDate && !scheduledTaskIds.has(t.id))
        .forEach(t => {
          list.push({
            id: `task-${t.id}`,
            sourceType: 'task',
            title: t.title,
            startTime: t.dueTime || undefined,
            completed: t.completed,
            category: t.project || 'Personal',
            priority: t.priority,
            notes: t.notes,
            subtasks: t.subtasks,
            reminderType: t.reminderType,
            rawTask: t,
          });
        });
    }

    // 2. Schedule events on this day
    if (filterSchedule) {
      scheduleItems
        .filter(s => isScheduleItemOnDate(s, selectedDate))
        .forEach(s => {
          list.push({
            id: `event-${s.id}`,
            sourceType: 'event',
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime,
            completed: s.completed,
            category: s.category || 'General',
            priority: s.priority,
            notes: s.notes,
            reminderType: s.reminderType,
            rawSchedule: s,
          });
        });
    }

    // 3. Habits scheduled or completed for today
    if (filterHabits) {
      habits.forEach(h => {
        const isDoneToday = !!h.completionHistory[selectedDate];
        list.push({
          id: `habit-${h.id}`,
          sourceType: 'habit',
          title: h.name,
          startTime: h.reminderTime || (h.targetTimeOfDay === 'morning' ? '08:00' : h.targetTimeOfDay === 'afternoon' ? '13:00' : '19:00'),
          completed: isDoneToday,
          category: h.category || 'Habit',
          rawHabit: h,
        });
      });
    }

    // Sort by startTime or fallback
    return list.sort((a, b) => {
      const timeA = a.startTime || '99:99';
      const timeB = b.startTime || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [tasks, scheduleItems, habits, selectedDate, filterTasks, filterSchedule, filterHabits]);

  // Comprehensive Timeline & Free-Time Alignment Analysis
  const scheduleAnalysis = useMemo(() => {
    const dateEvents = scheduleDateItems.filter(s => s.startTime && s.endTime);
    
    // Parse minute intervals
    const parsed = dateEvents.map(s => {
      const [sH, sM] = s.startTime.split(':').map(Number);
      const [eH, eM] = s.endTime.split(':').map(Number);
      const startMin = (isNaN(sH) ? 0 : sH) * 60 + (sM || 0);
      const endMin = (isNaN(eH) ? 0 : eH) * 60 + (eM || 0);
      const duration = Math.max(0, endMin - startMin);
      const isBigBlock = duration >= 90; // 1.5h+ (e.g., 6 to 9 is 3 hrs)
      return { item: s, startMin, endMin, duration, isBigBlock };
    }).sort((a, b) => a.startMin - b.startMin);

    // Overlaps detection (e.g. another item scheduled inside a big event)
    const overlaps: { itemA: ScheduleItem; itemB: ScheduleItem; reason: string }[] = [];
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i];
        const b = parsed[j];
        if (a.startMin < b.endMin && a.endMin > b.startMin) {
          overlaps.push({
            itemA: a.item,
            itemB: b.item,
            reason: `"${b.item.title}" overlaps during "${a.item.title}" (${a.item.startTime} – ${a.item.endTime})`,
          });
        }
      }
    }

    // Free-time windows calculation
    const freeGaps: { startStr: string; endStr: string; durationMins: number; label: string; afterTitle?: string }[] = [];
    let currentCursor = 8 * 60; // 08:00 AM
    parsed.forEach(p => {
      if (p.startMin > currentCursor) {
        const gapMins = p.startMin - currentCursor;
        if (gapMins >= 30) {
          const sH = Math.floor(currentCursor / 60);
          const sM = currentCursor % 60;
          const eH = Math.floor(p.startMin / 60);
          const eM = p.startMin % 60;
          const sStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
          const eStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
          freeGaps.push({
            startStr: sStr,
            endStr: eStr,
            durationMins: gapMins,
            label: `${Math.floor(gapMins / 60)}h ${gapMins % 60 > 0 ? `${gapMins % 60}m` : ''}`.trim(),
          });
        }
      }
      if (p.endMin > currentCursor) {
        currentCursor = p.endMin;
      }
    });

    if (currentCursor < 21 * 60) {
      const gapMins = 21 * 60 - currentCursor;
      if (gapMins >= 30) {
        const sH = Math.floor(currentCursor / 60);
        const sM = currentCursor % 60;
        const sStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
        freeGaps.push({
          startStr: sStr,
          endStr: '21:00',
          durationMins: gapMins,
          label: `${Math.floor(gapMins / 60)}h ${gapMins % 60 > 0 ? `${gapMins % 60}m` : ''}`.trim(),
        });
      }
    }

    const bigEvents = parsed.filter(p => p.isBigBlock).map(p => p.item);

    return {
      overlaps,
      freeGaps,
      bigEvents,
      hasConflicts: overlaps.length > 0,
    };
  }, [scheduleDateItems]);

  // Unplanned backlog tasks
  const unplannedTasks = useMemo(() => {
    return tasks.filter(t => !t.completed && (!t.dueDate || t.isSomeday));
  }, [tasks]);

  // Total planned time & Day completion stats for Today's Rhythm
  const totalPlannedMinutesToday = useMemo(() => {
    return scheduleDateItems.reduce((acc, curr) => {
      if (!curr.startTime || !curr.endTime) return acc;
      const [sH, sM] = curr.startTime.split(':').map(Number);
      const [eH, eM] = curr.endTime.split(':').map(Number);
      if (isNaN(sH) || isNaN(eH)) return acc;
      const diff = (eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0));
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  }, [scheduleDateItems]);

  const formattedTotalPlannedTime = useMemo(() => {
    const h = Math.floor(totalPlannedMinutesToday / 60);
    const m = totalPlannedMinutesToday % 60;
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, [totalPlannedMinutesToday]);

  const dayStats = useMemo(() => {
    const total = timelineItems.length;
    const completed = timelineItems.filter(i => i.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [timelineItems]);

  // Multi-System entity counts strictly synchronized with selectedDate
  const systemCounts = useMemo(() => {
    const tasksOnDate = tasks.filter(t => t.dueDate === selectedDate).length;
    const scheduleOnDate = scheduleItems.filter(s => isScheduleItemOnDate(s, selectedDate)).length;
    const habitsCount = habits.length;
    const billsOnDate = bills.filter(b => b.dueDate === selectedDate).length;
    const goalsCount = goals.filter(g => g.status !== 'completed' && g.progress < 100).length;
    const journalOnDate = journalEntries.filter(j => j.date === selectedDate).length;
    return {
      tasks: tasksOnDate,
      schedule: scheduleOnDate,
      habits: habitsCount,
      bills: billsOnDate,
      goals: goalsCount,
      journal: journalOnDate,
    };
  }, [tasks, scheduleItems, habits, bills, goals, journalEntries, selectedDate]);

  // Handlers
  const handleAutoSchedule = () => {
    autoScheduleTasksForDate(selectedDate);
    soundEngine?.playSuccessChime?.();
  };

  const handleAlignAllOverlapsToFreeTime = () => {
    if (scheduleAnalysis.overlaps.length === 0) {
      pushNotification('All Clear', 'No schedule conflicts found! Events are already cleanly aligned in free time.', 'calendar');
      return;
    }

    // Clone free gaps so we can modify them as we fit events
    const tempGaps = scheduleAnalysis.freeGaps.map(g => {
      const [h, m] = g.startStr.split(':').map(Number);
      return {
        startMin: h * 60 + m,
        durationMins: g.durationMins,
      };
    });

    let alignedCount = 0;
    scheduleAnalysis.overlaps.forEach(conflict => {
      const targetItem = conflict.itemB;
      const bigEvent = conflict.itemA;

      const [curSH, curSM] = (targetItem.startTime || '09:00').split(':').map(Number);
      const [curEH, curEM] = (targetItem.endTime || '10:00').split(':').map(Number);
      const curDur = Math.max(30, ((isNaN(curEH) ? 10 : curEH) * 60 + (curEM || 0)) - ((isNaN(curSH) ? 9 : curSH) * 60 + (curSM || 0)));

      // Find the first free slot that can fit this duration
      const foundIndex = tempGaps.findIndex(g => g.durationMins >= curDur);
      
      let newStartMin: number;
      if (foundIndex !== -1) {
        const slot = tempGaps[foundIndex];
        newStartMin = slot.startMin;
        
        // Update the gap: it's now partially occupied
        slot.startMin += curDur;
        slot.durationMins -= curDur;
      } else {
        // Fallback: place right after the big event
        const [bEH, bEM] = (bigEvent.endTime || '09:00').split(':').map(Number);
        const bigEndMin = (isNaN(bEH) ? 9 : bEH) * 60 + (bEM || 0);
        newStartMin = Math.max(bigEndMin, 8 * 60);
      }

      const newEndMin = newStartMin + curDur;
      const newSH = Math.floor(newStartMin / 60) % 24;
      const newSM = newStartMin % 60;
      const newEH = Math.floor(newEndMin / 60) % 24;
      const newEM = newEndMin % 60;

      const newStartStr = `${String(newSH).padStart(2, '0')}:${String(newSM).padStart(2, '0')}`;
      const newEndStr = `${String(newEH).padStart(2, '0')}:${String(newEM).padStart(2, '0')}`;

      const auditNote = `Aligned in free time (${newStartStr} – ${newEndStr}) outside "${bigEvent.title || 'busy block'}"`;

      updateScheduleItem({
        ...targetItem,
        startTime: newStartStr,
        endTime: newEndStr,
        notes: targetItem.notes ? `${targetItem.notes} • ${auditNote}` : auditNote,
      });
      alignedCount++;
    });

    soundEngine?.playSuccessChime?.();
    pushNotification(
      'Schedule Aligned',
      `Aligned ${alignedCount} overlapping item(s) into open free time outside big event blocks!`,
      'calendar'
    );
  };

  const handleEditScheduleItem = (item: ScheduleItem) => {
    setEditingScheduleItem(item);
    setInitialHourForAdd(undefined);
    setIsEventModalOpen(true);
  };

  const handleOpenAddAtHour = (hour: string) => {
    setEditingScheduleItem(null);
    setInitialHourForAdd(hour);
    setIsEventModalOpen(true);
  };

  const handleOpenAddAtTime = (startTime: string, endTime?: string) => {
    setEditingScheduleItem(null);
    setInitialHourForAdd(startTime.split(':')[0]);
    setIsEventModalOpen(true);
  };

  const handleStartScheduleFocus = (item: ScheduleItem) => {
    if (item.taskId) {
      setPomodoroTask(item.taskId);
    }
    startPomodoro();
  };

  // Quick task submit from timeline input
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddText.trim()) return;

    addTask({
      title: quickAddText.trim(),
      dueDate: selectedDate,
      priority: 'medium',
      status: 'todo',
      quadrant: 'urgent_important',
      project: 'Personal',
      completed: false,
      subtasks: [],
      estimatedPomodoros: 1,
      recurring: 'none',
    });

    setQuickAddText('');
    soundEngine?.playSuccessChime?.();
  };

  // Export iCal (.ics) file
  const handleExportICal = () => {
    let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//OmniLifeOS//Planner//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n`;

    masterEvents.forEach(ev => {
      const dtStart = ev.date.replace(/-/g, '') + 'T090000Z';
      const dtEnd = ev.date.replace(/-/g, '') + 'T100000Z';
      icsContent += `BEGIN:VEVENT\nUID:${ev.id}@omnilifeos.local\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${ev.title}\nDESCRIPTION:${ev.subtitle || ''}\nSTATUS:${ev.completed ? 'COMPLETED' : 'CONFIRMED'}\nEND:VEVENT\n`;
    });

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `omnilifeos_planner_${selectedDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    pushNotification('Planner Exported', 'Downloaded .ics file ready for Google Calendar or Apple Calendar.', 'system');
  };

  const isSelectedDateToday = selectedDate === todayStr;

  return (
    <div className="space-y-2.5 sm:space-y-3 max-w-full pb-4">
      {/* Master Planner Title Banner */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <CalendarClock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 truncate">
              <span>Smart Planner</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 shrink-0">
                Unified
              </span>
            </h2>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Calendar, schedule, and time-blocking
            </p>
          </div>
        </div>

        {/* Action Controls in Header - Inline Right */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={handleAutoSchedule}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Auto-fill open slots from backlog tasks"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Auto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingScheduleItem(null);
              setInitialHourForAdd(undefined);
              setUniversalModalType('event');
            }}
            className="p-1.5 sm:p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center"
            title="Add Event / Schedule Block (1st)"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget */}
      <QuoteBanner />

      {/* Scrollable Compact Date Strip */}
      <ScrollableCompactDateStrip selectedDateStr={selectedDate} onSelectDate={setSelectedDate} className="my-1.5" />

      {/* Master View Switcher & Date Synchronizer Ribbon - Super Productivity Clean 2-Row Layout */}
      <div className="p-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Unified Planner Mode Switcher - Planner & Events with Merged Inbox */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs shrink-0 overflow-x-auto max-w-full">
            <button
              type="button"
              id="btn-nav-week-day-unified"
              onClick={() => setActiveView('day')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                activeView === 'day' || activeView === 'week' || activeView === 'timeline' || activeView === 'hourly'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Schedule Timeline & Events Planner"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Planner & Events</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('month')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                activeView === 'month'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3 h-3" />
              <span>Month</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('priority')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                activeView === 'priority'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              <span>Priority</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('deadlines')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                activeView === 'deadlines'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Deadlines</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('printable')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold text-xs transition cursor-pointer ${
                activeView === 'printable'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3 h-3" />
              <span>Print</span>
            </button>
          </div>

          {/* Quick Date Stepper & Today Button */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={activeView === 'month' ? handlePrevMonth : handlePrevDay}
                className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title={activeView === 'month' ? 'Previous Month' : 'Previous Day'}
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2 py-0.5 text-[11px] font-semibold rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={activeView === 'month' ? handleNextMonth : handleNextDay}
                className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title={activeView === 'month' ? 'Next Month' : 'Next Day'}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Date Input / Current Label */}
            {activeView === 'month' ? (
              <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
                {monthNames[monthNum]} {monthYear}
              </span>
            ) : (
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    setCurrentMonthDate(new Date(e.target.value + 'T00:00:00'));
                  }}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs h-7"
                />
              </div>
            )}
          </div>
        </div>

        {/* Multi-System Entity Filter Chips + Search/Status Bar on Row 2 */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400 mr-0.5 flex items-center gap-1 shrink-0 text-[11px]">
              <Filter className="w-3 h-3 text-slate-400" /> Systems:
            </span>

            {/* Quick Toggle All */}
            <button
              type="button"
              onClick={() => {
                const anyOff = !filterHabits || !filterSchedule;
                setFilterHabits(anyOff);
                setFilterSchedule(anyOff);
              }}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Toggle all systems on/off"
            >
              All
            </button>

            {/* Habits */}
            <button
              type="button"
              onClick={() => setFilterHabits(!filterHabits)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                filterHabits
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xs'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent opacity-60'
              }`}
              title={`Toggle Habits (${systemCounts.habits})`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterHabits ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <Flame className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Habits</span>
              <span className="text-[10.5px] font-bold font-mono opacity-80">({systemCounts.habits})</span>
            </button>

            {/* Schedule */}
            <button
              type="button"
              onClick={() => setFilterSchedule(!filterSchedule)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                filterSchedule
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-2xs'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent opacity-60'
              }`}
              title={`Toggle Schedule (${systemCounts.schedule} on ${formattedDateTitle})`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filterSchedule ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Schedule</span>
              <span className="text-[10.5px] font-bold font-mono opacity-80">({systemCounts.schedule})</span>
            </button>
          </div>

          {/* Search bar & Status filter */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap w-full sm:w-auto justify-between sm:justify-start">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search planner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-0.5 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-200 w-full sm:w-40 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-2 py-0.5 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium shrink-0 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Only</option>
              <option value="completed">Completed Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: MASTER MONTH CALENDAR */}
      {activeView === 'month' && (
        <div className="space-y-4">
          {/* Legend of Colorful Points (Consistent across Mobile & Web) */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex-wrap">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Day Points:</span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-2xs" />
                <span>Tasks</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
                <span>Habits</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-2xs" />
                <span>Schedule</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-2xs" />
                <span>Bills</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-2xs" />
                <span>Goals</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">Click any day to inspect & time-block</span>
          </div>

          {/* Month Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-center py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
              {monthGridDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
                const dayEvents = eventsByDate[dateStr] || [];
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={`planner-grid-${dateStr}-${idx}`}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[58px] sm:min-h-[68px] md:min-h-[76px] p-1.5 sm:p-2 transition flex flex-col group cursor-pointer ${
                      !isCurrentMonth
                        ? 'bg-slate-50/40 dark:bg-slate-950/20 text-slate-400 dark:text-slate-600'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    } ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/40 dark:bg-indigo-950/40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[11px] sm:text-xs font-semibold ${
                          isToday
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dayNum}
                      </span>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedDate(dateStr);
                          setActiveView('day');
                          setDayViewMode('day');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600 transition"
                        title="Open Day View"
                      >
                        <Layers className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Compact Colored Points */}
                    <div className="flex items-center justify-center gap-1 mt-auto pt-1 flex-wrap">
                      {dayEvents.slice(0, 5).map((ev, dIdx) => {
                        const dotColor =
                          ev.type === 'task'
                            ? 'bg-cyan-500'
                            : ev.type === 'schedule'
                            ? 'bg-amber-500'
                            : ev.type === 'bill'
                            ? 'bg-rose-500'
                            : ev.type === 'habit'
                            ? 'bg-emerald-500'
                            : ev.type === 'goal'
                            ? 'bg-purple-500'
                            : 'bg-indigo-500';
                        return (
                          <span
                            key={dIdx}
                            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotColor} ${
                              ev.completed ? 'opacity-40 ring-1 ring-white/50' : 'shadow-2xs'
                            }`}
                            title={`${ev.title} (${ev.type})`}
                          />
                        );
                      })}
                      {dayEvents.length > 5 && (
                        <span className="w-full text-center text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                          +{dayEvents.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Summary Card with Quick Switch to Timeline */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Day Agenda for {formattedDateTitle}</span>
                  {isSelectedDateToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                      Today
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  {eventsByDate[selectedDate]?.length || 0} items planned for this date
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('day');
                    setDayViewMode('day');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open Day Timeline View</span>
                </button>
              </div>
            </div>

            {/* List of items on this selected day */}
            <div className="space-y-2 pt-1">
              {(eventsByDate[selectedDate] || []).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No items scheduled for this day. Click "+ Task" or "+ Block" above to add one.
                </div>
              ) : (
                (eventsByDate[selectedDate] || []).map(ev => (
                  <div
                    key={ev.id}
                    className="p-2.5 sm:p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {ev.icon}
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-bold block truncate ${
                            ev.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {ev.title}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                          {ev.time ? `${ev.time} • ` : ''}
                          {ev.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {ev.type === 'task' && (
                        <div className="relative flex items-center justify-center">
                          <CheckmarkCelebration
                            activeKey={celebratingPlannerId === ev.rawItem.id ? plannerCelebrationKey : null}
                            badgeText={plannerBadgeText}
                            ringColor="border-emerald-500"
                            align="right"
                          />
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.85 }}
                            animate={celebratingPlannerId === ev.rawItem.id ? { scale: [1, 1.22, 0.94, 1] } : {}}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            onClick={() => handleToggleWithCelebration(ev.rawItem.id, 'task')}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
                            title={ev.completed ? 'Mark task incomplete' : 'Mark task complete'}
                          >
                            {ev.completed ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                                <AnimatedCheckIcon
                                  className="w-2.5 h-2.5 text-white"
                                  strokeWidth={3}
                                  animate={celebratingPlannerId === ev.rawItem.id}
                                />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-500 hover:border-emerald-500 transition" />
                            )}
                          </motion.button>
                        </div>
                      )}
                      {ev.type === 'schedule' && (
                        <div className="relative flex items-center justify-center">
                          <CheckmarkCelebration
                            activeKey={celebratingPlannerId === ev.rawItem.id ? plannerCelebrationKey : null}
                            badgeText={plannerBadgeText}
                            ringColor="border-blue-500"
                            align="right"
                          />
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.85 }}
                            animate={celebratingPlannerId === ev.rawItem.id ? { scale: [1, 1.22, 0.94, 1] } : {}}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            onClick={() => handleToggleWithCelebration(ev.rawItem.id, 'schedule')}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center"
                            title={ev.completed ? 'Mark event incomplete' : 'Mark event complete'}
                          >
                            {ev.completed ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                                <AnimatedCheckIcon
                                  className="w-2.5 h-2.5 text-white"
                                  strokeWidth={3}
                                  animate={celebratingPlannerId === ev.rawItem.id}
                                />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-500 hover:border-emerald-500 transition" />
                            )}
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED VIEW: WEEK & DAY (TIMELINE & HOURLY MERGED) */}
      {(activeView === 'day' || activeView === 'week' || activeView === 'timeline' || activeView === 'hourly') && (
        <div className="space-y-2.5 sm:space-y-3">
          {/* Unified Week & Day Control Card */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between gap-2.5 flex-wrap pb-1.5 border-b border-slate-100 dark:border-slate-800">
              {/* Left: Week & Day Stepper with Active Date Title */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    id="btn-planner-prev-week"
                    onClick={dayViewMode === 'week' ? handlePrevWeek : handlePrevDay}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title={dayViewMode === 'week' ? "Previous Week" : "Previous Day"}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    id="btn-planner-next-week"
                    onClick={dayViewMode === 'week' ? handleNextWeek : handleNextDay}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title={dayViewMode === 'week' ? "Next Week" : "Next Day"}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{formattedDateTitle}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Week of {weekDays[0]?.dayName}, {weekDays[0]?.dateStr} • {weekDays.reduce((acc, curr) => acc + (eventsByDate[curr.dateStr]?.length || 0), 0)} scheduled items
                  </p>
                </div>
              </div>

              {/* Right: Clean Sub-mode Switcher + Backlog Toggle on 1 Inline Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mode Switcher: Grid & 7D Week */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs shrink-0">
                  <button
                    type="button"
                    id="btn-submode-grid"
                    onClick={() => setDayViewMode('grid')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                      dayViewMode === 'grid'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                    title="Visual Time-Blocking Grid"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Grid</span>
                  </button>
                  <button
                    type="button"
                    id="btn-submode-week"
                    onClick={() => setDayViewMode('week')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                      dayViewMode === 'week'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                    title="7-Day multi-column week timeline overview"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>7D Week</span>
                  </button>
                </div>

                {/* Shortened Backlog Toggle directly inline on same row */}
                <button
                  type="button"
                  id="btn-toggle-companion-assistant"
                  onClick={() => {
                    const nextState = !(isUnplannedOpen || isAssistantOpen);
                    setIsUnplannedOpen(nextState);
                    setIsAssistantOpen(nextState);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer shrink-0 ${
                    isUnplannedOpen || isAssistantOpen
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={(isUnplannedOpen || isAssistantOpen) ? "Close backlog panel" : "Open unscheduled backlog tasks"}
                >
                  <ListTodo className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Backlog {unplannedTasks.length > 0 ? `(${unplannedTasks.length})` : ''}</span>
                  {(isUnplannedOpen || isAssistantOpen) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Compact Today's Rhythm Metric Pill */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>{dayStats.percent}% Done • {formattedTotalPlannedTime} Planned</span>
                </div>
              </div>
            </div>


          </div>

          {/* Unplanned Tasks Expandable Drawer */}
          {isUnplannedOpen && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Unscheduled Tasks Backlog
                </h4>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  Click 'Plan for Today' to schedule directly
                </span>
              </div>

              {unplannedTasks.length === 0 ? (
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 italic">
                  All caught up! No unplanned tasks in your backlog.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {unplannedTasks.slice(0, 8).map(task => (
                    <div
                      key={task.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                          {task.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {task.project || 'Inbox'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          updateTask({
                            ...task,
                            dueDate: selectedDate,
                            dueTime: '10:00',
                            isSomeday: false,
                          });
                          soundEngine?.playSuccessChime?.();
                        }}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition shrink-0 cursor-pointer"
                      >
                        Plan for {isSelectedDateToday ? 'Today' : selectedDate}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conditional Layout: Hourly only, Timeline only, or Split View */}
          <motion.div
            key={`day-view-submode-${selectedDate}-${dayViewMode}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {dayViewMode !== 'week' && (
              <div className="w-full space-y-3">
                {/* Main Split Grid Canvas for Desktop & Tablet */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Main Continuous Canvas: Visual Time-Blocking Grid */}
                  <div className={`space-y-3 ${
                    isAssistantOpen
                      ? 'lg:col-span-8 xl:col-span-9'
                      : 'w-full lg:col-span-12'
                  }`}>
                    <VisualTimeBlockingGrid
                      selectedDate={selectedDate}
                      items={scheduleDateItems}
                      timelineItems={timelineItems}
                      onAddAtTime={handleOpenAddAtTime}
                      onEditItem={handleEditScheduleItem}
                      onEditTask={setEditingTask}
                      onEditHabit={h => setSelectedDetailHabit(h)}
                      handleToggleWithCelebration={handleToggleWithCelebration}
                    />
                  </div>

                  {/* Day Planning & Focus Assistant */}
                  {isAssistantOpen && (
                    <div className="lg:col-span-4 xl:col-span-3 space-y-3.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Focus Companion
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAssistantOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-semibold"
                        title="Close Companion Assistant"
                      >
                        Hide ✕
                      </button>
                    </div>
                    {/* Today's Rhythm Card */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Today's Rhythm
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {dayStats.percent}% Complete
                      </span>
                    </div>

                    {/* Progress Bar & Planned Hours */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>{dayStats.completed} of {dayStats.total} done</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          {formattedTotalPlannedTime} planned
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${dayStats.percent}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Super-Productivity Actions */}
                    <div className="space-y-1.5 pt-1">
                      {scheduleAnalysis.hasConflicts && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{scheduleAnalysis.overlaps.length} Schedule Conflict{scheduleAnalysis.overlaps.length === 1 ? '' : 's'}</span>
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300">
                            {scheduleAnalysis.overlaps[0].reason}
                          </p>
                          <button
                            type="button"
                            onClick={handleAlignAllOverlapsToFreeTime}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Auto-Align Overlaps to Free Time</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAutoSchedule}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Auto-Schedule Open Slots</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </button>

                      <button
                        type="button"
                        onClick={handleRolloverTasks}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Roll Over Incomplete</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowShutdownModal(true)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-purple-50/60 hover:bg-purple-100/60 dark:bg-purple-950/30 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Daily Shutdown Ritual</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    </div>

                    {/* Timeline & Free-Time Alignment Analysis */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      {scheduleAnalysis.bigEvents.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 pb-1">
                            <span className="font-semibold flex items-center gap-1 text-[11px]">
                              <Layers className="w-3 h-3 text-indigo-500" /> Multi-Hour Big Blocks
                            </span>
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {scheduleAnalysis.bigEvents.length}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {scheduleAnalysis.bigEvents.map(be => (
                              <div key={be.id} className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-md flex items-center justify-between">
                                <span className="font-medium truncate max-w-[150px]">{be.title}</span>
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{be.startTime} – {be.endTime}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 pb-1">
                          <span className="font-semibold flex items-center gap-1 text-[11px]">
                            <Sparkles className="w-3 h-3 text-emerald-500" /> Verified Free Windows
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {scheduleAnalysis.freeGaps.length}
                          </span>
                        </div>
                        {scheduleAnalysis.freeGaps.length === 0 ? (
                          <p className="text-[10.5px] text-slate-400 italic">Day fully packed</p>
                        ) : (
                          <div className="space-y-1">
                            {scheduleAnalysis.freeGaps.slice(0, 3).map((fg, idx) => (
                              <div key={`fg-${idx}`} className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-1 rounded-md flex items-center justify-between border border-emerald-100 dark:border-emerald-900/40">
                                <span className="font-medium font-mono">{fg.startStr} – {fg.endStr}</span>
                                <span className="font-semibold">{fg.label} free</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Backlog & Unscheduled Tasks Box */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5 text-amber-500" />
                        <span>Backlog ({unplannedTasks.length})</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">Drag or click to plan</span>
                    </div>

                    {/* Quick Add inline */}
                    <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Quick add task..."
                        value={quickAddText}
                        onChange={e => setQuickAddText(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        Add
                      </button>
                    </form>

                    {/* Backlog list */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                      {unplannedTasks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">
                          Backlog is clear! All tasks planned.
                        </p>
                      ) : (
                        unplannedTasks.slice(0, 10).map(task => (
                          <div
                            key={task.id}
                            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 hover:bg-white dark:hover:bg-slate-800 transition flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                {task.title}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {task.project || 'General'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  updateTask({
                                    ...task,
                                    dueDate: selectedDate,
                                    isSomeday: false,
                                  });
                                  soundEngine?.playSuccessChime?.();
                                }}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
                                title="Plan for today"
                              >
                                Plan
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                )}
                </div>
              </div>
            )}

            {/* Sub-mode 4: 7-Day Multi-Column Week Grid */}
            {dayViewMode === 'week' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-end gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingScheduleItem(null);
                      setInitialHourForAdd(undefined);
                      setIsEventModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Block</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayViewMode('day')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Day Timeline View</span>
                  </button>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
                {weekDays.map(({ dateStr, dayNum, dayName }) => {
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-xs ring-1 ring-indigo-500/40'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/60'
                      }`}
                    >
                      <div>
                        {/* Day Column Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60 mb-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                            {dayName}
                          </span>
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              isToday
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : isSelected
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {dayNum}
                          </span>
                        </div>

                        {/* Event / Task List */}
                        <div className="space-y-1.5 flex-1 min-h-[160px]">
                          {dayEvents.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic block text-center pt-8">
                              No items
                            </span>
                          ) : (
                            dayEvents.slice(0, 6).map(ev => (
                              <div
                                key={ev.id}
                                onClick={e => {
                                  e.stopPropagation();
                                  if (ev.type === 'task' && ev.rawItem) {
                                    setEditingTask(ev.rawItem);
                                  } else if (ev.type === 'schedule' && ev.rawItem) {
                                    handleEditScheduleItem(ev.rawItem);
                                  }
                                }}
                                className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] flex items-center justify-between gap-1 shadow-2xs hover:border-indigo-400 transition"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className={`truncate font-semibold block ${ev.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {ev.title}
                                  </span>
                                  {ev.time && (
                                    <span className="text-[9px] text-slate-400 font-mono block">
                                      {ev.time}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: ev.color }}
                                />
                              </div>
                            ))
                          )}
                          {dayEvents.length > 6 && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block text-center pt-0.5">
                              +{dayEvents.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Column Footer: Quick Jump to Day Focus */}
                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedDate(dateStr);
                            setDayViewMode('day');
                          }}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>Open Day Schedule</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </motion.div>
        </div>
      )}

      {/* VIEW 5: PRIORITY MATRIX */}
      {activeView === 'priority' && (
        <PriorityScheduleView
          items={scheduleDateItems}
          onAddNew={() => {
            setEditingScheduleItem(null);
            setInitialHourForAdd(undefined);
            setIsEventModalOpen(true);
          }}
          onEditItem={handleEditScheduleItem}
        />
      )}

      {/* VIEW 6: DEADLINES COUNTDOWN */}
      {activeView === 'deadlines' && (
        <DeadlineScheduleView
          selectedDate={selectedDate}
          items={scheduleItems}
          onAddNew={() => {
            setEditingScheduleItem(null);
            setInitialHourForAdd(undefined);
            setIsEventModalOpen(true);
          }}
          onEditItem={handleEditScheduleItem}
        />
      )}

      {/* VIEW 7: PRINTABLE AGENDA */}
      {activeView === 'printable' && (
        <PrintableScheduleView
          selectedDate={selectedDate}
          items={scheduleDateItems}
          onToggleItem={toggleScheduleItem}
        />
      )}

      {/* Modals */}
      {editingTask && (
        <TaskDetailModal
          isOpen={!!editingTask}
          task={editingTask}
          onClose={() => {
            stopPomodoro();
            setEditingTask(null);
          }}
          onEdit={() => {}}
          onUpdateTask={updateTask}
          onDelete={id => {
            deleteTask(id);
            setEditingTask(null);
          }}
          onToggleComplete={toggleTask}
          onToggleStar={toggleStarTask}
        />
      )}

      {isNewTaskModalOpen && (
        <TaskFormModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          defaultDate={selectedDate}
          onSwitchToHabit={() => {
            setIsNewTaskModalOpen(false);
            setShowHabitForm(true);
          }}
          onSwitchToEvent={() => {
            setIsNewTaskModalOpen(false);
            setIsEventModalOpen(true);
          }}
        />
      )}

      {isEventModalOpen && (
        <ScheduleEventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          initialDate={selectedDate}
          editingItem={editingScheduleItem}
          initialHour={initialHourForAdd}
          onSwitchToTask={() => {
            setIsEventModalOpen(false);
            setIsNewTaskModalOpen(true);
          }}
          onSwitchToHabit={() => {
            setIsEventModalOpen(false);
            setShowHabitForm(true);
          }}
        />
      )}

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

      {universalModalType && (
        <ActivityManager
          isOpen={Boolean(universalModalType)}
          onClose={() => setUniversalModalType(null)}
          type={universalModalType}
        />
      )}

      {showHabitForm && (
        <ActivityManager
          isOpen={showHabitForm}
          onClose={() => {
            setShowHabitForm(false);
            setEditingHabit(null);
          }}
          type="habit"
          activityToEdit={editingHabit}
        />
      )}

      {/* Daily Shutdown & Evening Review Modal */}
      {showShutdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Daily Shutdown & Review
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formattedDateTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShutdownModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Completion Metric */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Today's Accomplishment</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {dayStats.completed} of {dayStats.total} Completed ({dayStats.percent}%)
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {formattedTotalPlannedTime} total time planned
                </span>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shadow-2xs">
                {dayStats.percent}%
              </div>
            </div>

            {/* Pending items action */}
            {dayStats.total - dayStats.completed > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pending Items ({dayStats.total - dayStats.completed}):
                  </span>
                  <button
                    type="button"
                    onClick={handleRolloverTasks}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Roll Over Incomplete to Tomorrow</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {timelineItems.filter(i => !i.completed).map(item => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.title}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{item.sourceType}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-1">
                <Award className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">All Done Today!</h4>
                <p className="text-xs text-slate-400">Everything scheduled for today was accomplished. Take time to relax!</p>
              </div>
            )}

            {/* Shutdown confirmation button */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowShutdownModal(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine?.playSuccessChime?.();
                  pushNotification('Daily Shutdown Complete', 'Great work today! Rest well and conquer tomorrow.', 'calendar');
                  setShowShutdownModal(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                Complete Shutdown Ritual
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PlannerPage;
