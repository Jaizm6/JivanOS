import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import {
  CheckSquare,
  Plus,
  Play,
  Check,
  Calendar,
  Flag,
  Trash2,
  ListTodo,
  Tag,
  Clock,
  RotateCw,
  Repeat,
  RefreshCw,
  RotateCcw,
  Pause,
  Timer,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Columns3,
  Grid2X2,
  List,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Equal,
  Flame,
  Sparkles,
  BarChart3,
  Edit2,
  Sliders,
  Target,
  Star,
  Bell,
  MapPin,
  Folder,
  FolderPlus,
  Layers,
  Sparkle,
  MoreHorizontal,
  LayoutList,
  AlignJustify,
  Search,
  Download,
  Upload,
  Database,
  FileText,
  MessageSquare,
  Pencil,
  Workflow,
  CloudOff,
  Archive,
  ArchiveRestore,
  Sun,
  CalendarDays,
  CalendarClock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { Priority, TaskItem, TaskStatus, EisenhowerQuadrant, DEFAULT_TASK_CATEGORIES, TaskCategory, ScheduleItem } from '../../types';
import { compareTasksByDoPlanPassSkip, sortTasksByDoPlanPassSkip, getQuadrantLabel } from '../../utils/taskSorter';
import { SmoothCollapse, getPetalPosition } from '../common/PetalExpressive';
import {
  InteractiveTagButton,
  InlineTagMeta,
  cleanTagName,
  formatTagLabel,
  hasTagCaseInsensitive,
} from '../common/TagVisuals';
import { OverdueIcon } from '../common/OverdueIcon';
import { useTaskDragAndDrop, TouchDragGhost } from '../../hooks/useTaskDragAndDrop';
import { formatOSDate, formatLocalDate } from '../../utils/date';
import { getEisenhowerMeta } from '../../utils/eisenhower';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';
import { getTaskFromFirestore } from '../../utils/TaskSyncDiagnostics';
import { isScheduleItemOnDate } from '../../utils/scheduleRecurrence';
import { motion, AnimatePresence } from 'framer-motion';

import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';

const TaskReportSection = lazyWithRetry(() => import('./TaskReportSection').then(m => ({ default: m.TaskReportSection })));
const TaskFormModal = lazyWithRetry(() => import('./TaskFormModal').then(m => ({ default: m.TaskFormModal })));
const PlannerPage = lazyWithRetry(() => import('../planner/PlannerPage').then(m => ({ default: m.PlannerPage })));
const ActivityManager = lazyWithRetry(() => import('../common/ActivityManager').then(m => ({ default: m.ActivityManager })));
const TaskDetailModal = lazyWithRetry(() => import('./TaskDetailModal').then(m => ({ default: m.TaskDetailModal })));
const EisenhowerGoogleBoard = lazyWithRetry(() => import('./EisenhowerGoogleBoard').then(m => ({ default: m.EisenhowerGoogleBoard })));
const QuickAddBatchModal = lazyWithRetry(() => import('./QuickAddBatchModal').then(m => ({ default: m.QuickAddBatchModal })));
const TaskExportImportModal = lazyWithRetry(() => import('./TaskExportImportModal').then(m => ({ default: m.TaskExportImportModal })));
const TaskConflictModal = lazyWithRetry(() => import('./TaskConflictModal').then(m => ({ default: m.TaskConflictModal })));
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import {
  getFontInlineStyle,
  getFontSizeClass,
  getFontTypeClass,
  isWhiteColor,
  isBlackColor,
  getSafeFontColor,
} from '../../utils/activityStyles';
import { PriorityIcon } from '../common/PriorityIcon';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import { haptics } from '../../utils/haptics';

export const EisenhowerIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Eisenhower Matrix"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" strokeWidth="2" />
    <line x1="12" y1="3" x2="12" y2="21" strokeWidth="1.75" />
    <line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.75" />
    <rect x="4.5" y="4.5" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.4" />
    <circle cx="16.5" cy="7.5" r="1.2" fill="currentColor" fillOpacity="0.7" />
    <circle cx="7.5" cy="16.5" r="1.2" fill="currentColor" fillOpacity="0.7" />
    <circle cx="16.5" cy="16.5" r="1.2" fill="currentColor" fillOpacity="0.3" />
  </svg>
);

export const WalkingTaskTitle: React.FC<{
  title: string;
  isVisuallyDone: boolean;
  fontInlineStyle?: React.CSSProperties;
  fontSizeClass?: string;
  fontTypeClass?: string;
  fontColor?: string;
  isTaskRunningInPiP?: boolean;
}> = React.memo(({
  title,
  isVisuallyDone,
  fontInlineStyle,
  fontSizeClass = 'text-[13.8px] sm:text-[14.8px]',
  fontTypeClass = '',
  fontColor,
  isTaskRunningInPiP,
}) => {
  return (
    <div
      className="flex-1 min-w-0 overflow-hidden relative select-none group antialiased"
      title={title}
    >
      <div className="flex items-center min-w-0">
        <span
          className={`${fontSizeClass} ${fontTypeClass} font-semibold truncate transition-colors antialiased ${
            isVisuallyDone
              ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
              : fontColor ? '' : 'text-slate-900 dark:text-white'
          }`}
          style={fontInlineStyle}
        >
          {title}
        </span>
        {isTaskRunningInPiP && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
            PiP Active
          </span>
        )}
      </div>
    </div>
  );
});

