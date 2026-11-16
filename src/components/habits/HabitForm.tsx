import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarClock,
  CheckSquare,
  MessageSquare,
  Trash2,
  Check,
  X,
  Plus,
  Target,
  Tag,
  Clock,
  Flame,
  Dumbbell,
  Sparkles,
  Palette,
  Repeat,
  Briefcase,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Hash,
  Timer,
  ShieldBan,
  Bell,
  BellOff,
  AlarmClock,
  Zap,
  Droplets,
} from 'lucide-react';
import {
  Habit,
  HabitCategory,
  HabitFrequency,
  HabitType,
  ReminderType,
  HabitStep,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  FormHeroTitleCard,
  UnifiedSubModal,
} from '../common/FormPrimitives';
import { PetalShapeBadge } from '../common/PetalExpressive';
import { IconRenderer } from '../common/IconRenderer';
import { StructuredIconColorPicker } from '../common/StructuredIconColorPicker';
import {
  InteractiveTagButton,
  cleanTagName,
  dedupeTagsCaseInsensitive,
  hasTagCaseInsensitive,
  toggleTagCaseInsensitive,
} from '../common/TagVisuals';

export interface HabitFormProps {
  initialHabit?: Partial<Habit>;
  onSubmit: (habitData: Partial<Habit>) => void;
  onClose: () => void;
  onDelete?: (habitId: string) => void;
  onSwitchToTask?: () => void;
  onSwitchToEvent?: () => void;
  showHeader?: boolean;
}

type ModalType =
  | 'none'
  | 'frequency'
  | 'typeTarget'
  | 'timeReminders'
  | 'subSteps'
  | 'notes'
  | 'goals'
  | 'tags';

type HabitInlineTab = 'schedule' | 'target' | 'reminders' | 'tags';

const HABIT_COLOR_SWATCHES = [
  '#f39b93', // Coral Rose
  '#f5976c', // Sunset Peach
  '#e5a000', // Golden Amber
  '#8ab867', // Matcha Sage
  '#55789b', // Slate Blue
  '#177e65', // Forest Teal
  '#8b4058', // Berry Plum
  '#254b6e', // Midnight Navy
  '#09090b', // Obsidian Black
];

const HABIT_ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: '🔥', label: 'Streak' },
  { icon: '💧', label: 'Water' },
  { icon: '📖', label: 'Read' },
  { icon: '🧘', label: 'Meditate' },
  { icon: '🏋️', label: 'Workout' },
  { icon: '🏃', label: 'Run' },
  { icon: '🚴', label: 'Cycle' },
  { icon: '🍎', label: 'Nutrition' },
  { icon: '😴', label: 'Sleep' },
  { icon: '🌅', label: 'Morning' },
  { icon: '🌙', label: 'Evening' },
  { icon: '🧠', label: 'Focus' },
  { icon: '💻', label: 'Code' },
  { icon: '✍️', label: 'Journal' },
  { icon: '🎯', label: 'Goal' },
  { icon: '💊', label: 'Meds' },
  { icon: '💰', label: 'Savings' },
  { icon: '🎵', label: 'Music' },
  { icon: '🎨', label: 'Create' },
  { icon: '🌱', label: 'Growth' },
  { icon: '🧹', label: 'Clean' },
  { icon: '🤝', label: 'Connect' },
  { icon: '☕', label: 'Mindful' },
  { icon: '🚫', label: 'Quit' },
];

const HABIT_TEMPLATES = [
  {
    id: 'water',
    icon: '💧',
    label: '💧 Drink 8 Glasses',
    name: 'Drink 8 Glasses of Water',
    habitType: 'counter' as HabitType,
    targetCount: '8',
    unit: 'glasses',
    incrementStep: '1',
    color: '#06b6d4',
    tag: 'Health',
    steps: ['Morning glass on waking', 'Pre-lunch hydration', 'Evening glass'],
  },
  {
    id: 'read',
    icon: '📖',
    label: '📖 Read 20 Pages',
    name: 'Read 20 Pages Daily',
    habitType: 'counter' as HabitType,
    targetCount: '20',
    unit: 'pages',
    incrementStep: '5',
    color: '#6366f1',
    tag: 'Study',
    steps: ['Pick current book', 'Take 1 key takeaway note'],
  },
  {
    id: 'meditate',
    icon: '🧘',
    label: '🧘 15m Meditation',
    name: 'Mindful Breathing & Meditation',
    habitType: 'timer' as HabitType,
    targetCount: '1',
    unit: 'session',
    timerMinutes: '15',
    incrementStep: '1',
    color: '#a855f7',
    tag: 'Mindset',
    steps: ['Sit comfortably & close eyes', 'Focus on slow nasal breathing'],
  },
  {
    id: 'workout',
    icon: '🏋️',
    label: '🏋️ 30m Exercise',
    name: 'Daily Movement & Exercise',
    habitType: 'timer' as HabitType,
    targetCount: '1',
    unit: 'session',
    timerMinutes: '30',
    incrementStep: '1',
    color: '#f97316',
    tag: 'Fitness',
    steps: ['5m warm-up mobility', '20m main workout', '5m cooldown'],
  },
  {
    id: 'nosugar',
    icon: '🚫',
    label: '🚫 Quit Added Sugar',
    name: 'Zero Refined Sugar / Junk',
    habitType: 'quit' as HabitType,
    targetCount: '0',
    unit: 'slips',
    incrementStep: '1',
    color: '#f43f5e',
    tag: 'Health',
    steps: ['Replace soda with sparkling water', 'Choose fruit for dessert'],
  },
];

