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
} from 'lucide-react';
import { OverdueIcon } from '../common/OverdueIcon';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { TaskItem, EisenhowerQuadrant, Priority } from '../../types';
import { getTaskWeight, getSingleTaskDateReminder } from '../../utils/taskSorter';
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
  filter?: 'all' | 'today' | 'upcoming' | 'completed' | 'date';
  onFilterChange?: (filter: 'all' | 'today' | 'upcoming' | 'completed' | 'date') => void;
  selectedTaskDate?: string;
  onSelectTaskDate?: (date: string) => void;
  todayCount?: number;
  upcomingCount?: number;
  allCount?: number;
  dateCount?: number;
  completedCount?: number;
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
    color: '#10b981',
    headingColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500',
    badgeBg: 'bg-emerald-500',
    activeDropClass: 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/40',
  },
];

const priorityOrder: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

const formatMatrixDueDate = (dateStr?: string, timeStr?: string) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[m - 1] || '';
    if (timeStr) {
      return `${d} ${month}, ${timeStr}`;
    }
    return `${d} ${month}`;
  } catch {
    return dateStr;
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
  upcomingCount,
  allCount,
  dateCount,
  completedCount,
}) => {
  const [activeQuadId, setActiveQuadId] = useState<EisenhowerQuadrant>('urgent_important');
  const [columnSorts, setColumnSorts] = useState<Record<string, SortMode>>({});
  const [activeSortMenuQuad, setActiveSortMenuQuad] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid2x2');
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [localFilter, setLocalFilter] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'date'>('today');

  const activeFilter = filter ?? localFilter;

  const handleSelectFilter = (f: 'all' | 'today' | 'upcoming' | 'completed' | 'date') => {
    if (onFilterChange) {
      onFilterChange(f);
    }
    setLocalFilter(f);
  };

  const carouselRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayStr = new Date().toISOString().split('T')[0];

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

      // Weight sorting: Largest weight first (descending), unweighted tasks last
      const weightA = getTaskWeight(a);
      const weightB = getTaskWeight(b);

      if (weightA !== weightB) {
        if (weightA === 0) return 1;
        if (weightB === 0) return -1;
        return weightB - weightA;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    // Collect all assigned weights
    const usedWeights = new Set<number>();
    sorted.forEach(t => {
      const w = getTaskWeight(t);
      if (w > 0) {
        usedWeights.add(w);
      }
    });

    let nextAvailable = 1;

    return sorted.map((task) => {
      const existingWeight = getTaskWeight(task);
      let effectiveWeight = existingWeight > 0 ? existingWeight : 0;
      if (effectiveWeight <= 0) {
        while (usedWeights.has(nextAvailable)) {
          nextAvailable++;
        }
        effectiveWeight = nextAvailable;
        usedWeights.add(effectiveWeight);
        nextAvailable++;
      }
      return {
        ...task,
        _effectiveRank: effectiveWeight,
      };
    });
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
    <div className="flex flex-col flex-1 min-h-0 w-full select-none relative space-y-1 h-full overflow-hidden">
      {/* Top Header: Ultra-compact, single-line (Layout Switch + Tasks Count + New Task) */}
      <div className="flex items-center justify-between gap-1.5 px-1 py-0.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
            Eisenhower Matrix
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
            {totalFilteredTasks}
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
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
              title="Filter matrix by timeframe (Today, Upcoming, Date, All, Archive)"
            >
              {activeFilter === 'today' && <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
              {activeFilter === 'upcoming' && <CalendarDays className="w-2.5 h-2.5 text-blue-500 shrink-0" />}
              {activeFilter === 'date' && <Calendar className="w-2.5 h-2.5 text-rose-500 shrink-0" />}
              {activeFilter === 'all' && <Sparkles className="w-2.5 h-2.5 text-indigo-500 shrink-0" />}
              {activeFilter === 'completed' && <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}

              <span>
                {activeFilter === 'today'
                  ? 'Today'
                  : activeFilter === 'upcoming'
                  ? 'Upcoming'
                  : activeFilter === 'date'
                  ? (selectedTaskDate ? selectedTaskDate.slice(5) : 'Date')
                  : activeFilter === 'completed'
                  ? 'Archive'
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
                      {todayCount !== undefined ? todayCount : tasks.filter(t => !t.completed && (!t.dueDate || t.dueDate <= todayStr)).length}
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
                      {upcomingCount !== undefined ? upcomingCount : tasks.filter(t => !t.completed && t.dueDate > todayStr).length}
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
                        {dateCount !== undefined ? dateCount : tasks.filter(t => !t.completed && t.dueDate === (selectedTaskDate || todayStr)).length}
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
                      {allCount !== undefined ? allCount : tasks.filter(t => !t.completed).length}
                    </span>
                  </button>

                  {/* Archive / Completed */}
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
                      Archive / Done
                    </span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                      {completedCount !== undefined ? completedCount : tasks.filter(t => t.completed).length}
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

          <button
            type="button"
            onClick={() => onAddTask(activeQuadId)}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Quadrants Container: Exactly 1 Frame on Mobile Viewport */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className={
          layoutMode === 'grid2x2'
            ? 'flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-1 sm:gap-2 w-full h-full overflow-hidden'
            : 'flex-1 min-h-0 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 pt-0.5 px-0.5 scroll-smooth custom-scrollbar items-stretch w-full h-full'
        }
      >
        {QUADRANTS.map(quad => {
          const quadTasks = getQuadTasks(quad.id);
          const isDropTarget = dndProps.dragOverQuadrantId === quad.id;
          const currentSort = columnSorts[quad.id] || 'manual';

          return (
            <div
              key={quad.id}
              {...dndProps.getQuadrantDropProps(quad.id)}
              ref={el => {
                columnRefs.current[quad.id] = el;
              }}
              className={`${
                layoutMode === 'grid2x2'
                  ? 'w-full h-full min-w-0'
                  : 'w-[85vw] sm:w-[285px] md:w-[315px] lg:w-[345px] shrink-0 snap-center h-full'
              } rounded-lg sm:rounded-xl border transition-all flex flex-col overflow-hidden shadow-2xs ${
                isDropTarget
                  ? quad.activeDropClass
                  : 'border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#18181b]'
              }`}
            >
              {/* Standardized Header: 🚨 DO [count] (Urg & Imp) */}
              <div 
                className="flex items-center justify-between px-1.5 sm:px-2 py-0.5 sm:py-1 border-b border-slate-200/70 dark:border-slate-800/70 select-none shrink-0"
                style={{ backgroundColor: `${quad.color}15` }}
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="text-xs sm:text-sm leading-none shrink-0">{quad.emoji}</span>
                  <span className={`font-black text-[11px] sm:text-xs tracking-tight ${quad.headingColor}`}>
                    {quad.title}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 shrink-0">
                    [{quadTasks.length}]
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {quad.tag}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 relative">
                  {/* Sort Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSortMenuQuad(activeSortMenuQuad === quad.id ? null : quad.id)
                      }
                      className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
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
                    className="p-0.5 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                    title={`Add task to ${quad.title}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks List inside Quadrant Socket: High Density, Seamless Fit */}
              <div 
                {...dndProps.getQuadrantDropProps(quad.id)}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1 space-y-0.5 min-w-0"
              >
                {quadTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-2 text-slate-400 dark:text-slate-500">
                    <span className="text-[11px] font-medium">No tasks</span>
                    <button
                      type="button"
                      onClick={() => onAddTask(quad.id)}
                      className="mt-0.5 text-[10px] font-semibold text-blue-500 hover:underline cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                ) : (
                  quadTasks.map(task => {
                    const isBeingDragged = dndProps.draggedTaskId === task.id;
                    const isDropTargetItem = dndProps.dragOverTaskId === task.id;
                    const nextQ = getNextQuad(quad.id);
                    const prevQ = getPrevQuad(quad.id);

                    return (
                      <div
                        key={task.id}
                        {...dndProps.getTaskItemProps(task.id, task.title)}
                        onClick={() => {
                          if (dndProps.wasDraggingRef.current) return;
                          onOpenDetailTask(task);
                        }}
                        className={`group relative pl-1 pr-1.5 py-1 sm:p-1.5 rounded-lg transition cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 select-none flow-root ${
                          isBeingDragged ? 'opacity-40 scale-[0.98]' : ''
                        } ${
                          isDropTargetItem
                            ? dndProps.dropPosition === 'before'
                              ? 'border-t-2 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                              : 'border-b-2 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                            : ''
                        }`}
                      >
                        {/* Floated Left: Checkbox */}
                        <div className="float-left mr-1.5 mt-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task.id);
                            }}
                            className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              task.completed
                                ? `${quad.badgeBg} border-[3px] ${quad.borderColor} text-white shadow-2xs`
                                : `${quad.borderColor} border-[3px] bg-white dark:bg-slate-900 hover:scale-105`
                            }`}
                            title={task.completed ? 'Completed' : 'Click to complete'}
                          >
                            {task.completed && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </button>
                        </div>

                        {/* Quick Quadrant Shift Buttons (Visible on hover/touch) Floated Right */}
                        {(prevQ || nextQ) && (
                          <div className="float-right ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                            {prevQ && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTaskQuadrant(task.id, prevQ);
                                }}
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
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
                                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                                title={`Move to ${nextQ}`}
                              >
                                <ChevronRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Title & subtle due date underneath wrapping around checkbox */}
                        <p
                          className={`text-[12.8px] sm:text-[13.8px] font-semibold leading-snug break-words antialiased ${
                            task.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <span className={`font-mono font-bold text-[14px] sm:text-[15px] mr-1.5 shrink-0 ${quad.headingColor}`}>
                            {(task as any)._effectiveRank}
                          </span>
                          {task.title}
                        </p>

                        <div className="flex items-center justify-between gap-1 mt-1 flex-wrap">
                          {(() => {
                            const dr = getSingleTaskDateReminder(task);
                            if (!dr) return null;
                            return (
                              <span
                                className={`h-5 px-1.5 inline-flex items-center gap-1 rounded text-[10px] font-mono font-medium border shrink-0 transition ${
                                  dr.isOverdue
                                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                                title={`Due: ${dr.display}`}
                              >
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{dr.display}</span>
                                {dr.isOverdue && <OverdueIcon className="w-3 h-3 shrink-0 ml-0.5" />}
                              </span>
                            );
                          })()}
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