export const TaskManager: React.FC<{ initialViewMode?: 'list' | 'events' | 'kanban' | 'matrix' | 'reports' }> = ({
  initialViewMode = 'list',
}) => {
  const {
    tasks,
    setTasks,
    listGroups,
    todoLists,
    selectedListId,
    setSelectedListId,
    addTask,
    batchAddTasks,
    updateTask,
    deleteTask,
    toggleTask,
    toggleStarTask,
    toggleSubtask,
    setTaskStatus,
    setTaskQuadrant,
    scheduleItems,
    toggleScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    selectedDate,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    completePomodoroSession,
    incrementTaskPomodoro,
    decrementTaskPomodoro,
    pomodoro,
    stopPomodoro,
    projects,
    goals,
    addProject,
    tags,
    taskTimers,
    workflowStages,
    setActiveTab,
    soundEngine,
    openEntitiesModal,
    pushNotification,
    isOnline,
    offlinePendingQueue,
    retryOfflineQueue,
    theme,
  } = useApp();
  const isDarkMode = theme === 'dark';
  const { session, sessions } = useActiveSession();

  const [viewMode, setViewMode] = useState<'list' | 'events' | 'kanban' | 'matrix' | 'reports'>(initialViewMode);
  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [taskCelebrationKey, setTaskCelebrationKey] = useState<number>(0);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set());
  const [completingScheduleIds, setCompletingScheduleIds] = useState<Set<string>>(new Set());
  const [fadingScheduleIds, setFadingScheduleIds] = useState<Set<string>>(new Set());
  const activeAnimTimeoutsRef = useRef<Record<string, NodeJS.Timeout[]>>({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(activeAnimTimeoutsRef.current).forEach((timeouts: NodeJS.Timeout[]) => {
        timeouts.forEach(t => clearTimeout(t));
      });
    };
  }, []);

  const handleToggleTaskWithAnim = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const wasCompleted = task.completed || task.status === 'done';

    // If unchecking an already completed task
    if (wasCompleted) {
      if (activeAnimTimeoutsRef.current[taskId]) {
        activeAnimTimeoutsRef.current[taskId].forEach(t => clearTimeout(t));
        delete activeAnimTimeoutsRef.current[taskId];
      }
      setCompletingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setFadingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setAnimatingTaskId(prev => (prev === taskId ? null : prev));
      setCelebratingTaskId(prev => (prev === taskId ? null : prev));
      toggleTask(taskId);
      haptics.toggle();
      return;
    }

    // Prevent double-trigger while animation is already running
    if (completingTaskIds.has(taskId)) return;

    // Clear any previous timers for this task
    if (activeAnimTimeoutsRef.current[taskId]) {
      activeAnimTimeoutsRef.current[taskId].forEach(t => clearTimeout(t));
      delete activeAnimTimeoutsRef.current[taskId];
    }

    try {
      soundEngine.playWaterDripNotification();
      haptics.complete();
    } catch {}

    // Step 1 (0ms): Fill circle + draw AnimatedCheckIcon + pulse ring + "Done✅" badge
    setAnimatingTaskId(taskId);
    setCelebratingTaskId(taskId);
    setTaskCelebrationKey(prev => prev + 1);
    setCompletingTaskIds(prev => new Set(prev).add(taskId));

    // Step 2 (500ms): Smoothly fade & slide task row out of active list
    const fadeTimeout = setTimeout(() => {
      setFadingTaskIds(prev => new Set(prev).add(taskId));
    }, 500);

    // Step 3 (760ms): Commit completion so task moves cleanly into Completed section
    const commitTimeout = setTimeout(() => {
      toggleTask(taskId, { skipSound: true });
      setCompletingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setFadingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setAnimatingTaskId(prev => (prev === taskId ? null : prev));
      setCelebratingTaskId(prev => (prev === taskId ? null : prev));
      delete activeAnimTimeoutsRef.current[taskId];
    }, 760);

    activeAnimTimeoutsRef.current[taskId] = [fadeTimeout, commitTimeout];
  };

  const handleToggleScheduleWithAnim = (schedId: string) => {
    const sched = scheduleItems.find(s => s.id === schedId);
    if (!sched) return;
    const key = `sched_${schedId}`;

    if (sched.completed) {
      if (activeAnimTimeoutsRef.current[key]) {
        activeAnimTimeoutsRef.current[key].forEach(t => clearTimeout(t));
        delete activeAnimTimeoutsRef.current[key];
      }
      setCompletingScheduleIds(prev => {
        const next = new Set(prev);
        next.delete(schedId);
        return next;
      });
      setFadingScheduleIds(prev => {
        const next = new Set(prev);
        next.delete(schedId);
        return next;
      });
      toggleScheduleItem(schedId);
      haptics.toggle();
      return;
    }

    if (completingScheduleIds.has(schedId)) return;

    try {
      soundEngine.playWaterDripNotification();
      haptics.complete();
    } catch {}

    setAnimatingTaskId(key);
    setCelebratingTaskId(key);
    setTaskCelebrationKey(prev => prev + 1);
    setCompletingScheduleIds(prev => new Set(prev).add(schedId));

    const fadeTimeout = setTimeout(() => {
      setFadingScheduleIds(prev => new Set(prev).add(schedId));
    }, 500);

    const commitTimeout = setTimeout(() => {
      toggleScheduleItem(schedId);
      setCompletingScheduleIds(prev => {
        const next = new Set(prev);
        next.delete(schedId);
        return next;
      });
      setFadingScheduleIds(prev => {
        const next = new Set(prev);
        next.delete(schedId);
        return next;
      });
      setAnimatingTaskId(prev => (prev === key ? null : prev));
      setCelebratingTaskId(prev => (prev === key ? null : prev));
      delete activeAnimTimeoutsRef.current[key];
    }, 760);

    activeAnimTimeoutsRef.current[key] = [fadeTimeout, commitTimeout];
  };

  const sortedStages = [...(workflowStages || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');

  const handleReorderTasks = useCallback((draggedId: string, targetTaskId: string, position: 'before' | 'after') => {
    setTasks(prev => {
      const draggedIdx = prev.findIndex(t => t.id === draggedId);
      if (draggedIdx === -1) return prev;

      const newTasks = [...prev];
      const [removed] = newTasks.splice(draggedIdx, 1);

      let targetIdx = newTasks.findIndex(t => t.id === targetTaskId);
      if (targetIdx === -1) {
        newTasks.push(removed);
      } else {
        if (position === 'after') {
          targetIdx += 1;
        }
        newTasks.splice(targetIdx, 0, removed);
      }

      return newTasks.map((t, idx) => ({ ...t, order: idx }));
    });

    setIsSmartSort(false);
    try {
      localStorage.setItem('omnilifeos_task_smart_sort', 'false');
    } catch {}
  }, []);

  const dnd = useTaskDragAndDrop({
    tasks,
    onReorderTasks: handleReorderTasks,
    onDropOnStage: (draggedId, stageId) => {
      setTaskStatus(draggedId, stageId as TaskStatus);
    },
    onDropOnQuadrant: (draggedId, quadId) => {
      setTaskQuadrant(draggedId, quadId as EisenhowerQuadrant);
    },
    onDropOnCategory: (draggedId, categoryId) => {
      const t = tasks.find(item => item.id === draggedId);
      if (t) updateTask({ ...t, category: categoryId });
    },
    onDropOnProject: (draggedId, projId) => {
      const t = tasks.find(item => item.id === draggedId);
      const p = projects.find(proj => proj.id === projId);
      if (t) {
        updateTask({
          ...t,
          projectId: projId || undefined,
          project: p?.name || 'General',
          goalId: p?.goalId || t.goalId,
        });
      }
    },
    onDropOnGoal: (draggedId, gId) => {
      const t = tasks.find(item => item.id === draggedId);
      if (t) updateTask({ ...t, goalId: gId || undefined });
    },
  });

  const {
    draggedTaskId,
    dragOverTaskId,
    dropPosition,
    dragOverStageId,
    dragOverQuadrantId,
    dragOverCategory,
    dragOverProjectId,
    dragOverGoalId,
    touchGhostPos,
    draggedTaskTitle,
    wasDraggingRef,
    getTaskItemProps,
    getGripHandleProps,
    getStageDropProps,
    getQuadrantDropProps,
    getCategoryDropProps,
    getProjectDropProps,
    getGoalDropProps,
  } = dnd;

  const moveTaskOrder = (taskId: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const newTasks = [...prev];
      const [moved] = newTasks.splice(idx, 1);
      newTasks.splice(targetIdx, 0, moved);
      return newTasks.map((t, i) => ({ ...t, order: i }));
    });
    setIsSmartSort(false);
    try {
      localStorage.setItem('omnilifeos_task_smart_sort', 'false');
    } catch {}
    soundEngine?.playClick?.();
  };

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived'>('today');
  const [isOverdueSectionOpen, setIsOverdueSectionOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('jivanos_tasks_overdue_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const toggleOverdueSection = () => {
    setIsOverdueSectionOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('jivanos_tasks_overdue_open', String(next));
      } catch {}
      return next;
    });
  };
  const [selectedTaskDate, setSelectedTaskDate] = useState<string>(formatLocalDate());
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'goal' | 'project'>('all');

  // Smart Sort state: Pin high-priority overdue, sort by priority and due date proximity
  const [isSmartSort, setIsSmartSort] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omnilifeos_task_smart_sort');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSmartSort = () => {
    const nextVal = !isSmartSort;
    setIsSmartSort(nextVal);
    try {
      localStorage.setItem('omnilifeos_task_smart_sort', String(nextVal));
    } catch {}
    if (nextVal) {
      soundEngine?.playSuccessChime?.();
      pushNotification('Smart Sort Enabled', 'Tasks are prioritized by High/Med/Low & urgency with overdue items pinned to the top.', 'task');
    } else {
      soundEngine?.playPill?.();
      pushNotification('Standard Sort', 'Tasks sorted by priority and creation date.', 'task');
    }
  };
  
  // Custom Lists Dropdown state

  // Quick Task & Batch Add Bar state
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isBatchQuickAddOpen, setIsBatchQuickAddOpen] = useState(false);
  const [quickBatchText, setQuickBatchText] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');
  const [quickListId, setQuickListId] = useState<string>('inbox');
  const [quickDueDate, setQuickDueDate] = useState<string>(formatLocalDate(new Date()));
  const [quickIsStarred, setQuickIsStarred] = useState(false);
  const [quickCategory, setQuickCategory] = useState<string>('');
  const [quickProjectId, setQuickProjectId] = useState<string>('');
  const [quickGoalId, setQuickGoalId] = useState<string>('');
  const [recentlyCreatedTaskId, setRecentlyCreatedTaskId] = useState<string | null>(null);

  // Unified Task & Event Modal (Add and Edit)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalInitialMode, setTaskModalInitialMode] = useState<'task' | 'event'>('task');
  const [universalModalType, setUniversalModalType] = useState<'event' | 'task' | 'habit' | 'goal' | 'medication' | 'bill' | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [eventToEdit, setEventToEdit] = useState<ScheduleItem | null>(null);
  const [taskModalDefaultStatus, setTaskModalDefaultStatus] = useState<string | undefined>(undefined);
  const [taskModalDefaultQuadrant, setTaskModalDefaultQuadrant] = useState<EisenhowerQuadrant | undefined>(undefined);

  // Workflow Customizer Modal
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [inlineSubtaskText, setInlineSubtaskText] = useState<Record<string, string>>({});
  const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);

  const handleAddInlineSubtask = (task: TaskItem) => {
    const raw = (inlineSubtaskText[task.id] || '').trim();
    if (!raw) return;
    const existing = Array.isArray(task.subtasks) && task.subtasks.length > 0
      ? task.subtasks
      : Array.isArray(task.checklist) && task.checklist.length > 0
      ? task.checklist
      : [];
    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: raw,
      completed: false,
    };
    const updatedSubs = [...existing, newSub];
    updateTask({
      ...task,
      subtasks: updatedSubs,
      checklist: updatedSubs,
    });
    setInlineSubtaskText(prev => ({ ...prev, [task.id]: '' }));
    soundEngine?.playClick?.();
  };

  // Task Detail Modal
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{ local: TaskItem; server: TaskItem } | null>(null);

  // Hover Peek
  const [notePeek, setNotePeek] = useState<{
    taskId: string;
    text: string;
    x: number;
    y: number;
    position: 'above' | 'below';
    arrowOffset: number;
  } | null>(null);

  const triggerNotePeek = (e: React.MouseEvent, taskId: string, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Compact screens use 280px width, larger screens use 320px
    const tooltipWidth = window.innerWidth < 640 ? 280 : 320;
    
    // Centered horizontally on the note icon
    let x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    // Keep inside screen boundaries with a 16px margin on left/right edges
    const minX = 16;
    const maxX = window.innerWidth - tooltipWidth - 16;
    if (x < minX) x = minX;
    if (x > maxX) x = maxX;
    
    // Calculate vertical position (check space above)
    // Approximate a line height calculation to check if tooltip fits above the viewport
    const approxHeight = Math.min(240, 60 + Math.ceil(text.length / 28) * 18);
    const hasSpaceAbove = rect.top > approxHeight + 20;
    
    let y = 0;
    let position: 'above' | 'below' = 'above';
    
    if (hasSpaceAbove) {
      y = rect.top - 10; // Positioned 10px above the icon
      position = 'above';
    } else {
      y = rect.bottom + 10; // Positioned 10px below the icon
      position = 'below';
    }
    
    // Align the arrow dynamically with the notes icon's center relative to the tooltip left edge
    const arrowOffset = Math.max(12, Math.min(tooltipWidth - 12, rect.left + (rect.width / 2) - x));
    
    setNotePeek({ taskId, text, x, y, position, arrowOffset });
  };

  // Global Search state (Super Productivity instant title or tag filter)
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll position preservation strategy using refs and session storage per viewMode
  const scrollPositionsRef = useRef<Record<string, number>>({
    list: 0,
    kanban: 0,
    matrix: 0,
    reports: 0,
  });
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY || document.documentElement.scrollTop;
      scrollPositionsRef.current[viewMode] = currentScroll;
      try {
        sessionStorage.setItem(`task_scroll_${viewMode}`, currentScroll.toString());
      } catch (e) {}
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  useEffect(() => {
    const oldMode = prevViewModeRef.current;
    if (oldMode !== viewMode) {
      const currentScroll = window.scrollY || document.documentElement.scrollTop;
      scrollPositionsRef.current[oldMode] = currentScroll;
      try {
        sessionStorage.setItem(`task_scroll_${oldMode}`, currentScroll.toString());
      } catch (e) {}
    }
    prevViewModeRef.current = viewMode;

    requestAnimationFrame(() => {
      let targetScroll = scrollPositionsRef.current[viewMode] || 0;
      if (!targetScroll) {
        try {
          const saved = sessionStorage.getItem(`task_scroll_${viewMode}`);
          if (saved) targetScroll = parseInt(saved, 10) || 0;
        } catch (e) {}
      }
      window.scrollTo({ top: targetScroll, behavior: 'instant' });
    });
  }, [viewMode]);

  // Bulk selection mode state
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [pendingArchiveTarget, setPendingArchiveTarget] = useState<
    null | { kind: 'single'; task: TaskItem } | { kind: 'bulk'; count: number }
  >(null);

  const handleToggleBulkSelectAll = () => {
    if (selectedBulkIds.size === filteredTasks.length) {
      setSelectedBulkIds(new Set());
    } else {
      setSelectedBulkIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleToggleBulkId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = new Set(selectedBulkIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedBulkIds(next);
  };

  const isTaskArchived = (t: TaskItem) => Boolean(t.archived || t.status === 'archived');

  const executeToggleArchiveTask = (task: TaskItem) => {
    const wasArchived = isTaskArchived(task);
    updateTask({
      ...task,
      archived: !wasArchived,
      archivedAt: !wasArchived ? new Date().toISOString() : undefined,
      status: wasArchived && task.status === 'archived' ? (task.completed ? 'done' : 'todo') : task.status,
    });
    try { soundEngine?.playClick?.(); } catch {}
    pushNotification(
      wasArchived ? 'Task Restored' : 'Task Archived',
      wasArchived
        ? `"${task.title}" moved back to your active tasks.`
        : `"${task.title}" moved to Archive.`,
      'task'
    );
  };

  const handleToggleArchiveTask = (task: TaskItem) => {
    if (isTaskArchived(task)) {
      executeToggleArchiveTask(task);
    } else {
      setPendingArchiveTarget({ kind: 'single', task });
    }
  };

  const executeBulkArchive = () => {
    const targets = tasks.filter(t => selectedBulkIds.has(t.id));
    if (targets.length === 0) return;
    const allArchived = targets.every(t => isTaskArchived(t));
    const nowIso = new Date().toISOString();
    targets.forEach(t => {
      updateTask({
        ...t,
        archived: !allArchived,
        archivedAt: !allArchived ? nowIso : undefined,
        status: allArchived && t.status === 'archived' ? (t.completed ? 'done' : 'todo') : t.status,
      });
    });
    try { soundEngine?.playClick?.(); } catch {}
    pushNotification(
      allArchived ? 'Tasks Restored' : 'Tasks Archived',
      allArchived
        ? `Restored ${targets.length} task${targets.length === 1 ? '' : 's'} to active list.`
        : `Archived ${targets.length} task${targets.length === 1 ? '' : 's'}.`,
      'task'
    );
    setSelectedBulkIds(new Set());
    setIsBulkSelectMode(false);
  };

  const handleConfirmBulkArchive = () => {
    const targets = tasks.filter(t => selectedBulkIds.has(t.id));
    if (targets.length === 0) return;
    const allArchived = targets.every(t => isTaskArchived(t));
    if (allArchived) {
      executeBulkArchive();
    } else {
      setPendingArchiveTarget({ kind: 'bulk', count: targets.length });
    }
  };

  const handleConfirmBulkDelete = () => {
    selectedBulkIds.forEach(id => {
      deleteTask(id);
    });
    setSelectedBulkIds(new Set());
    setShowBulkDeleteModal(false);
    setIsBulkSelectMode(false);
  };

  // Global keyboard shortcut ('/' focuses search bar, Escape clears)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        const el = document.getElementById('input-task-global-search') as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openDetailTask = (task: TaskItem) => {
    if (wasDraggingRef.current || draggedTaskId) return;
    setDetailTask(task);
    setIsDetailModalOpen(true);
  };

  const openAddTask = (defaultSt?: string, defaultQuad?: EisenhowerQuadrant) => {
    setTaskToEdit(null);
    setEventToEdit(null);
    setTaskModalInitialMode('task');
    setTaskModalDefaultStatus(defaultSt);
    setTaskModalDefaultQuadrant(defaultQuad);
    setIsTaskModalOpen(true);
  };

  const openAddEvent = () => {
    setTaskToEdit(null);
    setEventToEdit(null);
    setTaskModalInitialMode('event');
    setTaskModalDefaultStatus(undefined);
    setTaskModalDefaultQuadrant(undefined);
    setIsTaskModalOpen(true);
  };

  const openEditTask = async (task: TaskItem) => {
    const serverTask = await getTaskFromFirestore(task.id);
    if (serverTask && serverTask.updatedAt && task.updatedAt && new Date(serverTask.updatedAt) > new Date(task.updatedAt)) {
      setConflictData({ local: task, server: serverTask });
      return;
    }
    setEventToEdit(null);
    setTaskToEdit(task);
    setTaskModalInitialMode('task');
    setTaskModalDefaultStatus(undefined);
    setTaskModalDefaultQuadrant(undefined);
    setIsTaskModalOpen(true);
  };

  const openEditEvent = (item: ScheduleItem) => {
    if (wasDraggingRef.current || draggedTaskId) return;
    setTaskToEdit(null);
    setEventToEdit(item);
    setTaskModalInitialMode('event');
    setTaskModalDefaultStatus(undefined);
    setTaskModalDefaultQuadrant(undefined);
    setIsTaskModalOpen(true);
  };

  const handleCycleEisenhower = (task: TaskItem) => {
    const nextPriorityMap: Record<Priority, Priority> = {
      high: 'medium',
      medium: 'low',
      low: 'high',
    };
    const nextP = nextPriorityMap[task.priority] || 'high';
    const quadMap: Record<Priority, EisenhowerQuadrant> = {
      high: 'urgent_important',
      medium: 'not_urgent_important',
      low: 'urgent_not_important',
    };
    soundEngine?.playPill();
    updateTask({
      ...task,
      priority: nextP,
      quadrant: quadMap[nextP],
    });
  };

  // Helper to format MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const todayStr = formatLocalDate(new Date());

  // Auto-reveal newly created tasks: whenever tasks count increases, ensure no active filter hides the new task!
  const prevTasksCountRef = useRef(tasks.length);
  useEffect(() => {
    if (tasks.length > prevTasksCountRef.current) {
      const newest = tasks[0];
      if (newest) {
        setRecentlyCreatedTaskId(newest.id);
        // Clear any filters that would hide this newly created task
        if (searchQuery) setSearchQuery('');
        if (taskTypeFilter !== 'all') setTaskTypeFilter('all');
        if (filter === 'completed' || filter === 'archived') setFilter('today');
        if (selectedPriority !== 'all' && newest.priority !== selectedPriority) setSelectedPriority('all');
        if (selectedCategory !== 'all' && newest.category && newest.category.toLowerCase() !== selectedCategory.toLowerCase()) setSelectedCategory('all');
        if (selectedProject !== 'all' && newest.project && newest.project !== selectedProject) setSelectedProject('all');
        if (selectedGoal !== 'all' && newest.goalId && newest.goalId !== selectedGoal) setSelectedGoal('all');
        if (newest.dueDate && newest.dueDate > todayStr && filter === 'today') {
          setFilter('all');
        }
        const timer = setTimeout(() => {
          setRecentlyCreatedTaskId(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
    prevTasksCountRef.current = tasks.length;
  }, [tasks, searchQuery, taskTypeFilter, filter, selectedPriority, selectedCategory, selectedProject, selectedGoal, todayStr]);

  // Ensure running task is visible when jumped to from PiP widget
  useEffect(() => {
    const handleJumpToTask = (e: Event) => {
      const customEv = e as CustomEvent<{ taskId: string }>;
      const targetId = customEv.detail?.taskId;
      if (!targetId) return;

      const targetTask = tasks.find(t => t.id === targetId);
      if (targetTask) {
        if (isTaskArchived(targetTask) || filter === 'archived') {
          setFilter(isTaskArchived(targetTask) ? 'archived' : 'all');
        } else if (targetTask.completed || filter === 'completed') {
          setFilter('all');
        }
        if (searchQuery) setSearchQuery('');
        if (taskTypeFilter !== 'all') setTaskTypeFilter('all');
        if (selectedPriority !== 'all' && targetTask.priority !== selectedPriority) setSelectedPriority('all');
        if (selectedCategory !== 'all') setSelectedCategory('all');
        if (selectedProject !== 'all') setSelectedProject('all');
        if (selectedGoal !== 'all') setSelectedGoal('all');
      }
    };

    window.addEventListener('omni-jump-to-task', handleJumpToTask);
    return () => window.removeEventListener('omni-jump-to-task', handleJumpToTask);
  }, [tasks, filter, searchQuery, taskTypeFilter, selectedPriority, selectedCategory, selectedProject, selectedGoal]);

  const toggleSubtasksView = (taskId: string) => {
    setExpandedSubtasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const priorityOrder: Record<Priority, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  const priorityMeta: Record<Priority, { text: string; bg: string; badge: string; bar: string }> = {
    high: { 
      text: 'text-rose-950 dark:text-rose-200 font-semibold', 
      bg: 'bg-rose-50 dark:bg-rose-950/40', 
      badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 font-bold',
      bar: 'bg-rose-500'
    },
    medium: { 
      text: 'text-amber-950 dark:text-amber-200 font-semibold', 
      bg: 'bg-amber-50 dark:bg-amber-950/40', 
      badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold',
      bar: 'bg-amber-500'
    },
    low: { 
      text: 'text-violet-950 dark:text-violet-200 font-semibold', 
      bg: 'bg-violet-50 dark:bg-violet-950/40', 
      badge: 'bg-violet-100 dark:bg-violet-900/60 text-violet-900 dark:text-violet-200 font-bold',
      bar: 'bg-violet-500'
    },
  };

  const getPriorityMeta = (taskPriority?: string, taskQuadrant?: string) => {
    const p = (taskPriority || taskQuadrant || 'low').toString().toLowerCase().trim();
    if (p === 'high' || p === 'p1' || p === 'urgent_important' || p === 'urgent-important') {
      return priorityMeta.high;
    }
    if (p === 'medium' || p === 'p2' || p === 'not_urgent_important' || p === 'not-urgent-important') {
      return priorityMeta.medium;
    }
    return priorityMeta.low;
  };

  const getTaskPriorityBarClass = (task?: { priority?: string; quadrant?: string } | null) => {
    if (!task) return 'bg-violet-500';
    const q = (task.quadrant || '').toString().toLowerCase().trim();
    if (q === 'urgent_important' || q === 'urgent-important') return 'bg-rose-500';
    if (q === 'not_urgent_important' || q === 'not-urgent-important') return 'bg-amber-500';
    if (q === 'urgent_not_important' || q === 'urgent-not-important') return 'bg-blue-500';
    if (q === 'not_urgent_not_important' || q === 'not-urgent-not-important' || q === 'neither') return 'bg-violet-500';
    const p = (task.priority || 'low').toString().toLowerCase().trim();
    if (p === 'high' || p === 'p1') return 'bg-rose-500';
    if (p === 'medium' || p === 'p2') return 'bg-amber-500';
    if (p === 'p3') return 'bg-blue-500';
    return 'bg-violet-500';
  };

  const getTaskCheckboxPriorityClass = (task?: { priority?: string; quadrant?: string; completed?: boolean } | null, isVisuallyDone?: boolean) => {
    if (!task) return 'border-2 border-violet-500 dark:border-violet-400 bg-violet-500/8';
    const isDone = isVisuallyDone || task.completed;
    const q = (task.quadrant || '').toString().toLowerCase().trim();

    if (q === 'urgent_important' || q === 'urgent-important') {
      return isDone
        ? 'bg-rose-500 border-2 border-rose-500 text-white shadow-2xs'
        : 'border-2 border-rose-500 dark:border-rose-400 bg-rose-500/8 dark:bg-rose-500/15 hover:bg-rose-500/18 hover:scale-105';
    }
    if (q === 'not_urgent_important' || q === 'not-urgent-important') {
      return isDone
        ? 'bg-amber-500 border-2 border-amber-500 text-white shadow-2xs'
        : 'border-2 border-amber-500 dark:border-amber-400 bg-amber-500/8 dark:bg-amber-500/15 hover:bg-amber-500/18 hover:scale-105';
    }
    if (q === 'urgent_not_important' || q === 'urgent-not-important') {
      return isDone
        ? 'bg-blue-500 border-2 border-blue-500 text-white shadow-2xs'
        : 'border-2 border-blue-500 dark:border-blue-400 bg-blue-500/8 dark:bg-blue-500/15 hover:bg-blue-500/18 hover:scale-105';
    }
    if (q === 'not_urgent_not_important' || q === 'not-urgent-not-important' || q === 'neither') {
      return isDone
        ? 'bg-violet-500 border-2 border-violet-500 text-white shadow-2xs'
        : 'border-2 border-violet-500 dark:border-violet-400 bg-violet-500/8 dark:bg-violet-500/15 hover:bg-violet-500/18 hover:scale-105';
    }
    const p = (task.priority || 'low').toString().toLowerCase().trim();
    if (p === 'high' || p === 'p1') {
      return isDone
        ? 'bg-rose-500 border-2 border-rose-500 text-white shadow-2xs'
        : 'border-2 border-rose-500 dark:border-rose-400 bg-rose-500/8 dark:bg-rose-500/15 hover:bg-rose-500/18 hover:scale-105';
    }
    if (p === 'medium' || p === 'p2') {
      return isDone
        ? 'bg-amber-500 border-2 border-amber-500 text-white shadow-2xs'
        : 'border-2 border-amber-500 dark:border-amber-400 bg-amber-500/8 dark:bg-amber-500/15 hover:bg-amber-500/18 hover:scale-105';
    }
    if (p === 'p3') {
      return isDone
        ? 'bg-blue-500 border-2 border-blue-500 text-white shadow-2xs'
        : 'border-2 border-blue-500 dark:border-blue-400 bg-blue-500/8 dark:bg-blue-500/15 hover:bg-blue-500/18 hover:scale-105';
    }
    return isDone
      ? 'bg-violet-500 border-2 border-violet-500 text-white shadow-2xs'
      : 'border-2 border-violet-500 dark:border-violet-400 bg-violet-500/8 dark:bg-violet-500/15 hover:bg-violet-500/18 hover:scale-105';
  };

  // Distinct projects and tags memoized
  const allProjects = useMemo(() => {
    return Array.from(new Set([...tasks.map(t => t.project).filter(Boolean), ...projects.map(p => p.name)]));
  }, [tasks, projects]);

  const allTags = useMemo(() => {
    return Array.from(new Set(tasks.flatMap(t => t.tags || []).filter(Boolean)));
  }, [tasks]);

  // Helper to check if task matches active custom list and tags
  const matchesListAndTags = (task: TaskItem) => {
    if (selectedTag !== 'all') {
      if (!task.tags || !task.tags.includes(selectedTag)) return false;
    }

    if (selectedListId === 'all') {
      // In "All", respect excludeFromAll (unless completed or specifically marked)
      if (task.isSomeday) return false;
      const taskList = todoLists.find(l => l.id === task.listId);
      if (taskList?.excludeFromAll) return false;
      return true;
    }

    if (selectedListId === 'smart-starred') {
      return !!task.isStarred;
    }
    if (selectedListId === 'smart-today') {
      return task.dueDate <= todayStr && !task.completed;
    }
    if (selectedListId === 'smart-alerts') {
      return Array.isArray(task.alerts) && task.alerts.length > 0;
    }
    if (selectedListId === 'smart-someday') {
      return !!task.isSomeday || task.listId === 'someday';
    }
    if (selectedListId === 'smart-next') {
      return task.listId === 'next' || task.priority === 'high';
    }

    if (selectedListId === 'inbox' || selectedListId === 'list_inbox') {
      return !task.listId || task.listId === 'inbox' || task.listId === 'list_inbox';
    }

    return task.listId === selectedListId || (!task.listId && selectedListId === 'inbox');
  };

  // Category helpers
  const getCategoryForTask = (task: TaskItem): TaskCategory => {
    const raw = (task.category || task.project || 'personal').toLowerCase();
    const found = DEFAULT_TASK_CATEGORIES.find(c => c.id === raw || c.name.toLowerCase() === raw);
    if (found) return found;
    return {
      id: raw,
      name: task.category || task.project || 'Personal',
      color: '#64748b',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      textColor: 'text-slate-700 dark:text-slate-300',
      borderColor: 'border-slate-300 dark:border-slate-700',
      dotColor: 'bg-slate-500',
      icon: '🏷️',
    };
  };

  const countForCategory = (catId: string) => {
    return tasks.filter(t => {
      if (isTaskArchived(t)) return false;
      const isDone = t.completed || t.status === 'done';
      if (isDone) return false;
      const raw = (t.category || t.project || 'personal').toLowerCase();
      return raw === catId.toLowerCase();
    }).length;
  };

  // Global search matcher: filters tasks by title or tag instantly (matching Super Productivity efficiency)
  const matchesSearch = (task: TaskItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const cleanTag = q.startsWith('#') ? q.slice(1) : q;

    const titleMatches = task.title.toLowerCase().includes(q);
    const tagMatches = !!task.tags?.some(tag => tag.toLowerCase().includes(cleanTag));
    const projectMatches = (task.project || '').toLowerCase().includes(q);
    const subtaskMatches = !!task.subtasks?.some(sub => sub.title.toLowerCase().includes(q));

    return titleMatches || tagMatches || projectMatches || subtaskMatches;
  };

  // Helper to check if task matches selected priority, project, category, goal, and global search query
  const matchesPriorityAndProject = (task: TaskItem) => {
    if (!matchesSearch(task)) return false;
    if (selectedCategory !== 'all') {
      const tagMatch = hasTagCaseInsensitive(task.tags, selectedCategory);
      const catMatch = (task.category || task.project || 'personal').toLowerCase() === selectedCategory.toLowerCase();
      if (!tagMatch && !catMatch) return false;
    }
    if (selectedPriority !== 'all') {
      const p = (task.priority || '').toLowerCase();
      const sp = selectedPriority.toLowerCase();
      const matches = p === sp || (sp === 'high' && p === 'p1') || (sp === 'medium' && p === 'p2') || (sp === 'low' && (p === 'p3' || p === 'p4'));
      if (!matches) return false;
    }
    if (selectedGoal !== 'all') {
      const matchedGoal = goals.find(g => g.id === selectedGoal);
      const isGoalMatch = task.goalId === selectedGoal ||
                          task.projectId === selectedGoal ||
                          (matchedGoal && (task.project || '').toLowerCase() === matchedGoal.title.toLowerCase());
      if (!isGoalMatch) return false;
    }
    if (selectedProject !== 'all' && selectedGoal === 'all' && task.project !== selectedProject) return false;
    if (taskTypeFilter !== 'all') {
      const isGoal = task.taskType === 'goal' || !!task.goalId;
      const isProject = (task.taskType as any) === 'project' || !!task.projectId || !!task.project;
      if (taskTypeFilter === 'goal' && !isGoal) return false;
      if (taskTypeFilter === 'project' && !isProject) return false;
    }
    if (!matchesListAndTags(task)) return false;
    return true;
  };

  // Helper to check if task matches active time/status filter tab across List, Kanban, and Eisenhower views
  const matchesFilterTab = (
    task: TaskItem,
    options?: {
      forKanbanColId?: TaskStatus;
      overrideFilter?: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived';
    }
  ) => {
    const activeTabFilter = options?.overrideFilter ?? filter;
    const taskArchived = isTaskArchived(task);

    // If task was just created (and isn't archived), keep it visible on its own tab so user sees it immediately
    if (!options?.overrideFilter && recentlyCreatedTaskId === task.id && !taskArchived) return true;

    if (!matchesPriorityAndProject(task)) return false;

    if (selectedStageFilter !== 'all' && !options?.forKanbanColId) {
      const taskStage = task.status || (task.completed ? 'done' : 'todo');
      if (taskStage !== selectedStageFilter) return false;
    }

    // Archived tab: only show archived tasks (never mix into active/done tabs)
    if (activeTabFilter === 'archived') {
      return taskArchived;
    }
    if (taskArchived) return false;

    // If currently playing completion animation, keep task in active list until fade-out finishes
    const isCompletingNow = completingTaskIds.has(task.id);
    const isTaskCompleted = (task.completed || task.status === 'done') && !isCompletingNow;

    // 1. Done tab: only show completed (non-archived) tasks
    if (activeTabFilter === 'completed') {
      return (task.completed || task.status === 'done') && !isCompletingNow;
    }

    // 2. Today tab: strictly tasks due today (or undated) — Overdue is rendered in its own dedicated collapsible section
    if (activeTabFilter === 'today') {
      if (options?.forKanbanColId === 'done') {
        return (
          isTaskCompleted &&
          ((task.completedAt && (task.completedAt.startsWith(todayStr) || formatLocalDate(new Date(task.completedAt)) === todayStr)) || task.dueDate === todayStr)
        );
      }
      return !isTaskCompleted && (!task.dueDate || task.dueDate === todayStr);
    }

    // 2b. Overdue tab: strictly active tasks whose dueDate is strictly before today
    if (activeTabFilter === 'overdue') {
      if (options?.forKanbanColId === 'done') {
        return false;
      }
      return !isTaskCompleted && Boolean(task.dueDate) && task.dueDate < todayStr;
    }

    // 3. Upcoming tab
    if (activeTabFilter === 'upcoming') {
      if (options?.forKanbanColId === 'done') {
        return false;
      }
      return !isTaskCompleted && Boolean(task.dueDate) && task.dueDate > todayStr;
    }

    // 4. Specific Date tab ('date')
    if (activeTabFilter === 'date') {
      if (options?.forKanbanColId === 'done') {
        return (
          isTaskCompleted &&
          ((task.completedAt && (task.completedAt.startsWith(selectedTaskDate) || formatLocalDate(new Date(task.completedAt)) === selectedTaskDate)) || task.dueDate === selectedTaskDate)
        );
      }
      return !isTaskCompleted && task.dueDate === selectedTaskDate;
    }

    // 5. All Active tab ('all')
    if (options?.forKanbanColId === 'done') {
      return (
        isTaskCompleted &&
        ((task.completedAt && task.completedAt.startsWith(todayStr)) || task.dueDate === todayStr)
      );
    }

    return !isTaskCompleted;
  };

  // Standalone Time-Bounded ScheduleItems (excluding items already linked to a TaskItem to prevent duplicates)
  const { standaloneScheduleItems, linkedScheduleByTaskId } = useMemo(() => {
    const taskIds = new Set(tasks.map(t => t.id));
    const linked = new Map<string, ScheduleItem>();
    const standalone: ScheduleItem[] = [];
    (scheduleItems || []).forEach(s => {
      if (s.taskId && taskIds.has(s.taskId)) {
        if (!linked.has(s.taskId)) linked.set(s.taskId, s);
      } else {
        standalone.push(s);
      }
    });
    return { standaloneScheduleItems: standalone, linkedScheduleByTaskId: linked };
  }, [scheduleItems, tasks]);

  const matchesScheduleContext = useCallback((s: ScheduleItem) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hit =
        s.title.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (selectedCategory !== 'all') {
      if ((s.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
    }
    if (selectedPriority !== 'all') {
      const sp = selectedPriority.toLowerCase();
      const rawP = (s.priority || 'medium').toString().toLowerCase();
      const normalized = rawP === 'p1' || rawP === 'high' ? 'high' : rawP === 'p2' || rawP === 'p3' || rawP === 'medium' ? 'medium' : 'low';
      if (normalized !== sp) return false;
    }
    if (selectedGoal !== 'all' && s.goalId !== selectedGoal) return false;
    if (selectedProject !== 'all' && selectedGoal === 'all') return false;
    if (selectedTag !== 'all') return false;
    if (taskTypeFilter === 'goal' && !s.goalId) return false;
    if (taskTypeFilter === 'project') return false;
    if (selectedStageFilter !== 'all') {
      const stage = s.completed ? 'done' : 'todo';
      if (stage !== selectedStageFilter) return false;
    }
    if (selectedListId !== 'all' && selectedListId !== 'smart-today' && selectedListId !== 'inbox' && selectedListId !== 'list_inbox') {
      if (selectedListId === 'smart-alerts') {
        if (!s.reminderType || s.reminderType === 'none') return false;
      } else {
        return false;
      }
    }
    return true;
  }, [searchQuery, selectedCategory, selectedPriority, selectedGoal, selectedProject, selectedTag, taskTypeFilter, selectedStageFilter, selectedListId]);

  const matchesScheduleTab = useCallback((s: ScheduleItem, tab: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'date' | 'archived') => {
    if (tab === 'archived') return false;
    if (!matchesScheduleContext(s)) return false;
    const isCompleting = completingScheduleIds.has(s.id);
    const isDone = Boolean(s.completed) && !isCompleting;
    if (tab === 'completed') return Boolean(s.completed) && !isCompleting;
    if (isDone) return false;
    if (tab === 'today') {
      return isScheduleItemOnDate(s, todayStr);
    }
    if (tab === 'overdue') {
      return (!s.repeatType || s.repeatType === 'none') && Boolean(s.date) && s.date < todayStr;
    }
    if (tab === 'upcoming') {
      return Boolean(s.date) && s.date > todayStr;
    }
    if (tab === 'date') {
      return isScheduleItemOnDate(s, selectedTaskDate);
    }
    return true;
  }, [matchesScheduleContext, todayStr, selectedTaskDate, completingScheduleIds]);

  // Pre-computed memoized counts for filter buttons in a single pass
  const filterCounts = useMemo(() => {
    const counts = { today: 0, overdue: 0, upcoming: 0, all: 0, completed: 0, date: 0, archived: 0 };
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!matchesSearch(t)) continue;
      if (selectedCategory !== 'all') {
        const tagMatch = hasTagCaseInsensitive(t.tags, selectedCategory);
        const catMatch = (t.category || t.project || 'personal').toLowerCase() === selectedCategory.toLowerCase();
        if (!tagMatch && !catMatch) continue;
      }
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) continue;
      if (selectedProject !== 'all' && t.project !== selectedProject) continue;
      if (selectedGoal !== 'all' && t.goalId !== selectedGoal) continue;
      if (selectedStageFilter !== 'all') {
        const taskStage = t.status || (t.completed ? 'done' : 'todo');
        if (taskStage !== selectedStageFilter) continue;
      }
      if (!matchesListAndTags(t)) continue;

      if (isTaskArchived(t)) {
        counts.archived++;
        continue;
      }

      const isDone = t.completed || t.status === 'done';
      if (isDone) {
        counts.completed++;
        continue;
      }
      counts.all++;
      if (!t.dueDate || t.dueDate === todayStr) {
        counts.today++;
      } else if (t.dueDate < todayStr) {
        counts.overdue++;
      } else if (t.dueDate > todayStr) {
        counts.upcoming++;
      }
      if (t.dueDate === selectedTaskDate) {
        counts.date++;
      }
    }

    for (let i = 0; i < standaloneScheduleItems.length; i++) {
      const s = standaloneScheduleItems[i];
      if (!matchesScheduleContext(s)) continue;
      if (s.completed) {
        counts.completed++;
        continue;
      }
      counts.all++;
      if (isScheduleItemOnDate(s, todayStr)) {
        counts.today++;
      } else if ((!s.repeatType || s.repeatType === 'none') && Boolean(s.date) && s.date < todayStr) {
        counts.overdue++;
      } else if (s.date && s.date > todayStr) {
        counts.upcoming++;
      }
      if (isScheduleItemOnDate(s, selectedTaskDate)) {
        counts.date++;
      }
    }

    return counts;
  }, [
    tasks,
    standaloneScheduleItems,
    matchesScheduleContext,
    searchQuery,
    selectedCategory,
    selectedPriority,
    selectedProject,
    selectedGoal,
    selectedStageFilter,
    selectedTag,
    selectedListId,
    todoLists,
    todayStr,
    selectedTaskDate,
  ]);

  const countForFilter = (tab: 'today' | 'overdue' | 'upcoming' | 'all' | 'completed' | 'date' | 'archived') => filterCounts[tab];

  // Count active tasks for a specific list or smart list
  const countForList = (listId: string) => {
    return tasks.filter(t => {
      if (isTaskArchived(t)) return false;
      const isDone = t.completed || t.status === 'done';
      if (isDone) return false;
      if (listId === 'all') {
        if (t.isSomeday) return false;
        const l = todoLists.find(item => item.id === t.listId);
        return !l?.excludeFromAll;
      }
      if (listId === 'smart-starred') return !!t.isStarred;
      if (listId === 'smart-today') return t.dueDate <= todayStr;
      if (listId === 'smart-alerts') return Array.isArray(t.alerts) && t.alerts.length > 0;
      if (listId === 'smart-someday') return !!t.isSomeday || t.listId === 'someday';
      if (listId === 'smart-next') return t.listId === 'next' || t.priority === 'high';
      return t.listId === listId || (!t.listId && listId === 'inbox');
    }).length;
  };

  // Quick task creation
  const handleQuickAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    const targetList =
      selectedListId && !selectedListId.startsWith('smart-') && selectedListId !== 'all'
        ? selectedListId
        : quickListId || 'inbox';

    const quadrantMap: Record<Priority, EisenhowerQuadrant> = {
      high: 'urgent_important',
      medium: 'not_urgent_important',
      low: 'urgent_not_important',
    };

    const taskCategory = quickCategory || (selectedCategory !== 'all' ? selectedCategory : 'work');
    const boundProj = projects.find(p => p.id === quickProjectId);
    const categoryName = DEFAULT_TASK_CATEGORIES.find(c => c.id === taskCategory)?.name || 'Work';

    addTask({
      title: quickTaskTitle.trim(),
      completed: false,
      priority: quickPriority,
      quadrant: quadrantMap[quickPriority] || 'urgent_important',
      dueDate: quickDueDate || todayStr,
      project: boundProj ? boundProj.name : categoryName,
      projectId: quickProjectId || undefined,
      goalId: quickGoalId || boundProj?.goalId || undefined,
      category: taskCategory,
      listId: targetList,
      isStarred: quickIsStarred,
      isSomeday: selectedListId === 'smart-someday',
      estimatedPomodoros: 1,
      subtasks: [],
      status: 'todo',
      recurring: 'none',
      updatedAt: new Date().toISOString(),
    });

    setQuickTaskTitle('');
    setQuickIsStarred(false);
    if (searchQuery) setSearchQuery('');
    if (taskTypeFilter !== 'all') setTaskTypeFilter('all');
    if (filter === 'completed' || filter === 'archived') setFilter('today');
    if (selectedPriority !== 'all' && quickPriority !== selectedPriority) setSelectedPriority('all');
    if (selectedCategory !== 'all' && taskCategory.toLowerCase() !== selectedCategory.toLowerCase()) setSelectedCategory('all');
    if (quickDueDate && quickDueDate > todayStr && filter === 'today') setFilter('all');
  };

  // Batch task creation (one per line)
  const handleBatchAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = quickBatchText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const targetList =
      selectedListId && !selectedListId.startsWith('smart-') && selectedListId !== 'all'
        ? selectedListId
        : quickListId || 'inbox';

    const quadrantMap: Record<Priority, EisenhowerQuadrant> = {
      high: 'urgent_important',
      medium: 'not_urgent_important',
      low: 'urgent_not_important',
    };

    const taskCategory = quickCategory || (selectedCategory !== 'all' ? selectedCategory : 'work');
    const boundProj = projects.find(p => p.id === quickProjectId);
    const categoryName = DEFAULT_TASK_CATEGORIES.find(c => c.id === taskCategory)?.name || 'Work';

    const newTasks = lines.map(line => ({
      title: line,
      completed: false,
      priority: quickPriority,
      quadrant: quadrantMap[quickPriority] || 'urgent_important',
      dueDate: quickDueDate || todayStr,
      project: boundProj ? boundProj.name : categoryName,
      projectId: quickProjectId || undefined,
      goalId: quickGoalId || boundProj?.goalId || undefined,
      category: taskCategory,
      listId: targetList,
      isStarred: quickIsStarred,
      isSomeday: selectedListId === 'smart-someday',
      estimatedPomodoros: 1,
      subtasks: [],
      status: 'todo' as TaskStatus,
      recurring: 'none' as const,
    }));

    batchAddTasks(newTasks);
    setQuickBatchText('');
    setIsBatchQuickAddOpen(false);
    if (searchQuery) setSearchQuery('');
    if (taskTypeFilter !== 'all') setTaskTypeFilter('all');
    if (filter === 'completed' || filter === 'archived') setFilter('today');
    if (selectedPriority !== 'all' && quickPriority !== selectedPriority) setSelectedPriority('all');
    if (selectedCategory !== 'all' && taskCategory.toLowerCase() !== selectedCategory.toLowerCase()) setSelectedCategory('all');
    if (quickDueDate && quickDueDate > todayStr && filter === 'today') setFilter('all');
  };

  // Filter tasks for list view with Do -> Plan -> Pass -> Skip ranking hierarchy (memoized for high framerates)
  const filteredTasks = useMemo(() => {
    return [...tasks]
      .filter(t => matchesFilterTab(t))
      .sort((a, b) => {
        if (recentlyCreatedTaskId) {
          if (a.id === recentlyCreatedTaskId) return -1;
          if (b.id === recentlyCreatedTaskId) return 1;
        }
        return compareTasksByDoPlanPassSkip(a, b);
      });
  }, [
    tasks,
    isSmartSort,
    filter,
    selectedTaskDate,
    todayStr,
    selectedCategory,
    selectedPriority,
    selectedGoal,
    selectedProject,
    selectedStageFilter,
    taskTypeFilter,
    searchQuery,
    selectedTag,
    selectedListId,
    recentlyCreatedTaskId,
    completingTaskIds,
  ]);

  // Stable global rank mapping so task numbers remain identical across all platforms and view tabs
  const taskGlobalRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const used = new Set<number>();
    tasks.forEach(t => {
      const explicit = typeof t.weight === 'number' && t.weight > 0 ? t.weight : typeof t.rank === 'number' && t.rank > 0 ? t.rank : typeof t.order === 'number' && t.order > 0 ? t.order : 0;
      if (explicit > 0) {
        map.set(t.id, explicit);
        used.add(explicit);
      }
    });
    let seq = 1;
    tasks.forEach(t => {
      if (!map.has(t.id)) {
        while (used.has(seq)) {
          seq++;
        }
        map.set(t.id, seq);
        used.add(seq);
        seq++;
      }
    });
    return map;
  }, [tasks]);

  const displayedFilteredTasks = useMemo(() => {
    return filteredTasks.map((task, idx) => {
      const explicit = typeof task.weight === 'number' && task.weight > 0 ? task.weight : typeof task.rank === 'number' && task.rank > 0 ? task.rank : typeof task.order === 'number' && task.order > 0 ? task.order : 0;
      const displayRank = explicit > 0 ? explicit : (taskGlobalRankMap.get(task.id) ?? (idx + 1));
      return { ...task, _displayRank: displayRank };
    });
  }, [filteredTasks, taskGlobalRankMap]);

  const filteredScheduleItems = useMemo(() => {
    return standaloneScheduleItems
      .filter(s => matchesScheduleTab(s, filter))
      .sort((a, b) => {
        const dateDiff = (a.date || '').localeCompare(b.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [standaloneScheduleItems, matchesScheduleTab, filter]);

  const getUnifiedPriorityTier = (entry: { kind: 'task'; task: TaskItem } | { kind: 'event'; event: ScheduleItem }): number => {
    if (entry.kind === 'task') {
      const q = entry.task.quadrant;
      if (q === 'urgent_important') return 1;
      if (q === 'not_urgent_important') return 2;
      if (q === 'urgent_not_important') return 3;
      if (q === 'not_urgent_not_important' || q === 'neither') return 4;
      if (entry.task.priority === 'high') return 1;
      if (entry.task.priority === 'medium') return 2;
      if (entry.task.priority === 'low') return 4;
      return 4;
    }
    const p = (entry.event.priority || 'medium').toString().toLowerCase();
    if (p === 'p1' || p === 'high') return 1;
    if (p === 'p2' || p === 'medium') return 2;
    if (p === 'p3') return 3;
    return 4;
  };

  type UnifiedTaskListEntry =
    | { kind: 'task'; id: string; task: TaskItem & { _displayRank: number } }
    | { kind: 'event'; id: string; event: ScheduleItem };

  const displayedListEntries = useMemo<UnifiedTaskListEntry[]>(() => {
    const taskEntries: UnifiedTaskListEntry[] = displayedFilteredTasks.map(task => ({
      kind: 'task',
      id: task.id,
      task,
    }));
    const eventEntries: UnifiedTaskListEntry[] = filteredScheduleItems.map(event => ({
      kind: 'event',
      id: event.id,
      event,
    }));
    return [...taskEntries, ...eventEntries].sort((a, b) => {
      if (recentlyCreatedTaskId) {
        if (a.id === recentlyCreatedTaskId) return -1;
        if (b.id === recentlyCreatedTaskId) return 1;
      }
      const tierDiff = getUnifiedPriorityTier(a) - getUnifiedPriorityTier(b);
      if (tierDiff !== 0) return tierDiff;
      if (a.kind === 'task' && b.kind === 'task') {
        return compareTasksByDoPlanPassSkip(a.task, b.task);
      }
      const dateA = a.kind === 'task' ? (a.task.dueDate || '') : (a.event.date || '');
      const dateB = b.kind === 'task' ? (b.task.dueDate || '') : (b.event.date || '');
      if (dateA !== dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      }
      const timeA = a.kind === 'task' ? (a.task.dueTime || '') : (a.event.startTime || '');
      const timeB = b.kind === 'task' ? (b.task.dueTime || '') : (b.event.startTime || '');
      return timeA.localeCompare(timeB);
    });
  }, [displayedFilteredTasks, filteredScheduleItems, recentlyCreatedTaskId]);

  // Overdue items shown cleanly in their own collapsible section at the top of Today (TickTick/Todoist pattern)
  const overdueListEntries = useMemo<UnifiedTaskListEntry[]>(() => {
    const overdueTasks = tasks
      .filter(t => matchesFilterTab(t, { overrideFilter: 'overdue' }))
      .map((task, idx) => {
        const explicit = typeof task.weight === 'number' && task.weight > 0 ? task.weight : typeof task.rank === 'number' && task.rank > 0 ? task.rank : typeof task.order === 'number' && task.order > 0 ? task.order : 0;
        const displayRank = explicit > 0 ? explicit : (taskGlobalRankMap.get(task.id) ?? (idx + 1));
        return { kind: 'task' as const, id: task.id, task: { ...task, _displayRank: displayRank } };
      });
    const overdueEvents: UnifiedTaskListEntry[] = standaloneScheduleItems
      .filter(s => matchesScheduleTab(s, 'overdue'))
      .map(event => ({ kind: 'event', id: event.id, event }));
    return [...overdueTasks, ...overdueEvents].sort((a, b) => {
      const tierDiff = getUnifiedPriorityTier(a) - getUnifiedPriorityTier(b);
      if (tierDiff !== 0) return tierDiff;
      if (a.kind === 'task' && b.kind === 'task') {
        return compareTasksByDoPlanPassSkip(a.task, b.task);
      }
      const dateA = a.kind === 'task' ? (a.task.dueDate || '') : (a.event.date || '');
      const dateB = b.kind === 'task' ? (b.task.dueDate || '') : (b.event.date || '');
      return dateA.localeCompare(dateB);
    });
  }, [
    tasks,
    standaloneScheduleItems,
    taskGlobalRankMap,
    matchesScheduleTab,
    todayStr,
    selectedCategory,
    selectedPriority,
    selectedGoal,
    selectedProject,
    selectedStageFilter,
    taskTypeFilter,
    searchQuery,
    selectedTag,
    selectedListId,
    completingTaskIds,
  ]);

  const handleBulkRescheduleOverdue = useCallback((target: 'today' | 'tomorrow' | 'next_week') => {
    if (overdueListEntries.length === 0) return;
    const targetDateObj = new Date();
    if (target === 'tomorrow') {
      targetDateObj.setDate(targetDateObj.getDate() + 1);
    } else if (target === 'next_week') {
      targetDateObj.setDate(targetDateObj.getDate() + 7);
    }
    const targetDateStr = formatLocalDate(targetDateObj);
    const label = target === 'today' ? 'Today' : target === 'tomorrow' ? 'Tomorrow' : 'Next Week';

    let movedCount = 0;
    overdueListEntries.forEach(entry => {
      if (entry.kind === 'task') {
        const { _displayRank: _ignored, ...cleanTask } = entry.task;
        updateTask({ ...cleanTask, dueDate: targetDateStr });
        movedCount++;
      } else {
        updateScheduleItem({ ...entry.event, date: targetDateStr });
        movedCount++;
      }
    });

    try {
      soundEngine?.playSuccessChime?.();
      haptics.toggle();
    } catch {}
    pushNotification(
      'Overdue Rescheduled',
      `Moved ${movedCount} overdue ${movedCount === 1 ? 'item' : 'items'} to ${label}.`,
      'task'
    );
  }, [overdueListEntries, updateTask, updateScheduleItem, soundEngine, pushNotification]);

  const todayDisplayHeader = useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return todayStr;
    }
  }, [todayStr]);

  // Completed tasks matching current context filters (memoized, excluding archived)
  const completedTasks = useMemo(() => {
    return tasks
      .filter(t => !isTaskArchived(t) && (t.completed || t.status === 'done') && matchesPriorityAndProject(t))
      .sort((a, b) => ((b.completedAt || b.dueDate) || '').localeCompare((a.completedAt || a.dueDate) || ''));
  }, [tasks, selectedCategory, selectedPriority, selectedGoal, selectedProject, searchQuery, selectedTag, selectedListId]);

  const completedScheduleItems = useMemo(() => {
    return standaloneScheduleItems
      .filter(s => Boolean(s.completed) && matchesScheduleContext(s))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [standaloneScheduleItems, matchesScheduleContext]);

  return (
    <div className={`w-full min-w-0 max-w-full flex-1 min-h-0 flex flex-col ${viewMode === 'matrix' ? 'h-full overflow-hidden space-y-1' : 'space-y-2.5 sm:space-y-3 pb-4'}`}>
      {/* Compact Material 4 Unified View Switcher & Quick Add Bar */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-[18px] bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-1.5 w-full min-w-0 max-w-full relative z-30 shrink-0">
        {/* Left: Material 4 Connected Segmented View Switcher (List | Events | Matrix | Reports) */}
        <div className="inline-flex items-center p-0.5 rounded-full bg-slate-100/95 dark:bg-slate-800/95 text-xs shrink-0 gap-[2px] border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-none min-w-0">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="Tasks View"
            className={`flex items-center justify-center gap-1 py-1 px-2.5 sm:px-3 ${
              viewMode === 'list' ? 'rounded-full' : 'rounded-l-full rounded-r-[6px]'
            } font-semibold text-xs transition-all duration-200 cursor-pointer shrink-0 ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }`}
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span>Tasks</span>
            <span className={`text-[10px] font-mono ${viewMode === 'list' ? 'text-white/85' : 'opacity-70'}`}>
              {countForFilter('all')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('events')}
            title="Timeline & Time-Blocking Schedule"
            className={`flex items-center justify-center gap-1 py-1 px-2.5 sm:px-3 ${
              viewMode === 'events' ? 'rounded-full' : 'rounded-[6px]'
            } font-semibold text-xs transition-all duration-200 cursor-pointer shrink-0 ${
              viewMode === 'events'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span>Timeline</span>
            <span className={`text-[10px] font-mono ${viewMode === 'events' ? 'text-white/85' : 'opacity-70'}`}>
              {(scheduleItems || []).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            title="Eisenhower Priority Matrix"
            className={`flex items-center justify-center gap-1 py-1 px-2.5 sm:px-3 ${
              viewMode === 'matrix' ? 'rounded-full' : 'rounded-[6px]'
            } font-semibold text-xs transition-all duration-200 cursor-pointer shrink-0 ${
              viewMode === 'matrix'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }`}
          >
            <EisenhowerIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('reports')}
            title="Task Analytics & Velocity Reports"
            className={`flex items-center justify-center py-1 px-2.5 ${
              viewMode === 'reports' ? 'rounded-full' : 'rounded-r-full rounded-l-[6px]'
            } font-semibold text-xs transition-all duration-200 cursor-pointer shrink-0 ${
              viewMode === 'reports'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        {/* Right: Quick Bulk Exit (if active) + Direct 1-Click Add + Optional Batch Quick-Add */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          {isBulkSelectMode && (
            <button
              type="button"
              onClick={() => {
                setIsBulkSelectMode(false);
                setSelectedBulkIds(new Set());
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1"
              title="Exit Bulk Selection Mode"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Done ({selectedBulkIds.size})</span>
            </button>
          )}

          {viewMode !== 'events' && viewMode !== 'reports' && (
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition shrink-0 cursor-pointer flex items-center justify-center"
              title="Batch Quick-Add Multiple Tasks"
            >
              <ListTodo className="w-4 h-4" />
            </button>
          )}

          <button
            id="btn-open-add-task"
            type="button"
            onClick={() => (viewMode === 'events' ? openAddEvent() : openAddTask())}
            className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center"
            title={viewMode === 'events' ? 'Add Scheduled Timeline Block' : 'Add New Task'}
            aria-label={viewMode === 'events' ? 'Add Scheduled Timeline Block' : 'Add New Task'}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Offline Pending Queue Summary Card */}
      {(!isOnline || offlinePendingQueue.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <CloudOff className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {isOnline ? 'Pending Offline Synchronizations' : 'Offline Mode Active'}
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                {offlinePendingQueue.length} operation{offlinePendingQueue.length === 1 ? '' : 's'} waiting to sync with Firestore.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={retryOfflineQueue}
            disabled={!isOnline}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Sync Now</span>
          </button>
        </div>
      )}

      {/* Unified Single-Row Tasks Toolbar (Strictly scoped to Tasks list view so Timeline & Reports never jump) */}
      {viewMode === 'list' && (() => {
        const activeFilterCount =
          (selectedCategory !== 'all' ? 1 : 0) +
          (selectedListId !== 'all' ? 1 : 0) +
          (selectedGoal !== 'all' || selectedProject !== 'all' ? 1 : 0);

        return (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-1.5 sm:px-2.5 sm:py-1.5 shadow-2xs w-full min-w-0 max-w-full shrink-0 relative z-20">
            <div className="flex items-center justify-between gap-1 min-w-0 w-full flex-nowrap">
              {/* Left: Primary Time Filter Tabs (Active tab always shows label on mobile) */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
                {/* Today */}
                <button
                  type="button"
                  onClick={() => setFilter('today')}
                  title={`Today (${countForFilter('today')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'today'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sun className={`w-3.5 h-3.5 shrink-0 ${filter === 'today' ? 'text-amber-300 dark:text-amber-500' : 'text-amber-500'}`} />
                  <span className={filter === 'today' ? 'inline' : 'hidden sm:inline'}>Today</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('today')}</span>
                </button>

                {/* Overdue (Dedicated tab whenever overdue items exist) */}
                {(countForFilter('overdue') > 0 || filter === 'overdue') && (
                  <button
                    type="button"
                    onClick={() => setFilter('overdue')}
                    title={`Overdue (${countForFilter('overdue')})`}
                    className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      filter === 'overdue'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-rose-50/90 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/70 dark:border-rose-800/60'
                    }`}
                  >
                    <OverdueIcon className={`w-3.5 h-3.5 shrink-0 ${filter === 'overdue' ? 'text-white' : 'text-rose-500'}`} />
                    <span className={filter === 'overdue' ? 'inline' : 'hidden sm:inline'}>Overdue</span>
                    <span className="font-mono text-[10.5px] font-bold">{countForFilter('overdue')}</span>
                  </button>
                )}

                {/* Upcoming */}
                <button
                  type="button"
                  onClick={() => setFilter('upcoming')}
                  title={`Upcoming (${countForFilter('upcoming')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'upcoming'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${filter === 'upcoming' ? 'text-blue-300 dark:text-blue-500' : 'text-blue-500'}`} />
                  <span className={filter === 'upcoming' ? 'inline' : 'hidden sm:inline'}>Upcoming</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('upcoming')}</span>
                </button>

                {/* By Date */}
                <button
                  type="button"
                  onClick={() => setFilter('date')}
                  title={`By Date (${countForFilter('date')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'date'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Calendar className={`w-3.5 h-3.5 shrink-0 ${filter === 'date' ? 'text-white' : 'text-rose-500'}`} />
                  <span className={filter === 'date' ? 'inline' : 'hidden md:inline'}>Date</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('date')}</span>
                </button>

                {/* All Active */}
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  title={`All Active Tasks (${countForFilter('all')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 shrink-0 ${filter === 'all' ? 'text-indigo-300 dark:text-indigo-500' : 'text-indigo-500'}`} />
                  <span className={filter === 'all' ? 'inline' : 'hidden sm:inline'}>All</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('all')}</span>
                </button>

                {/* Done */}
                <button
                  type="button"
                  onClick={() => setFilter('completed')}
                  title={`Completed Tasks (${countForFilter('completed')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${filter === 'completed' ? 'text-white' : 'text-emerald-500'}`} />
                  <span className={filter === 'completed' ? 'inline' : 'hidden sm:inline'}>Done</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('completed')}</span>
                </button>

                {/* Archived */}
                <button
                  type="button"
                  onClick={() => setFilter('archived')}
                  title={`Archived Tasks (${countForFilter('archived')})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    filter === 'archived'
                      ? 'bg-slate-700 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Archive className={`w-3.5 h-3.5 shrink-0 ${filter === 'archived' ? 'text-white dark:text-zinc-900' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span className={filter === 'archived' ? 'inline' : 'hidden sm:inline'}>Archived</span>
                  <span className="opacity-80 font-mono text-[10.5px]">{countForFilter('archived')}</span>
                </button>
              </div>

              {/* Right: Search Toggle + Progressive-Disclosure Filter Popover */}
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                {/* Search Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(prev => !prev)}
                  className={`h-7 px-2 inline-flex items-center gap-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isSearchExpanded || searchQuery
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Search tasks by title or #tag"
                >
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  {searchQuery && <span className="font-mono text-[10px]">{filteredTasks.length}</span>}
                </button>

                {/* Filter Popover Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    id="btn-task-filters-popover"
                    onClick={() => setIsFilterPopoverOpen(prev => !prev)}
                    className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      isFilterPopoverOpen || activeFilterCount > 0
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Filters & Smart Sort"
                  >
                    <Sliders className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Filter</span>
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-500 text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {isFilterPopoverOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsFilterPopoverOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-50 p-3 space-y-3 text-xs animate-view-enter">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Filters & Sort</span>
                          </span>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory('all');
                                setSelectedListId('all');
                                setSelectedPriority('all');
                                setSelectedProject('all');
                                setSelectedGoal('all');
                                setTaskTypeFilter('all');
                              }}
                              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              Reset all
                            </button>
                          )}
                        </div>

                        {/* Filter by Tag */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            Tag
                          </label>
                          <select
                            id="select-task-category-filter"
                            value={selectedCategory}
                            onChange={e => {
                              setSelectedCategory(e.target.value);
                              setSelectedListId('all');
                            }}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 font-medium cursor-pointer focus:outline-none"
                          >
                            <option value="all">All Tags</option>
                            {tags.map(t => (
                              <option key={t.id || t.name} value={t.name}>
                                {formatTagLabel(t.name)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Filter by Goal / Project */}
                        {(goals || []).length > 0 && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                              Goal / Project
                            </label>
                            <select
                              value={selectedGoal}
                              onChange={e => {
                                const val = e.target.value;
                                setSelectedGoal(val);
                                if (val === 'all') {
                                  setSelectedProject('all');
                                } else {
                                  const matched = goals.find(g => g.id === val);
                                  setSelectedProject(matched?.title || 'all');
                                }
                              }}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 font-medium cursor-pointer focus:outline-none"
                            >
                              <option value="all">All Goals</option>
                              {(goals || [])
                                .filter(g => !g.archived || g.id === selectedGoal)
                                .map(g => (
                                  <option key={g.id} value={g.id}>
                                    {g.title}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        {/* Smart Sort & Quick Utilities */}
                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                          <button
                            id="btn-task-smart-sort"
                            type="button"
                            onClick={toggleSmartSort}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>Eisenhower Smart Sort</span>
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              isSmartSort
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'
                            }`}>
                              {isSmartSort ? 'ON' : 'OFF'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsFilterPopoverOpen(false);
                              openEntitiesModal('tags');
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium transition cursor-pointer"
                          >
                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Manage Tags</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsFilterPopoverOpen(false);
                              setIsBulkSelectMode(!isBulkSelectMode);
                              if (isBulkSelectMode) setSelectedBulkIds(new Set());
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium transition cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Bulk Selection Mode</span>
                            </span>
                            {isBulkSelectMode && <span className="text-[10px] font-bold text-indigo-600">Active</span>}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expandable Search Input Row (Revealed only when toggled or when searchQuery is active) */}
            <SmoothCollapse isOpen={Boolean(isSearchExpanded || searchQuery.length > 0)}>
              <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="input-task-global-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setIsSearchExpanded(false);
                      }
                    }}
                    placeholder="Search tasks by title or #tag..."
                    className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                  />
                  {(searchQuery || isSearchExpanded) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Close search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </SmoothCollapse>
          </div>
        );
      })()}

      {/* Quiet Active Filter Context Bar if secondary filters are applied */}
      {viewMode === 'list' && (selectedCategory !== 'all' || selectedListId !== 'all' || selectedProject !== 'all' || selectedGoal !== 'all') && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">Filtered by:</span>
            {selectedCategory !== 'all' && (
              <InlineTagMeta tag={selectedCategory} appTags={tags} className="text-xs" />
            )}
            {selectedListId !== 'all' && (
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {todoLists.find(l => l.id === selectedListId)?.name || selectedListId}
              </span>
            )}
            {selectedGoal !== 'all' && (
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {goals.find(g => g.id === selectedGoal)?.title || selectedGoal}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedListId('all');
              setSelectedPriority('all');
              setSelectedProject('all');
              setSelectedGoal('all');
              setTaskTypeFilter('all');
            }}
            className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition ml-2 shrink-0 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Date Carousel Strip when By Date filter is active in Tasks list */}
      {viewMode === 'list' && filter === 'date' && (
        <div className="animate-view-enter">
          <ScrollableCompactDateStrip
            selectedDateStr={selectedTaskDate}
            onSelectDate={setSelectedTaskDate}
            storageKey="tasks_list"
            defaultFinish="clean"
            defaultShape="circle"
            defaultTheme="cobalt"
            className="my-1"
          />
        </div>
      )}

      {/* Unified One-for-All Timeline View (Clubs Spine + Structured + 24h Grid into one responsive workspace) */}
      {viewMode === 'events' && (
        <Suspense fallback={<div className="h-64 rounded-3xl bg-slate-200/50 dark:bg-slate-800/40 animate-pulse" />}>
          <PlannerPage embedded />
        </Suspense>
      )}

      {/* Tasks List View (Includes Tasks + Time-Bounded Blocks/Events) */}
      {viewMode === 'list' && (() => {
        const renderEntriesGroup = (groupEntries: UnifiedTaskListEntry[], groupKey: string) => (
          <div
            key={groupKey}
            className="animate-view-enter space-y-[3px]"
          >
            {groupEntries.map((entry, idx) => {
              const formatCompactTime12h = (tStr?: string) => {
                if (!tStr) return '';
                const [hS, mS] = tStr.split(':');
                const h = parseInt(hS, 10);
                if (isNaN(h)) return tStr;
                const period = h >= 12 ? 'pm' : 'am';
                const h12 = h % 12 === 0 ? 12 : h % 12;
                return `${h12}:${mS || '00'}${period}`;
              };

              // Petal Material 3 Expressive Grouped Containment geometry
              const petalPos = getPetalPosition(idx, groupEntries.length);
              const prevExpanded = idx > 0 && !!expandedSubtasks[groupEntries[idx - 1].id];
              const nextExpanded = idx < groupEntries.length - 1 && !!expandedSubtasks[groupEntries[idx + 1].id];
              const isExpanded = !!expandedSubtasks[entry.id];
              const groupRadiusClass = isExpanded
                ? 'rounded-[20px] my-1.5 shadow-sm ring-1 ring-indigo-500/20 dark:ring-indigo-400/20'
                : petalPos === 'SINGLE'
                ? 'rounded-[20px]'
                : petalPos === 'TOP'
                ? `rounded-t-[20px] ${nextExpanded ? 'rounded-b-[16px]' : 'rounded-b-[6px]'}`
                : petalPos === 'BOTTOM'
                ? `${prevExpanded ? 'rounded-t-[16px]' : 'rounded-t-[6px]'} rounded-b-[20px]`
                : `${prevExpanded ? 'rounded-t-[16px]' : 'rounded-t-[6px]'} ${nextExpanded ? 'rounded-b-[16px]' : 'rounded-b-[6px]'}`;

              if (entry.kind === 'event') {
                  const sched = entry.event;
                  const schedAnimKey = `sched_${sched.id}`;
                  const isCompletingSched = completingScheduleIds.has(sched.id);
                  const isFadingSched = fadingScheduleIds.has(sched.id);
                  const isVisuallyDone = Boolean(sched.completed) || isCompletingSched;
                  const rawP = (sched.priority || 'medium').toString().toUpperCase();
                  const pDisplay = rawP === 'HIGH' ? 'P1' : rawP === 'MEDIUM' ? 'P2' : rawP === 'LOW' ? 'P4' : rawP;
                  const pChipClass =
                    pDisplay === 'P1'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/70'
                      : pDisplay === 'P2'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/70'
                      : pDisplay === 'P3'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/70'
                      : 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/70';

                  const timeWindowLabel = sched.isAllDay
                    ? 'All day'
                    : sched.startTime && sched.endTime && sched.endTime !== sched.startTime
                    ? `${formatCompactTime12h(sched.startTime)}–${formatCompactTime12h(sched.endTime)}`
                    : formatCompactTime12h(sched.startTime);

                  const getEventDateLabel = () => {
                    if (!sched.date) return timeWindowLabel;
                    if (sched.date === todayStr) return timeWindowLabel ? `Today, ${timeWindowLabel}` : 'Today';
                    const [, m, d] = sched.date.split('-').map(Number);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const shortDate = `${d} ${months[(m || 1) - 1] || ''}`;
                    return timeWindowLabel ? `${shortDate}, ${timeWindowLabel}` : shortDate;
                  };

                  const eventTone = !isVisuallyDone && sched.date < todayStr
                    ? 'overdue'
                    : sched.date === todayStr
                    ? 'today'
                    : 'upcoming';

                  const hasEventAlarm = Boolean(sched.reminderType && sched.reminderType !== 'none');
                  const hasEventRepeat = Boolean(sched.repeatType && sched.repeatType !== 'none');

                  return (
                    <div
                      key={`event_${sched.id}`}
                      onClick={() => openEditEvent(sched)}
                      className={`group border relative px-3 py-1.5 sm:px-3.5 sm:py-1.5 transition-all duration-200 cursor-pointer select-none ${groupRadiusClass} ${
                        isFadingSched
                          ? 'opacity-0 translate-x-6 scale-[0.98] max-h-0 overflow-hidden py-0 my-0 border-transparent pointer-events-none'
                          : ''
                      } ${
                        isCompletingSched
                          ? 'border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/75 dark:bg-emerald-950/30'
                          : isVisuallyDone
                          ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : isExpanded
                          ? 'border-indigo-200/90 dark:border-indigo-900/70 bg-white dark:bg-slate-900'
                          : 'border-slate-200/85 dark:border-slate-800/85 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 w-full min-w-0">
                        {/* Generous 46px touch/click zone centered on 26px Priority Check Circle */}
                        <div className="relative flex items-center justify-center w-[26px] h-[26px] shrink-0">
                          {celebratingTaskId === schedAnimKey && (
                            <CheckmarkCelebration
                              activeKey={taskCelebrationKey}
                              badgeText="Done✔️"
                              ringColor="border-blue-500"
                              align="left"
                            />
                          )}
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.88 }}
                            animate={animatingTaskId === schedAnimKey ? { scale: [1, 1.2, 0.94, 1] } : {}}
                            transition={{ duration: 0.34, ease: 'easeOut' }}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleScheduleWithAnim(sched.id);
                            }}
                            className="absolute -inset-2.5 flex items-center justify-center rounded-full cursor-pointer touch-manipulation z-10 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                            title={`Time Block (${pDisplay}) — Click to toggle completion`}
                            aria-label={isVisuallyDone ? 'Mark incomplete' : 'Mark complete'}
                          >
                            <span
                              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all duration-150 ${getTaskCheckboxPriorityClass({ priority: sched.priority, completed: sched.completed }, isVisuallyDone)}`}
                            >
                              {isVisuallyDone ? (
                                <AnimatedCheckIcon
                                  className="w-3.5 h-3.5 text-white"
                                  strokeWidth={3}
                                  animate={animatingTaskId === schedAnimKey}
                                />
                              ) : null}
                            </span>
                          </motion.button>
                        </div>

                        {/* Center Zone */}
                        <div className="flex-1 min-w-0 min-h-[19px] flex flex-col justify-center">
                          <h4
                            className={`text-[14px] font-sans font-normal sm:font-medium tracking-normal leading-[19px] transition-colors duration-150 antialiased break-words w-full ${
                              !isExpanded ? 'line-clamp-2' : ''
                            } ${
                              isVisuallyDone
                                ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
                                : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                            }`}
                          >
                            <span>{sched.title}</span>
                          </h4>

                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] leading-[16px] font-sans">
                            <span
                              className={`whitespace-nowrap shrink-0 leading-[16px] tabular-nums ${
                                isVisuallyDone
                                  ? 'text-slate-400 dark:text-slate-500'
                                  : eventTone === 'overdue'
                                  ? 'text-rose-500 dark:text-rose-400 font-medium'
                                  : eventTone === 'today'
                                  ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                  : 'text-slate-500 dark:text-slate-400 font-normal'
                              }`}
                            >
                              {getEventDateLabel()}
                            </span>

                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-coral-500 text-rose-400/90 dark:text-rose-300/80 shrink-0">
                              <CalendarClock className="w-[12px] h-[12px] shrink-0" />
                              <span>Block · {pDisplay}</span>
                            </span>

                            {(hasEventAlarm || hasEventRepeat) && (
                              <span className="inline-flex items-center gap-1.5 h-[16px] shrink-0 text-slate-500 dark:text-slate-400">
                                {hasEventAlarm && <Bell className="w-[12px] h-[12px] stroke-[2.2]" />}
                                {hasEventRepeat && <Repeat className="w-[12px] h-[12px] stroke-[2.2]" />}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Far-Right Expand Chevron */}
                        <div className="shrink-0 flex items-center gap-1.5 h-[20px] self-start ml-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubtasksView(sched.id);
                            }}
                            className={`w-[20px] h-[20px] inline-flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer active:scale-95 ${
                              isExpanded
                                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <SmoothCollapse isOpen={isExpanded} onClick={e => e.stopPropagation()}>
                        <div className="pt-2.5">
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                            {sched.notes && sched.notes.trim().length > 0 && (
                              <div className="py-1.5 px-3 rounded-r-xl rounded-l-sm border-l-[3px] border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/40 dark:border-amber-800/30 text-[11.5px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
                                <span className="line-clamp-3 flex-1 min-w-0 leading-relaxed">{sched.notes}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10.5px] font-bold ${pChipClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${getTaskPriorityBarClass({ priority: sched.priority })}`} />
                                  <span>{pDisplay} · Time Block</span>
                                </span>
                                {sched.category && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 text-[10.5px] font-semibold capitalize">
                                    {sched.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditEvent(sched);
                                  }}
                                  className="h-7 px-2.5 inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteScheduleItem(sched.id);
                                  }}
                                  className="h-7 px-2.5 inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/70 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SmoothCollapse>
                    </div>
                  );
                }

                const task = entry.task;
                const qLabel = getQuadrantLabel(task.quadrant);
                const linkedSched = linkedScheduleByTaskId.get(task.id);
                const taskSubtasks = (Array.isArray(task.subtasks) && task.subtasks.length > 0)
                  ? task.subtasks
                  : (Array.isArray(task.checklist) && task.checklist.length > 0)
                  ? task.checklist
                  : [];
                const completedSubs = taskSubtasks.filter(s => s.completed).length;
                const hasChecklist = taskSubtasks.length > 0;
                const allSubsDone = hasChecklist && completedSubs === taskSubtasks.length;
                const subsProgressPct = hasChecklist ? Math.round((completedSubs / taskSubtasks.length) * 100) : 0;

                const isFading = fadingTaskIds.has(task.id);
                const isVisuallyDone = task.completed || completingTaskIds.has(task.id);
                const isTaskRunningInPiP =
                  pomodoro.taskId === task.id ||
                  (session.activeId === task.id && session.type === 'task') ||
                  (sessions && sessions.some(s => s.activeId === task.id && s.type === 'task'));

                // Priority pill styling for expanded metadata strip
                const priorityChipClass =
                  qLabel.tag === 'DO'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/70'
                    : qLabel.tag === 'PLAN'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/70'
                    : qLabel.tag === 'PASS'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/70'
                    : 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/70';

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

                // Single-time TaskItems always show From time only (never a start–end time range)
                const effectiveTimeLabel = formatCompactTime12h(
                  task.dueTime || linkedSched?.startTime
                );

                const getBottomDateTimeDisplay = (): {
                  label: string;
                  tone: 'overdue' | 'today' | 'upcoming';
                } | null => {
                  const time12 = effectiveTimeLabel;
                  if (!task.dueDate) {
                    return time12 ? { label: time12, tone: 'today' } : null;
                  }
                  if (task.dueDate === todayStr) {
                    if (task.dueTime || (linkedSched && linkedSched.startTime)) {
                      const checkTime = task.dueTime || linkedSched?.startTime || '';
                      const now = new Date();
                      const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                      const isOverdueTime = !task.completed && checkTime < nowHm;
                      return {
                        label: `Today, ${time12}`,
                        tone: isOverdueTime ? 'overdue' : 'today',
                      };
                    }
                    return { label: 'Today', tone: 'today' };
                  }
                  const [y, m, d] = task.dueDate.split('-').map(Number);
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const shortDate = `${d} ${months[(m || 1) - 1] || ''}`;
                  return {
                    label: time12 ? `${shortDate}, ${time12}` : shortDate,
                    tone: task.dueDate < todayStr ? 'overdue' : 'upcoming',
                  };
                };

                const bottomDateTime = getBottomDateTimeDisplay();
                const hasBottomMetaLine = Boolean(
                  bottomDateTime || hasAlarmSet || hasRepeatSet || hasChecklist
                );

                return (
                  <div
                    key={task.id}
                    {...getTaskItemProps(task.id, task.title)}
                    onClick={() => {
                      if (wasDraggingRef.current) return;
                      if (isBulkSelectMode) {
                        handleToggleBulkId(task.id);
                        return;
                      }
                      openDetailTask(task);
                    }}
                    className={`group border relative px-3 py-1.5 sm:px-3.5 sm:py-1.5 transition-all duration-200 cursor-pointer select-none ${groupRadiusClass} ${
                      isFading
                        ? 'opacity-0 translate-x-6 scale-[0.98] max-h-0 overflow-hidden py-0 my-0 border-transparent pointer-events-none transition-all duration-250 ease-out'
                        : ''
                    } ${
                      draggedTaskId === task.id
                        ? 'opacity-30 scale-[0.98] border-2 border-dashed border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-none'
                        : dragOverTaskId === task.id
                        ? dropPosition === 'before'
                          ? 'border-t-2 border-t-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'border-b-2 border-b-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : selectedBulkIds.has(task.id)
                        ? 'bg-indigo-50/80 dark:indigo-950/40 ring-2 ring-indigo-500/70 border-indigo-400'
                        : isTaskRunningInPiP
                        ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/50 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                        : completingTaskIds.has(task.id)
                        ? 'border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/75 dark:bg-emerald-950/30 ring-1 ring-emerald-400/35'
                        : isVisuallyDone
                        ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : recentlyCreatedTaskId === task.id
                        ? 'border-emerald-500/70 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40'
                        : isExpanded
                        ? 'border-indigo-200/90 dark:border-indigo-900/70 bg-white dark:bg-slate-900'
                        : 'border-slate-200/85 dark:border-slate-800/85 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Visual insertion indicator lines */}
                    {dragOverTaskId === task.id && dropPosition === 'before' && (
                      <div className="absolute -top-1 left-0 right-0 h-1 bg-indigo-600 rounded-full z-30 pointer-events-none shadow-sm animate-pulse" />
                    )}
                    {dragOverTaskId === task.id && dropPosition === 'after' && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-indigo-600 rounded-full z-30 pointer-events-none shadow-sm animate-pulse" />
                    )}

                    {/* Two-Line Clean Task Layout:
                        Left: Balanced 26px Check Circle (46px tap target) centered vertically across title + metadata
                        Center: [Task Title] + [Date & Time / Alarm / Repeat / Subtask Counter] */}
                    <div className="flex items-center gap-2.5 w-full min-w-0">
                      {/* Left Zone: Generous 46px tap target around uniform 26px Priority Check Circle (Tasks page only) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBulkSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedBulkIds.has(task.id)}
                            onChange={(e) => handleToggleBulkId(task.id, e as any)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}

                        <div className="relative flex items-center justify-center w-[26px] h-[26px] shrink-0">
                          {celebratingTaskId === task.id && (
                            <CheckmarkCelebration
                              activeKey={taskCelebrationKey}
                              badgeText="Done✅"
                              ringColor="border-emerald-500"
                              align="left"
                            />
                          )}
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.88 }}
                            animate={animatingTaskId === task.id ? { scale: [1, 1.2, 0.94, 1] } : {}}
                            transition={{ duration: 0.36, ease: 'easeOut' }}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskWithAnim(task.id);
                            }}
                            className="absolute -inset-2.5 flex items-center justify-center rounded-full cursor-pointer touch-manipulation z-10 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                            title={`Priority: ${qLabel.name} — Click to toggle completion`}
                            aria-label={isVisuallyDone ? 'Mark task incomplete' : 'Mark task complete'}
                          >
                            <span
                              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-all duration-150 ${getTaskCheckboxPriorityClass(task, isVisuallyDone)}`}
                            >
                              {isVisuallyDone ? (
                                <AnimatedCheckIcon
                                  className="w-3.5 h-3.5 text-white"
                                  strokeWidth={3}
                                  animate={animatingTaskId === task.id}
                                />
                              ) : null}
                            </span>
                          </motion.button>
                        </div>
                      </div>

                      {/* Center Zone: Line 1 = Clean Title | Line 2 = Separate Bottom Line for Date, Time, Symbols & Subtask Count (1/3) */}
                      <div className="flex-1 min-w-0 min-h-[19px] flex flex-col justify-center">
                        <h4
                          className={`text-[14px] font-sans font-normal sm:font-medium tracking-normal leading-[19px] transition-colors duration-150 antialiased break-words w-full ${
                            !isExpanded ? 'line-clamp-2' : ''
                          } ${
                            isVisuallyDone
                              ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
                              : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          }`}
                        >
                          <span>{task.title}</span>
                          {isTaskRunningInPiP && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 align-middle">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                              PiP
                            </span>
                          )}
                        </h4>

                        {/* Bottom Separate Line: Date, Time, Alarm Symbol, Repeat Symbol, and Subtask Number (1/3) */}
                        {hasBottomMetaLine && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] leading-[16px] font-sans">
                            {/* Date & Time */}
                            {bottomDateTime && (
                              <span
                                className={`whitespace-nowrap shrink-0 leading-[16px] ${
                                  isVisuallyDone
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : bottomDateTime.tone === 'overdue'
                                    ? 'text-rose-500 dark:text-rose-400 font-medium'
                                    : bottomDateTime.tone === 'today'
                                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                    : 'text-slate-500 dark:text-slate-400 font-normal'
                                }`}
                              >
                                {bottomDateTime.label}
                              </span>
                            )}

                            {/* Tiny Alarm / Reminder Bell & Repeat Symbols — Unified Icon Color */}
                            {(hasAlarmSet || hasRepeatSet) && (
                              <span
                                className={`inline-flex items-center gap-1.5 h-[16px] shrink-0 ${
                                  isVisuallyDone
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {hasAlarmSet && (
                                  <span
                                    className="inline-flex items-center justify-center h-[16px]"
                                    title={task.dueTime ? `Reminder / Time: ${formatCompactTime12h(task.dueTime)}` : 'Reminder active'}
                                  >
                                    <Bell
                                      className={`w-[12.5px] h-[12.5px] stroke-[2.2] shrink-0 ${
                                        isVisuallyDone
                                          ? 'text-slate-400 dark:text-slate-500'
                                          : bottomDateTime?.tone === 'overdue'
                                          ? 'text-rose-500 dark:text-rose-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    />
                                  </span>
                                )}
                                {hasRepeatSet && (
                                  <span
                                    className="inline-flex items-center justify-center h-[16px]"
                                    title={`Repeats: ${task.recurring || task.repeatType}`}
                                  >
                                    <Repeat className="w-[12.5px] h-[12.5px] stroke-[2.2] shrink-0" />
                                  </span>
                                )}
                              </span>
                            )}

                            {/* Subtask Counter (e.g., 1/3) — Unified Icon & Badge Color */}
                            {hasChecklist && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubtasksView(task.id);
                                }}
                                className={`inline-flex items-center gap-1 h-[16px] text-[11.5px] leading-[16px] font-sans transition-colors shrink-0 cursor-pointer ${
                                  isVisuallyDone
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : allSubsDone
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-normal'
                                }`}
                                title={`Subtasks: ${completedSubs}/${taskSubtasks.length} completed`}
                              >
                                <SubtaskBranchIcon className="w-[13px] h-[13px] shrink-0" />
                                <span className="tabular-nums leading-[16px]">{completedSubs}/{taskSubtasks.length}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Far-Right Zone: 1-tap Restore (when Archived) + Active Focus Timer + Clean 20x20 Expand Chevron */}
                      <div className="shrink-0 flex items-center gap-1.5 h-[20px] self-start ml-1.5">
                        {isTaskArchived(task) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleArchiveTask(task);
                            }}
                            className="h-[22px] px-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 text-[10.5px] font-bold transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                            title="Restore task to active list"
                          >
                            <ArchiveRestore className="w-3 h-3 shrink-0" />
                            <span>Restore</span>
                          </button>
                        )}

                        {/* Active Focus Timer if running */}
                        {(() => {
                          const isThisTaskFocused = pomodoro.taskId === task.id;
                          const isPomRunning = isThisTaskFocused && pomodoro.isRunning;
                          if (!isPomRunning) return null;
                          const formattedFocusTimer = `${Math.floor(pomodoro.timeRemaining / 60)}:${String(pomodoro.timeRemaining % 60).padStart(2, '0')}`;
                          return (
                            <span className="h-[18px] px-1.5 inline-flex items-center gap-1 rounded-full bg-rose-500 text-white text-[9.5px] font-sans font-bold animate-pulse shadow-2xs shrink-0">
                              <Timer className="w-2.5 h-2.5 text-white" />
                              <span>{formattedFocusTimer}</span>
                            </span>
                          );
                        })()}

                        {/* Clean 20x20 Expand Chevron */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubtasksView(task.id);
                          }}
                          className={`w-[20px] h-[20px] inline-flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer active:scale-95 ${
                            isExpanded
                              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Progressive-Disclosure Details Container: Subtasks, Notes, Metadata Chips & Action Bar */}
                    <SmoothCollapse
                      isOpen={isExpanded}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="pt-2.5">
                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                          {/* Checklist / Subtasks Box + Progress Strip + Inline Quick-Add Step */}
                          <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/45 border border-slate-200/70 dark:border-slate-800/90 p-2 space-y-1">
                            {hasChecklist && (
                              <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  Checklist ({completedSubs}/{taskSubtasks.length})
                                </span>
                                <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      allSubsDone ? 'bg-emerald-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${subsProgressPct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {hasChecklist && taskSubtasks.map(sub => (
                              <button
                                type="button"
                                key={sub.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubtask(task.id, sub.id);
                                  haptics.toggle();
                                }}
                                className="w-full flex items-start gap-2 px-2 py-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-800/90 transition-colors cursor-pointer text-left group/sub"
                              >
                                <span className="h-[18px] flex items-center shrink-0">
                                  <span
                                    className={`w-[15px] h-[15px] rounded-full border-[1.75px] flex items-center justify-center transition-all shrink-0 ${
                                      sub.completed
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover/sub:border-indigo-500'
                                    }`}
                                  >
                                    {sub.completed && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                  </span>
                                </span>
                                <span
                                  className={`text-[12.5px] font-sans leading-[18px] flex-1 min-w-0 break-words transition-colors ${
                                    sub.completed
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-700 dark:text-slate-200 font-normal'
                                  }`}
                                >
                                  {sub.title}
                                </span>
                              </button>
                            ))}

                            {/* Inline Quick-Add Subtask Input */}
                            <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-dashed border-slate-200/80 dark:border-slate-700/70">
                              <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <input
                                type="text"
                                value={inlineSubtaskText[task.id] || ''}
                                onChange={e => setInlineSubtaskText(prev => ({ ...prev, [task.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddInlineSubtask(task);
                                  }
                                }}
                                placeholder="Add step or subtask..."
                                className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                              />
                              {(inlineSubtaskText[task.id] || '').trim().length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddInlineSubtask(task);
                                  }}
                                  className="px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shrink-0 cursor-pointer transition"
                                >
                                  Add
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Editorial Notes Callout (if present) */}
                          {task.notes && task.notes.trim().length > 0 && (
                            <div className="py-1.5 px-3 rounded-r-xl rounded-l-sm border-l-[3px] border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/40 dark:border-amber-800/30 text-[11.5px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
                              <span className="line-clamp-3 flex-1 min-w-0 leading-relaxed">{task.notes}</span>
                            </div>
                          )}

                          {/* Cohesive Metadata Chips Row (Priority Pill, Schedule Pill, Recurrence Pill, Tag Pills) */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            {/* Interactive Priority / Quadrant Pill */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCycleEisenhower(task);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10.5px] font-bold transition cursor-pointer active:scale-95 shrink-0 ${priorityChipClass}`}
                              title={`Eisenhower Matrix: ${qLabel.name} (Tap to cycle priority)`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${getTaskPriorityBarClass(task)}`} />
                              <span>{qLabel.tag}</span>
                              <span className="opacity-75 font-medium">
                                · {qLabel.tag === 'DO' ? 'Urgent' : qLabel.tag === 'PLAN' ? 'Important' : qLabel.tag === 'PASS' ? 'Delegate' : 'Low'}
                              </span>
                            </button>

                            {/* Due Date & Time Pill */}
                            {task.dueDate && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-semibold shrink-0 ${
                                  !task.completed && task.dueDate < todayStr
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/70'
                                    : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/70'
                                }`}
                              >
                                <Calendar className="w-3 h-3 shrink-0 opacity-80" />
                                <span>
                                  {formatOSDate(task.dueDate, 'DDMonthYYYY')}
                                  {task.dueTime ? `, ${task.dueTime}` : ''}
                                </span>
                              </span>
                            )}

                            {/* Recurring Pill */}
                            {task.recurring && task.recurring !== 'none' && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 text-[10.5px] font-semibold shrink-0"
                                title={`Repeats: ${task.recurring}`}
                              >
                                <Repeat className="w-3 h-3 stroke-[2.2]" />
                                <span className="capitalize">{task.recurring}</span>
                              </span>
                            )}

                            {/* Material 3 Expressive Interactive Tag Chips */}
                            {task.tags && task.tags.length > 0 && task.tags.map(t => {
                              const cleanT = cleanTagName(t);
                              const isActiveTagFilter = cleanTagName(searchQuery).toLowerCase() === cleanT.toLowerCase();
                              return (
                                <InteractiveTagButton
                                  key={t}
                                  tag={t}
                                  selected={isActiveTagFilter}
                                  appTags={tags}
                                  variant="card"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery(prev =>
                                      cleanTagName(prev).toLowerCase() === cleanT.toLowerCase() ? '' : `#${cleanT}`
                                    );
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* Structured Bottom Action Bar (Left: Self-Contained Goal Selector Pill | Right: Edit, Calendar, Focus) */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                            {/* Left: Clean Self-Contained Goal Pill (no stray external chevron) */}
                            <div
                              onClick={e => e.stopPropagation()}
                              className="relative inline-flex items-center h-7 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 transition min-w-0 max-w-[165px] sm:max-w-[200px]"
                            >
                              <Target className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2.5 pointer-events-none" />
                              <select
                                value={task.goalId || task.projectId || ''}
                                onChange={e => {
                                  e.stopPropagation();
                                  const val = e.target.value;
                                  if (val) {
                                    const matchedGoal = goals.find(g => g.id === val);
                                    updateTask({
                                      ...task,
                                      goalId: val,
                                      projectId: val,
                                      project: matchedGoal?.title || 'General',
                                    });
                                  } else {
                                    updateTask({
                                      ...task,
                                      goalId: undefined,
                                      projectId: undefined,
                                      project: 'General',
                                    });
                                  }
                                  soundEngine?.playClick?.();
                                }}
                                className="w-full appearance-none bg-transparent pl-1.5 pr-6 h-full text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer truncate focus:outline-none"
                                title="Link task to a Goal"
                              >
                                <option value="" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">Goal: None</option>
                                {goals
                                  .filter(g => !g.archived || g.id === task.goalId || g.id === task.projectId)
                                  .map(g => (
                                    <option key={g.id} value={g.id} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                                      {g.title}
                                    </option>
                                  ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
                            </div>

                            {/* Right: Cohesive Quick Action Controls */}
                            <div className="shrink-0 flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleArchiveTask(task);
                                }}
                                className={`h-7 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap shrink-0 ${
                                  isTaskArchived(task)
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
                                }`}
                                title={isTaskArchived(task) ? 'Restore Task' : 'Archive Task'}
                              >
                                {isTaskArchived(task) ? (
                                  <ArchiveRestore className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Archive className="w-3 h-3 shrink-0" />
                                )}
                                <span>{isTaskArchived(task) ? 'Restore' : 'Archive'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTask(task);
                                }}
                                className="h-7 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-[11px] font-semibold transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap shrink-0"
                                title="Edit Task"
                              >
                                <Pencil className="w-3 h-3 shrink-0" />
                                <span>Edit</span>
                              </button>

                              <CardCalendarButton
                                className="h-7 px-2.5 rounded-xl text-[11px]"
                                item={{
                                  id: task.id,
                                  title: task.title,
                                  type: 'task',
                                  dueDate: task.dueDate,
                                  dueTime: task.dueTime,
                                  isAllDay: task.isAllDay,
                                  repeatType: task.repeatType || task.recurring,
                                  repeatUntil: task.repeatUntil,
                                  reminderType: task.reminderType || (task.dueDate ? 'notification' : 'none'),
                                  reminderTiming: task.reminderTiming,
                                }}
                              />

                              {(() => {
                                const isThisTaskFocused = pomodoro.taskId === task.id;
                                const isPomRunning = isThisTaskFocused && pomodoro.isRunning;
                                const formattedFocusTimer = isThisTaskFocused
                                  ? `${Math.floor(pomodoro.timeRemaining / 60)}:${String(pomodoro.timeRemaining % 60).padStart(2, '0')}`
                                  : null;

                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isThisTaskFocused) {
                                        if (pomodoro.isRunning) {
                                          pausePomodoro();
                                          soundEngine?.playClick?.();
                                          pushNotification('Focus Paused', `Paused focus timer for "${task.title}".`, 'task');
                                        } else {
                                          startPomodoro(task.id);
                                          soundEngine?.playSuccessChime?.();
                                          pushNotification('Focus Resumed', `Resumed focus timer for "${task.title}".`, 'task');
                                        }
                                      } else {
                                        startPomodoro(task.id, 25);
                                        soundEngine?.playSuccessChime?.();
                                        pushNotification('Focus Started', `Started 25m focus timer for "${task.title}".`, 'task');
                                      }
                                    }}
                                    className={`h-7 px-2.5 inline-flex items-center justify-center rounded-xl transition cursor-pointer shrink-0 active:scale-95 shadow-2xs text-[11px] font-semibold ${
                                      isPomRunning
                                        ? 'gap-1 bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-mono font-bold'
                                        : isThisTaskFocused && pomodoro.timeRemaining > 0
                                        ? 'gap-1 bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-mono font-bold'
                                        : 'gap-1 bg-indigo-50/90 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80'
                                    }`}
                                    title={
                                      isPomRunning
                                        ? `Focus Clock Active: ${formattedFocusTimer} (click to pause)`
                                        : isThisTaskFocused
                                        ? `Focus Clock Paused: ${formattedFocusTimer} (click to resume)`
                                        : 'Start 25m Focus Clock'
                                    }
                                  >
                                    <Timer className={`w-3 h-3 shrink-0 ${isPomRunning ? 'animate-pulse text-white' : ''}`} />
                                    <span>{isThisTaskFocused ? formattedFocusTimer : 'Focus'}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </SmoothCollapse>
                  </div>
                );
              })}
            </div>
          );

        const isTodayEmpty = displayedListEntries.length === 0 && (filter !== 'today' || overdueListEntries.length === 0);

        return (
          <div className="space-y-3">
            {isTodayEmpty ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 bg-white dark:bg-slate-900">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {searchQuery
                    ? `No tasks or time blocks found matching "${searchQuery}".`
                    : filter === 'overdue'
                    ? 'Zero overdue tasks — you are all caught up!'
                    : 'No tasks or time blocks found matching this filter.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/50 dark:border-indigo-800/50 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Search</span>
                  </button>
                )}
              </div>
            ) : filter === 'today' ? (
              <div className="space-y-3">
                {/* 1. Separate, Collapsible Overdue Section with 1-Click Reschedule (TickTick / Todoist standard) */}
                {overdueListEntries.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-900/60">
                      <button
                        type="button"
                        onClick={toggleOverdueSection}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer select-none"
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOverdueSectionOpen ? 'rotate-90' : ''}`}
                        />
                        <OverdueIcon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Overdue</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold leading-none">
                          {overdueListEntries.length}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10.5px] font-semibold text-rose-600/80 dark:text-rose-400/80 mr-0.5 hidden sm:inline">
                          Reschedule all:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBulkRescheduleOverdue('today')}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/70 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                          title="Move all overdue items to Today"
                        >
                          → Today
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkRescheduleOverdue('tomorrow')}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-800 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-zinc-700 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                          title="Postpone all overdue items to Tomorrow"
                        >
                          Tomorrow
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkRescheduleOverdue('next_week')}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-800 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-zinc-700 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                          title="Move all overdue items to Next Week"
                        >
                          +7d
                        </button>
                      </div>
                    </div>

                    <SmoothCollapse isOpen={isOverdueSectionOpen}>
                      {renderEntriesGroup(overdueListEntries, `overdue-in-today-${todayStr}`)}
                    </SmoothCollapse>
                  </div>
                )}

                {/* 2. Today Section (Strictly Today's Tasks & Time Blocks) */}
                <div className="space-y-1.5">
                  {overdueListEntries.length > 0 && (
                    <div className="flex items-center justify-between px-2 pt-0.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Today</span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          · {todayDisplayHeader}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {displayedListEntries.length}
                      </span>
                    </div>
                  )}

                  {displayedListEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-5 py-6 text-center bg-white/80 dark:bg-slate-900/70">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Nothing else scheduled for today.
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Use <span className="font-semibold text-rose-600 dark:text-rose-400">→ Today</span> above to pull overdue items into today’s plan, or tap + to add a task.
                      </p>
                    </div>
                  ) : (
                    renderEntriesGroup(displayedListEntries, `detailed-today-${todayStr}`)
                  )}
                </div>
              </div>
            ) : filter === 'overdue' ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-rose-50/90 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-900/60">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <OverdueIcon className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{displayedListEntries.length} Overdue {displayedListEntries.length === 1 ? 'Item' : 'Items'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleBulkRescheduleOverdue('today')}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition cursor-pointer active:scale-95"
                    >
                      Move all to Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkRescheduleOverdue('tomorrow')}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkRescheduleOverdue('next_week')}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold transition cursor-pointer active:scale-95"
                    >
                      Next Week
                    </button>
                  </div>
                </div>
                {renderEntriesGroup(displayedListEntries, `detailed-overdue-${todayStr}`)}
              </div>
            ) : (
              renderEntriesGroup(displayedListEntries, `detailed-${filter}-${selectedTaskDate}`)
            )}

          {/* Google Tasks / TickTick Collapsible Completed Tasks & Blocks Drawer */}
          {filter !== 'completed' && filter !== 'archived' && (completedTasks.length + completedScheduleItems.length) > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
              <button
                type="button"
                id="btn-toggle-completed-tasks"
                onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer select-none"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isCompletedSectionOpen ? 'rotate-90 text-emerald-500' : ''}`} />
                  <span>Completed ({completedTasks.length + completedScheduleItems.length})</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {isCompletedSectionOpen ? 'Hide' : 'Show'}
                </span>
              </button>

              <SmoothCollapse isOpen={isCompletedSectionOpen}>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 divide-y divide-slate-100 dark:divide-slate-800/70 overflow-hidden">
                  {completedTasks.map(cTask => (
                    <div
                      key={cTask.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-white dark:hover:bg-slate-800/70 transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                          <button
                            type="button"
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={() => toggleTask(cTask.id)}
                            title="Click to restore task"
                            aria-label="Mark task incomplete"
                            className="absolute -inset-2.5 flex items-center justify-center rounded-full cursor-pointer touch-manipulation z-10 hover:bg-emerald-500/12 active:scale-90 transition"
                          >
                            <span className="w-6 h-6 rounded-full bg-emerald-500/90 border border-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          </button>
                        </div>

                        <span
                          onClick={() => openDetailTask(cTask)}
                          className="text-xs line-through text-slate-400 dark:text-slate-500 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition flex-1"
                          title={cTask.title}
                        >
                          {cTask.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleArchiveTask(cTask)}
                          className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition cursor-pointer"
                          title="Archive task"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(cTask.id)}
                          className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {completedScheduleItems.map(cSched => (
                    <div
                      key={`comp_sched_${cSched.id}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-white dark:hover:bg-slate-800/70 transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                          <button
                            type="button"
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={() => toggleScheduleItem(cSched.id)}
                            title="Click to restore time block"
                            aria-label="Mark time block incomplete"
                            className="absolute -inset-2.5 flex items-center justify-center rounded-full cursor-pointer touch-manipulation z-10 hover:bg-emerald-500/12 active:scale-90 transition"
                          >
                            <span className="w-6 h-6 rounded-full bg-emerald-500/90 border border-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          </button>
                        </div>

                        <span
                          onClick={() => openEditEvent(cSched)}
                          className="text-xs line-through text-slate-400 dark:text-slate-500 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition flex-1"
                          title={`${cSched.title} (${cSched.startTime}–${cSched.endTime})`}
                        >
                          {cSched.title}
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                          {cSched.startTime}–{cSched.endTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => deleteScheduleItem(cSched.id)}
                          className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Delete time block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SmoothCollapse>
            </div>
          )}
          </div>
        );
      })()}

      {/* Eisenhower Priority Matrix (2x2 Grid & Board) */}
      {viewMode === 'matrix' && (
        <Suspense fallback={<div className="h-48 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 animate-pulse" />}>
          <EisenhowerGoogleBoard
            tasks={tasks}
            onToggleTask={toggleTask}
            onToggleStar={toggleStarTask}
            onOpenEditTask={openEditTask}
            onOpenDetailTask={openDetailTask}
            onAddTask={quad => {
              openAddTask(undefined, quad);
            }}
            onUpdateTaskQuadrant={(taskId, quad) => setTaskQuadrant(taskId, quad)}
            matchesFilterTab={matchesFilterTab}
            onToggleSubtask={toggleSubtask}
            onCycleEisenhower={handleCycleEisenhower}
            onFilterCategory={catId => setSelectedCategory(prev => prev === catId ? 'all' : catId)}
            onFilterTag={tag => setSelectedTag(prev => prev === tag ? 'all' : tag)}
            onFilterProject={proj => setSelectedProject(prev => prev === proj ? 'all' : proj)}
            dndProps={dnd}
            filter={filter}
            onFilterChange={setFilter}
            selectedTaskDate={selectedTaskDate}
            onSelectTaskDate={setSelectedTaskDate}
            todayCount={countForFilter('today')}
            overdueCount={countForFilter('overdue')}
            upcomingCount={countForFilter('upcoming')}
            allCount={countForFilter('all')}
            dateCount={countForFilter('date')}
            completedCount={countForFilter('completed')}
            archivedCount={countForFilter('archived')}
          />
        </Suspense>
      )}

      {/* Reports & Velocity Analytics View */}
      {viewMode === 'reports' && (
        <Suspense fallback={<div className="h-48 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 animate-pulse" />}>
          <TaskReportSection tasks={tasks} taskTimers={taskTimers} />
        </Suspense>
      )}

      {/* Lazy-Loaded Task Modals */}
      <Suspense fallback={null}>
        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setTaskToEdit(null);
            setEventToEdit(null);
            if (filter === 'completed' || filter === 'archived') {
              setFilter('today');
            }
            if (searchQuery) {
              setSearchQuery('');
            }
            if (taskTypeFilter !== 'all') {
              setTaskTypeFilter('all');
            }
          }}
          taskToEdit={taskToEdit}
          eventToEdit={eventToEdit}
          initialMode={taskModalInitialMode}
          defaultDate={viewMode === 'events' ? selectedDate : (filter === 'date' ? selectedTaskDate : todayStr)}
          defaultStatus={taskModalDefaultStatus}
          defaultQuadrant={taskModalDefaultQuadrant}
          defaultCategory={selectedCategory !== 'all' ? selectedCategory : 'work'}
          defaultPriority={selectedPriority !== 'all' ? selectedPriority : undefined}
          defaultProjectId={quickProjectId || (selectedProject !== 'all' ? projects.find(p => p.name === selectedProject)?.id : undefined)}
          defaultProject={quickProjectId ? projects.find(p => p.id === quickProjectId)?.name : (selectedProject !== 'all' ? selectedProject : undefined)}
          defaultGoalId={quickGoalId || (selectedGoal !== 'all' ? selectedGoal : undefined)}
          defaultListId={selectedListId && !selectedListId.startsWith('smart-') && selectedListId !== 'all' ? selectedListId : quickListId || 'list_inbox'}
          onSwitchToEvent={() => setTaskModalInitialMode('event')}
          onSwitchToHabit={() => { setIsTaskModalOpen(false); setUniversalModalType('habit'); }}
          onSwitchToGoal={() => { setIsTaskModalOpen(false); setUniversalModalType('goal'); }}
          onSwitchToMed={() => { setIsTaskModalOpen(false); setUniversalModalType('medication'); }}
          onSwitchToBill={() => { setIsTaskModalOpen(false); setUniversalModalType('bill'); }}
        />

        {universalModalType && (
          <ActivityManager
            isOpen={Boolean(universalModalType)}
            onClose={() => setUniversalModalType(null)}
            type={universalModalType}
          />
        )}

        <TaskDetailModal
          task={detailTask ? tasks.find(t => t.id === detailTask.id) || detailTask : null}
          isOpen={isDetailModalOpen}
          onClose={() => {
            stopPomodoro(detailTask?.id);
            setIsDetailModalOpen(false);
            setDetailTask(null);
          }}
          onEdit={task => {
            setIsDetailModalOpen(false);
            openEditTask(task);
          }}
          onDelete={taskId => {
            deleteTask(taskId);
            setIsDetailModalOpen(false);
            setDetailTask(null);
          }}
          onToggleComplete={taskId => toggleTask(taskId)}
          onToggleStar={taskId => toggleStarTask(taskId)}
          onUpdateTask={updated => updateTask(updated)}
          onStartPomodoro={taskId => startPomodoro(taskId)}
          onPausePomodoro={() => pausePomodoro()}
          isPomodoroRunning={pomodoro.isRunning}
          activePomodoroTaskId={pomodoro.taskId}
          soundEngine={soundEngine}
        />

        {isBatchModalOpen && (
          <QuickAddBatchModal
            isOpen={isBatchModalOpen}
            onClose={() => setIsBatchModalOpen(false)}
            defaultCategory={selectedCategory !== 'all' ? selectedCategory : 'work'}
            defaultPriority={selectedPriority !== 'all' ? selectedPriority : 'medium'}
            defaultListId={selectedListId !== 'all' ? selectedListId : 'inbox'}
          />
        )}

        {isExportImportModalOpen && (
          <TaskExportImportModal
            isOpen={isExportImportModalOpen}
            onClose={() => setIsExportImportModalOpen(false)}
          />
        )}

        {conflictData && (
          <TaskConflictModal
            isOpen={Boolean(conflictData)}
            localTask={conflictData.local}
            serverTask={conflictData.server}
            onResolve={chosen => {
              setTaskToEdit(chosen);
              setConflictData(null);
              setTaskModalDefaultStatus(undefined);
              setTaskModalDefaultQuadrant(undefined);
              setIsTaskModalOpen(true);
            }}
            onClose={() => setConflictData(null)}
          />
        )}
      </Suspense>

      {/* Bulk Selection Floating Action Bar */}
      {isBulkSelectMode && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-24px)] overflow-x-auto scrollbar-none bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>{selectedBulkIds.size} selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700 shrink-0" />
          <button
            type="button"
            onClick={handleToggleBulkSelectAll}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {selectedBulkIds.size === filteredTasks.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            type="button"
            disabled={selectedBulkIds.size === 0}
            onClick={handleConfirmBulkArchive}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              selectedBulkIds.size > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {filter === 'archived' ? (
              <ArchiveRestore className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Archive className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{filter === 'archived' ? 'Restore' : 'Archive'} ({selectedBulkIds.size})</span>
          </button>
          <button
            type="button"
            disabled={selectedBulkIds.size === 0}
            onClick={() => setShowBulkDeleteModal(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              selectedBulkIds.size > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Delete ({selectedBulkIds.size})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsBulkSelectMode(false);
              setSelectedBulkIds(new Set());
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
            title="Exit Bulk Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete {selectedBulkIds.size} tasks?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This action is permanent and cannot be undone. All selected tasks and their subtasks will be removed.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Task(s) Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveTarget)}
        itemName={pendingArchiveTarget?.kind === 'single' ? pendingArchiveTarget.task.title : undefined}
        itemType={pendingArchiveTarget?.kind === 'bulk' ? 'Tasks' : 'Task'}
        count={pendingArchiveTarget?.kind === 'bulk' ? pendingArchiveTarget.count : undefined}
        onConfirm={() => {
          if (pendingArchiveTarget?.kind === 'single') {
            executeToggleArchiveTask(pendingArchiveTarget.task);
          } else if (pendingArchiveTarget?.kind === 'bulk') {
            executeBulkArchive();
          }
          setPendingArchiveTarget(null);
        }}
        onCancel={() => setPendingArchiveTarget(null)}
      />
    </div>
  );
};
