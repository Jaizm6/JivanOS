import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Target,
  Calendar,
  Clock,
  CheckSquare,
  Flame,
  Link2,
  Unlink,
  Tag,
  Palette,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Goal } from '../../types';

interface GoalEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
}

export const GoalEditModal: React.FC<GoalEditModalProps> = ({ isOpen, onClose, goal }) => {
  const {
    updateGoal,
    soundEngine,
    pushNotification,
    tasks = [],
    addTask,
    updateTask,
    scheduleItems = [],
    addScheduleItem,
    updateScheduleItem,
    habits = [],
    updateHabit,
    tags: appTags = [],
  } = useApp();

  const [title, setTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState('career');
  const [newTagInput, setNewTagInput] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#6366f1');

  // Active popover: null | 'category' | 'date' | 'color' | 'linked'
  const [activePopup, setActivePopup] = useState<null | 'category' | 'date' | 'color' | 'linked'>(null);
  const [activeLinkTab, setActiveLinkTab] = useState<'tasks' | 'events' | 'habits'>('tasks');

  // Inputs for adding new items inside linked popover
  const [newItemTitle, setNewItemTitle] = useState('');
  const [selectedUnlinkedId, setSelectedUnlinkedId] = useState('');

  const availableTags = Array.from(
    new Set([
      ...(appTags || []).map(t => (typeof t === 'string' ? t : t?.name).toLowerCase().trim()),
      ...(tasks || []).flatMap(t => (t.tags || []).map(x => x.toLowerCase().trim())),
      'career', 'health', 'finance', 'personal', 'learning', 'projects', 'fitness'
    ].filter(Boolean))
  );

  const colorPresets = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316'];

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '');
      const initialTag = (goal.tags && goal.tags[0]) || goal.tag || goal.category || 'career';
      setSelectedTag(initialTag);
      setTargetDate(goal.targetDate || '');
      setColor(goal.color || '#6366f1');
      setActivePopup(null);
      setNewItemTitle('');
      setSelectedUnlinkedId('');
    }
  }, [goal, isOpen]);

  if (!isOpen || !goal) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Currently linked items
  const linkedTasks = tasks.filter(t => t.goalId === goal.id);
  const linkedEvents = scheduleItems.filter(
    e => e.goalId === goal.id || (e.taskId && linkedTasks.some(t => t.id === e.taskId))
  );
  const linkedHabits = habits.filter(h => h.goalId === goal.id);

  // Unlinked items available to link
  const unlinkedTasks = tasks.filter(t => !t.goalId || t.goalId !== goal.id);
  const unlinkedEvents = scheduleItems.filter(e => !e.goalId || e.goalId !== goal.id);
  const unlinkedHabits = habits.filter(h => !h.goalId || h.goalId !== goal.id);

  const completedHabitsCount = linkedHabits.filter(h => Boolean(h.completionHistory?.[todayStr])).length;
  const totalCount = linkedTasks.length + linkedEvents.length + linkedHabits.length;
  const completedCount =
    linkedTasks.filter(t => t.completed).length +
    linkedEvents.filter(e => e.completed).length +
    completedHabitsCount;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : goal.progress || 0;

  // Add / Link / Unlink actions
  const handleAddNewItem = () => {
    if (!newItemTitle.trim()) return;

    if (activeLinkTab === 'tasks') {
      addTask({
        title: newItemTitle.trim(),
        priority: 'medium',
        completed: false,
        goalId: goal.id,
      } as any);
    } else if (activeLinkTab === 'events') {
      addScheduleItem({
        title: newItemTitle.trim(),
        date: targetDate || todayStr,
        startTime: '09:00',
        endTime: '10:00',
        completed: false,
        goalId: goal.id,
        category: 'event',
      } as any);
    }
    setNewItemTitle('');
    soundEngine?.playPill?.();
  };

  const handleLinkExisting = () => {
    if (!selectedUnlinkedId) return;

    if (activeLinkTab === 'tasks') {
      const task = tasks.find(t => t.id === selectedUnlinkedId);
      if (task) updateTask({ ...task, goalId: goal.id });
    } else if (activeLinkTab === 'events') {
      const ev = scheduleItems.find(e => e.id === selectedUnlinkedId);
      if (ev) updateScheduleItem({ ...ev, goalId: goal.id });
    } else if (activeLinkTab === 'habits') {
      const hb = habits.find(h => h.id === selectedUnlinkedId);
      if (hb) updateHabit({ ...hb, goalId: goal.id });
    }
    setSelectedUnlinkedId('');
    soundEngine?.playPill?.();
  };

  const handleUnlink = (id: string, type: 'task' | 'event' | 'habit') => {
    if (type === 'task') {
      const t = tasks.find(x => x.id === id);
      if (t) updateTask({ ...t, goalId: undefined });
    } else if (type === 'event') {
      const e = scheduleItems.find(x => x.id === id);
      if (e) updateScheduleItem({ ...e, goalId: undefined });
    } else if (type === 'habit') {
      const h = habits.find(x => x.id === id);
      if (h) updateHabit({ ...h, goalId: undefined });
    }
    soundEngine?.playPill?.();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    const finalTag = (selectedTag || 'career').trim().replace(/^#/, '');

    updateGoal({
      ...goal,
      title: title.trim(),
      category: finalTag,
      tag: finalTag,
      tags: [finalTag],
      targetDate,
      color,
      status: progress === 100 ? 'completed' : 'on_track',
      progress,
    });

    soundEngine?.playSuccessChime?.();
    pushNotification('Goal Updated', `"${title.trim()}" saved.`, 'system');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-[#121214] text-zinc-100 rounded-3xl border border-zinc-800/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: color }}
            />
            <span className="text-base font-bold text-zinc-100 tracking-tight">
              Edit Goal
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Main Goal Title Input: Outlined box with floating "Goal" label */}
        <div className="px-5 pt-3 pb-3">
          <div
            className="relative border rounded-2xl bg-zinc-900/40 p-3 pt-2.5 focus-within:ring-1 transition"
            style={{ borderColor: color }}
          >
            <label
              className="absolute -top-2.5 left-3 px-1.5 bg-[#121214] text-[11px] font-semibold tracking-wide uppercase"
              style={{ color }}
            >
              Goal
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="What is your goal?"
              className="w-full bg-transparent text-sm sm:text-base font-medium text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Property Rows: Sleek vertical stack matching video design */}
        <div className="flex-1 overflow-y-auto px-5 divide-y divide-zinc-800/60 custom-scrollbar">
          {/* Row 1: Category / Tag */}
          <div
            onClick={() => setActivePopup('category')}
            className="py-3 flex items-center justify-between cursor-pointer group hover:bg-zinc-900/40 px-2 rounded-xl transition"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-amber-500" />
              <span className="text-xs sm:text-sm font-medium text-zinc-200">Category / Tag</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              #{selectedTag}
            </span>
          </div>

          {/* Row 2: Target Date */}
          <div
            onClick={() => setActivePopup('date')}
            className="py-3 flex items-center justify-between cursor-pointer group hover:bg-zinc-900/40 px-2 rounded-xl transition"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-xs sm:text-sm font-medium text-zinc-200">Target Date</span>
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition"
            >
              {targetDate || 'No date set'}
            </button>
          </div>

          {/* Row 3: Theme Color */}
          <div
            onClick={() => setActivePopup('color')}
            className="py-3 flex items-center justify-between cursor-pointer group hover:bg-zinc-900/40 px-2 rounded-xl transition"
          >
            <div className="flex items-center gap-3">
              <Palette className="w-4 h-4 text-amber-500" />
              <span className="text-xs sm:text-sm font-medium text-zinc-200">Theme Color</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>

          {/* Row 4: Linked Objectives (Tasks, Events, Habits) */}
          <div
            onClick={() => setActivePopup('linked')}
            className="py-3 flex items-center justify-between cursor-pointer group hover:bg-zinc-900/40 px-2 rounded-xl transition"
          >
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-xs sm:text-sm font-medium text-zinc-200 block">
                  Linked Objectives
                </span>
                <span className="text-[11px] text-zinc-500 block leading-tight">
                  Tasks, Events & Habits
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-mono font-semibold border border-zinc-700/60">
              {totalCount > 0 ? `${completedCount}/${totalCount}` : '0 items'}
            </span>
          </div>

          {/* Row 5: Progress Indicator */}
          <div className="py-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs sm:text-sm font-medium text-zinc-200">Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 sm:w-28 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-zinc-300">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions: CANCEL and CONFIRM */}
        <div className="px-5 py-4 pb-6 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-950/90 shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-zinc-200 uppercase tracking-wider transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="text-xs sm:text-sm font-bold text-amber-500 hover:text-amber-400 uppercase tracking-wider transition cursor-pointer px-4 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
          >
            Confirm
          </button>
        </div>

        {/* ============================================================ */}
        {/* POPUPS                                                       */}
        {/* ============================================================ */}

        {/* 1. Category / Tag Popover */}
        {activePopup === 'category' && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full max-w-sm space-y-3 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-500" />
                  Select Tag / Category
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopup(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {availableTags.map(tagName => (
                  <button
                    key={tagName}
                    type="button"
                    onClick={() => {
                      setSelectedTag(tagName);
                      setActivePopup(null);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition cursor-pointer border ${
                      selectedTag.toLowerCase() === tagName.toLowerCase()
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-800/70 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    #{tagName}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex gap-1.5">
                <input
                  type="text"
                  placeholder="New tag..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleaned = newTagInput.trim().replace(/^#/, '');
                    if (cleaned) {
                      setSelectedTag(cleaned);
                      setNewTagInput('');
                      setActivePopup(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 text-black font-bold text-xs hover:bg-amber-500"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Target Date Popover */}
        {activePopup === 'date' && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full max-w-sm space-y-3 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Target Date
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopup(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="date"
                value={targetDate}
                onChange={e => {
                  setTargetDate(e.target.value);
                  setActivePopup(null);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* 3. Theme Color Popover */}
        {activePopup === 'color' && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full max-w-sm space-y-3 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-500" />
                  Choose Color
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopup(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3 py-2">
                {colorPresets.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setActivePopup(null);
                    }}
                    className={`h-10 rounded-xl transition flex items-center justify-center ${
                      color === c ? 'ring-2 ring-white scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-5 h-5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. Linked Objectives Popover (Tasks, Events, Habits) */}
        {activePopup === 'linked' && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-full max-w-md space-y-3 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  Linked Objectives ({totalCount})
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopup(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-tabs: Tasks, Events, Habits */}
              <div className="flex bg-zinc-800 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveLinkTab('tasks')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeLinkTab === 'tasks' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Tasks ({linkedTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLinkTab('events')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeLinkTab === 'events' ? 'bg-amber-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Events ({linkedEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLinkTab('habits')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeLinkTab === 'habits' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Habits ({linkedHabits.length})
                </button>
              </div>

              {/* List of currently linked items in active tab */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {activeLinkTab === 'tasks' &&
                  (linkedTasks.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 text-xs">No linked tasks.</div>
                  ) : (
                    linkedTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs"
                      >
                        <span className={`truncate ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnlink(t.id, 'task')}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                          title="Unlink"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ))}

                {activeLinkTab === 'events' &&
                  (linkedEvents.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 text-xs">No linked events.</div>
                  ) : (
                    linkedEvents.map(e => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs"
                      >
                        <span className="text-zinc-200 truncate">{e.title}</span>
                        <button
                          type="button"
                          onClick={() => handleUnlink(e.id, 'event')}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                          title="Unlink"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ))}

                {activeLinkTab === 'habits' &&
                  (linkedHabits.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 text-xs">No linked habits.</div>
                  ) : (
                    linkedHabits.map(h => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs"
                      >
                        <span className="text-zinc-200 truncate">{h.name || (h as any).title}</span>
                        <button
                          type="button"
                          onClick={() => handleUnlink(h.id, 'habit')}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                          title="Unlink"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ))}
              </div>

              {/* Quick Add / Link Row */}
              {activeLinkTab !== 'habits' && (
                <div className="flex gap-1.5 pt-2 border-t border-zinc-800">
                  <input
                    type="text"
                    placeholder={`+ Add new ${activeLinkTab.slice(0, -1)}...`}
                    value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewItem();
                      }
                    }}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded-xl"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Link Existing dropdown */}
              <div className="flex gap-1.5">
                <select
                  value={selectedUnlinkedId}
                  onChange={e => setSelectedUnlinkedId(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Link existing {activeLinkTab}...</option>
                  {activeLinkTab === 'tasks' &&
                    unlinkedTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  {activeLinkTab === 'events' &&
                    unlinkedEvents.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  {activeLinkTab === 'habits' &&
                    unlinkedHabits.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name || (h as any).title}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkExisting}
                  disabled={!selectedUnlinkedId}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs rounded-xl disabled:opacity-40"
                >
                  Link
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActivePopup(null)}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded-xl mt-1"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
