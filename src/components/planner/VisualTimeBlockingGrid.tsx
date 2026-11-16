import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Plus,
  Check,
  Play,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  Zap,
  MapPin,
  X,
  AlarmClock,
  Sun,
  Moon,
  Coffee,
  Utensils,
  Bike,
  Dumbbell,
  Activity,
  Droplets,
  Phone,
  Users,
  BookOpen,
  Laptop,
  CheckCircle2,
  Briefcase,
  Heart,
  ShoppingBag,
  Home,
  ArrowLeft,
  Flame,
  CheckSquare,
  Palette,
  Search,
  SlidersHorizontal,
  Repeat,
  FileText,
  Info,
} from 'lucide-react';
import { ScheduleItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatLocalDate } from '../../utils/date';
import {
  findStructuredIconByKey,
  getProgressShadeForColor,
} from '../../constants/structuredCatalog';
import { StructuredIconColorPicker } from '../common/StructuredIconColorPicker';
import { ScrollableCompactDateStrip } from '../common/ScrollableCompactDateStrip';

export interface VisualTimeBlockingGridProps {
  selectedDate: string;
  items: ScheduleItem[];
  timelineItems?: any[];
  onAddAtTime: (startTime: string, endTime?: string, isAllDay?: boolean) => void;
  onEditItem: (item: ScheduleItem) => void;
  onEditTask?: (task: any) => void;
  onEditHabit?: (habit: any) => void;
  handleToggleWithCelebration?: (id: string, type: 'task' | 'schedule' | 'habit') => void;
  dateStripStorageKey?: string;
  filterHabits?: boolean;
  onToggleFilterHabits?: () => void;
}

