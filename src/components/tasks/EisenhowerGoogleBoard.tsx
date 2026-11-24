import React, { useState, useRef } from 'react';
import {
  Plus,
  Check,
  ArrowUpDown,
  Grid2X2,
  Columns4,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  Calendar,
  CalendarDays,
  ChevronDown,
  Sparkles,
  Maximize2,
  Minimize2,
  Bell,
  Repeat,
  Archive,
} from 'lucide-react';
import { OverdueIcon } from '../common/OverdueIcon';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { AnimatedCheckIcon, CheckmarkCelebration } from '../common/CheckmarkCelebration';
import { soundEngine } from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { TaskItem, EisenhowerQuadrant, Priority } from '../../types';
import { getTaskWeight, getSingleTaskDateReminder } from '../../utils/taskSorter';
import { formatLocalDate } from '../../utils/date';
import { DragAndDropContextType } from '../../hooks/useTaskDragAndDrop';

interface EisenhowerGoogleBoardProps {
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onOpenEditTask: (task: TaskItem) => void;
  onOpenDetailTask: (task: TaskItem) => void;
  onAddTask: (quadrant?: EisenhowerQuadrant) => void;
  onUpdateTaskQuadrant: (taskId: string, quadrant: EisenhowerQuadrant) => void;
  matchesFilterTab: (task: TaskItem) => boolean;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onCycleEisenhower?: (task: TaskItem) => void;
  onFilterCategory?: (catId: string) => void;
  onFilterTag?: (tag: string) => void;
  onFilterProject?: (project: string) => void;
  dndProps: DragAndDropContextType;
  filter?: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived';
  onFilterChange?: (filter: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived') => void;
  selectedTaskDate?: string;
  onSelectTaskDate?: (date: string) => void;
  todayCount?: number;
  overdueCount?: number;
  upcomingCount?: number;
  allCount?: number;
  dateCount?: number;
  completedCount?: number;
  archivedCount?: number;
}

type SortMode = 'manual' | 'dueDate' | 'starred' | 'title' | 'priority';
type LayoutMode = 'grid2x2' | 'columns';

interface QuadrantConfig {
  id: EisenhowerQuadrant;
  emoji: string;
  title: string;
  tag: string;
  color: string;
  headingColor: string;
  borderColor: string;
  badgeBg: string;
  activeDropClass: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: 'urgent_important',
    emoji: '🚨',
    title: 'DO',
    tag: '(Urg & Imp)',
    color: '#991b1b',
    headingColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-600 dark:border-red-700',
    badgeBg: 'bg-red-600 dark:bg-red-700',
    activeDropClass: 'border-red-600 bg-red-100/50 dark:bg-red-950/70 ring-2 ring-red-600/50',
  },
  {
    id: 'not_urgent_important',
    emoji: '⏳',
    title: 'PLAN',
    tag: '(Imp)',
    color: '#f59e0b',
    headingColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500',
    badgeBg: 'bg-amber-500',
    activeDropClass: 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 ring-2 ring-amber-500/40',
  },
  {
    id: 'urgent_not_important',
    emoji: '⏩',
    title: 'PASS',
    tag: '(Urg)',
    color: '#3b82f6',
    headingColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500',
    badgeBg: 'bg-blue-500',
    activeDropClass: 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/40',
  },
  {
    id: 'not_urgent_not_important',
    emoji: '💤',
    title: 'SKIP',
    tag: '(Neither)',
    color: '#8b5cf6',
    headingColor: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-500',
    badgeBg: 'bg-violet-500',
    activeDropClass: 'border-violet-500 bg-violet-50/40 dark:bg-violet-950/30 ring-2 ring-violet-500/40',
  },
];

const priorityOrder: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

