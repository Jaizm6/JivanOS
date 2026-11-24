import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  Edit2,
  Calendar,
  Check,
  CheckSquare,
  Tag,
  Flame,
  ChevronDown,
  ChevronUp,
  Trophy,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Goal, TaskItem } from '../../types';
import { GoalEditModal } from './GoalEditModal';
import { LinkTasksModal } from './LinkTasksModal';
import { LinkEntitiesModal } from './LinkEntitiesModal';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { HabitFormModal } from '../habits/HabitFormModal';
import {
  PetalShapeBadge,
  getPetalGroupRadiusClass,
  SmoothCollapse,
  useIsDesktopMd,
  distributeIntoTwoColumns,
} from '../common/PetalExpressive';
import { getSafeFontColor } from '../../utils/activityStyles';
import { InlineTagMeta } from '../common/TagVisuals';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';

const formatGoalDueDate = (dateStr?: string): string => {
  if (!dateStr) return 'No target date';
  try {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const GOAL_STATUS_META: Record<
  Goal['status'],
  { label: string; textClass: string }
> = {
  on_track: { label: 'On Track', textClass: 'text-emerald-600 dark:text-emerald-400' },
  at_risk: { label: 'At Risk', textClass: 'text-amber-600 dark:text-amber-400' },
  behind: { label: 'Behind', textClass: 'text-rose-600 dark:text-rose-400' },
  completed: { label: 'Completed', textClass: 'text-indigo-600 dark:text-indigo-400' },
};

export const GoalsManager: React.FC = () => {
  const {
    goals,
    updateGoal,
    tasks,
    toggleTask,
    habits = [],
    toggleHabitDay,
    openEntitiesModal,
    pushNotification,
    tags = [],
    theme,
  } = useApp();

  const isDarkMode = theme === 'dark';

  const [showGoalModal, setShowGoalModal] = useState(false);

  // Edit Modals State
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});

  // Link Entities Modal State (Tasks, Events, Habits)
  const [linkEntitiesGoal, setLinkEntitiesGoal] = useState<Goal | null>(null);
  const [linkEntitiesTab, setLinkEntitiesTab] = useState<'tasks' | 'events' | 'habits'>('tasks');

  // Habit Modal State linked to goal
  const [habitModalGoal, setHabitModalGoal] = useState<Goal | null>(null);

  // Link Tasks Modal State
  const [linkModalTarget, setLinkModalTarget] = useState<{
    type: 'goal';
    id: string;
    title: string;
    color?: string;
  } | null>(null);

  // Create Task Directly Linked Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalDefaultGoalId, setTaskModalDefaultGoalId] = useState<string | undefined>(undefined);

  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'completed' | 'archived'>('all');
  const [pendingArchiveGoal, setPendingArchiveGoal] = useState<Goal | null>(null);
  const isDesktopMd = useIsDesktopMd();

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isGoalTaskDone = (t: TaskItem): boolean =>
    Boolean(
      t.completed ||
        (t.recurring &&
          t.recurring !== 'none' &&
          (t.lastCompletedDate === todayStr || t.completedAt?.startsWith(todayStr)))
    );

  const activeGoals = useMemo(() => goals.filter(g => !g.archived), [goals]);
  const archivedGoals = useMemo(() => goals.filter(g => Boolean(g.archived)), [goals]);

  const executeToggleArchiveGoal = (goal: Goal) => {
    const wasArchived = Boolean(goal.archived);
    updateGoal({
      ...goal,
      archived: !wasArchived,
      archivedAt: !wasArchived ? new Date().toISOString() : undefined,
    });
    pushNotification(
      wasArchived ? 'Goal Restored' : 'Goal Archived',
      wasArchived ? `${goal.title} moved back to active goals` : `${goal.title} moved to archive`,
      'system'
    );
  };

  const handleToggleArchiveGoal = (goal: Goal) => {
    if (goal.archived) {
      executeToggleArchiveGoal(goal);
    } else {
      setPendingArchiveGoal(goal);
    }
  };

  const toggleGoalExpanded = (goalId: string) => {
    setExpandedGoalIds(prev => ({ ...prev, [goalId]: !prev[goalId] }));
  };

  // Unified, deduplicated milestone metrics per goal (strictly active linked tasks and habits)
  const goalMetricsById = useMemo(() => {
    const map: Record<
      string,
      {
        linkedTasks: TaskItem[];
        linkedHabits: typeof habits;
        totalCount: number;
        completedCount: number;
        calculatedProgress: number;
        isCompleted: boolean;
        hasLinkedItems: boolean;
      }
    > = {};

    goals.forEach(goal => {
      const seenTaskIds = new Set<string>();
      const linkedTasks = tasks.filter(t => {
        if (t.archived || t.status === 'archived') return false;
        const matches =
          t.goalId === goal.id ||
          t.projectId === goal.id ||
          (t.project && t.project.toLowerCase() === goal.title.toLowerCase());
        if (!matches || seenTaskIds.has(t.id)) return false;
        seenTaskIds.add(t.id);
        return true;
      });

      const seenHabitIds = new Set<string>();
      const linkedHabits = habits.filter(h => {
        if (h.archived) return false;
        if (h.goalId !== goal.id || seenHabitIds.has(h.id)) return false;
        seenHabitIds.add(h.id);
        return true;
      });

      const completedTasksCount = linkedTasks.filter(t => isGoalTaskDone(t)).length;
      const completedHabitsCount = linkedHabits.filter(h =>
        Boolean(h.completionHistory?.[todayStr])
      ).length;

      const totalCount = linkedTasks.length + linkedHabits.length;
      const completedCount = completedTasksCount + completedHabitsCount;

      const calculatedProgress =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : goal.progress;
      const isCompleted =
        goal.status === 'completed' || calculatedProgress === 100 || goal.progress === 100;
      const hasLinkedItems = totalCount > 0;

      map[goal.id] = {
        linkedTasks,
        linkedHabits,
        totalCount,
        completedCount,
        calculatedProgress,
        isCompleted,
        hasLinkedItems,
      };
    });

    return map;
  }, [goals, tasks, habits, todayStr]);

  const completedGoalsCount = useMemo(
    () => activeGoals.filter(g => goalMetricsById[g.id]?.isCompleted).length,
    [activeGoals, goalMetricsById]
  );

  const linkedGoalsCount = useMemo(
    () => activeGoals.filter(g => goalMetricsById[g.id]?.hasLinkedItems).length,
    [activeGoals, goalMetricsById]
  );

  const filteredGoals = useMemo(() => {
    if (filterMode === 'archived') return archivedGoals;
    return activeGoals.filter(g => {
      const metrics = goalMetricsById[g.id];
      if (filterMode === 'completed') return Boolean(metrics?.isCompleted);
      if (filterMode === 'linked') return Boolean(metrics?.hasLinkedItems);
      return true;
    });
  }, [activeGoals, archivedGoals, goalMetricsById, filterMode]);

  return (
    <div className="space-y-1.5 animate-in fade-in duration-200 pb-6">
      {/* Single Compact Material 3 Expressive Control Bar */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="p-1 rounded-[20px] flex items-center justify-between gap-1.5 w-full min-w-0 max-w-full relative z-20"
      >
        <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs overflow-x-auto no-scrollbar min-w-0">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 ${
              filterMode === 'all' ? 'rounded-full' : 'rounded-l-full rounded-r-[6px]'
            } font-bold text-[11px] sm:text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            All ({activeGoals.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('linked')}
            className={`px-3 py-1.5 ${
              filterMode === 'linked' ? 'rounded-full' : 'rounded-[6px]'
            } font-bold text-[11px] sm:text-xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'linked'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            <CheckSquare className={`w-3 h-3 shrink-0 ${filterMode === 'linked' ? 'text-white' : 'text-indigo-500'}`} />
            <span>Linked ({linkedGoalsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1.5 ${
              filterMode === 'completed' ? 'rounded-full' : 'rounded-[6px]'
            } font-bold text-[11px] sm:text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'completed'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            Done ({completedGoalsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('archived')}
            className={`px-3 py-1.5 ${
              filterMode === 'archived' ? 'rounded-full' : 'rounded-r-full rounded-l-[6px]'
            } font-bold text-[11px] sm:text-xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 tabular-nums ${
              filterMode === 'archived'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            <Archive className="w-3 h-3 shrink-0" />
            <span>Archived{archivedGoals.length > 0 ? ` (${archivedGoals.length})` : ''}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => openEntitiesModal('tags')}
            className="h-8 px-2.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
            title="Manage Tags Hub"
          >
            <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline text-[11px]">Tags</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGoalModal(true)}
            className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center"
            title="New Goal"
            aria-label="New Goal"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Material 3 Expressive Compact KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-1.5">
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="group px-2.5 py-1.5 rounded-[16px] flex items-center gap-2"
        >
          <PetalShapeBadge
            shape="clover"
            sizeClass="w-8 h-8"
            fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.35)' : 'rgba(79, 70, 229, 0.25)'}
          >
            <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex items-baseline justify-between flex-1 gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate">
              Total Goals
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums">
              {activeGoals.length}
            </span>
          </div>
        </div>

        <div
          data-m3-tonal-card="true"
          data-tonal-tone="paid"
          className="group px-2.5 py-1.5 rounded-[16px] flex items-center gap-2"
        >
          <PetalShapeBadge
            shape="cookie12"
            sizeClass="w-8 h-8"
            fillColor={isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)'}
          >
            <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex items-baseline justify-between flex-1 gap-1.5">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Achieved
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 leading-tight tabular-nums">
              {completedGoalsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Material 3 Expressive Goal Cards Grid */}
      {filteredGoals.length === 0 ? (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="p-7 rounded-[22px] text-center flex flex-col items-center justify-center gap-2.5"
        >
          <PetalShapeBadge
            shape="scallop"
            sizeClass="w-12 h-12"
            fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(79, 70, 229, 0.1)'}
            strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(79, 70, 229, 0.2)'}
          >
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </PetalShapeBadge>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {filterMode === 'all'
                ? 'No goals created yet'
                : filterMode === 'archived'
                ? 'No archived goals'
                : `No ${filterMode} goals`}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {filterMode === 'archived'
                ? 'Achieved or paused goals you archive will appear here for easy restoration.'
                : 'Set a milestone and connect tasks or habits to track real progress.'}
            </p>
          </div>
        </div>
      ) : (
        (() => {
          const renderGoalCard = (goal: Goal, goalIdx: number, colTotal: number) => {
            const metrics = goalMetricsById[goal.id];
            const linkedTasks = metrics?.linkedTasks || [];
            const linkedHabits = metrics?.linkedHabits || [];
            const totalCount = metrics?.totalCount || 0;
            const completedCount = metrics?.completedCount || 0;
            const calculatedProgress = metrics?.calculatedProgress ?? goal.progress;
            const isCompleted = metrics?.isCompleted ?? false;
            const remainingCount = Math.max(0, totalCount - completedCount);

            const accentColor =
              goal.accentColor || (goal.color && goal.color !== '#ffffff' ? goal.color : '#4f46e5');
            const safeTitleColor = getSafeFontColor(goal.fontColor, isDarkMode);
            const goalTags =
              goal.tags && goal.tags.length > 0 ? goal.tags : goal.tag ? [goal.tag] : [];
            const statusMeta =
              GOAL_STATUS_META[isCompleted ? 'completed' : goal.status] || GOAL_STATUS_META.on_track;

            type MilestoneEntry =
              | { kind: 'task'; key: string; id: string; title: string; done: boolean; recurring?: string }
              | { kind: 'habit'; key: string; id: string; title: string; done: boolean; icon?: string };

            const allMilestones: MilestoneEntry[] = [
              ...linkedTasks.map(t => ({
                kind: 'task' as const,
                key: `task-${t.id}`,
                id: t.id,
                title: t.title,
                done: isGoalTaskDone(t),
                recurring: t.recurring && t.recurring !== 'none' ? t.recurring : undefined,
              })),
              ...linkedHabits.map(h => ({
                kind: 'habit' as const,
                key: `habit-${h.id}`,
                id: h.id,
                title: h.name,
                done: Boolean(h.completionHistory?.[todayStr]),
                icon: h.icon,
              })),
            ];

            const isExpanded = Boolean(expandedGoalIds[goal.id]);

            return (
              <div
                key={goal.id}
                data-m3-tonal-card="true"
                data-tonal-tone={goal.archived ? 'archived' : isCompleted ? 'done' : 'neutral'}
                className={`group relative w-full min-w-0 max-w-full overflow-hidden p-2.5 sm:p-3 ${getPetalGroupRadiusClass(goalIdx, colTotal, false)} flex flex-col justify-between gap-2`}
              >
                {/* Compact Header: M3 Petal Badge, Title, Metadata & Quick Actions */}
                <div className="space-y-1.5 min-w-0 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <PetalShapeBadge
                        shape={isCompleted ? 'cookie12' : 'clover'}
                        sizeClass="w-8 h-8 mt-0.5"
                        fillColor={`${accentColor}1c`}
                        strokeColor={`${accentColor}40`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 stroke-[2.75]" style={{ color: accentColor }} />
                        ) : (
                          <Target className="w-4 h-4" style={{ color: accentColor }} />
                        )}
                      </PetalShapeBadge>

                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-[14.5px] sm:text-[15px] leading-snug tracking-tight truncate ${
                            goal.isBold ? 'font-extrabold' : 'font-bold'
                          } text-slate-900 dark:text-white`}
                          style={safeTitleColor ? { color: safeTitleColor } : undefined}
                        >
                          {goal.title}
                        </h3>

                        {/* Quiet Unboxed Typographic Metadata Line */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                          <span className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap">
                            <Calendar className="w-3 h-3 opacity-75 shrink-0" />
                            <span>{formatGoalDueDate(goal.targetDate)}</span>
                          </span>
                          <span aria-hidden="true" className="opacity-50">·</span>
                          <span className={`font-semibold whitespace-nowrap ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </span>
                          {goalTags.length > 0 && (
                            <>
                              <span aria-hidden="true" className="opacity-50">·</span>
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                {goalTags.slice(0, 2).map(tag => (
                                  <InlineTagMeta
                                    key={tag}
                                    tag={tag}
                                    appTags={tags}
                                    className="text-[10.5px]"
                                  />
                                ))}
                                {goalTags.length > 2 && (
                                  <span className="text-slate-400 dark:text-zinc-500 tabular-nums">
                                    +{goalTags.length - 2}
                                  </span>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!goal.archived && (
                        <button
                          type="button"
                          onClick={() => handleToggleArchiveGoal(goal)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Archive Goal"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingGoal(goal)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit Goal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate pl-10 -mt-0.5">
                      {goal.description}
                    </p>
                  )}

                </div>

                {/* Unified Compact Milestones + Progress Drawer */}
                <div className="min-w-0 w-full">
                  <button
                    type="button"
                    onClick={() => toggleGoalExpanded(goal.id)}
                    className="w-full min-w-0 px-2.5 py-1.5 rounded-[12px] bg-[#f5f7fb] dark:bg-[#171a24] border border-slate-300/80 dark:border-zinc-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/60 flex flex-col gap-1.5 text-[11px] transition-colors cursor-pointer"
                  >
                    <div className="w-full min-w-0 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-slate-700 dark:text-zinc-200 shrink-0">
                          Milestones
                        </span>
                        <span className="text-slate-400 dark:text-zinc-500 font-semibold tabular-nums inline-flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-0.5">
                            <CheckSquare className="w-3 h-3 text-indigo-500" />
                            {linkedTasks.length}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-emerald-500" />
                            {linkedHabits.length}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10.5px] font-semibold text-slate-500 dark:text-zinc-400 tabular-nums">
                          {totalCount > 0 ? `${completedCount}/${totalCount}` : '0/0'}
                        </span>
                        <span
                          className="text-[11px] font-extrabold tabular-nums"
                          style={{ color: isCompleted ? '#10b981' : accentColor }}
                        >
                          {calculatedProgress}%
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>
                    </div>

                    <div className="relative w-full h-1.5 rounded-full bg-slate-200/90 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${calculatedProgress}%`,
                          backgroundColor: isCompleted ? '#10b981' : accentColor,
                        }}
                      />
                    </div>
                  </button>

                  <SmoothCollapse isOpen={isExpanded}>
                    <div className="pt-1.5 min-w-0 w-full">
                      {totalCount > 0 ? (
                        <div className="space-y-[3px] min-w-0 w-full">
                          {allMilestones.map((item, idx) => {
                            const radiusClass = getPetalGroupRadiusClass(
                              idx,
                              allMilestones.length,
                              true
                            );

                            const handleToggle = () => {
                              if (item.kind === 'task') toggleTask(item.id);
                              else toggleHabitDay(item.id, todayStr);
                            };

                            return (
                              <div
                                key={item.key}
                                className={`${radiusClass} w-full min-w-0 max-w-full overflow-hidden px-2.5 py-1.5 flex items-center justify-between gap-2 border border-slate-200/80 dark:border-zinc-800/80 transition-colors ${
                                  item.kind === 'habit'
                                    ? 'bg-emerald-50/55 hover:bg-emerald-50/90 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35'
                                    : 'bg-[#f5f7fb] hover:bg-[#edf1f9] dark:bg-[#171a24] dark:hover:bg-[#1e2230]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={handleToggle}
                                    className={`w-[17px] h-[17px] rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                      item.done
                                        ? item.kind === 'habit'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-indigo-600 text-white'
                                        : item.kind === 'habit'
                                        ? 'bg-white dark:bg-zinc-900 ring-[1.5px] ring-emerald-400/80 dark:ring-emerald-700 hover:ring-emerald-600'
                                        : 'bg-white dark:bg-zinc-900 ring-[1.5px] ring-slate-300 dark:ring-zinc-600 hover:ring-indigo-500'
                                    }`}
                                    title={item.done ? 'Mark incomplete' : 'Mark complete'}
                                  >
                                    {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </button>

                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`text-xs block truncate select-none ${
                                        item.done
                                          ? 'line-through text-slate-400 dark:text-zinc-500'
                                          : 'text-slate-800 dark:text-zinc-200 font-medium'
                                      }`}
                                    >
                                      {item.kind === 'habit' && item.icon ? `${item.icon} ` : ''}
                                      {item.title}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-semibold shrink-0 ${
                                    item.kind === 'habit'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-indigo-500 dark:text-indigo-400'
                                  }`}
                                >
                                  {item.kind === 'habit'
                                    ? 'Habit'
                                    : item.recurring
                                    ? item.recurring
                                    : 'Task'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-[12px] bg-[#f5f7fb] dark:bg-[#171a24] border border-slate-200/80 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400">
                          Link tasks or habits below to track milestones.
                        </div>
                      )}
                    </div>
                  </SmoothCollapse>
                </div>

                {/* Compact Footer */}
                <div className="pt-1.5 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 tabular-nums truncate">
                    {totalCount === 0
                      ? '0 linked'
                      : remainingCount === 0
                      ? 'All done'
                      : `${remainingCount} remaining`}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {goal.archived ? (
                      <button
                        type="button"
                        onClick={() => handleToggleArchiveGoal(goal)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/55 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10.5px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                        title="Restore goal to active list"
                      >
                        <ArchiveRestore className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setLinkEntitiesGoal(goal);
                            setLinkEntitiesTab('tasks');
                          }}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/55 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10.5px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                          title="Add or link task for this goal"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Task</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLinkEntitiesGoal(goal);
                            setLinkEntitiesTab('habits');
                          }}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/55 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                          title="Add or link habit for this goal"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Habit</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          if (isDesktopMd && filteredGoals.length > 1) {
            const [leftGoals, rightGoals] = distributeIntoTwoColumns(filteredGoals);
            return (
              <div className="grid grid-cols-2 gap-2.5 items-start w-full min-w-0">
                <div className="flex flex-col gap-[3px] min-w-0">
                  {leftGoals.map((g, idx) => renderGoalCard(g, idx, leftGoals.length))}
                </div>
                <div className="flex flex-col gap-[3px] min-w-0">
                  {rightGoals.map((g, idx) => renderGoalCard(g, idx, rightGoals.length))}
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-[3px] w-full min-w-0">
              {filteredGoals.map((g, idx) => renderGoalCard(g, idx, filteredGoals.length))}
            </div>
          );
        })()
      )}

      {/* Create or Edit Goal Unified Modal */}
      <GoalEditModal
        isOpen={showGoalModal || Boolean(editingGoal)}
        onClose={() => {
          setShowGoalModal(false);
          setEditingGoal(null);
        }}
        goal={editingGoal}
      />

      {/* Link Tasks Modal */}
      {linkModalTarget && (
        <LinkTasksModal
          isOpen={Boolean(linkModalTarget)}
          onClose={() => setLinkModalTarget(null)}
          targetType={linkModalTarget.type}
          targetId={linkModalTarget.id}
          targetTitle={linkModalTarget.title}
          targetColor={linkModalTarget.color}
        />
      )}

      {/* Link Entities Modal (Tasks & Habits) */}
      {linkEntitiesGoal && (
        <LinkEntitiesModal
          isOpen={Boolean(linkEntitiesGoal)}
          onClose={() => setLinkEntitiesGoal(null)}
          goal={linkEntitiesGoal}
          initialTab={linkEntitiesTab === 'habits' ? 'habits' : 'tasks'}
          onOpenCreateTask={() => {
            setTaskModalDefaultGoalId(linkEntitiesGoal.id);
            setIsTaskModalOpen(true);
          }}
          onOpenCreateHabit={() => {
            setHabitModalGoal(linkEntitiesGoal);
          }}
        />
      )}

      {/* Create Habit Directly Linked to Goal Modal */}
      <HabitFormModal
        isOpen={Boolean(habitModalGoal)}
        onClose={() => setHabitModalGoal(null)}
        defaultGoalId={habitModalGoal?.id}
      />

      {/* Create Task Directly Linked Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        defaultGoalId={taskModalDefaultGoalId}
      />

      {/* Archive Goal Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveGoal)}
        itemName={pendingArchiveGoal?.title}
        itemType="Goal"
        onConfirm={() => {
          if (pendingArchiveGoal) {
            executeToggleArchiveGoal(pendingArchiveGoal);
            setPendingArchiveGoal(null);
          }
        }}
        onCancel={() => setPendingArchiveGoal(null)}
      />
    </div>
  );
};
