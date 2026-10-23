import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  PlusCircle,
  Calendar,
  Layers,
  Check,
  X,
  Compass,
  Link2,
  Clock,
  CheckSquare,
  Tag,
  Flame,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Goal, GoalCategory, TaskItem } from '../../types';
import { GoalEditModal } from './GoalEditModal';
import { LinkTasksModal } from './LinkTasksModal';
import { LinkEntitiesModal } from './LinkEntitiesModal';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { ActivityManager } from '../common/ActivityManager';

const PRESET_TAG_COLORS = [
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const GoalsManager: React.FC = () => {
  const {
    goals,
    addGoal,
    deleteGoal,
    tasks,
    toggleTask,
    addTask,
    scheduleItems,
    toggleScheduleItem,
    addScheduleItem,
    habits = [],
    toggleHabitDay,
    openEntitiesModal,
  } = useApp();

  const [showGoalModal, setShowGoalModal] = useState(false);

  // Edit Modals State
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

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

  // Add Event Directly Linked to Goal Modal State
  const [eventModalGoal, setEventModalGoal] = useState<Goal | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');

  // Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('career');
  const [goalTargetDate, setGoalTargetDate] = useState(
    new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  );
  const [goalColor, setGoalColor] = useState('#6366f1');
  const [initialTasksList, setInitialTasksList] = useState<string[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'completed'>('all');

  const handleAddTaskInput = () => {
    if (!newTaskText.trim()) return;
    setInitialTasksList(prev => [...prev, newTaskText.trim()]);
    setNewTaskText('');
  };

  const handleRemoveTaskInput = (index: number) => {
    setInitialTasksList(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const newGoalId = `goal_${Date.now()}`;
    addGoal({
      id: newGoalId,
      title: goalTitle.trim(),
      category: goalCategory,
      targetDate: goalTargetDate,
      color: goalColor,
      status: 'on_track',
      progress: 0,
      milestones: [],
    } as any);

    // Create any initial tasks linked to this goal
    initialTasksList.forEach(tTitle => {
      addTask({
        title: tTitle,
        priority: 'medium',
        completed: false,
        goalId: newGoalId,
        taskType: 'goal',
      } as any);
    });

    // Reset Form
    setGoalTitle('');
    setGoalCategory('career');
    setInitialTasksList([]);
    setGoalColor('#6366f1');
    setShowGoalModal(false);
  };

  const openAddTaskForGoal = (goal: Goal) => {
    setTaskModalDefaultGoalId(goal.id);
    setIsTaskModalOpen(true);
  };

  const openAddEventForGoal = (goal: Goal) => {
    setEventModalGoal(goal);
    setEventTitle('');
    setEventDate(goal.targetDate || new Date().toISOString().split('T')[0]);
    setEventStartTime('09:00');
    setEventEndTime('10:00');
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventModalGoal || !eventTitle.trim()) return;

    addScheduleItem({
      title: eventTitle.trim(),
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      category: 'work',
      priority: 'medium',
      completed: false,
      goalId: eventModalGoal.id,
    });

    setEventModalGoal(null);
  };

  const completedGoalsCount = goals.filter(g => g.progress === 100).length;

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200 pb-4">
      {/* Goals Title Bar */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <Target className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Life Goals
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                {goals.length} active
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Set objectives and track progress
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => openEntitiesModal('tags')}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer flex items-center justify-center"
            title="Manage Tags Hub"
          >
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </button>
          <button
            onClick={() => setShowGoalModal(true)}
            className="p-1.5 sm:p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8"
            title="New Goal"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Statistics Row: Compact single row 4 columns */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
            Total Goals
          </span>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {goals.length}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block truncate">
            Achieved
          </span>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {completedGoalsCount}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[9px] sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block truncate">
            Linked Tasks
          </span>
          <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
            {tasks.filter(t => t.goalId).length}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block truncate">
            Linked Events
          </span>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {scheduleItems.filter(s => s.goalId).length}
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All Goals ({goals.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('linked')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterMode === 'linked'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span>With Linked Tasks/Events ({goals.filter(g => tasks.some(t => t.goalId === g.id) || scheduleItems.some(s => s.goalId === g.id)).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              filterMode === 'completed'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Completed ({completedGoalsCount})
          </button>
        </div>
      </div>

      {/* Goals Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals
          .filter(g => {
            if (filterMode === 'completed') return g.progress === 100 || g.status === 'completed';
            if (filterMode === 'linked') {
              const hasLinkedTasks = tasks.some(t => t.goalId === g.id);
              const hasLinkedEvents = scheduleItems.some(s => s.goalId === g.id);
              return hasLinkedTasks || hasLinkedEvents;
            }
            return true;
          })
          .map(goal => {
          const todayStr = new Date().toISOString().split('T')[0];
          const linkedTasks = tasks.filter(t => t.goalId === goal.id);
          const linkedEvents = scheduleItems.filter(e => e.goalId === goal.id || (e.taskId && linkedTasks.some(t => t.id === e.taskId)));
          const linkedHabits = habits.filter(h => h.goalId === goal.id);

          const completedHabitsCount = linkedHabits.filter(h => Boolean(h.completionHistory?.[todayStr])).length;
          const totalCount = linkedTasks.length + linkedEvents.length + linkedHabits.length;
          const completedCount =
            linkedTasks.filter(t => t.completed).length +
            linkedEvents.filter(e => e.completed).length +
            completedHabitsCount;
          const calculatedProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : goal.progress;

          return (
            <div
              key={goal.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header: Title, Category, Options */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: goal.color }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                        {goal.title}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          #{goal.category || (goal.tags && goal.tags[0]) || 'general'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Due {goal.targetDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Edit Goal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete goal "${goal.title}"?`)) {
                          deleteGoal(goal.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {goal.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed line-clamp-2">
                    {goal.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Overall Progress</span>
                    <span>{calculatedProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${calculatedProgress}%` }}
                    />
                  </div>
                </div>

                {/* Linked Tasks, Events & Habits List */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Objectives ({completedCount}/{totalCount})
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5" title="Tasks">
                        <CheckSquare className="w-2.5 h-2.5 text-indigo-500" />
                        {linkedTasks.length}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5" title="Events">
                        <Calendar className="w-2.5 h-2.5 text-amber-500" />
                        {linkedEvents.length}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5" title="Habits">
                        <Flame className="w-2.5 h-2.5 text-emerald-500" />
                        {linkedHabits.length}
                      </span>
                    </div>
                  </div>

                  {totalCount > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {/* Linked Tasks */}
                      {linkedTasks.map(t => (
                        <div
                          key={`task-${t.id}`}
                          className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleTask(t.id)}
                              className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                t.completed
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-indigo-600'
                              }`}
                              title={t.completed ? 'Mark task incomplete' : 'Mark task complete'}
                            >
                              {t.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <span
                              className={`truncate select-none ${
                                t.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                  : 'text-slate-700 dark:text-slate-300 font-medium'
                              }`}
                            >
                              {t.title}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                            Task
                          </span>
                        </div>
                      ))}

                      {/* Linked Events */}
                      {linkedEvents.map(e => (
                        <div
                          key={`event-${e.id}`}
                          className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-xl bg-amber-50/30 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/30"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleScheduleItem(e.id)}
                              className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                e.completed
                                  ? 'bg-amber-600 border-amber-600 text-white'
                                  : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 hover:border-amber-600'
                              }`}
                              title={e.completed ? 'Mark event incomplete' : 'Mark event complete'}
                            >
                              {e.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <span
                                className={`truncate block select-none ${
                                  e.completed
                                    ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                    : 'text-slate-700 dark:text-slate-300 font-medium'
                                }`}
                              >
                                {e.title}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {e.date} • {e.startTime} - {e.endTime}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100/70 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                            Event
                          </span>
                        </div>
                      ))}

                      {/* Linked Habits */}
                      {linkedHabits.map(h => {
                        const isDoneToday = Boolean(h.completionHistory?.[todayStr]);
                        return (
                          <div
                            key={`habit-${h.id}`}
                            className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => toggleHabitDay(h.id, todayStr)}
                                className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                  isDoneToday
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:border-emerald-600'
                                }`}
                                title={isDoneToday ? 'Mark habit uncompleted today' : 'Mark habit completed today'}
                              >
                                {isDoneToday && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </button>
                              <span className="text-xs shrink-0">{h.icon || '🎯'}</span>
                              <span
                                className={`truncate select-none ${
                                  isDoneToday
                                    ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                    : 'text-slate-700 dark:text-slate-300 font-medium'
                                }`}
                              >
                                {h.name}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                              Habit
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      No tasks, events, or habits linked to this goal yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Footer: 3 Buttons for + Task, + Event, + Habit */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">
                  {totalCount} item{totalCount !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkEntitiesGoal(goal);
                      setLinkEntitiesTab('tasks');
                    }}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition cursor-pointer"
                    title="Add or link task for this goal"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkEntitiesGoal(goal);
                      setLinkEntitiesTab('events');
                    }}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-400 text-[11px] font-bold transition cursor-pointer"
                    title="Add or link scheduled event for this goal"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Event</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkEntitiesGoal(goal);
                      setLinkEntitiesTab('habits');
                    }}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold transition cursor-pointer"
                    title="Add or link habit for this goal"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Habit</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Event Directly Linked to Goal Modal */}
      {eventModalGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Event to Goal</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[260px]">{eventModalGoal.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEventModalGoal(null)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Strategy Review, 10k Practice Run, Workshop"
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={eventStartTime}
                    onChange={e => setEventStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={eventEndTime}
                    onChange={e => setEventEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEventModalGoal(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Add Goal Universal Modal */}
      {showGoalModal && (
        <ActivityManager
          isOpen={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          type="goal"
        />
      )}

      {/* Edit Goal Modal */}
      <GoalEditModal
        isOpen={Boolean(editingGoal)}
        onClose={() => setEditingGoal(null)}
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

      {/* Link Entities Modal (Tasks, Events, Habits) */}
      {linkEntitiesGoal && (
        <LinkEntitiesModal
          isOpen={Boolean(linkEntitiesGoal)}
          onClose={() => setLinkEntitiesGoal(null)}
          goal={linkEntitiesGoal}
          initialTab={linkEntitiesTab}
          onOpenCreateTask={() => {
            setTaskModalDefaultGoalId(linkEntitiesGoal.id);
            setIsTaskModalOpen(true);
          }}
          onOpenCreateEvent={() => {
            openAddEventForGoal(linkEntitiesGoal);
          }}
          onOpenCreateHabit={() => {
            setHabitModalGoal(linkEntitiesGoal);
          }}
        />
      )}

      {/* Create Habit Directly Linked to Goal Modal */}
      {habitModalGoal && (
        <ActivityManager
          isOpen={Boolean(habitModalGoal)}
          onClose={() => setHabitModalGoal(null)}
          type="habit"
          activityToEdit={{ goalId: habitModalGoal.id }}
        />
      )}

      {/* Create Task Directly Linked Modal */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        defaultGoalId={taskModalDefaultGoalId}
      />
    </div>
  );
};