const formatTickTickTime12h = (timeStr?: string): string => {
  if (!timeStr) return '';
  try {
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m}${period}`;
  } catch {
    return timeStr;
  }
};

const formatTickTickMatrixDate = (
  task: TaskItem,
  todayStr: string
): { label: string; status: 'overdue' | 'today' | 'upcoming' } | null => {
  if (!task.dueDate) return null;
  try {
    const dueStr = task.dueDate;
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const todayDate = new Date(ty, tm - 1, td);

    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(todayDate.getDate() + 1);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    const timeFormatted = formatTickTickTime12h(task.dueTime);

    if (dueStr === todayStr) {
      if (task.dueTime) {
        const now = new Date();
        const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const isPastTime = !task.completed && task.dueTime < nowHm;
        return {
          label: `Today, ${timeFormatted}`,
          status: isPastTime ? 'overdue' : 'today',
        };
      }
      return { label: 'Today', status: 'today' };
    }

    if (dueStr === yesterdayStr) {
      return {
        label: timeFormatted ? `Yesterday, ${timeFormatted}` : 'Yesterday',
        status: 'overdue',
      };
    }

    if (dueStr === tomorrowStr) {
      return {
        label: timeFormatted ? `Tomorrow, ${timeFormatted}` : 'Tomorrow',
        status: 'upcoming',
      };
    }

    const [y, m, d] = dueStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[m - 1] || '';
    const yearSuffix = y !== ty ? ` ${y}` : '';
    const shortDate = timeFormatted
      ? `${d} ${month}${yearSuffix}, ${timeFormatted}`
      : `${d} ${month}${yearSuffix}`;

    return {
      label: shortDate,
      status: dueStr < todayStr ? 'overdue' : 'upcoming',
    };
  } catch {
    return {
      label: task.dueDate,
      status: task.dueDate < todayStr ? 'overdue' : 'upcoming',
    };
  }
};

export const EisenhowerGoogleBoard: React.FC<EisenhowerGoogleBoardProps> = ({
  tasks,
  onToggleTask,
  onToggleStar,
  onOpenDetailTask,
  onAddTask,
  onUpdateTaskQuadrant,
  matchesFilterTab,
  dndProps,
  filter,
  onFilterChange,
  selectedTaskDate,
  onSelectTaskDate,
  todayCount,
  overdueCount,
  upcomingCount,
  allCount,
  dateCount,
  completedCount,
  archivedCount,
}) => {
  const [activeQuadId, setActiveQuadId] = useState<EisenhowerQuadrant>('urgent_important');
  const [columnSorts, setColumnSorts] = useState<Record<string, SortMode>>({});
  const [activeSortMenuQuad, setActiveSortMenuQuad] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid2x2');
  const [focusedQuadId, setFocusedQuadId] = useState<EisenhowerQuadrant | null>(null);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [localFilter, setLocalFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived'>('today');
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const handleToggleWithAnim = (task: TaskItem) => {
    if (task.completed) {
      haptics.toggle();
      onToggleTask(task.id);
      return;
    }
    if (completingIds.has(task.id)) return;
    try {
      soundEngine.playWaterDripNotification();
      haptics.complete();
    } catch {}
    setCompletingIds(prev => new Set(prev).add(task.id));
    setCelebratingId(task.id);
    setCelebrationKey(k => k + 1);
    setTimeout(() => {
      setFadingIds(prev => new Set(prev).add(task.id));
    }, 450);
    setTimeout(() => {
      onToggleTask(task.id);
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setFadingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setCelebratingId(prev => (prev === task.id ? null : prev));
    }, 680);
  };

  const activeFilter = filter ?? localFilter;

  const handleSelectFilter = (f: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived') => {
    if (onFilterChange) {
      onFilterChange(f);
    }
    setLocalFilter(f);
  };

  const carouselRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayStr = formatLocalDate(new Date());

  const scrollToQuad = (quadId: EisenhowerQuadrant) => {
    setActiveQuadId(quadId);
    const el = columnRefs.current[quadId];
    if (el && carouselRef.current) {
      const container = carouselRef.current;
      const targetLeft = el.offsetLeft - (container.clientWidth - el.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!carouselRef.current || layoutMode !== 'columns') return;
    const container = carouselRef.current;
    const scrollLeft = container.scrollLeft;
    const containerCenter = scrollLeft + container.clientWidth / 2;

    let closestQuadId = QUADRANTS[0].id;
    let minDistance = Infinity;

    QUADRANTS.forEach(q => {
      const el = columnRefs.current[q.id];
      if (el) {
        const elCenter = el.offsetLeft + el.clientWidth / 2;
        const dist = Math.abs(containerCenter - elCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestQuadId = q.id;
        }
      }
    });

    if (closestQuadId !== activeQuadId) {
      setActiveQuadId(closestQuadId);
    }
  };

  const getQuadTasks = (quadId: EisenhowerQuadrant) => {
    const raw = tasks.filter(t => {
      const taskQuad = t.quadrant || 'urgent_important';
      const isMatch =
        taskQuad === quadId ||
        (quadId === 'not_urgent_not_important' && (taskQuad === 'neither' || !taskQuad));
      if (!isMatch) return false;
      return matchesFilterTab(t);
    });

    const sort = columnSorts[quadId] || 'manual';

    const sorted = [...raw].sort((a, b) => {
      // Always place uncompleted tasks above completed tasks like TickTick
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (sort === 'starred') {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      }
      if (sort === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sort === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sort === 'priority') {
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      }

      const weightA = getTaskWeight(a);
      const weightB = getTaskWeight(b);

      if (weightA !== weightB) {
        if (weightA === 0) return 1;
        if (weightB === 0) return -1;
        return weightB - weightA;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return sorted;
  };

  const getNextQuad = (currentQuad: EisenhowerQuadrant): EisenhowerQuadrant | null => {
    const idx = QUADRANTS.findIndex(q => q.id === currentQuad);
    if (idx >= 0 && idx < QUADRANTS.length - 1) {
      return QUADRANTS[idx + 1].id;
    }
    return null;
  };

  const getPrevQuad = (currentQuad: EisenhowerQuadrant): EisenhowerQuadrant | null => {
    const idx = QUADRANTS.findIndex(q => q.id === currentQuad);
    if (idx > 0) {
      return QUADRANTS[idx - 1].id;
    }
    return null;
  };

  const totalFilteredTasks = QUADRANTS.reduce((sum, q) => sum + getQuadTasks(q.id).length, 0);

  return (
    <div
      data-no-drawer-swipe="true"
      className="flex flex-col flex-1 min-h-0 h-full w-full select-none relative space-y-1 overflow-hidden"
    >
      {/* Top Header: Ultra-compact, single-line (Layout Switch + Tasks Count + New Task) */}
      <div className="flex items-center justify-between gap-1.5 px-1 py-0.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
            Eisenhower Matrix
          </span>
          <span className="text-xs font-mono font-semibold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
            · {totalFilteredTasks}
          </span>

          {/* Tiny Dropdown Filter Button for today, upcoming, etc. */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsTimeDropdownOpen(prev => !prev)}
              className={`h-5.5 sm:h-6 inline-flex items-center gap-1 px-1.5 sm:px-2 rounded-md text-[10.5px] sm:text-[11px] font-semibold border transition cursor-pointer shadow-2xs select-none ${
                activeFilter === 'today'
                  ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600/50 hover:bg-amber-500/20'
                  : activeFilter === 'upcoming'
                  ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/50 hover:bg-blue-500/20'
                  : activeFilter === 'date'
                  ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-600/50 hover:bg-rose-500/20'
                  : activeFilter === 'completed'
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600/50 hover:bg-emerald-500/20'
                  : activeFilter === 'archived'
                  ? 'bg-slate-700/10 dark:bg-zinc-200/15 text-slate-800 dark:text-zinc-200 border-slate-400/50 dark:border-zinc-600 hover:bg-slate-700/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
              title="Filter matrix by timeframe (Today, Upcoming, Date, All, Done, Archived)"
            >
              {activeFilter === 'today' && <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
              {activeFilter === 'overdue' && <OverdueIcon className="w-2.5 h-2.5 text-rose-500 shrink-0" />}
              {activeFilter === 'upcoming' && <CalendarDays className="w-2.5 h-2.5 text-blue-500 shrink-0" />}
              {activeFilter === 'date' && <Calendar className="w-2.5 h-2.5 text-rose-500 shrink-0" />}
              {activeFilter === 'all' && <Sparkles className="w-2.5 h-2.5 text-indigo-500 shrink-0" />}
              {activeFilter === 'completed' && <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
              {activeFilter === 'archived' && <Archive className="w-2.5 h-2.5 text-slate-500 dark:text-zinc-300 shrink-0" />}

              <span>
                {activeFilter === 'today'
                  ? 'Today'
                  : activeFilter === 'overdue'
                  ? 'Overdue'
                  : activeFilter === 'upcoming'
                  ? 'Upcoming'
                  : activeFilter === 'date'
                  ? (selectedTaskDate ? selectedTaskDate.slice(5) : 'Date')
                  : activeFilter === 'completed'
                  ? 'Done'
                  : activeFilter === 'archived'
                  ? 'Archived'
                  : 'All'}
              </span>

              <ChevronDown className={`w-2.5 h-2.5 text-slate-400 dark:text-slate-500 transition-transform duration-150 ${isTimeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isTimeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsTimeDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Timeframe Filter
                  </div>

                  {/* Today */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('today');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'today'
                        ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-50/60 dark:bg-amber-950/30'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      Today
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {todayCount !== undefined ? todayCount : tasks.filter(t => !t.archived && t.status !== 'archived' && !t.completed && (!t.dueDate || t.dueDate === todayStr)).length}
                    </span>
                  </button>

                  {/* Overdue */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('overdue');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'overdue'
                        ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-50/60 dark:bg-rose-950/30'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      Overdue
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 font-semibold">
                      {overdueCount !== undefined ? overdueCount : tasks.filter(t => !t.archived && t.status !== 'archived' && !t.completed && Boolean(t.dueDate) && t.dueDate < todayStr).length}
                    </span>
                  </button>

                  {/* Upcoming */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('upcoming');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'upcoming'
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/60 dark:bg-blue-950/30'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      Upcoming
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {upcomingCount !== undefined ? upcomingCount : tasks.filter(t => !t.archived && t.status !== 'archived' && !t.completed && t.dueDate > todayStr).length}
                    </span>
                  </button>

                  {/* By Date */}
                  <div className="px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectFilter('date');
                        setIsTimeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between mb-1.5 transition cursor-pointer ${
                        activeFilter === 'date'
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        By Date
                      </span>
                      <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                        {dateCount !== undefined ? dateCount : tasks.filter(t => !t.archived && t.status !== 'archived' && !t.completed && t.dueDate === (selectedTaskDate || todayStr)).length}
                      </span>
                    </button>
                    <input
                      type="date"
                      value={selectedTaskDate || todayStr}
                      onChange={(e) => {
                        if (onSelectTaskDate) onSelectTaskDate(e.target.value);
                        handleSelectFilter('date');
                      }}
                      className="w-full text-[11px] px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-rose-500 outline-none"
                    />
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700/60 my-0.5" />

                  {/* All Tasks */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('all');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'all'
                        ? 'text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-slate-700/50'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      All Tasks
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {allCount !== undefined ? allCount : tasks.filter(t => !t.archived && t.status !== 'archived' && !t.completed).length}
                    </span>
                  </button>

                  {/* Completed / Done */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('completed');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/60 dark:bg-emerald-950/30'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Done
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {completedCount !== undefined ? completedCount : tasks.filter(t => !t.archived && t.status !== 'archived' && t.completed).length}
                    </span>
                  </button>

                  {/* Archived */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFilter('archived');
                      setIsTimeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer ${
                      activeFilter === 'archived'
                        ? 'text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-slate-700/60'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                      Archived
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {archivedCount !== undefined ? archivedCount : tasks.filter(t => Boolean(t.archived || t.status === 'archived')).length}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Layout Mode Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setLayoutMode('grid2x2')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                layoutMode === 'grid2x2'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="2x2 Grid (1 Frame)"
            >
              <Grid2X2 className="w-3 h-3" />
              <span className="hidden sm:inline">2x2 Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('columns')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                layoutMode === 'columns'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="4 Columns Board"
            >
              <Columns4 className="w-3 h-3" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Quadrants Container: TickTick 2x2 Grid, Focused Single Quadrant, or 4 Columns */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        data-no-drawer-swipe="true"
        className={
          focusedQuadId
            ? 'flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden'
            : layoutMode === 'grid2x2'
            ? 'flex-1 min-h-0 grid grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2.5 w-full h-full overflow-hidden'
            : 'flex-1 min-h-0 flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-proximity pb-1 pt-0.5 px-1 custom-scrollbar items-stretch w-full h-full [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]'
        }
      >
        {QUADRANTS.filter(q => !focusedQuadId || q.id === focusedQuadId).map(quad => {
          const quadTasks = getQuadTasks(quad.id);
          const isDropTarget = dndProps.dragOverQuadrantId === quad.id;
          const currentSort = columnSorts[quad.id] || 'manual';
          const isFocused = focusedQuadId === quad.id;

          return (
            <div
              key={quad.id}
              {...dndProps.getQuadrantDropProps(quad.id)}
              ref={el => {
                columnRefs.current[quad.id] = el;
              }}
              className={`${
                isFocused
                  ? 'w-full max-w-[92%] sm:max-w-md md:max-w-lg mx-auto h-full min-w-0 min-h-0'
                  : layoutMode === 'grid2x2'
                  ? 'w-full h-full min-w-0 min-h-0'
                  : 'w-[68vw] sm:w-[240px] md:w-[265px] lg:w-[290px] shrink-0 snap-start h-full min-h-0'
              } rounded-[14px] border transition-colors flex flex-col overflow-hidden shadow-2xs ${
                isDropTarget
                  ? quad.activeDropClass
                  : 'border-slate-200/80 dark:border-zinc-800/85 bg-white dark:bg-[#18181b]'
              }`}
            >
              {/* Standardized Header: 🚨 DO [count] (Urg & Imp) — Kept intact */}
              <div
                className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100/80 dark:border-zinc-800/70 select-none shrink-0 z-10"
                style={{ backgroundColor: `${quad.color}12` }}
              >
                <div
                  onClick={() => setFocusedQuadId(isFocused ? null : quad.id)}
                  className="flex items-center gap-1 min-w-0 truncate cursor-pointer"
                  title={isFocused ? 'Tap to return to 2x2 Grid' : `Tap to expand ${quad.title}`}
                >
                  <span className="text-xs sm:text-sm leading-none shrink-0">{quad.emoji}</span>
                  <span className={`font-black text-[11px] sm:text-xs tracking-tight ${quad.headingColor}`}>
                    {quad.title}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 shrink-0">
                    [{quadTasks.length}]
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate hidden xs:inline">
                    {quad.tag}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 relative">
                  {/* Expand / Focus Quadrant Toggle */}
                  <button
                    type="button"
                    onClick={() => setFocusedQuadId(isFocused ? null : quad.id)}
                    className={`p-1 rounded-md transition cursor-pointer ${
                      isFocused
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                    title={isFocused ? 'Restore 2x2 Matrix' : `Focus ${quad.title} Quadrant`}
                  >
                    {isFocused ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </button>

                  {/* Sort Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSortMenuQuad(activeSortMenuQuad === quad.id ? null : quad.id)
                      }
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Sort tasks"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>

                    {activeSortMenuQuad === quad.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setActiveSortMenuQuad(null)}
                        />
                        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-40 py-1 text-xs">
                          <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Sort By
                          </span>
                          {(
                            [
                              { key: 'manual', label: 'Default / Manual' },
                              { key: 'dueDate', label: 'Due Date' },
                              { key: 'starred', label: 'Starred First' },
                              { key: 'priority', label: 'Priority' },
                              { key: 'title', label: 'Title (A-Z)' },
                            ] as const
                          ).map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                setColumnSorts(prev => ({ ...prev, [quad.id]: opt.key }));
                                setActiveSortMenuQuad(null);
                              }}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                                currentSort === opt.key
                                  ? 'font-bold text-indigo-600 dark:text-indigo-400'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {currentSort === opt.key && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Add Task directly to this quadrant */}
                  <button
                    type="button"
                    onClick={() => onAddTask(quad.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                    title={`Add task to ${quad.title}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* TickTick SS2 Quadrant Body: Borderless Rows, 2-Line Readable Task Titles, Sub-Line Date/Time */}
              <div
                {...dndProps.getQuadrantDropProps(quad.id)}
                className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2.5 pt-1.5 pb-2 space-y-2 min-w-0 ${
                  layoutMode === 'columns' && !isFocused
                    ? '[touch-action:pan-x_pan-y]'
                    : 'touch-pan-y'
                }`}
              >
                {quadTasks.length === 0 ? (
                  <div
                    onClick={() => onAddTask(quad.id)}
                    className="h-full flex flex-col items-center justify-center text-center p-2 text-slate-300 dark:text-zinc-600 cursor-pointer hover:text-slate-400 dark:hover:text-zinc-500 transition-colors"
                    title={`Tap to add task to ${quad.title}`}
                  >
                    <span className="text-[12px] font-normal tracking-tight">No tasks</span>
                  </div>
                ) : (
                  quadTasks.map(task => {
                    const isBeingDragged = dndProps.draggedTaskId === task.id;
                    const isDropTargetItem = dndProps.dragOverTaskId === task.id;
                    const nextQ = getNextQuad(quad.id);
                    const prevQ = getPrevQuad(quad.id);
                    const dateInfo = formatTickTickMatrixDate(task, todayStr);
                    const taskSubtasks = (Array.isArray(task.subtasks) && task.subtasks.length > 0)
                      ? task.subtasks
                      : (Array.isArray(task.checklist) && task.checklist.length > 0)
                      ? task.checklist
                      : [];
                    const hasSubtasks = taskSubtasks.length > 0;
                    const completedSubs = taskSubtasks.filter(s => s.completed).length;
                    const allSubsDone = hasSubtasks && completedSubs === taskSubtasks.length;
                    const hasAlarmSet = Boolean(
                      task.dueTime ||
                        (task.alerts && task.alerts.length > 0) ||
                        (task.reminderType && task.reminderType !== 'none') ||
                        (task.dateSchedules &&
                          task.dateSchedules.some(ds => ds.dueTime || (ds.alerts && ds.alerts.length > 0)))
                    );
                    const hasRepeatSet = Boolean(
                      (task.recurring && task.recurring !== 'none') ||
                        (task.repeatType && task.repeatType !== 'none')
                    );
                    const hasBottomMetaLine = Boolean(dateInfo || hasAlarmSet || hasRepeatSet || hasSubtasks);

                    const isCompleting = completingIds.has(task.id);
                    const isFading = fadingIds.has(task.id);
                    const isVisuallyDone = task.completed || isCompleting;

                    return (
                      <div
                        key={task.id}
                        {...dndProps.getTaskItemProps(task.id, task.title)}
                        onClick={() => {
                          if (dndProps.wasDraggingRef.current) return;
                          onOpenDetailTask(task);
                        }}
                        className={`group relative flex items-center gap-2.5 py-1 rounded-md hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer select-none ${
                          isFading ? 'opacity-0 translate-x-4 pointer-events-none' : ''
                        } ${
                          isBeingDragged ? 'opacity-40 scale-[0.98]' : ''
                        } ${
                          isCompleting
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/25'
                            : task.completed
                            ? 'opacity-55'
                            : ''
                        } ${
                          isDropTargetItem
                            ? dndProps.dropPosition === 'before'
                              ? 'border-t-2 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                              : 'border-b-2 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                            : ''
                        }`}
                      >
                        {/* Generous 44px tap target centered on thumb-friendly Quadrant Checkbox */}
                        <div
                          className={`relative flex items-center justify-center shrink-0 ${
                            layoutMode === 'grid2x2' && !isFocused ? 'w-[22px] h-[22px]' : 'w-[25px] h-[25px]'
                          }`}
                        >
                          {celebratingId === task.id && (
                            <CheckmarkCelebration
                              activeKey={celebrationKey}
                              badgeText="Done✅"
                              ringColor="border-emerald-500"
                              align="left"
                            />
                          )}
                          <button
                            type="button"
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWithAnim(task);
                            }}
                            className="absolute -inset-2.5 flex items-center justify-center rounded-full cursor-pointer touch-manipulation z-10 hover:bg-slate-100/70 dark:hover:bg-zinc-800/60 active:scale-90 transition"
                            title={isVisuallyDone ? 'Completed' : 'Mark complete'}
                            aria-label={isVisuallyDone ? 'Mark incomplete' : 'Mark complete'}
                          >
                            <span
                              className={`${
                                layoutMode === 'grid2x2' && !isFocused ? 'w-[22px] h-[22px] rounded-[6px]' : 'w-[25px] h-[25px] rounded-[7px]'
                              } flex items-center justify-center shrink-0 transition-all ${
                                isVisuallyDone
                                  ? `${quad.badgeBg} border-[2px] ${quad.borderColor} text-white scale-105`
                                  : `${quad.borderColor} border-[2px] bg-transparent`
                              }`}
                            >
                              {isVisuallyDone && (
                                <AnimatedCheckIcon
                                  className="w-3.5 h-3.5 text-white"
                                  strokeWidth={3}
                                  animate={isCompleting}
                                />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Line 1: Clean Task Title | Line 2: Separate Bottom Line for Date/Time, Symbols & Subtask Counter (1/3) */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] leading-[18px] font-sans font-normal break-words antialiased transition-colors ${
                              isFocused ? '' : 'line-clamp-2'
                            } ${
                              isVisuallyDone
                                ? 'line-through text-slate-400 dark:text-zinc-500'
                                : 'text-slate-800 dark:text-zinc-100'
                            }`}
                          >
                            <span>{task.title}</span>
                          </p>

                          {hasBottomMetaLine && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-[15px] font-sans">
                              {dateInfo && (
                                <span
                                  className={`truncate leading-[15px] ${
                                    task.completed
                                      ? 'text-slate-400 dark:text-slate-500'
                                      : dateInfo.status === 'overdue'
                                      ? 'text-rose-500 dark:text-rose-400 font-medium'
                                      : dateInfo.status === 'today'
                                      ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                      : 'text-slate-500 dark:text-slate-400 font-normal'
                                  }`}
                                >
                                  {dateInfo.label}
                                </span>
                              )}

                              {(hasAlarmSet || hasRepeatSet) && (
                                <span
                                  className={`inline-flex items-center gap-1 h-[15px] shrink-0 ${
                                    task.completed
                                      ? 'text-slate-400 dark:text-slate-500'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {hasAlarmSet && (
                                    <Bell
                                      className={`w-[12px] h-[12px] stroke-[2.2] shrink-0 ${
                                        !task.completed && dateInfo?.status === 'overdue'
                                          ? 'text-rose-500 dark:text-rose-400'
                                          : ''
                                      }`}
                                    />
                                  )}
                                  {hasRepeatSet && (
                                    <Repeat className="w-[12px] h-[12px] stroke-[2.2] shrink-0" />
                                  )}
                                </span>
                              )}

                              {hasSubtasks && (
                                <span
                                  className={`inline-flex items-center gap-1 h-[15px] leading-[15px] shrink-0 ${
                                    task.completed
                                      ? 'text-slate-400 dark:text-slate-500'
                                      : allSubsDone
                                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  <SubtaskBranchIcon className="w-[12.5px] h-[12.5px] shrink-0" />
                                  <span className="tabular-nums leading-[15px]">{completedSubs}/{taskSubtasks.length}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Side: Locked to 18px first-line height */}
                        <div className="flex items-center gap-0.5 shrink-0 h-[18px]">
                          {hasSubtasks && (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          )}

                          {(prevQ || nextQ) && (
                            <div className="hidden sm:group-hover:flex items-center gap-0.5 shrink-0">
                              {prevQ && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateTaskQuadrant(task.id, prevQ);
                                  }}
                                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
                                  title={`Move to ${prevQ}`}
                                >
                                  <ChevronLeft className="w-2.5 h-2.5" />
                                </button>
                              )}
                              {nextQ && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateTaskQuadrant(task.id, nextQ);
                                  }}
                                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
                                  title={`Move to ${nextQ}`}
                                >
                                  <ChevronRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Pagination Indicator Dots (When in horizontal columns mode) */}
      {layoutMode === 'columns' && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 pt-0.5 shrink-0">
          {QUADRANTS.map(quad => (
            <button
              key={quad.id}
              type="button"
              onClick={() => scrollToQuad(quad.id)}
              className={`transition-all rounded-full ${
                activeQuadId === quad.id
                  ? 'w-4 h-1.5 bg-blue-600 dark:bg-blue-400'
                  : 'w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
              }`}
              title={`Jump to ${quad.title}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};


