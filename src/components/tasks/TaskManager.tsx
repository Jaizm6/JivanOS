import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Sun,
  CalendarDays,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { Priority, TaskItem, TaskStatus, EisenhowerQuadrant, DEFAULT_TASK_CATEGORIES, TaskCategory } from '../../types';
import { compareTasksByDoPlanPassSkip, sortTasksByDoPlanPassSkip, getQuadrantLabel } from '../../utils/taskSorter';
import { TaskReportSection } from './TaskReportSection';
import { TaskFormModal } from './TaskFormModal';
import { ActivityManager } from '../common/ActivityManager';
import { TaskDetailModal } from './TaskDetailModal';
import { WorkflowCustomizerModal } from './WorkflowCustomizerModal';
import { KanbanGoogleBoard } from './KanbanGoogleBoard';
import { UniformTaskCard } from './UniformTaskCard';
import { EisenhowerGoogleBoard } from './EisenhowerGoogleBoard';
import { QuoteBanner } from '../common/QuoteBanner';
import { OverdueIcon } from '../common/OverdueIcon';
import { useTaskDragAndDrop, TouchDragGhost } from '../../hooks/useTaskDragAndDrop';
import { formatOSDate, formatLocalDate } from '../../utils/date';
import { getEisenhowerMeta } from '../../utils/eisenhower';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { QuickAddBatchModal } from './QuickAddBatchModal';
import { TaskExportImportModal } from './TaskExportImportModal';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';
import { diagnoseTaskSync } from '../../utils/TaskSyncDiagnostics';
import { getTaskFromFirestore } from '../../utils/TaskSyncDiagnostics';
import { TaskSyncDiagnosticPanel } from './TaskSyncDiagnosticPanel';
import { TaskConflictModal } from './TaskConflictModal';
import { motion } from 'framer-motion';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';
import {
  getFontInlineStyle,
  getFontSizeClass,
  getFontTypeClass,
  isWhiteColor,
  isBlackColor,
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
}> = ({
  title,
  isVisuallyDone,
  fontInlineStyle,
  fontSizeClass = 'text-[13.8px] sm:text-[14.8px]',
  fontTypeClass = '',
  fontColor,
  isTaskRunningInPiP,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflowDistance(diff > 4 ? diff : 0);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [title]);

  const duration = Math.max(4, overflowDistance / 18);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 overflow-hidden relative select-none group antialiased"
      title={title}
    >
      <div
        ref={textRef}
        className={`inline-flex items-center whitespace-nowrap ${
          overflowDistance > 0 ? 'animate-task-marquee' : ''
        }`}
        style={
          overflowDistance > 0
            ? ({
                '--marquee-distance': `-${overflowDistance}px`,
                '--marquee-duration': `${duration * 2 + 4}s`,
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility',
              } as React.CSSProperties)
            : ({
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility',
              } as React.CSSProperties)
        }
      >
        <span
          className={`${fontSizeClass} ${fontTypeClass} font-semibold transition antialiased ${
            isVisuallyDone
              ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
              : fontColor ? '' : 'text-slate-900 dark:text-white'
          }`}
          style={{
            ...fontInlineStyle,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility',
          }}
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
};

