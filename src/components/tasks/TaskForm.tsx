import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Pencil,
  LayoutGrid,
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
  Clock,
  MapPin,
  Link2,
  Sparkles,
  Star,
  Flame,
  Calendar,
  Palette,
  ChevronDown,
  Sun,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import {
  TaskItem,
  EisenhowerQuadrant,
  Subtask,
  TaskAlert,
  TaskAlertType,
  Priority,
  ScheduleItem,
  ScheduleCategory,
  ReminderType,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  UnifiedSubModal,
  FormHeroTitleCard,
} from '../common/FormPrimitives';
import { PetalShapeBadge } from '../common/PetalExpressive';
import { IconRenderer } from '../common/IconRenderer';
import { StructuredIconColorPicker } from '../common/StructuredIconColorPicker';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import {
  InteractiveTagButton,
  cleanTagName,
  dedupeTagsCaseInsensitive,
  hasTagCaseInsensitive,
  toggleTagCaseInsensitive,
} from '../common/TagVisuals';

export interface TaskFormProps {
  initialTask?: Partial<TaskItem>;
  initialEvent?: Partial<ScheduleItem> | null;
  initialMode?: 'task' | 'event';
  initialHour?: string;
  onSubmit: (taskData: Partial<TaskItem>) => void;
  onSubmitEvent?: (eventData: Partial<ScheduleItem>) => void;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  onArchiveToggle?: (taskId: string) => void;
  onSwitchToHabit?: () => void;
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
  | 'tags'
  | 'eventTimeBlock'
  | 'eventCategory'
  | 'eventReminders'
  | 'eventLocation'
  | 'eventTaskLink';

type InlineOptionTab = 'schedule' | 'priority' | 'tags' | 'goal';

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
    label: 'Urgent',
    action: 'DO',
    color: '#ef4444',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
    badgeText: 'text-rose-800 dark:text-rose-200',
    badgeBorder: 'border-rose-300 dark:border-rose-800',
    icon: '🚨',
  },
  {
    id: 'not_urgent_important',
    label: 'Important',
    action: 'PLAN',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-800 dark:text-amber-200',
    badgeBorder: 'border-amber-300 dark:border-amber-800',
    icon: '⏳',
  },
  {
    id: 'urgent_not_important',
    label: 'Delegate',
    action: 'PASS',
    color: '#3b82f6',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80',
    badgeText: 'text-blue-800 dark:text-blue-200',
    badgeBorder: 'border-blue-300 dark:border-blue-800',
    icon: '⏩',
  },
  {
    id: 'not_urgent_not_important',
    label: 'Low',
    action: 'SKIP',
    color: '#8b5cf6',
    badgeBg: 'bg-violet-100 dark:bg-violet-950/80',
    badgeText: 'text-violet-800 dark:text-violet-200',
    badgeBorder: 'border-violet-300 dark:border-violet-800',
    icon: '💤',
  },
];