export const HabitForm: React.FC<HabitFormProps> = ({
  initialHabit,
  onSubmit,
  onClose,
  onDelete,
  onSwitchToTask,
  onSwitchToEvent,
  showHeader = true,
}) => {
  const { goals, tags: availableTags } = useApp();

  // Basic Form States
  const [name, setName] = useState(initialHabit?.name || '');
  const [icon, setIcon] = useState<string>(initialHabit?.icon || '🔥');
  const [showIconPicker, setShowIconPicker] = useState<boolean>(false);
  const [notes, setNotes] = useState(initialHabit?.notes || '');
  const [inlineTab, setInlineTab] = useState<HabitInlineTab>('schedule');
  const [showTemplates, setShowTemplates] = useState<boolean>(false);

  // Clean Habit Accent Color (no per-habit font family/fontColor/bold clutter)
  const [accentColor, setAccentColor] = useState<string>(
    initialHabit?.accentColor || initialHabit?.color || '#10b981'
  );

  // Frequency & Days
  const [frequency, setFrequency] = useState<HabitFrequency>(initialHabit?.frequency || 'daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState<number>(
    initialHabit?.targetDaysPerWeek ?? 7
  );
  const [customDays, setCustomDays] = useState<string[]>(
    initialHabit?.customDays && initialHabit.customDays.length > 0
      ? initialHabit.customDays
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [targetTimeOfDay, setTargetTimeOfDay] = useState<
    'anytime' | 'morning' | 'afternoon' | 'evening' | 'night'
  >(initialHabit?.targetTimeOfDay || 'morning');

  // Type & Target
  const [habitType, setHabitType] = useState<HabitType>(initialHabit?.habitType || 'boolean');
  const [targetCount, setTargetCount] = useState<string>(
    initialHabit?.targetCount !== undefined ? String(initialHabit.targetCount) : '8'
  );
  const [unit, setUnit] = useState<string>(initialHabit?.unit || 'times');
  const [timerMinutes, setTimerMinutes] = useState<string>(
    initialHabit?.timerMinutes !== undefined ? String(initialHabit.timerMinutes) : '15'
  );
  const [incrementStep, setIncrementStep] = useState<string>(
    initialHabit?.incrementStep !== undefined ? String(initialHabit.incrementStep) : '1'
  );

  // Time & Reminders
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    initialHabit?.reminderTimes && initialHabit.reminderTimes.length > 0
      ? initialHabit.reminderTimes
      : initialHabit?.reminderTime
      ? [initialHabit.reminderTime]
      : ['08:00']
  );
  const [reminderTime, setReminderTime] = useState<string>(initialHabit?.reminderTime || '08:00');
  const [reminderType, setReminderType] = useState<ReminderType>(
    initialHabit?.reminderType || 'notification'
  );
  const [newReminderTimeInput, setNewReminderTimeInput] = useState<string>('10:00');

  // Sub-steps
  const [subSteps, setSubSteps] = useState<HabitStep[]>(initialHabit?.subSteps || []);
  const [newSubStepTitle, setNewSubStepTitle] = useState('');

  // Goal & Tags
  const [goalId, setGoalId] = useState(initialHabit?.goalId || '');
  const [category] = useState<HabitCategory>(initialHabit?.category || 'health');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialHabit?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Active popup
  const [activeModal, setActiveModal] = useState<ModalType>('none');

  // Deduplicated Goals
  const uniqueGoals = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const list: typeof goals = [];
    for (const g of goals || []) {
      if (!g || !g.title) continue;
      const cleanTitle = g.title.trim().toLowerCase();
      if (seenIds.has(g.id) || seenTitles.has(cleanTitle)) continue;
      seenIds.add(g.id);
      seenTitles.add(cleanTitle);
      list.push(g);
    }
    return list;
  }, [goals]);

  useEffect(() => {
    if (initialHabit?.name) {
      setName(initialHabit.name);
    }
    if (initialHabit?.icon) {
      setIcon(initialHabit.icon);
    }
  }, [initialHabit?.name, initialHabit?.icon]);

  const allWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Auto-sync customDays if frequency is daily
  useEffect(() => {
    if (frequency === 'daily' && customDays.length !== 7) {
      setCustomDays(allWeekDays);
      setTargetDaysPerWeek(7);
    }
  }, [frequency]);

  const handleApplyHabitTemplate = (tpl: (typeof HABIT_TEMPLATES)[number]) => {
    setName(tpl.name);
    setIcon(tpl.icon);
    setHabitType(tpl.habitType);
    if (tpl.targetCount) setTargetCount(tpl.targetCount);
    if (tpl.unit) setUnit(tpl.unit);
    if (tpl.timerMinutes) setTimerMinutes(tpl.timerMinutes);
    if (tpl.incrementStep) setIncrementStep(tpl.incrementStep);
    setAccentColor(tpl.color);
    if (tpl.tag && !selectedTags.includes(tpl.tag)) {
      setSelectedTags(prev => [tpl.tag, ...prev]);
    }
    setSubSteps(
      tpl.steps.map((s, idx) => ({
        id: `htpl_${Date.now()}_${idx}`,
        text: s,
        completed: false,
      }))
    );
    setShowTemplates(false);
    if (tpl.habitType !== 'boolean') {
      setInlineTab('target');
    }
  };

  const handleToggleDay = (day: string) => {
    let next: string[];
    if (customDays.includes(day)) {
      if (customDays.length <= 1) return;
      next = customDays.filter(d => d !== day);
    } else {
      next = [...customDays, day];
    }
    setCustomDays(next);
    setTargetDaysPerWeek(next.length);

    if (next.length === 7) {
      setFrequency('daily');
    } else if (
      next.length === 5 &&
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d => next.includes(d))
    ) {
      setFrequency('weekdays');
    } else if (next.length === 2 && ['Sat', 'Sun'].every(d => next.includes(d))) {
      setFrequency('weekends');
    } else {
      setFrequency('custom');
    }
  };

  const handleAddSubStep = () => {
    if (!newSubStepTitle.trim()) return;
    const newStep: HabitStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: newSubStepTitle.trim(),
      completed: false,
    };
    setSubSteps([...subSteps, newStep]);
    setNewSubStepTitle('');
  };

  const handleToggleSubStep = (id: string) => {
    setSubSteps(subSteps.map(s => (s.id === id ? { ...s, completed: !s.completed } : s)));
  };

  const handleRemoveSubStep = (id: string) => {
    setSubSteps(subSteps.filter(s => s.id !== id));
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => toggleTagCaseInsensitive(prev, tag));
  };

  const handleAddNewTag = () => {
    const tag = cleanTagName(newTagInput);
    if (!tag) return;
    if (!hasTagCaseInsensitive(selectedTags, tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
    setNewTagInput('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    const parsedTargetCount = ['counter', 'measurement', 'quit'].includes(habitType)
      ? parseFloat(targetCount) || 8
      : undefined;
    const parsedTimerMinutes =
      habitType === 'timer' ? parseInt(timerMinutes, 10) || 15 : undefined;

    const primaryReminderTime =
      reminderTimes.length > 0 ? reminderTimes[0] : reminderTime || '08:00';

    const habitData: Partial<Habit> = {
      name: name.trim(),
      icon: icon || '🔥',
      notes: notes.trim(),
      category,
      frequency,
      targetDaysPerWeek,
      customDays,
      targetTimeOfDay,
      habitType,
      targetCount: parsedTargetCount,
      unit: unit.trim() || 'times',
      timerMinutes: parsedTimerMinutes,
      incrementStep: parseFloat(incrementStep) || 1,
      reminderTime: primaryReminderTime,
      reminderTimes: reminderTimes.length > 0 ? reminderTimes : [primaryReminderTime],
      reminderType,
      subSteps,
      goalId: goalId || undefined,
      tags: selectedTags,
      color: accentColor,
      accentColor,
      currentStreak: initialHabit?.currentStreak || 0,
      bestStreak: initialHabit?.bestStreak || 0,
      completionHistory: initialHabit?.completionHistory || {},
      createdAt: initialHabit?.createdAt || new Date().toISOString(),
    };

    onSubmit(habitData);
  };

  const getFrequencySummary = () => {
    if (frequency === 'daily') return 'Everyday (7d)';
    if (frequency === 'weekdays') return 'Weekdays (5d)';
    if (frequency === 'weekends') return 'Weekends (2d)';
    return `${customDays.length}d / week`;
  };

  const getTypeSummary = () => {
    if (habitType === 'boolean') return 'Yes / No';
    if (habitType === 'counter' || habitType === 'measurement') {
      return `${targetCount || '8'} ${unit || 'times'}`;
    }
    if (habitType === 'timer') return `${timerMinutes || '15'}m Timer`;
    if (habitType === 'quit') return `Max ${targetCount || '0'}`;
    return 'Yes / No';
  };

  const getTimeSummary = () => {
    if (reminderType === 'none' || reminderTimes.length === 0) return 'Silent';
    if (reminderTimes.length > 1) return `${reminderTimes.length}x daily`;
    return reminderTimes[0];
  };

  const selectedGoalTitle = useMemo(() => {
    if (!goalId) return null;
    return uniqueGoals.find(g => g.id === goalId)?.title;
  }, [goalId, uniqueGoals]);

  const isEditingExisting = Boolean(initialHabit?.id);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* UNIFIED M3 EXPRESSIVE STICKY HEADER */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 min-h-[52px] bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/70 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <PetalShapeBadge
              shape="cookie12"
              sizeClass="w-8 h-8"
              fillColor={`${accentColor}1f`}
              strokeColor={`${accentColor}45`}
            >
              <Flame size={15} style={{ color: accentColor }} />
            </PetalShapeBadge>
            <div className="min-w-0 flex items-baseline gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                {initialHabit?.id ? 'Edit Habit' : 'New Habit'}
              </span>
            </div>
          </div>

          {/* M3 Expressive Connected Task | Habit Switcher */}
          {!isEditingExisting && onSwitchToTask && (
            <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-[#eff2f9] dark:bg-zinc-900 shrink-0">
              <button
                type="button"
                onClick={onSwitchToTask}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-l-full rounded-r-[6px] font-bold text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-800 hover:text-orange-500 transition-all cursor-pointer"
              >
                <CheckSquare size={11} />
                <span>Task</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-[11px] bg-emerald-600 text-white shadow-xs cursor-default"
              >
                <Flame size={11} />
                <span>Habit</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f1f4fa] dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* FORM BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 sm:px-3.5 py-2.5 flex flex-col gap-2.5 custom-scrollbar [scrollbar-gutter:stable]">
        {/* HERO TITLE + TEMPLATES + ICON/COLOR + CONNECTED CUE & ROUTINE STEPS */}
        <FormHeroTitleCard
          value={name}
          onChange={setName}
          autoFocus={!initialHabit?.id}
          placeholder="What habit do you want to build?"
          accentColor={accentColor}
          iconShape="cookie9"
          onSubmit={handleSubmit}
          icon={<IconRenderer icon={icon} className="w-4 h-4" fallback="🔥" />}
          onIconClick={() => setShowIconPicker(prev => !prev)}
          iconTooltip="Change Habit Color & Icon"
          rightActionSlot={
            <>
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setShowIconPicker(prev => !prev)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  showIconPicker
                    ? 'text-white shadow-xs'
                    : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                }`}
                style={showIconPicker ? { backgroundColor: accentColor } : undefined}
                title="Choose Habit Color & Icon"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/15 dark:ring-white/30"
                  style={{ backgroundColor: accentColor }}
                />
                <Palette size={11} />
                <span>Icon</span>
              </button>

              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setShowTemplates(prev => !prev)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                  showTemplates
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300'
                }`}
                title="1-Tap Habit Templates"
              >
                <Sparkles size={11} className={showTemplates ? 'text-white' : 'text-emerald-500'} />
                <span>Templates</span>
              </button>
            </>
          }
          middleSlot={
            <div className="space-y-2">
              {/* 1-Tap Habit Templates Strip */}
              {showTemplates && (
                <div className="p-2.5 rounded-[18px] bg-emerald-50/80 dark:bg-emerald-950/30 space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>Quick Habit Presets</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTemplates(false)}
                      className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {HABIT_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyHabitTemplate(tpl)}
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1e1e26] hover:bg-emerald-600 hover:text-white text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Structured Color & Icon Picker */}
              {showIconPicker && (
                <StructuredIconColorPicker
                  selectedColor={accentColor}
                  onSelectColor={setAccentColor}
                  selectedIcon={icon}
                  onSelectIcon={setIcon}
                  onClose={() => setShowIconPicker(false)}
                />
              )}

              {/* Connected Tonal Cue + Routine Steps Stack (Zero card-in-card borders) */}
              <div className="space-y-[3px]">
                {/* Cue / Trigger Row (Top rounded, bottom soft seam) */}
                <div className="flex items-start gap-2.5 rounded-t-[16px] rounded-b-[6px] bg-[#f3f5fa] dark:bg-[#121217] px-3 py-2">
                  <MessageSquare size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  <textarea
                    rows={notes && notes.length > 50 ? 2 : 1}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add habit cue, trigger, or motivation..."
                    className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Routine Steps Row (Top soft seam, bottom rounded) */}
                <div className="rounded-t-[6px] rounded-b-[16px] bg-[#f3f5fa] dark:bg-[#121217] px-3 py-2 space-y-1.5">
                  {subSteps.length > 0 && (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 custom-scrollbar">
                      {subSteps.map(s => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 py-0.5 px-1 rounded-lg hover:bg-white/80 dark:hover:bg-zinc-800/60 text-xs group transition-colors"
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={s.completed}
                              onChange={() => handleToggleSubStep(s.id)}
                              className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                            />
                            <span
                              className={`break-words text-[11.5px] leading-snug ${
                                s.completed
                                  ? 'line-through text-zinc-400'
                                  : 'text-zinc-800 dark:text-zinc-200 font-medium'
                              }`}
                            >
                              {s.text}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubStep(s.id)}
                            className="text-zinc-400 hover:text-rose-500 p-0.5 opacity-70 group-hover:opacity-100 cursor-pointer shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-emerald-500 shrink-0" />
                    <input
                      type="text"
                      value={newSubStepTitle}
                      onChange={e => setNewSubStepTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newSubStepTitle.trim()) {
                          e.preventDefault();
                          handleAddSubStep();
                        }
                      }}
                      placeholder={
                        subSteps.length > 0
                          ? `Add another routine step (${subSteps.length})...`
                          : 'Add routine step (press Enter)...'
                      }
                      className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none py-0.5"
                    />
                    {newSubStepTitle.trim() && (
                      <button
                        type="button"
                        onClick={handleAddSubStep}
                        className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          }
        />

        {/* =========================================================================
            M3 EXPRESSIVE CONNECTED 4-TAB INSPECTOR CARD
           ========================================================================= */}
        <div className="flex-1 min-h-[200px] flex flex-col bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[24px] overflow-hidden shadow-2xs">
          <div className="grid grid-cols-4 gap-[3px] p-1.5 bg-[#f1f4fa] dark:bg-[#111116] shrink-0">
            {[
              {
                id: 'schedule' as HabitInlineTab,
                label: 'Schedule',
                badge: getFrequencySummary(),
                icon: <Calendar size={12.5} />,
                activeCls: 'bg-emerald-600 text-white shadow-xs',
              },
              {
                id: 'target' as HabitInlineTab,
                label: 'Target',
                badge: getTypeSummary(),
                icon: <Dumbbell size={12.5} />,
                activeCls: 'bg-blue-600 text-white shadow-xs',
              },
              {
                id: 'reminders' as HabitInlineTab,
                label: 'Reminders',
                badge: getTimeSummary(),
                icon: <Clock size={12.5} />,
                activeCls: 'bg-amber-500 text-white shadow-xs',
              },
              {
                id: 'tags' as HabitInlineTab,
                label: 'Goal & Tags',
                badge:
                  selectedGoalTitle
                    ? 'Goal set'
                    : selectedTags.length > 0
                    ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`
                    : 'Optional',
                icon: <Target size={12.5} />,
                activeCls: 'bg-indigo-600 text-white shadow-xs',
              },
            ].map((tab, idx) => {
              const isActive = inlineTab === tab.id;
              const tabShape = isActive
                ? 'rounded-[18px]'
                : idx === 0
                ? 'rounded-l-[18px] rounded-r-[6px]'
                : idx === 3
                ? 'rounded-r-[18px] rounded-l-[6px]'
                : 'rounded-[6px]';
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setInlineTab(tab.id)}
                  className={`${tabShape} flex flex-col items-center justify-center py-2 px-1 transition-colors duration-200 cursor-pointer min-w-0 ${
                    isActive
                      ? tab.activeCls
                      : 'bg-white/75 dark:bg-[#1a1a22] text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10.5px] sm:text-[11px] font-bold truncate max-w-full">
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </div>
                  <span
                    className={`text-[9.5px] font-semibold tabular-nums truncate max-w-full mt-0.5 ${
                      isActive ? 'text-white/90' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* INLINE INSPECTOR BODY (Fills remaining modal height without tab-switch jump) */}
          <div className="p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar [scrollbar-gutter:stable]">
            {/* TAB 1: FREQUENCY, WEEKDAYS & TIME OF DAY */}
            {inlineTab === 'schedule' && (
              <div className="space-y-3">
                {/* Connected M3 Frequency Segmented Track */}
                <div className="grid grid-cols-3 gap-[3px] p-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116]">
                  {[
                    {
                      id: 'daily' as HabitFrequency,
                      label: 'Everyday',
                      icon: <Repeat size={12} />,
                      days: allWeekDays,
                    },
                    {
                      id: 'weekdays' as HabitFrequency,
                      label: 'Weekdays',
                      icon: <Briefcase size={12} />,
                      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    },
                    {
                      id: 'weekends' as HabitFrequency,
                      label: 'Weekends',
                      icon: <Sun size={12} />,
                      days: ['Sat', 'Sun'],
                    },
                  ].map((preset, idx) => {
                    const isSelected = frequency === preset.id;
                    const segShape = isSelected
                      ? 'rounded-full'
                      : idx === 0
                      ? 'rounded-l-full rounded-r-[6px]'
                      : idx === 2
                      ? 'rounded-r-full rounded-l-[6px]'
                      : 'rounded-[6px]';
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => {
                          setFrequency(preset.id);
                          setCustomDays(preset.days);
                          setTargetDaysPerWeek(preset.days.length);
                        }}
                        className={`${segShape} py-1.5 px-2 text-[11px] font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white/75 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                        }`}
                      >
                        {preset.icon}
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Expressive Shape-Morphing 7-Day Weekday Selector (Squircle -> Circle when active) */}
                <div className="grid grid-cols-7 gap-1.5">
                  {allWeekDays.map(day => {
                    const isSelected = customDays.includes(day);
                    const isSunday = day === 'Sun';
                    return (
                      <button
                        key={day}
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => handleToggleDay(day)}
                        title={day}
                        className={`h-9 flex items-center justify-center text-xs font-mono font-extrabold transition-colors duration-200 cursor-pointer ${
                          isSelected
                            ? isSunday
                              ? 'rounded-full bg-rose-500 text-white shadow-xs ring-2 ring-rose-500/20'
                              : 'rounded-full bg-emerald-600 text-white shadow-xs'
                            : isSunday
                            ? 'rounded-[12px] bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                            : 'rounded-[12px] bg-[#f1f4fa] dark:bg-[#111116] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {day.charAt(0)}
                      </button>
                    );
                  })}
                </div>

                {/* Non-Clipping 5-Column Time of Day Grid (Fixes mobile clipping of Anytime) */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[
                    { id: 'morning', label: 'Morning', icon: <Sunrise size={13} />, time: '07:00' },
                    { id: 'afternoon', label: 'Afternoon', icon: <Sun size={13} />, time: '13:00' },
                    { id: 'evening', label: 'Evening', icon: <Sunset size={13} />, time: '18:00' },
                    { id: 'night', label: 'Night', icon: <Moon size={13} />, time: '21:30' },
                    { id: 'anytime', label: 'Anytime', icon: <Sparkles size={13} />, time: '' },
                  ].map(t => {
                    const isSelected = targetTimeOfDay === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => {
                          setTargetTimeOfDay(t.id as any);
                          if (t.time) setReminderTime(t.time);
                        }}
                        className={`py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 cursor-pointer ${
                          isSelected
                            ? 'rounded-[16px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40 font-bold'
                            : 'rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className={isSelected ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-400'}>
                          {t.icon}
                        </span>
                        <span className="text-[9.5px] sm:text-[10.5px] leading-tight tracking-tight whitespace-nowrap">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: HABIT TYPE & TARGET */}
            {inlineTab === 'target' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-[3px] p-1 rounded-[20px] bg-[#f1f4fa] dark:bg-[#111116]">
                  {[
                    { id: 'boolean' as HabitType, label: 'Yes/No', icon: <Check size={12} /> },
                    { id: 'counter' as HabitType, label: 'Counter', icon: <Hash size={12} /> },
                    { id: 'timer' as HabitType, label: 'Timer', icon: <Timer size={12} /> },
                    { id: 'quit' as HabitType, label: 'Quit', icon: <ShieldBan size={12} /> },
                  ].map((t, idx) => {
                    const isSelected = habitType === t.id;
                    const segShape = isSelected
                      ? 'rounded-full'
                      : idx === 0
                      ? 'rounded-l-[16px] rounded-r-[6px]'
                      : idx === 3
                      ? 'rounded-r-[16px] rounded-l-[6px]'
                      : 'rounded-[6px]';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => setHabitType(t.id)}
                        className={`${segShape} py-2 px-1 text-[10.5px] sm:text-[11px] font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white/75 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {habitType === 'boolean' && (
                  <div className="p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block mb-0.5">
                      Single-Tap Completion
                    </span>
                    Tap once each scheduled day to complete and grow your streak.
                  </div>
                )}

                {(habitType === 'counter' || habitType === 'measurement') && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                        Daily Goal
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={targetCount}
                        onChange={e => setTargetCount(e.target.value)}
                        className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="glasses, pages"
                        className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                        Per Tap (+)
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="any"
                        value={incrementStep}
                        onChange={e => setIncrementStep(e.target.value)}
                        className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-blue-600 dark:text-blue-400 outline-none"
                      />
                    </div>
                  </div>
                )}

                {habitType === 'timer' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116]">
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        Target Duration (Min)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={timerMinutes}
                        onChange={e => setTimerMinutes(e.target.value)}
                        className="w-20 px-2.5 py-1 rounded-[10px] bg-white dark:bg-[#1b1b22] text-xs font-mono font-bold text-center text-zinc-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['5', '10', '15', '25', '30', '45', '60'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTimerMinutes(m)}
                          className={`px-2.5 py-1 text-xs font-bold tabular-nums transition-all cursor-pointer ${
                            timerMinutes === m
                              ? 'rounded-full bg-blue-600 text-white shadow-xs'
                              : 'rounded-[10px] bg-[#f1f4fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {habitType === 'quit' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-rose-500 mb-1">
                        Max Daily Limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={targetCount}
                        onChange={e => setTargetCount(e.target.value)}
                        className="w-full px-3 py-2 rounded-[14px] bg-rose-50/70 dark:bg-rose-950/30 text-xs font-mono font-bold text-rose-700 dark:text-rose-300 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                        Unit (slips, cups)
                      </label>
                      <input
                        type="text"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: REMINDERS */}
            {inlineTab === 'reminders' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-[3px] p-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116]">
                  {[
                    { id: 'notification' as ReminderType, label: 'Banner', icon: <Bell size={12} /> },
                    { id: 'alarm' as ReminderType, label: 'Alarm', icon: <AlarmClock size={12} /> },
                    { id: 'none' as ReminderType, label: 'Silent', icon: <BellOff size={12} /> },
                  ].map((opt, idx) => {
                    const isSelected = reminderType === opt.id;
                    const segShape = isSelected
                      ? 'rounded-full'
                      : idx === 0
                      ? 'rounded-l-full rounded-r-[6px]'
                      : idx === 2
                      ? 'rounded-r-full rounded-l-[6px]'
                      : 'rounded-[6px]';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-no-press-scale="true"
                        onClick={() => setReminderType(opt.id)}
                        className={`${segShape} py-1.5 px-2 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-white/75 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {reminderType === 'none' && (
                  <div className="p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-0.5">
                      Silent Mode
                    </span>
                    No reminder notifications or alarms will fire for this habit.
                  </div>
                )}

                {reminderType !== 'none' && (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: '8:00 AM', times: ['08:00'] },
                        { label: '9:00 PM', times: ['21:00'] },
                        { label: '3x Daily', times: ['08:00', '13:00', '20:00'] },
                        {
                          label: 'Every 2h',
                          times: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
                        },
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setReminderTimes(p.times);
                            setReminderTime(p.times[0]);
                          }}
                          className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[10.5px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="time"
                        value={newReminderTimeInput}
                        onChange={e => setNewReminderTimeInput(e.target.value)}
                        className="px-2.5 py-1.5 rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newReminderTimeInput && !reminderTimes.includes(newReminderTimeInput)) {
                            const updated = [...reminderTimes, newReminderTimeInput].sort();
                            setReminderTimes(updated);
                            setReminderTime(updated[0]);
                          }
                        }}
                        className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold cursor-pointer shrink-0 shadow-2xs"
                      >
                        + Time
                      </button>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar ml-auto">
                        {reminderTimes.map(t => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f1f4fa] dark:bg-zinc-800 text-[10.5px] font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0 tabular-nums"
                          >
                            {t}
                            {reminderTimes.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReminderTimes(reminderTimes.filter(x => x !== t))
                                }
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 4: GOAL LINK & TAGS */}
            {inlineTab === 'tags' && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">
                    Link to Goal
                  </label>
                  <select
                    value={goalId}
                    onChange={e => setGoalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
                  >
                    <option value="">None (Standalone Habit)</option>
                    {uniqueGoals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
                    Category Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {dedupeTagsCaseInsensitive([
                      'Health',
                      'Fitness',
                      'Mindset',
                      'Focus',
                      'Study',
                      'Routine',
                      ...(availableTags || []).map(t => (typeof t === 'string' ? t : t.name)),
                      ...selectedTags,
                    ]).map(tag => {
                      const isSelected = hasTagCaseInsensitive(selectedTags, tag);
                      return (
                        <InteractiveTagButton
                          key={tag.toLowerCase()}
                          tag={tag}
                          selected={isSelected}
                          appTags={availableTags}
                          onClick={() => handleToggleTag(tag)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* M3 EXPRESSIVE FOOTER ACTIONS */}
      <div className="px-4 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md border-t border-zinc-200/60 dark:border-zinc-800/70 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          {initialHabit?.id && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(initialHabit.id!)}
              className="px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              title="Delete Habit"
            >
              <Trash2 size={13.5} />
              <span>Delete</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full font-bold text-xs text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <Check size={14} className="stroke-[2.5]" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          UNIFIED CONTEXTUAL SUB-MODALS (Identical screen location & shell)
         ========================================================================= */}

      {/* 1. FREQUENCY POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'frequency'}
        onClose={() => setActiveModal('none')}
        title="Frequency & Schedule"
        icon={<Calendar size={15} className="text-emerald-600 dark:text-emerald-400" />}
        iconShape="cookie12"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Repeat Schedule
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'daily', label: 'Everyday (7d)' },
                { id: 'weekdays', label: 'Weekdays' },
                { id: 'weekends', label: 'Weekends' },
                { id: 'custom', label: 'Custom Days' },
              ].map(f => {
                const isSelected = frequency === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFrequency(f.id as HabitFrequency);
                      if (f.id === 'daily') {
                        setCustomDays(allWeekDays);
                        setTargetDaysPerWeek(7);
                      } else if (f.id === 'weekdays') {
                        setCustomDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
                        setTargetDaysPerWeek(5);
                      } else if (f.id === 'weekends') {
                        setCustomDays(['Sat', 'Sun']);
                        setTargetDaysPerWeek(2);
                      }
                    }}
                    className={`py-2 px-3 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'rounded-full bg-emerald-600 text-white shadow-xs'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Chips (Morphing squircle -> circle, Sunday in Rose) */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Active Days
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {allWeekDays.map(day => {
                const isSelected = customDays.includes(day);
                const isSunday = day === 'Sun';
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    title={day}
                    className={`h-9 flex items-center justify-center text-xs font-mono font-extrabold transition-all cursor-pointer active:scale-90 ${
                      isSelected
                        ? isSunday
                          ? 'rounded-full bg-rose-500 text-white shadow-xs'
                          : 'rounded-full bg-emerald-600 text-white shadow-xs'
                        : isSunday
                        ? 'rounded-[12px] bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400'
                        : 'rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {day.charAt(0)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Target Time of Day
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'morning', label: 'Morning (6:30 AM)', icon: <Sunrise size={13} />, defaultTime: '06:30' },
                { id: 'afternoon', label: 'Afternoon (12:30 PM)', icon: <Sun size={13} />, defaultTime: '12:30' },
                { id: 'evening', label: 'Evening (5:30 PM)', icon: <Sunset size={13} />, defaultTime: '17:30' },
                { id: 'night', label: 'Night (9:30 PM)', icon: <Moon size={13} />, defaultTime: '21:30' },
                { id: 'anytime', label: 'Anytime (All Day)', icon: <Sparkles size={13} />, defaultTime: '' },
              ].map(t => {
                const isSelected = targetTimeOfDay === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTargetTimeOfDay(t.id as any);
                      if (t.defaultTime) {
                        setReminderTime(t.defaultTime);
                      }
                    }}
                    className={`py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    } ${t.id === 'anytime' ? 'col-span-2' : ''}`}
                  >
                    <span className={isSelected ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-400'}>
                      {t.icon}
                    </span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* 2. TYPE & TARGET POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'typeTarget'}
        onClose={() => setActiveModal('none')}
        title="Habit Type & Target"
        icon={<Dumbbell size={15} className="text-blue-600 dark:text-blue-400" />}
        iconShape="cookie9"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Habit Type
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'boolean', label: 'Yes / No', icon: <Check size={13} /> },
                { id: 'counter', label: 'Numeric Counter', icon: <Hash size={13} /> },
                { id: 'timer', label: 'Timer Duration', icon: <Timer size={13} /> },
                { id: 'quit', label: 'Quit Bad Habit', icon: <ShieldBan size={13} /> },
              ].map(t => {
                const isSelected = habitType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHabitType(t.id as HabitType)}
                    className={`py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'rounded-full bg-blue-600 text-white shadow-xs'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(habitType === 'counter' || habitType === 'measurement') && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    Daily Target Goal
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={targetCount}
                    onChange={e => setTargetCount(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/35 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    Unit Name
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="glasses, pages, ml"
                    className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/35"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  Amount Added Per Tap (Step Size)
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-1">
                    {['1', '2', '5'].map(stepVal => (
                      <button
                        key={stepVal}
                        type="button"
                        onClick={() => setIncrementStep(stepVal)}
                        className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer tabular-nums ${
                          incrementStep === stepVal
                            ? 'rounded-full bg-blue-600 text-white shadow-xs'
                            : 'rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70'
                        }`}
                      >
                        +{stepVal}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={incrementStep}
                    onChange={e => setIncrementStep(e.target.value)}
                    placeholder="Custom (e.g. 1)"
                    className="flex-1 px-3 py-1.5 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/35 tabular-nums"
                  />
                </div>
                <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                  Tapping logs +{incrementStep || '1'} {unit || 'unit'} towards {targetCount || '12'} {unit || 'unit'}.
                </p>
              </div>
            </div>
          )}

          {habitType === 'quit' && (
            <div className="space-y-2.5 p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-[18px]">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5">
                <ShieldBan size={14} />
                <span>Quit / Limit Bad Habit Mode</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Max Allowed Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={targetCount}
                    onChange={e => setTargetCount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-[14px] bg-white dark:bg-[#18181e] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Unit Name
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="times, cups, cigarettes"
                    className="w-full px-3 py-2 rounded-[14px] bg-white dark:bg-[#18181e] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
              </div>
              <p className="text-[10.5px] text-rose-700 dark:text-rose-300">
                Target: Keep daily count at or below {targetCount || '0'} {unit || 'times'}.
              </p>
            </div>
          )}

          {habitType === 'timer' && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                Target Minutes
              </label>
              <input
                type="number"
                value={timerMinutes}
                onChange={e => setTimerMinutes(e.target.value)}
                placeholder="15"
                className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none tabular-nums"
              />
            </div>
          )}
        </div>
      </UnifiedSubModal>

      {/* 3. TIME & REMINDERS POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'timeReminders'}
        onClose={() => setActiveModal('none')}
        title="Time & Reminders"
        icon={<Clock size={15} className="text-amber-600 dark:text-amber-400" />}
        iconShape="scallop"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {/* Connected Alert Style */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Alert Style
            </label>
            <div className="grid grid-cols-3 gap-[3px] p-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116]">
              {[
                { id: 'none' as ReminderType, label: 'Silent', icon: <BellOff size={13} /> },
                { id: 'notification' as ReminderType, label: 'Banner', icon: <Bell size={13} /> },
                { id: 'alarm' as ReminderType, label: 'Alarm', icon: <AlarmClock size={13} /> },
              ].map((opt, idx) => {
                const isSelected = reminderType === opt.id;
                const segShape = isSelected
                  ? 'rounded-full'
                  : idx === 0
                  ? 'rounded-l-full rounded-r-[6px]'
                  : idx === 2
                  ? 'rounded-r-full rounded-l-[6px]'
                  : 'rounded-[6px]';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReminderType(opt.id)}
                    className={`${segShape} py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white/75 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Preset Generator */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Quick Interval Presets
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                {
                  label: 'Every 1 Hour',
                  icon: <Zap size={12} />,
                  times: [
                    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
                    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
                  ],
                },
                {
                  label: 'Every 2 Hours',
                  icon: <Droplets size={12} />,
                  times: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
                },
                {
                  label: 'Every 3 Hours',
                  icon: <Clock size={12} />,
                  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
                },
                {
                  label: '3x Daily (M-A-E)',
                  icon: <Sunrise size={12} />,
                  times: ['08:00', '13:00', '20:00'],
                },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setReminderTimes(preset.times);
                    setReminderTime(preset.times[0]);
                  }}
                  className="py-2 px-2.5 rounded-[14px] bg-amber-50/85 dark:bg-amber-950/35 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/45 transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {preset.icon}
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Reminders List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Reminder Times ({reminderTimes.length})
              </label>
              {reminderTimes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReminderTimes([])}
                  className="text-[10.5px] text-rose-500 font-bold hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {reminderTimes.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2 text-center">
                  No reminder times set. Add one below.
                </p>
              ) : (
                reminderTimes.map((t, idx) => {
                  const displayTime = (() => {
                    try {
                      const [hStr, mStr] = t.split(':');
                      let h = parseInt(hStr, 10);
                      const m = mStr || '00';
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      if (h === 0) h = 12;
                      else if (h > 12) h -= 12;
                      return `${h}:${m} ${ampm}`;
                    } catch {
                      return t;
                    }
                  })();

                  return (
                    <div
                      key={`rt-${t}-${idx}`}
                      className="flex items-center justify-between px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-800 dark:text-zinc-200 tabular-nums"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-amber-500" />
                        <span>{displayTime}</span>
                        <span className="text-[10px] text-zinc-400 font-mono font-normal">({t})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = reminderTimes.filter((_, i) => i !== idx);
                          setReminderTimes(next);
                          if (next.length > 0) setReminderTime(next[0]);
                        }}
                        className="p-1 text-zinc-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add Custom Time */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/70">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Add Custom Reminder Time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={newReminderTimeInput}
                onChange={e => setNewReminderTimeInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newReminderTimeInput) return;
                  if (!reminderTimes.includes(newReminderTimeInput)) {
                    const updated = [...reminderTimes, newReminderTimeInput].sort();
                    setReminderTimes(updated);
                    setReminderTime(updated[0]);
                  }
                }}
                className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-transform"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* 4. SUB-STEPS POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'subSteps'}
        onClose={() => setActiveModal('none')}
        title="Checklist"
        icon={<CheckSquare size={15} className="text-purple-600 dark:text-purple-400" />}
        iconShape="clover"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newSubStepTitle}
              onChange={e => setNewSubStepTitle(e.target.value)}
              placeholder="New sub-step..."
              className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubStep();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddSubStep}
              className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {subSteps.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">No sub-steps added yet.</p>
            ) : (
              subSteps.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubStep(s.id)}
                    className="flex items-center gap-2.5 text-left flex-1 cursor-pointer min-w-0"
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                        s.completed
                          ? 'bg-purple-600 text-white'
                          : 'bg-white dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-600'
                      }`}
                    >
                      {s.completed && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span
                      className={`truncate ${
                        s.completed
                          ? 'line-through text-zinc-400'
                          : 'text-zinc-800 dark:text-zinc-200 font-medium'
                      }`}
                    >
                      {s.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubStep(s.id)}
                    className="p-1 text-zinc-400 hover:text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </UnifiedSubModal>

      {/* 5. NOTE POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'notes'}
        onClose={() => setActiveModal('none')}
        title="Note"
        icon={<MessageSquare size={15} className="text-sky-600 dark:text-sky-400" />}
        iconShape="arch"
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Why do you want to build this habit?"
            rows={5}
            className="w-full p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/40 resize-none leading-relaxed"
          />
        </div>
      </UnifiedSubModal>

      {/* 6. GOAL POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'goals'}
        onClose={() => setActiveModal('none')}
        title="Link to Goal"
        icon={<Target size={15} className="text-indigo-600 dark:text-indigo-400" />}
        iconShape="clover"
      >
        <div className="space-y-1.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <button
            type="button"
            onClick={() => {
              setGoalId('');
              setActiveModal('none');
            }}
            className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-all cursor-pointer flex items-center justify-between ${
              !goalId
                ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>None (Standalone Habit)</span>
            {!goalId && <Check size={14} className="text-indigo-500 shrink-0" />}
          </button>

          {uniqueGoals.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGoalId(g.id);
                setActiveModal('none');
              }}
              className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                goalId === g.id
                  ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Target size={14} className="text-indigo-500 shrink-0" />
                <span className="truncate">{g.title}</span>
              </div>
              {goalId === g.id && <Check size={14} className="text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>
      </UnifiedSubModal>

      {/* 7. TAGS POPUP */}
      <UnifiedSubModal
        isOpen={activeModal === 'tags'}
        onClose={() => setActiveModal('none')}
        title="Tags"
        icon={<Tag size={15} className="text-rose-600 dark:text-rose-400" />}
        iconShape="cookie12"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              placeholder="New tag..."
              className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewTag();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddNewTag}
              className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {dedupeTagsCaseInsensitive([
              'Health',
              'Fitness',
              'Mindset',
              'Focus',
              'Study',
              'Routine',
              ...(availableTags || []).map(t => (typeof t === 'string' ? t : t.name)),
              ...selectedTags,
            ]).map(tag => {
              const isSelected = hasTagCaseInsensitive(selectedTags, tag);
              return (
                <InteractiveTagButton
                  key={tag.toLowerCase()}
                  tag={tag}
                  selected={isSelected}
                  appTags={availableTags}
                  onClick={() => handleToggleTag(tag)}
                />
              );
            })}
          </div>
        </div>
      </UnifiedSubModal>
    </div>
  );
};