export const TaskManager: React.FC = () => {
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
  } = useApp();
  const { session, sessions } = useActiveSession();

  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'matrix' | 'reports'>('list');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [taskCelebrationKey, setTaskCelebrationKey] = useState<number>(0);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
  const [fadingTaskIds, setFadingTaskIds] = useState<Set<string>>(new Set());
  const activeAnimTimeoutsRef = useRef<Record<string, NodeJS.Timeout[]>>({});

  useEffect(() => {
    (window as any).runTaskSyncDiagnostics = () => diagnoseTaskSync(tasks);
  }, [tasks]);

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
      setAnimatingTaskId(prev => prev === taskId ? null : prev);
      setCelebratingTaskId(prev => prev === taskId ? null : prev);
      toggleTask(taskId);
      haptics.toggle();
      return;
    }

    // Clear any previous timers for this task
    if (activeAnimTimeoutsRef.current[taskId]) {
      activeAnimTimeoutsRef.current[taskId].forEach(t => clearTimeout(t));
      delete activeAnimTimeoutsRef.current[taskId];
    }

    // Completing task:
    // 1. Play signature single water drip notification sound (<1s) & haptic feedback
    try {
      soundEngine.playWaterDripNotification();
      haptics.complete();
    } catch {}

    // 2. STEP 1: Checkmark ticks FIRST! (Turns emerald green & draws SVG checkmark stroke)
    setAnimatingTaskId(taskId);
    setCompletingTaskIds(prev => new Set(prev).add(taskId));

    const timeouts: NodeJS.Timeout[] = [];

    // 3. STEP 2: ONLY after checkmark stroke completes (240ms), trigger Done✅ celebration badge!
    timeouts.push(
      setTimeout(() => {
        setCelebratingTaskId(taskId);
        setTaskCelebrationKey(prev => prev + 1);
      }, 240)
    );

    // 4. STEP 3: Keep the task rock-solid in place so the user clearly sees both tick & Done animation, then begin smooth slide out (950ms)
    timeouts.push(
      setTimeout(() => {
        setFadingTaskIds(prev => new Set(prev).add(taskId));
      }, 950)
    );

    // 5. STEP 4: After slide-out transition completes (1350ms), commit completion to global state and clean up
    timeouts.push(
      setTimeout(() => {
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
        setAnimatingTaskId(prev => prev === taskId ? null : prev);
        setCelebratingTaskId(prev => prev === taskId ? null : prev);
        delete activeAnimTimeoutsRef.current[taskId];
      }, 1350)
    );

    activeAnimTimeoutsRef.current[taskId] = timeouts;
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
  const [listDensity, setListDensity] = useState<'compact' | 'expanded'>(() => {
    try {
      const saved = localStorage.getItem('omnilifeos_task_density');
      return (saved === 'compact' || saved === 'expanded') ? saved : 'expanded';
    } catch {
      return 'expanded';
    }
  });

  const changeListDensity = (d: 'compact' | 'expanded') => {
    setListDensity(d);
    try {
      localStorage.setItem('omnilifeos_task_density', d);
    } catch {
      // ignore
    }
  };

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'date'>('today');
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

  // Task Modal (Add and Edit)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [universalModalType, setUniversalModalType] = useState<'event' | 'task' | 'habit' | 'goal' | 'medication' | 'bill' | 'journal' | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [taskModalDefaultStatus, setTaskModalDefaultStatus] = useState<string | undefined>(undefined);
  const [taskModalDefaultQuadrant, setTaskModalDefaultQuadrant] = useState<EisenhowerQuadrant | undefined>(undefined);

  // Workflow Customizer Modal
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);

  // Task Detail Modal (Optimized Pop-up Card)
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDiagnosticsPanelOpen, setIsDiagnosticsPanelOpen] = useState(false);
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
    setTaskModalDefaultStatus(defaultSt);
    setTaskModalDefaultQuadrant(defaultQuad);
    setIsTaskModalOpen(true);
  };

  const openEditTask = async (task: TaskItem) => {
    const serverTask = await getTaskFromFirestore(task.id);
    if (serverTask && serverTask.updatedAt && task.updatedAt && new Date(serverTask.updatedAt) > new Date(task.updatedAt)) {
      setConflictData({ local: task, server: serverTask });
      return;
    }
    setTaskToEdit(task);
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
        if (filter === 'completed') setFilter('today');
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
        if (targetTask.completed || filter === 'completed') {
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

  const priorityOrder: Record<Priority, number> = { high: 1, medium: 2, low: 3 };

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
      text: 'text-emerald-950 dark:text-emerald-200 font-semibold', 
      bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
      badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold',
      bar: 'bg-emerald-500'
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
    if (!task) return 'bg-emerald-500';
    const q = (task.quadrant || '').toString().toLowerCase().trim();
    if (q === 'urgent_important' || q === 'urgent-important') return 'bg-rose-500';
    if (q === 'not_urgent_important' || q === 'not-urgent-important') return 'bg-amber-500';
    if (q === 'urgent_not_important' || q === 'urgent-not-important') return 'bg-blue-500';
    if (q === 'not_urgent_not_important' || q === 'not-urgent-not-important' || q === 'neither') return 'bg-emerald-500';
    const p = (task.priority || 'low').toString().toLowerCase().trim();
    if (p === 'high' || p === 'p1') return 'bg-rose-500';
    if (p === 'medium' || p === 'p2') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getTaskCheckboxPriorityClass = (task?: { priority?: string; quadrant?: string; completed?: boolean } | null, isVisuallyDone?: boolean) => {
    if (!task) return 'border-[3px] border-emerald-500 dark:border-emerald-400';
    const isDone = isVisuallyDone || task.completed;
    const q = (task.quadrant || '').toString().toLowerCase().trim();

    if (q === 'urgent_important' || q === 'urgent-important') {
      return isDone
        ? 'bg-rose-500 border-[3px] border-rose-500 text-white shadow-2xs'
        : 'border-[3px] border-rose-500 dark:border-rose-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (q === 'not_urgent_important' || q === 'not-urgent-important') {
      return isDone
        ? 'bg-amber-500 border-[3px] border-amber-500 text-white shadow-2xs'
        : 'border-[3px] border-amber-500 dark:border-amber-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (q === 'urgent_not_important' || q === 'urgent-not-important') {
      return isDone
        ? 'bg-blue-500 border-[3px] border-blue-500 text-white shadow-2xs'
        : 'border-[3px] border-blue-500 dark:border-blue-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (q === 'not_urgent_not_important' || q === 'not-urgent-not-important' || q === 'neither') {
      return isDone
        ? 'bg-emerald-500 border-[3px] border-emerald-500 text-white shadow-2xs'
        : 'border-[3px] border-emerald-500 dark:border-emerald-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    const p = (task.priority || 'low').toString().toLowerCase().trim();
    if (p === 'high' || p === 'p1') {
      return isDone
        ? 'bg-rose-500 border-[3px] border-rose-500 text-white shadow-2xs'
        : 'border-[3px] border-rose-500 dark:border-rose-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (p === 'medium' || p === 'p2') {
      return isDone
        ? 'bg-amber-500 border-[3px] border-amber-500 text-white shadow-2xs'
        : 'border-[3px] border-amber-500 dark:border-amber-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    return isDone
      ? 'bg-emerald-500 border-[3px] border-emerald-500 text-white shadow-2xs'
      : 'border-[3px] border-emerald-500 dark:border-emerald-400 bg-white dark:bg-slate-800 hover:scale-105';
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
      const tagMatch = task.tags?.includes(selectedCategory);
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
  const matchesFilterTab = (task: TaskItem, options?: { forKanbanColId?: TaskStatus }) => {
    // If task was just created, ALWAYS keep it visible so user immediately sees their created task!
    if (recentlyCreatedTaskId === task.id) return true;

    if (!matchesPriorityAndProject(task)) return false;

    if (selectedStageFilter !== 'all' && !options?.forKanbanColId) {
      const taskStage = task.status || (task.completed ? 'done' : 'todo');
      if (taskStage !== selectedStageFilter) return false;
    }

    // If currently playing completion animation, keep task in active list until fade-out finishes
    const isCompletingNow = completingTaskIds.has(task.id);
    const isTaskCompleted = (task.completed || task.status === 'done') && !isCompletingNow;

    // 1. Archive tab: only show completed / archived tasks
    if (filter === 'completed') {
      return (task.completed || task.status === 'done') && !isCompletingNow;
    }

    // 2. Today tab
    if (filter === 'today') {
      if (options?.forKanbanColId === 'done') {
        return (
          isTaskCompleted &&
          ((task.completedAt && (task.completedAt.startsWith(todayStr) || formatLocalDate(new Date(task.completedAt)) === todayStr)) || task.dueDate === todayStr)
        );
      }
      const isCreatedToday = task.createdAt
        ? (task.createdAt.startsWith(todayStr) || formatLocalDate(new Date(task.createdAt)) === todayStr)
        : false;
      return (
        !isTaskCompleted &&
        (!task.dueDate || task.dueDate <= todayStr || isCreatedToday)
      );
    }

    // 3. Upcoming tab
    if (filter === 'upcoming') {
      if (options?.forKanbanColId === 'done') {
        return false;
      }
      return !isTaskCompleted && task.dueDate > todayStr;
    }

    // 4. Specific Date tab ('date')
    if (filter === 'date') {
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

  // Helper to calculate counts for filter buttons respecting current priority, project, category, goal & custom list filters
  const countForFilter = (tab: 'today' | 'upcoming' | 'all' | 'completed' | 'date') => {
    return tasks.filter(t => {
      if (!matchesSearch(t)) return false;
      if (selectedCategory !== 'all') {
        const tagMatch = t.tags?.includes(selectedCategory);
        const catMatch = (t.category || t.project || 'personal').toLowerCase() === selectedCategory.toLowerCase();
        if (!tagMatch && !catMatch) return false;
      }
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;
      if (selectedProject !== 'all' && t.project !== selectedProject) return false;
      if (selectedGoal !== 'all' && t.goalId !== selectedGoal) return false;
      if (selectedStageFilter !== 'all') {
        const taskStage = t.status || (t.completed ? 'done' : 'todo');
        if (taskStage !== selectedStageFilter) return false;
      }
      if (!matchesListAndTags(t)) return false;
      const isDone = t.completed || t.status === 'done';
      if (tab === 'completed') return isDone;
      const isCreatedToday = t.createdAt
        ? (t.createdAt.startsWith(todayStr) || formatLocalDate(new Date(t.createdAt)) === todayStr)
        : false;
      if (tab === 'today') return !isDone && (!t.dueDate || t.dueDate <= todayStr || isCreatedToday);
      if (tab === 'upcoming') return !isDone && !!t.dueDate && t.dueDate > todayStr;
      if (tab === 'date') return !isDone && t.dueDate === selectedTaskDate;
      return !isDone;
    }).length;
  };

  // Count active tasks for a specific list or smart list
  const countForList = (listId: string) => {
    return tasks.filter(t => {
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
    if (filter === 'completed') setFilter('today');
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
    if (filter === 'completed') setFilter('today');
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

  // Completed tasks matching current context filters (memoized)
  const completedTasks = useMemo(() => {
    return tasks
      .filter(t => (t.completed || t.status === 'done') && matchesPriorityAndProject(t))
      .sort((a, b) => ((b.completedAt || b.dueDate) || '').localeCompare((a.completedAt || a.dueDate) || ''));
  }, [tasks, selectedCategory, selectedPriority, selectedGoal, selectedProject, searchQuery, selectedTag, selectedListId]);

  return (
    <div className={`w-full min-w-0 max-w-full ${viewMode === 'matrix' ? 'h-[calc(100dvh-155px-env(safe-area-inset-bottom,0px))] sm:h-[calc(100vh-80px)] flex flex-col overflow-hidden space-y-1' : 'space-y-2.5 sm:space-y-3 pb-4'}`}>
      {/* Tasks Title Bar - Always at top with View Modes Switcher */}
      <div className="p-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap md:flex-nowrap items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20 shrink-0">
        {/* Left: Task Manager icon + title + active count badge */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <CheckSquare className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Task Manager
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                {countForFilter('all')} active
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Organize, prioritize, and complete tasks
            </p>
          </div>
        </div>

        {/* Center: View Modes Switcher (List | Eisenhower | Reports) - Responsive on desktop & mobile */}
        <div className="order-3 md:order-none w-full md:w-auto flex justify-center shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs shrink-0 gap-0.5 w-full sm:w-auto justify-center shadow-2xs border border-slate-200/50 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1 sm:py-0.5 px-2.5 sm:px-3 rounded-md font-semibold text-xs transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5 shrink-0" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              title="Eisenhower Priority Matrix"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1 sm:py-0.5 px-2.5 sm:px-3 rounded-md font-semibold text-xs transition cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <EisenhowerIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Eisenhower</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reports')}
              title="Task Analytics & Velocity Reports"
              className={`flex-1 sm:flex-initial flex items-center justify-center p-1.5 sm:py-1 sm:px-2.5 rounded-md font-semibold text-xs transition cursor-pointer ${
                viewMode === 'reports'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Right: Actions (Bulk Select, Tags Hub, + Choice Menu) */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0 ml-auto md:ml-0">

          <button
            type="button"
            onClick={() => {
              setIsBulkSelectMode(!isBulkSelectMode);
              if (isBulkSelectMode) setSelectedBulkIds(new Set());
            }}
            className={`p-1.5 sm:p-2 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center justify-center ${
              isBulkSelectMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Toggle Bulk Selection Mode"
          >
            <CheckSquare className="w-4 h-4 text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={() => openEntitiesModal('tags')}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer flex items-center justify-center"
            title="Manage Tags Hub"
          >
            <Tag className="w-4 h-4 text-indigo-500" />
          </button>

          {/* Unified + Button with Add Single / Batch Choice Menu */}
          <div className="relative">
            <button
              id="btn-open-add-task"
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="p-1.5 sm:p-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center"
              title="Add Task / Batch Quick-Add"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>

            {isAddMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsAddMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 origin-top-right animate-in fade-in zoom-in-95">
                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        openAddTask();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition text-left font-bold cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-blue-500 stroke-[2.5]" />
                      <span>Add Single Task</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setIsBatchModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-left font-bold cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Batch Quick-Add</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Super Productivity Global Task Search Bar: Instant filter by title or tag */}
      {viewMode !== 'matrix' && (
        <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 sm:p-2 shadow-2xs flex items-center gap-2 transition-all">
          {/* Task Type Filter Dropdown (Compact, Left-aligned) */}
          <select
            value={taskTypeFilter}
            onChange={e => setTaskTypeFilter(e.target.value as any)}
            className="h-7 px-2 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs shrink-0 text-left focus:outline-none"
            title="Filter by Task Type"
          >
            <option value="all">Type: All</option>
            <option value="goal">Goals Only</option>
            <option value="project">Projects Only</option>
          </select>

          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              id="input-task-global-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder="Search tasks by title or #tag instantly... (e.g. #urgent, redesign, launch)"
              className="w-full pl-9.5 pr-16 sm:pr-20 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Clear search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="hidden sm:inline-flex absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 select-none">
                /
              </span>
            )}
          </div>

          {/* Dynamic Match Badge */}
          {searchQuery && (
            <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <span>{filteredTasks.length} found</span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 ml-0.5 text-xs font-bold cursor-pointer"
                title="Clear search"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}



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

      {/* Daily Wisdom Widget (Positioned under the top Tasks header) */}
      {viewMode !== 'matrix' && <QuoteBanner />}

      {/* Unified Tasks Controls, Smart Lists & Filter Panel */}
      {viewMode !== 'matrix' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 sm:px-2.5 sm:py-2 space-y-1.5 shadow-2xs w-full min-w-0 max-w-full shrink-0">
          {/* Row 1: Sleek Native Timing Filter Tabs (Tiny Logo Only + Numbers) + Stable Archive / Pending / Done Interactive Buttons (All fit in a single row without scrolling) */}
          <div className="flex items-center justify-between gap-1 min-w-0 w-full flex-nowrap">
            {/* Left Buttons: Tiny Logo Only + Numbers (Ultra-Compact, Fits Perfectly in One Row) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Today */}
              <button
                type="button"
                onClick={() => setFilter('today')}
                title={`Today (${countForFilter('today')})`}
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 h-6 sm:h-7 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  filter === 'today'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                }`}
              >
                <Sun className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${filter === 'today' ? 'text-amber-300 dark:text-amber-500' : 'text-amber-500'}`} />
                <span className="opacity-90 font-medium">({countForFilter('today')})</span>
              </button>

              {/* Upcoming */}
              <button
                type="button"
                onClick={() => setFilter('upcoming')}
                title={`Upcoming (${countForFilter('upcoming')})`}
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 h-6 sm:h-7 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  filter === 'upcoming'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                }`}
              >
                <CalendarDays className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${filter === 'upcoming' ? 'text-blue-300 dark:text-blue-500' : 'text-blue-500'}`} />
                <span className="opacity-90 font-medium">({countForFilter('upcoming')})</span>
              </button>

              {/* By Date */}
              <button
                type="button"
                onClick={() => setFilter('date')}
                title={`By Date (${countForFilter('date')})`}
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 h-6 sm:h-7 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  filter === 'date'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                }`}
              >
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="opacity-90 font-medium">({countForFilter('date')})</span>
              </button>

              {/* All Active */}
              <button
                type="button"
                onClick={() => setFilter('all')}
                title={`All Tasks (${countForFilter('all')})`}
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 h-6 sm:h-7 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                }`}
              >
                <Layers className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${filter === 'all' ? 'text-indigo-300 dark:text-indigo-500' : 'text-indigo-500'}`} />
                <span className="opacity-90 font-medium">({countForFilter('all')})</span>
              </button>
            </div>

            {/* Stable Right Section: Archive (larger icon) + P Button + D Button (Strictly right-aligned, Always in the same row) */}
            <div className="flex items-center gap-1 text-[10px] sm:text-xs shrink-0 ml-auto justify-end">
              {/* Archive Button with increased logo size */}
              <button
                type="button"
                onClick={() => setFilter('completed')}
                title={`Archive / Completed Tasks (${countForFilter('completed')})`}
                className={`inline-flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md transition-all cursor-pointer shrink-0 ${
                  filter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300'
                }`}
                aria-label="Archive"
              >
                <Archive className="w-3.5 h-3.5 shrink-0" />
              </button>

              {/* Pending Tasks Button (Renamed to P only to save space) */}
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setSelectedListId('all');
                }}
                title={`View ${countForFilter('all')} Pending Tasks`}
                className={`inline-flex items-center gap-0.5 sm:gap-1 h-6 sm:h-7 px-1.5 rounded-md text-[10px] sm:text-xs leading-none font-semibold transition-all cursor-pointer shrink-0 ${
                  filter !== 'completed'
                    ? 'bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800/50 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
                <span>{countForFilter('all')} P</span>
              </button>

              <span className="text-slate-300 dark:text-slate-600 select-none text-[8px] leading-none">·</span>

              {/* Done Tasks Button (Renamed to D only to save space) */}
              <button
                type="button"
                onClick={() => setFilter('completed')}
                title={`View ${tasks.filter(t => t.completed).length} Done / Completed Tasks`}
                className={`inline-flex items-center gap-0.5 sm:gap-1 h-6 sm:h-7 px-1.5 rounded-md text-[10px] sm:text-xs leading-none font-semibold transition-all cursor-pointer shrink-0 ${
                  filter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 shrink-0" />
                <span>{tasks.filter(t => t.completed).length} D</span>
              </button>
            </div>
          </div>

          {/* Row 2: Ultra-Compact Horizontal Filters Strip - Prioritizing space, left-aligned fonts, tiny auxiliary buttons */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 w-full min-w-0">

              {/* Tags Filter Dropdown (Shifted text to left, no emoji clutter) */}
              <select
                id="select-task-category-filter"
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setSelectedListId('all');
                }}
                className={`h-6 px-1.5 sm:px-2 rounded-md border text-[10px] sm:text-[11px] font-semibold cursor-pointer max-w-[100px] sm:max-w-[120px] truncate shrink-0 shadow-2xs transition-all focus:outline-none text-left ${
                  selectedCategory !== 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 border-slate-200/80 dark:border-slate-700/60'
                }`}
                title="Filter by Tag"
              >
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-left">Tags</option>
                {tags.map(t => (
                  <option key={t.id || t.name} value={t.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-left">
                    #{t.name}
                  </option>
                ))}
              </select>

              {/* Goals Filter Dropdown (Shifted text to left, no emoji clutter) */}
              {viewMode !== 'kanban' && (goals || []).length > 0 && (
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
                  className={`h-6 px-1.5 sm:px-2 rounded-md border text-[10px] sm:text-[11px] font-semibold cursor-pointer max-w-[110px] sm:max-w-[130px] truncate shrink-0 shadow-2xs transition-all focus:outline-none text-left ${
                    selectedGoal !== 'all' || selectedProject !== 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 border-slate-200/80 dark:border-slate-700/60'
                  }`}
                  title="Filter by Goal & Project"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-left">Goals</option>
                  {(goals || []).map(g => (
                    <option key={g.id} value={g.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-left">
                      {g.title}
                    </option>
                  ))}
                </select>
              )}

              {/* Tiny Smart Sort Button */}
              <button
                id="btn-task-smart-sort"
                type="button"
                onClick={toggleSmartSort}
                className={`h-5.5 sm:h-6 inline-flex items-center gap-1 px-1.5 text-[10px] font-semibold rounded-md border transition-all cursor-pointer shrink-0 shadow-2xs ${
                  isSmartSort
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 border-slate-200/80 dark:border-slate-700/60'
                }`}
                title="Smart Sort"
              >
                <Sparkles className={`w-2.5 h-2.5 ${isSmartSort ? 'text-amber-400 dark:text-amber-500' : 'text-amber-500'}`} />
                <span>Sort</span>
                <span className={`text-[8px] px-0.5 rounded font-bold uppercase ${
                  isSmartSort ? 'bg-amber-500/30 text-amber-300 dark:text-amber-700' : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                }`}>
                  {isSmartSort ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Tiny Diagnostic Button */}
              <button
                type="button"
                onClick={() => setIsDiagnosticsPanelOpen(true)}
                className="h-5.5 sm:h-6 inline-flex items-center gap-1 px-1.5 rounded-md text-[10px] font-semibold shrink-0 transition-all cursor-pointer bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/60"
                title="Run Sync Diagnostics"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Sync</span>
              </button>

              {/* Tiny Reset Filters Button */}
              {(selectedCategory !== 'all' || selectedListId !== 'all' || (viewMode !== 'kanban' && (selectedProject !== 'all' || selectedGoal !== 'all'))) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedListId('all');
                    setSelectedPriority('all');
                    setSelectedProject('all');
                    setSelectedGoal('all');
                  }}
                  className="h-5.5 sm:h-6 inline-flex items-center gap-0.5 px-1.5 rounded-md text-[10px] font-semibold shrink-0 transition-all cursor-pointer bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                  title="Reset all filters"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        )}

      {/* Diagnostic Panel */}
      {isDiagnosticsPanelOpen && (
        <TaskSyncDiagnosticPanel
          tasks={tasks}
          onClose={() => setIsDiagnosticsPanelOpen(false)}
        />
      )}

      {/* Active Filter Context Banner if non-default filter applied */}
      {viewMode !== 'matrix' && (filter === 'completed' || filter === 'upcoming' || selectedCategory !== 'all' || selectedListId !== 'all' || selectedProject !== 'all' || selectedGoal !== 'all') && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              Active Filter:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              {filter === 'today' ? 'Today' : filter === 'upcoming' ? 'Upcoming' : filter === 'all' ? 'All Active' : 'Archive (Completed)'}
            </span>
            {selectedCategory !== 'all' && (() => {
              const catObj = DEFAULT_TASK_CATEGORIES.find(c => c.id === selectedCategory);
              const tagObj = tags?.find(t => t.name === selectedCategory);
              if (catObj) {
                return (
                  <span className={`px-2 py-0.5 rounded-md border font-bold text-[11px] flex items-center gap-1 ${catObj.bgColor || 'bg-slate-100'} ${catObj.textColor || 'text-slate-700'} ${catObj.borderColor || 'border-slate-200'}`}>
                    <span>{catObj.icon}</span>
                    <span>Tag: {catObj.name}</span>
                    <button type="button" onClick={() => setSelectedCategory('all')} className="ml-0.5 hover:opacity-75 cursor-pointer">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              } else {
                return (
                  <span 
                    className="px-2 py-0.5 rounded-md border font-bold text-[11px] flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900"
                    style={tagObj?.color ? { color: tagObj.color, borderColor: tagObj.color + '33', backgroundColor: tagObj.color + '11' } : undefined}
                  >
                    <span>Tag: #{selectedCategory}</span>
                    <button type="button" onClick={() => setSelectedCategory('all')} className="ml-0.5 hover:opacity-75 cursor-pointer">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              }
            })()}
            {selectedListId !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] flex items-center gap-1">
                <span>📁</span>
                <span>List: {todoLists.find(l => l.id === selectedListId)?.name || selectedListId}</span>
              </span>
            )}
            {selectedProject !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                Project: {selectedProject}
              </span>
            )}
            {selectedGoal !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-[11px] flex items-center gap-1">
                Goal: {goals.find(g => g.id === selectedGoal)?.title || selectedGoal}
              </span>
            )}
          </div>
          {(selectedCategory !== 'all' || selectedListId !== 'all' || selectedProject !== 'all' || selectedGoal !== 'all' || filter !== 'today') && (
            <button
              onClick={() => {
                setFilter('today');
                setSelectedCategory('all');
                setSelectedListId('all');
                setSelectedPriority('all');
                setSelectedProject('all');
                setSelectedGoal('all');
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline transition ml-2 shrink-0"
            >
              Reset to Today
            </button>
          )}
        </div>
      )}

      {/* Date Carousel Strip when By Date filter is active */}
      {filter === 'date' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <ScrollableCompactDateStrip
            selectedDateStr={selectedTaskDate}
            onSelectDate={setSelectedTaskDate}
            className="my-1.5"
          />
        </motion.div>
      )}

      {/* Tasks View: List | Kanban | Matrix */}
      {viewMode === 'list' && (
        <motion.div
          key={`tasks-list-${filter}-${selectedTaskDate}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          {/* Tasks List */}
          {/* List Sub-Header: Ultra-compact, single-line (Title + Count + [ Compact | Detailed ] + New Task) */}
          <div className="flex items-center justify-between gap-1.5 px-1 py-0.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {selectedListId === 'all'
                  ? (filter === 'today' ? "Today's Tasks" : filter === 'upcoming' ? 'Upcoming Tasks' : filter === 'date' ? `Tasks for ${selectedTaskDate}` : filter === 'completed' ? 'Archived Tasks' : 'Tasks')
                  : selectedListId === 'smart-starred' ? 'Starred Tasks'
                  : selectedListId === 'smart-alerts' ? 'Tasks with Alerts'
                  : selectedListId === 'smart-next' ? 'Next Tasks'
                  : selectedListId === 'smart-someday' ? 'Someday Tasks'
                  : 'Tasks'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                {filteredTasks.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Density Mode Switcher: Compact | Detailed (matching Eisenhower Grid & Board) */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => changeListDensity('compact')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                    listDensity === 'compact'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Compact List View"
                >
                  <AlignJustify className="w-3 h-3" />
                  <span className="hidden sm:inline">Compact</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeListDensity('expanded')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                    listDensity === 'expanded'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Detailed Cards View"
                >
                  <LayoutList className="w-3 h-3" />
                  <span className="hidden sm:inline">Detailed</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => openAddTask()}
                className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                title="Create new task"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 bg-white dark:bg-slate-900">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {searchQuery
                  ? `No tasks found matching "${searchQuery}".`
                  : 'No tasks found matching this filter.'}
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
          ) : listDensity === 'compact' ? (
            /* COMPACT LIST VIEW: Clean, ultra-dense modern task list (fits 20+ tasks in 1 view) */
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/80">
              {displayedFilteredTasks.map((task, idx) => {
                const qLabel = getQuadrantLabel(task.quadrant);
                const displayRank = (task as any)._displayRank || task.rank || task.order || (idx + 1);
                const pMeta = getPriorityMeta(task.priority, task.quadrant);
                const isExpanded = !!expandedSubtasks[task.id];
                const taskSubtasks = (Array.isArray(task.subtasks) && task.subtasks.length > 0)
                  ? task.subtasks
                  : (Array.isArray(task.checklist) && task.checklist.length > 0)
                  ? task.checklist
                  : [];
                const completedSubs = taskSubtasks.filter(s => s.completed).length;
                const isPomActive = pomodoro.taskId === task.id;
                const hasSubtasks = taskSubtasks.length > 0;
                const customList = task.listId ? todoLists.find(item => item.id === task.listId) : null;
                const linkedGoal = task.goalId ? goals.find(g => g.id === task.goalId) : null;

                const isFading = fadingTaskIds.has(task.id);
                const isVisuallyDone = task.completed || completingTaskIds.has(task.id);
                const isTaskRunningInPiP =
                  pomodoro.taskId === task.id ||
                  (session.activeId === task.id && session.type === 'task') ||
                  (sessions && sessions.some(s => s.activeId === task.id && s.type === 'task'));

                return (
                  <div
                    key={task.id}
                    {...getTaskItemProps(task.id, task.title)}
                    className={`group relative transition-all duration-150 select-none ${
                      isFading
                        ? 'opacity-0 translate-x-6 max-h-0 overflow-hidden py-0 my-0 border-transparent pointer-events-none'
                        : ''
                    } ${
                      draggedTaskId === task.id
                        ? 'opacity-30 scale-[0.98] border-2 border-dashed border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-none'
                        : dragOverTaskId === task.id
                        ? dropPosition === 'before'
                          ? 'border-t-2 border-t-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'border-b-2 border-b-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : selectedBulkIds.has(task.id)
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500/60'
                        : isTaskRunningInPiP
                        ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/50 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                        : isVisuallyDone
                        ? 'bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                        : recentlyCreatedTaskId === task.id
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-emerald-500/60'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Visual insertion indicator lines */}
                    {dragOverTaskId === task.id && dropPosition === 'before' && (
                      <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-indigo-600 z-30 pointer-events-none shadow-xs" />
                    )}
                    {dragOverTaskId === task.id && dropPosition === 'after' && (
                      <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-indigo-600 z-30 pointer-events-none shadow-xs" />
                    )}

                    {/* Vertical Grey Line Drag Handle at the Left Border (yellow highlighted location) */}
                    {/* Primary Compact Row */}
                    {/* Primary Compact Row with floated checkbox & actions so title naturally wraps into yellow spaces */}
                    <div
                      onClick={() => {
                        if (wasDraggingRef.current) return;
                        if (isBulkSelectMode) {
                          handleToggleBulkId(task.id);
                          return;
                        }
                        openDetailTask(task);
                      }}
                      className="relative pl-1 sm:pl-1.5 pr-1.5 sm:pr-2 pt-1 pb-1 min-h-[28px] cursor-pointer flow-root"
                    >
                      {/* Floated Left: Bulk checkbox + Priority Checkbox (Top aligned tick circle) */}
                      <div className="float-left mr-1.5 mt-0 flex items-center gap-1 shrink-0">
                        {isBulkSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedBulkIds.has(task.id)}
                            onChange={(e) => handleToggleBulkId(task.id, e as any)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mr-0.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}

                        {/* Checkbox - Instant toggle with celebration micro-animation & outer bold priority border */}
                        <div className="relative flex items-center justify-center shrink-0">
                          <CheckmarkCelebration
                            activeKey={celebratingTaskId === task.id ? taskCelebrationKey : null}
                            badgeText="Done✅"
                            ringColor="border-emerald-500"
                            align="left"
                          />
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.85 }}
                            animate={animatingTaskId === task.id ? { scale: [1, 1.22, 0.94, 1] } : {}}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTaskWithAnim(task.id);
                            }}
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${getTaskCheckboxPriorityClass(task, isVisuallyDone)}`}
                            title={`Priority: ${task.priority || task.quadrant || 'low'} — Click to toggle completion`}
                          >
                            {isVisuallyDone ? (
                              <AnimatedCheckIcon
                                className="w-3.5 h-3.5 text-white"
                                strokeWidth={3}
                                animate={animatingTaskId === task.id}
                              />
                            ) : null}
                          </motion.button>
                        </div>
                      </div>

                      {/* Floated Right: Note peek, Subtasks/Chevron toggle, and Active Focus Clock */}
                      <div className="float-right ml-1.5 mb-0.5 flex items-center gap-1.5 shrink-0">
                        {/* Note Tiny Icon Badge in Compact View */}
                        {task.notes && task.notes.trim().length > 0 && (
                          <div
                            className="relative inline-flex items-center shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (notePeek?.taskId === task.id) {
                                setNotePeek(null);
                              } else {
                                triggerNotePeek(e, task.id, task.notes || '');
                              }
                            }}
                            onMouseEnter={(e) => triggerNotePeek(e, task.id, task.notes || '')}
                            onMouseLeave={() => setNotePeek(null)}
                          >
                            <span
                              className="h-4.5 w-4.5 inline-flex items-center justify-center rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 shrink-0 shadow-2xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
                              title="Has notes (hover to preview)"
                            >
                              <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                            </span>

                            {/* Responsive note preview */}
                            {notePeek?.taskId === task.id && (
                              <div
                                className="note-preview-bubble note-preview-bubble-dynamic"
                                style={{
                                  left: `${notePeek.x}px`,
                                  top: `${notePeek.y}px`,
                                  transform: notePeek.position === 'above' ? 'translateY(-100%)' : 'none',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="leading-normal font-normal">
                                  {notePeek.text}
                                </p>
                                <div
                                  className={`absolute pointer-events-none w-0 h-0 border-[5px] border-transparent ${
                                    notePeek.position === 'above'
                                      ? 'bottom-[-10px] border-t-slate-700/95 dark:border-t-slate-800/95'
                                      : 'top-[-10px] border-b-slate-700/95 dark:border-b-slate-800/95'
                                  }`}
                                  style={{
                                    left: `${notePeek.arrowOffset}px`,
                                    transform: 'translateX(-50%)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}


                        {/* Subtasks Count Accordion Badge / Dropdown Toggle */}
                        {hasSubtasks ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubtasksView(task.id);
                            }}
                            className="h-4.5 inline-flex items-center gap-1 text-[9px] font-semibold px-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
                            title={isExpanded ? 'Collapse subtasks & timer' : 'Expand subtasks & focus timer'}
                          >
                            <SubtaskBranchIcon className="w-2 h-2 text-indigo-500 shrink-0" />
                            <span>{completedSubs}/{taskSubtasks.length}</span>
                            <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubtasksView(task.id);
                            }}
                            className={`h-4.5 w-4.5 inline-flex items-center justify-center rounded transition shrink-0 cursor-pointer ${
                              isExpanded
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={isExpanded ? 'Hide task dropdown' : 'Show task dropdown'}
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {/* Active Focus Clock Running Indicator if active */}
                        {(() => {
                          const isThisTaskFocused = pomodoro.taskId === task.id;
                          const isPomRunning = isThisTaskFocused && pomodoro.isRunning;
                          const formattedFocusTimer = isThisTaskFocused
                            ? `${Math.floor(pomodoro.timeRemaining / 60)}:${String(pomodoro.timeRemaining % 60).padStart(2, '0')}`
                            : null;

                          if (!isPomRunning) return null;
                          return (
                            <span className="h-4.5 px-1.5 inline-flex items-center gap-1 rounded bg-rose-500 text-white text-[9px] font-mono font-bold animate-pulse shadow-2xs shrink-0">
                              <Timer className="w-2.5 h-2.5 text-white" />
                              <span>{formattedFocusTimer}</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Content: Title wrapping around floated checkbox & floated actions into yellow space */}
                      {(() => {
                        const fontInlineStyle = getFontInlineStyle({
                          fontColor: task.fontColor,
                          fontSize: task.fontSize,
                          fontType: task.fontType,
                          isBold: task.isBold,
                          isDone: isVisuallyDone,
                        });
                        const fontSizeClass = task.fontSize ? getFontSizeClass(task.fontSize) : 'text-[13.8px] sm:text-[14.8px]';
                        const fontTypeClass = getFontTypeClass(task.fontType);

                        return (
                          <p
                            className={`font-semibold leading-5 break-words antialiased select-none ${
                              isVisuallyDone
                                ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                            style={fontInlineStyle}
                          >
                            {/* Number without border, colored based on Eisenhower (increased by 0.4px) */}
                            <span
                              className={`font-mono font-bold text-[14px] sm:text-[15px] mr-1.5 inline-block shrink-0 ${qLabel.textCol}`}
                              title={`Rank ${displayRank} (${qLabel.name})`}
                            >
                              {displayRank}
                            </span>
                            <span className={`${fontSizeClass} ${fontTypeClass}`}>
                              {task.title}
                            </span>
                          </p>
                        );
                      })()}
                    </div>

                    {/* Expandable Dropdown Container with Due Date, Subtasks and Focus Timer inside */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100 bg-slate-50/70 dark:bg-slate-800/40 px-3 sm:px-4 py-2 space-y-1.5 border-t border-slate-100/80 dark:border-slate-800/60' : 'max-h-0 opacity-0'}`} onClick={e => e.stopPropagation()}>
                      {/* Subtasks checklist rendered at top of dropdown */}
                      {hasSubtasks && taskSubtasks.map(sub => (
                        <div
                          key={sub.id}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 py-0.2"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubtask(task.id, sub.id);
                            }}
                            className={`w-3 h-3 rounded-xs border flex items-center justify-center transition shrink-0 cursor-pointer ${
                              sub.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500'
                            }`}
                            title={sub.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {sub.completed && <AnimatedCheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} animate={true} />}
                          </button>
                          <span
                            className={`truncate transition select-none ${
                              sub.completed
                                ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                : 'text-slate-700 dark:text-slate-300 font-medium'
                            }`}
                          >
                            {sub.title}
                          </span>
                        </div>
                      ))}

                      {taskSubtasks.length > 3 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetailTask(task);
                          }}
                          className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 pt-0.5"
                        >
                          <span>+{taskSubtasks.length - 3} more items</span>
                          <span className="text-slate-400 font-normal">• Click for full checklist</span>
                        </div>
                      )}

                      {/* Notes Preview starting flush with left edge */}
                      {task.notes && task.notes.trim().length > 0 && (
                        <div className="py-0.5 px-1.5 rounded-md bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/30 dark:border-amber-800/20 text-[10px] text-amber-800/90 dark:text-amber-300 flex items-center gap-1.5">
                          <MessageSquare className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                          <span className="truncate flex-1 min-w-0 font-normal">{task.notes}</span>
                        </div>
                      )}

                      {/* Bottom Metadata & Actions Strip (Identical to Detailed view dropdown) */}
                      <div className={`flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 ${hasSubtasks || task.notes ? 'pt-1 border-t border-slate-100 dark:border-slate-800/60' : 'pt-0.5'}`}>
                        {/* Checklist Micro Badge */}
                        {hasSubtasks && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0"
                            title={`Checklist: ${completedSubs} of ${taskSubtasks.length} steps completed`}
                          >
                            <SubtaskBranchIcon className="w-2.5 h-2.5" />
                            <span>{completedSubs}/{taskSubtasks.length}</span>
                          </span>
                        )}

                        {/* Due Date */}
                        {task.dueDate && (
                          !task.completed && task.dueDate < todayStr ? (
                            <span
                              className="h-5 px-1.5 inline-flex items-center gap-1 rounded text-[10px] font-mono shrink-0 transition bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold"
                              title={`Due: ${formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)} (Overdue)`}
                            >
                              <Clock className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)}</span>
                              <OverdueIcon className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0 ml-0.5" />
                            </span>
                          ) : (
                            <span
                              className="h-5 px-1.5 inline-flex items-center gap-1 rounded border text-[10px] font-mono shrink-0 transition bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              title={`Due: ${formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)}`}
                            >
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)}</span>
                            </span>
                          )
                        )}

                        {/* Calendar Button */}
                        <CardCalendarButton
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

                        {/* Linked Goal */}
                        {linkedGoal && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                            🎯 {linkedGoal.title}
                          </span>
                        )}

                        {/* Custom List */}
                        {customList && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
                            📋 {customList.name}
                          </span>
                        )}

                        {/* Category */}
                        {task.category && (
                          <span className="capitalize text-[10px] text-slate-400">{task.category}</span>
                        )}

                        {/* Focus Clock Timer button in the pointed orange area (far right inline) */}
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
                              className={`h-5 ml-auto shrink-0 inline-flex items-center justify-center rounded-md transition cursor-pointer shadow-2xs ${
                                isPomRunning
                                  ? 'px-1.5 gap-1 bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-mono text-[10px] font-bold shadow-rose-500/20'
                                  : isThisTaskFocused && pomodoro.timeRemaining > 0
                                  ? 'px-1.5 gap-1 bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-mono text-[10px] font-bold shadow-amber-500/20'
                                  : 'w-5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800'
                              }`}
                              title={
                                isPomRunning
                                  ? `Focus Clock Active: ${formattedFocusTimer} (click to pause)`
                                  : isThisTaskFocused
                                  ? `Focus Clock Paused: ${formattedFocusTimer} (click to resume)`
                                  : 'Start 25m Focus Clock'
                              }
                            >
                              <Timer className={`w-3.5 h-3.5 shrink-0 ${isPomRunning ? 'animate-pulse text-white' : ''}`} />
                              {formattedFocusTimer && (isPomRunning || pomodoro.timeRemaining > 0) && (
                                <span className="font-mono text-[10px]">{formattedFocusTimer}</span>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DETAILED CARDS VIEW: Super Productivity inspired compact card layout */
            <div className="space-y-1.5">
              {displayedFilteredTasks.map((task, idx) => {
                const qLabel = getQuadrantLabel(task.quadrant);
                const displayRank = (task as any)._displayRank || task.rank || task.order || (idx + 1);
                const pMeta = getPriorityMeta(task.priority, task.quadrant);
                const cat = getCategoryForTask(task);
                const isExpanded = !!expandedSubtasks[task.id];
                const taskSubtasks = (Array.isArray(task.subtasks) && task.subtasks.length > 0)
                  ? task.subtasks
                  : (Array.isArray(task.checklist) && task.checklist.length > 0)
                  ? task.checklist
                  : [];
                const completedSubs = taskSubtasks.filter(s => s.completed).length;
                const hasChecklist = taskSubtasks.length > 0;

                const isFading = fadingTaskIds.has(task.id);
                const isVisuallyDone = task.completed || completingTaskIds.has(task.id);
                const isTaskRunningInPiP =
                  pomodoro.taskId === task.id ||
                  (session.activeId === task.id && session.type === 'task') ||
                  (sessions && sessions.some(s => s.activeId === task.id && s.type === 'task'));

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
                    className={`group rounded-xl border relative p-1.5 sm:px-2.5 sm:py-1.5 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer select-none space-y-1 ${
                      isFading
                        ? 'opacity-0 translate-x-6 max-h-0 overflow-hidden py-0 my-0 border-transparent pointer-events-none'
                        : ''
                    } ${
                      draggedTaskId === task.id
                        ? 'opacity-30 scale-[0.98] border-2 border-dashed border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-none'
                        : dragOverTaskId === task.id
                        ? dropPosition === 'before'
                          ? 'border-t-2 border-t-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'border-b-2 border-b-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : selectedBulkIds.has(task.id)
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70 border-indigo-400'
                        : isTaskRunningInPiP
                        ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/50 shadow-md bg-amber-50/20 dark:bg-amber-950/20'
                        : isVisuallyDone
                        ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                        : recentlyCreatedTaskId === task.id
                        ? 'border-emerald-500/70 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40'
                        : 'border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Visual insertion indicator lines */}
                    {dragOverTaskId === task.id && dropPosition === 'before' && (
                      <div className="absolute -top-1 left-0 right-0 h-1 bg-indigo-600 rounded-full z-30 pointer-events-none shadow-sm animate-pulse" />
                    )}
                    {dragOverTaskId === task.id && dropPosition === 'after' && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-indigo-600 rounded-full z-30 pointer-events-none shadow-sm animate-pulse" />
                    )}

                    {/* Vertical Grey Line Drag Handle at the Left Border (yellow highlighted location) */}
                    {/* Primary Row: Checkbox on top, Title wrapping below to far-left, and Badges */}
                    <div className="flex flex-col gap-1 w-full min-w-0">
                      {/* Row 1: Floated Tick Circle strictly on TOP & Title wrapping below it */}
                      <div className="w-full flow-root min-w-0">
                        {/* Top-right actions: Subtasks or Details chevron (floated right) */}
                        <div className="float-right ml-2 mb-0.5 shrink-0 flex items-center gap-1">
                          {hasChecklist ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSubtasksView(task.id);
                              }}
                              className="h-5 inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
                              title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                            >
                              <SubtaskBranchIcon className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{completedSubs}/{taskSubtasks.length}</span>
                              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (task.notes || task.dueDate || task.category) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSubtasksView(task.id);
                              }}
                              className="p-0.5 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                              title={isExpanded ? 'Collapse details' : 'Expand sub-steps & details'}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : null}
                        </div>

                        {/* Floated Left: Bulk checkbox + Tick Circle strictly on TOP */}
                        <div className="float-left mr-1.5 mt-0 flex items-center gap-1 shrink-0">
                          {isBulkSelectMode && (
                            <input
                              type="checkbox"
                              checked={selectedBulkIds.has(task.id)}
                              onChange={(e) => handleToggleBulkId(task.id, e as any)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mr-0.5"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}

                          {/* Checkbox - On top, circular, animated */}
                          <div className="relative flex items-center justify-center shrink-0">
                            <CheckmarkCelebration
                              activeKey={celebratingTaskId === task.id ? taskCelebrationKey : null}
                              badgeText="Done✅"
                              ringColor="border-emerald-500"
                              align="left"
                            />
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.85 }}
                              animate={animatingTaskId === task.id ? { scale: [1, 1.22, 0.94, 1] } : {}}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTaskWithAnim(task.id);
                              }}
                              className={`w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${getTaskCheckboxPriorityClass(task, isVisuallyDone)}`}
                              title={`Priority: ${task.priority || task.quadrant || 'low'} — Click to toggle completion`}
                            >
                              {isVisuallyDone ? (
                                <AnimatedCheckIcon
                                  className="w-3.5 h-3.5 text-white"
                                  strokeWidth={3}
                                  animate={animatingTaskId === task.id}
                                />
                              ) : null}
                            </motion.button>
                          </div>
                        </div>

                        {/* Title: starts next to tick circle, then flows below the tick circle to the far left */}
                        {(() => {
                          const fontInlineStyle = getFontInlineStyle({
                            fontColor: task.fontColor,
                            fontSize: task.fontSize,
                            fontType: task.fontType,
                            isBold: task.isBold,
                            isDone: isVisuallyDone,
                          });
                          const fontSizeClass = task.fontSize ? getFontSizeClass(task.fontSize) : 'text-[13.8px] sm:text-[14.8px]';
                          const fontTypeClass = getFontTypeClass(task.fontType);

                          return (
                            <h4
                              className={`${fontSizeClass} ${fontTypeClass} font-bold tracking-tight leading-5 transition-all duration-200 antialiased break-words ${
                                isVisuallyDone
                                  ? 'line-through text-slate-400 dark:text-slate-500 opacity-75'
                                  : task.fontColor ? '' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                              }`}
                              style={{
                                ...fontInlineStyle,
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale',
                                textRendering: 'optimizeLegibility',
                              }}
                            >
                              <span
                                className={`font-mono font-bold text-[14px] sm:text-[15px] mr-1.5 inline-block shrink-0 ${qLabel.textCol}`}
                                title={`Rank ${displayRank} (${qLabel.name})`}
                              >
                                {displayRank}
                              </span>
                              <span>{task.title}</span>
                              {isTaskRunningInPiP && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 align-middle">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                                  PiP Active
                                </span>
                              )}
                            </h4>
                          );
                        })()}
                      </div>

                      {/* Row 2: Badges starting from far-left yellow highlighted space */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5 w-full min-w-0">
                          {/* Badges on the left */}
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {/* Eisenhower Tag Badge */}
                            <span
                              className={`h-5.5 inline-flex items-center gap-1 px-1.5 rounded-md text-[11px] font-mono font-bold uppercase shrink-0 border border-transparent shadow-2xs ${qLabel.badgeBg}`}
                              title={`Eisenhower Quadrant: ${qLabel.name}`}
                            >
                              {qLabel.tag}
                            </span>

                            {/* Due Date Clock Icon Badge (Only Due Clock Icon) */}
                            {task.dueDate && (
                              !task.completed && task.dueDate < todayStr ? (
                                <OverdueIcon
                                  className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0"
                                  title={`Due: ${formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)} (Overdue)`}
                                />
                              ) : (
                                <span
                                  className="h-5.5 px-1.5 inline-flex items-center justify-center rounded-md border text-[10px] font-mono shrink-0 transition bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                  title={`Due: ${formatOSDate(task.dueDate, 'DDMonthYYYY', task.dueTime)}`}
                                >
                                  <Clock className="w-3 h-3 text-slate-400" />
                                </span>
                              )
                            )}

                            {/* Note Icon Badge in Detailed View */}
                            {task.notes && task.notes.trim().length > 0 && (
                              <div
                                className="relative inline-flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (notePeek?.taskId === task.id) {
                                    setNotePeek(null);
                                  } else {
                                    triggerNotePeek(e, task.id, task.notes || '');
                                  }
                                }}
                                onMouseEnter={(e) => triggerNotePeek(e, task.id, task.notes || '')}
                                onMouseLeave={() => setNotePeek(null)}
                              >
                                <span
                                  className="h-5.5 w-5.5 inline-flex items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 shrink-0 shadow-2xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
                                  title="Has notes (hover to preview)"
                                >
                                  <MessageSquare className="w-3 h-3 shrink-0" />
                                </span>

                                {/* Tooltip preview */}
                                {notePeek?.taskId === task.id && (
                                  <div
                                    className="note-preview-bubble note-preview-bubble-dynamic"
                                    style={{
                                      left: `${notePeek.x}px`,
                                      top: `${notePeek.y}px`,
                                      transform: notePeek.position === 'above' ? 'translateY(-100%)' : 'none',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="leading-normal font-normal">
                                      {notePeek.text}
                                    </p>
                                    <div
                                      className={`absolute pointer-events-none w-0 h-0 border-[5px] border-transparent ${
                                        notePeek.position === 'above'
                                          ? 'bottom-[-10px] border-t-slate-700/95 dark:border-t-slate-800/95'
                                          : 'top-[-10px] border-b-slate-700/95 dark:border-b-slate-800/95'
                                      }`}
                                      style={{
                                        left: `${notePeek.arrowOffset}px`,
                                        transform: 'translateX(-50%)',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Focus Clock Badge / Icon & Reminder Calendar at the bottom corner of each task card */}
                          <div className="shrink-0 flex items-center ml-auto gap-1">
                            <CardCalendarButton
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
                                  className={`h-5.5 inline-flex items-center justify-center rounded-md transition cursor-pointer shrink-0 shadow-2xs ${
                                    isPomRunning
                                      ? 'px-1.5 gap-1 bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-mono text-[10px] font-bold shadow-rose-500/20'
                                      : isThisTaskFocused && pomodoro.timeRemaining > 0
                                      ? 'px-1.5 gap-1 bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-mono text-[10px] font-bold shadow-amber-500/20'
                                      : 'w-5.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800'
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
                                  {isThisTaskFocused && <span>{formattedFocusTimer}</span>}
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                    {/* Expandable Details Container with Smooth Height & Opacity Transition */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100 pt-1.5 space-y-1.5' : 'max-h-0 opacity-0'}`} onClick={e => e.stopPropagation()}>
                      {/* Subtasks visible when expanded (Flush with left edge) */}
                      {hasChecklist && (
                        <div className="space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                          {taskSubtasks.map(sub => (
                            <div
                              key={sub.id}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-[10px] py-0.2 leading-tight"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubtask(task.id, sub.id);
                                }}
                                className={`w-3 h-3 rounded-xs border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                  sub.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500'
                                }`}
                                title={sub.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {sub.completed && <AnimatedCheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} animate={true} />}
                              </button>
                              <span
                                className={`truncate transition select-none ${
                                  sub.completed
                                    ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                    : 'text-slate-700 dark:text-slate-300 font-medium'
                                }`}
                              >
                                {sub.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notes Preview starting flush with left edge */}
                      {task.notes && task.notes.trim().length > 0 && (
                        <div className="mr-1 py-0.5 px-1.5 rounded-md bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/30 dark:border-amber-800/20 text-[10px] text-amber-800/90 dark:text-amber-300 flex items-center gap-1.5">
                          <MessageSquare className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                          <span className="truncate flex-1 min-w-0 font-normal">{task.notes}</span>
                        </div>
                      )}

                      {/* Metadata Row: Checklist, Due Date, Tags, Project, Goal (Starting flush with left edge) */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">

                      {/* Checklist Micro Badge */}
                      {hasChecklist && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0"
                          title={`Checklist: ${completedSubs} of ${taskSubtasks.length} steps completed`}
                        >
                          <SubtaskBranchIcon className="w-2.5 h-2.5" />
                          <span>{completedSubs}/{taskSubtasks.length}</span>
                        </span>
                      )}

                      {/* Due Date (Formatted to strict OS format) */}
                      {task.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono shrink-0 ${
                            !task.completed && task.dueDate < todayStr
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <span className="flex items-center gap-1" title={`Due: ${formatOSDate(task.dueDate, 'DDMonthYYYY:HH:MM', task.dueTime)}`}>
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>
                              {task.dueTime
                                ? formatOSDate(task.dueDate, 'DDMMYYYY:HH:MM', task.dueTime)
                                : formatOSDate(task.dueDate, 'DDMMYYYY')}
                            </span>
                          </span>
                        </span>
                      )}

                      {/* Alerts Icon */}
                      {task.alerts && task.alerts.length > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-amber-500 shrink-0"
                          title={`${task.alerts.length} reminder alert(s)`}
                        >
                          <Bell className="w-3 h-3" />
                          <span className="text-[10px] font-semibold">{task.alerts.length}</span>
                        </span>
                      )}

                      {/* Recurring Icon */}
                      {task.recurring && task.recurring !== 'none' && (
                        <span className="text-[11px] text-indigo-500 flex items-center gap-0.5 shrink-0" title={`Repeats: ${task.recurring}`}>
                          <RotateCw className="w-3 h-3" />
                          <span className="capitalize text-[10px]">{task.recurring}</span>
                        </span>
                      )}

                      {/* Tags (Super Productivity style - click to filter/search) */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap shrink-0">
                          {task.tags.map(t => (
                            <button
                              type="button"
                              key={t}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(prev => prev === `#${t}` ? '' : `#${t}`);
                              }}
                              className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition cursor-pointer"
                              title={`Filter by tag #${t}`}
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Interactive Combined Goal & Project Binder Dropdown (Clean, no redundant emoji on each item) */}
                      <select
                        value={task.goalId || task.projectId || ''}
                        onClick={e => e.stopPropagation()}
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
                        className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/60 rounded px-1.5 py-0.5 cursor-pointer max-w-[130px] truncate hover:border-indigo-400 transition shrink-0 text-left"
                        title="Bind to Goal & Project"
                      >
                        <option value="" className="text-left">No Goal</option>
                        {goals.map(g => (
                          <option key={g.id} value={g.id} className="text-left">
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Super Productivity Completed Tasks Section (View & Modify / Make Uncomplete) */}
          {filter !== 'completed' && completedTasks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  id="btn-toggle-completed-tasks"
                  onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer select-none"
                >
                  {isCompletedSectionOpen ? (
                    <ChevronDown className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Completed Tasks ({completedTasks.length})</span>
                </button>

                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Click checkbox to restore / make uncomplete
                </span>
              </div>

              {isCompletedSectionOpen && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
                  {completedTasks.map(cTask => (
                    <div
                      key={cTask.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-white dark:hover:bg-slate-800/70 transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Checkbox - Clicking immediately uncompletes the task */}
                        <button
                          type="button"
                          onClick={() => toggleTask(cTask.id)}
                          title="Click to make task uncomplete again"
                          className="w-4 h-4 rounded-md bg-emerald-600 border border-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-emerald-700 transition"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>

                        <span
                          onClick={() => openDetailTask(cTask)}
                          className="text-xs line-through text-slate-400 dark:text-slate-500 break-words whitespace-normal leading-snug cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition flex-1"
                          title={`${cTask.title} (Click to open and modify)`}
                        >
                          {cTask.title}
                        </span>

                        {/* Tag / Category */}
                        {cTask.tags && cTask.tags.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            #{cTask.tags[0]}
                          </span>
                        )}

                        {cTask.completedAt && (
                          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                            {formatOSDate(cTask.completedAt, 'DDMM')}
                          </span>
                        )}
                      </div>

                      {/* Quick Actions: Uncomplete button & Edit button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleTask(cTask.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[10px] font-semibold transition cursor-pointer"
                          title="Restore task / make uncomplete"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span className="hidden sm:inline">Uncomplete</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditTask(cTask)}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Modify task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTask(cTask.id)}
                          className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Eisenhower Priority Matrix (2x2 Grid & Board) */}
      {viewMode === 'matrix' && (
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
          upcomingCount={countForFilter('upcoming')}
          allCount={countForFilter('all')}
          dateCount={countForFilter('date')}
          completedCount={countForFilter('completed')}
        />
      )}

      {/* Reports & Velocity Analytics View */}
      {viewMode === 'reports' && (
        <TaskReportSection tasks={tasks} taskTimers={taskTimers} />
      )}

      {/* Modern Unified Add/Edit Task Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
          // If filter was set to completed archive, reset to Today/All so the user sees their created task!
          if (filter === 'completed') {
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
        defaultDate={todayStr}
        defaultStatus={taskModalDefaultStatus}
        defaultQuadrant={taskModalDefaultQuadrant}
        defaultCategory={selectedCategory !== 'all' ? selectedCategory : 'work'}
        defaultPriority={selectedPriority !== 'all' ? selectedPriority : undefined}
        defaultProjectId={quickProjectId || (selectedProject !== 'all' ? projects.find(p => p.name === selectedProject)?.id : undefined)}
        defaultProject={quickProjectId ? projects.find(p => p.id === quickProjectId)?.name : (selectedProject !== 'all' ? selectedProject : undefined)}
        defaultGoalId={quickGoalId || (selectedGoal !== 'all' ? selectedGoal : undefined)}
        defaultListId={selectedListId && !selectedListId.startsWith('smart-') && selectedListId !== 'all' ? selectedListId : quickListId || 'list_inbox'}
        onSwitchToEvent={() => { setIsTaskModalOpen(false); setUniversalModalType('event'); }}
        onSwitchToHabit={() => { setIsTaskModalOpen(false); setUniversalModalType('habit'); }}
        onSwitchToGoal={() => { setIsTaskModalOpen(false); setUniversalModalType('goal'); }}
        onSwitchToMed={() => { setIsTaskModalOpen(false); setUniversalModalType('medication'); }}
        onSwitchToBill={() => { setIsTaskModalOpen(false); setUniversalModalType('bill'); }}
        onSwitchToJournal={() => { setIsTaskModalOpen(false); setUniversalModalType('journal'); }}
      />

      {/* Universal ActivityManager Modal */}
      {universalModalType && (
        <ActivityManager
          isOpen={Boolean(universalModalType)}
          onClose={() => setUniversalModalType(null)}
          type={universalModalType}
        />
      )}

      {/* Task Detail Modal - Optimized Pop-up Card */}
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

      {/* Super Productivity Quick-Add Batching Modal */}
      <QuickAddBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        defaultCategory={selectedCategory !== 'all' ? selectedCategory : 'work'}
        defaultPriority={selectedPriority !== 'all' ? selectedPriority : 'medium'}
        defaultListId={selectedListId !== 'all' ? selectedListId : 'inbox'}
      />

      {/* Task Backup, Export & Import Modal (JSON / CSV) */}
      <TaskExportImportModal
        isOpen={isExportImportModalOpen}
        onClose={() => setIsExportImportModalOpen(false)}
      />

      {/* Task Conflict Resolution Modal */}
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

      {/* Bulk Selection Floating Action Bar */}
      {isBulkSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>{selectedBulkIds.size} selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={handleToggleBulkSelectAll}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            {selectedBulkIds.size === filteredTasks.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            type="button"
            disabled={selectedBulkIds.size === 0}
            onClick={() => setShowBulkDeleteModal(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              selectedBulkIds.size > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({selectedBulkIds.size})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsBulkSelectMode(false);
              setSelectedBulkIds(new Set());
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
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
    </div>
  );
};