const UPTODO_TEMPLATES = [
  {
    id: 'morning',
    label: '🌅 Morning Routine',
    title: 'Morning Reset & Planning',
    category: 'Personal',
    steps: ['Hydrate (500ml water)', 'Review top 3 priorities', '10m stretch & mobility'],
  },
  {
    id: 'deep_work',
    label: '💻 Deep Work Sprint',
    title: '90-Min Deep Work Block',
    category: 'Work',
    steps: ['Silence phone & notifications', 'Complete core deliverable', 'Log progress notes'],
  },
  {
    id: 'grocery',
    label: '🛒 Grocery Run',
    title: 'Weekly Grocery Essentials',
    category: 'Shopping',
    steps: ['Fresh fruits & greens', 'Protein & dairy staples', 'Whole grains & snacks'],
  },
  {
    id: 'workout',
    label: '🏋️ Workout Session',
    title: 'Full-Body Strength & Cardio',
    category: 'Health',
    steps: ['5m dynamic warm-up', '30m compound lifts / intervals', '5m cooldown stretch'],
  },
  {
    id: 'travel',
    label: '🧳 Travel Packing',
    title: 'Trip Packing Checklist',
    category: 'Personal',
    steps: ['ID, tickets & wallet', 'Chargers & power bank', 'Medications & toiletries'],
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

const formatTime12 = (time24?: string) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
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
  initialEvent,
  initialMode = 'task',
  initialHour,
  onSubmit,
  onSubmitEvent,
  onClose,
  onDelete,
  onDeleteEvent,
  onArchiveToggle,
  onSwitchToHabit,
  showHeader = true,
}) => {
  const {
    tasks,
    goals,
    tags: availableTags,
    scheduleItems,
    updateTask,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    pushNotification,
  } = useApp();

  // Inline Option Tab (anti-shrink tabbed inspector)
  const [inlineTab, setInlineTab] = useState<InlineOptionTab>('schedule');
  const [showTemplates, setShowTemplates] = useState<boolean>(false);

  // Basic Form States
  const [title, setTitle] = useState(initialEvent?.title || initialTask?.title || '');
  const [notes, setNotes] = useState(initialEvent?.notes || initialTask?.notes || '');
  const [isStarred, setIsStarred] = useState<boolean>(Boolean(initialTask?.isStarred));
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(
    initialTask?.quadrant && initialTask.quadrant !== 'neither'
      ? initialTask.quadrant
      : 'not_urgent_important'
  );

  // Unified Date & Time States (From & To)
  const todayDefaultStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Selected dates list
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    if (initialEvent?.date) {
      return [initialEvent.date];
    }
    if (initialTask?.dates && initialTask.dates.length > 0) {
      return [...initialTask.dates];
    }
    if (initialTask?.dueDate) {
      return [initialTask.dueDate];
    }
    return [todayDefaultStr];
  });

  const eventDate = selectedDates[0] || todayDefaultStr;
  const setEventDate = (d: string) => {
    if (!d) return;
    setSelectedDates([d]);
  };

  // From Time (always set by default for single task reminder/time)
  const [eventStartTime, setEventStartTime] = useState<string>(() => {
    if (initialEvent?.startTime) return initialEvent.startTime;
    if (initialHour) return `${initialHour.padStart(2, '0')}:00`;
    return initialTask?.dueTime || '09:00';
  });

  // To Time (Empty = Single Task; Filled alongside From = Timeline item!)
  const [eventEndTime, setEventEndTime] = useState<string>(() => {
    if (initialEvent?.endTime) return initialEvent.endTime;
    if (initialMode === 'event' || initialHour) {
      const startStr =
        initialEvent?.startTime ||
        (initialHour ? `${initialHour.padStart(2, '0')}:00` : initialTask?.dueTime || '09:00');
      const [hStr, mStr] = startStr.split(':');
      const endH = String(Math.min(23, (parseInt(hStr, 10) || 9) + 1)).padStart(2, '0');
      return `${endH}:${mStr || '00'}`;
    }
    return '';
  });

  // Dynamic determination: If both From and To are set, it is a Timeline item; if only From is set, it is a single Task!
  const isTimelineBlock = Boolean(eventStartTime && eventEndTime);
  const formMode: 'task' | 'event' = isTimelineBlock ? 'event' : 'task';

  // Structured Color & Icon State
  const [selectedColor, setSelectedColor] = useState<string>(
    () => initialEvent?.color || initialTask?.color || (isTimelineBlock ? '#55789b' : '#f39b93')
  );
  const [selectedIcon, setSelectedIcon] = useState<string>(
    () => initialEvent?.icon || initialTask?.icon || (isTimelineBlock ? 'clock' : 'check_circle')
  );
  const [showColorIconPicker, setShowColorIconPicker] = useState<boolean>(false);

  // Clean Card Accent Color
  const accentColor = selectedColor || (isTimelineBlock ? '#55789b' : '#f39b93');

  const [eventIsAllDay, setEventIsAllDay] = useState<boolean>(Boolean(initialEvent?.isAllDay));
  const [eventCategory, setEventCategory] = useState<ScheduleCategory>(
    (initialEvent?.category as ScheduleCategory) || 'work'
  );
  const [eventPriority, setEventPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>(() => {
    const raw = (initialEvent?.priority || initialTask?.priority || 'P2').toString().toUpperCase();
    if (raw === 'P1' || raw === 'HIGH') return 'P1';
    if (raw === 'P2' || raw === 'MEDIUM') return 'P2';
    if (raw === 'P3') return 'P3';
    if (raw === 'P4' || raw === 'LOW') return 'P4';
    return 'P2';
  });
  const [eventLocation, setEventLocation] = useState<string>(initialEvent?.location || '');
  const [eventTaskId, setEventTaskId] = useState<string>(initialEvent?.taskId || '');
  const [eventReminderTiming, setEventReminderTiming] = useState<string>(
    initialEvent?.reminderTiming || 'on_time'
  );
  const [eventReminderType, setEventReminderType] = useState<ReminderType>(
    initialEvent?.reminderType || 'notification'
  );
  const [eventRepeatType, setEventRepeatType] = useState<string>(
    initialEvent?.repeatType || 'none'
  );

  const eventConflicts = useMemo(() => {
    if (!isTimelineBlock || eventIsAllDay || !eventDate || !eventStartTime || !eventEndTime) return [];
    const [sH, sM] = eventStartTime.split(':').map(Number);
    const [eH, eM] = eventEndTime.split(':').map(Number);
    if (isNaN(sH) || isNaN(eH)) return [];
    const startMin = sH * 60 + (sM || 0);
    const endMin = eH * 60 + (eM || 0);

    return (scheduleItems || []).filter(s => {
      if (s.date !== eventDate) return false;
      if (initialEvent?.id && s.id === initialEvent.id) return false;
      if (!s.startTime || !s.endTime) return false;
      const [oSH, oSM] = s.startTime.split(':').map(Number);
      const [oEH, oEM] = s.endTime.split(':').map(Number);
      if (isNaN(oSH) || isNaN(oEH)) return false;
      const oStartMin = oSH * 60 + (oSM || 0);
      const oEndMin = oEH * 60 + (oEM || 0);
      return startMin < oEndMin && endMin > oStartMin;
    });
  }, [isTimelineBlock, eventIsAllDay, eventDate, eventStartTime, eventEndTime, scheduleItems, initialEvent?.id]);

  const eventNextFreeSlot = useMemo(() => {
    if (eventConflicts.length === 0) return null;
    let latestConflictEnd = 0;
    eventConflicts.forEach(c => {
      const [h, m] = c.endTime.split(':').map(Number);
      const mins = (isNaN(h) ? 0 : h) * 60 + (m || 0);
      if (mins > latestConflictEnd) latestConflictEnd = mins;
    });
    const targetH = Math.floor(latestConflictEnd / 60);
    const targetM = latestConflictEnd % 60;
    if (targetH >= 24) return null;

    const [curSH, curSM] = eventStartTime.split(':').map(Number);
    const [curEH, curEM] = eventEndTime.split(':').map(Number);
    const currentDur = Math.max(
      30,
      (isNaN(curEH) ? 0 : curEH) * 60 +
        (curEM || 0) -
        ((isNaN(curSH) ? 0 : curSH) * 60 + (curSM || 0))
    );

    const startStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}`;
    const endMinutes = latestConflictEnd + currentDur;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    return { startStr, endStr, conflictNames: eventConflicts.map(c => c.title).join(', ') };
  }, [eventConflicts, eventStartTime, eventEndTime]);

  const handleSetEventDuration = (minutes: number) => {
    const baseStart = eventStartTime || '09:00';
    if (!eventStartTime) setEventStartTime(baseStart);
    const [h, m] = baseStart.split(':').map(Number);
    const totalMins = (isNaN(h) ? 9 : h) * 60 + (m || 0) + minutes;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    setEventEndTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const [taskWeight, setTaskWeight] = useState<number>(() => {
    const w = getEffectiveWeight(initialTask);
    return w > 0 ? w : 1;
  });
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [inspectedWeight, setInspectedWeight] = useState<number | null>(null);
  const [blinkingTaskId, setBlinkingTaskId] = useState<string | null>(null);
  const weightListRef = useRef<HTMLDivElement>(null);
  const taskItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    const initialList =
      initialTask?.dates && initialTask.dates.length > 0
        ? initialTask.dates
        : [initialTask?.dueDate || todayStr];
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
  const [goalId, setGoalId] = useState(initialTask?.goalId || initialEvent?.goalId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTask?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Active popup
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
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

  // Deduplicated Active Goals (still keeps currently assigned goal if already linked)
  const uniqueGoals = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const list: typeof goals = [];
    for (const g of goals || []) {
      if (!g || !g.title) continue;
      if (g.archived && g.id !== goalId) continue;
      const cleanTitle = g.title.trim().toLowerCase();
      if (seenIds.has(g.id) || seenTitles.has(cleanTitle)) continue;
      seenIds.add(g.id);
      seenTitles.add(cleanTitle);
      list.push(g);
    }
    return list;
  }, [goals, goalId]);

  // Global rank mapping
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

  const usedRanksDetailsInQuadrant = useMemo(() => {
    const map = new Map<number, TaskItem[]>();
    activeQuadrantTasksWithWeight.forEach(t => {
      const w = getEffectiveWeight(t, taskGlobalRankMap);
      if (w > 0) {
        const list = map.get(w) || [];
        list.push(t);
        map.set(w, list);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rank, items]) => ({
        rank,
        tasks: items,
        primaryTitle: items[0]?.title || `Task #${rank}`,
      }));
  }, [activeQuadrantTasksWithWeight, taskGlobalRankMap]);

  const [openRankDropdown, setOpenRankDropdown] = useState<'none' | 'sequence' | 'used'>('none');

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

  const scrollToWeight = useCallback(
    (w: number) => {
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
    },
    [activeQuadrantTasksWithWeight, taskGlobalRankMap, triggerBlink]
  );

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

  const handleSelectQuadrant = (q: EisenhowerQuadrant) => {
    setQuadrant(q);
    setActiveModal('none');
  };

  const handleApplyTemplate = (tpl: (typeof UPTODO_TEMPLATES)[number]) => {
    setTitle(tpl.title);
    if (!selectedTags.includes(tpl.category)) {
      setSelectedTags(prev => [tpl.category, ...prev]);
    }
    setSubtasks(
      tpl.steps.map((stepText, idx) => ({
        id: `tpl_${Date.now()}_${idx}`,
        title: stepText,
        completed: false,
      }))
    );
    setShowTemplates(false);
  };

  const toggleDateSelection = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      if (selectedDates.length > 1) {
        const nextDates = selectedDates.filter(d => d !== dateStr);
        setSelectedDates(nextDates);
        if (activeReminderDate === dateStr) {
          setActiveReminderDate(nextDates[0] || '');
        }
      }
    } else {
      const nextDates = [...selectedDates, dateStr].sort();
      setSelectedDates(nextDates);
      setActiveReminderDate(dateStr);
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
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  const activeAlertsList: TaskAlert[] = useMemo(() => {
    return dateAlertsMap[activeReminderDate] || [];
  }, [activeReminderDate, dateAlertsMap]);

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

  const handleQuickPresetAlert = (presetType: TaskAlertType) => {
    const targetDate = activeReminderDate || selectedDates[0] || todayDefaultStr;
    const existing = dateAlertsMap[targetDate] || [];
    const hasSame = existing.some(a => a.type === presetType);
    if (hasSame) {
      setDateAlertsMap(prev => ({
        ...prev,
        [targetDate]: (prev[targetDate] || []).filter(a => a.type !== presetType),
      }));
    } else {
      const label = ALERT_PRESETS.find(p => p.type === presetType)?.label || 'Reminder';
      const newAlert: TaskAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: presetType,
        time: presetType === 'custom' ? '10:30' : undefined,
        label,
        triggered: false,
        date: targetDate,
      };
      setDateAlertsMap(prev => ({
        ...prev,
        [targetDate]: [...(prev[targetDate] || []), newAlert],
      }));
    }
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
            time: newType === 'custom' ? a.time || '10:30' : undefined,
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
    setConflictNotice('Reminder time locked!');
    setTimeout(() => setConflictNotice(null), 2000);
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
      setTimeout(() => setConflictNotice(null), 2500);
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
    setSubtasks(subtasks.map(s => (s.id === id ? { ...s, completed: !s.completed } : s)));
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
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

    if (isTimelineBlock) {
      const agendaNotes =
        subtasks.length > 0
          ? `${notes.trim() ? `${notes.trim()}\n` : ''}${subtasks
              .map(s => `${s.completed ? '☑' : '☐'} ${s.title}`)
              .join('\n')}`
          : notes.trim();

      const eventData: Partial<ScheduleItem> = {
        ...(initialEvent || {}),
        title: title.trim(),
        date: eventDate || todayDefaultStr,
        startTime: eventIsAllDay ? '00:00' : eventStartTime,
        endTime: eventIsAllDay ? '23:59' : eventEndTime,
        category: eventCategory,
        priority: eventPriority,
        completed: initialEvent?.completed || initialTask?.completed || false,
        location: eventLocation.trim() || undefined,
        notes: agendaNotes || undefined,
        taskId: eventTaskId || undefined,
        goalId: goalId || undefined,
        isAllDay: eventIsAllDay,
        reminderType: eventReminderType,
        reminderTiming: eventReminderTiming,
        repeatType: eventRepeatType,
        repeatUntil: initialEvent?.repeatUntil || 'forever',
        icon: selectedIcon,
        color: selectedColor,
      };

      if (initialTask?.id && onDelete) {
        onDelete(initialTask.id);
      }

      if (onSubmitEvent) {
        onSubmitEvent(eventData);
      } else if (initialEvent?.id) {
        updateScheduleItem(eventData as ScheduleItem);
        onClose();
      } else {
        addScheduleItem({ ...eventData, completed: false } as Omit<ScheduleItem, 'id'>);
        onClose();
      }
      return;
    }

    if (initialEvent?.id) {
      if (onDeleteEvent) {
        onDeleteEvent(initialEvent.id);
      } else {
        deleteScheduleItem(initialEvent.id);
      }
    }

    const primaryDueDate = selectedDates[0] || new Date().toISOString().split('T')[0];
    const primaryDueTime = eventStartTime || dateTimesMap[primaryDueDate] || initialTask?.dueTime;

    const finalDateSchedules = selectedDates.map(d => {
      const alertsForDate = dateAlertsMap[d] || [];
      const dateDueTime = eventStartTime || dateTimesMap[d] || initialTask?.dueTime;
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
      icon: selectedIcon,
      color: selectedColor,
      isStarred,
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
    const baseDate = selectedDates.length === 0 ? 'No date' : selectedDates.length === 1 ? formatDateDisplay(selectedDates[0]) : `${selectedDates.length} dates`;
    if (eventStartTime && eventEndTime) {
      return `${baseDate} • ${eventStartTime}–${eventEndTime}`;
    }
    if (eventStartTime) {
      return `${baseDate} • ${eventStartTime}`;
    }
    return baseDate;
  };

  const selectedGoalTitle = useMemo(() => {
    if (!goalId) return null;
    return uniqueGoals.find(g => g.id === goalId)?.title;
  }, [goalId, uniqueGoals]);

  const isEditingExisting = Boolean(initialTask?.id || initialEvent?.id);

  const PRIORITY_LEVELS: {
    id: 'P1' | 'P2' | 'P3' | 'P4';
    label: string;
    short: string;
    desc: string;
    activeCls: string;
    dotCls: string;
  }[] = [
    {
      id: 'P1',
      label: 'Priority 1',
      short: 'P1',
      desc: 'Critical',
      activeCls:
        'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold shadow-2xs ring-1 ring-rose-500/40',
      dotCls: 'bg-rose-500',
    },
    {
      id: 'P2',
      label: 'Priority 2',
      short: 'P2',
      desc: 'High',
      activeCls:
        'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold shadow-2xs ring-1 ring-amber-500/40',
      dotCls: 'bg-amber-500',
    },
    {
      id: 'P3',
      label: 'Priority 3',
      short: 'P3',
      desc: 'Medium',
      activeCls:
        'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-2xs ring-1 ring-blue-500/40',
      dotCls: 'bg-blue-500',
    },
    {
      id: 'P4',
      label: 'Priority 4',
      short: 'P4',
      desc: 'Low',
      activeCls:
        'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold shadow-2xs ring-1 ring-violet-500/40',
      dotCls: 'bg-violet-500',
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100">
      {/* M3 EXPRESSIVE STICKY HEADER */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 min-h-[52px] bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/70 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <PetalShapeBadge
              shape="scallop"
              sizeClass="w-8 h-8"
              fillColor={isTimelineBlock ? '#4f46e51f' : `${accentColor}1f`}
              strokeColor={isTimelineBlock ? '#4f46e542' : `${accentColor}42`}
            >
              {isTimelineBlock ? (
                <CalendarClock size={15} style={{ color: '#4f46e5' }} />
              ) : (
                <CheckSquare size={15} style={{ color: accentColor }} />
              )}
            </PetalShapeBadge>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate block">
                {isEditingExisting ? 'Edit' : 'New'} {isTimelineBlock ? 'Timeline' : 'Task'}
                {isTimelineBlock && (
                  <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 ml-1.5 tabular-nums">
                    {eventStartTime}–{eventEndTime}
                  </span>
                )}
              </span>
            </div>
          </div>

          {!isEditingExisting && onSwitchToHabit && (
            <div className="inline-flex items-center p-0.5 rounded-full bg-[#f1f4fa] dark:bg-zinc-800/90 text-xs shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-orange-500 text-white shadow-xs">
                <CheckSquare size={11} />
                <span>Task</span>
              </span>
              <button
                type="button"
                onClick={onSwitchToHabit}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Flame size={11} />
                <span>Habit</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsStarred(prev => !prev)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isStarred
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-500 ring-1 ring-amber-400/50'
                  : 'bg-[#f1f4fa] dark:bg-zinc-800/80 text-zinc-400 hover:text-amber-500'
              }`}
              title={isStarred ? 'Starred / Bookmarked' : 'Star / Bookmark Task'}
            >
              <Star size={14} className={isStarred ? 'fill-amber-400 text-amber-500' : ''} />
            </button>
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

      {/* UNIFIED SCROLLABLE BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 sm:px-3.5 py-2.5 flex flex-col gap-2.5 custom-scrollbar [scrollbar-gutter:stable]">
        {/* HERO TITLE + COLOR & ICON STUDIO & TEMPLATES + CONNECTED NOTE & CHECKLIST */}
        <FormHeroTitleCard
          value={title}
          onChange={setTitle}
          autoFocus={!isEditingExisting}
          placeholder="What needs to be done?"
          accentColor={accentColor}
          icon={<IconRenderer icon={selectedIcon} className="w-4 h-4" />}
          iconShape="scallop"
          onIconClick={() => setShowColorIconPicker(prev => !prev)}
          iconTooltip="Click to customize Color & Icon"
          multiline
          rows={1}
          onEnterSubmit={handleSubmit}
          rightActionSlot={
            <>
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setShowColorIconPicker(prev => !prev)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  showColorIconPicker
                    ? 'text-white shadow-xs'
                    : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                }`}
                style={
                  showColorIconPicker
                    ? { backgroundColor: accentColor }
                    : undefined
                }
                title="Open Structured Color & Icon Picker"
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
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
                title="1-Tap Templates"
              >
                <Sparkles size={11} className={showTemplates ? 'text-white' : 'text-indigo-500'} />
                <span>Templates</span>
              </button>
            </>
          }
          middleSlot={
            <div className="space-y-2.5">
              {showColorIconPicker && (
                <StructuredIconColorPicker
                  selectedColor={selectedColor}
                  onSelectColor={setSelectedColor}
                  selectedIcon={selectedIcon}
                  onSelectIcon={setSelectedIcon}
                  onClose={() => setShowColorIconPicker(false)}
                />
              )}

              {showTemplates && (
                <div className="p-2.5 rounded-[18px] bg-indigo-50/80 dark:bg-indigo-950/35 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>1-Tap Task Templates</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTemplates(false)}
                      className="text-[10.5px] font-bold text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {UPTODO_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1e1e26] hover:bg-indigo-600 hover:text-white text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Tonal Stack: Note + Checklist */}
              <div className="space-y-[3px]">
                {/* Top Segment: Inline Note */}
                <div className="flex items-start gap-2 rounded-t-[16px] rounded-b-[6px] bg-[#f3f5fa] dark:bg-[#111116] px-3 py-2">
                  <MessageSquare size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <textarea
                    rows={notes && notes.length > 50 ? 2 : 1}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add note, description, or link..."
                    className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Bottom Segment: Unified Checklist */}
                <div className="rounded-t-[6px] rounded-b-[16px] bg-[#f3f5fa] dark:bg-[#111116] px-3 py-2 space-y-1.5">
                  {subtasks.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 tabular-nums">
                          Checklist ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                        </span>
                        <div className="w-14 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{
                              width: `${Math.round(
                                (subtasks.filter(s => s.completed).length / subtasks.length) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto pr-0.5 custom-scrollbar">
                        {subtasks.map(s => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-zinc-800/70 text-xs group transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleSubtask(s.id)}
                              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 text-left"
                            >
                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0 ${
                                  s.completed
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-600'
                                }`}
                              >
                                {s.completed && <Check size={9} strokeWidth={3} />}
                              </div>
                              <span
                                className={`break-words text-[11.5px] leading-snug ${
                                  s.completed
                                    ? 'line-through text-zinc-400 dark:text-zinc-500'
                                    : 'text-zinc-800 dark:text-zinc-200 font-medium'
                                }`}
                              >
                                {s.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(s.id)}
                              className="text-zinc-400 hover:text-rose-500 p-0.5 opacity-75 group-hover:opacity-100 cursor-pointer shrink-0"
                              title="Remove step"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-emerald-500 shrink-0" />
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={e => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                      placeholder={
                        subtasks.length > 0
                          ? 'Add another checklist step...'
                          : 'Add subtask / checklist step (press Enter)...'
                      }
                      className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none py-0.5"
                    />
                    {newSubtaskTitle.trim() && (
                      <button
                        type="button"
                        onClick={handleAddSubtask}
                        className="px-3 py-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer shrink-0 shadow-2xs transition-colors"
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
            M3 EXPRESSIVE 4-TAB CONNECTED INSPECTOR TRAY
           ========================================================================= */}
        <div className="flex-1 min-h-[200px] flex flex-col bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[24px] overflow-hidden shadow-2xs">
          {/* Connected Morphing 4-Button Segmented Toolbar */}
          <div className="grid grid-cols-4 gap-[3px] p-1.5 bg-[#f1f4fa] dark:bg-[#111116] shrink-0">
            {[
              {
                id: 'schedule' as InlineOptionTab,
                label: 'Time',
                badge: getScheduleSummary(),
                icon: <CalendarClock size={13} />,
                activeCls: isTimelineBlock
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-amber-500 text-white shadow-sm',
              },
              {
                id: 'priority' as InlineOptionTab,
                label: isTimelineBlock ? 'Priority' : 'Matrix',
                badge: isTimelineBlock
                  ? `${eventPriority} · ${eventCategory}`
                  : `${currentQuadrantInfo.action} #${taskWeight}`,
                icon: <Scale size={13} />,
                activeCls: 'bg-orange-500 text-white shadow-sm',
              },
              {
                id: 'tags' as InlineOptionTab,
                label: 'Tags',
                badge:
                  selectedTags.length > 0
                    ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`
                    : 'Add',
                icon: <Tag size={13} />,
                activeCls: 'bg-rose-500 text-white shadow-sm',
              },
              {
                id: 'goal' as InlineOptionTab,
                label: 'Goal',
                badge: selectedGoalTitle ? 'Linked' : 'None',
                icon: <Target size={13} />,
                activeCls: 'bg-indigo-600 text-white shadow-sm',
              },
            ].map((tab, idx) => {
              const isActive = inlineTab === tab.id;
              const morphShape = isActive
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
                  className={`flex flex-col items-center justify-center py-2 px-1 ${morphShape} transition-colors duration-200 cursor-pointer min-w-0 ${
                    isActive
                      ? tab.activeCls
                      : 'bg-white/70 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold truncate max-w-full">
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </div>
                  <span
                    className={`text-[9.5px] font-semibold truncate max-w-full mt-0.5 tabular-nums ${
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
            {/* TAB 1: UNIFIED SCHEDULE, FROM & TO TIME + QUICK DURATION CHIPS + REMINDERS */}
            {inlineTab === 'schedule' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {isTimelineBlock ? 'From–To Timeline' : 'Single Task'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModal('dateTimeReminders')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-100 cursor-pointer"
                  >
                    <Calendar size={12} />
                    <span>Multi-Date ({selectedDates.length})</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

                {/* Quick Date Pills + Inline Date Input — Responsive Wrap Prevents Mobile Clipping */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 w-full">
                  <div className="flex items-center gap-1 shrink-0">
                    {[
                      { label: 'Today', offset: 0, icon: <Calendar size={11} /> },
                      { label: 'Tomorrow', offset: 1, icon: <Sun size={11} /> },
                      { label: '+7d', offset: 7, icon: <CalendarClock size={11} /> },
                    ].map(p => {
                      const dObj = new Date();
                      dObj.setDate(dObj.getDate() + p.offset);
                      const iso = dObj.toISOString().split('T')[0];
                      const isSel = selectedDates.length === 1 && selectedDates[0] === iso;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          data-no-press-scale="true"
                          onClick={() => {
                            setSelectedDates([iso]);
                            setActiveReminderDate(iso);
                          }}
                          className={`px-2.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            isSel
                              ? 'rounded-full bg-amber-500 text-white shadow-xs'
                              : 'rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70'
                          }`}
                        >
                          {p.icon}
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="date"
                    value={selectedDates[0] || todayDefaultStr}
                    onChange={e => {
                      if (e.target.value) {
                        setSelectedDates([e.target.value]);
                        setActiveReminderDate(e.target.value);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-[11px] font-bold text-zinc-800 dark:text-zinc-200 outline-none shrink-0 cursor-pointer ml-auto"
                  />
                </div>

                {/* Side-by-Side FROM and TO Time Inputs */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="flex items-center justify-between gap-1.5 bg-[#f3f5fa] dark:bg-[#111116] px-3 py-2 rounded-[16px]">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      From
                    </span>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={e => {
                        const val = e.target.value;
                        setEventStartTime(val);
                        const primary = selectedDates[0] || todayDefaultStr;
                        setDateTimesMap(prev => ({ ...prev, [primary]: val }));
                      }}
                      className="bg-transparent text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none ml-auto tabular-nums"
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-[16px] transition ${
                      eventEndTime
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/45 ring-1 ring-indigo-500/35'
                        : 'bg-[#f3f5fa] dark:bg-[#111116]'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      To
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="time"
                        value={eventEndTime}
                        onChange={e => setEventEndTime(e.target.value)}
                        className="bg-transparent text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none tabular-nums"
                      />
                      {eventEndTime && (
                        <button
                          type="button"
                          onClick={() => setEventEndTime('')}
                          title="Clear To time (save as single Task)"
                          className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-rose-500 hover:text-white flex items-center justify-center text-[10px] font-bold transition cursor-pointer shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Duration Chips & Reminder Chips — Responsive Wrap Prevents Clipping */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/70 flex items-center justify-between flex-wrap gap-1.5 w-full">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400">To:</span>
                    {[15, 30, 45, 60, 120].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleSetEventDuration(mins)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f4fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-indigo-600 hover:text-white transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                      >
                        +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {(
                      [
                        { type: 'on_time' as TaskAlertType, label: 'At time', icon: <Bell size={10} /> },
                        { type: '15m' as TaskAlertType, label: '15m' },
                        { type: '1h' as TaskAlertType, label: '1h' },
                      ]
                    ).map(rem => {
                      const targetD = selectedDates[0] || todayDefaultStr;
                      const isSet = (dateAlertsMap[targetD] || []).some(
                        a => a.type === rem.type
                      );
                      return (
                        <button
                          key={rem.type}
                          type="button"
                          onClick={() => handleQuickPresetAlert(rem.type)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
                            isSet
                              ? 'bg-orange-500 text-white shadow-2xs'
                              : 'bg-[#f1f4fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70'
                          }`}
                        >
                          {rem.icon}
                          <span>{rem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EISENHOWER (WHEN SINGLE TASK) OR PRIORITY P1-P4 (WHEN FROM+TO TIMELINE) */}
            {inlineTab === 'priority' && (
              <div className="space-y-2.5">
                {!isTimelineBlock ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Eisenhower Quadrant
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveModal('weight')}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-100 cursor-pointer"
                      >
                        <span>Queue ({activeQuadrantTasksWithWeight.length})</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {EISENHOWER_QUADRANTS.map(q => {
                        const isSelected = quadrant === q.id;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            data-no-press-scale="true"
                            onClick={() => setQuadrant(q.id)}
                            className={`py-2 px-1 text-center transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                              isSelected
                                ? 'rounded-[20px] bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold shadow-xs ring-1 ring-orange-500/45'
                                : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70'
                            }`}
                          >
                            <span className="text-sm">{q.icon}</span>
                            <span className="text-[11px] font-extrabold leading-tight">
                              {q.action}
                            </span>
                            <span className="text-[9px] opacity-75">{q.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/70 flex items-center justify-between gap-2 relative">
                      {/* Left Dropdown: Sequence Rank (#1 - #99) */}
                      <div className="flex items-center gap-2 relative">
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                          Rank:
                        </span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenRankDropdown(prev => (prev === 'sequence' ? 'none' : 'sequence'))
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116] hover:bg-zinc-200/70 transition cursor-pointer"
                            title="Select Sequence Rank (1–99)"
                          >
                            <span className="text-xs font-mono font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
                              #{taskWeight}
                            </span>
                            <ChevronDown
                              size={12}
                              className={`text-zinc-400 transition-transform ${
                                openRankDropdown === 'sequence' ? 'rotate-180 text-orange-500' : ''
                              }`}
                            />
                          </button>

                          {openRankDropdown === 'sequence' && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenRankDropdown('none')}
                              />
                              <div className="absolute left-0 bottom-full mb-1.5 z-40 w-[236px] max-h-52 overflow-y-auto overscroll-contain rounded-[22px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.08] dark:ring-white/[0.1] shadow-xl p-2.5 space-y-1.5 custom-scrollbar">
                                <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                    Select Rank (1–99)
                                  </span>
                                  <span className="text-[10px] font-semibold text-zinc-400">
                                    Grey = Used
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  {Array.from({ length: 99 }, (_, i) => i + 1).map(num => {
                                    const isUsed = usedWeightsInQuadrant.has(num);
                                    const isSelected = taskWeight === num;
                                    return (
                                      <button
                                        key={num}
                                        type="button"
                                        onClick={() => {
                                          setTaskWeight(num);
                                          setOpenRankDropdown('none');
                                        }}
                                        className={`py-1 px-1.5 text-[11px] font-mono tabular-nums transition cursor-pointer flex items-center justify-center ${
                                          isSelected
                                            ? 'rounded-full bg-orange-500 text-white font-extrabold shadow-2xs'
                                            : isUsed
                                            ? 'rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 text-zinc-400/65 dark:text-zinc-500/55 opacity-55 font-medium hover:opacity-85'
                                            : 'rounded-lg bg-[#f3f5fa] dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-100 font-bold hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600'
                                        }`}
                                        title={
                                          isUsed
                                            ? `Rank #${num} (Used in ${currentQuadrantInfo.action})`
                                            : `Rank #${num} (Free)`
                                        }
                                      >
                                        #{num}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Dropdown: Used Ranks Selector */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenRankDropdown(prev => (prev === 'used' ? 'none' : 'used'))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116] hover:bg-zinc-200/70 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold transition cursor-pointer"
                          title="View & Select Used Ranks in this Quadrant"
                        >
                          <span>Used ({usedRanksDetailsInQuadrant.length})</span>
                          <ChevronDown
                            size={12}
                            className={`text-zinc-400 transition-transform ${
                              openRankDropdown === 'used' ? 'rotate-180 text-orange-500' : ''
                            }`}
                          />
                        </button>

                        {openRankDropdown === 'used' && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenRankDropdown('none')}
                            />
                            <div className="absolute right-0 bottom-full mb-1.5 z-40 w-[240px] max-h-52 overflow-y-auto overscroll-contain rounded-[22px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.08] dark:ring-white/[0.1] shadow-xl p-2.5 space-y-1 custom-scrollbar">
                              <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  Used in {currentQuadrantInfo.action}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTaskWeight(nextAvailableWeight);
                                    setOpenRankDropdown('none');
                                  }}
                                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Free #{nextAvailableWeight}
                                </button>
                              </div>

                              {usedRanksDetailsInQuadrant.length === 0 ? (
                                <div className="py-3 text-center text-[11px] text-zinc-400">
                                  No ranks used in {currentQuadrantInfo.action} yet
                                </div>
                              ) : (
                                usedRanksDetailsInQuadrant.map(entry => {
                                  const isSelected = taskWeight === entry.rank;
                                  return (
                                    <button
                                      key={entry.rank}
                                      type="button"
                                      onClick={() => {
                                        setTaskWeight(entry.rank);
                                        setOpenRankDropdown('none');
                                      }}
                                      className={`w-full px-2.5 py-1.5 rounded-[12px] text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-300 font-bold'
                                          : 'hover:bg-[#f3f5fa] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                      }`}
                                    >
                                      <span className="font-mono font-extrabold text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                                        #{entry.rank}
                                      </span>
                                      <span className="truncate flex-1 text-[11px]">
                                        {entry.primaryTitle}
                                      </span>
                                      {entry.tasks.length > 1 && (
                                        <span className="text-[9.5px] font-bold text-zinc-400 shrink-0">
                                          +{entry.tasks.length - 1}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Priority Level (Timeline)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {eventStartTime} – {eventEndTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {PRIORITY_LEVELS.map(p => {
                        const isSelected = eventPriority === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-no-press-scale="true"
                            onClick={() => setEventPriority(p.id)}
                            className={`py-2 px-1 text-center transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                              isSelected
                                ? `rounded-[20px] ${p.activeCls}`
                                : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${p.dotCls}`} />
                              <span className="text-xs font-extrabold">{p.short}</span>
                            </div>
                            <span className="text-[10px] font-bold leading-tight">{p.label}</span>
                            <span className="text-[9px] opacity-75">{p.desc}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/70 flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Category:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(
                          ['work', 'meeting', 'personal', 'health', 'study', 'other'] as ScheduleCategory[]
                        ).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setEventCategory(cat)}
                            className={`px-2.5 py-1 text-[10.5px] font-bold capitalize cursor-pointer transition-all ${
                              eventCategory === cat
                                ? 'rounded-full bg-indigo-600 text-white shadow-xs'
                                : 'rounded-[11px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: CATEGORY & TAGS */}
            {inlineTab === 'tags' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewTag();
                      }
                    }}
                    placeholder="Add custom category or #tag..."
                    className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    data-no-press-scale="true"
                    onClick={handleAddNewTag}
                    className="px-3.5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer shrink-0 transition-colors"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pb-1">
                  {dedupeTagsCaseInsensitive([
                    'Work',
                    'Personal',
                    'Wishlist',
                    'Health',
                    'Finance',
                    'Study',
                    'Shopping',
                    'Birthday',
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
            )}

            {/* TAB 4: GOAL LINK */}
            {inlineTab === 'goal' && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setGoalId('')}
                  className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    !goalId
                      ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                      : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span>None (Standalone Task)</span>
                  {!goalId && <Check size={13} className="text-indigo-500" />}
                </button>

                {uniqueGoals.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => setGoalId(g.id)}
                    className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      goalId === g.id
                        ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Target size={13} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{g.title}</span>
                    </div>
                    {goalId === g.id && <Check size={13} className="text-indigo-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* M3 EXPRESSIVE STICKY FOOTER */}
      <div className="shrink-0 bg-white/95 dark:bg-[#141418]/95 backdrop-blur-md border-t border-zinc-200/60 dark:border-zinc-800/70 px-4 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5">
          {initialTask?.id && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(initialTask.id!)}
              className="px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Trash2 size={13.5} />
              <span>Delete</span>
            </button>
          ) : initialEvent?.id ? (
            <button
              type="button"
              onClick={() => {
                if (onDeleteEvent) {
                  onDeleteEvent(initialEvent.id!);
                } else {
                  deleteScheduleItem(initialEvent.id!);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Trash2 size={13.5} />
              <span>Delete</span>
            </button>
          ) : null}

          {initialTask?.id && !isTimelineBlock && (() => {
            const isArchived = Boolean(initialTask.archived || initialTask.status === 'archived');
            const runArchiveToggle = () => {
              if (onArchiveToggle) {
                onArchiveToggle(initialTask.id!);
              } else {
                const liveTask = tasks.find(t => t.id === initialTask.id);
                if (liveTask) {
                  updateTask({
                    ...liveTask,
                    archived: !isArchived,
                    archivedAt: !isArchived ? new Date().toISOString() : undefined,
                    status: isArchived && liveTask.status === 'archived'
                      ? (liveTask.completed ? 'done' : 'todo')
                      : liveTask.status,
                  });
                  pushNotification(
                    isArchived ? 'Task Restored' : 'Task Archived',
                    isArchived ? `"${liveTask.title}" restored to active tasks.` : `"${liveTask.title}" moved to Archive.`,
                    'task'
                  );
                }
                onClose();
              }
            };
            return (
              <button
                type="button"
                onClick={() => {
                  if (isArchived) {
                    runArchiveToggle();
                  } else {
                    setConfirmArchiveOpen(true);
                  }
                }}
                className={`px-3.5 py-2 rounded-full font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isArchived
                    ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                    : 'text-zinc-700 dark:text-zinc-200 bg-[#eff2f9] dark:bg-zinc-800/90 hover:bg-zinc-200/80 dark:hover:bg-zinc-700'
                }`}
                title={isArchived ? 'Restore Task' : 'Archive Task'}
              >
                {isArchived ? <ArchiveRestore size={13.5} /> : <Archive size={13.5} />}
                <span>{isArchived ? 'Restore' : 'Archive'}</span>
              </button>
            );
          })()}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!title.trim()}
            className={`px-5 py-2 rounded-full font-bold text-xs active:scale-95 disabled:opacity-40 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
              isTimelineBlock
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            <Check size={14} className="stroke-[2.5]" />
            <span>Save</span>
          </button>
        </div>
      </div>

      <ArchiveConfirmModal
        isOpen={confirmArchiveOpen && Boolean(initialTask?.id)}
        itemName={title || initialTask?.title}
        itemType="Task"
        onConfirm={() => {
          setConfirmArchiveOpen(false);
          if (initialTask?.id) {
            if (onArchiveToggle) {
              onArchiveToggle(initialTask.id);
            } else {
              const liveTask = tasks.find(t => t.id === initialTask.id);
              if (liveTask) {
                updateTask({
                  ...liveTask,
                  archived: true,
                  archivedAt: new Date().toISOString(),
                });
                pushNotification(
                  'Task Archived',
                  `"${liveTask.title}" moved to Archive.`,
                  'task'
                );
              }
              onClose();
            }
          }
        }}
        onCancel={() => setConfirmArchiveOpen(false)}
      />

      {/* =========================================================================
          UNIFIED CONTEXTUAL SUB-MODALS (For Multi-Date Calendar & Queue Inspection)
         ========================================================================= */}

      {/* 1. EISENHOWER MATRIX */}
      <UnifiedSubModal
        isOpen={activeModal === 'eisenhower'}
        onClose={() => setActiveModal('none')}
        title="Eisenhower Priority Matrix"
        icon={<LayoutGrid size={14} className="text-orange-500" />}
        iconShape="cookie9"
      >
        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {EISENHOWER_QUADRANTS.map(q => {
            const isSelected = quadrant === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => handleSelectQuadrant(q.id)}
                className={`p-3 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'rounded-[22px] bg-orange-50 dark:bg-orange-950/50 ring-1 ring-orange-500/45 shadow-xs'
                    : 'rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] hover:bg-zinc-200/70'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">{q.icon}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    {q.action}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                    {q.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </UnifiedSubModal>

      {/* 2. MATRIX QUADRANT & TASK WEIGHT */}
      <UnifiedSubModal
        isOpen={activeModal === 'weight'}
        onClose={() => setActiveModal('none')}
        title={`Priority Matrix & Rank (${currentQuadrantInfo.action})`}
        icon={<Scale size={14} className="text-purple-500" />}
        iconShape="scallop"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Eisenhower Quadrant
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {EISENHOWER_QUADRANTS.map(q => {
                const isSelected = quadrant === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQuadrant(q.id)}
                    className={`py-2 px-1.5 text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? 'rounded-[18px] bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-300 font-bold ring-1 ring-orange-500/45 shadow-2xs'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="text-sm">{q.icon}</span>
                    <span className="text-[10px] font-bold leading-tight">{q.action}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/70 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                Sequence Rank (1–99)
              </label>
              <select
                value={Math.min(99, Math.max(1, taskWeight))}
                onChange={e => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setTaskWeight(val);
                  setInspectedWeight(val);
                  scrollToWeight(val);
                }}
                className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-900 dark:text-zinc-100 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-purple-500/35 cursor-pointer tabular-nums"
              >
                {Array.from({ length: 99 }, (_, i) => i + 1).map(num => {
                  const isUsed = usedWeightsInQuadrant.has(num);
                  return (
                    <option
                      key={num}
                      value={num}
                      className={isUsed ? 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800' : 'font-bold'}
                    >
                      #{num} {isUsed ? '(Used)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                Used Ranks ({usedRanksDetailsInQuadrant.length})
              </label>
              <select
                value={usedWeightsInQuadrant.has(taskWeight) ? String(taskWeight) : ''}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) {
                    setTaskWeight(val);
                    setInspectedWeight(val);
                    scrollToWeight(val);
                  }
                }}
                className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-900 dark:text-zinc-100 font-semibold text-xs outline-none focus:ring-2 focus:ring-purple-500/35 cursor-pointer"
              >
                <option value="">
                  {usedRanksDetailsInQuadrant.length > 0
                    ? `Select Used (${usedRanksDetailsInQuadrant.length})`
                    : 'No Ranks Used'}
                </option>
                {usedRanksDetailsInQuadrant.map(entry => (
                  <option key={entry.rank} value={entry.rank}>
                    #{entry.rank} — {entry.primaryTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Assigned in {currentQuadrantInfo.action} ({activeQuadrantTasksWithWeight.length})
              </span>
              <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Next Free: #{nextAvailableWeight}
              </span>
            </div>

            {usedWeightsInQuadrant.size > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    setInspectedWeight(null);
                    weightListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    inspectedWeight === null
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400'
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
                        className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer tabular-nums ${
                          isInspected || isSelected
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        #{w}
                      </button>
                    );
                  })}
              </div>
            )}

            <div
              ref={weightListRef}
              className="h-44 overflow-y-auto rounded-[16px] divide-y-[2px] divide-white dark:divide-[#18181e] bg-[#f3f5fa] dark:bg-[#111116] custom-scrollbar"
            >
              {(() => {
                const sortedTasks = [...activeQuadrantTasksWithWeight].sort(
                  (a, b) =>
                    getEffectiveWeight(a, taskGlobalRankMap) -
                    getEffectiveWeight(b, taskGlobalRankMap)
                );

                if (sortedTasks.length === 0) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <p className="text-xs text-zinc-400 text-center">
                        No other tasks in {currentQuadrantInfo.action} have assigned weights.
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
                      className={`flex items-center justify-between px-3 py-2 transition-all cursor-pointer ${
                        isBlinking
                          ? 'bg-purple-100 dark:bg-purple-950/80 ring-2 ring-purple-500'
                          : isInspected || isSelected
                          ? 'bg-purple-100/80 dark:bg-purple-950/60 text-purple-950 dark:text-purple-100 font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/30'
                      }`}
                    >
                      <span className="flex-1 mr-2 truncate text-xs">{t.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 tabular-nums">
                        #{w}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* 3. DATE & REMINDERS (TASK MODE) */}
      <UnifiedSubModal
        isOpen={activeModal === 'dateTimeReminders'}
        onClose={() => setActiveModal('none')}
        title="Date & Reminders"
        icon={<CalendarClock size={14} className="text-amber-500" />}
        iconShape="cookie12"
        doneLabel="Apply"
      >
        <div className="space-y-3">
          {conflictNotice && (
            <div className="px-3.5 py-2 rounded-[16px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
              <Check size={14} strokeWidth={3} />
              <span>{conflictNotice}</span>
            </div>
          )}

          {/* CALENDAR CARD */}
          <div className="rounded-[22px] p-3.5 bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                {monthNames[month]} {year}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-[#f3f5fa] dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-[#f3f5fa] dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-zinc-400 mb-1">
              <span className="text-rose-500 dark:text-rose-400 font-extrabold" title="Sunday">S</span>
              <span title="Monday">M</span>
              <span title="Tuesday">T</span>
              <span title="Wednesday">W</span>
              <span title="Thursday">T</span>
              <span title="Friday">F</span>
              <span title="Saturday">S</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cd, idx) => {
                const isSelected = selectedDates.includes(cd.dateStr);
                const isToday = cd.dateStr === todayDefaultStr;
                const hasReminders = (dateAlertsMap[cd.dateStr] || []).length > 0;
                return (
                  <button
                    key={`${cd.dateStr}-${idx}`}
                    type="button"
                    onClick={() => toggleDateSelection(cd.dateStr)}
                    className={`h-7 w-full text-xs font-semibold flex items-center justify-center relative transition-all cursor-pointer tabular-nums ${
                      isSelected
                        ? 'rounded-full bg-orange-500 text-white font-bold shadow-xs'
                        : cd.isCurrentMonth
                        ? isToday
                          ? 'rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold'
                          : 'rounded-[10px] text-zinc-800 dark:text-zinc-200 hover:bg-[#f3f5fa] dark:hover:bg-zinc-800'
                        : 'rounded-[10px] text-zinc-400 dark:text-zinc-600 opacity-40'
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

            <div className="mt-2.5 flex flex-wrap gap-1">
              {selectedDates.map(d => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-[10px] font-bold"
                >
                  {formatDateDisplay(d)}
                  {selectedDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleDateSelection(d)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* REMINDERS CARD */}
          <div className="rounded-[22px] p-3.5 bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell size={14} className="text-amber-500" />
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Reminders ({activeAlertsList.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddReminder}
                className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition shadow-2xs cursor-pointer"
              >
                + Add Reminder
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#f3f5fa] dark:bg-[#111116] px-3 py-2 rounded-[14px] text-xs">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-orange-500 shrink-0" />
                <span className="font-semibold text-xs text-zinc-700 dark:text-zinc-200">
                  Task Time ({formatDateDisplay(activeReminderDate)})
                </span>
              </div>
              <input
                type="time"
                value={dateTimesMap[activeReminderDate] || '10:30'}
                onChange={e => {
                  const newT = e.target.value;
                  setDateTimesMap(prev => ({ ...prev, [activeReminderDate]: newT }));
                }}
                className="px-2 py-1 text-xs font-mono font-bold rounded-[10px] bg-white dark:bg-[#18181e] text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer tabular-nums"
              />
            </div>

            {selectedDates.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {selectedDates.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActiveReminderDate(d)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      activeReminderDate === d
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-[#f3f5fa] dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {formatDateDisplay(d)}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
              {activeAlertsList.length === 0 ? (
                <div className="text-xs text-zinc-400 py-2 text-center">
                  No reminders set for this date.
                </div>
              ) : (
                activeAlertsList.map(alert => (
                  <div
                    key={alert.id}
                    className="p-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] flex items-center justify-between gap-2 text-xs"
                  >
                    <select
                      value={alert.type}
                      onChange={e =>
                        handleUpdateReminderType(alert.id, e.target.value as TaskAlertType)
                      }
                      className="px-2.5 py-1 rounded-[10px] bg-white dark:bg-[#18181e] text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none shrink-0"
                    >
                      {ALERT_PRESETS.map(p => (
                        <option key={p.type} value={p.type}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    {alert.type !== 'custom' && (
                      <span className="text-[11px] font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-full shrink-0 ml-auto tabular-nums">
                        {getResolvedAlertTimeDisplay(
                          alert.type,
                          dateTimesMap[activeReminderDate] || '10:30'
                        )}
                      </span>
                    )}

                    {alert.type === 'custom' && (
                      <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                        {lockedAlertIds[alert.id] ? (
                          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 rounded-full px-2.5 py-0.5 text-xs">
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold tabular-nums">
                              {format12HourDisplay(alert.time || '10:30')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnlockReminderTime(alert.id)}
                              className="text-zinc-500 hover:text-emerald-700 p-0.5 cursor-pointer"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-white dark:bg-[#18181e] rounded-[10px] p-0.5 shrink-0">
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
                              className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 px-0.5 outline-none cursor-pointer"
                            >
                              {Array.from({ length: 12 }, (_, i) =>
                                String(i + 1).padStart(2, '0')
                              ).map(h => (
                                <option key={h} value={h} className="dark:bg-zinc-800">
                                  {h}
                                </option>
                              ))}
                            </select>
                            <span className="font-bold text-zinc-400 text-xs">:</span>
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
                              className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 px-0.5 outline-none cursor-pointer"
                            >
                              {[
                                '00', '05', '10', '15', '20', '25',
                                '30', '35', '40', '45', '50', '55',
                              ].map(m => (
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
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full cursor-pointer"
                            >
                              {getAmPm(alert.time || '10:30')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLockReminderTime(alert.id)}
                              className="p-1 rounded-full bg-emerald-600 text-white cursor-pointer"
                            >
                              <Check size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(alert.id)}
                      className="text-zinc-400 hover:text-rose-500 p-1 rounded-full cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {activeReminderDate !== 'all' && selectedDates.length > 1 && (
              <button
                type="button"
                onClick={handleCopyRemindersToAllDates}
                className="w-full text-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline pt-1 cursor-pointer"
              >
                Copy these reminders to all {selectedDates.length} dates
              </button>
            )}
          </div>
        </div>
      </UnifiedSubModal>

      {/* 4. SUBTASKS */}
      <UnifiedSubModal
        isOpen={activeModal === 'subtasks'}
        onClose={() => setActiveModal('none')}
        title="Subtasks & Steps"
        icon={<CheckSquare size={14} className="text-emerald-500" />}
        iconShape="clover"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              placeholder="Add subtask step..."
              className="flex-1 px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none"
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
              className="px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
            {subtasks.length === 0 ? (
              <div className="text-xs text-zinc-400 text-center py-4">No subtasks added yet.</div>
            ) : (
              subtasks.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(s.id)}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition ${
                        s.completed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-600'
                      }`}
                    >
                      {s.completed && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span
                      className={`truncate ${
                        s.completed
                          ? 'line-through text-zinc-400'
                          : 'text-zinc-900 dark:text-zinc-100 font-medium'
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(s.id)}
                    className="text-zinc-400 hover:text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </UnifiedSubModal>

      {/* 5. NOTES */}
      <UnifiedSubModal
        isOpen={activeModal === 'notes'}
        onClose={() => setActiveModal('none')}
        title="Note & Agenda"
        icon={<MessageSquare size={14} className="text-sky-500" />}
        iconShape="arch"
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <textarea
            rows={5}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add context, links, or agenda notes..."
            className="w-full p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-sky-500/35 resize-none leading-relaxed"
          />
        </div>
      </UnifiedSubModal>

      {/* 6. GOALS */}
      <UnifiedSubModal
        isOpen={activeModal === 'goals'}
        onClose={() => setActiveModal('none')}
        title="Link to Goal"
        icon={<Target size={14} className="text-indigo-500" />}
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
                ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>None (Standalone)</span>
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
                  ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
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

      {/* 7. TAGS */}
      <UnifiedSubModal
        isOpen={activeModal === 'tags'}
        onClose={() => setActiveModal('none')}
        title="Tags"
        icon={<Tag size={14} className="text-rose-500" />}
        iconShape="cookie12"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="flex items-center gap-2">
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
              className="px-3.5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {dedupeTagsCaseInsensitive([
              'Work',
              'Personal',
              'Health',
              'Finance',
              'Study',
              'Urgent',
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

      {/* 8. TASK TIME BLOCK */}
      <UnifiedSubModal
        isOpen={activeModal === 'eventTimeBlock'}
        onClose={() => setActiveModal('none')}
        title="Task Date & Time Block"
        icon={<CalendarClock size={14} className="text-indigo-500" />}
        iconShape="scallop"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Task Date
              </label>
              <div className="flex items-center gap-1">
                {[
                  { label: 'Today', offset: 0 },
                  { label: 'Tomorrow', offset: 1 },
                  { label: '+7d', offset: 7 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + preset.offset);
                      setEventDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none"
            />
          </div>

          <label className="flex items-center justify-between px-3 py-2.5 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] cursor-pointer">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              All-Day Task
            </span>
            <input
              type="checkbox"
              checked={eventIsAllDay}
              onChange={e => setEventIsAllDay(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
          </label>

          {!eventIsAllDay && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={eventStartTime}
                    onChange={e => setEventStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={eventEndTime}
                    onChange={e => setEventEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-zinc-400 mr-1">
                  Duration:
                </span>
                {[30, 45, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSetEventDuration(mins)}
                    className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#f1f4fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-indigo-600 hover:text-white transition cursor-pointer tabular-nums"
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </UnifiedSubModal>

      {/* 9. TASK CATEGORY */}
      <UnifiedSubModal
        isOpen={activeModal === 'eventCategory'}
        onClose={() => setActiveModal('none')}
        title="Task Category"
        icon={<Tag size={14} className="text-amber-500" />}
        iconShape="cookie9"
      >
        <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {(['work', 'meeting', 'personal', 'health', 'study', 'other'] as ScheduleCategory[]).map(
            cat => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setEventCategory(cat);
                  setActiveModal('none');
                }}
                className={`p-2.5 text-xs font-bold capitalize text-left flex items-center justify-between cursor-pointer transition-all ${
                  eventCategory === cat
                    ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                    : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <span>{cat}</span>
                {eventCategory === cat && <Check size={14} className="text-indigo-500" />}
              </button>
            )
          )}
        </div>
      </UnifiedSubModal>

      {/* 10. REMINDERS & REPEAT */}
      <UnifiedSubModal
        isOpen={activeModal === 'eventReminders'}
        onClose={() => setActiveModal('none')}
        title="Reminders & Repeat"
        icon={<Bell size={14} className="text-purple-500" />}
        iconShape="cookie12"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Reminder Alert Timing
            </label>
            <select
              value={eventReminderTiming}
              onChange={e => setEventReminderTiming(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            >
              <option value="none">No Reminder</option>
              <option value="on_time">At Start Time</option>
              <option value="5_min_before">5 mins before</option>
              <option value="10_min_before">10 mins before</option>
              <option value="15_min_before">15 mins before</option>
              <option value="30_min_before">30 mins before</option>
              <option value="1_hour_before">1 hour before</option>
              <option value="1_day_before">1 day before</option>
            </select>
          </div>

          {eventReminderTiming !== 'none' && (
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
                Alert Delivery Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'notification' as ReminderType, label: 'Chime Banner' },
                  { id: 'alarm' as ReminderType, label: 'Persistent Alarm' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEventReminderType(opt.id)}
                    className={`py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                      eventReminderType === opt.id
                        ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
              Repeat Schedule
            </label>
            <select
              value={eventRepeatType}
              onChange={e => setEventRepeatType(e.target.value)}
              className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Every Weekday (Mon–Fri)</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </UnifiedSubModal>

      {/* 11. LOCATION */}
      <UnifiedSubModal
        isOpen={activeModal === 'eventLocation'}
        onClose={() => setActiveModal('none')}
        title="Location or Meeting Link"
        icon={<MapPin size={14} className="text-emerald-500" />}
        iconShape="arch"
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
            Address, Room, or Video Call Link
          </label>
          <input
            type="text"
            value={eventLocation}
            onChange={e => setEventLocation(e.target.value)}
            placeholder="e.g. Google Meet, Zoom, Room 3B, Clinic..."
            autoFocus
            className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-zinc-100 outline-none"
          />
        </div>
      </UnifiedSubModal>

      {/* 12. LINK TIME BLOCK TO TASK */}
      <UnifiedSubModal
        isOpen={activeModal === 'eventTaskLink'}
        onClose={() => setActiveModal('none')}
        title="Link Time Block to Task"
        icon={<Link2 size={14} className="text-rose-500" />}
        iconShape="clover"
      >
        <div className="space-y-1.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <button
            type="button"
            onClick={() => {
              setEventTaskId('');
              setActiveModal('none');
            }}
            className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-all cursor-pointer flex items-center justify-between ${
              !eventTaskId
                ? 'rounded-full bg-rose-50 dark:bg-rose-950/35 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/40'
                : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span>None (Standalone Task)</span>
            {!eventTaskId && <Check size={14} className="text-rose-500 shrink-0" />}
          </button>

          {(tasks || [])
            .filter(t => !t.completed || t.id === eventTaskId)
            .map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setEventTaskId(t.id);
                  if (!title.trim()) setTitle(t.title);
                  setActiveModal('none');
                }}
                className={`w-full px-3 py-2.5 text-left font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                  eventTaskId === t.id
                    ? 'rounded-full bg-rose-50 dark:bg-rose-950/35 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/40'
                    : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <span className="truncate pr-2">{t.title}</span>
                {eventTaskId === t.id && <Check size={14} className="text-rose-500 shrink-0" />}
              </button>
            ))}
        </div>
      </UnifiedSubModal>
    </div>
  );
};
