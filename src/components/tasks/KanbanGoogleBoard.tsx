import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Star,
  Check,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCw,
  Sliders,
  CheckSquare,
  FileText,
  Sparkles,
} from 'lucide-react';
import { TaskItem, TaskStatus, WorkflowStage, Priority } from '../../types';
import { formatOSDate, formatLocalDate } from '../../utils/date';
import { UniformTaskCard } from './UniformTaskCard';

import { DragAndDropContextType } from '../../hooks/useTaskDragAndDrop';

interface KanbanGoogleBoardProps {
  tasks: TaskItem[];
  stages: WorkflowStage[];
  onToggleTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onOpenEditTask: (task: TaskItem) => void;
  onOpenDetailTask: (task: TaskItem) => void;
  onAddTask: (stageId?: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onOpenCustomizeStages: () => void;
  matchesFilterTab: (task: TaskItem, options?: { forKanbanColId?: string }) => boolean;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onCycleEisenhower?: (task: TaskItem) => void;
  onFilterCategory?: (catId: string) => void;
  onFilterTag?: (tag: string) => void;
  onFilterProject?: (project: string) => void;
  dndProps: DragAndDropContextType;
}

type SortMode = 'manual' | 'dueDate' | 'priority' | 'starred' | 'title';

const priorityOrder: Record<Priority, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

export const KanbanGoogleBoard: React.FC<KanbanGoogleBoardProps> = ({
  tasks,
  stages,
  onToggleTask,
  onToggleStar,
  onOpenEditTask,
  onOpenDetailTask,
  onAddTask,
  onUpdateTaskStatus,
  onOpenCustomizeStages,
  matchesFilterTab,
  onToggleSubtask,
  onCycleEisenhower,
  onFilterCategory,
  onFilterTag,
  onFilterProject,
  dndProps,
}) => {
  const [activeStageId, setActiveStageId] = useState<string>(stages[0]?.id || 'todo');
  const [columnSorts, setColumnSorts] = useState<Record<string, SortMode>>({});
  const [activeSortMenuCol, setActiveSortMenuCol] = useState<string | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayStr = formatLocalDate(new Date());

  // Scroll to column when clicking a tab
  const scrollToColumn = (stageId: string) => {
    setActiveStageId(stageId);
    const colEl = columnRefs.current[stageId];
    if (colEl && carouselRef.current) {
      const container = carouselRef.current;
      const targetLeft = colEl.offsetLeft - (container.clientWidth - colEl.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  };

  // Track active column on scroll for carousel indicator dots
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const scrollLeft = container.scrollLeft;
    const containerCenter = scrollLeft + container.clientWidth / 2;

    let closestStageId = stages[0]?.id || '';
    let minDistance = Infinity;

    stages.forEach(stage => {
      const el = columnRefs.current[stage.id];
      if (el) {
        const elCenter = el.offsetLeft + el.clientWidth / 2;
        const dist = Math.abs(containerCenter - elCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestStageId = stage.id;
        }
      }
    });

    if (closestStageId && closestStageId !== activeStageId) {
      setActiveStageId(closestStageId);
    }
  };

  const getStageTasks = (stageId: string) => {
    const raw = tasks.filter(t => {
      const taskStatus = t.status || (t.completed ? 'done' : 'todo');
      const isStatusMatch = taskStatus === stageId || (stageId === 'todo' && taskStatus === 'waiting');
      if (!isStatusMatch) return false;
      return matchesFilterTab(t, { forKanbanColId: stageId });
    });

    const sort = columnSorts[stageId] || 'manual';

    return [...raw].sort((a, b) => {
      if (sort === 'starred') {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sort === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sort === 'priority') {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sort === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Manual default: priority + order
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const sortedStages = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const getNextStageId = (currentStage: string) => {
    const idx = sortedStages.findIndex(s => s.id === currentStage);
    if (idx >= 0 && idx < sortedStages.length - 1) {
      return sortedStages[idx + 1].id;
    }
    return null;
  };

  const getPrevStageId = (currentStage: string) => {
    const idx = sortedStages.findIndex(s => s.id === currentStage);
    if (idx > 0) {
      return sortedStages[idx - 1].id;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Top Header & Workflow Customizer */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Kanban Board
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                {sortedStages.length} Columns
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCustomizeStages}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
            title="Customize Kanban columns, rename, reorder, or change colors"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Customize Kanban</span>
          </button>

          <button
            type="button"
            onClick={() => onAddTask(activeStageId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Google Tasks Style Column Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200/70 dark:border-slate-800/70 px-1">
        {sortedStages.map(col => {
          const colTasks = getStageTasks(col.id);
          const isActive = activeStageId === col.id;

          return (
            <button
              key={col.id}
              type="button"
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: col.color || '#6366f1' }}
              />
              <span>{col.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {colTasks.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Google Tasks Carousel Board (Compact on mobile, all columns fit in 1 screen on desktop) */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex lg:grid lg:grid-cols-4 gap-2 overflow-x-auto lg:overflow-x-visible snap-x snap-mandatory pb-2 pt-0.5 px-0.5 scroll-smooth no-scrollbar items-start w-full"
      >
        {sortedStages.map(col => {
          const colTasks = getStageTasks(col.id);
          const isDropTarget = dndProps.dragOverStageId === col.id;
          const currentSort = columnSorts[col.id] || 'manual';

          return (
            <div
              key={col.id}
              {...dndProps.getStageDropProps(col.id)}
              ref={el => {
                columnRefs.current[col.id] = el;
              }}
              className={`w-[82vw] sm:w-[260px] md:w-[220px] lg:w-full shrink-0 lg:shrink snap-center rounded-xl sm:rounded-2xl border transition-all flex flex-col min-h-[440px] p-2 sm:p-2.5 shadow-2xs ${
                isDropTarget
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/40 shadow-md'
                  : 'border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900'
              }`}
            >
              {/* Column Header (Google Tasks style: Icon + Title + Sort + Plus) */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: col.color || '#6366f1' }}
                  />
                  <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white truncate">
                    {col.label}
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 relative">
                  {/* Sort Button ⇅ */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSortMenuCol(activeSortMenuCol === col.id ? null : col.id)
                      }
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Sort tasks in this column"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>

                    {activeSortMenuCol === col.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setActiveSortMenuCol(null)}
                        />
                        <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-40 py-1 text-xs">
                          <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Sort By
                          </span>
                          {(
                            [
                              { key: 'manual', label: 'Default / Priority' },
                              { key: 'dueDate', label: 'Due Date' },
                              { key: 'starred', label: 'Starred First' },
                              { key: 'title', label: 'Title (A-Z)' },
                            ] as const
                          ).map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                setColumnSorts(prev => ({ ...prev, [col.id]: opt.key }));
                                setActiveSortMenuCol(null);
                              }}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                                currentSort === opt.key
                                  ? 'font-bold text-indigo-600 dark:text-indigo-400'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {currentSort === opt.key && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Add Task directly to this column */}
                  <button
                    type="button"
                    onClick={() => onAddTask(col.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title={`Add task to ${col.label}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks List inside Column Socket (Seamless compact list, zero wasted margins) */}
              <div 
                {...dndProps.getStageDropProps(col.id)}
                className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto flex-1 max-h-[620px] custom-scrollbar bg-white dark:bg-slate-900 min-w-0"
              >
                {colTasks.length === 0 ? (
                  /* Google Tasks Exact Clean Empty State (from video) */
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500 shadow-inner">
                      <CheckSquare className="w-8 h-8 stroke-1.5 text-indigo-400" />
                    </div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No tasks yet
                    </h5>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                      Add your to-dos and keep track of them in {col.label}.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAddTask(col.id)}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-200/50 dark:border-indigo-800/50 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add a task</span>
                    </button>
                  </div>
                ) : (
                  colTasks.map(task => {
                    const currentStage = task.status || (task.completed ? 'done' : 'todo');
                    const nextSt = getNextStageId(currentStage);
                    const prevSt = getPrevStageId(currentStage);

                    return (
                      <UniformTaskCard
                        key={task.id}
                        task={task}
                        isCompact
                        {...dndProps.getTaskItemProps(task.id, task.title)}
                        isBeingDragged={dndProps.draggedTaskId === task.id}
                        isDropTarget={dndProps.dragOverTaskId === task.id}
                        dropPosition={dndProps.dropPosition}
                        onToggleTask={onToggleTask}
                        onToggleStar={onToggleStar}
                        onOpenDetailTask={onOpenDetailTask}
                        onOpenEditTask={onOpenEditTask}
                        onToggleSubtask={onToggleSubtask}
                        onCycleEisenhower={onCycleEisenhower}
                        onFilterCategory={onFilterCategory}
                        onFilterTag={onFilterTag}
                        onFilterProject={onFilterProject}
                        onMovePrev={prevSt ? () => onUpdateTaskStatus(task.id, prevSt as TaskStatus) : undefined}
                        onMoveNext={nextSt ? () => onUpdateTaskStatus(task.id, nextSt as TaskStatus) : undefined}
                        prevLabel="Move to previous stage"
                        nextLabel="Advance to next stage"
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Pagination Indicator Dots (Google Tasks Carousel) */}
      <div className="flex sm:hidden items-center justify-center gap-1.5 pt-1">
        {sortedStages.map(col => (
          <button
            key={col.id}
            type="button"
            onClick={() => scrollToColumn(col.id)}
            className={`transition-all rounded-full ${
              activeStageId === col.id
                ? 'w-4 h-1.5 bg-indigo-600 dark:bg-indigo-400'
                : 'w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
            }`}
            title={`Jump to ${col.label}`}
          />
        ))}
      </div>
    </div>
  );
};
