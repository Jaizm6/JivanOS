import React, { useState, useEffect } from 'react';
import { X, Save, Target, Tag, Check, Calendar, Bell, Clock, Layers, Sparkles, Trash2, CheckSquare, Droplets, BellOff, Flame, Hash, ShieldAlert, ArrowUpDown, ChevronDown, SlidersHorizontal, Sun, Sunrise, Sunset, Moon, Volume2, ArrowRight, ArrowLeft, Play, Music, Type, Palette } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HabitType, Priority, EisenhowerQuadrant, ReminderType, TaskAlert, TaskAlertType, Subtask, AlarmToneType, MedicationCustomDateTime } from '../../types';
import { soundEngine } from '../../utils/audio';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { ScheduleEventModal } from '../schedule/ScheduleEventModal';
import { IconRenderer } from '../common/IconRenderer';
import {
  ActivityFontSize,
  ActivityFontType,
  COLOR_PALETTE,
  CARD_THEMES,
  FONT_TYPES,
  getFontSizeClass,
  getFontSizePx,
  getFontSizeStyle,
  getFontTypeClass,
  getFontInlineStyle,
  getCardThemeStyles,
  isWhiteColor,
  isBlackColor,
} from '../../utils/activityStyles';

interface ActivityManagerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'task' | 'habit' | 'event' | 'goal' | 'medication' | 'med' | 'bill' | 'bills' | 'journal';
  activityToEdit?: any;
}

const ALERT_PRESETS: { type: TaskAlertType; label: string }[] = [
  { type: 'on_time', label: 'On Due Time' },
  { type: '5m', label: '5 min before' },
  { type: '10m', label: '10 min before' },
  { type: '15m', label: '15 min before' },
  { type: '30m', label: '30 min before' },
  { type: '1h', label: '1 hour before' },
  { type: '2h', label: '2 hours before' },
  { type: '1d', label: '1 day before' },
];