const parseTimeToMinutes = (timeStr?: string): number | null => {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return null;
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatHourParts = (hour: number, useAMPM: boolean = true): { num: string; period: string } => {
  if (!useAMPM) {
    return { num: `${String(hour).padStart(2, '0')}:00`, period: '' };
  }
  if (hour === 0 || hour === 24) return { num: '12', period: 'AM' };
  if (hour < 12) return { num: String(hour), period: 'AM' };
  if (hour === 12) return { num: '12', period: 'PM' };
  return { num: String(hour - 12), period: 'PM' };
};

const formatHourLabel = (hour: number, useAMPM: boolean = true): string => {
  const { num, period } = formatHourParts(hour, useAMPM);
  return useAMPM ? `${num} ${period}` : num;
};

const formatTimeDisplay = (timeStr?: string, useAMPM: boolean = true): string => {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const normH = ((h % 24) + 24) % 24;
  if (!useAMPM) {
    return `${String(normH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = normH >= 12 ? 'PM' : 'AM';
  const h12 = normH % 12 === 0 ? 12 : normH % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDurationText = (minutes: number): string => {
  if (minutes <= 0) return '15 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

interface StructuredVisualMeta {
  color: string;
  progressColor: string;
  softBg: string;
  softBorder: string;
  IconComponent: React.FC<{ className?: string }>;
  iconKey?: string;
}

const resolveBaseStructuredMeta = (
  title: string = '',
  category: string = '',
  sourceType: string = 'event',
  indexHint: number = 0
): StructuredVisualMeta => {
  const t = `${title} ${category}`.toLowerCase();

  if (/rise|wake|alarm|morning|shine|sun/.test(t)) {
    return {
      color: '#f39b93',
      progressColor: '#de7c73',
      softBg: 'bg-[#f39b93]/15 dark:bg-[#f39b93]/20',
      softBorder: 'border-[#f39b93]/40',
      IconComponent: AlarmClock,
      iconKey: 'AlarmClock',
    };
  }
  if (/yoga|stretch|meditat|pilates|mindful|breath/.test(t)) {
    return {
      color: '#55789b',
      progressColor: '#3f5f80',
      softBg: 'bg-[#55789b]/15 dark:bg-[#55789b]/20',
      softBorder: 'border-[#55789b]/40',
      IconComponent: Activity,
      iconKey: 'Activity',
    };
  }
  if (/workout|gym|run|exercise|fitness|sport|train|lift/.test(t)) {
    return {
      color: '#55789b',
      progressColor: '#3f5f80',
      softBg: 'bg-[#55789b]/15 dark:bg-[#55789b]/20',
      softBorder: 'border-[#55789b]/40',
      IconComponent: Dumbbell,
      iconKey: 'Dumbbell',
    };
  }
  if (/shower|bath|wash|hygiene|skin|brush|water|hydrat/.test(t)) {
    return {
      color: '#254b6e',
      progressColor: '#193652',
      softBg: 'bg-[#254b6e]/15 dark:bg-[#254b6e]/25',
      softBorder: 'border-[#254b6e]/40',
      IconComponent: Droplets,
      iconKey: 'ShowerHead',
    };
  }
  if (/coffee|tea|latte|espresso|cafe|break/.test(t)) {
    return {
      color: '#8b4058',
      progressColor: '#6d2e42',
      softBg: 'bg-[#8b4058]/15 dark:bg-[#8b4058]/25',
      softBorder: 'border-[#8b4058]/40',
      IconComponent: Coffee,
      iconKey: 'Coffee',
    };
  }
  if (/breakfast|lunch|dinner|meal|eat|cook|food|snack|restaurant/.test(t)) {
    return {
      color: '#f5976c',
      progressColor: '#df7a4d',
      softBg: 'bg-[#f5976c]/15 dark:bg-[#f5976c]/25',
      softBorder: 'border-[#f5976c]/40',
      IconComponent: Utensils,
      iconKey: 'Utensils',
    };
  }
  if (/bike|cycle|commute|office|drive|walk|transit|train|bus/.test(t)) {
    return {
      color: '#8ab867',
      progressColor: '#6f9c4d',
      softBg: 'bg-[#8ab867]/15 dark:bg-[#8ab867]/20',
      softBorder: 'border-[#8ab867]/40',
      IconComponent: Bike,
      iconKey: 'Bike',
    };
  }
  if (/call|phone|mum|mom|dad|family|friend|talk|voice/.test(t)) {
    return {
      color: '#8ab867',
      progressColor: '#6f9c4d',
      softBg: 'bg-[#8ab867]/15 dark:bg-[#8ab867]/20',
      softBorder: 'border-[#8ab867]/40',
      IconComponent: Phone,
      iconKey: 'Phone',
    };
  }
  if (/vacation|holiday|trip|flight|hotel|beach|relax|weekend/.test(t)) {
    return {
      color: '#e5a000',
      progressColor: '#c28600',
      softBg: 'bg-[#e5a000]/15 dark:bg-[#e5a000]/20',
      softBorder: 'border-[#e5a000]/40',
      IconComponent: Sun,
      iconKey: 'TreePalm',
    };
  }
  if (/structure|plan|tomorrow|review|organize|journal|reflect|goal/.test(t)) {
    return {
      color: '#f39b93',
      progressColor: '#de7c73',
      softBg: 'bg-[#f39b93]/15 dark:bg-[#f39b93]/20',
      softBorder: 'border-[#f39b93]/40',
      IconComponent: CheckCircle2,
      iconKey: 'CheckCircle2',
    };
  }
  if (/meet|sync|standup|team|client|zoom|interview|1:1/.test(t)) {
    return {
      color: '#55789b',
      progressColor: '#3f5f80',
      softBg: 'bg-[#55789b]/15 dark:bg-[#55789b]/20',
      softBorder: 'border-[#55789b]/40',
      IconComponent: Users,
      iconKey: 'Users',
    };
  }
  if (/read|book|study|learn|course|class|notes|research/.test(t)) {
    return {
      color: '#e5a000',
      progressColor: '#c28600',
      softBg: 'bg-[#e5a000]/15 dark:bg-[#e5a000]/20',
      softBorder: 'border-[#e5a000]/40',
      IconComponent: BookOpen,
      iconKey: 'BookOpen',
    };
  }
  if (/shop|buy|grocer|store|market|errand|order/.test(t)) {
    return {
      color: '#177e65',
      progressColor: '#0f614d',
      softBg: 'bg-[#177e65]/15 dark:bg-[#177e65]/20',
      softBorder: 'border-[#177e65]/40',
      IconComponent: ShoppingBag,
      iconKey: 'ShoppingBag',
    };
  }
  if (/home|clean|laundry|chore|room|house/.test(t)) {
    return {
      color: '#177e65',
      progressColor: '#0f614d',
      softBg: 'bg-[#177e65]/15 dark:bg-[#177e65]/20',
      softBorder: 'border-[#177e65]/40',
      IconComponent: Home,
      iconKey: 'Home',
    };
  }
  if (/sleep|night|evening|wind down|bedtime|bed/.test(t)) {
    return {
      color: '#55789b',
      progressColor: '#3f5f80',
      softBg: 'bg-[#55789b]/15 dark:bg-[#55789b]/20',
      softBorder: 'border-[#55789b]/40',
      IconComponent: Moon,
      iconKey: 'Moon',
    };
  }
  if (sourceType === 'habit') {
    return {
      color: '#8ab867',
      progressColor: '#6f9c4d',
      softBg: 'bg-[#8ab867]/15 dark:bg-[#8ab867]/20',
      softBorder: 'border-[#8ab867]/40',
      IconComponent: Flame,
      iconKey: 'Flame',
    };
  }

  const paletteRotation: StructuredVisualMeta[] = [
    {
      color: '#55789b',
      progressColor: '#3f5f80',
      softBg: 'bg-[#55789b]/15 dark:bg-[#55789b]/20',
      softBorder: 'border-[#55789b]/40',
      IconComponent: Laptop,
      iconKey: 'Laptop',
    },
    {
      color: '#f39b93',
      progressColor: '#de7c73',
      softBg: 'bg-[#f39b93]/15 dark:bg-[#f39b93]/20',
      softBorder: 'border-[#f39b93]/40',
      IconComponent: Briefcase,
      iconKey: 'Briefcase',
    },
    {
      color: '#8ab867',
      progressColor: '#6f9c4d',
      softBg: 'bg-[#8ab867]/15 dark:bg-[#8ab867]/20',
      softBorder: 'border-[#8ab867]/40',
      IconComponent: CheckSquare,
      iconKey: 'CheckSquare',
    },
    {
      color: '#8b4058',
      progressColor: '#6d2e42',
      softBg: 'bg-[#8b4058]/15 dark:bg-[#8b4058]/20',
      softBorder: 'border-[#8b4058]/40',
      IconComponent: Zap,
      iconKey: 'Zap',
    },
    {
      color: '#254b6e',
      progressColor: '#193652',
      softBg: 'bg-[#254b6e]/15 dark:bg-[#254b6e]/20',
      softBorder: 'border-[#254b6e]/40',
      IconComponent: Heart,
      iconKey: 'Heart',
    },
  ];

  return paletteRotation[Math.abs(indexHint) % paletteRotation.length];
};

type TimelineColorMode = '2channel' | 'classic';
type TimelineItemKind = 'task' | 'habit' | 'event';

interface EisenhowerTickMeta {
  code: 'Do' | 'Plan' | 'Pass' | 'Skip' | 'P1' | 'P2' | 'P3' | 'P4';
  label: string;
  shortLabel: string;
  hex: string;
  fillTint: string;
  textClass: string;
}

const resolveEisenhowerTickMeta = (
  quadrant?: string,
  priority?: string
): EisenhowerTickMeta => {
  const q = (quadrant || '').toString().toLowerCase().trim();
  const p = (priority || 'medium').toString().toLowerCase().trim();

  if (q === 'urgent_important' || q === 'urgent-important') {
    return {
      code: 'Do',
      label: 'Do',
      shortLabel: 'Do',
      hex: '#f43f5e',
      fillTint: 'rgba(244, 63, 94, 0.09)',
      textClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    };
  }
  if (q === 'not_urgent_important' || q === 'not-urgent-important') {
    return {
      code: 'Plan',
      label: 'Plan',
      shortLabel: 'Plan',
      hex: '#f59e0b',
      fillTint: 'rgba(245, 158, 11, 0.09)',
      textClass: 'text-amber-600 dark:text-amber-400 font-semibold',
    };
  }
  if (q === 'urgent_not_important' || q === 'urgent-not-important') {
    return {
      code: 'Pass',
      label: 'Pass',
      shortLabel: 'Pass',
      hex: '#3b82f6',
      fillTint: 'rgba(59, 130, 246, 0.09)',
      textClass: 'text-blue-600 dark:text-blue-400 font-semibold',
    };
  }
  if (q === 'not_urgent_not_important' || q === 'not-urgent-not-important' || q === 'neither') {
    return {
      code: 'Skip',
      label: 'Skip',
      shortLabel: 'Skip',
      hex: '#8b5cf6',
      fillTint: 'rgba(139, 92, 246, 0.09)',
      textClass: 'text-violet-600 dark:text-violet-400 font-semibold',
    };
  }

  if (p === 'high' || p === 'p1') {
    return {
      code: 'Do',
      label: 'Do',
      shortLabel: 'Do',
      hex: '#f43f5e',
      fillTint: 'rgba(244, 63, 94, 0.09)',
      textClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    };
  }
  if (p === 'medium' || p === 'p2') {
    return {
      code: 'Plan',
      label: 'Plan',
      shortLabel: 'Plan',
      hex: '#f59e0b',
      fillTint: 'rgba(245, 158, 11, 0.09)',
      textClass: 'text-amber-600 dark:text-amber-400 font-semibold',
    };
  }
  if (p === 'p3') {
    return {
      code: 'Pass',
      label: 'Pass',
      shortLabel: 'Pass',
      hex: '#3b82f6',
      fillTint: 'rgba(59, 130, 246, 0.09)',
      textClass: 'text-blue-600 dark:text-blue-400 font-semibold',
    };
  }
  return {
    code: 'Skip',
    label: 'Skip',
    shortLabel: 'Skip',
    hex: '#8b5cf6',
    fillTint: 'rgba(139, 92, 246, 0.09)',
    textClass: 'text-violet-600 dark:text-violet-400 font-semibold',
  };
};

const resolvePriorityTickMeta = (priority?: string): EisenhowerTickMeta | null => {
  if (!priority) return null;
  const p = priority.toString().toLowerCase().trim();
  if (p === 'p1' || p === 'high') {
    return {
      code: 'P1',
      label: 'P1',
      shortLabel: 'P1',
      hex: '#f43f5e',
      fillTint: 'rgba(244, 63, 94, 0.09)',
      textClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    };
  }
  if (p === 'p2' || p === 'medium') {
    return {
      code: 'P2',
      label: 'P2',
      shortLabel: 'P2',
      hex: '#f59e0b',
      fillTint: 'rgba(245, 158, 11, 0.09)',
      textClass: 'text-amber-600 dark:text-amber-400 font-semibold',
    };
  }
  if (p === 'p3') {
    return {
      code: 'P3',
      label: 'P3',
      shortLabel: 'P3',
      hex: '#3b82f6',
      fillTint: 'rgba(59, 130, 246, 0.09)',
      textClass: 'text-blue-600 dark:text-blue-400 font-semibold',
    };
  }
  if (p === 'p4' || p === 'low') {
    return {
      code: 'P4',
      label: 'P4',
      shortLabel: 'P4',
      hex: '#8b5cf6',
      fillTint: 'rgba(139, 92, 246, 0.09)',
      textClass: 'text-violet-600 dark:text-violet-400 font-semibold',
    };
  }
  return null;
};

const TYPE_FAMILY_SHADES: Record<
  TimelineItemKind,
  { color: string; progressColor: string }[]
> = {
  task: [
    { color: '#4f46e5', progressColor: '#3730a3' },
    { color: '#55789b', progressColor: '#3f5f80' },
    { color: '#6366f1', progressColor: '#4338ca' },
    { color: '#254b6e', progressColor: '#193652' },
  ],
  habit: [
    { color: '#10b981', progressColor: '#059669' },
    { color: '#177e65', progressColor: '#0f614d' },
    { color: '#8ab867', progressColor: '#6f9c4d' },
    { color: '#0d9488', progressColor: '#0f766e' },
  ],
  event: [
    { color: '#e88d84', progressColor: '#d0675d' },
    { color: '#f39b93', progressColor: '#de7c73' },
    { color: '#f5976c', progressColor: '#df7a4d' },
    { color: '#8b4058', progressColor: '#6d2e42' },
  ],
};

const getStructuredVisualMeta = (
  title: string = '',
  category: string = '',
  sourceType: string = 'event',
  indexHint: number = 0,
  customIcon?: string,
  customColor?: string,
  colorMode: TimelineColorMode = '2channel',
  itemKind: TimelineItemKind = 'event'
): StructuredVisualMeta => {
  const base = resolveBaseStructuredMeta(title, category, sourceType, indexHint);
  const typeShades = TYPE_FAMILY_SHADES[itemKind];
  const typeShade = typeShades[Math.abs(indexHint) % typeShades.length];

  const hasCustomColor = Boolean(customColor && customColor.startsWith('#'));
  const finalColor = hasCustomColor
    ? customColor!
    : colorMode === '2channel'
    ? typeShade.color
    : base.color;
  const finalProgress = hasCustomColor
    ? getProgressShadeForColor(customColor!)
    : colorMode === '2channel'
    ? typeShade.progressColor
    : base.progressColor;

  let FinalIconComponent = base.IconComponent;
  let finalIconKey = base.iconKey || 'Sparkles';

  if (customIcon && customIcon.trim()) {
    const trimmed = customIcon.trim();
    const structuredEntry = findStructuredIconByKey(trimmed);
    if (structuredEntry) {
      FinalIconComponent = structuredEntry.Icon;
      finalIconKey = structuredEntry.key;
    } else if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      finalIconKey = trimmed;
      FinalIconComponent = ({ className }) => (
        <span className={`inline-flex items-center justify-center leading-none select-none ${className || ''}`}>
          {trimmed}
        </span>
      );
    }
  }

  return {
    ...base,
    color: finalColor,
    progressColor: finalProgress,
    IconComponent: FinalIconComponent,
    iconKey: finalIconKey,
  };
};

/** Computes clock hour milestones (e.g., 7 AM, 9 AM, 10 AM) inside a free gap for direct one-tap scheduling */
const getIntermediateHourMarks = (startMin: number, endMin: number): number[] => {
  const marks: number[] = [];
  const firstWholeHour = Math.ceil((startMin + 20) / 60);
  const lastWholeHour = Math.floor((endMin - 20) / 60);
  for (let h = firstWholeHour; h <= lastWholeHour; h++) {
    if (h >= 0 && h <= 23) {
      marks.push(h);
    }
  }
  if (marks.length <= 4) return marks;
  // For very long open stretches, pick up to 4 evenly distributed hours to keep the timeline scannable
  const step = (marks.length - 1) / 3;
  const sampled: number[] = [];
  for (let i = 0; i < 4; i++) {
    const val = marks[Math.round(i * step)];
    if (!sampled.includes(val)) sampled.push(val);
  }
  return sampled;
};

export const VisualTimeBlockingGrid: React.FC<VisualTimeBlockingGridProps> = ({
  selectedDate,
  items,
  timelineItems,
  onAddAtTime,
  onEditItem,
  onEditTask,
  onEditHabit,
  handleToggleWithCelebration,
  dateStripStorageKey = 'tasks_timeline_grid',
  filterHabits = true,
  onToggleFilterHabits,
}) => {
  const {
    tasks,
    updateTask,
    deleteTask,
    toggleSubtask,
    updateScheduleItem,
    addScheduleItem,
    deleteScheduleItem,
    updateHabit,
    pushNotification,
    soundEngine,
    startPomodoro,
    setPomodoroTask,
    setSelectedDate,
    autoScheduleTasksForDate,
  } = useApp();

  const [useAMPM, setUseAMPM] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omni_timeline_use_ampm');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('omni_timeline_use_ampm', String(useAMPM));
    } catch {}
  }, [useAMPM]);

  const [colorMode, setColorMode] = useState<TimelineColorMode>(() => {
    try {
      const saved = localStorage.getItem('omni_timeline_color_mode');
      return saved === 'classic' ? 'classic' : '2channel';
    } catch {
      return '2channel';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('omni_timeline_color_mode', colorMode);
    } catch {}
  }, [colorMode]);

  const [showFreeGaps, setShowFreeGaps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Active item inspector (on-demand sidecar on Desktop lg+, bottom sheet on Mobile & Tablet)
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);

  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  const [customizingItemId, setCustomizingItemId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Reset inspector if switching dates so we don't keep stale selection
  useEffect(() => {
    setInspectedItemId(null);
  }, [selectedDate]);

  const todayStr = formatLocalDate(nowTick);
  const isToday = selectedDate === todayStr;
  const currentTotalMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();

  // Unified items list for selectedDate (with optional search filter)
  const rawList = useMemo(() => {
    const baseList =
      timelineItems && timelineItems.length > 0
        ? timelineItems
        : items.map(s => ({
            id: `event-${s.id}`,
            sourceType: 'event',
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime,
            completed: s.completed,
            category: s.category || 'General',
            priority: s.priority,
            notes: s.notes,
            icon: s.icon,
            color: s.color,
            rawSchedule: s,
          }));

    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(item => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const notesMatch = (item.notes || '').toLowerCase().includes(q);
      const catMatch = (item.category || '').toLowerCase().includes(q);
      const locMatch = (item.rawSchedule?.location || '').toLowerCase().includes(q);
      return titleMatch || notesMatch || catMatch || locMatch;
    });
  }, [timelineItems, items, searchQuery]);

  // Scheduled Timed Blocks
  const { scheduledBlocks, allEnrichedById } = useMemo(() => {
    const timed: any[] = [];
    const byId = new Map<string, any>();

    rawList.forEach((item, idx) => {
      const isAllDaySchedule = item.rawSchedule?.isAllDay;
      const sMin = isAllDaySchedule ? null : parseTimeToMinutes(item.startTime);
      if (sMin === null) return;

      const customIcon =
        item.icon || item.rawSchedule?.icon || item.rawTask?.icon || item.rawHabit?.icon;
      const customColor =
        item.color || item.rawSchedule?.color || item.rawTask?.color || item.rawHabit?.color;

      const linkedTask =
        item.sourceType === 'task'
          ? item.rawTask
          : item.rawSchedule?.taskId
          ? tasks.find(t => t.id === item.rawSchedule.taskId)
          : undefined;

      const itemKind: TimelineItemKind =
        item.sourceType === 'habit'
          ? 'habit'
          : item.sourceType === 'task' || Boolean(linkedTask)
          ? 'task'
          : 'event';

      const eisenhowerMeta =
        itemKind === 'task'
          ? resolveEisenhowerTickMeta(
              linkedTask?.quadrant || item.quadrant,
              linkedTask?.priority || item.priority || item.rawSchedule?.priority
            )
          : itemKind === 'event'
          ? resolvePriorityTickMeta(item.priority || item.rawSchedule?.priority)
          : null;

      const visualMeta = getStructuredVisualMeta(
        item.title,
        item.category,
        item.sourceType,
        idx,
        customIcon,
        customColor,
        colorMode,
        itemKind
      );

      const tickColor =
        colorMode === 'classic'
          ? visualMeta.color
          : itemKind === 'habit'
          ? '#10b981'
          : eisenhowerMeta
          ? eisenhowerMeta.hex
          : '#e88d84';
      const tickTint =
        colorMode === 'classic'
          ? 'transparent'
          : itemKind === 'habit'
          ? 'rgba(16, 185, 129, 0.09)'
          : eisenhowerMeta
          ? eisenhowerMeta.fillTint
          : 'rgba(232, 141, 132, 0.09)';
      const tickShapeClass =
        colorMode === '2channel' && itemKind === 'habit' ? 'rounded-[7px]' : 'rounded-full';
      const tickCompactShapeClass =
        colorMode === '2channel' && itemKind === 'habit' ? 'rounded-[6px]' : 'rounded-full';

      const parsedExplicitEnd = parseTimeToMinutes(item.endTime);
      const explicitHabitDur =
        item.sourceType === 'habit' &&
        (item.rawHabit?.durationMinutes || item.rawHabit?.timerMinutes) &&
        (item.rawHabit?.durationMinutes || item.rawHabit?.timerMinutes) > 0
          ? (item.rawHabit?.durationMinutes || item.rawHabit?.timerMinutes)
          : null;

      const hasExplicitTimeRange = Boolean(
        (itemKind !== 'task' && parsedExplicitEnd !== null && parsedExplicitEnd > sMin) ||
          explicitHabitDur
      );

      let eMin = parsedExplicitEnd;
      if (eMin === null || eMin <= sMin) {
        if (explicitHabitDur) {
          eMin = sMin + explicitHabitDur;
        } else {
          // Point-in-time due task or reminder: keep compact 15m internal spacing without displaying a fake end time
          eMin = sMin + 15;
        }
      }

      const duration = Math.max(15, eMin - sMin);
      const enrichedTimed = {
        ...item,
        startTime: formatMinutesToTime(sMin),
        endTime: formatMinutesToTime(eMin),
        hasExplicitTimeRange,
        startMin: sMin,
        endMin: eMin,
        duration,
        isMultiHour: hasExplicitTimeRange && duration >= 90,
        itemKind,
        eisenhowerMeta,
        tickColor,
        tickTint,
        tickShapeClass,
        tickCompactShapeClass,
        visualMeta,
      };
      timed.push(enrichedTimed);
      byId.set(enrichedTimed.id, enrichedTimed);
    });

    return {
      scheduledBlocks: timed.sort((a, b) => a.startMin - b.startMin),
      allEnrichedById: byId,
    };
  }, [rawList, tasks, colorMode]);

  const inspectedItem = inspectedItemId ? allEnrichedById.get(inspectedItemId) || null : null;
  const customizingItem = customizingItemId ? allEnrichedById.get(customizingItemId) || null : null;

  // Group scheduled blocks into spatial clusters (sequential blocks stay individual; overlapping blocks group together)
  const { timelineClusters, overlapsMap, hasOverlaps } = useMemo(() => {
    if (scheduledBlocks.length === 0) {
      return {
        timelineClusters: [] as {
          id: string;
          startMin: number;
          endMin: number;
          blocks: any[];
          isOverlapCluster: boolean;
        }[],
        overlapsMap: {} as Record<string, { conflictingWith: any; reason: string }>,
        hasOverlaps: false,
      };
    }

    const rawClusters: (typeof scheduledBlocks)[] = [];
    let currentCluster: typeof scheduledBlocks = [];
    let clusterEnd = -1;

    scheduledBlocks.forEach(block => {
      if (currentCluster.length === 0) {
        currentCluster.push(block);
        clusterEnd = block.endMin;
      } else if (block.startMin < clusterEnd) {
        currentCluster.push(block);
        clusterEnd = Math.max(clusterEnd, block.endMin);
      } else {
        rawClusters.push(currentCluster);
        currentCluster = [block];
        clusterEnd = block.endMin;
      }
    });
    if (currentCluster.length > 0) {
      rawClusters.push(currentCluster);
    }

    const overlaps: Record<string, { conflictingWith: any; reason: string }> = {};
    const builtClusters = rawClusters.map(clusterBlocks => {
      const startMin = clusterBlocks[0].startMin;
      const endMin = Math.max(...clusterBlocks.map(b => b.endMin));
      const isOverlapCluster = clusterBlocks.length > 1;

      if (isOverlapCluster) {
        clusterBlocks.forEach(block => {
          const conflictingOther = clusterBlocks.find(
            other => other.id !== block.id && block.startMin < other.endMin && block.endMin > other.startMin
          );
          if (conflictingOther) {
            overlaps[block.id] = {
              conflictingWith: conflictingOther,
              reason: `Overlaps with "${conflictingOther.title}" (${conflictingOther.startTime}–${conflictingOther.endTime})`,
            };
          }
        });
      }

      return {
        id: `cluster-${clusterBlocks[0].id}`,
        startMin,
        endMin,
        blocks: clusterBlocks,
        isOverlapCluster,
      };
    });

    return {
      timelineClusters: builtClusters,
      overlapsMap: overlaps,
      hasOverlaps: Object.keys(overlaps).length > 0,
    };
  }, [scheduledBlocks]);

  // Free Time Intervals
  const freeIntervals = useMemo(() => {
    if (scheduledBlocks.length === 0) {
      return [
        {
          id: 'free-all-day',
          startMin: 8 * 60 + 30,
          endMin: 18 * 60,
          duration: 9 * 60 + 30,
          startStr: '08:30',
          endStr: '18:00',
          durationLabel: '9h 30m',
        },
      ];
    }

    const mergedOccupied: { start: number; end: number }[] = [];
    scheduledBlocks.forEach(b => {
      if (mergedOccupied.length === 0) {
        mergedOccupied.push({ start: b.startMin, end: b.endMin });
      } else {
        const last = mergedOccupied[mergedOccupied.length - 1];
        if (b.startMin <= last.end) {
          last.end = Math.max(last.end, b.endMin);
        } else {
          mergedOccupied.push({ start: b.startMin, end: b.endMin });
        }
      }
    });

    const slots: any[] = [];
    for (let i = 0; i < mergedOccupied.length - 1; i++) {
      const gapStart = mergedOccupied[i].end;
      const gapEnd = mergedOccupied[i + 1].start;
      const dur = gapEnd - gapStart;
      if (dur >= 15) {
        slots.push({
          id: `free-between-${gapStart}-${gapEnd}`,
          startMin: gapStart,
          endMin: gapEnd,
          duration: dur,
          startStr: formatMinutesToTime(gapStart),
          endStr: formatMinutesToTime(gapEnd),
          durationLabel: formatDurationText(dur),
        });
      }
    }

    const lastOccEnd = mergedOccupied[mergedOccupied.length - 1].end;
    if (lastOccEnd < 21 * 60) {
      const dur = 21 * 60 - lastOccEnd;
      if (dur >= 30) {
        slots.push({
          id: `free-evening-${lastOccEnd}`,
          startMin: lastOccEnd,
          endMin: 21 * 60,
          duration: dur,
          startStr: formatMinutesToTime(lastOccEnd),
          endStr: '21:00',
          durationLabel: formatDurationText(dur),
        });
      }
    }

    return slots;
  }, [scheduledBlocks]);

  const handleToggleItem = (item: any) => {
    if (handleToggleWithCelebration) {
      if (item.sourceType === 'task' && item.rawTask) {
        handleToggleWithCelebration(item.rawTask.id, 'task');
      } else if (item.sourceType === 'event' && item.rawSchedule) {
        handleToggleWithCelebration(item.rawSchedule.id, 'schedule');
      } else if (item.sourceType === 'habit') {
        handleToggleWithCelebration(item.id.replace('habit-', ''), 'habit');
      }
    }
  };

  const handleClickEditItem = (item: any) => {
    if (item.sourceType === 'event' && item.rawSchedule) onEditItem(item.rawSchedule);
    else if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
    else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
  };

  const handleDeleteInspectedItem = (item: any) => {
    if (!item) return;
    if (item.sourceType === 'event' && item.rawSchedule) {
      deleteScheduleItem(item.rawSchedule.id);
      setInspectedItemId(null);
    } else if (item.sourceType === 'task' && item.rawTask) {
      deleteTask(item.rawTask.id);
      setInspectedItemId(null);
    }
  };

  const handleAdjustDuration = (item: any, deltaMins: number) => {
    if (!item || typeof item.startMin !== 'number') return;
    const currentDur = item.duration || 30;
    const nextDur = Math.max(15, Math.min(480, currentDur + deltaMins));
    const newEndMin = Math.min(23 * 60 + 55, item.startMin + nextDur);
    const newEndStr = formatMinutesToTime(newEndMin);

    if (item.sourceType === 'event' && item.rawSchedule) {
      updateScheduleItem({
        ...item.rawSchedule,
        endTime: newEndStr,
      });
    } else if (item.sourceType === 'task' && item.rawTask) {
      updateTask({
        ...item.rawTask,
        durationMinutes: nextDur,
      });
    }
  };

  const handleApplyItemVisualCustomization = (
    item: any,
    updates: { color?: string; icon?: string }
  ) => {
    if (!item) return;

    if (item.sourceType === 'event' && item.rawSchedule) {
      updateScheduleItem({
        ...item.rawSchedule,
        ...(updates.color ? { color: updates.color } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
      });
      if (item.rawSchedule.taskId) {
        const linked = tasks.find(t => t.id === item.rawSchedule.taskId);
        if (linked) {
          updateTask({
            ...linked,
            ...(updates.color ? { color: updates.color } : {}),
            ...(updates.icon ? { icon: updates.icon } : {}),
          });
        }
      }
    } else if (item.sourceType === 'task' && item.rawTask) {
      updateTask({
        ...item.rawTask,
        ...(updates.color ? { color: updates.color } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
      });
    } else if (item.sourceType === 'habit' && item.rawHabit) {
      updateHabit({
        ...item.rawHabit,
        ...(updates.color ? { color: updates.color } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
      });
    }
  };

  const applyBlockTimeUpdate = (item: any, newStartStr: string, newEndStr: string) => {
    if (item.sourceType === 'event' && item.rawSchedule) {
      updateScheduleItem({
        ...item.rawSchedule,
        startTime: newStartStr,
        endTime: newEndStr,
      });
    } else if (item.sourceType === 'task' && item.rawTask) {
      updateTask({
        ...item.rawTask,
        dueTime: newStartStr,
      });
    } else if (item.sourceType === 'habit' && item.rawHabit) {
      updateHabit({
        ...item.rawHabit,
        reminderTime: newStartStr,
      });
    }
  };

  const handleAlignItemToFreeSlot = (item: any) => {
    const curDur = item.duration || 30;
    const overlapMeta = overlapsMap[item.id];
    const conflict = overlapMeta?.conflictingWith;
    const targetMinAfter = conflict ? conflict.endMin : item.endMin;

    let chosenSlot = freeIntervals.find(slot => slot.startMin >= targetMinAfter && slot.duration >= curDur);
    if (!chosenSlot) {
      chosenSlot = freeIntervals.find(slot => slot.duration >= curDur);
    }
    const newStartMins = chosenSlot ? chosenSlot.startMin : Math.min(22 * 60, targetMinAfter);
    const newEndMins = Math.min(23 * 60 + 45, newStartMins + curDur);
    const newStartStr = formatMinutesToTime(newStartMins);
    const newEndStr = formatMinutesToTime(newEndMins);

    applyBlockTimeUpdate(item, newStartStr, newEndStr);
    soundEngine?.playSuccessChime?.();
    pushNotification(
      'Aligned in Free Time',
      item.hasExplicitTimeRange
        ? `"${item.title}" moved to ${newStartStr}–${newEndStr}.`
        : `"${item.title}" moved to ${newStartStr}.`,
      'calendar'
    );
  };

  const alignBlocksSequentially = (itemsToReschedule: any[]) => {
    if (itemsToReschedule.length === 0) return;

    const reschedulingIds = new Set(itemsToReschedule.map(b => b.id));
    const occupied: { start: number; end: number }[] = scheduledBlocks
      .filter(b => !reschedulingIds.has(b.id))
      .map(b => ({ start: b.startMin, end: b.endMin }))
      .sort((a, b) => a.start - b.start);

    itemsToReschedule.forEach(item => {
      const curDur = item.duration || 30;
      let candidateStart = Math.max(6 * 60, item.startMin);

      // Walk forward past any colliding occupied block until a clean non-overlapping slot is found
      let placed = false;
      while (!placed && candidateStart + curDur <= 23 * 60 + 45) {
        const collision = occupied.find(
          occ => candidateStart < occ.end && candidateStart + curDur > occ.start
        );
        if (!collision) {
          placed = true;
        } else {
          candidateStart = collision.end;
        }
      }

      const newStartStr = formatMinutesToTime(candidateStart);
      const newEndStr = formatMinutesToTime(Math.min(23 * 60 + 45, candidateStart + curDur));
      occupied.push({ start: candidateStart, end: candidateStart + curDur });
      occupied.sort((a, b) => a.start - b.start);
      applyBlockTimeUpdate(item, newStartStr, newEndStr);
    });

    soundEngine?.playSuccessChime?.();
    pushNotification(
      'Schedule Aligned',
      `Moved ${itemsToReschedule.length} overlapping block${itemsToReschedule.length > 1 ? 's' : ''} into open time.`,
      'calendar'
    );
  };

  const handleAlignClusterOverlaps = (clusterBlocks: any[]) => {
    if (clusterBlocks.length <= 1) return;
    // Keep the first block anchored at its original time; move conflicting siblings sequentially
    alignBlocksSequentially(clusterBlocks.slice(1));
  };

  const handleAlignAllOverlaps = () => {
    const toMove: any[] = [];
    timelineClusters.forEach(cluster => {
      if (cluster.isOverlapCluster) {
        toMove.push(...cluster.blocks.slice(1));
      }
    });
    alignBlocksSequentially(toMove);
  };

  const getNextAvailableStartMin = (preferredDefault?: string): number => {
    if (scheduledBlocks.length === 0) {
      return parseTimeToMinutes(preferredDefault || '09:00') || 9 * 60;
    }
    const lastBlock = scheduledBlocks[scheduledBlocks.length - 1];
    return Math.min(22 * 60, lastBlock.endMin);
  };

  const handleLoadStructuredSampleDay = () => {
    const sampleBlocks = [
      { title: 'Rise and Shine', startTime: '08:30', endTime: '08:45', category: 'personal' },
      { title: 'Yoga Workout', startTime: '09:00', endTime: '10:00', category: 'health' },
      { title: 'Take a Shower', startTime: '10:00', endTime: '10:15', category: 'personal' },
      { title: 'Have a Coffee', startTime: '10:15', endTime: '10:30', category: 'personal' },
      { title: 'Deep Work Sprint', startTime: '11:00', endTime: '12:30', category: 'focus' },
    ];
    sampleBlocks.forEach(b => {
      addScheduleItem({
        title: b.title,
        date: selectedDate,
        startTime: b.startTime,
        endTime: b.endTime,
        category: b.category as any,
        priority: 'P2',
        completed: false,
      });
    });

    soundEngine?.playSuccessChime?.();
    pushNotification('Day Populated', 'Loaded a clean structured routine for this date.', 'calendar');
  };

  // Summary metrics (only count genuinely time-bounded blocks toward scheduled planned minutes)
  const totalPlannedMinutes = scheduledBlocks.reduce(
    (acc, curr) => acc + (curr.hasExplicitTimeRange ? curr.duration : 0),
    0
  );
  const completedCount = scheduledBlocks.filter(b => b.completed).length;
  const totalItemsCount = scheduledBlocks.length;

  // Reusable Detail Inspector Renderer (Shared between Desktop Right Pane & Mobile/Tablet Sheet)
  const renderInspectorBody = (item: any, onClose: () => void, backLabel?: string) => {
    const { color, IconComponent } = item.visualMeta;
    const isChecked = Boolean(item.completed);
    const isTimed = typeof item.startMin === 'number';
    const itemSubtasks =
      Array.isArray(item.subtasks) && item.subtasks.length > 0
        ? item.subtasks
        : Array.isArray(item.rawTask?.subtasks)
        ? item.rawTask.subtasks
        : [];
    const linkedTaskId =
      item.sourceType === 'task'
        ? item.rawTask?.id
        : item.sourceType === 'event'
        ? item.rawSchedule?.taskId
        : null;
    const isRecurring = Boolean(
      (item.rawSchedule?.repeatType && item.rawSchedule.repeatType !== 'none') ||
        (item.rawTask?.recurring && item.rawTask.recurring !== 'none')
    );
    const overlapMeta = overlapsMap[item.id];
    const sourceLabel =
      item.itemKind === 'habit'
        ? 'Habit'
        : item.itemKind === 'task'
        ? 'Task'
        : 'Time Block';

    return (
      <div className="flex flex-col h-full">
        {/* Clean Top Inspector Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel || 'Back'}</span>
          </button>

          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
            <span>{sourceLabel}</span>
            {item.category && (
              <>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{item.category}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Identity & Title */}
          <div className="flex items-start gap-3.5">
            <button
              type="button"
              onClick={() => setCustomizingItemId(item.id)}
              style={{ backgroundColor: color }}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xs shrink-0 hover:scale-105 transition cursor-pointer relative group"
              title="Change icon & color"
            >
              <IconComponent className="w-5 h-5 stroke-[2.2]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 flex items-center justify-center shadow-2xs">
                <Palette className="w-2.5 h-2.5" />
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <h3
                className={`text-base sm:text-lg font-extrabold tracking-tight leading-snug ${
                  isChecked
                    ? 'line-through text-slate-400 dark:text-zinc-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.title}
              </h3>

              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
                {isTimed ? (
                  item.hasExplicitTimeRange ? (
                    <span>
                      {formatTimeDisplay(item.startTime, useAMPM)} – {formatTimeDisplay(item.endTime, useAMPM)} ({formatDurationText(item.duration)})
                    </span>
                  ) : (
                    <span>Due at {formatTimeDisplay(item.startTime, useAMPM)} · Point reminder</span>
                  )
                ) : (
                  <span>Anytime · All-Day</span>
                )}
                {isRecurring && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      <span>Repeating</span>
                    </span>
                  </>
                )}
                {colorMode === '2channel' && item.eisenhowerMeta ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={item.eisenhowerMeta.textClass}>
                      {item.eisenhowerMeta.code}
                    </span>
                  </>
                ) : (
                  item.priority && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{item.priority}</span>
                    </>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Quick Time & Overlap Controls (Only for timed items) */}
          {isTimed && (item.sourceType === 'event' || (item.sourceType === 'task' && item.hasExplicitTimeRange)) && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 mr-1">
                  Duration:
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(item, -15)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer tabular-nums"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(item, 15)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer tabular-nums"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustDuration(item, 30)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer tabular-nums"
                >
                  +30m
                </button>
              </div>

              {overlapMeta && (
                <button
                  type="button"
                  onClick={() => handleAlignItemToFreeSlot(item)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                >
                  Move to Free Slot
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap bg-slate-50/70 dark:bg-zinc-900/70 rounded-2xl p-3 border border-slate-100 dark:border-zinc-800/80">
                {item.notes}
              </p>
            </div>
          )}

          {/* Subtasks Checklist */}
          {itemSubtasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-zinc-500 tabular-nums">
                <span>Subtasks</span>
                <span>
                  {itemSubtasks.filter((s: any) => s.completed).length} / {itemSubtasks.length}
                </span>
              </div>
              <div className="space-y-1">
                {itemSubtasks.map((sub: any) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      if (item.sourceType === 'task' && item.rawTask) {
                        toggleSubtask(item.rawTask.id, sub.id);
                      } else if (item.sourceType === 'event' && item.rawSchedule?.taskId) {
                        toggleSubtask(item.rawSchedule.taskId, sub.id);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 text-left transition cursor-pointer"
                  >
                    <span
                      style={{
                        borderColor: sub.completed ? color : undefined,
                        backgroundColor: sub.completed ? color : undefined,
                      }}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        sub.completed
                          ? 'text-white'
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}
                    >
                      {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        sub.completed
                          ? 'line-through text-slate-400 dark:text-zinc-500'
                          : 'text-slate-700 dark:text-zinc-200'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!item.notes && itemSubtasks.length === 0 && !item.rawSchedule?.location && (
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              No extra notes or subtasks attached yet. Use &quot;Edit Full Details&quot; to add notes, reminders, or recurrence.
            </p>
          )}
        </div>

        {/* Clean Action Footer */}
        <div className="p-3.5 sm:px-5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap shrink-0 bg-slate-50/50 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleItem(item)}
              style={isChecked ? undefined : { backgroundColor: item.tickColor || color }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                isChecked
                  ? 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200'
                  : 'text-white hover:opacity-95'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.6]" />
              <span>{isChecked ? 'Completed' : 'Mark Done'}</span>
            </button>

            {linkedTaskId && (
              <button
                type="button"
                onClick={() => {
                  setPomodoroTask(linkedTaskId);
                  startPomodoro();
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Start Focus Timer"
              >
                <Play className="w-3.5 h-3.5 text-rose-500 fill-current" />
                <span>Focus</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCustomizingItemId(item.id)}
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition cursor-pointer"
              title="Color & Icon"
            >
              <Palette className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleClickEditItem(item)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {(item.sourceType === 'event' || item.sourceType === 'task') && (
              <button
                type="button"
                onClick={() => handleDeleteInspectedItem(item)}
                className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* COLOR & ICON CUSTOMIZATION MODAL (Portaled to document.body to stay viewport-fixed regardless of scroll or parent transforms) */}
      {customizingItem && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setCustomizingItemId(null)}
          className="fixed inset-0 z-[110] bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-[380px]">
            <StructuredIconColorPicker
              selectedColor={customizingItem.visualMeta?.color || '#55789b'}
              selectedIcon={customizingItem.visualMeta?.iconKey || 'Moon'}
              onSelectColor={color => handleApplyItemVisualCustomization(customizingItem, { color })}
              onSelectIcon={icon => handleApplyItemVisualCustomization(customizingItem, { icon })}
              onClose={() => setCustomizingItemId(null)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* MOBILE & TABLET (< lg) DETAIL INSPECTOR SHEET (Portaled to document.body so it stays viewport-pinned at any scroll offset) */}
      {inspectedItem && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setInspectedItemId(null)}
          className="fixed inset-0 z-[90] lg:hidden bg-slate-950/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full md:max-w-lg max-h-[86vh] rounded-t-[28px] md:rounded-[28px] bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
          >
            {/* Mobile pull handle */}
            <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-zinc-800" />
            </div>
            {renderInspectorBody(inspectedItem, () => setInspectedItemId(null), 'Timeline')}
          </div>
        </div>,
        document.body
      )}

      {/* UNIFIED ONE-FOR-ALL HEADER SHELL (Single Date Strip + Minimal Utility Row) */}
      <div className="rounded-[24px] sm:rounded-[28px] bg-[#fbf4f2]/75 dark:bg-zinc-900/90 border border-[#f2ded9]/80 dark:border-zinc-800/90 px-2.5 pt-2.5 pb-2.5 sm:px-4 sm:pt-3.5 sm:pb-3 space-y-2">
        <ScrollableCompactDateStrip
          selectedDateStr={selectedDate}
          onSelectDate={setSelectedDate}
          storageKey={dateStripStorageKey}
          defaultFinish="dualtone"
          defaultShape="circle"
          defaultTheme="bordeaux"
          variant="embedded"
        />

        {/* Single Slim Utility Strip */}
        <div className="relative flex items-center justify-between gap-2 px-1 pt-2 border-t border-[#eedad5]/65 dark:border-zinc-800/80">
          {isSearchOpen ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Filter timeline items..."
                  className="w-full h-8 pl-8 pr-7 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e88d84]/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-slate-500 dark:text-zinc-400 tabular-nums truncate">
              <span>
                {totalItemsCount === 0
                  ? 'Open day'
                  : `${completedCount}/${totalItemsCount} done`}
              </span>
              {totalPlannedMinutes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatDurationText(totalPlannedMinutes)} planned</span>
                </>
              )}
              {hasOverlaps && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleAlignAllOverlaps}
                    className="text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                  >
                    Fix {Object.keys(overlapsMap).length} overlap
                  </button>
                </>
              )}
            </div>
          )}

          {/* Minimal Right Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOptionsOpen(false);
                setIsLegendOpen(false);
                setIsSearchOpen(prev => !prev);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition cursor-pointer ${
                isSearchOpen || searchQuery
                  ? 'bg-[#e88d84]/15 border-[#e88d84]/50 text-[#d0675d] dark:text-[#f29b94]'
                  : 'bg-white/90 dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-white'
              }`}
              title="Search timeline"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Quick-Reference (i) Legend Button */}
            <button
              type="button"
              onClick={() => {
                setIsOptionsOpen(false);
                setIsLegendOpen(prev => !prev);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition cursor-pointer ${
                isLegendOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                  : 'bg-white/90 dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-white'
              }`}
              title="Color & tick key"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Progressive-Disclosure View Options Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsLegendOpen(false);
                  setIsOptionsOpen(prev => !prev);
                }}
                className={`h-8 w-8 rounded-full flex items-center justify-center border transition cursor-pointer ${
                  isOptionsOpen
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-white/90 dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-white'
                }`}
                title="Timeline preferences"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              {isOptionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOptionsOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-50 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between px-2 py-1 rounded-xl">
                      <span className="font-semibold text-slate-700 dark:text-zinc-200">
                        Color System
                      </span>
                      <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setColorMode('2channel')}
                          className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                            colorMode === '2channel'
                              ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          2-Ch
                        </button>
                        <button
                          type="button"
                          onClick={() => setColorMode('classic')}
                          className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                            colorMode === 'classic'
                              ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          Classic
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 rounded-xl">
                      <span className="font-semibold text-slate-700 dark:text-zinc-200">
                        Clock Format
                      </span>
                      <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setUseAMPM(true)}
                          className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                            useAMPM ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-500'
                          }`}
                        >
                          12h
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseAMPM(false)}
                          className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                            !useAMPM ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white' : 'text-slate-500'
                          }`}
                        >
                          24h
                        </button>
                      </div>
                    </div>

                    {onToggleFilterHabits && (
                      <button
                        type="button"
                        onClick={onToggleFilterHabits}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer"
                      >
                        <span>Include Habits</span>
                        <span
                          className={`text-[10.5px] font-bold ${
                            filterHabits ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {filterHabits ? 'On' : 'Off'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowFreeGaps(prev => !prev)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer"
                    >
                      <span>Free-Time Gaps</span>
                      <span
                        className={`text-[10.5px] font-bold ${
                          showFreeGaps ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {showFreeGaps ? 'On' : 'Off'}
                      </span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsOptionsOpen(false);
                        autoScheduleTasksForDate(selectedDate);
                        soundEngine?.playSuccessChime?.();
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#e88d84]" />
                      <span>Auto-Plan Open Tasks</span>
                    </button>

                    {scheduledBlocks.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOptionsOpen(false);
                          handleLoadStructuredSampleDay();
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Load Sample Routine</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const nextStartMin = getNextAvailableStartMin('09:00');
                const nextStart = formatMinutesToTime(nextStartMin);
                const nextEnd = formatMinutesToTime(Math.min(23 * 60 + 45, nextStartMin + 30));
                onAddAtTime(nextStart, nextEnd);
              }}
              className="h-8 px-2.5 sm:px-3 rounded-full bg-[#e88d84] hover:bg-[#df796f] active:scale-95 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
              title="Add block to timeline"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
              <span>Add</span>
            </button>
          </div>

          {/* Circle (i) Visual Key Reference Popover */}
          {isLegendOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsLegendOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-50 p-3.5 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    Color & Tick Key
                  </span>
                  <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setColorMode('2channel')}
                      className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                        colorMode === '2channel'
                          ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      2-Channel
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode('classic')}
                      className={`px-2 py-0.5 rounded-full font-bold cursor-pointer ${
                        colorMode === 'classic'
                          ? 'bg-white dark:bg-zinc-800 shadow-2xs text-slate-900 dark:text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      Classic
                    </button>
                  </div>
                </div>

                {colorMode === '2channel' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                        Left Icon Color Family = Type
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#4f46e5] shrink-0" />
                          <span>Task</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#10b981] shrink-0" />
                          <span>Habit</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#e88d84] shrink-0" />
                          <span>Event</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                        Right Tick = Eisenhower / P1–P4 Priority
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-medium text-slate-700 dark:text-zinc-200">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-[#f43f5e] bg-[#f43f5e]/10 shrink-0" />
                          <span>Do / P1</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-[#f59e0b] bg-[#f59e0b]/10 shrink-0" />
                          <span>Plan / P2</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-[#3b82f6] bg-[#3b82f6]/10 shrink-0" />
                          <span>Pass / P3</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-[#8b5cf6] bg-[#8b5cf6]/10 shrink-0" />
                          <span>Skip / P4</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-[5px] border-2 border-[#10b981] bg-[#10b981]/10 shrink-0" />
                          <span>Habit Check</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-[#e88d84] bg-[#e88d84]/10 shrink-0" />
                          <span>Timed Event</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-[11.5px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    <p>
                      <strong className="text-slate-900 dark:text-white">Classic mode</strong> uses each item&apos;s category icon color for both its Spine node and circular tick.
                    </p>
                    <button
                      type="button"
                      onClick={() => setColorMode('2channel')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Switch to 2-Channel (Type + Priority) →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* TRUE ONE-FOR-ALL COMBINED SPATIAL-SPINE TIMELINE:
          - Zero duplicate lists or sub-tabs across Mobile, Tablet, and Desktop
          - Single centered/wide canvas by default; Desktop expands into 8/4 split only when Detail Inspector is opened
          - Mobile & Tablet (< lg) use the slide-up Bottom Sheet Detail Inspector above */}
      <div
        className={
          inspectedItem
            ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start'
            : 'w-full max-w-4xl mx-auto'
        }
      >
        <div
          className={`w-full min-w-0 ${
            inspectedItem
              ? 'md:max-w-2xl md:mx-auto lg:max-w-none lg:col-span-7 xl:col-span-8'
              : ''
          }`}
        >
          <div className="bg-white dark:bg-zinc-950 rounded-[24px] sm:rounded-[28px] border border-slate-200/80 dark:border-zinc-800/90 px-2.5 sm:px-5 pt-3 pb-6 space-y-2 shadow-2xs">
            {/* Subtle Sheet Pull Handle on Mobile */}
            <div className="w-9 h-1 rounded-full bg-slate-200/90 dark:bg-zinc-800 mx-auto sm:hidden" />

            {timelineClusters.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3.5">
                <div className="w-12 h-12 rounded-full bg-[#f29b94]/20 text-[#e88d84] mx-auto flex items-center justify-center">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    {searchQuery ? 'No matching timeline blocks' : 'Your day is wide open'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {searchQuery
                      ? `Nothing found for "${searchQuery}" on this date.`
                      : 'Add a time block, tap any hour slot, or load a starter routine.'}
                  </p>
                </div>

                {!searchQuery && (
                  <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => onAddAtTime('09:00', '10:00')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#e88d84] hover:bg-[#df796f] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add Block</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadStructuredSampleDay}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#e88d84]" />
                      <span>Starter Routine</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative pt-1 pb-1 select-none">
                {(() => {
                  const formattedNowTime = formatTimeDisplay(
                    formatMinutesToTime(currentTotalMinutes),
                    useAMPM
                  );
                  const firstCluster = timelineClusters[0];
                  const lastCluster = timelineClusters[timelineClusters.length - 1];

                  const renderNowIndicatorRow = (
                    captionText?: string,
                    hasTopElapsedRail: boolean = true
                  ) => (
                    <div
                      key="live-now-indicator"
                      className="flex items-center py-1 my-0.5 relative z-20"
                      aria-label={`Current time ${formattedNowTime}`}
                    >
                      {/* Left Margin Live Timestamp */}
                      <div className="w-[52px] sm:w-[66px] shrink-0 pr-2 text-right flex flex-col items-end leading-none">
                        <span className="text-[10.5px] sm:text-[11px] font-black text-[#d87268] dark:text-[#f29b94] tabular-nums whitespace-nowrap">
                          {formattedNowTime}
                        </span>
                        <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-[#e88d84] mt-0.5">
                          Now
                        </span>
                      </div>

                      {/* Center Spine Live Beacon */}
                      <div className="w-[36px] sm:w-[44px] shrink-0 relative flex items-center justify-center self-stretch">
                        {hasTopElapsedRail && (
                          <div className="w-[2px] bg-[#e88d84]/65 dark:bg-[#e88d84]/55 absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2" />
                        )}
                        <div className="w-[2px] bg-slate-200 dark:bg-zinc-800 absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2" />
                        <span className="relative z-10 w-3 h-3 rounded-full bg-[#e88d84] ring-4 ring-[#e88d84]/25 flex items-center justify-center shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-[#e88d84] animate-ping opacity-75" />
                        </span>
                      </div>

                      {/* Horizontal Time Horizon Hairline */}
                      <div className="flex-1 min-w-0 pl-2 sm:pl-3 pr-1 flex items-center gap-2">
                        <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-[#e88d84] via-[#e88d84]/40 to-transparent" />
                        {captionText && (
                          <span className="text-[10.5px] font-bold text-[#d87268] dark:text-[#f29b94] tabular-nums whitespace-nowrap shrink-0">
                            {captionText}
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  const showNowBeforeFirst =
                    isToday && firstCluster && currentTotalMinutes < firstCluster.startMin;
                  const showNowAfterLast =
                    isToday && lastCluster && currentTotalMinutes >= lastCluster.endMin;

                  return (
                    <>
                      {showNowBeforeFirst &&
                        renderNowIndicatorRow(
                          `starts in ${formatDurationText(
                            firstCluster.startMin - currentTotalMinutes
                          )}`,
                          false
                        )}

                      {timelineClusters.map((cluster, clusterIdx) => {
                        const prevCluster =
                          clusterIdx > 0 ? timelineClusters[clusterIdx - 1] : null;
                        const nextCluster =
                          clusterIdx < timelineClusters.length - 1
                            ? timelineClusters[clusterIdx + 1]
                            : null;

                        const gapBeforeMins = prevCluster
                          ? cluster.startMin - prevCluster.endMin
                          : 0;
                        const isContiguousWithNext =
                          nextCluster && Math.abs(nextCluster.startMin - cluster.endMin) <= 2;

                        const nowInThisGap =
                          isToday &&
                          prevCluster !== null &&
                          currentTotalMinutes >= prevCluster.endMin &&
                          currentTotalMinutes < cluster.startMin;

                        const intermediateHours =
                          showFreeGaps && gapBeforeMins >= 40 && prevCluster
                            ? getIntermediateHourMarks(prevCluster.endMin, cluster.startMin)
                            : [];

                        const isClusterPast = isToday && cluster.endMin <= currentTotalMinutes;
                        const isClusterActive =
                          isToday &&
                          currentTotalMinutes >= cluster.startMin &&
                          currentTotalMinutes < cluster.endMin;
                        const clusterSpan = Math.max(15, cluster.endMin - cluster.startMin);
                        const clusterActivePct = isClusterActive
                          ? Math.min(
                              100,
                              Math.max(
                                8,
                                Math.round(
                                  ((currentTotalMinutes - cluster.startMin) / clusterSpan) * 100
                                )
                              )
                            )
                          : 0;

                        const renderClusterSpineRail = () => {
                          if (isClusterPast) {
                            return (
                              <div className="w-[2px] bg-[#e88d84]/60 dark:bg-[#e88d84]/50 absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-0" />
                            );
                          }
                          if (isClusterActive) {
                            return (
                              <>
                                <div
                                  style={{ height: `${clusterActivePct}%` }}
                                  className="w-[2px] bg-[#e88d84]/80 dark:bg-[#e88d84]/75 absolute top-0 left-1/2 -translate-x-1/2 z-0 transition-all duration-500"
                                />
                                <div
                                  style={{ top: `${clusterActivePct}%` }}
                                  className="w-[2px] bg-slate-200 dark:bg-zinc-800 absolute bottom-0 left-1/2 -translate-x-1/2 z-0"
                                />
                              </>
                            );
                          }
                          return (
                            <div className="w-[2px] bg-slate-200 dark:bg-zinc-800 absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-0" />
                          );
                        };

                        const renderGapSection = () => {
                          if (gapBeforeMins < 15 && !nowInThisGap) return null;

                          // Short transition (< 15m) that happens to contain the exact current minute
                          if (gapBeforeMins < 15 && nowInThisGap) {
                            return renderNowIndicatorRow(
                              `in ${formatDurationText(
                                Math.max(1, cluster.startMin - currentTotalMinutes)
                              )}`,
                              true
                            );
                          }

                          const minsUntilNext = Math.max(1, cluster.startMin - currentTotalMinutes);
                          let nowRenderedInsideGap = false;

                          return (
                            <div className="my-0.5 space-y-0.5">
                              {/* Clickable Intermediate Clock Hour Slots + Chronological Now Indicator */}
                              {intermediateHours.map(hr => {
                                const hrMin = hr * 60;
                                const hrStr = `${String(hr).padStart(2, '0')}:00`;
                                const hrEndStr = `${String(Math.min(23, hr + 1)).padStart(
                                  2,
                                  '0'
                                )}:00`;
                                const isHourPast = isToday && hrMin <= currentTotalMinutes;

                                const shouldInsertNowBeforeHr =
                                  nowInThisGap &&
                                  !nowRenderedInsideGap &&
                                  currentTotalMinutes < hrMin;
                                if (shouldInsertNowBeforeHr) {
                                  nowRenderedInsideGap = true;
                                }

                                return (
                                  <React.Fragment key={`slot-${cluster.id}-${hr}`}>
                                    {shouldInsertNowBeforeHr &&
                                      renderNowIndicatorRow(
                                        `next in ${formatDurationText(minsUntilNext)}`,
                                        true
                                      )}

                                    <button
                                      type="button"
                                      onClick={() => onAddAtTime(hrStr, hrEndStr)}
                                      className="w-full flex items-center group/hr text-left rounded-xl hover:bg-[#fbf4f2]/70 dark:hover:bg-zinc-900/60 transition py-1 cursor-pointer"
                                    >
                                      <div className="w-[52px] sm:w-[66px] shrink-0 pr-2 text-right">
                                        <span
                                          className={`text-[10.5px] font-semibold tabular-nums whitespace-nowrap transition ${
                                            isHourPast
                                              ? 'text-[#d87268]/75 dark:text-[#f29b94]/70'
                                              : 'text-slate-400 group-hover/hr:text-[#d87268] dark:text-zinc-500 dark:group-hover/hr:text-[#f29b94]'
                                          }`}
                                        >
                                          {formatHourLabel(hr, useAMPM)}
                                        </span>
                                      </div>

                                      <div className="w-[36px] sm:w-[44px] shrink-0 relative flex items-center justify-center self-stretch">
                                        <div
                                          className={`w-[2px] h-full border-l-2 border-dashed absolute top-0 bottom-0 left-1/2 -translate-x-1/2 ${
                                            isHourPast
                                              ? 'border-[#e88d84]/55 dark:border-[#e88d84]/45'
                                              : 'border-slate-200 dark:border-zinc-800'
                                          }`}
                                        />
                                        <span
                                          className={`relative z-10 w-2 h-2 rounded-full group-hover/hr:scale-125 transition ${
                                            isHourPast
                                              ? 'bg-[#e88d84]/75'
                                              : 'bg-slate-200 dark:bg-zinc-700 group-hover/hr:bg-[#e88d84]'
                                          }`}
                                        />
                                      </div>

                                      <div className="flex-1 min-w-0 pl-2 sm:pl-3 pr-2 flex items-center justify-between gap-2">
                                        <div className="flex-1 h-[1px] border-t border-dashed border-slate-200/80 dark:border-zinc-800/80 group-hover/hr:border-[#e88d84]/50 transition" />
                                        <span className="text-[11px] font-semibold text-slate-400 sm:opacity-0 sm:group-hover/hr:opacity-100 group-hover/hr:text-[#d87268] dark:text-zinc-500 dark:group-hover/hr:text-[#f29b94] inline-flex items-center gap-1 transition whitespace-nowrap">
                                          <Plus className="w-3 h-3" />
                                          <span className="sm:hidden">Schedule</span>
                                          <span className="hidden sm:inline">
                                            Schedule {formatHourLabel(hr, useAMPM)}
                                          </span>
                                        </span>
                                      </div>
                                    </button>
                                  </React.Fragment>
                                );
                              })}

                              {/* If Now falls after the last intermediate hour tick (or there were none) */}
                              {nowInThisGap &&
                                !nowRenderedInsideGap &&
                                renderNowIndicatorRow(
                                  `next in ${formatDurationText(minsUntilNext)}`,
                                  true
                                )}

                              {/* Quiet Stretch Trigger (fills exact gap duration) */}
                              <div className="flex items-stretch min-h-[24px]">
                                <div className="w-[52px] sm:w-[66px] shrink-0 pr-2" />
                                <div className="w-[36px] sm:w-[44px] shrink-0 relative flex justify-center">
                                  <div
                                    className={`w-[2px] h-full ${
                                      gapBeforeMins >= 30
                                        ? isToday && cluster.startMin <= currentTotalMinutes
                                          ? 'border-l-2 border-dashed border-[#e88d84]/55 dark:border-[#e88d84]/45'
                                          : 'border-l-2 border-dashed border-slate-200 dark:border-zinc-800'
                                        : isToday && cluster.startMin <= currentTotalMinutes
                                        ? 'bg-[#e88d84]/55'
                                        : 'bg-slate-200 dark:bg-zinc-800'
                                    }`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0 pl-2 sm:pl-3 py-1 flex items-center">
                                  {showFreeGaps && gapBeforeMins >= 30 && prevCluster ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onAddAtTime(
                                          formatMinutesToTime(prevCluster.endMin),
                                          formatMinutesToTime(cluster.startMin)
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-[#d87268] dark:text-zinc-500 dark:hover:text-[#f29b94] transition cursor-pointer group/gap"
                                    >
                                      <span>
                                        {gapBeforeMins >= 120
                                          ? `Long stretch — ${formatDurationText(gapBeforeMins)}`
                                          : `${formatDurationText(gapBeforeMins)} free`}
                                      </span>
                                      <span className="text-[#e88d84] font-bold group-hover/gap:underline">
                                        · + Add
                                      </span>
                                    </button>
                                  ) : (
                                    <div className="h-2.5" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        };

                        // CASE A: CONCURRENT / OVERLAPPING CLUSTER (1 shared Spine anchor + responsive grid/stack)
                        if (cluster.isOverlapCluster) {
                          const clusterDesktopCols =
                            !inspectedItem && cluster.blocks.length >= 3
                              ? 'sm:grid-cols-2 lg:grid-cols-3'
                              : 'sm:grid-cols-2';

                          return (
                            <React.Fragment key={cluster.id}>
                              {renderGapSection()}

                              <div className="flex items-stretch py-1">
                                {/* Left Shared Cluster Time Anchor */}
                                <div className="w-[52px] sm:w-[66px] shrink-0 pr-2 flex flex-col justify-between text-right py-2 select-none">
                                  <span
                                    className={`text-[10.5px] sm:text-[11px] font-semibold tabular-nums leading-none whitespace-nowrap ${
                                      isClusterPast
                                        ? 'text-amber-600/70 dark:text-amber-400/70'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {formatTimeDisplay(
                                      formatMinutesToTime(cluster.startMin),
                                      useAMPM
                                    )}
                                  </span>

                                  {isClusterActive && (
                                    <span className="inline-flex items-center justify-end gap-1 text-[10px] sm:text-[10.5px] font-black text-[#d87268] dark:text-[#f29b94] tabular-nums leading-none my-auto whitespace-nowrap">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#e88d84] animate-pulse" />
                                      <span>{formattedNowTime}</span>
                                    </span>
                                  )}

                                  {!isContiguousWithNext && cluster.blocks.some((b: any) => b.hasExplicitTimeRange) ? (
                                    <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-400 dark:text-zinc-500 tabular-nums leading-none whitespace-nowrap">
                                      {formatTimeDisplay(
                                        formatMinutesToTime(cluster.endMin),
                                        useAMPM
                                      )}
                                    </span>
                                  ) : (
                                    <span className="h-2" />
                                  )}
                                </div>

                                {/* Center Spine Overlap Node */}
                                <div className="w-[36px] sm:w-[44px] shrink-0 relative flex items-center justify-center py-1">
                                  {renderClusterSpineRail()}
                                  <div
                                    className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 dark:bg-amber-950 border-2 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-2xs ${
                                      isClusterActive
                                        ? 'ring-4 ring-[#e88d84]/30'
                                        : isClusterPast
                                        ? 'opacity-75'
                                        : ''
                                    }`}
                                    title={`${cluster.blocks.length} overlapping blocks`}
                                  >
                                    <Layers className="w-4 h-4 stroke-[2.3]" />
                                  </div>
                                </div>

                                {/* Grouped Concurrent Cluster Card */}
                                <div className="flex-1 min-w-0 pl-2 sm:pl-3">
                                  <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/45 dark:bg-amber-950/20 p-2 sm:p-2.5 space-y-2">
                                    <div className="flex items-center justify-between gap-2 px-0.5">
                                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                                        Overlap · {cluster.blocks.length} blocks
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAlignClusterOverlaps(cluster.blocks)}
                                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-900/40 text-[11px] font-bold text-amber-700 dark:text-amber-300 transition cursor-pointer shrink-0"
                                      >
                                        Align {cluster.blocks.length}
                                      </button>
                                    </div>

                                    <div
                                      className={`grid grid-cols-1 gap-1.5 sm:gap-2 ${clusterDesktopCols}`}
                                    >
                                      {cluster.blocks.map(block => {
                                        const isChecked = Boolean(block.completed);
                                        const isSelected = inspectedItemId === block.id;
                                        const { color, IconComponent } = block.visualMeta;

                                        return (
                                          <div
                                            key={block.id}
                                            onClick={() => setInspectedItemId(block.id)}
                                            className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition bg-white dark:bg-zinc-950 ${
                                              isSelected
                                                ? 'border-[#e88d84] ring-1 ring-[#e88d84]/40'
                                                : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                                            } ${isChecked ? 'opacity-60' : ''}`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <div
                                                style={{ backgroundColor: color }}
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                                              >
                                                <IconComponent className="w-3.5 h-3.5 stroke-[2.2]" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1 text-[10.5px] font-medium text-slate-400 dark:text-zinc-500 tabular-nums truncate">
                                                  <span className="truncate">
                                                    {block.hasExplicitTimeRange
                                                      ? `${formatTimeDisplay(block.startTime, useAMPM)}–${formatTimeDisplay(block.endTime, useAMPM)}`
                                                      : `${formatTimeDisplay(block.startTime, useAMPM)} · Due`}
                                                  </span>
                                                  {colorMode === '2channel' &&
                                                    (block.itemKind === 'task' || block.itemKind === 'event') &&
                                                    block.eisenhowerMeta && (
                                                      <span className={block.eisenhowerMeta.textClass}>
                                                        · {block.eisenhowerMeta.shortLabel}
                                                      </span>
                                                    )}
                                                  {colorMode === '2channel' &&
                                                    block.itemKind === 'habit' && (
                                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                        · Habit
                                                      </span>
                                                    )}
                                                </div>
                                                <h4
                                                  className={`text-[13px] sm:text-[13.5px] font-bold tracking-tight leading-snug truncate ${
                                                    isChecked
                                                      ? 'line-through text-slate-400 dark:text-zinc-500'
                                                      : 'text-slate-900 dark:text-white'
                                                  }`}
                                                >
                                                  {block.title}
                                                </h4>
                                              </div>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={e => {
                                                e.stopPropagation();
                                                handleToggleItem(block);
                                              }}
                                              className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                                              title={isChecked ? 'Mark incomplete' : 'Mark completed'}
                                            >
                                              <span
                                                style={{
                                                  borderColor: block.tickColor,
                                                  backgroundColor: isChecked
                                                    ? block.tickColor
                                                    : block.tickTint,
                                                }}
                                                className={`w-5 h-5 ${block.tickCompactShapeClass} border-2 flex items-center justify-center transition-transform hover:scale-110 active:scale-90`}
                                              >
                                                {isChecked && (
                                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                                )}
                                              </span>
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        }

                        // CASE B: SINGLE COMPACT SPINE BLOCK
                        const block = cluster.blocks[0];
                        const isChecked = Boolean(block.completed);
                        const isSelected = inspectedItemId === block.id;
                        const { color, progressColor, IconComponent } = block.visualMeta;

                        const isCurrentlyActive = isClusterActive;
                        const elapsedMins = isCurrentlyActive
                          ? currentTotalMinutes - block.startMin
                          : 0;
                        const remainingMins = isCurrentlyActive
                          ? Math.max(1, block.endMin - currentTotalMinutes)
                          : 0;
                        const activeProgressPct = isCurrentlyActive
                          ? Math.min(
                              100,
                              Math.max(8, Math.round((elapsedMins / block.duration) * 100))
                            )
                          : 0;

                        // Compact Spine node sizing (~40px default, slightly elongated vertical stadium for 90m+ blocks)
                        const nodeHeightPx = block.duration >= 90 ? 52 : 40;
                        const durationText = formatDurationText(block.duration);
                        const subtasksCount = Array.isArray(block.subtasks)
                          ? block.subtasks.length
                          : 0;
                        const subtasksDone = subtasksCount
                          ? block.subtasks.filter((s: any) => s.completed).length
                          : 0;
                        const isRepeating = Boolean(
                          (block.rawSchedule?.repeatType &&
                            block.rawSchedule.repeatType !== 'none') ||
                            (block.rawTask?.recurring && block.rawTask.recurring !== 'none')
                        );

                        return (
                          <React.Fragment key={cluster.id}>
                            {renderGapSection()}

                            <div
                              onClick={() => setInspectedItemId(block.id)}
                              className="flex items-stretch group/row relative py-0.5 cursor-pointer"
                            >
                              {/* 1. LEFT TIME MARGIN */}
                              <div className="w-[52px] sm:w-[66px] shrink-0 pr-2 flex flex-col justify-between text-right py-2 select-none">
                                <span
                                  className={`text-[10.5px] sm:text-[11px] font-medium tabular-nums leading-none whitespace-nowrap ${
                                    isClusterPast
                                      ? 'text-slate-400/75 dark:text-zinc-600'
                                      : 'text-slate-400 dark:text-zinc-500'
                                  }`}
                                >
                                  {formatTimeDisplay(block.startTime, useAMPM)}
                                </span>

                                {isCurrentlyActive && (
                                  <span className="inline-flex items-center justify-end gap-1 text-[10px] sm:text-[10.5px] font-black text-[#d87268] dark:text-[#f29b94] tabular-nums leading-none my-auto whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#e88d84] animate-pulse" />
                                    <span>{formattedNowTime}</span>
                                  </span>
                                )}

                                {!isContiguousWithNext && block.hasExplicitTimeRange ? (
                                  <span
                                    className={`text-[10px] sm:text-[10.5px] font-medium tabular-nums leading-none whitespace-nowrap ${
                                      isClusterPast
                                        ? 'text-slate-400/75 dark:text-zinc-600'
                                        : 'text-slate-400 dark:text-zinc-500'
                                    }`}
                                  >
                                    {formatTimeDisplay(block.endTime, useAMPM)}
                                  </span>
                                ) : (
                                  <span className="h-2" />
                                )}
                              </div>

                              {/* 2. CENTER SPINE LINE + STRUCTURED VISUAL NODE */}
                              <div className="w-[36px] sm:w-[44px] shrink-0 relative flex items-center justify-center py-1">
                                {renderClusterSpineRail()}

                                <div
                                  style={{
                                    height: `${nodeHeightPx}px`,
                                    backgroundColor: color,
                                  }}
                                  className={`relative z-10 w-9 sm:w-10 rounded-full flex items-center justify-center text-white shadow-2xs overflow-hidden transition-transform group-hover/row:scale-[1.04] ${
                                    isCurrentlyActive
                                      ? 'ring-4 ring-[#e88d84]/30'
                                      : isChecked
                                      ? 'opacity-50'
                                      : isClusterPast
                                      ? 'opacity-80'
                                      : ''
                                  }`}
                                >
                                  {isCurrentlyActive && (
                                    <div
                                      style={{
                                        height: `${activeProgressPct}%`,
                                        backgroundColor: progressColor,
                                      }}
                                      className="absolute top-0 left-0 right-0 transition-all duration-500"
                                    />
                                  )}
                                  <IconComponent className="w-[17px] h-[17px] sm:w-[18px] sm:h-[18px] stroke-[2.2] relative z-10" />
                                </div>
                              </div>

                              {/* 3. RIGHT COMPACT SPINE CARD (Clean hairline, calm hierarchy, 44px check hitbox) */}
                              <div className="flex-1 min-w-0 pl-2 sm:pl-3 py-0.5 flex items-center">
                                <div
                                  className={`w-full min-w-0 rounded-2xl border px-3 sm:px-3.5 py-2 flex items-center justify-between gap-2 transition ${
                                    isSelected
                                      ? 'bg-[#fbf4f2]/85 dark:bg-zinc-900/95 border-[#e88d84]/60 ring-1 ring-[#e88d84]/35'
                                      : isCurrentlyActive
                                      ? 'bg-[#fbf4f2]/45 dark:bg-zinc-900/65 border-[#e88d84]/45 shadow-2xs'
                                      : 'bg-white dark:bg-zinc-950 border-slate-200/75 dark:border-zinc-800/80 group-hover/row:border-slate-300/90 dark:group-hover/row:border-zinc-700 group-hover/row:bg-slate-50/40 dark:group-hover/row:bg-zinc-900/40'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500 tabular-nums flex-wrap">
                                      {isCurrentlyActive && block.hasExplicitTimeRange ? (
                                        <span className="font-bold text-[#d87268] dark:text-[#f29b94]">
                                          {remainingMins}m remaining
                                        </span>
                                      ) : isCurrentlyActive ? (
                                        <span className="font-bold text-[#d87268] dark:text-[#f29b94]">
                                          {formatTimeDisplay(block.startTime, useAMPM)} · Due now
                                        </span>
                                      ) : block.hasExplicitTimeRange ? (
                                        <span>
                                          {formatTimeDisplay(block.startTime, useAMPM)}–
                                          {formatTimeDisplay(block.endTime, useAMPM)} ·{' '}
                                          {durationText}
                                        </span>
                                      ) : (
                                        <span>
                                          {formatTimeDisplay(block.startTime, useAMPM)} · Due
                                        </span>
                                      )}

                                      {colorMode === '2channel' ? (
                                        <>
                                          {block.itemKind === 'habit' && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                Habit
                                              </span>
                                            </>
                                          )}
                                          {block.itemKind === 'task' && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span>Task</span>
                                              {block.eisenhowerMeta && (
                                                <>
                                                  <span aria-hidden="true">·</span>
                                                  <span className={block.eisenhowerMeta.textClass}>
                                                    {block.eisenhowerMeta.code}
                                                  </span>
                                                </>
                                              )}
                                            </>
                                          )}
                                          {block.itemKind === 'event' && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span className="text-[#d87268] dark:text-[#f29b94] font-medium">
                                                Event
                                              </span>
                                              {block.eisenhowerMeta && (
                                                <>
                                                  <span aria-hidden="true">·</span>
                                                  <span className={block.eisenhowerMeta.textClass}>
                                                    {block.eisenhowerMeta.code}
                                                  </span>
                                                </>
                                              )}
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        block.sourceType === 'habit' && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>Habit</span>
                                          </>
                                        )
                                      )}
                                      {isRepeating && <Repeat className="w-3 h-3 opacity-75" />}
                                    </div>

                                    <h4
                                      className={`text-[14px] sm:text-[15px] font-bold tracking-tight leading-snug truncate mt-0.5 ${
                                        isChecked
                                          ? 'line-through text-slate-400 dark:text-zinc-500'
                                          : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {block.title}
                                    </h4>

                                    {(subtasksCount > 0 || block.notes) && (
                                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500 truncate tabular-nums">
                                        {subtasksCount > 0 && (
                                          <span className="inline-flex items-center gap-1 shrink-0">
                                            <CheckSquare className="w-3 h-3" />
                                            <span>
                                              {subtasksDone}/{subtasksCount}
                                            </span>
                                          </span>
                                        )}
                                        {block.notes && (
                                          <span className="truncate">{block.notes}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleToggleItem(block);
                                    }}
                                    className="w-10 h-10 -mr-1.5 flex items-center justify-center rounded-full shrink-0 cursor-pointer"
                                    title={isChecked ? 'Mark incomplete' : 'Mark completed'}
                                  >
                                    <span
                                      style={{
                                        borderColor: block.tickColor,
                                        backgroundColor: isChecked
                                          ? block.tickColor
                                          : block.tickTint,
                                      }}
                                      className={`w-[22px] h-[22px] ${block.tickShapeClass} border-[2.2px] flex items-center justify-center transition-transform hover:scale-110 active:scale-90`}
                                    >
                                      {isChecked && (
                                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                      )}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}

                      {showNowAfterLast && renderNowIndicatorRow('After schedule', true)}
                    </>
                  );
                })()}

                {/* Bottom Trailing Quick-Add Node */}
                <div className="flex items-center mt-1.5">
                  <div className="w-[52px] sm:w-[66px] shrink-0 pr-2 text-right">
                    <span className="text-[10.5px] font-medium text-slate-300 dark:text-zinc-600 tabular-nums whitespace-nowrap">
                      {formatTimeDisplay(
                        formatMinutesToTime(getNextAvailableStartMin('12:00')),
                        useAMPM
                      )}
                    </span>
                  </div>
                  <div className="w-[36px] sm:w-[44px] shrink-0 flex flex-col items-center">
                    <div className="w-[2px] h-2.5 bg-slate-200 dark:bg-zinc-800" />
                    <button
                      type="button"
                      onClick={() => {
                        const s = getNextAvailableStartMin('12:00');
                        onAddAtTime(
                          formatMinutesToTime(s),
                          formatMinutesToTime(Math.min(1439, s + 30))
                        );
                      }}
                      className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-[#e88d84] text-slate-400 hover:text-[#e88d84] flex items-center justify-center transition cursor-pointer"
                      title="Add next task block"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 pl-2 sm:pl-3">
                    <button
                      type="button"
                      onClick={() => {
                        const s = getNextAvailableStartMin('12:00');
                        onAddAtTime(
                          formatMinutesToTime(s),
                          formatMinutesToTime(Math.min(1439, s + 30))
                        );
                      }}
                      className="text-xs font-semibold text-slate-400 hover:text-[#e88d84] dark:text-zinc-500 dark:hover:text-[#f29b94] transition cursor-pointer"
                    >
                      + Add next block...
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP (lg+) ON-DEMAND DETAIL INSPECTOR SIDECAR */}
        {inspectedItem && (
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-3 min-w-0">
            <div className="bg-white dark:bg-zinc-950 rounded-[28px] border border-slate-200/80 dark:border-zinc-800/90 shadow-2xs overflow-hidden max-h-[calc(100vh-120px)] flex flex-col">
              {renderInspectorBody(inspectedItem, () => setInspectedItemId(null), 'Timeline')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
