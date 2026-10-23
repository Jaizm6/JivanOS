import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Pencil,
  LayoutGrid,
  Calendar,
  CalendarClock,
  Bell,
  CheckSquare,
  MessageSquare,
  Trash2,
  Check,
  X,
  Plus,
  Target,
  Tag,
  Scale,
  ChevronRight,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  TaskItem,
  EisenhowerQuadrant,
  Subtask,
  TaskAlert,
  TaskAlertType,
  Priority
} from '../../types';
import { useApp } from '../../context/AppContext';

export interface TaskFormProps {
  initialTask?: Partial<TaskItem>;
  onSubmit: (taskData: Partial<TaskItem>) => void;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
  showHeader?: boolean;
}

type ModalType =
  | 'none'
  | 'eisenhower'
  | 'weight'
  | 'dateTimeReminders'
  | 'subtasks'
  | 'notes'
  | 'goals'
  | 'tags';

interface QuadrantInfo {
  id: EisenhowerQuadrant;
  label: string;
  action: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: string;
}

const EISENHOWER_QUADRANTS: QuadrantInfo[] = [
  {
    id: 'urgent_important',
    label: 'Urg & Imp',
    action: 'DO',
    color: '#ef4444',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
    badgeText: 'text-rose-800 dark:text-rose-200',
    badgeBorder: 'border-rose-300 dark:border-rose-800',
    icon: '🚨',
  },
  {
    id: 'not_urgent_important',
    label: 'Imp',
    action: 'PLAN',
    color: '#0284c7',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/80',
    badgeText: 'text-sky-800 dark:text-sky-200',
    badgeBorder: 'border-sky-300 dark:border-sky-800',
    icon: '⏳',
  },
  {
    id: 'urgent_not_important',
    label: 'Urg',
    action: 'PASS',
    color: '#3b82f6',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80',
    badgeText: 'text-blue-800 dark:text-blue-200',
    badgeBorder: 'border-blue-300 dark:border-blue-800',
    icon: '⏩',
  },
  {
    id: 'not_urgent_not_important',
    label: 'Neither',
    action: 'SKIP',
    color: '#10b981',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
    badgeBorder: 'border-emerald-300 dark:border-emerald-800',
    icon: '💤',
  },
];

const ALERT_PRESETS: { type: TaskAlertType; label: string }[] = [
  { type: 'custom', label: 'Custom time' },
  { type: 'on_time', label: 'At event time' },
  { type: '15m', label: '15 min before' },
  { type: '30m', label: '30 min before' },
  { type: '1h', label: '1 hour before' },
  { type: '1d', label: '1 day before' },
];

// Helper: 24h to 12h display
const formatTime12 = (time24?: string) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m} ${ampm}`;
};

const format12HourDisplay = (time24?: string) => {
  if (!time24) return '10:30 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr || '10', 10);
  const min = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min} ${ampm}`;
};

const getHour12 = (time24?: string) => {
  const [hStr] = (time24 || '09:00').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return String(h12).padStart(2, '0');
};

const getMinute = (time24?: string) => {
  const [, mStr] = (time24 || '09:00').split(':');
  return mStr ? mStr.padStart(2, '0') : '00';
};

const getAmPm = (time24?: string): 'AM' | 'PM' => {
  const [hStr] = (time24 || '09:00').split(':');
  const h = parseInt(hStr, 10);
  return h >= 12 ? 'PM' : 'AM';
};

const to24Hour = (h12: string, min: string, ampm: 'AM' | 'PM') => {
  let h = parseInt(h12, 10) || 12;
  if (h === 12) {
    h = ampm === 'AM' ? 0 : 12;
  } else {
    if (ampm === 'PM') h += 12;
  }
  return `${String(h).padStart(2, '0')}:${min.padStart(2, '0')}`;
};

const getEffectiveWeight = (t?: Partial<TaskItem>, globalRankMap?: Map<string, number>): number => {
  if (!t) return 0;
  if (typeof t.weight === 'number' && !isNaN(t.weight) && t.weight > 0) return t.weight;
  if (typeof t.rank === 'number' && !isNaN(t.rank) && t.rank > 0) return t.rank;
  if (typeof t.order === 'number' && !isNaN(t.order) && t.order > 0) return t.order;
  if ((t as any)._displayRank && typeof (t as any)._displayRank === 'number' && (t as any)._displayRank > 0) {
    return (t as any)._displayRank;
  }
  if ((t as any)._effectiveRank && typeof (t as any)._effectiveRank === 'number' && (t as any)._effectiveRank > 0) {
    return (t as any)._effectiveRank;
  }
  if (t.id && globalRankMap && globalRankMap.has(t.id)) {
    return globalRankMap.get(t.id)!;
  }
  return 0;
};