export const ActivityManager: React.FC<ActivityManagerProps> = ({
  isOpen,
  onClose,
  type,
  activityToEdit,
}) => {
  const {
    addTask,
    updateTask,
    addHabit,
    updateHabit,
    addGoal,
    addMedication,
    addBill,
    addJournalEntry,
    pushNotification,
    soundEngine,
    goals,
    projects,
    tags,
    openEntitiesModal,
    tasks = [],
    habits = [],
    hydration,
    setHydrationTarget,
    toggleWaterReminder,
    toggleAdaptiveWaterReminder,
    sendAdaptiveHydrationNotification,
    theme,
  } = useApp();
  const [activeType, setActiveType] = useState<string>(type);

  // Sync activeType when opening modal or when type prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveType(type);
      // Prevent mobile keyboard from opening automatically on mount
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [isOpen, type]);

  const isDarkMode = theme === 'dark';

  // Compute available tags across Hub, tasks, and habits for the dropdown
  const availableTagNames = React.useMemo(() => {
    const hubTagNames = (tags || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean) as string[];
    const taskTagNames = (tasks || []).flatMap(t => t.tags || []);
    const habitTagNames = (habits || []).flatMap(h => (h as any).tags || []);
    return Array.from(new Set([...hubTagNames, ...taskTagNames, ...habitTagNames]));
  }, [tags, tasks, habits]);

  // Unified form tab navigation state
  const [activeTab, setActiveTab] = useState<'details' | 'goals_reminders' | 'schedule_reminders'>('details');

  // Alerts & Multiple Reminders for Tasks
  const [alerts, setAlerts] = useState<TaskAlert[]>(activityToEdit?.alerts || []);
  const [newAlertPreset, setNewAlertPreset] = useState<string>('on_time');
  const [newAlertStyle, setNewAlertStyle] = useState<ReminderType>('notification');
  const [customAlertDateTime, setCustomAlertDateTime] = useState('');

  const handleAddAlert = (presetType: TaskAlertType, reminderStyle: ReminderType = 'notification') => {
    let customDt = '';
    let label = '';
    if (presetType === 'custom') {
      if (!customAlertDateTime) return;
      customDt = customAlertDateTime;
      label = `Custom: ${new Date(customAlertDateTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    } else {
      const preset = ALERT_PRESETS.find(p => p.type === presetType);
      label = preset ? preset.label : presetType;
    }

    const newAlert: TaskAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: presetType,
      label,
      customDateTime: customDt || undefined,
      reminderType: reminderStyle,
    };

    setAlerts(prev => [...prev.filter(a => a.type !== presetType || presetType === 'custom'), newAlert]);
    setCustomAlertDateTime('');
  };

  const handleRemoveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const [name, setName] = useState(() => {
    const raw = activityToEdit?.title || activityToEdit?.name || '';
    if (raw.toLowerCase().includes('water') || raw.toLowerCase().includes('hydrat')) {
      return raw.replace(/ - Hydration/gi, '').replace(/\(3000ml\)/gi, '').replace(/^Morning Hydration/i, 'Drink Water').trim();
    }
    return raw;
  });
  const [notes, setNotes] = useState(activityToEdit?.notes || '');
  const [tagsState, setTagsState] = useState<string[]>(activityToEdit?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  
  const [goalId, setGoalId] = useState(activityToEdit?.goalId || '');
  const [projectId, setProjectId] = useState(activityToEdit?.projectId || '');
  const [frequency, setFrequency] = useState(activityToEdit?.recurring || 'none');

  // Task specific fields (Priority, Eisenhower, Date, Time, Reminders)
  const [priority, setPriority] = useState<Priority>(activityToEdit?.priority || 'medium');
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(activityToEdit?.quadrant || 'urgent_important');
  const [dueDate, setDueDate] = useState(activityToEdit?.dueDate || new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState(activityToEdit?.dueTime || '12:00');
  const [reminderTiming, setReminderTiming] = useState<string>(activityToEdit?.reminderTiming || 'none');
  const [taskReminderType, setTaskReminderType] = useState<ReminderType>(activityToEdit?.reminderType || 'notification');

  // Subtasks & Checklist for Tasks
  const [subtasks, setSubtasks] = useState<Subtask[]>(activityToEdit?.subtasks || []);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  const handleAddSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    const newSt: Subtask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: newSubtaskInput.trim(),
      completed: false,
    };
    setSubtasks(prev => [...prev, newSt]);
    setNewSubtaskInput('');
  };

  const handleToggleSubtask = (subId: string) => {
    setSubtasks(prev =>
      prev.map(s => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleDeleteSubtask = (subId: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== subId));
  };

  // Habit specific fields
  const isLikelyWater =
    Boolean(activityToEdit?.syncHydration) ||
    (name || activityToEdit?.name || '').toLowerCase().includes('water') ||
    (name || activityToEdit?.name || '').toLowerCase().includes('hydrat');

  const preferredUnitInitial = activityToEdit?.unit || (isLikelyWater ? (hydration?.preferredUnit || 'glasses') : 'times');
  const isLitreInit = ['l', 'litre', 'litres'].includes(preferredUnitInitial.toLowerCase());
  const isGlassesInit = ['glasses', 'glass', 'gl'].includes(preferredUnitInitial.toLowerCase());

  const [habitType, setHabitType] = useState<HabitType>(
    activityToEdit?.habitType || 'boolean'
  );
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(activityToEdit?.targetDaysPerWeek ?? 7);
  const [customDays, setCustomDays] = useState<string[]>(activityToEdit?.customDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [reminderTime, setReminderTime] = useState(activityToEdit?.reminderTime || '');
  const [reminderType, setReminderType] = useState(activityToEdit?.reminderType || 'notification');
  const [habitCustomDateTimes, setHabitCustomDateTimes] = useState<MedicationCustomDateTime[]>(
    activityToEdit?.customDateTimes || []
  );
  const [habitNewDate, setHabitNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [habitNewTime, setHabitNewTime] = useState('09:00');
  const [timerMinutes, setTimerMinutes] = useState(activityToEdit?.timerMinutes ? String(activityToEdit.timerMinutes) : '25');

  const [unit, setUnit] = useState<string>(preferredUnitInitial);

  const [targetCount, setTargetCount] = useState<string>(() => {
    if (activityToEdit?.targetCount) {
      if (isLitreInit && activityToEdit.targetCount >= 50) {
        return String(Math.round((activityToEdit.targetCount / 1000) * 10) / 10);
      }
      return String(activityToEdit.targetCount);
    }
    if (isLikelyWater) {
      const ml = hydration?.targetMl || 3000;
      if (isLitreInit) return String(Math.round((ml / 1000) * 10) / 10);
      if (isGlassesInit) return String(Math.max(1, Math.round(ml / 250)));
      return String(ml);
    }
    if (activityToEdit?.habitType === 'quit') return '5';
    return '10';
  });

  const [incrementStep, setIncrementStep] = useState<string>(() => {
    if (activityToEdit?.incrementStep) {
      if (isLitreInit && activityToEdit.incrementStep >= 50) {
        return String(activityToEdit.incrementStep / 1000);
      }
      return String(activityToEdit.incrementStep);
    }
    if (isLikelyWater) {
      if (isLitreInit) return '0.25';
      if (isGlassesInit) return '1';
      return '250';
    }
    return '1';
  });

  const [syncHydration, setSyncHydration] = useState<boolean>(Boolean(activityToEdit?.syncHydration));
  const [icon, setIcon] = useState(activityToEdit?.icon || (isLikelyWater ? '💧' : '🎯'));
  const [color, setColor] = useState(() => {
    let initial = activityToEdit?.color || (isLikelyWater ? '#06b6d4' : '#6366f1');
    if (!isDarkMode && isWhiteColor(initial)) return '#10b981';
    if (isDarkMode && isBlackColor(initial)) return '#10b981';
    return initial;
  });
  const [accentColor, setAccentColor] = useState<string>(() => {
    let initial = activityToEdit?.accentColor || activityToEdit?.color || (isLikelyWater ? '#06b6d4' : '#10b981');
    if (!isDarkMode && isWhiteColor(initial)) return '#10b981';
    if (isDarkMode && isBlackColor(initial)) return '#10b981';
    return initial;
  });
  const [fontColor, setFontColor] = useState<string>(() => {
    let initial = activityToEdit?.fontColor || '';
    if (!isDarkMode && isWhiteColor(initial)) return '';
    if (isDarkMode && isBlackColor(initial)) return '';
    return initial;
  });
  const [isBold, setIsBold] = useState<boolean>(
    activityToEdit?.isBold !== undefined ? Boolean(activityToEdit.isBold) : true
  );
  const cardTheme = 'clean';

  // Automatically sanitize accentColor and fontColor when theme changes (light mode bans white, dark mode bans black)
  useEffect(() => {
    if (!isDarkMode) {
      if (isWhiteColor(accentColor) || isWhiteColor(color)) {
        const safeColor = isLikelyWater ? '#06b6d4' : '#10b981';
        setAccentColor(safeColor);
        setColor(safeColor);
      }
      if (isWhiteColor(fontColor)) {
        setFontColor('');
      }
    } else {
      if (isBlackColor(accentColor) || isBlackColor(color)) {
        const safeColor = isLikelyWater ? '#06b6d4' : '#10b981';
        setAccentColor(safeColor);
        setColor(safeColor);
      }
      if (isBlackColor(fontColor)) {
        setFontColor('');
      }
    }
  }, [isDarkMode]);

  useEffect(() => {
    setActiveType(type);
  }, [type, isOpen]);

  useEffect(() => {
    if (activityToEdit) {
      if (activityToEdit.accentColor || activityToEdit.color) {
        let safeC = activityToEdit.accentColor || activityToEdit.color || '#10b981';
        if (!isDarkMode && isWhiteColor(safeC)) safeC = '#10b981';
        if (isDarkMode && isBlackColor(safeC)) safeC = '#10b981';
        setAccentColor(safeC);
        setColor(safeC);
      }
      let safeFc = activityToEdit.fontColor || '';
      if (!isDarkMode && isWhiteColor(safeFc)) safeFc = '';
      if (isDarkMode && isBlackColor(safeFc)) safeFc = '';
      setFontColor(safeFc);
      setIsBold(activityToEdit.isBold !== undefined ? Boolean(activityToEdit.isBold) : true);
      if (activityToEdit.name) {
        setName(activityToEdit.name);
      } else {
        setName('');
      }
      if (activityToEdit.icon) {
        setIcon(activityToEdit.icon);
      }
    } else {
      setFontColor('');
      setIsBold(true);
      setName('');
    }
  }, [activityToEdit, isDarkMode]);

  // Periodic reminder settings for hydration & habits
  const [periodicReminderEnabled, setPeriodicReminderEnabled] = useState<boolean>(
    activityToEdit?.periodicReminderEnabled !== undefined
      ? Boolean(activityToEdit.periodicReminderEnabled)
      : (hydration?.reminderEnabled ?? true)
  );
  const [periodicIntervalHours, setPeriodicIntervalHours] = useState<number>(
    activityToEdit?.periodicIntervalHours || hydration?.reminderIntervalHours || 2
  );
  const [isCustomInterval, setIsCustomInterval] = useState<boolean>(
    Boolean(activityToEdit?.periodicIntervalHours && ![1, 2, 3, 4].includes(activityToEdit.periodicIntervalHours))
  );
  const [customIntervalHours, setCustomIntervalHours] = useState<string>(
    String(activityToEdit?.periodicIntervalHours || 2.5)
  );
  const [alertTone, setAlertTone] = useState<AlarmToneType>(
    activityToEdit?.alertTone || (isLikelyWater ? 'drop' : 'dual_bell')
  );
  const [adaptiveReminders, setAdaptiveReminders] = useState<boolean>(hydration?.adaptiveRemindersEnabled ?? true);
  const [soundChimeEnabled, setSoundChimeEnabled] = useState<boolean>(true);

  const handleUnitChange = (newUnit: string) => {
    const prevUnit = (unit || '').toLowerCase().trim();
    const nextUnit = newUnit.toLowerCase().trim();
    setUnit(newUnit);

    const isPrevLitre = prevUnit === 'l' || prevUnit === 'litre' || prevUnit === 'litres';
    const isNextLitre = nextUnit === 'l' || nextUnit === 'litre' || nextUnit === 'litres';
    const isPrevGlasses = prevUnit === 'glasses' || prevUnit === 'glass' || prevUnit === 'gl';
    const isNextGlasses = nextUnit === 'glasses' || nextUnit === 'glass' || nextUnit === 'gl';
    const isPrevMl = prevUnit === 'ml';
    const isNextMl = nextUnit === 'ml';

    const num = parseFloat(targetCount);
    if (!isNaN(num) && num > 0) {
      if (isPrevMl && isNextLitre) {
        setTargetCount(String(Math.round((num / 1000) * 10) / 10));
      } else if (isPrevMl && isNextGlasses) {
        setTargetCount(String(Math.max(1, Math.round(num / 250))));
      } else if (isPrevLitre && isNextMl) {
        setTargetCount(String(Math.round(num * 1000)));
      } else if (isPrevLitre && isNextGlasses) {
        setTargetCount(String(Math.max(1, Math.round(num * 4))));
      } else if (isPrevGlasses && isNextMl) {
        setTargetCount(String(Math.round(num * 250)));
      } else if (isPrevGlasses && isNextLitre) {
        setTargetCount(String(Math.round((num / 4) * 10) / 10));
      }
    }

    if (isNextLitre) {
      setIncrementStep('0.25');
    } else if (isNextGlasses) {
      setIncrementStep('1');
    } else if (isNextMl) {
      setIncrementStep('250');
    }
  };
  
  // Sub-steps & execution rules
  const [subSteps, setSubSteps] = useState<{ id: string; text: string }[]>(
    (activityToEdit as any)?.subSteps || []
  );
  const [stepInput, setStepInput] = useState('');
  const [doneWhen, setDoneWhen] = useState<'all' | 'any'>((activityToEdit as any)?.doneWhen || 'all');
  const [habitTab, setHabitTab] = useState<'details' | 'reminders' | 'extra'>('details');
  const [showStylePanel, setShowStylePanel] = useState<boolean>(false);
  const [colorPickerMode, setColorPickerMode] = useState<'accent' | 'font'>('accent');
  const [targetTimeOfDay, setTargetTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>(
    (activityToEdit as any)?.targetTimeOfDay || 'morning'
  );

  const allWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Goal States
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<any>('career');
  const [goalTargetDate, setGoalTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [goalColor, setGoalColor] = useState('#6366f1');

  // Medication States
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('1 tablet');
  const [medInstructions, setMedInstructions] = useState('Take with water');
  const [medFrequency, setMedFrequency] = useState<any>('daily');
  const [medTime, setMedTime] = useState('08:00');
  const [medTotalPills, setMedTotalPills] = useState('30');
  const [medRefillThreshold, setMedRefillThreshold] = useState('5');
  const [medIconType, setMedIconType] = useState<any>('pill');
  const [medColor, setMedColor] = useState('#ef4444');

  // Bill States
  const [billTitle, setBillTitle] = useState('');
  const [billCategory, setBillCategory] = useState<any>('utilities');
  const [billAmount, setBillAmount] = useState('');
  const [billCurrency, setBillCurrency] = useState('USD');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billRecurring, setBillRecurring] = useState<any>('monthly');
  const [billAutoPay, setBillAutoPay] = useState(false);
  const [billNotes, setBillNotes] = useState('');

  // Journal States
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalMood, setJournalMood] = useState<any>('good');
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    addGoal({
      id: `goal_${Date.now()}`,
      title: goalTitle.trim(),
      category: goalCategory,
      targetDate: goalTargetDate,
      color: goalColor,
      status: 'on_track',
      progress: 0,
      milestones: [],
    } as any);
    soundEngine?.playSuccessChime?.();
    pushNotification('Goal Created', `"${goalTitle.trim()}" goal has been created.`, 'task');
    onClose();
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    addMedication({
      name: medName.trim(),
      dosage: medDosage.trim() || '1 tablet',
      instructions: medInstructions.trim() || 'Take with water',
      frequency: medFrequency as any,
      schedules: [{ time: medTime || '08:00', label: 'Daily Dose' }],
      color: medColor,
      iconType: medIconType,
      totalPills: parseInt(medTotalPills, 10) || 30,
      remainingPills: parseInt(medTotalPills, 10) || 30,
      refillThreshold: parseInt(medRefillThreshold, 10) || 5,
      startDate: new Date().toISOString().split('T')[0],
      active: true,
    });
    soundEngine?.playSuccessChime?.();
    pushNotification('Medication Added', `"${medName.trim()}" has been added to your schedule.`, 'medication');
    onClose();
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billTitle.trim() || !billAmount) return;
    addBill({
      title: billTitle.trim(),
      category: billCategory,
      amount: parseFloat(billAmount) || 0,
      currency: billCurrency,
      dueDate: billDueDate,
      recurring: billRecurring,
      autoPay: billAutoPay,
      isPaid: false,
      notes: billNotes.trim() || undefined,
      reminderDaysBefore: 3,
      color: '#3b82f6',
    });
    soundEngine?.playSuccessChime?.();
    pushNotification('Bill Recorded', `"${billTitle.trim()}" (${billCurrency} ${billAmount}) added.`, 'bill');
    onClose();
  };

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalTitle.trim() && !journalContent.trim()) return;
    addJournalEntry({
      title: journalTitle.trim() || 'Journal Entry',
      content: journalContent.trim(),
      mood: journalMood,
      tags: tagsState,
      date: journalDate,
      isEncrypted: false,
    });
    soundEngine?.playSuccessChime?.();
    pushNotification('Journal Entry Saved', `"${journalTitle.trim() || 'Journal Entry'}" recorded.`, 'journal');
    onClose();
  };

  const handleSliderChange = (val: number) => {
    setTargetDaysPerWeek(val);
    setCustomDays(allWeekDays.slice(0, val));
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
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (activeType === 'task') {
      const matchedGoal = (goals || []).find(g => g.id === goalId || g.id === projectId);
      const effectiveGoalId = goalId || projectId || undefined;

      // Finalize alerts and styles
      let finalAlerts = alerts.map(a => ({ ...a, triggered: false }));
      let finalReminderType = taskReminderType;

      if (finalAlerts.length === 0 && reminderTiming !== 'none' && dueTime) {
        finalAlerts = [{
          id: `al_${reminderTiming}_${Date.now()}`,
          type: reminderTiming as TaskAlertType,
          label: ALERT_PRESETS.find(p => p.type === reminderTiming)?.label || reminderTiming,
          triggered: false,
          reminderType: taskReminderType === 'none' ? 'notification' : taskReminderType,
        }];
        finalReminderType = taskReminderType === 'none' ? 'notification' : taskReminderType;
      } else if (finalAlerts.length > 0) {
        finalReminderType = finalAlerts[0].reminderType || 'notification';
      } else {
        finalReminderType = 'none';
      }

      const taskData = {
        title: name.trim(),
        notes: notes.trim() || undefined,
        tags: tagsState,
        goalId: effectiveGoalId,
        projectId: effectiveGoalId,
        project: matchedGoal?.title || undefined,
        recurring: frequency,
        priority,
        quadrant,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        reminderTiming: finalAlerts.length > 0 ? (finalAlerts[0].type as any) : undefined,
        reminderType: finalReminderType,
        alerts: finalAlerts.length > 0 ? finalAlerts : undefined,
        subtasks,
        color: accentColor,
        accentColor,
        fontColor: fontColor || undefined,
        isBold,
        cardTheme: 'clean',
      };
      const isEditMode = Boolean(activityToEdit && activityToEdit.id);
      if (isEditMode && (type === 'task' || activeType === 'task')) {
        updateTask({ ...activityToEdit, ...taskData });
      } else {
        addTask(taskData as any);
      }
    } else {
      const parsedMins = habitType === 'timer' && timerMinutes ? parseInt(timerMinutes, 10) : undefined;
      const isMeasurable = habitType === 'counter' || habitType === 'measurement' || habitType === 'quit';
      const parsedTargetCount = isMeasurable && targetCount ? parseFloat(targetCount) : undefined;
      const parsedIncrementStep = isMeasurable && incrementStep ? parseFloat(incrementStep) : undefined;

      const isWaterRelated =
        syncHydration &&
        ((name || '').toLowerCase().includes('water') ||
          (name || '').toLowerCase().includes('hydrat') ||
          ['ml', 'l', 'litre', 'litres', 'glasses', 'gl'].some(u => (unit || '').toLowerCase().includes(u)));

      // Sync global hydration target ONLY when habit is explicitly synced and water-related
      if (isMeasurable && isWaterRelated && parsedTargetCount && parsedTargetCount > 0) {
        const u = (unit || 'ml').toLowerCase().trim();
        const isLitre = u === 'l' || u === 'litre' || u === 'litres';
        const isGlasses = u === 'glasses' || u === 'glass' || u === 'gl';
        const mlValue =
          isLitre
            ? Math.round(parsedTargetCount * 1000)
            : isGlasses
              ? Math.round(parsedTargetCount * 250)
              : Math.round(parsedTargetCount);
        setHydrationTarget(mlValue, isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml');
      }

      const isAllDaysSelected = !customDays || customDays.length === 7 || targetDaysPerWeek === 7;
      const isWeekdaysSelected = customDays && customDays.length === 5 && ['Mon','Tue','Wed','Thu','Fri'].every(d => customDays.includes(d));
      const isWeekendsSelected = customDays && customDays.length === 2 && ['Sat','Sun'].every(d => customDays.includes(d));

      const computedFrequency = isAllDaysSelected
        ? 'daily'
        : isWeekdaysSelected
          ? 'weekdays'
          : isWeekendsSelected
            ? 'weekends'
            : 'custom';

      const habitData = {
        name: name.trim(),
        category: (tagsState[0] || 'routine') as any,
        notes: notes.trim() || undefined,
        tags: tagsState,
        habitType,
        frequency: computedFrequency,
        targetDaysPerWeek: isAllDaysSelected ? 7 : (customDays ? customDays.length : targetDaysPerWeek),
        customDays: isAllDaysSelected ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : customDays,
        targetTimeOfDay,
        reminderTime: reminderTime || undefined,
        reminderType: reminderTime ? reminderType : undefined,
        timerMinutes: parsedMins,
        durationMinutes: parsedMins,
        targetCount: parsedTargetCount,
        unit: isMeasurable ? (unit.trim() || undefined) : undefined,
        incrementStep: parsedIncrementStep,
        syncHydration: isMeasurable && isWaterRelated ? syncHydration : false,
        goalId: goalId || undefined,
        icon,
        color: accentColor,
        accentColor,
        fontColor: fontColor || undefined,
        isBold,
        cardTheme: 'clean' as const,
        subSteps: subSteps.filter(s => s.text.trim()),
        doneWhen,
        periodicReminderEnabled,
        periodicIntervalHours: periodicReminderEnabled
          ? (isCustomInterval ? Math.max(0.25, parseFloat(customIntervalHours) || 2) : periodicIntervalHours)
          : undefined,
        alertTone,
        customDateTimes: habitCustomDateTimes,
      };
      const isEditMode = Boolean(activityToEdit && activityToEdit.id);
      if (isEditMode && (type === 'habit' || activeType === 'habit')) {
        updateHabit({ ...activityToEdit, ...habitData, cardTheme: 'clean' });
      } else {
        addHabit({ ...habitData, cardTheme: 'clean' } as any);
      }
    }
    onClose();
  };

  const renderTagSelector = () => {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-bold text-slate-700 dark:text-zinc-300">Tags</label>
          <button
            type="button"
            onClick={() => openEntitiesModal('tags')}
            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
          >
            Manage Tags Hub
          </button>
        </div>

        <div className="flex gap-1.5">
          <select
            value=""
            onChange={e => {
              const val = e.target.value;
              if (val && !tagsState.includes(val)) {
                setTagsState([...tagsState, val]);
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-zinc-100 text-xs font-medium cursor-pointer"
          >
            <option value="" disabled>🏷️ Select a tag from dropdown...</option>
            {availableTagNames.filter(t => !tagsState.includes(t)).map(t => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>

          <div className="flex gap-1">
            <input
              type="text"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = newTagInput.trim().replace(/^#/, '');
                  if (val && !tagsState.includes(val)) {
                    setTagsState([...tagsState, val]);
                    setNewTagInput('');
                  }
                }
              }}
              placeholder="New tag..."
              className="w-24 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-zinc-100 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                const val = newTagInput.trim().replace(/^#/, '');
                if (val && !tagsState.includes(val)) {
                  setTagsState([...tagsState, val]);
                  setNewTagInput('');
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {tagsState.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {tagsState.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                <Tag className="w-2.5 h-2.5" />
                <span>#{t}</span>
                <button type="button" onClick={() => setTagsState(tagsState.filter(item => item !== t))} className="hover:text-rose-500 ml-0.5 cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  if (activeType === 'task') {
    return (
      <TaskFormModal
        isOpen={isOpen}
        onClose={onClose}
        taskToEdit={type === 'task' ? activityToEdit : null}
        onSwitchToHabit={() => setActiveType('habit')}
        onSwitchToEvent={() => setActiveType('event')}
        onSwitchToGoal={() => setActiveType('goal')}
        onSwitchToMed={() => setActiveType('medication')}
        onSwitchToBill={() => setActiveType('bill')}
        onSwitchToJournal={() => setActiveType('journal')}
      />
    );
  }

  if (activeType === 'event') {
    return (
      <ScheduleEventModal
        isOpen={isOpen}
        onClose={onClose}
        editingItem={type === 'event' ? activityToEdit : null}
        onSwitchToTask={() => setActiveType('task')}
        onSwitchToHabit={() => setActiveType('habit')}
        onSwitchToGoal={() => setActiveType('goal')}
        onSwitchToMed={() => setActiveType('medication')}
        onSwitchToBill={() => setActiveType('bill')}
        onSwitchToJournal={() => setActiveType('journal')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] h-[100svh] bg-black/60 backdrop-blur-xs p-3 sm:p-4 pb-12 sm:pb-8 flex flex-col overflow-y-auto pb-safe">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-5 sm:p-6 pb-8 sm:pb-6 shadow-2xl border border-slate-200 dark:border-slate-800 m-auto overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white capitalize">
            {activityToEdit ? `Edit ${activeType}` : `New ${activeType}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Tabbed Navigation for Tasks */}
        {activeType === 'task' && (
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-4 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'details'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule_reminders')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'schedule_reminders'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reminders & Schedule</span>
            </button>
          </div>
        )}

        {/* Tabbed Navigation for Habits (3 Buttons: Details, Reminders, Extra) */}
        {activeType === 'habit' && (() => {
          const isWhiteColor = color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff';
          const isBlackColor = color.toLowerCase() === '#000000' || color.toLowerCase() === '#000' || color.toLowerCase() === '#09090b';

          return (
            <div className="flex bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl mb-3 gap-1 border border-slate-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setHabitTab('details')}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  habitTab === 'details'
                    ? 'bg-white dark:bg-zinc-900 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={habitTab === 'details' && !isWhiteColor && !isBlackColor ? { color } : undefined}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>
              <button
                type="button"
                onClick={() => setHabitTab('reminders')}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  habitTab === 'reminders'
                    ? 'bg-white dark:bg-zinc-900 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={habitTab === 'reminders' && !isWhiteColor && !isBlackColor ? { color } : undefined}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Reminders</span>
                {reminderTime && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setHabitTab('extra')}
                className={`flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  habitTab === 'extra'
                    ? 'bg-white dark:bg-zinc-900 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={habitTab === 'extra' && !isWhiteColor && !isBlackColor ? { color } : undefined}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extra</span>
                {(subSteps.length > 0 || notes.trim().length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                )}
              </button>
            </div>
          );
        })()}

        
        <div className="space-y-3.5 text-xs">
          {/* TASK TABBED LAYOUT */}
          {activeType === 'task' && (
            <>
              {activeTab === 'details' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Task Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="What needs to be done?"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  {/* Priority & Goal Alignment in a single row (Responsive Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Eisenhower Decision Matrix Dropdown */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Eisenhower Matrix</label>
                      <select
                        value={quadrant}
                        onChange={e => {
                          const q = e.target.value as EisenhowerQuadrant;
                          setQuadrant(q);
                          if (q === 'urgent_important') setPriority('high');
                          else if (q === 'not_urgent_important') setPriority('medium');
                          else if (q === 'urgent_not_important') setPriority('low');
                          else if (q === 'not_urgent_not_important') setPriority('low');
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium cursor-pointer"
                      >
                        <option value="urgent_important">🚨 DO (Urg & Imp)</option>
                        <option value="not_urgent_important">⏳ PLAN (Imp)</option>
                        <option value="urgent_not_important">⏩ PASS (Urg)</option>
                        <option value="not_urgent_not_important">💤 SKIP (Neither)</option>
                      </select>
                    </div>

                    {/* Combined Goal & Project Alignment */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-rose-500" />
                          <span>Goal & Project Alignment</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openEntitiesModal('goals')}
                          className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          Manage Hub
                        </button>
                      </div>
                      <select
                        value={goalId || projectId || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setGoalId(val);
                          setProjectId(val);
                        }}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium cursor-pointer"
                      >
                        <option value="">🎯 General / No Linked Goal or Project</option>
                        {(goals || []).map(g => (
                          <option key={g.id} value={g.id}>🎯 {g.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tags Selector Dropdown */}
                  {renderTagSelector()}

                  {/* Notes */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes & Context</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add optional notes, links, or instructions..."
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white text-xs"
                    />
                  </div>

                  {/* Subtasks / Checklist */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-850/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Subtasks / Checklist {subtasks.length > 0 && `(${subtasks.filter(s => s.completed).length}/${subtasks.length})`}</span>
                      </div>
                    </div>

                    {subtasks.length > 0 && (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {subtasks.map(st => (
                          <div
                            key={st.id}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleSubtask(st.id)}
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition cursor-pointer ${
                                  st.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                                }`}
                              >
                                {st.completed && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                              </button>
                              <span
                                className={`text-xs truncate ${
                                  st.completed
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-800 dark:text-slate-200 font-medium'
                                }`}
                              >
                                {st.title}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubtask(st.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                              title="Delete subtask item"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-1.5 pt-0.5">
                      <input
                        type="text"
                        placeholder="+ Add subtask / checklist step (press Enter)..."
                        value={newSubtaskInput}
                        onChange={e => setNewSubtaskInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask();
                          }
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddSubtask}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition shrink-0 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Task Typography & Color Customization (Font Color, Accent Color, Bold) */}
                  {(() => {
                    const themeStyles = getCardThemeStyles(accentColor, cardTheme);
                    const effectiveFontColor = fontColor || accentColor;
                    const fontInlineStyle = getFontInlineStyle({
                      fontColor,
                      isBold,
                    });

                    return (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                        <div className="space-y-3">
                          {/* Accent Color Palette for Task */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Task Accent Color (Border & Checkbox):</span>
                              </span>
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: isWhiteColor(accentColor) ? '#0f172a' : `${accentColor}20`,
                                  color: isWhiteColor(accentColor) ? '#ffffff' : accentColor,
                                  border: isWhiteColor(accentColor) ? '1px solid #334155' : undefined,
                                }}
                              >
                                {accentColor}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {COLOR_PALETTE.map(c => {
                                const isSelected = accentColor.toLowerCase() === c.hex.toLowerCase();
                                const isWhite = isWhiteColor(c.hex);
                                const isBlack = isBlackColor(c.hex);
                                const isDisabled = (isDarkMode && isBlack) || (!isDarkMode && isWhite);

                                return (
                                  <button
                                    key={`task-accent-${c.hex}`}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setAccentColor(c.hex);
                                        setColor(c.hex);
                                      }
                                    }}
                                    title={
                                      isDisabled
                                        ? isDarkMode
                                          ? 'Black accent disabled in Dark Mode for visibility'
                                          : 'White accent disabled in Light Mode for visibility'
                                        : c.label
                                    }
                                    className={`w-6 h-6 rounded-full transition-all relative ${
                                      isDisabled
                                        ? 'opacity-20 cursor-not-allowed border border-dashed border-slate-400'
                                        : 'cursor-pointer hover:scale-105 opacity-90 hover:opacity-100'
                                    } ${
                                      isWhite ? 'border-2 border-slate-300 dark:border-zinc-500 shadow-xs' : isBlack ? 'border border-slate-700 dark:border-zinc-500 shadow-xs' : ''
                                    } ${
                                      isSelected && !isDisabled
                                        ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110 shadow-sm'
                                        : ''
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                  >
                                    {isDisabled ? (
                                      <span
                                        className="absolute inset-0 flex items-center justify-center text-[9px] font-black select-none"
                                        style={{ color: isWhite ? '#0f172a' : '#ffffff' }}
                                      >
                                        ✕
                                      </span>
                                    ) : isWhite ? (
                                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-800 select-none">
                                        ✓
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Font Color Palette for Task */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Type className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Task Font Color:</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setFontColor('')}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                    fontColor === ''
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                      : 'bg-white dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                                  }`}
                                >
                                  Default Theme
                                </button>
                                {fontColor && (
                                  <span
                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: isWhiteColor(fontColor) ? '#0f172a' : `${fontColor}20`,
                                      color: isWhiteColor(fontColor) ? '#ffffff' : fontColor,
                                      border: isWhiteColor(fontColor) ? '1px solid #334155' : undefined,
                                    }}
                                  >
                                    {fontColor}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {COLOR_PALETTE.map(c => {
                                const isSelected = (fontColor || '').toLowerCase() === c.hex.toLowerCase();
                                const isWhite = isWhiteColor(c.hex);
                                const isBlack = isBlackColor(c.hex);
                                const isDisabled = (isDarkMode && isBlack) || (!isDarkMode && isWhite);

                                return (
                                  <button
                                    key={`task-font-${c.hex}`}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setFontColor(c.hex);
                                      }
                                    }}
                                    title={
                                      isDisabled
                                        ? isDarkMode
                                          ? 'Black font disabled in Dark Mode for visibility'
                                          : 'White font disabled in Light Mode for visibility'
                                        : `Font Color: ${c.label}`
                                    }
                                    className={`w-6 h-6 rounded-full transition-all relative ${
                                      isDisabled
                                        ? 'opacity-20 cursor-not-allowed border border-dashed border-slate-400'
                                        : 'cursor-pointer hover:scale-105'
                                    } ${
                                      isWhite ? 'border-2 border-slate-300 dark:border-zinc-500 shadow-xs' : isBlack ? 'border border-slate-700 dark:border-zinc-500 shadow-xs' : ''
                                    } ${
                                      isSelected && !isDisabled
                                        ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-indigo-400 scale-110 shadow-sm'
                                        : 'opacity-90 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                  >
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-[9px] font-black select-none"
                                      style={{ color: isWhite ? '#0f172a' : '#ffffff' }}
                                    >
                                      {isDisabled ? '✕' : 'A'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Formatting Row (Bold Toggle) */}
                        <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                            Typography Weight:
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsBold(!isBold)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                              isBold
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                            title="Toggle Bold (B)"
                          >
                            <span className="font-black">B</span>
                            <span>{isBold ? 'Bold Title' : 'Regular Title'}</span>
                          </button>
                        </div>

                        {/* Live Task Card Preview */}
                        <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                            Live Task Card Preview:
                          </div>
                          <div
                            className="relative p-3 rounded-2xl bg-white dark:bg-zinc-900 transition-all shadow-2xs flex items-center justify-between gap-2.5"
                            style={themeStyles.cardStyle}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pl-0 flex-1">
                              <div
                                className="w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0"
                                style={{
                                  borderColor: isWhiteColor(accentColor) ? '#cbd5e1' : accentColor,
                                  backgroundColor: `${accentColor}15`,
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`block text-xs sm:text-[13px] font-sans truncate ${
                                    isBold ? 'font-bold' : 'font-semibold'
                                  }`}
                                  style={fontInlineStyle}
                                >
                                  {name || 'Task Title Preview'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {priority || 'Medium'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'schedule_reminders' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Due Date & Time in a Single Optimized Row */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Due Date & Time</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                      />
                      <input
                        type="time"
                        value={dueTime}
                        onChange={e => setDueTime(e.target.value)}
                        className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  {/* Repeat Frequency */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Repeat Frequency</label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="none">No repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Multiple Reminders Config Area */}
                  <div className="space-y-3 p-3 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Reminders & Alerts List</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {alerts.length} configured
                      </span>
                    </div>

                    {/* Configured Alerts List */}
                    <div className="space-y-1.5">
                      {alerts.length === 0 ? (
                        <div className="text-center py-3 bg-white/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                          🔕 No reminders configured yet. Add one below!
                        </div>
                      ) : (
                        alerts.map(alert => (
                          <div
                            key={alert.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {alert.reminderType === 'alarm' ? (
                                <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              ) : alert.reminderType === 'none' ? (
                                <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-60" />
                              ) : (
                                <Bell className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate text-xs">
                                  {alert.label || 'Reminder'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Style: {alert.reminderType === 'alarm' ? '🚨 Alarm' : alert.reminderType === 'none' ? '🔕 Silent' : '🔔 Banner'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Inline style selector for this reminder */}
                              <select
                                value={alert.reminderType || 'notification'}
                                onChange={e => {
                                  const style = e.target.value as ReminderType;
                                  setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, reminderType: style } : a));
                                }}
                                className="px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                              >
                                <option value="notification">🔔 Banner</option>
                                <option value="alarm">🚨 Alarm</option>
                                <option value="none">🔕 Silent</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveAlert(alert.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                                title="Delete reminder"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Reminder Form */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                      <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                        + Add New Alert Timing
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Offset Preset</label>
                          <select
                            value={newAlertPreset}
                            onChange={e => setNewAlertPreset(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium cursor-pointer"
                          >
                            {ALERT_PRESETS.map(preset => (
                              <option key={preset.type} value={preset.type}>{preset.label}</option>
                            ))}
                            <option value="custom">📅 Custom Date/Time</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Alert Style</label>
                          <div className="flex gap-1.5">
                            <select
                              value={newAlertStyle}
                              onChange={e => setNewAlertStyle(e.target.value as ReminderType)}
                              className="flex-1 px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium cursor-pointer"
                            >
                              <option value="notification">🔔 Banner</option>
                              <option value="alarm">🚨 Alarm</option>
                              <option value="none">🔕 Silent</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                handleAddAlert(newAlertPreset as TaskAlertType, newAlertStyle);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      {newAlertPreset === 'custom' && (
                        <div className="pt-1.5 animate-fadeIn">
                          <label className="text-[10px] text-slate-400 block mb-0.5 font-semibold">Specify Custom Alert Date & Time</label>
                          <input
                            type="datetime-local"
                            value={customAlertDateTime}
                            onChange={e => setCustomAlertDateTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* HABIT TABBED LAYOUT (Details vs Reminders & Extras) */}
          {activeType === 'habit' && (
            <>
              {/* TAB 1: HABIT DETAILS */}
              {habitTab === 'details' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* 1. Habit Title Input & Integrated Style Bar */}
                  {(() => {
                    const themeStyles = getCardThemeStyles(accentColor, cardTheme);
                    const effectiveFontColor = fontColor || accentColor;
                    const fontInlineStyle = getFontInlineStyle({
                      fontColor,
                      fallbackColor: accentColor,
                      isBold,
                    });

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 text-[11px]">
                            Habit Name *
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowStylePanel(prev => !prev)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                              showStylePanel
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                                : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-750'
                            }`}
                          >
                            <Palette className="w-3 h-3 text-indigo-500" />
                            <span>Icon & Style</span>
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-black/10 dark:border-white/20 shadow-2xs"
                              style={{ backgroundColor: accentColor }}
                            />
                            <ChevronDown className={`w-3 h-3 transition-transform ${showStylePanel ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {/* Integrated Input Bar (Icon Button + Title Input) */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowStylePanel(prev => !prev)}
                            title="Click to customize icon, accent & font colors"
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform hover:scale-105 active:scale-95 shadow-2xs cursor-pointer relative"
                            style={{
                              backgroundColor: isWhiteColor(accentColor) ? '#0f172a' : `${accentColor}20`,
                              borderColor: accentColor,
                            }}
                          >
                            <IconRenderer icon={icon} className="w-5 h-5" fallback="🎯" />
                          </button>

                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              placeholder="e.g. Drink Water, Workout, Read 10 Pages..."
                              style={{
                                borderColor: themeStyles.borderLeftColor,
                                color: effectiveFontColor,
                                WebkitTextFillColor: effectiveFontColor,
                                fontWeight: isBold ? '700' : '500',
                                backgroundColor: isWhiteColor(effectiveFontColor) ? '#0f172a' : undefined,
                              }}
                              className={`w-full px-3.5 py-2 rounded-xl border-2 font-bold text-sm font-sans tracking-tight focus:outline-none transition shadow-2xs ${
                                isWhiteColor(effectiveFontColor)
                                  ? 'bg-slate-900 text-white placeholder:text-slate-500 ring-1 ring-slate-700'
                                  : 'bg-white dark:bg-zinc-900 placeholder:text-slate-400 placeholder:font-normal'
                              }`}
                              required
                            />
                          </div>
                        </div>

                        {/* Quick 1-Tap Swatches Row & Bold Toggle */}
                        <div className="flex items-center justify-between gap-1.5 px-0.5 pt-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {COLOR_PALETTE.map(c => {
                              const isSelected = accentColor.toLowerCase() === c.hex.toLowerCase();
                              const isWhite = isWhiteColor(c.hex);
                              const isBlack = isBlackColor(c.hex);
                              const isDisabled = (isDarkMode && isBlack) || (!isDarkMode && isWhite);

                              return (
                                <button
                                  key={`quick-${c.hex}`}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (!isDisabled) {
                                      setAccentColor(c.hex);
                                      setColor(c.hex);
                                    }
                                  }}
                                  title={
                                    isDisabled
                                      ? isDarkMode
                                        ? 'Black disabled in Dark Mode for visibility'
                                        : 'White disabled in Light Mode for visibility'
                                      : c.label
                                  }
                                  className={`w-5 h-5 rounded-full transition relative ${
                                    isDisabled
                                      ? 'opacity-20 cursor-not-allowed border border-dashed border-slate-400'
                                      : 'cursor-pointer hover:scale-105'
                                  } ${
                                    isWhite ? 'border border-slate-300 dark:border-zinc-500' : isBlack ? 'border border-slate-700' : ''
                                  } ${
                                    isSelected && !isDisabled
                                      ? 'ring-2 ring-offset-1 ring-slate-800 dark:ring-white scale-110 shadow-xs'
                                      : 'opacity-85 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.hex }}
                                >
                                  {isDisabled && (
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-[8px] font-black select-none"
                                      style={{ color: isWhite ? '#0f172a' : '#ffffff' }}
                                    >
                                      ✕
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsBold(!isBold)}
                            title="Toggle Bold title typography"
                            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border transition cursor-pointer shrink-0 ${
                              isBold
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="font-black">B</span> {isBold ? 'Bold' : 'Regular'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Expandable High-Density Style & Customization Drawer */}
                  {showStylePanel && (() => {
                    const themeStyles = getCardThemeStyles(accentColor, cardTheme);
                    const effectiveFontColor = fontColor || accentColor;
                    const fontInlineStyle = getFontInlineStyle({
                      fontColor,
                      fallbackColor: accentColor,
                      isBold,
                    });

                    return (
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200/90 dark:border-zinc-750 space-y-2.5 animate-fadeIn text-xs shadow-xs">
                        {/* A. Icon Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">Choose Habit Icon:</span>
                            <span className="text-[10px] text-slate-400 font-medium">19 icons</span>
                          </div>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            {['🎯', '💧', 'droplets', '🏃', '🧘', '📚', '⌨️', '🚭', '💼', '🥗', '☕', '🏋️', '💊', '🍎', '✍️', '🧹', '🎨', '🌿', '🚴'].map(em => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => setIcon(em)}
                                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center shrink-0 transition cursor-pointer ${
                                  icon === em
                                    ? 'bg-white dark:bg-zinc-700 border-2 shadow-xs scale-105'
                                    : 'bg-white/70 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 border border-slate-200/70 dark:border-zinc-700/70'
                                }`}
                                style={
                                  icon === em
                                    ? isWhiteColor(accentColor)
                                      ? { borderColor: '#475569', backgroundColor: '#0f172a', color: '#ffffff' }
                                      : { borderColor: accentColor, color: accentColor }
                                    : undefined
                                }
                              >
                                <IconRenderer icon={em} className="w-4 h-4" fallback={em} />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* B. Color Switcher: Accent Color vs Title Font Color */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-750">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex bg-slate-200/80 dark:bg-zinc-700/70 p-0.5 rounded-lg gap-0.5">
                              <button
                                type="button"
                                onClick={() => setColorPickerMode('accent')}
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                                  colorPickerMode === 'accent'
                                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                                    : 'text-slate-600 dark:text-zinc-400'
                                }`}
                              >
                                Accent Color
                              </button>
                              <button
                                type="button"
                                onClick={() => setColorPickerMode('font')}
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                                  colorPickerMode === 'font'
                                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                                    : 'text-slate-600 dark:text-zinc-400'
                                }`}
                              >
                                Font Color
                              </button>
                            </div>

                            {colorPickerMode === 'accent' ? (
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: isWhiteColor(accentColor) ? '#0f172a' : `${accentColor}20`,
                                  color: isWhiteColor(accentColor) ? '#ffffff' : accentColor,
                                  border: isWhiteColor(accentColor) ? '1px solid #334155' : undefined,
                                }}
                              >
                                {accentColor}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setFontColor('')}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                    fontColor === ''
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                      : 'bg-white dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'
                                  }`}
                                >
                                  Auto Match
                                </button>
                                {fontColor && (
                                  <span
                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: isWhiteColor(fontColor) ? '#0f172a' : `${fontColor}20`,
                                      color: isWhiteColor(fontColor) ? '#ffffff' : fontColor,
                                      border: isWhiteColor(fontColor) ? '1px solid #334155' : undefined,
                                    }}
                                  >
                                    {fontColor}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Palette Dots */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {COLOR_PALETTE.map(c => {
                              const isAccentMode = colorPickerMode === 'accent';
                              const isSelected = isAccentMode
                                ? accentColor.toLowerCase() === c.hex.toLowerCase()
                                : (fontColor || '').toLowerCase() === c.hex.toLowerCase();
                              const isWhite = isWhiteColor(c.hex);
                              const isBlack = isBlackColor(c.hex);
                              const isDisabled = (isDarkMode && isBlack) || (!isDarkMode && isWhite);

                              return (
                                <button
                                  key={`${colorPickerMode}-${c.hex}`}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (isDisabled) return;
                                    if (isAccentMode) {
                                      setAccentColor(c.hex);
                                      setColor(c.hex);
                                    } else {
                                      setFontColor(c.hex);
                                    }
                                  }}
                                  title={
                                    isDisabled
                                      ? isDarkMode
                                        ? 'Black disabled in Dark Mode for visibility'
                                        : 'White disabled in Light Mode for visibility'
                                      : `${isAccentMode ? 'Accent' : 'Font'} Color: ${c.label}`
                                  }
                                  className={`w-6 h-6 rounded-full transition-all relative ${
                                    isDisabled
                                      ? 'opacity-20 cursor-not-allowed border border-dashed border-slate-400'
                                      : 'cursor-pointer hover:scale-105 active:scale-95'
                                  } ${
                                    isWhite ? 'border-2 border-slate-300 dark:border-zinc-500 shadow-xs' : isBlack ? 'border border-slate-700 dark:border-zinc-500 shadow-xs' : ''
                                  } ${
                                    isSelected && !isDisabled
                                      ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-indigo-400 scale-110 shadow-sm'
                                      : 'opacity-90 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.hex }}
                                >
                                  {isDisabled ? (
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-[9px] font-black select-none"
                                      style={{ color: isWhite ? '#0f172a' : '#ffffff' }}
                                    >
                                      ✕
                                    </span>
                                  ) : !isAccentMode ? (
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-[9px] font-black select-none"
                                      style={{ color: isWhite ? '#0f172a' : '#ffffff' }}
                                    >
                                      A
                                    </span>
                                  ) : isWhite ? (
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-800 select-none">
                                      ✓
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Live Card Preview Strip (Border Theme) */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-750">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Live Preview:</span>
                            <span className="text-[10px] font-mono text-indigo-500 font-bold uppercase">
                              Border Theme
                            </span>
                          </div>
                          <div
                            className={`p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 shadow-2xs border ${
                              themeStyles.isTintedBg ? '' : 'bg-white dark:bg-zinc-900'
                            }`}
                            style={themeStyles.cardStyle}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-2xs shrink-0 border"
                                style={themeStyles.iconBox}
                              >
                                <IconRenderer icon={icon} className="w-3.5 h-3.5" fallback="🎯" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span
                                  className="font-bold text-xs truncate block"
                                  style={{
                                    ...fontInlineStyle,
                                    color: effectiveFontColor,
                                  }}
                                >
                                  {name || 'Habit Title Preview'}
                                </span>
                                <span className="text-[9.5px] text-slate-400 truncate block">
                                  {targetDaysPerWeek}d/week &bull; {habitType === 'timer' ? `${timerMinutes || 15}m timer` : habitType === 'counter' || habitType === 'measurement' || habitType === 'quit' ? `Target: ${targetCount || 10} ${unit || ''}` : 'Yes/No check'}
                                </span>
                              </div>
                            </div>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
                              style={{
                                backgroundColor: accentColor,
                                color: isWhiteColor(accentColor) ? '#0f172a' : '#ffffff',
                              }}
                            >
                              Done ✓
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Tags (Replacing Category) */}
                  {renderTagSelector()}

                  {/* 4. Tracking Type (Yes/No, Measurable, Timer) */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1.5 text-xs">Tracking Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setHabitType('boolean')}
                        className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          habitType === 'boolean'
                            ? 'text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                        style={habitType === 'boolean' ? { backgroundColor: color } : undefined}
                      >
                        <span>✅</span>
                        <span>Yes / No</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (habitType !== 'counter' && habitType !== 'measurement' && habitType !== 'quit') {
                            setHabitType('counter');
                          }
                        }}
                        className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          habitType === 'counter' || habitType === 'measurement' || habitType === 'quit'
                            ? 'text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                        style={habitType === 'counter' || habitType === 'measurement' || habitType === 'quit' ? { backgroundColor: color } : undefined}
                      >
                        <span>🔢</span>
                        <span>Measurable</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHabitType('timer')}
                        className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          habitType === 'timer'
                            ? 'text-white shadow-md'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                        style={habitType === 'timer' ? { backgroundColor: color } : undefined}
                      >
                        <span>⏱️</span>
                        <span>Timer</span>
                      </button>
                    </div>
                  </div>

                  {/* 6. Measurable Tracking Configuration */}
                  {(habitType === 'counter' || habitType === 'measurement' || habitType === 'quit') && (() => {
                    const unitLower = (unit || '').toLowerCase().trim();
                    const isLiquid = ['ml', 'l', 'litre', 'litres', 'glasses', 'gl'].includes(unitLower);
                    const isLitre = unitLower === 'l' || unitLower === 'litre' || unitLower === 'litres';
                    const isGlasses = unitLower === 'glasses' || unitLower === 'glass' || unitLower === 'gl';

                    return (
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 rounded-2xl space-y-2.5">
                        {/* Target, Unit & Intake in 1 Single Row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
                              Target
                            </label>
                            <input
                              type="number"
                              step={isLitre ? '0.1' : '1'}
                              value={targetCount}
                              onChange={e => setTargetCount(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
                              placeholder="e.g. 10"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
                              Unit (opt)
                            </label>
                            <input
                              type="text"
                              value={unit}
                              onChange={e => setUnit(e.target.value)}
                              placeholder="e.g. ml, cups"
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1 truncate" title={`Increment per Click (${unit || 'units'})`}>
                              Inc / Click
                            </label>
                            <input
                              type="number"
                              step={isLitre ? '0.05' : '1'}
                              value={incrementStep}
                              onChange={e => setIncrementStep(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
                              placeholder="e.g. 250"
                            />
                          </div>
                        </div>

                        {/* Quick Unit Presets */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                            Common Unit Suggestions:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { u: 'Glass', label: '🥛 Glass', defaultTarget: '10', step: '1' },
                              { u: 'pages', label: '📖 Pages', defaultTarget: '20', step: '5' },
                              { u: 'steps', label: '👟 Steps', defaultTarget: '10000', step: '1000' },
                              { u: 'reps', label: '💪 Reps', defaultTarget: '30', step: '5' },
                              { u: 'cups', label: '☕ Cups', defaultTarget: '2', step: '1' },
                              { u: 'cigs', label: '🚭 Cigs', defaultTarget: '5', step: '1', quit: true },
                              { u: 'times', label: '🔄 Times', defaultTarget: '5', step: '1' },
                              { u: 'ml', label: '💧 ml', defaultTarget: '2500', step: '250' },
                              { u: 'L', label: '🚰 Litres', defaultTarget: '2.5', step: '0.25' },
                            ].map(item => (
                              <button
                                key={item.u}
                                type="button"
                                onClick={() => {
                                  handleUnitChange(item.u);
                                  if (item.quit) {
                                    setHabitType('quit');
                                  }
                                  setTargetCount(item.defaultTarget);
                                  setIncrementStep(item.step);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-semibold transition cursor-pointer border ${
                                  unit.toLowerCase() === item.u.toLowerCase()
                                    ? 'text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100'
                                }`}
                                style={unit.toLowerCase() === item.u.toLowerCase() ? { backgroundColor: color, borderColor: color } : undefined}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })()}

                  {/* 7. Timer Focus Config */}
                  {habitType === 'timer' && (() => {
                    const isCustomTimer = !['15', '25', '45', '60'].includes(timerMinutes);
                    return (
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                            Target Focus Duration
                          </label>
                          <span className="text-[10.5px] font-mono font-bold" style={{ color }}>
                            {timerMinutes || '25'} min
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="grid grid-cols-4 gap-1.5 flex-1">
                            {['15', '25', '45', '60'].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setTimerMinutes(m)}
                                className={`py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                                  timerMinutes === m
                                    ? 'text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                                style={timerMinutes === m ? { backgroundColor: color, borderColor: color } : undefined}
                              >
                                {m}m
                              </button>
                            ))}
                          </div>
                          
                          <div className="w-24 relative">
                            <input
                              type="number"
                              min="1"
                              max="360"
                              value={['15', '25', '45', '60'].includes(timerMinutes) ? '' : timerMinutes}
                              onChange={e => {
                                const v = e.target.value;
                                setTimerMinutes(v);
                              }}
                              placeholder="Custom m"
                              className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-xs font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                                !['15', '25', '45', '60'].includes(timerMinutes) && timerMinutes !== ''
                                  ? 'text-white'
                                  : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
                              }`}
                              style={!['15', '25', '45', '60'].includes(timerMinutes) && timerMinutes !== '' ? { backgroundColor: color, borderColor: color } : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick Jump to Next Tab */}
                  <button
                    type="button"
                    onClick={() => setHabitTab('reminders')}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Next: Configure Reminders</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TAB 2: REMINDERS & SCHEDULE */}
              {habitTab === 'reminders' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* 1. Daily Reminder */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: reminderTime ? color : '#94a3b8' }}
                        >
                          <Bell className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">Daily Reminder</span>
                          <p className="text-[10.5px] text-slate-400">
                            {reminderTime ? `Alert scheduled at ${reminderTime}` : 'Notifications turned off'}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(reminderTime)}
                        onChange={e => {
                          if (e.target.checked) setReminderTime('08:00');
                          else setReminderTime('');
                        }}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: color }}
                      />
                    </div>

                    {reminderTime && (
                      <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-zinc-800">
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={reminderTime}
                            onChange={e => setReminderTime(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-black text-slate-900 dark:text-zinc-100 font-medium text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setReminderTime('')}
                            className="px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Quick Reminder Presets */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                            Quick Time Presets:
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { t: '07:30', label: '🌅 Morning', sub: '7:30 AM' },
                              { t: '12:30', label: '☀️ Midday', sub: '12:30 PM' },
                              { t: '18:30', label: '🌆 Evening', sub: '6:30 PM' },
                              { t: '21:30', label: '🌙 Night', sub: '9:30 PM' },
                            ].map(p => (
                              <button
                                key={p.t}
                                type="button"
                                onClick={() => setReminderTime(p.t)}
                                className={`py-1.5 px-1 rounded-xl text-center transition cursor-pointer border ${
                                  reminderTime === p.t
                                    ? 'text-white shadow-2xs font-bold'
                                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50'
                                }`}
                                style={reminderTime === p.t ? { backgroundColor: color, borderColor: color } : undefined}
                              >
                                <div className="text-[10.5px] leading-tight">{p.label}</div>
                                <div className="text-[9px] opacity-75">{p.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Frequency & Schedule (Moved from Details) */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Frequency & Schedule</span>
                      </span>
                      <span className="text-[11px] font-bold" style={{ color }}>
                        {targetDaysPerWeek} {targetDaysPerWeek === 1 ? 'day' : 'days'} / week
                      </span>
                    </div>

                    {/* Sunday - Saturday Day Pills */}
                    <div className="flex justify-between gap-1 pt-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                        const isSelected = customDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleDay(day)}
                            className={`flex-1 py-1.5 text-center rounded-lg font-bold text-[10px] sm:text-xs transition duration-155 cursor-pointer border ${
                              isSelected
                                ? 'text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                            }`}
                            style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
                          >
                            {day.slice(0, 2)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specific Dates & Times Notification (e.g. Nov 26, Nov 28, Nov 30) */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" style={{ color }} />
                        <span>Notify at Specific Dates & Times</span>
                      </span>
                      {habitCustomDateTimes.length > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color }}>
                          {habitCustomDateTimes.length} date{habitCustomDateTimes.length > 1 ? 's' : ''} added
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={habitNewDate}
                        onChange={e => setHabitNewDate(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white font-medium"
                      />
                      <input
                        type="time"
                        value={habitNewTime}
                        onChange={e => setHabitNewTime(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!habitNewDate) return;
                          const newEntry: MedicationCustomDateTime = {
                            id: `dt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            date: habitNewDate,
                            time: habitNewTime || '09:00',
                          };
                          setHabitCustomDateTimes(prev => [...prev, newEntry]);
                        }}
                        className="px-3 py-1.5 rounded-xl text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                        style={{ backgroundColor: color }}
                      >
                        + Add Date
                      </button>
                    </div>

                    {habitCustomDateTimes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {habitCustomDateTimes.map(item => (
                          <span
                            key={item.id}
                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 font-bold text-[11px] flex items-center gap-1.5 border shadow-2xs"
                            style={{ borderColor: `${color}60`, color }}
                          >
                            <Calendar className="w-3 h-3 shrink-0" style={{ color }} />
                            <span>{item.date} @ {item.time}</span>
                            <button
                              type="button"
                              onClick={() => setHabitCustomDateTimes(prev => prev.filter(c => c.id !== item.id))}
                              className="text-slate-400 hover:text-rose-500 font-bold ml-1 text-xs cursor-pointer"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Optional: Set exact calendar dates to be reminded (e.g. Nov 26, Nov 28, Nov 30).
                      </p>
                    )}
                  </div>

                  {/* 3. Left Panel Hydration Widget Sync */}
                  {((name || '').toLowerCase().includes('water') ||
                    (name || '').toLowerCase().includes('hydrat') ||
                    ['ml', 'l', 'litre', 'litres', 'glasses', 'gl'].some(u => (unit || '').toLowerCase().includes(u))) && (
                    <div className="p-3.5 bg-cyan-50/70 dark:bg-cyan-950/30 rounded-2xl border border-cyan-200/80 dark:border-cyan-800/60 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center shrink-0">
                            <Droplets className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-zinc-100">
                              Sync with Daily Hydration Widget
                            </span>
                            <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                              Links habit progress directly to the water widget in the left sidebar.
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={syncHydration}
                          onChange={e => setSyncHydration(e.target.checked)}
                          className="w-4 h-4 accent-cyan-600 rounded cursor-pointer shrink-0"
                        />
                      </label>
                    </div>
                  )}

                  {/* 4. Periodic Habit Interval Alert & Alert Tune (Editable) */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" style={{ color }} />
                          <span>Periodic Habit Interval Alert</span>
                        </span>
                        <span className="text-[10.5px] font-bold" style={{ color }}>
                          {!periodicReminderEnabled
                            ? 'Disabled'
                            : isCustomInterval
                              ? `Every ${customIntervalHours}h (Daytime)`
                              : `Every ${periodicIntervalHours}h (Daytime)`}
                        </span>
                      </div>

                      {/* Interval Presets + Custom Button */}
                      {/* Interval Presets & Custom Inline in 1 Single Row */}
                      <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                        {[
                          { val: 0, label: 'Off' },
                          { val: 1, label: '1h' },
                          { val: 2, label: '2h' },
                          { val: 3, label: '3h' },
                          { val: 4, label: '4h' },
                        ].map(opt => {
                          const isActive = periodicReminderEnabled && !isCustomInterval && periodicIntervalHours === opt.val;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => {
                                setPeriodicReminderEnabled(opt.val > 0);
                                setIsCustomInterval(false);
                                if (opt.val > 0) setPeriodicIntervalHours(opt.val);
                              }}
                              className={`py-1.5 px-2.5 rounded-xl text-center text-[10.5px] font-bold transition cursor-pointer border ${
                                isActive
                                  ? 'text-white shadow-2xs'
                                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50'
                              }`}
                              style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
                            >
                              {opt.label}
                            </button>
                          );
                        })}

                        {/* Custom Button & Inline Input in the same row */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition ${
                          periodicReminderEnabled && isCustomInterval
                            ? 'bg-white dark:bg-zinc-900 shadow-2xs'
                            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50'
                        }`}
                        style={periodicReminderEnabled && isCustomInterval ? { borderColor: color } : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setPeriodicReminderEnabled(true);
                              setIsCustomInterval(true);
                            }}
                            className={`text-[10.5px] font-bold cursor-pointer ${
                              periodicReminderEnabled && isCustomInterval ? '' : 'text-slate-600 dark:text-zinc-300'
                            }`}
                            style={periodicReminderEnabled && isCustomInterval ? { color } : undefined}
                          >
                            Custom:
                          </button>
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="12"
                            value={customIntervalHours}
                            onChange={e => {
                              setPeriodicReminderEnabled(true);
                              setIsCustomInterval(true);
                              setCustomIntervalHours(e.target.value);
                            }}
                            onClick={() => {
                              setPeriodicReminderEnabled(true);
                              setIsCustomInterval(true);
                            }}
                            placeholder="Hours"
                            className="w-12 px-1 py-0.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-black text-slate-900 dark:text-zinc-100 font-mono text-xs text-center focus:outline-none"
                          />
                          <span className="text-[10px] font-mono font-bold text-slate-500">h</span>
                        </div>
                      </div>
                    </div>

                    {/* Alert Tone Selector in Dropdown Format with Play Preview */}
                    <div className="pt-2.5 border-t border-slate-200/60 dark:border-zinc-800 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Alert Tune & Sound
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={alertTone}
                          onChange={e => {
                            const newTone = e.target.value as AlarmToneType;
                            setAlertTone(newTone);
                            soundEngine.playAlarmChime(newTone);
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-medium text-xs cursor-pointer focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="dual_bell">🔔 Dual-Bell Chime (Classic Ding-Dong)</option>
                          <option value="melody">🎶 Melodic Rising (Upward 4-Note Chime)</option>
                          <option value="urgent">🚨 Urgent Pulse (Triple Fast Beep)</option>
                          <option value="chime">🪞 Crystal Glass Chime (Acoustic Glass Bell)</option>
                          <option value="drop">💧 Water Droplet (Crisp Liquid Plop)</option>
                          <option value="drip">🌊 Soft Water Drip (Gentle Acoustic Ripple)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => soundEngine.playAlarmChime(alertTone)}
                          className="px-3 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs shrink-0"
                          style={{ backgroundColor: color }}
                          title="Click to preview selected tune"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Preview Tune</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Jump to Extra Tab */}
                  <button
                    type="button"
                    onClick={() => setHabitTab('extra')}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Next: Extra (Sub-habits & Notes)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TAB 3: EXTRA (Sub-Habits & Notes) */}
              {habitTab === 'extra' && (
                <div className="space-y-3.5 animate-fadeIn">
                  {/* Sub-Habits & Checklist */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Sub-Habits & Checklist (Optional)</span>
                      </span>
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <button
                          type="button"
                          onClick={() => setDoneWhen('all')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                            doneWhen === 'all' ? 'text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400'
                          }`}
                          style={doneWhen === 'all' ? { backgroundColor: color } : undefined}
                        >
                          All done
                        </button>
                        <button
                          type="button"
                          onClick={() => setDoneWhen('any')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                            doneWhen === 'any' ? 'text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400'
                          }`}
                          style={doneWhen === 'any' ? { backgroundColor: color } : undefined}
                        >
                          Any done
                        </button>
                      </div>
                    </div>

                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                      {doneWhen === 'all'
                        ? 'Habit marks complete today only when ALL sub-habits are checked.'
                        : 'Habit marks complete today when AT LEAST ONE sub-habit is checked.'}
                    </p>

                    {subSteps.map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-2 bg-white dark:bg-zinc-900/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                        <span className="text-[10px] text-slate-400 font-mono w-4 text-center">{idx + 1}.</span>
                        <span className="text-xs text-slate-800 dark:text-zinc-200 flex-1 truncate font-medium">{st.text}</span>
                        <button
                          type="button"
                          onClick={() => setSubSteps(prev => prev.filter(s => s.id !== st.id))}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition"
                          title="Remove sub-habit"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={stepInput}
                        onChange={e => setStepInput(e.target.value)}
                        placeholder="Add sub-habit (e.g. 10 pushups, Drink 1 glass)"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (stepInput.trim()) {
                              setSubSteps(prev => [...prev, { id: `step_${Date.now()}`, text: stepInput.trim() }]);
                              setStepInput('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (stepInput.trim()) {
                            setSubSteps(prev => [...prev, { id: `step_${Date.now()}`, text: stepInput.trim() }]);
                            setStepInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-white text-xs font-bold transition cursor-pointer shadow-2xs hover:opacity-90"
                        style={{ backgroundColor: color }}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Notes & Context */}
                  <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">Notes & Instructions (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add optional notes, instructions, or reflections for this habit..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick Jump Back to Details */}
                  <button
                    type="button"
                    onClick={() => setHabitTab('details')}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Habit Details</span>
                  </button>
                </div>
              )}
            </>
          )}

          {(() => {
            if (activeType === 'goal') {
              return (
                <form onSubmit={handleSaveGoal} className="space-y-3 pt-1 select-none">
                  {/* Floating Label Goal Title */}
                  <div className="relative border border-amber-600/90 rounded-2xl bg-zinc-900/40 p-3 pt-2.5 focus-within:ring-1 focus-within:ring-amber-500 transition">
                    <label className="absolute -top-2.5 left-3 px-1.5 bg-[#121214] dark:bg-slate-900 text-[11px] font-semibold text-amber-500 tracking-wide uppercase">
                      Goal
                    </label>
                    <input
                      type="text"
                      value={goalTitle}
                      onChange={e => setGoalTitle(e.target.value)}
                      placeholder="e.g. Run a 10K, Learn TypeScript, Save $5,000"
                      required
                      className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  {/* Clean Property Rows */}
                  <div className="divide-y divide-zinc-800/60 pt-1">
                    <div className="py-2.5 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-4 h-4 text-amber-500" />
                        <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-200">Category / Tag</span>
                      </div>
                      <select
                        value={goalCategory}
                        onChange={e => setGoalCategory(e.target.value as any)}
                        className="px-2.5 py-1 text-xs rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60 focus:outline-none cursor-pointer"
                      >
                        <option value="career">#career</option>
                        <option value="health">#health</option>
                        <option value="finance">#finance</option>
                        <option value="personal">#personal</option>
                        <option value="learning">#learning</option>
                        <option value="projects">#projects</option>
                      </select>
                    </div>

                    <div className="py-2.5 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-amber-500" />
                        <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-200">Target Date</span>
                      </div>
                      <input
                        type="date"
                        value={goalTargetDate}
                        onChange={e => setGoalTargetDate(e.target.value)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/60 focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div className="py-2.5 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2.5">
                        <Palette className="w-4 h-4 text-amber-500" />
                        <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-200">Theme Color</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setGoalColor(c)}
                            className={`w-5 h-5 rounded-full border transition cursor-pointer ${
                              goalColor === c ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 flex items-center justify-between border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-200 uppercase tracking-wider cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                </form>
              );
            }

            if (activeType === 'medication' || activeType === 'med') {
              return (
                <form onSubmit={handleSaveMedication} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Medication Name *</label>
                    <input
                      type="text"
                      value={medName}
                      onChange={e => setMedName(e.target.value)}
                      placeholder="e.g. Amoxicillin, Vitamin D3, Omega 3"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dosage</label>
                      <input
                        type="text"
                        value={medDosage}
                        onChange={e => setMedDosage(e.target.value)}
                        placeholder="e.g. 500 mg, 1 capsule"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dose Time</label>
                      <input
                        type="time"
                        value={medTime}
                        onChange={e => setMedTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Instructions</label>
                    <input
                      type="text"
                      value={medInstructions}
                      onChange={e => setMedInstructions(e.target.value)}
                      placeholder="e.g. Take with water after breakfast"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Pill Inventory</label>
                      <input
                        type="number"
                        value={medTotalPills}
                        onChange={e => setMedTotalPills(e.target.value)}
                        placeholder="30"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Form / Type</label>
                      <select
                        value={medIconType}
                        onChange={e => setMedIconType(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="pill">💊 Pill / Tablet</option>
                        <option value="capsule">💊 Capsule</option>
                        <option value="drop">💧 Drops</option>
                        <option value="injection">💉 Injection</option>
                        <option value="inhaler">🫁 Inhaler</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-4"
                  >
                    <Save className="w-4 h-4" />
                    <span>Add Medication</span>
                  </button>
                </form>
              );
            }

            if (activeType === 'bill' || activeType === 'bills') {
              return (
                <form onSubmit={handleSaveBill} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bill Title *</label>
                    <input
                      type="text"
                      value={billTitle}
                      onChange={e => setBillTitle(e.target.value)}
                      placeholder="e.g. Electric Utility, Broadband, Netflix"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={billAmount}
                        onChange={e => setBillAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                      <select
                        value={billCurrency}
                        onChange={e => setBillCurrency(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="AUD">AUD ($)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={billDueDate}
                        onChange={e => setBillDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                      <select
                        value={billRecurring}
                        onChange={e => setBillRecurring(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="one_time">One-time</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billAutoPay}
                      onChange={e => setBillAutoPay(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enable AutoPay for this bill</span>
                  </label>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-4"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Bill</span>
                  </button>
                </form>
              );
            }

            if (activeType === 'journal') {
              return (
                <form onSubmit={handleSaveJournal} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Journal Entry Title</label>
                    <input
                      type="text"
                      value={journalTitle}
                      onChange={e => setJournalTitle(e.target.value)}
                      placeholder="e.g. Daily Reflections, Ideas"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mood</label>
                    <select
                      value={journalMood}
                      onChange={e => setJournalMood(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="great">🌟 Great</option>
                      <option value="good">😊 Good</option>
                      <option value="okay">😐 Okay</option>
                      <option value="calm">🧘 Calm</option>
                      <option value="anxious">😰 Anxious</option>
                      <option value="stressed">⚡ Stressed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Thoughts / Content *</label>
                    <textarea
                      value={journalContent}
                      onChange={e => setJournalContent(e.target.value)}
                      placeholder="Write your journal thoughts..."
                      rows={5}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-4"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Journal Entry</span>
                  </button>
                </form>
              );
            }

            const isWhiteColor = color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff';
            return (
              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 mt-4 select-none">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 uppercase tracking-wider cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={e => handleSave(e as any)}
                  className={`px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition cursor-pointer hover:opacity-95 ${
                    activeType === 'habit' && isWhiteColor
                      ? 'bg-slate-900 text-white border border-slate-700'
                      : 'text-white'
                  }`}
                  style={{ backgroundColor: activeType === 'habit' && !isWhiteColor ? color : '#f59e0b' }}
                >
                  Confirm
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
