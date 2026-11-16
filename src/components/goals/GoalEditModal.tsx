import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Calendar,
  Flag,
  FileText,
  Tag,
  Plus,
  Trash2,
  Check,
  Bell,
  Sparkles,
  Search,
  Edit2,
  Link2,
  CheckSquare,
  Flame,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Goal, GoalStatus, Habit, ReminderType, TaskItem } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  UnifiedFormModal,
  UnifiedSubModal,
  FormHeroTitleCard,
  FormSectionGroup,
  FormDisclosureRow,
  FormStylePopoverContent,
  CentralizedReminderPicker,
} from '../common/FormPrimitives';
import { getPetalGroupRadiusClass } from '../common/PetalExpressive';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { HabitFormModal } from '../habits/HabitFormModal';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import {
  InteractiveTagButton,
  cleanTagName,
  dedupeTagsCaseInsensitive,
  formatTagLabel,
  hasTagCaseInsensitive,
  toggleTagCaseInsensitive,
} from '../common/TagVisuals';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export interface GoalEditModalProps {
  goal?: Goal | null;
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialTargetDate?: string;
  initialMilestones?: string[];
}

export const GoalEditModal: React.FC<GoalEditModalProps> = ({
  goal = null,
  isOpen,
  onClose,
  initialTitle = '',
  initialTargetDate,
  initialMilestones = [],
}) => {
  const {
    addGoal,
    updateGoal,
    deleteGoal,
    tasks = [],
    habits = [],
    updateTask,
    updateHabit,
    toggleTask,
    toggleHabitDay,
    pushNotification,
    theme,
    tags: globalTags,
    addTag,
  } = useApp();
  const isDarkMode = theme === 'dark';

  const defaultTargetDate = () => {
    if (initialTargetDate) return initialTargetDate;
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const todayStr = useMemo(() => getTodayStr(), []);

  const [title, setTitle] = useState(goal?.title || initialTitle);
  const [description, setDescription] = useState(goal?.description || '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate || defaultTargetDate());
  const [selectedTags, setSelectedTags] = useState<string[]>(
    goal?.tags || (goal?.tag ? [goal.tag] : [])
  );
  const [status, setStatus] = useState<GoalStatus>(goal?.status || 'on_track');
  const [progress, setProgress] = useState<number>(goal?.progress ?? 0);
  const [color, setColor] = useState(goal?.color || '#4f46e5');
  const [fontColor, setFontColor] = useState(goal?.fontColor || '');
  const [fontType, setFontType] = useState<'sans' | 'mono' | 'serif' | 'rounded'>(
    goal?.fontType || 'sans'
  );
  const [isBold, setIsBold] = useState<boolean>(goal?.isBold || false);

  // Linked Milestone IDs (Tasks & Habits)
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [linkedHabitIds, setLinkedHabitIds] = useState<string[]>([]);

  // Milestones Sub-Modal state
  const [milestoneTab, setMilestoneTab] = useState<'tasks' | 'habits'>('tasks');
  const [milestoneFilter, setMilestoneFilter] = useState<'all' | 'linked'>('all');
  const [milestoneSearch, setMilestoneSearch] = useState('');
  const [editingLinkedTask, setEditingLinkedTask] = useState<TaskItem | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingLinkedHabit, setEditingLinkedHabit] = useState<Habit | null>(null);
  const [isCreatingHabit, setIsCreatingHabit] = useState(false);

  // Reminder configuration for Goal deadline / check-in
  const [reminderType, setReminderType] = useState<ReminderType>('notification');
  const [reminderTiming, setReminderTiming] = useState<string>('1d');

  // Sub-popovers
  const [activeGoalPopup, setActiveGoalPopup] = useState<
    null | 'styling' | 'tags' | 'timeline' | 'milestones' | 'notes' | 'reminder'
  >(null);

  const [newTagInput, setNewTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description || '');
      setTargetDate(goal.targetDate);
      setSelectedTags(goal.tags || (goal.tag ? [goal.tag] : []));
      setStatus(goal.status);
      setProgress(goal.progress);
      setColor(goal.color || '#4f46e5');
      setFontColor(goal.fontColor || '');
      setFontType(goal.fontType || 'sans');
      setIsBold(Boolean(goal.isBold));

      const matchedTaskIds = Array.from(
        new Set(
          tasks
            .filter(
              t =>
                t.goalId === goal.id ||
                t.projectId === goal.id ||
                (t.project && t.project.toLowerCase() === goal.title.toLowerCase())
            )
            .map(t => t.id)
        )
      );
      const matchedHabitIds = Array.from(
        new Set(habits.filter(h => h.goalId === goal.id).map(h => h.id))
      );
      setLinkedTaskIds(matchedTaskIds);
      setLinkedHabitIds(matchedHabitIds);
    } else {
      setTitle(initialTitle || '');
      setDescription('');
      setTargetDate(defaultTargetDate());
      setSelectedTags([]);
      setStatus('on_track');
      setProgress(0);
      setColor('#4f46e5');
      setFontColor('');
      setFontType('sans');
      setIsBold(false);
      setLinkedTaskIds([]);
      setLinkedHabitIds([]);
    }
    setActiveGoalPopup(null);
    setMilestoneTab('tasks');
    setMilestoneFilter('all');
    setMilestoneSearch('');
    setEditingLinkedTask(null);
    setIsCreatingTask(false);
    setEditingLinkedHabit(null);
    setIsCreatingHabit(false);
    setConfirmDelete(false);
    setConfirmArchive(false);
  }, [goal, isOpen]);

  // Live milestone completion stats derived from currently linked Tasks & Habits
  const linkedStats = useMemo(() => {
    const linkedTasksList = tasks.filter(t => linkedTaskIds.includes(t.id));
    const linkedHabitsList = habits.filter(h => linkedHabitIds.includes(h.id));
    const total = linkedTasksList.length + linkedHabitsList.length;
    const completed =
      linkedTasksList.filter(t => t.completed).length +
      linkedHabitsList.filter(h => Boolean(h.completionHistory?.[todayStr])).length;
    const calculated = total > 0 ? Math.round((completed / total) * 100) : progress;
    return {
      taskCount: linkedTasksList.length,
      habitCount: linkedHabitsList.length,
      total,
      completed,
      calculated,
    };
  }, [tasks, habits, linkedTaskIds, linkedHabitIds, todayStr, progress]);

  const toggleDraftTaskLink = (taskId: string) => {
    setLinkedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleDraftHabitLink = (habitId: string) => {
    setLinkedHabitIds(prev =>
      prev.includes(habitId) ? prev.filter(id => id !== habitId) : [...prev, habitId]
    );
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    const effectiveProgress = linkedStats.total > 0 ? linkedStats.calculated : progress;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      targetDate: targetDate || getTodayStr(),
      tags: selectedTags,
      tag: selectedTags[0] || undefined,
      status: effectiveProgress === 100 ? ('completed' as GoalStatus) : status,
      progress: effectiveProgress,
      color,
      fontColor: fontColor || undefined,
      fontType,
      isBold,
      milestones: goal?.milestones || [],
    };

    let targetGoalId = goal?.id;
    if (goal) {
      const { category: _removedCategory, ...goalWithoutCategory } = goal;
      updateGoal({
        ...goalWithoutCategory,
        ...payload,
      });
    } else {
      const created = addGoal(payload);
      targetGoalId = created.id;
    }

    if (targetGoalId) {
      const prevTitleLower = goal?.title.toLowerCase();
      tasks.forEach(t => {
        const shouldLink = linkedTaskIds.includes(t.id);
        const wasLinkedToGoal =
          t.goalId === targetGoalId ||
          t.projectId === targetGoalId ||
          Boolean(prevTitleLower && t.project?.toLowerCase() === prevTitleLower);

        if (shouldLink && t.goalId !== targetGoalId) {
          updateTask({ ...t, goalId: targetGoalId });
        } else if (!shouldLink && wasLinkedToGoal) {
          updateTask({
            ...t,
            goalId: undefined,
            projectId: t.projectId === targetGoalId ? undefined : t.projectId,
            project:
              prevTitleLower && t.project?.toLowerCase() === prevTitleLower
                ? undefined
                : t.project,
          });
        }
      });

      habits.forEach(h => {
        const shouldLink = linkedHabitIds.includes(h.id);
        if (shouldLink && h.goalId !== targetGoalId) {
          updateHabit({ ...h, goalId: targetGoalId });
        } else if (!shouldLink && h.goalId === targetGoalId) {
          updateHabit({ ...h, goalId: undefined });
        }
      });
    }

    onClose();
  };

  const statusLabels: Record<GoalStatus, { label: string; badgeClass: string }> = {
    on_track: {
      label: 'On Track',
      badgeClass: 'text-emerald-600 dark:text-emerald-400',
    },
    at_risk: {
      label: 'At Risk',
      badgeClass: 'text-amber-600 dark:text-amber-400',
    },
    behind: {
      label: 'Behind',
      badgeClass: 'text-rose-600 dark:text-rose-400',
    },
    completed: {
      label: 'Completed',
      badgeClass: 'text-indigo-600 dark:text-indigo-400',
    },
  };

  const displayedTasks = useMemo(() => {
    const q = milestoneSearch.trim().toLowerCase();
    return tasks
      .filter(t => {
        if ((t.archived || t.status === 'archived') && !linkedTaskIds.includes(t.id)) return false;
        if (q && !t.title.toLowerCase().includes(q)) return false;
        if (milestoneFilter === 'linked') return linkedTaskIds.includes(t.id);
        return true;
      })
      .sort((a, b) => {
        const aLinked = linkedTaskIds.includes(a.id) ? 0 : 1;
        const bLinked = linkedTaskIds.includes(b.id) ? 0 : 1;
        return aLinked - bLinked;
      });
  }, [tasks, milestoneSearch, milestoneFilter, linkedTaskIds]);

  const displayedHabits = useMemo(() => {
    const q = milestoneSearch.trim().toLowerCase();
    return habits
      .filter(h => {
        if (h.archived && !linkedHabitIds.includes(h.id)) return false;
        if (q && !h.name.toLowerCase().includes(q)) return false;
        if (milestoneFilter === 'linked') return linkedHabitIds.includes(h.id);
        return true;
      })
      .sort((a, b) => {
        const aLinked = linkedHabitIds.includes(a.id) ? 0 : 1;
        const bLinked = linkedHabitIds.includes(b.id) ? 0 : 1;
        return aLinked - bLinked;
      });
  }, [habits, milestoneSearch, milestoneFilter, linkedHabitIds]);

  const displayProgress = linkedStats.total > 0 ? linkedStats.calculated : progress;

  return (
    <>
      <UnifiedFormModal
        isOpen={isOpen}
        onClose={onClose}
        title={goal ? 'Edit Goal' : 'New Goal'}
        headerShape="clover"
        headerIcon={<Target size={15} />}
        accentColor={color}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {goal && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        deleteGoal(goal.id);
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 rounded-full bg-[#eff2f9] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 sm:px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title="Delete Goal"
                    >
                      <Trash2 size={13.5} />
                      <span>Delete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (goal.archived) {
                          updateGoal({
                            ...goal,
                            archived: false,
                            archivedAt: undefined,
                          });
                          pushNotification(
                            'Goal Restored',
                            `${goal.title} moved back to active goals`,
                            'system'
                          );
                          onClose();
                        } else {
                          setConfirmArchive(true);
                        }
                      }}
                      className="px-3 sm:px-3.5 py-2 rounded-full font-bold text-xs text-zinc-700 dark:text-zinc-200 bg-[#eff2f9] dark:bg-zinc-800/90 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title={goal.archived ? 'Restore Goal' : 'Archive Goal'}
                    >
                      {goal.archived ? <ArchiveRestore size={13.5} /> : <Archive size={13.5} />}
                      <span>{goal.archived ? 'Restore' : 'Archive'}</span>
                    </button>
                  </>
                )
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={!title.trim()}
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>
        }
      >
        {/* Hero Title Card */}
        <FormHeroTitleCard
          value={title}
          onChange={setTitle}
          placeholder="What milestone or life goal are you aiming for?"
          accentColor={color}
          icon={<Target size={16} />}
          iconShape="clover"
          onOpenStyle={() => setActiveGoalPopup('styling')}
          fontColor={fontColor}
          fontType={fontType}
          isBold={isBold}
          isDarkMode={isDarkMode}
          onEnterSubmit={handleSave}
          bottomSlot={
            <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold">
                {linkedStats.total > 0
                  ? `Milestones (${linkedStats.completed}/${linkedStats.total})`
                  : 'Overall Progress'}
              </span>
              <div className="flex items-center gap-2.5 flex-1 max-w-[200px]">
                <input
                  type="range"
                  min={0}
                  max={100}
                  disabled={linkedStats.total > 0}
                  value={displayProgress}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setProgress(val);
                    if (val === 100) setStatus('completed');
                  }}
                  className="w-full accent-indigo-600 h-1.5 cursor-pointer disabled:opacity-70"
                />
                <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 w-9 text-right tabular-nums">
                  {displayProgress}%
                </span>
              </div>
            </div>
          }
        />

        {/* Progressive-Disclosure Settings Rows */}
        <FormSectionGroup>
          {/* 1. Target Date & Status */}
          <FormDisclosureRow
            icon={<Calendar size={14} />}
            iconBgClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            iconShape="scallop"
            label="Target Date & Status"
            value={`${targetDate || 'No date'} · ${statusLabels[status]?.label || 'On Track'}`}
            valueClass={statusLabels[status]?.badgeClass}
            onClick={() => setActiveGoalPopup('timeline')}
          />

          {/* 2. Milestones (Linked Tasks & Habits) */}
          <FormDisclosureRow
            icon={<Flag size={14} />}
            iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            iconShape="cookie12"
            label="Milestones"
            subtitle="Linked tasks & habits"
            value={
              linkedStats.total > 0
                ? `${linkedStats.taskCount} task${linkedStats.taskCount === 1 ? '' : 's'} · ${linkedStats.habitCount} habit${linkedStats.habitCount === 1 ? '' : 's'}`
                : 'Link tasks & habits'
            }
            valueClass={
              linkedStats.total > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-400'
            }
            onClick={() => setActiveGoalPopup('milestones')}
          />

          {/* 3. Tags */}
          <FormDisclosureRow
            icon={<Tag size={14} />}
            iconBgClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            iconShape="clover"
            label="Tags"
            value={
              selectedTags.length > 0
                ? selectedTags.map(t => formatTagLabel(t)).join(', ')
                : 'Optional'
            }
            valueClass={
              selectedTags.length > 0
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-zinc-400'
            }
            onClick={() => setActiveGoalPopup('tags')}
          />

          {/* 4. Check-in & Deadline Reminder */}
          <FormDisclosureRow
            icon={<Bell size={14} />}
            iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            iconShape="cookie9"
            label="Goal Check-In Alert"
            value={
              reminderType === 'none'
                ? 'Silent'
                : `${reminderType === 'alarm' ? 'Alarm' : 'Chime'} (${reminderTiming})`
            }
            onClick={() => setActiveGoalPopup('reminder')}
          />

          {/* 5. Motivation / Why Notes */}
          <FormDisclosureRow
            icon={<FileText size={14} />}
            iconBgClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            iconShape="arch"
            label="Why & Strategy Notes"
            value={description ? description : 'Optional'}
            valueClass={description ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}
            onClick={() => setActiveGoalPopup('notes')}
          />
        </FormSectionGroup>
      </UnifiedFormModal>

      {/* SUB-MODAL 1: Style & Typography */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'styling'}
        onClose={() => setActiveGoalPopup(null)}
        title="Goal Style & Typography"
        icon={<Sparkles size={14} className="text-indigo-500" />}
        iconShape="cookie12"
      >
        <FormStylePopoverContent
          accentColor={color}
          onChangeAccentColor={setColor}
          fontColor={fontColor}
          onChangeFontColor={setFontColor}
          fontType={fontType}
          onChangeFontType={setFontType}
          isBold={isBold}
          onChangeIsBold={setIsBold}
          isDarkMode={isDarkMode}
        />
      </UnifiedSubModal>

      {/* SUB-MODAL 2: Timeline & Status */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'timeline'}
        onClose={() => setActiveGoalPopup(null)}
        title="Target Date & Status"
        icon={<Calendar size={14} className="text-blue-500" />}
        iconShape="scallop"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Target Completion Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-900 dark:text-white outline-none"
            />
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {[
                { label: '+1 Month', months: 1 },
                { label: '+3 Months', months: 3 },
                { label: '+6 Months', months: 6 },
                { label: '+1 Year', months: 12 },
              ].map(p => (
                <button
                  key={p.label}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + p.months);
                    setTargetDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116] text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Goal Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(statusLabels) as GoalStatus[]).map(st => (
                <button
                  key={st}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setStatus(st)}
                  className={`py-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                    status === st
                      ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                      : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70'
                  }`}
                >
                  {statusLabels[st].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 3: Tags */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'tags'}
        onClose={() => setActiveGoalPopup(null)}
        title="Goal Tags"
        icon={<Tag size={14} className="text-violet-500" />}
        iconShape="clover"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dedupeTagsCaseInsensitive([
                ...globalTags.map(t => t.name),
                ...selectedTags,
              ]).map(tagName => {
                const isSelected = hasTagCaseInsensitive(selectedTags, tagName);
                return (
                  <InteractiveTagButton
                    key={tagName.toLowerCase()}
                    tag={tagName}
                    selected={isSelected}
                    appTags={globalTags}
                    onClick={() =>
                      setSelectedTags(prev => toggleTagCaseInsensitive(prev, tagName))
                    }
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const clean = cleanTagName(newTagInput);
                    if (!clean) return;
                    if (!globalTags.some(g => cleanTagName(g.name).toLowerCase() === clean.toLowerCase())) {
                      addTag(clean, '#6366f1');
                    }
                    if (!hasTagCaseInsensitive(selectedTags, clean)) {
                      setSelectedTags(prev => [...prev, clean]);
                    }
                    setNewTagInput('');
                  }
                }}
                placeholder="New tag..."
                className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white outline-none"
              />
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => {
                  const clean = cleanTagName(newTagInput);
                  if (!clean) return;
                  if (!globalTags.some(g => cleanTagName(g.name).toLowerCase() === clean.toLowerCase())) {
                    addTag(clean, '#6366f1');
                  }
                  if (!hasTagCaseInsensitive(selectedTags, clean)) {
                    setSelectedTags(prev => [...prev, clean]);
                  }
                  setNewTagInput('');
                }}
                className="px-3.5 py-2 rounded-full bg-zinc-800 dark:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 4: Milestones (Linked Tasks & Habits) */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'milestones'}
        onClose={() => setActiveGoalPopup(null)}
        title="Milestones · Tasks & Habits"
        icon={<Flag size={14} className="text-emerald-500" />}
        iconShape="cookie12"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {/* Connected M3 Segmented Tab Bar + Quick Create */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-[2px] p-1 rounded-full bg-[#f1f4fa] dark:bg-zinc-900">
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setMilestoneTab('tasks')}
                className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 tabular-nums ${
                  milestoneTab === 'tasks'
                    ? 'rounded-full bg-indigo-600 text-white shadow-2xs'
                    : 'rounded-l-full rounded-r-[6px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                <CheckSquare size={12} />
                <span>Tasks ({linkedStats.taskCount})</span>
              </button>
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setMilestoneTab('habits')}
                className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 tabular-nums ${
                  milestoneTab === 'habits'
                    ? 'rounded-full bg-emerald-600 text-white shadow-2xs'
                    : 'rounded-r-full rounded-l-[6px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                <Flame size={12} />
                <span>Habits ({linkedStats.habitCount})</span>
              </button>
            </div>

            <button
              type="button"
              data-no-press-scale="true"
              onClick={() => {
                if (milestoneTab === 'tasks') setIsCreatingTask(true);
                else setIsCreatingHabit(true);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                milestoneTab === 'tasks'
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Plus size={13} className="stroke-[2.5]" />
              <span>{milestoneTab === 'tasks' ? 'Task' : 'Habit'}</span>
            </button>
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={milestoneSearch}
                onChange={e => setMilestoneSearch(e.target.value)}
                placeholder={`Search ${milestoneTab}...`}
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white outline-none"
              />
            </div>

            <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-[#f1f4fa] dark:bg-zinc-900 text-[11px] shrink-0">
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setMilestoneFilter('all')}
                className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                  milestoneFilter === 'all'
                    ? 'rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs'
                    : 'rounded-l-full rounded-r-[4px] text-zinc-500 dark:text-zinc-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setMilestoneFilter('linked')}
                className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                  milestoneFilter === 'linked'
                    ? 'rounded-full bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'rounded-r-full rounded-l-[4px] text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Linked
              </button>
            </div>
          </div>

          {/* Tasks or Habits Grouped List */}
          {milestoneTab === 'tasks' ? (
            displayedTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                {milestoneFilter === 'linked'
                  ? 'No tasks linked to this goal yet.'
                  : 'No tasks found. Tap + Task to create one.'}
              </div>
            ) : (
              <div className="space-y-[3px] max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
                {displayedTasks.map((t, idx) => {
                  const isLinked = linkedTaskIds.includes(t.id);
                  const radiusCls = getPetalGroupRadiusClass(idx, displayedTasks.length, true);
                  return (
                    <div
                      key={t.id}
                      className={`${radiusCls} px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        isLinked
                          ? 'bg-indigo-50/75 dark:bg-indigo-950/35'
                          : 'bg-[#f4f6fb] dark:bg-[#121217]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleTask(t.id)}
                          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            t.completed
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-zinc-900 ring-[1.5px] ring-slate-300 dark:ring-zinc-600 hover:ring-indigo-500'
                          }`}
                          title={t.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {t.completed && <Check size={10} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-medium truncate ${
                              t.completed
                                ? 'line-through text-zinc-400 dark:text-zinc-500'
                                : 'text-zinc-800 dark:text-zinc-100'
                            }`}
                          >
                            {t.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate tabular-nums">
                            {t.dueDate ? `Due ${t.dueDate}` : 'No due date'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          data-no-press-scale="true"
                          onClick={() => setEditingLinkedTask(t)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit task"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          data-no-press-scale="true"
                          onClick={() => toggleDraftTaskLink(t.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                            isLinked
                              ? 'bg-indigo-600 text-white hover:bg-rose-600'
                              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600'
                          }`}
                        >
                          {isLinked ? (
                            <>
                              <Check size={11} className="stroke-[2.5]" />
                              <span>Linked</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={11} />
                              <span>Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : displayedHabits.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              {milestoneFilter === 'linked'
                ? 'No habits linked to this goal yet.'
                : 'No habits found. Tap + Habit to create one.'}
            </div>
          ) : (
            <div className="space-y-[3px] max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
              {displayedHabits.map((h, idx) => {
                const isLinked = linkedHabitIds.includes(h.id);
                const doneToday = Boolean(h.completionHistory?.[todayStr]);
                const radiusCls = getPetalGroupRadiusClass(idx, displayedHabits.length, true);
                return (
                  <div
                    key={h.id}
                    className={`${radiusCls} px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                      isLinked
                        ? 'bg-emerald-50/75 dark:bg-emerald-950/35'
                        : 'bg-[#f4f6fb] dark:bg-[#121217]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleHabitDay(h.id, todayStr)}
                        className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          doneToday
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-zinc-900 ring-[1.5px] ring-emerald-400/75 dark:ring-emerald-700 hover:ring-emerald-600'
                        }`}
                        title={doneToday ? 'Mark incomplete today' : 'Mark complete today'}
                      >
                        {doneToday && <Check size={10} strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100 truncate">
                          {h.icon ? `${h.icon} ` : ''}
                          {h.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate capitalize">
                          {h.frequency || 'daily'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => setEditingLinkedHabit(h)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit habit"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => toggleDraftHabitLink(h.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                          isLinked
                            ? 'bg-emerald-600 text-white hover:bg-rose-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-emerald-600'
                        }`}
                      >
                        {isLinked ? (
                          <>
                            <Check size={11} className="stroke-[2.5]" />
                            <span>Linked</span>
                          </>
                        ) : (
                          <>
                            <Link2 size={11} />
                            <span>Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 5: Reminder & Check-in Alert */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'reminder'}
        onClose={() => setActiveGoalPopup(null)}
        title="Goal Check-In Reminder"
        icon={<Bell size={14} className="text-amber-500" />}
        iconShape="cookie9"
      >
        <CentralizedReminderPicker
          reminderType={reminderType}
          onChangeReminderType={setReminderType}
          timingMode="offset"
          reminderTiming={reminderTiming}
          onChangeReminderTiming={setReminderTiming}
          testTitle={title || 'Goal Milestone Check-In'}
          testCategory="task"
        />
      </UnifiedSubModal>

      {/* SUB-MODAL 6: Notes & Motivation */}
      <UnifiedSubModal
        isOpen={activeGoalPopup === 'notes'}
        onClose={() => setActiveGoalPopup(null)}
        title="Why & Strategy Notes"
        icon={<FileText size={14} className="text-rose-500" />}
        iconShape="arch"
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
            Motivation, Vision & Action Plan
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Why does this goal matter to you? What is your key strategy?"
            className="w-full p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/35 leading-relaxed resize-none"
          />
        </div>
      </UnifiedSubModal>

      {/* Stacked Task Form Modal (Edit or Create linked Task from Goal Edit) */}
      <TaskFormModal
        isOpen={isCreatingTask || Boolean(editingLinkedTask)}
        onClose={() => {
          setIsCreatingTask(false);
          setEditingLinkedTask(null);
        }}
        taskToEdit={editingLinkedTask}
        defaultGoalId={goal?.id}
        zIndexClass="z-[250]"
        onCreatedTask={created => {
          setLinkedTaskIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
        }}
      />

      {/* Stacked Habit Form Modal (Edit or Create linked Habit from Goal Edit) */}
      <HabitFormModal
        isOpen={isCreatingHabit || Boolean(editingLinkedHabit)}
        onClose={() => {
          setIsCreatingHabit(false);
          setEditingLinkedHabit(null);
        }}
        habitToEdit={editingLinkedHabit}
        defaultGoalId={goal?.id}
        zIndexClass="z-[250]"
        onCreatedHabit={created => {
          setLinkedHabitIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
        }}
      />

      <ArchiveConfirmModal
        isOpen={confirmArchive && Boolean(goal)}
        itemName={goal?.title}
        itemType="Goal"
        onConfirm={() => {
          setConfirmArchive(false);
          if (goal) {
            updateGoal({
              ...goal,
              archived: true,
              archivedAt: new Date().toISOString(),
            });
            pushNotification('Goal Archived', `${goal.title} moved to archive`, 'system');
            onClose();
          }
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  );
};