const getResolvedAlertTimeDisplay = (alertType: TaskAlertType, baseDueTime?: string) => {
  if (alertType === 'custom' || alertType === 'on_time') {
    return baseDueTime ? formatTime12(baseDueTime) : '';
  }
  if (!baseDueTime) return '10:30 AM';
  try {
    const [hStr, mStr] = baseDueTime.split(':').map(Number);
    let totalMinutes = hStr * 60 + mStr;
    if (alertType === '5m') totalMinutes -= 5;
    else if (alertType === '10m') totalMinutes -= 10;
    else if (alertType === '15m') totalMinutes -= 15;
    else if (alertType === '30m') totalMinutes -= 30;
    else if (alertType === '1h') totalMinutes -= 60;
    else if (alertType === '2h') totalMinutes -= 120;
    else if (alertType === '1d') totalMinutes -= 1440;

    if (totalMinutes < 0) totalMinutes += 1440;
    const resH = Math.floor(totalMinutes / 60) % 24;
    const resM = totalMinutes % 60;
    const time24 = `${String(resH).padStart(2, '0')}:${String(resM).padStart(2, '0')}`;
    return formatTime12(time24);
  } catch {
    return formatTime12(baseDueTime);
  }
};

export const TaskForm: React.FC<TaskFormProps> = ({
  initialTask,
  onSubmit,
  onClose,
  onDelete,
  showHeader = true,
}) => {
  const { tasks, updateTask, goals, tags: availableTags } = useApp();

  // Basic Form States
  const [title, setTitle] = useState(initialTask?.title || '');
  const titleTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [notes, setNotes] = useState(initialTask?.notes || '');
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(
    initialTask?.quadrant || 'not_urgent_important'
  );
  const [taskWeight, setTaskWeight] = useState<number>(() => {
    const w = getEffectiveWeight(initialTask);
    return w > 0 ? w : 1;
  });
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [inspectedWeight, setInspectedWeight] = useState<number | null>(null);
  const [blinkingTaskId, setBlinkingTaskId] = useState<string | null>(null);
  const weightListRef = useRef<HTMLDivElement>(null);
  const taskItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Selected dates list
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    if (initialTask?.dates && initialTask.dates.length > 0) {
      return [...initialTask.dates];
    }
    if (initialTask?.dueDate) {
      return [initialTask.dueDate];
    }
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return [`${today.getFullYear()}-${mm}-${dd}`];
  });

  // Multiple reminders per specific date map: "YYYY-MM-DD" => TaskAlert[]
  const [dateAlertsMap, setDateAlertsMap] = useState<Record<string, TaskAlert[]>>(() => {
    const map: Record<string, TaskAlert[]> = {};
    if (initialTask?.dateSchedules && initialTask.dateSchedules.length > 0) {
      for (const ds of initialTask.dateSchedules) {
        if (ds.date) {
          map[ds.date] = ds.alerts && ds.alerts.length > 0 ? [...ds.alerts] : [];
        }
      }
    } else if (initialTask?.dates && initialTask.dates.length > 0 && initialTask.alerts) {
      for (const d of initialTask.dates) {
        map[d] = [...initialTask.alerts];
      }
    } else if (initialTask?.dueDate && initialTask.alerts) {
      map[initialTask.dueDate] = [...initialTask.alerts];
    }
    return map;
  });

  // Calendar month navigation
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    try {
      if (initialTask?.dueDate && typeof initialTask.dueDate === 'string') {
        const parts = initialTask.dueDate.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            return new Date(y, m, 1);
          }
        }
      }
    } catch {}
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Target date for reminder management ('YYYY-MM-DD')
  const [activeReminderDate, setActiveReminderDate] = useState<string>(() => selectedDates[0] || '');

  // Date-specific due/allotment times map: "YYYY-MM-DD" => "HH:MM"
  const [dateTimesMap, setDateTimesMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialTask?.dateSchedules) {
      initialTask.dateSchedules.forEach(ds => {
        if (ds.date && ds.dueTime) {
          map[ds.date] = ds.dueTime;
        }
      });
    } else if (initialTask?.dueDate && initialTask?.dueTime) {
      map[initialTask.dueDate] = initialTask.dueTime;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const initialList = (initialTask?.dates && initialTask.dates.length > 0) ? initialTask.dates : [initialTask?.dueDate || todayStr];
    initialList.forEach(d => {
      if (!map[d]) map[d] = initialTask?.dueTime || '10:30';
    });
    return map;
  });

  // Subtasks state
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => {
    if (initialTask?.subtasks && initialTask.subtasks.length > 0) {
      return initialTask.subtasks;
    }
    if (initialTask?.checklist && initialTask.checklist.length > 0) {
      return initialTask.checklist;
    }
    return [];
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Goal & Tags
  const [goalId, setGoalId] = useState(initialTask?.goalId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTask?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Active popup
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [lockedAlertIds, setLockedAlertIds] = useState<Record<string, boolean>>(() => {
    const initialLocks: Record<string, boolean> = {};
    if (initialTask?.dateSchedules) {
      initialTask.dateSchedules.forEach(ds => {
        ds.alerts?.forEach(a => {
          if (a.type === 'custom' && a.time) initialLocks[a.id] = true;
        });
      });
    }
    if (initialTask?.alerts) {
      initialTask.alerts.forEach(a => {
        if (a.type === 'custom' && a.time) initialLocks[a.id] = true;
      });
    }
    return initialLocks;
  });

  // Deduplicated Goals (never display the same goal twice)
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

  // Stable global rank mapping so fallback task numbers match TaskManager and all views
  const taskGlobalRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const used = new Set<number>();
    (tasks || []).forEach(t => {
      const explicit =
        typeof t.weight === 'number' && t.weight > 0
          ? t.weight
          : typeof t.rank === 'number' && t.rank > 0
          ? t.rank
          : typeof t.order === 'number' && t.order > 0
          ? t.order
          : 0;
      if (explicit > 0) {
        map.set(t.id, explicit);
        used.add(explicit);
      }
    });
    let seq = 1;
    (tasks || []).forEach(t => {
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

  // Tasks in same Eisenhower quadrant that ACTUALLY have an assigned weight/rank/order number
  const activeQuadrantTasksWithWeight = useMemo(() => {
    return (tasks || []).filter(t => {
      if (t.status === 'archived') return false;

      const tQuad = t.quadrant || 'not_urgent_important';
      const isQuadMatch =
        tQuad === quadrant ||
        (quadrant === 'not_urgent_not_important' && (tQuad === 'neither' || !tQuad)) ||
        (quadrant === 'not_urgent_important' && !tQuad);

      if (!isQuadMatch) return false;

      const w = getEffectiveWeight(t, taskGlobalRankMap);
      return w > 0;
    });
  }, [tasks, quadrant, taskGlobalRankMap]);

  const usedWeightsInQuadrant = useMemo(() => {
    return new Set(
      activeQuadrantTasksWithWeight.map(t => getEffectiveWeight(t, taskGlobalRankMap))
    );
  }, [activeQuadrantTasksWithWeight, taskGlobalRankMap]);

  const conflictingTask = useMemo(() => {
    return activeQuadrantTasksWithWeight.find(
      t => t.id !== initialTask?.id && getEffectiveWeight(t, taskGlobalRankMap) === taskWeight
    );
  }, [activeQuadrantTasksWithWeight, initialTask?.id, taskWeight, taskGlobalRankMap]);

  const nextAvailableWeight = useMemo(() => {
    let next = 1;
    while (usedWeightsInQuadrant.has(next)) {
      next++;
    }
    return next;
  }, [usedWeightsInQuadrant]);

  const triggerBlink = useCallback((taskId: string) => {
    setBlinkingTaskId(taskId);
    setTimeout(() => {
      setBlinkingTaskId(prev => (prev === taskId ? null : prev));
    }, 1800);
  }, []);

  const scrollToWeight = useCallback((w: number) => {
    const targetTask = activeQuadrantTasksWithWeight.find(
      t => getEffectiveWeight(t, taskGlobalRankMap) === w
    );
    if (targetTask) {
      triggerBlink(targetTask.id);
      const el = taskItemRefs.current[targetTask.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeQuadrantTasksWithWeight, taskGlobalRankMap, triggerBlink]);

  useEffect(() => {
    if (activeModal === 'weight') {
      const timer = setTimeout(() => {
        scrollToWeight(taskWeight);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeModal, scrollToWeight, taskWeight]);

  useEffect(() => {
    if (initialTask?.title) {
      setTitle(initialTask.title);
    }
  }, [initialTask?.title]);

  // Auto-resize title textarea so entire title is visible in full and words wrap naturally
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${Math.max(42, titleTextareaRef.current.scrollHeight)}px`;
    }
  }, [title]);

  const handleSelectQuadrant = (q: EisenhowerQuadrant) => {
    setQuadrant(q);
    setActiveModal('none');
  };

  const toggleDateSelection = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      if (selectedDates.length > 1) {
        setSelectedDates(selectedDates.filter(d => d !== dateStr));
        if (activeReminderDate === dateStr) {
          setActiveReminderDate('all');
        }
      }
    } else {
      setSelectedDates([...selectedDates, dateStr].sort());
      if (!dateAlertsMap[dateStr]) {
        setDateAlertsMap(prev => ({ ...prev, [dateStr]: [] }));
      }
    }
  };

  const formatYMD = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Tiny Calendar Grid generation
  const safeCalendarMonth =
    calendarMonth instanceof Date && !isNaN(calendarMonth.getTime())
      ? calendarMonth
      : new Date();
  const year = safeCalendarMonth.getFullYear();
  const month = safeCalendarMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    calendarDays.push({
      dateStr: formatYMD(prevY, prevM, d),
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      dateStr: formatYMD(year, month, i),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    calendarDays.push({
      dateStr: formatYMD(nextY, nextM, i),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  // Get current active alerts based on activeReminderDate tab
  const activeAlertsList: TaskAlert[] = useMemo(() => {
    return dateAlertsMap[activeReminderDate] || [];
  }, [activeReminderDate, dateAlertsMap]);

  // Reminders Management
  const handleAddReminder = () => {
    const targetDate = activeReminderDate || selectedDates[0] || new Date().toISOString().split('T')[0];
    const newAlert: TaskAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'custom',
      time: '10:30',
      label: '10:30 AM (10:30)',
      triggered: false,
      date: targetDate,
    };

    setLockedAlertIds(prev => ({ ...prev, [newAlert.id]: false }));

    setDateAlertsMap(prev => {
      const nextMap = { ...prev };
      nextMap[targetDate] = [...(nextMap[targetDate] || []), newAlert];
      return nextMap;
    });
  };

  const handleUpdateReminderType = (alertId: string, newType: TaskAlertType) => {
    if (newType === 'custom') {
      setLockedAlertIds(prev => ({ ...prev, [alertId]: false }));
    }
    setDateAlertsMap(prev => {
      const nextMap = { ...prev };
      const updateList = (list: TaskAlert[]) =>
        list.map(a => {
          if (a.id !== alertId) return a;
          const label = ALERT_PRESETS.find(p => p.type === newType)?.label || 'Reminder';
          return {
            ...a,
            type: newType,
            label,
            time: newType === 'custom' ? (a.time || '10:30') : undefined,
          };
        });

      if (activeReminderDate && nextMap[activeReminderDate]) {
        nextMap[activeReminderDate] = updateList(nextMap[activeReminderDate]);
      }
      return nextMap;
    });
  };

  const handleLockReminderTime = (alertId: string) => {
    setLockedAlertIds(prev => ({ ...prev, [alertId]: true }));
    setConflictNotice('Reminder time locked! Tap Apply or Save to keep.');
    setTimeout(() => setConflictNotice(null), 2500);
  };

  const handleUnlockReminderTime = (alertId: string) => {
    setLockedAlertIds(prev => ({ ...prev, [alertId]: false }));
  };

  const handleUpdateReminderTime = (
    alertId: string,
    hour12: string,
    minute: string,
    ampm: 'AM' | 'PM'
  ) => {
    const time24 = to24Hour(hour12, minute, ampm);
    const label = `${formatTime12(time24)} (${time24})`;

    setDateAlertsMap(prev => {
      const nextMap = { ...prev };
      const updateList = (list: TaskAlert[]) =>
        list.map(a => {
          if (a.id !== alertId) return a;
          return { ...a, time: time24, label };
        });

      if (activeReminderDate && nextMap[activeReminderDate]) {
        nextMap[activeReminderDate] = updateList(nextMap[activeReminderDate]);
      }
      return nextMap;
    });
  };

  const handleRemoveReminder = (alertId: string) => {
    setDateAlertsMap(prev => {
      const nextMap = { ...prev };
      if (activeReminderDate && nextMap[activeReminderDate]) {
        nextMap[activeReminderDate] = nextMap[activeReminderDate].filter(a => a.id !== alertId);
      }
      return nextMap;
    });
  };

  const handleCopyRemindersToAllDates = () => {
    if (activeReminderDate !== 'all') {
      const sourceAlerts = dateAlertsMap[activeReminderDate] || [];
      setDateAlertsMap(prev => {
        const nextMap = { ...prev };
        selectedDates.forEach(d => {
          nextMap[d] = sourceAlerts.map(a => ({
            ...a,
            id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            date: d,
          }));
        });
        return nextMap;
      });
      setConflictNotice(`Copied reminders to all ${selectedDates.length} dates!`);
      setTimeout(() => setConflictNotice(null), 3000);
    }
  };

  // Subtasks
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: Subtask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(
      subtasks.map(s => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setNewTagInput('');
  };

  const mapQuadrantToPriority = (q: EisenhowerQuadrant): Priority => {
    switch (q) {
      case 'urgent_important':
        return 'high';
      case 'not_urgent_important':
        return 'high';
      case 'urgent_not_important':
        return 'medium';
      case 'not_urgent_not_important':
        return 'low';
      default:
        return 'medium';
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    if (conflictingTask) {
      setActiveModal('weight');
      return;
    }

    const primaryDueDate = selectedDates[0] || new Date().toISOString().split('T')[0];
    const primaryDueTime = dateTimesMap[primaryDueDate] || initialTask?.dueTime;

    const finalDateSchedules = selectedDates.map(d => {
      const alertsForDate = dateAlertsMap[d] || [];
      const dateDueTime = dateTimesMap[d] || initialTask?.dueTime;
      const firstCustomTime = alertsForDate.find(a => a.type === 'custom')?.time;
      return {
        date: d,
        dueTime: dateDueTime || firstCustomTime,
        isAllDay: !dateDueTime && !firstCustomTime,
        alerts: alertsForDate,
      };
    });

    const allAlerts: TaskAlert[] = [];
    selectedDates.forEach(d => {
      const alertsForDate = dateAlertsMap[d] || [];
      allAlerts.push(...alertsForDate);
    });

    const taskData: Partial<TaskItem> = {
      title: title.trim(),
      notes: notes.trim(),
      quadrant,
      weight: taskWeight,
      rank: taskWeight,
      order: taskWeight,
      priority: mapQuadrantToPriority(quadrant),
      dueDate: primaryDueDate,
      dates: selectedDates,
      dateSchedules: finalDateSchedules,
      dueTime: primaryDueTime,
      isAllDay: !primaryDueTime,
      alerts: allAlerts,
      subtasks,
      checklist: subtasks,
      category: selectedTags[0] || initialTask?.category || 'General',
      tags: selectedTags,
      goalId: goalId || undefined,
      status: initialTask?.status || 'todo',
      completed: initialTask?.completed || false,
    };

    onSubmit(taskData);
  };

  const currentQuadrantInfo =
    EISENHOWER_QUADRANTS.find(q => q.id === quadrant) || EISENHOWER_QUADRANTS[1];

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getScheduleSummary = () => {
    if (selectedDates.length === 0) return 'No date';
    const totalReminders = selectedDates.reduce(
      (acc, d) => acc + (dateAlertsMap[d]?.length || 0),
      0
    );

    if (selectedDates.length === 1) {
      const d = selectedDates[0];
      const alertsForDate = dateAlertsMap[d] || [];
      const times = alertsForDate
        .filter(a => a.time)
        .map(a => a.time)
        .slice(0, 2)
        .join(', ');

      if (times) {
        return `${formatDateDisplay(d)} • ${times}`;
      }
      if (alertsForDate.length > 0) {
        return `${formatDateDisplay(d)} • ${alertsForDate.length} alert${alertsForDate.length > 1 ? 's' : ''}`;
      }
      return formatDateDisplay(d);
    }

    if (totalReminders > 0) {
      return `${selectedDates.length} dates • ${totalReminders} reminder${totalReminders > 1 ? 's' : ''}`;
    }
    return `${selectedDates.length} dates`;
  };

  const selectedGoalTitle = useMemo(() => {
    if (!goalId) return null;
    return uniqueGoals.find(g => g.id === goalId)?.title;
  }, [goalId, uniqueGoals]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* HEADER */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Cancel"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {initialTask?.id ? 'Edit Task' : 'New Task'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {initialTask?.id && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(initialTask.id!)}
                className="px-3 py-1 rounded-lg font-semibold text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Delete Task"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!title.trim()}
              className="px-3.5 py-1 rounded-lg font-semibold text-xs bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-40 text-white shadow-xs transition-all cursor-pointer"
            >
              {initialTask?.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* FORM BODY */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-10 sm:pb-8 space-y-2.5 custom-scrollbar">
        {/* TITLE INPUT CARD (WORD WRAPPING MULTI-LINE) */}
        <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="text-orange-500 dark:text-orange-400 shrink-0 mt-0.5">
              <Pencil size={17} />
            </div>
            <textarea
              ref={titleTextareaRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full bg-transparent text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none break-words whitespace-pre-wrap leading-relaxed min-h-[44px]"
              style={{ overflow: 'hidden' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>

        {/* COMPACT CLEAN SETTINGS LIST (NO TEXT BLOAT) */}
        <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800/80 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
          {/* 1. EISENHOWER ROW */}
          <button
            type="button"
            onClick={() => setActiveModal('eisenhower')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center justify-center font-bold shrink-0">
                <LayoutGrid size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Eisenhower Matrix
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 ${currentQuadrantInfo.badgeBg} ${currentQuadrantInfo.badgeText} ${currentQuadrantInfo.badgeBorder}`}
              >
                <span>{currentQuadrantInfo.icon}</span>
                <span>{currentQuadrantInfo.action}</span>
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 2. TASK WEIGHT ROW */}
          <button
            type="button"
            onClick={() => setActiveModal('weight')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold shrink-0">
                <Scale size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Task Weight
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800">
                #{taskWeight}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 3. DATE & REMINDERS */}
          <button
            type="button"
            onClick={() => setActiveModal('dateTimeReminders')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                <CalendarClock size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Date & Reminders
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 truncate max-w-[170px]">
                {getScheduleSummary()}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 4. SUBTASKS */}
          <button
            type="button"
            onClick={() => setActiveModal('subtasks')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                <CheckSquare size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Subtasks
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                  subtasks.length > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                }`}
              >
                {subtasks.length === 0
                  ? 'None'
                  : `${subtasks.filter(s => s.completed).length}/${subtasks.length}`}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 5. NOTE */}
          <button
            type="button"
            onClick={() => setActiveModal('notes')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold shrink-0">
                <MessageSquare size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Note
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 max-w-[120px] truncate">
                {notes ? notes.substring(0, 16) + '...' : 'Add'}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 6. GOAL (ONLY 'Goal', DEDUPLICATED) */}
          <button
            type="button"
            onClick={() => setActiveModal('goals')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">
                <Target size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Goal
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 max-w-[120px] truncate">
                {selectedGoalTitle || 'None'}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>

          {/* 7. TAGS */}
          <button
            type="button"
            onClick={() => setActiveModal('tags')}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold shrink-0">
                <Tag size={15} />
              </div>
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Tags
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 max-w-[120px] truncate">
                {selectedTags.length > 0 ? selectedTags.join(', ') : 'None'}
              </span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </div>
          </button>
        </div>

        {/* Clear bottom breathing space so the last row and card border never touch or clip at the sheet bottom */}
        <div className="h-6 sm:h-4 shrink-0" />
      </div>

      {/* =========================================================================
          POPUP MODALS
         ========================================================================= */}

      {/* 1. EISENHOWER POPUP */}
      {activeModal === 'eisenhower' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <LayoutGrid size={18} className="text-orange-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Eisenhower Matrix
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {EISENHOWER_QUADRANTS.map(q => {
                const isSelected = quadrant === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuadrant(q.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/90 dark:bg-orange-950/40 ring-2 ring-orange-500/30'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xl">{q.icon}</span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                        <span>{q.action}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight font-medium">
                        [{q.label}]
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. TASK WEIGHT POPUP (NO IMAGINARY TASKS - ONLY REAL TASKS WITH ASSIGNED WEIGHTS) */}
      {activeModal === 'weight' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-purple-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Task Weight</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-3 space-y-3 overflow-y-auto">
              {conflictNotice && (
                <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                  <Check size={14} strokeWidth={3} />
                  <span>{conflictNotice}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                  Weight Number (Unique in {currentQuadrantInfo.action})
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={taskWeight}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setTaskWeight(val);
                    setInspectedWeight(val);
                    scrollToWeight(val);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold text-xl text-center outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {conflictingTask && (
                <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertCircle size={15} className="text-amber-600 shrink-0" />
                    <span>Weight #{taskWeight} is already taken by "{conflictingTask.title}"</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskWeight(nextAvailableWeight);
                        setInspectedWeight(null);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition shadow-2xs cursor-pointer"
                    >
                      Use Free #{nextAvailableWeight}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const oldW = initialTask?.weight || nextAvailableWeight;
                        updateTask({
                          ...conflictingTask,
                          weight: oldW,
                          rank: oldW,
                          order: oldW,
                        });
                        setConflictNotice(`Swapped! "${conflictingTask.title}" is now #${oldW}.`);
                        setTimeout(() => setConflictNotice(null), 3500);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg border border-amber-400 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px] transition cursor-pointer"
                    >
                      Swap Weights
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Already Taken Numbers ({activeQuadrantTasksWithWeight.length})
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Free: #{nextAvailableWeight}
                  </span>
                </div>

                {usedWeightsInQuadrant.size > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedWeight(null);
                        if (weightListRef.current) {
                          weightListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 border transition-all cursor-pointer ${
                        inspectedWeight === null
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      All
                    </button>
                    {Array.from(usedWeightsInQuadrant)
                      .sort((a, b) => a - b)
                      .map(w => {
                        const isInspected = inspectedWeight === w;
                        const isSelected = w === taskWeight;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              setTaskWeight(w);
                              setInspectedWeight(w);
                              scrollToWeight(w);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 border transition-all cursor-pointer ${
                              isInspected || isSelected
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900'
                            }`}
                            title={`Jump to weight #${w}`}
                          >
                            #{w}
                          </button>
                        );
                      })}
                  </div>
                )}

                <div
                  ref={weightListRef}
                  className="h-48 min-h-[192px] max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 custom-scrollbar"
                >
                  {(() => {
                    const sortedTasks = [...activeQuadrantTasksWithWeight].sort(
                      (a, b) => getEffectiveWeight(a, taskGlobalRankMap) - getEffectiveWeight(b, taskGlobalRankMap)
                    );

                    if (sortedTasks.length === 0) {
                      return (
                        <div className="h-full flex items-center justify-center p-4">
                          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                            No other tasks in {currentQuadrantInfo.action} have taken weights.<br />All numbers are free!
                          </p>
                        </div>
                      );
                    }

                    return sortedTasks.map(t => {
                      const w = getEffectiveWeight(t, taskGlobalRankMap);
                      const isSelected = w === taskWeight;
                      const isInspected = w === inspectedWeight;
                      const isBlinking = blinkingTaskId === t.id;

                      return (
                        <div
                          key={t.id}
                          ref={el => {
                            taskItemRefs.current[t.id] = el;
                          }}
                          onClick={() => {
                            setTaskWeight(w);
                            setInspectedWeight(w);
                            triggerBlink(t.id);
                          }}
                          className={`flex items-center justify-between px-3 py-2 transition-all cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/30 ${
                            isBlinking
                              ? 'animate-weight-blink bg-purple-100 dark:bg-purple-950/80 ring-2 ring-purple-500'
                              : isInspected || isSelected
                              ? 'bg-purple-100/90 dark:bg-purple-950/70 text-purple-950 dark:text-purple-100 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span className="flex-1 mr-2 break-words whitespace-normal text-[11px] leading-tight">
                            {t.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 transition-colors ${
                              isInspected || isSelected || isBlinking
                                ? 'bg-purple-600 text-white shadow-2xs'
                                : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            }`}
                          >
                            #{w}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DATE & REMINDERS POPUP (NO RED CIRCLED STANDALONE TIME; TIME IS ONLY IN CUSTOM REMINDER) */}
      {activeModal === 'dateTimeReminders' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-3.5 flex flex-col max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <CalendarClock size={17} className="text-amber-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Date & Reminders
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-2.5 space-y-3">
              {conflictNotice && (
                <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                  <Check size={14} strokeWidth={3} />
                  <span>{conflictNotice}</span>
                </div>
              )}

              {/* TINY CALENDAR */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/70 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    {monthNames[month]} {year}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-0.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-0.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-semibold text-zinc-400 mb-0.5">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarDays.map((cd, idx) => {
                    const isSelected = selectedDates.includes(cd.dateStr);
                    const isToday = cd.dateStr === new Date().toISOString().split('T')[0];
                    const hasReminders = (dateAlertsMap[cd.dateStr] || []).length > 0;
                    return (
                      <button
                        key={`${cd.dateStr}-${idx}`}
                        type="button"
                        onClick={() => toggleDateSelection(cd.dateStr)}
                        className={`h-5 w-full rounded text-[10px] font-medium flex items-center justify-center relative transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white font-bold shadow-2xs'
                            : cd.isCurrentMonth
                            ? isToday
                              ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold border border-orange-300'
                              : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                            : 'text-zinc-400 dark:text-zinc-600 opacity-40'
                        }`}
                      >
                        <span>{cd.dayNum}</span>
                        {hasReminders && !isSelected && (
                          <span className="w-1 h-1 rounded-full bg-amber-500 absolute bottom-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Date Chips */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selectedDates.map(d => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-[9px] font-bold border border-orange-200 dark:border-orange-800"
                    >
                      {formatDateDisplay(d)}
                      {selectedDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleDateSelection(d)}
                          className="hover:text-rose-500"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* REMINDERS SECTION */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell size={13} className="text-amber-500" />
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      Reminders ({activeAlertsList.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddReminder}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition shadow-2xs"
                  >
                    + Add Reminder
                  </button>
                </div>

                {/* Task Due Time for Active Date */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-orange-500 shrink-0" />
                    <span className="font-bold text-[11px] text-zinc-800 dark:text-zinc-200">
                      Task Time ({formatDateDisplay(activeReminderDate)}):
                    </span>
                  </div>
                  <input
                    type="time"
                    value={dateTimesMap[activeReminderDate] || '10:30'}
                    onChange={e => {
                      const newT = e.target.value;
                      setDateTimesMap(prev => ({ ...prev, [activeReminderDate]: newT }));
                    }}
                    className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
                  />
                </div>

                {/* Date Switcher Tabs if multiple dates selected */}
                {selectedDates.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                    {selectedDates.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setActiveReminderDate(d)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition-all ${
                          activeReminderDate === d
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {formatDateDisplay(d)}
                      </button>
                    ))}
                  </div>
                )}

                {/* List of Reminders */}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {activeAlertsList.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 py-2 text-center">
                      No reminders yet. Click "+ Add Reminder" above.
                    </div>
                  ) : (
                    activeAlertsList.map(alert => (
                      <div
                        key={alert.id}
                        className="px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs flex items-center justify-between gap-2 text-xs"
                      >
                        {/* Compact type select */}
                        <select
                          value={alert.type}
                          onChange={e =>
                            handleUpdateReminderType(alert.id, e.target.value as TaskAlertType)
                          }
                          className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none shrink-0"
                        >
                          {ALERT_PRESETS.map(p => (
                            <option key={p.type} value={p.type} className="dark:bg-zinc-800">
                              {p.label}
                            </option>
                          ))}
                        </select>

                        {/* Relative reminder resolved absolute time badge */}
                        {alert.type !== 'custom' && (
                          <span className="text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800 shrink-0 ml-auto">
                            🕒 {getResolvedAlertTimeDisplay(alert.type, dateTimesMap[activeReminderDate] || '10:30')}
                          </span>
                        )}

                        {/* If custom time, render tiny inline time or locked state */}
                        {alert.type === 'custom' && (
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                            {lockedAlertIds[alert.id] ? (
                              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5 text-[11px]">
                                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                  🔒 {format12HourDisplay(alert.time || '10:30')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnlockReminderTime(alert.id)}
                                  className="text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-300 p-0.5"
                                  title="Edit timing"
                                >
                                  <Pencil size={10} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-0.5 shrink-0">
                                <select
                                  value={getHour12(alert.time || '10:30')}
                                  onChange={e =>
                                    handleUpdateReminderTime(
                                      alert.id,
                                      e.target.value,
                                      getMinute(alert.time || '10:30'),
                                      getAmPm(alert.time || '10:30')
                                    )
                                  }
                                  className="bg-transparent text-[11px] font-bold text-zinc-900 dark:text-zinc-100 px-0.5 outline-none cursor-pointer"
                                >
                                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                    <option key={h} value={h} className="dark:bg-zinc-800">
                                      {h}
                                    </option>
                                  ))}
                                </select>
                                <span className="font-bold text-zinc-400 text-[11px]">:</span>
                                <select
                                  value={getMinute(alert.time || '10:30')}
                                  onChange={e =>
                                    handleUpdateReminderTime(
                                      alert.id,
                                      getHour12(alert.time || '10:30'),
                                      e.target.value,
                                      getAmPm(alert.time || '10:30')
                                    )
                                  }
                                  className="bg-transparent text-[11px] font-bold text-zinc-900 dark:text-zinc-100 px-0.5 outline-none cursor-pointer"
                                >
                                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                    <option key={m} value={m} className="dark:bg-zinc-800">
                                      {m}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateReminderTime(
                                      alert.id,
                                      getHour12(alert.time || '10:30'),
                                      getMinute(alert.time || '10:30'),
                                      getAmPm(alert.time || '10:30') === 'AM' ? 'PM' : 'AM'
                                    )
                                  }
                                  className="px-1 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded shrink-0 cursor-pointer"
                                >
                                  {getAmPm(alert.time || '10:30')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLockReminderTime(alert.id)}
                                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                                  title="Lock time"
                                >
                                  <Check size={11} className="stroke-[3]" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveReminder(alert.id)}
                          className="text-zinc-400 hover:text-rose-500 p-1 rounded transition shrink-0 ml-auto"
                          title="Remove reminder"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {activeReminderDate !== 'all' && selectedDates.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyRemindersToAllDates}
                    className="w-full text-center text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline pt-1"
                  >
                    Apply these reminders to all dates
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBTASKS POPUP */}
      {activeModal === 'subtasks' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <CheckSquare size={18} className="text-emerald-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Subtasks</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 my-2.5 shrink-0">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                placeholder="Add subtask..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {subtasks.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-4">No subtasks added yet.</div>
              ) : (
                subtasks.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={s.completed}
                        onChange={() => handleToggleSubtask(s.id)}
                        className="rounded text-emerald-500 focus:ring-0"
                      />
                      <span
                        className={`truncate ${
                          s.completed
                            ? 'line-through text-zinc-400 dark:text-zinc-500'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {s.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(s.id)}
                      className="text-zinc-400 hover:text-rose-500 p-0.5 ml-2"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. NOTES POPUP */}
      {activeModal === 'notes' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={18} className="text-sky-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Note</h3>
              </div>
              <button type="button" onClick={() => setActiveModal('none')} className="p-1 rounded-lg text-zinc-500">
                <X size={16} />
              </button>
            </div>

            <textarea
              rows={5}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="w-full my-3 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none resize-none"
            />

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
              <button type="button" onClick={() => setActiveModal('none')} className="px-4 py-1.5 bg-sky-500 text-white text-xs font-semibold rounded-xl">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. GOALS POPUP (DEDUPLICATED & LABELED ONLY 'Goal') */}
      {activeModal === 'goals' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <Target size={18} className="text-indigo-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Goal</h3>
              </div>
              <button type="button" onClick={() => setActiveModal('none')} className="p-1 rounded-lg text-zinc-500">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 my-3 pr-1">
              <button
                type="button"
                onClick={() => {
                  setGoalId('');
                  setActiveModal('none');
                }}
                className={`w-full p-2.5 rounded-xl border text-left font-medium text-xs transition-all ${
                  !goalId
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300'
                }`}
              >
                None (Standalone Task)
              </button>

              {uniqueGoals.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGoalId(g.id);
                    setActiveModal('none');
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left font-medium text-xs transition-all flex items-center justify-between ${
                    goalId === g.id
                      ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-indigo-500" />
                    <span className="truncate">{g.title}</span>
                  </div>
                  {goalId === g.id && <Check size={14} className="text-indigo-500" />}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
              <button type="button" onClick={() => setActiveModal('none')} className="px-4 py-1.5 bg-indigo-500 text-white text-xs font-semibold rounded-xl">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAGS POPUP */}
      {activeModal === 'tags' && (
        <div className="fixed inset-0 z-60 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <Tag size={18} className="text-rose-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Tags</h3>
              </div>
              <button type="button" onClick={() => setActiveModal('none')} className="p-1 rounded-lg text-zinc-500">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 my-2.5 shrink-0">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                placeholder="New tag..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
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
                className="p-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 my-1 pr-1">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  new Set([
                    'Work',
                    'Personal',
                    'Health',
                    'Finance',
                    'Study',
                    'Urgent',
                    ...(availableTags || []).map(t => (typeof t === 'string' ? t : t.name)),
                    ...selectedTags,
                  ])
                ).map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {isSelected && '✓ '}#{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
              <button type="button" onClick={() => setActiveModal('none')} className="px-4 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-xl">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
