import React, { useMemo, useState } from 'react';
import {
  Plus,
  Tag,
  Edit2,
  Trash2,
  Search,
  X,
  Check,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CheckSquare,
  Flame,
  Target,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppTag, Goal, Habit, TaskItem } from '../../types';
import { PetalShapeBadge, M3SegmentedGroup, getHabitExpressiveShape } from '../common/PetalExpressive';
import { cleanTagName, formatTagLabel, getTagColor } from '../common/TagVisuals';
import { UnifiedSubModal } from '../common/FormPrimitives';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { HabitFormModal } from '../habits/HabitFormModal';
import { GoalEditModal } from '../goals/GoalEditModal';
import { formatLocalDate } from '../../utils/date';
import { haptics } from '../../utils/haptics';
import { soundEngine } from '../../utils/audio';

type TagFilter = 'all' | 'used' | 'unused';
type DetailTab = 'all' | 'tasks' | 'habits' | 'goals';

const PRESET_TAG_COLORS = [
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const TagsManager: React.FC = () => {
  const {
    tags,
    addTag,
    updateTag,
    deleteTag,
    tasks = [],
    habits = [],
    goals = [],
    toggleTask,
    toggleHabitDay,
    pushNotification,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<TagFilter>('all');

  // Selected tag opens its own dedicated page showing linked Tasks, Habits & Goals
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('all');

  // Detail page entity quick-edit / pre-tagged create modals
  const [editingLinkedTask, setEditingLinkedTask] = useState<TaskItem | null>(null);
  const [isAddingLinkedTask, setIsAddingLinkedTask] = useState(false);
  const [editingLinkedHabit, setEditingLinkedHabit] = useState<Habit | null>(null);
  const [editingLinkedGoal, setEditingLinkedGoal] = useState<Goal | null>(null);

  // Create / Rename state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingTag, setEditingTag] = useState<AppTag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#6366f1');
  const [pendingDeleteTag, setPendingDeleteTag] = useState<{
    tag: AppTag;
    label: string;
    totalCount: number;
  } | null>(null);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  const linkedMap = useMemo(() => {
    const map = new Map<
      string,
      { linkedTasks: TaskItem[]; linkedHabits: Habit[]; linkedGoals: Goal[]; total: number }
    >();
    tags.forEach(t => {
      const clean = cleanTagName(t.name).toLowerCase();
      const linkedTasks = tasks.filter(
        item =>
          !item.archived &&
          item.status !== 'archived' &&
          item.tags?.some(tag => cleanTagName(tag).toLowerCase() === clean)
      );
      const linkedHabits = habits.filter(
        item =>
          !item.archived &&
          item.tags?.some(tag => cleanTagName(tag).toLowerCase() === clean)
      );
      const linkedGoals = goals.filter(
        item =>
          !item.archived &&
          (item.tags?.some(tag => cleanTagName(tag).toLowerCase() === clean) ||
            (item.tag && cleanTagName(item.tag).toLowerCase() === clean))
      );
      map.set(clean, {
        linkedTasks,
        linkedHabits,
        linkedGoals,
        total: linkedTasks.length + linkedHabits.length + linkedGoals.length,
      });
    });
    return map;
  }, [tags, tasks, habits, goals]);

  const getLinked = (tagName: string) => {
    const clean = cleanTagName(tagName).toLowerCase();
    return (
      linkedMap.get(clean) || {
        linkedTasks: [],
        linkedHabits: [],
        linkedGoals: [],
        total: 0,
      }
    );
  };

  const selectedTagObj = useMemo(() => {
    if (!selectedTagName) return null;
    const cleanTarget = cleanTagName(selectedTagName).toLowerCase();
    return tags.find(t => cleanTagName(t.name).toLowerCase() === cleanTarget) || null;
  }, [tags, selectedTagName]);

  const usedCount = useMemo(
    () => tags.filter(t => getLinked(t.name).total > 0).length,
    [tags, linkedMap]
  );
  const unusedCount = tags.length - usedCount;

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tags.filter(t => {
      const label = formatTagLabel(t.name).toLowerCase();
      const raw = t.name.toLowerCase();
      if (q && !label.includes(q) && !raw.includes(q)) return false;

      const total = getLinked(t.name).total;
      if (filterMode === 'used') return total > 0;
      if (filterMode === 'unused') return total === 0;
      return true;
    });
  }, [tags, searchQuery, filterMode, linkedMap]);

  const handleOpenTagDetail = (tag: AppTag) => {
    setSelectedTagName(tag.name);
    setDetailSearch('');
    setDetailTab('all');
    setIsAddingTag(false);
    setEditingTag(null);
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanTagName(newTagName);
    if (!cleaned) return;
    addTag(cleaned, newTagColor);
    pushNotification('Tag Created', `"${formatTagLabel(cleaned)}" is ready to use.`, 'system');
    setNewTagName('');
    setIsAddingTag(false);
  };

  const handleSaveTagEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanTagName(editTagName);
    if (!editingTag || !cleaned) return;
    const wasSelected =
      selectedTagName &&
      cleanTagName(selectedTagName).toLowerCase() === cleanTagName(editingTag.name).toLowerCase();
    updateTag(editingTag.name, cleaned, editTagColor);
    if (wasSelected) {
      setSelectedTagName(cleaned);
    }
    pushNotification('Tag Updated', `Saved changes to "${formatTagLabel(cleaned)}".`, 'system');
    setEditingTag(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteTag) return;
    const deletedClean = cleanTagName(pendingDeleteTag.tag.name).toLowerCase();
    deleteTag(pendingDeleteTag.tag.name);
    pushNotification('Tag Deleted', `Removed "${pendingDeleteTag.label}".`, 'system');
    if (selectedTagName && cleanTagName(selectedTagName).toLowerCase() === deletedClean) {
      setSelectedTagName(null);
    }
    setPendingDeleteTag(null);
  };

  // ============================================================================
  // DEDICATED TAG DETAIL PAGE (Linked Tasks, Habits & Goals)
  // ============================================================================
  if (selectedTagObj) {
    const tagColor = getTagColor(selectedTagObj.name, tags);
    const label = formatTagLabel(selectedTagObj.name);
    const shape = getHabitExpressiveShape(selectedTagObj.name, 0);
    const { linkedTasks, linkedHabits, linkedGoals, total } = getLinked(selectedTagObj.name);

    const dq = detailSearch.trim().toLowerCase();
    const visibleTasks = linkedTasks.filter(t =>
      !dq ? true : t.title.toLowerCase().includes(dq) || (t.notes || '').toLowerCase().includes(dq)
    );
    const visibleHabits = linkedHabits.filter(h =>
      !dq ? true : h.name.toLowerCase().includes(dq) || (h.notes || '').toLowerCase().includes(dq)
    );
    const visibleGoals = linkedGoals.filter(g =>
      !dq ? true : g.title.toLowerCase().includes(dq) || (g.description || '').toLowerCase().includes(dq)
    );

    const showGoals = detailTab === 'all' || detailTab === 'goals';
    const showHabits = detailTab === 'all' || detailTab === 'habits';
    const showTasks = detailTab === 'all' || detailTab === 'tasks';

    const visibleCount =
      (showGoals ? visibleGoals.length : 0) +
      (showHabits ? visibleHabits.length : 0) +
      (showTasks ? visibleTasks.length : 0);

    return (
      <div
        key={`tag-detail-${selectedTagObj.name}`}
        className="space-y-2 flex-1 flex flex-col min-h-full pb-6 w-full min-w-0 animate-view-enter"
      >
        {/* 1. Tag Detail Header & Controls */}
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="p-2.5 sm:p-3 rounded-[20px] space-y-2 w-full min-w-0"
        >
          {/* Row 1: Back + Tag Identity + Edit/Delete + Add Linked Task */}
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSelectedTagName(null)}
                className="h-8 px-2.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 hover:bg-slate-200/80 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                title="Back to all tags"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Tags</span>
              </button>

              <PetalShapeBadge
                shape={shape}
                sizeClass="w-8 h-8"
                fillColor={`${tagColor}1f`}
                strokeColor={`${tagColor}4a`}
              >
                <Tag className="w-3.5 h-3.5" style={{ color: tagColor }} />
              </PetalShapeBadge>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                  {label}
                </h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                  {linkedTasks.length} task{linkedTasks.length !== 1 ? 's' : ''} · {linkedHabits.length} habit{linkedHabits.length !== 1 ? 's' : ''} · {linkedGoals.length} goal{linkedGoals.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingTag(selectedTagObj);
                  setEditTagName(selectedTagObj.name);
                  setEditTagColor(tagColor);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f3f6fc] dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Rename or recolor tag"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPendingDeleteTag({
                    tag: selectedTagObj,
                    label,
                    totalCount: total,
                  })
                }
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f3f6fc] dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                title="Delete tag"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingLinkedTask(true)}
                className="h-8 w-8 sm:w-auto sm:px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                title={`New task tagged ${label}`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Add Task</span>
              </button>
            </div>
          </div>

          {/* Row 2: Search + M3 Connected Segmented Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={`Filter items tagged ${label}...`}
                value={detailSearch}
                onChange={e => setDetailSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-8 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/35 transition"
              />
              {detailSearch && (
                <button
                  type="button"
                  onClick={() => setDetailSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <M3SegmentedGroup<DetailTab>
              value={detailTab}
              onChange={setDetailTab}
              className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex"
              options={[
                { id: 'all', label: 'All', badge: total },
                { id: 'tasks', label: 'Tasks', badge: linkedTasks.length },
                { id: 'habits', label: 'Habits', badge: linkedHabits.length },
                { id: 'goals', label: 'Goals', badge: linkedGoals.length },
              ]}
            />
          </div>
        </div>

        {/* Inline Edit Tag Card on Detail Page */}
        {editingTag && (
          <form
            onSubmit={handleSaveTagEdit}
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="p-2.5 sm:p-3 rounded-[18px] ring-1 ring-amber-500/40 space-y-2.5 animate-view-enter"
          >
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Edit Tag · {formatTagLabel(editingTag.name)}
              </h5>
              <button
                type="button"
                onClick={() => setEditingTag(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editTagName}
                  onChange={e => setEditTagName(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-semibold rounded-[12px] bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Color
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_TAG_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditTagColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform shrink-0 cursor-pointer flex items-center justify-center ${
                        editTagColor === c
                          ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500/60 dark:ring-offset-zinc-900'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {editTagColor === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/75 dark:border-zinc-800/70">
              <button
                type="button"
                onClick={() => setEditingTag(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* 2. Linked Goals, Habits & Tasks Sections */}
        {visibleCount === 0 ? (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="text-center py-10 rounded-[20px] p-5 space-y-2.5"
          >
            <PetalShapeBadge
              shape={shape}
              sizeClass="w-11 h-11 mx-auto"
              fillColor={`${tagColor}1f`}
              strokeColor={`${tagColor}4a`}
            >
              <Tag className="w-5 h-5" style={{ color: tagColor }} />
            </PetalShapeBadge>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {detailSearch
                  ? `No linked items match "${detailSearch}"`
                  : `Nothing linked to ${label} yet`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {detailSearch
                  ? 'Try another search term or switch tabs above.'
                  : 'Create a task with this tag or assign it from any Task, Habit, or Goal.'}
              </p>
            </div>
            {!detailSearch && (
              <button
                type="button"
                onClick={() => setIsAddingLinkedTask(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Task with {label}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Linked Tasks */}
            {showTasks && visibleTasks.length > 0 && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tasks</span>
                    <span className="tabular-nums opacity-75">({visibleTasks.length})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2">
                  {visibleTasks.map(task => {
                    const isDone = Boolean(task.completed || task.status === 'done');
                    const subtaskCount = task.subtasks?.length || 0;
                    const subtaskDone = task.subtasks?.filter(s => s.completed).length || 0;
                    return (
                      <div
                        key={task.id}
                        data-m3-tonal-card="true"
                        data-tonal-tone="neutral"
                        className={`p-2.5 sm:p-3 rounded-[18px] flex items-center gap-2.5 min-w-0 transition-opacity ${
                          isDone ? 'opacity-65' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            haptics.toggle();
                            try { soundEngine.playWaterDropNotification(); } catch {}
                            toggleTask(task.id);
                          }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-zinc-600 hover:border-indigo-500'
                          }`}
                          title={isDone ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLinkedTask(task)}
                          className="min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <div
                            className={`text-[13px] font-bold tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                              isDone
                                ? 'line-through text-slate-400 dark:text-zinc-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {task.title}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums truncate">
                            {task.dueDate && (
                              <span className="inline-flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {task.dueDate}
                              </span>
                            )}
                            {task.priority && (
                              <span className="capitalize">{task.priority}</span>
                            )}
                            {subtaskCount > 0 && (
                              <span>{subtaskDone}/{subtaskCount} steps</span>
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLinkedTask(task)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
                          title="Open task"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Linked Habits */}
            {showHabits && visibleHabits.length > 0 && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <Flame className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Habits</span>
                    <span className="tabular-nums opacity-75">({visibleHabits.length})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2">
                  {visibleHabits.map(habit => {
                    const isDoneToday = Boolean(habit.completionHistory?.[todayStr]);
                    const habitAccent = habit.accentColor || habit.color || '#10b981';
                    return (
                      <div
                        key={habit.id}
                        data-m3-tonal-card="true"
                        data-tonal-tone="neutral"
                        className={`p-2.5 sm:p-3 rounded-[18px] flex items-center gap-2.5 min-w-0 transition-opacity ${
                          isDoneToday ? 'opacity-75' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            haptics.toggle();
                            try { soundEngine.playWaterDropNotification(); } catch {}
                            toggleHabitDay(habit.id, todayStr);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isDoneToday
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#f3f6fc] dark:bg-zinc-800 text-slate-500 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600'
                          }`}
                          title={isDoneToday ? 'Completed today' : 'Mark today complete'}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLinkedHabit(habit)}
                          className="min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <div className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {habit.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums truncate">
                            <span
                              className="inline-flex items-center gap-0.5 font-bold"
                              style={{ color: habitAccent }}
                            >
                              <Flame className="w-3 h-3" />
                              {habit.currentStreak || 0}d streak
                            </span>
                            {habit.frequency && <span className="capitalize">{habit.frequency}</span>}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLinkedHabit(habit)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
                          title="Edit habit"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Linked Goals */}
            {showGoals && visibleGoals.length > 0 && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <Target className="w-3.5 h-3.5 text-orange-500" />
                    <span>Goals</span>
                    <span className="tabular-nums opacity-75">({visibleGoals.length})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2">
                  {visibleGoals.map(goal => {
                    const goalColor = goal.color || '#6366f1';
                    const pct = Math.min(100, Math.max(0, Math.round(goal.progress ?? 0)));
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setEditingLinkedGoal(goal)}
                        data-m3-tonal-card="true"
                        data-tonal-tone="neutral"
                        className="p-2.5 sm:p-3 rounded-[18px] text-left space-y-2 min-w-0 hover:ring-1 hover:ring-indigo-500/35 transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <PetalShapeBadge
                              shape="clover"
                              sizeClass="w-7 h-7"
                              fillColor={`${goalColor}1f`}
                              strokeColor={`${goalColor}4a`}
                            >
                              <Target className="w-3.5 h-3.5" style={{ color: goalColor }} />
                            </PetalShapeBadge>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {goal.title}
                              </h4>
                              <p className="text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                                {goal.targetDate ? `Target ${goal.targetDate}` : 'No target date'}
                              </p>
                            </div>
                          </div>
                          <span
                            className="text-xs font-extrabold tabular-nums shrink-0"
                            style={{ color: goalColor }}
                          >
                            {pct}%
                          </span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: goalColor }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Linked Item Modals */}
        <TaskFormModal
          isOpen={isAddingLinkedTask || Boolean(editingLinkedTask)}
          onClose={() => {
            setIsAddingLinkedTask(false);
            setEditingLinkedTask(null);
          }}
          taskToEdit={editingLinkedTask}
          defaultTags={editingLinkedTask ? undefined : [selectedTagObj.name]}
        />

        <HabitFormModal
          isOpen={Boolean(editingLinkedHabit)}
          onClose={() => setEditingLinkedHabit(null)}
          habitToEdit={editingLinkedHabit}
        />

        <GoalEditModal
          isOpen={Boolean(editingLinkedGoal)}
          onClose={() => setEditingLinkedGoal(null)}
          goal={editingLinkedGoal}
        />

        {/* Delete Confirmation Dialog */}
        <UnifiedSubModal
          isOpen={Boolean(pendingDeleteTag)}
          onClose={() => setPendingDeleteTag(null)}
          title="Delete Tag?"
        >
          {pendingDeleteTag && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Delete "{pendingDeleteTag.label}"?
                  </p>
                  <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    {pendingDeleteTag.totalCount > 0
                      ? `This tag will be removed from ${pendingDeleteTag.totalCount} linked item${pendingDeleteTag.totalCount === 1 ? '' : 's'}.`
                      : 'This unused tag will be permanently deleted.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/75 dark:border-zinc-800/70">
                <button
                  type="button"
                  onClick={() => setPendingDeleteTag(null)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs cursor-pointer"
                >
                  Delete Tag
                </button>
              </div>
            </div>
          )}
        </UnifiedSubModal>
      </div>
    );
  }

  // ============================================================================
  // MAIN TAGS DIRECTORY PAGE
  // ============================================================================
  return (
    <div className="space-y-1.5 flex-1 flex flex-col min-h-full pb-6 w-full min-w-0 animate-view-enter">
      {/* 1. Material 3 Expressive Compact Control Bar */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="p-2 sm:p-2.5 rounded-[20px] space-y-1.5 w-full min-w-0 max-w-full overflow-hidden"
      >
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${tags.length} tags...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/35 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            id="btn-add-tag"
            type="button"
            onClick={() => {
              setIsAddingTag(prev => !prev);
              setEditingTag(null);
            }}
            className={`h-8 w-8 sm:w-auto sm:px-3 rounded-lg active:scale-95 text-xs font-bold shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
              isAddingTag
                ? 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title={isAddingTag ? 'Cancel' : 'New Tag'}
          >
            <Plus className={`w-4 h-4 stroke-[2.5] transition-transform ${isAddingTag ? 'rotate-45' : ''}`} />
            <span className="hidden sm:inline">{isAddingTag ? 'Cancel' : 'New Tag'}</span>
          </button>
        </div>

        <M3SegmentedGroup<TagFilter>
          value={filterMode}
          onChange={setFilterMode}
          className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex"
          options={[
            { id: 'all', label: 'All', badge: tags.length },
            { id: 'used', label: 'In Use', badge: usedCount },
            { id: 'unused', label: 'Unused', badge: unusedCount },
          ]}
        />
      </div>

      {/* 2. Inline Create Tag Card */}
      {isAddingTag && (
        <form
          onSubmit={handleCreateTag}
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="p-2.5 sm:p-3 rounded-[18px] ring-1 ring-indigo-500/35 space-y-2.5 animate-view-enter"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Tag Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Deep Work, Health, Personal"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                className="w-full h-9 px-3 text-xs font-semibold rounded-[12px] bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Color
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform shrink-0 cursor-pointer flex items-center justify-center ${
                      newTagColor === c
                        ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500/60 dark:ring-offset-zinc-900'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {newTagColor === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/75 dark:border-zinc-800/70">
            <button
              type="button"
              onClick={() => setIsAddingTag(false)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs cursor-pointer"
            >
              Create Tag
            </button>
          </div>
        </form>
      )}

      {/* 3. Inline Rename / Edit Tag Card */}
      {editingTag && (
        <form
          onSubmit={handleSaveTagEdit}
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="p-2.5 sm:p-3 rounded-[18px] ring-1 ring-amber-500/40 space-y-2.5 animate-view-enter"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-amber-600 dark:text-amber-400">
              Edit Tag · {formatTagLabel(editingTag.name)}
            </h5>
            <button
              type="button"
              onClick={() => setEditingTag(null)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Tag Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={editTagName}
                onChange={e => setEditTagName(e.target.value)}
                className="w-full h-9 px-3 text-xs font-semibold rounded-[12px] bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Color
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditTagColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform shrink-0 cursor-pointer flex items-center justify-center ${
                      editTagColor === c
                        ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500/60 dark:ring-offset-zinc-900'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {editTagColor === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/75 dark:border-zinc-800/70">
            <button
              type="button"
              onClick={() => setEditingTag(null)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* 4. Compact M3 Expressive Clickable Tags Grid */}
      {filteredTags.length === 0 ? (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="text-center py-10 rounded-[20px] p-5 space-y-2.5"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {searchQuery ? `No tags match "${searchQuery}"` : 'No tags in this view'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {searchQuery
                ? 'Try a different keyword or clear the search.'
                : 'Create tags to organize tasks, habits, and goals.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => {
                setIsAddingTag(true);
                setEditingTag(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Tag</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 w-full min-w-0">
          {filteredTags.map((tagItem, idx) => {
            const { linkedTasks, linkedHabits, linkedGoals, total } = getLinked(tagItem.name);
            const taskCount = linkedTasks.length;
            const habitCount = linkedHabits.length;
            const goalCount = linkedGoals.length;
            const tagColor = getTagColor(tagItem.name, tags);
            const label = formatTagLabel(tagItem.name);
            const shape = getHabitExpressiveShape(tagItem.name, idx);

            const usageParts: string[] = [];
            if (taskCount > 0) usageParts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
            if (habitCount > 0) usageParts.push(`${habitCount} habit${habitCount !== 1 ? 's' : ''}`);
            if (goalCount > 0) usageParts.push(`${goalCount} goal${goalCount !== 1 ? 's' : ''}`);
            const usageLine = usageParts.length > 0 ? usageParts.join(' · ') : 'Not used yet';

            return (
              <div
                key={tagItem.id || tagItem.name}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenTagDetail(tagItem)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenTagDetail(tagItem);
                  }
                }}
                data-m3-tonal-card="true"
                data-tonal-tone="neutral"
                className="group p-2.5 sm:p-3 rounded-[18px] flex items-center justify-between gap-2 transition-colors hover:ring-1 hover:ring-indigo-500/35 min-w-0 cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <PetalShapeBadge
                    shape={shape}
                    sizeClass="w-8 h-8"
                    fillColor={`${tagColor}1f`}
                    strokeColor={`${tagColor}4a`}
                  >
                    <Tag className="w-3.5 h-3.5" style={{ color: tagColor }} />
                  </PetalShapeBadge>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {label}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                      {usageLine}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setEditingTag(tagItem);
                      setEditTagName(tagItem.name);
                      setEditTagColor(tagColor);
                      setIsAddingTag(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Edit Tag"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setPendingDeleteTag({
                        tag: tagItem,
                        label,
                        totalCount: total,
                      });
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete Tag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 group-hover:text-indigo-500 transition-colors ml-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Delete Confirmation Dialog */}
      <UnifiedSubModal
        isOpen={Boolean(pendingDeleteTag)}
        onClose={() => setPendingDeleteTag(null)}
        title="Delete Tag?"
      >
        {pendingDeleteTag && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Delete "{pendingDeleteTag.label}"?
                </p>
                <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {pendingDeleteTag.totalCount > 0
                    ? `This tag will be removed from ${pendingDeleteTag.totalCount} linked item${pendingDeleteTag.totalCount === 1 ? '' : 's'}.`
                    : 'This unused tag will be permanently deleted.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/75 dark:border-zinc-800/70">
              <button
                type="button"
                onClick={() => setPendingDeleteTag(null)}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs cursor-pointer"
              >
                Delete Tag
              </button>
            </div>
          </div>
        )}
      </UnifiedSubModal>
    </div>
  );
};
