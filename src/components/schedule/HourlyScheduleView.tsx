import React, { useMemo, useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Check, 
  Play, 
  Edit2, 
  Trash2, 
  MapPin, 
  SlidersHorizontal, 
  Flame, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Zap,
  Star,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CornerDownRight,
  CheckCheck,
} from 'lucide-react';
import { ScheduleItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { AnimatedStreakBadge } from '../common/AnimatedStreakBadge';

export interface HourlyScheduleViewProps {
  selectedDate: string;
  items: ScheduleItem[];
  timelineItems?: any[];
  onAddAtHour: (hour: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onEditTask?: (task: any) => void;
  onEditHabit?: (habit: any) => void;
  onQuickTimeblock?: (task: any, hour: string) => void;
  celebratingPlannerId?: string | null;
  plannerCelebrationKey?: number;
  plannerBadgeText?: string;
  handleToggleWithCelebration?: (id: string, type: 'task' | 'schedule' | 'habit') => void;
}

const formatHourLabel = (h24: string): string => {
  const num = parseInt(h24, 10);
  if (num === 0) return '12:00 AM';
  if (num < 12) return `${num}:00 AM`;
  if (num === 12) return '12:00 PM';
  return `${num - 12}:00 PM`;
};

const parseTimeToMinutes = (timeStr?: string): number | null => {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }
  return null;
};

const calculateDurationLabel = (start?: string, end?: string): string | null => {
  if (!start || !end) return null;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return null;
  const diffMinutes = (eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0));
  if (diffMinutes <= 0) return null;
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const PRIORITY_DOTS: Record<string, string> = {
  P1: 'bg-rose-500 ring-rose-300 dark:ring-rose-900',
  P2: 'bg-amber-500 ring-amber-300 dark:ring-amber-900',
  P3: 'bg-indigo-500 ring-indigo-300 dark:ring-indigo-900',
  P4: 'bg-slate-400 ring-slate-200 dark:ring-slate-700',
};

const getCategoryAccent = (sourceType: string, category?: string) => {
  if (sourceType === 'habit') {
    return {
      borderLeft: 'border-l-4 border-l-violet-500',
      badge: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50/40 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30',
    };
  }
  if (sourceType === 'task') {
    return {
      borderLeft: 'border-l-4 border-l-indigo-500',
      badge: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30',
    };
  }
  // Schedule event
  const cat = (category || 'routine').toLowerCase();
  switch (cat) {
    case 'work':
      return {
        borderLeft: 'border-l-4 border-l-blue-500',
        badge: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
      };
    case 'meeting':
      return {
        borderLeft: 'border-l-4 border-l-purple-500',
        badge: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30',
      };
    case 'focus':
      return {
        borderLeft: 'border-l-4 border-l-amber-500',
        badge: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
      };
    case 'health':
      return {
        borderLeft: 'border-l-4 border-l-emerald-500',
        badge: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
      };
    case 'personal':
      return {
        borderLeft: 'border-l-4 border-l-cyan-500',
        badge: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30',
      };
    default:
      return {
        borderLeft: 'border-l-4 border-l-slate-400',
        badge: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60',
      };
  }
};

export const HourlyScheduleView: React.FC<HourlyScheduleViewProps> = ({
  selectedDate,
  items,
  timelineItems = [],
  onAddAtHour,
  onEditItem,
  onEditTask,
  onEditHabit,
  onQuickTimeblock,
  celebratingPlannerId,
  plannerCelebrationKey,
  plannerBadgeText,
  handleToggleWithCelebration,
}) => {
  const {
    deleteScheduleItem,
    updateScheduleItem,
    addScheduleItem,
    updateTask,
    updateHabit,
    pushNotification,
    soundEngine,
    startPomodoro,
    setPomodoroTask,
    scheduleStartHour,
    setScheduleStartHour,
    scheduleEndHour,
    setScheduleEndHour,
    addEarlierScheduleHour,
    removeEarlierScheduleHour,
    addLaterScheduleHour,
    removeLaterScheduleHour,
    setScheduleTimingPreset,
  } = useApp();

  const [showTimingCustomizer, setShowTimingCustomizer] = useState(false);
  const [isAnytimeExpanded, setIsAnytimeExpanded] = useState(true);
  const [schedulingItemId, setSchedulingItemId] = useState<string | null>(null);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = now.getMinutes();

  // Timing Presets Labels
  const startLabel = formatHourLabel(String(scheduleStartHour).padStart(2, '0'));
  const endLabel = formatHourLabel(String(scheduleEndHour).padStart(2, '0'));

  // Dynamically generate hours array from scheduleStartHour to scheduleEndHour
  const hours = useMemo(() => {
    const list: string[] = [];
    for (let h = scheduleStartHour; h <= scheduleEndHour; h++) {
      list.push(String(h).padStart(2, '0'));
    }
    return list;
  }, [scheduleStartHour, scheduleEndHour]);

  // Group ALL timeline items by starting hour & continuing multi-hour spans
  const itemsByHour = useMemo(() => {
    const startingMap: Record<string, any[]> = {};
    const continuingMap: Record<string, any[]> = {};
    const anytime: any[] = [];

    const effectiveList = (timelineItems && timelineItems.length > 0)
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
          rawSchedule: s,
        }));

    // Augment items with minute timestamps & multi-hour span detection
    const itemsWithIntervals = effectiveList.map(item => {
      const sMin = parseTimeToMinutes(item.startTime);
      const eMin = parseTimeToMinutes(item.endTime) ?? (sMin !== null ? sMin + 60 : null);
      const duration = (sMin !== null && eMin !== null && eMin > sMin) ? (eMin - sMin) : 60;
      const isMultiHour = duration >= 90; // spans 1.5+ hours (e.g., 6:00 to 9:00 = 180 min)
      return {
        ...item,
        startMin: sMin,
        endMin: eMin,
        duration,
        isMultiHour,
      };
    });

    // Populate starting and continuing maps for each hour of the day
    for (let h = 0; h < 24; h++) {
      const hourKey = String(h).padStart(2, '0');
      const hourStartMin = h * 60;
      const hourEndMin = (h + 1) * 60;

      itemsWithIntervals.forEach(item => {
        if (item.startMin === null) return;

        // Starts in this hour slot
        if (item.startMin >= hourStartMin && item.startMin < hourEndMin) {
          if (!startingMap[hourKey]) startingMap[hourKey] = [];
          startingMap[hourKey].push(item);
        }
        // Spans / Continues through this hour slot from an earlier hour
        else if (item.startMin < hourStartMin && item.endMin !== null && item.endMin > hourStartMin) {
          if (!continuingMap[hourKey]) continuingMap[hourKey] = [];
          const startH = Math.floor(item.startMin / 60);
          const totalHours = Math.max(1, Math.ceil((item.endMin - item.startMin) / 60));
          const currentHourIndex = h - startH + 1;
          continuingMap[hourKey].push({
            ...item,
            currentHourIndex,
            totalHours,
          });
        }
      });
    }

    // Add anytime items (no startTime)
    itemsWithIntervals.forEach(item => {
      if (item.startMin === null) {
        anytime.push(item);
      }
    });

    // Chronologically sorted items with intervals for overlap and free-time detection
    const sortedScheduled = itemsWithIntervals
      .filter(i => i.startMin !== null && i.endMin !== null)
      .sort((a, b) => (a.startMin! - b.startMin!));

    const overlapsMap: Record<string, { conflictingItem: any; reason: string }> = {};
    const alignedInFreeTimeSet = new Set<string>();

    sortedScheduled.forEach(item => {
      // Check if item overlaps with any other scheduled item
      const conflict = sortedScheduled.find(other => 
        other.id !== item.id &&
        item.startMin! < other.endMin! &&
        item.endMin! > other.startMin!
      );

      if (conflict) {
        overlapsMap[item.id] = {
          conflictingItem: conflict,
          reason: `Scheduled inside "${conflict.title}" (${conflict.startTime} – ${conflict.endTime})`,
        };
      } else {
        // Aligned cleanly outside any big event
        const prev = sortedScheduled
          .filter(other => other.id !== item.id && other.endMin! <= item.startMin!)
          .pop();
        const next = sortedScheduled
          .find(other => other.id !== item.id && other.startMin! >= item.endMin!);

        if (prev || next) {
          alignedInFreeTimeSet.add(item.id);
        }
      }
    });

    // Compute free time context for hours that have no starting or continuing items
    const freeTimeInfoByHour: Record<string, { prev?: any; next?: any; isBetween: boolean }> = {};
    let freeHoursCount = 0;
    for (let h = scheduleStartHour; h <= scheduleEndHour; h++) {
      const hourKey = String(h).padStart(2, '0');
      const hasContent = (startingMap[hourKey]?.length || 0) > 0 || (continuingMap[hourKey]?.length || 0) > 0;
      if (!hasContent) freeHoursCount++;

      const prev = sortedScheduled
        .filter(item => item.endMin! <= h * 60)
        .pop();
      const next = sortedScheduled
        .find(item => item.startMin! >= (h + 1) * 60);

      freeTimeInfoByHour[hourKey] = {
        prev,
        next,
        isBetween: Boolean(prev && next),
      };
    }

    const multiHourCount = itemsWithIntervals.filter(i => i.isMultiHour).length;
    const overlapCount = Object.keys(overlapsMap).length;

    return {
      hourly: startingMap,
      starting: startingMap,
      continuing: continuingMap,
      anytime,
      overlapsMap,
      alignedInFreeTimeSet,
      freeTimeInfoByHour,
      effectiveList: itemsWithIntervals,
      sortedScheduled,
      multiHourCount,
      overlapCount,
      freeHoursCount,
    };
  }, [timelineItems, items, scheduleStartHour, scheduleEndHour]);

  // Instant Smart Align: Shift an overlapping item to the nearest open free time window
  const handleAlignItemToNextFreeSlot = (item: any) => {
    const occupiedMinutes: { start: number; end: number }[] = [];
    itemsByHour.sortedScheduled.forEach(other => {
      if (other.id === item.id) return;
      if (other.startMin !== null && other.endMin !== null) {
        occupiedMinutes.push({ start: other.startMin, end: other.endMin });
      }
    });

    const curS = parseTimeToMinutes(item.startTime) ?? 9 * 60;
    const curE = parseTimeToMinutes(item.endTime) ?? (curS + 60);
    const dur = Math.max(30, curE - curS);

    let bestSlotStart: number | null = null;
    const conflict = itemsByHour.overlapsMap[item.id]?.conflictingItem;
    const searchStartH = conflict && conflict.endMin 
      ? Math.floor(conflict.endMin / 60) 
      : Math.max(scheduleStartHour, Math.floor(curS / 60) + 1);

    // Prefer first free slot after the conflicting event
    for (let h = searchStartH; h <= Math.min(23, scheduleEndHour + 2); h++) {
      const candidateStart = h * 60;
      const candidateEnd = candidateStart + dur;
      const hasConflict = occupiedMinutes.some(occ => 
        candidateStart < occ.end && candidateEnd > occ.start
      );
      if (!hasConflict) {
        bestSlotStart = candidateStart;
        break;
      }
    }

    // Fallback: check all hours from scheduleStartHour
    if (bestSlotStart === null) {
      for (let h = scheduleStartHour; h <= Math.min(23, scheduleEndHour + 2); h++) {
        const candidateStart = h * 60;
        const candidateEnd = candidateStart + dur;
        const hasConflict = occupiedMinutes.some(occ => 
          candidateStart < occ.end && candidateEnd > occ.start
        );
        if (!hasConflict) {
          bestSlotStart = candidateStart;
          break;
        }
      }
    }

    if (bestSlotStart === null) {
      pushNotification?.('Schedule Full', 'No open free-time slot available outside existing blocks.', 'calendar');
      return;
    }

    const newStartH = Math.floor(bestSlotStart / 60);
    const newStartM = bestSlotStart % 60;
    const newEndTotal = bestSlotStart + dur;
    const newEndH = Math.floor(newEndTotal / 60) % 24;
    const newEndM = newEndTotal % 60;

    const newStartStr = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
    const newEndStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

    if (item.sourceType === 'event' && item.rawSchedule) {
      updateScheduleItem({
        ...item.rawSchedule,
        startTime: newStartStr,
        endTime: newEndStr,
        notes: item.notes ? `${item.notes} • Aligned to free time (${newStartStr} – ${newEndStr})` : `Aligned to free time (${newStartStr} – ${newEndStr})`,
      });
    } else if (item.sourceType === 'task' && item.rawTask) {
      updateTask({
        ...item.rawTask,
        dueTime: newStartStr,
        notes: item.rawTask.notes ? `${item.rawTask.notes} • Aligned to free time` : 'Aligned to free time',
      });
    } else if (item.sourceType === 'habit' || item.rawHabit) {
      if (item.rawHabit) {
        updateHabit({
          ...item.rawHabit,
          reminderTime: newStartStr,
        });
      }
      addScheduleItem({
        title: item.title,
        date: selectedDate,
        startTime: newStartStr,
        endTime: newEndStr,
        category: item.category || 'habit',
        priority: 'medium',
        completed: Boolean(item.completed),
        notes: `Aligned to free time (${newStartStr} – ${newEndStr})`,
      });
    } else {
      addScheduleItem({
        title: item.title,
        date: selectedDate,
        startTime: newStartStr,
        endTime: newEndStr,
        category: item.category || 'General',
        priority: item.priority || 'medium',
        completed: Boolean(item.completed),
        notes: `Aligned to free time (${newStartStr} – ${newEndStr})`,
      });
    }

    soundEngine?.playSuccessChime?.();
    pushNotification?.(
      'Aligned in Free Time',
      `"${item.title}" aligned to open free time (${newStartStr} – ${newEndStr}) outside "${conflict?.title || 'busy block'}".`,
      'calendar'
    );
  };

  const handleStartFocus = (item: any) => {
    const taskId = item.sourceType === 'task' ? item.rawTask?.id : item.rawSchedule?.taskId;
    if (taskId) {
      setPomodoroTask(taskId);
    }
    startPomodoro();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            Timeline Schedule
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            ({startLabel} – {endLabel})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {timelineItems.length} planned items
          </span>

          <button
            type="button"
            onClick={() => setShowTimingCustomizer(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold transition shadow-2xs cursor-pointer"
            title="Adjust schedule hours"
          >
            <SlidersHorizontal className="w-3 h-3 text-indigo-500" />
            <span>Customize Hours</span>
          </button>
        </div>
      </div>

      {/* Timing Configurator Drawer */}
      {showTimingCustomizer && (
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-950/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">Presets:</span>
            <button
              type="button"
              onClick={() => setScheduleTimingPreset('standard')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                scheduleStartHour === 6 && scheduleEndHour === 22
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              6 AM – 10 PM
            </button>
            <button
              type="button"
              onClick={() => setScheduleTimingPreset('workday')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                scheduleStartHour === 8 && scheduleEndHour === 20
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              8 AM – 8 PM
            </button>
            <button
              type="button"
              onClick={() => setScheduleTimingPreset('early')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                scheduleStartHour === 5 && scheduleEndHour === 21
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Early Bird
            </button>
            <button
              type="button"
              onClick={() => setScheduleTimingPreset('24h')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                scheduleStartHour === 0 && scheduleEndHour === 23
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              24h
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px]">Start:</span>
              <select
                aria-label="Start Hour"
                value={scheduleStartHour}
                onChange={e => setScheduleStartHour(parseInt(e.target.value, 10))}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={`h_start_${i}`} value={i} disabled={i >= scheduleEndHour}>
                    {formatHourLabel(String(i).padStart(2, '0'))}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px]">End:</span>
              <select
                aria-label="End Hour"
                value={scheduleEndHour}
                onChange={e => setScheduleEndHour(parseInt(e.target.value, 10))}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={`h_end_${i}`} value={i} disabled={i <= scheduleStartHour}>
                    {formatHourLabel(String(i).padStart(2, '0'))}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Adjust Toolbar: Add earlier hour */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-50/60 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800/80 text-xs">
        <button
          type="button"
          onClick={addEarlierScheduleHour}
          disabled={scheduleStartHour <= 0}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[11px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
          title="Add earlier hour"
        >
          <Plus className="w-3 h-3" />
          <span>Add earlier hour ({formatHourLabel(String(Math.max(0, scheduleStartHour - 1)).padStart(2, '0'))})</span>
        </button>

        {scheduleStartHour < scheduleEndHour - 1 && (
          <button
            type="button"
            onClick={removeEarlierScheduleHour}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-[10px]"
            title="Remove top hour slot"
          >
            <span>Hide {startLabel}</span>
          </button>
        )}
      </div>

      {/* Section 1: Anytime / Flexible Priority Items (Tasks, Goals, Habits without specific start hour) */}
      {itemsByHour.anytime.length > 0 && (
        <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div 
            onClick={() => setIsAnytimeExpanded(!isAnytimeExpanded)}
            className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition select-none"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Anytime & Flexible Today
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                {itemsByHour.anytime.length}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <span className="text-[11px] hidden sm:inline text-slate-400">Click to timeblock into an hour</span>
              {isAnytimeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>

          {isAnytimeExpanded && (
            <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
              {itemsByHour.anytime.map(item => {
                const isChecked = item.completed;
                const isSchedulingThis = schedulingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850 hover:shadow-2xs transition relative ${
                      isChecked ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (handleToggleWithCelebration) {
                              if (item.sourceType === 'task') handleToggleWithCelebration(item.rawTask.id, 'task');
                              else if (item.sourceType === 'habit') handleToggleWithCelebration(item.id.replace('habit-', ''), 'habit');
                            }
                          }}
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            onClick={() => {
                              if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                              else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                            }}
                            className={`text-xs font-bold truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 ${
                              isChecked ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                            <span className="capitalize">{item.sourceType}</span>
                            {item.sourceType === 'habit' && (
                              <>
                                <span>·</span>
                                <span className="text-amber-500 flex items-center gap-0.5 font-semibold">
                                  <Flame className="w-3 h-3 fill-current" />
                                  {item.rawHabit?.currentStreak || 0}d
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.sourceType === 'task' && onQuickTimeblock && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setSchedulingItemId(isSchedulingThis ? null : item.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                              title="Timeblock this task into an hour slot"
                            >
                              + Slot
                            </button>

                            {isSchedulingThis && (
                              <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-white dark:bg-slate-850 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 text-xs">
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                  Pick start hour:
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {hours.map(h => (
                                    <button
                                      key={h}
                                      type="button"
                                      onClick={() => {
                                        onQuickTimeblock(item.rawTask, h);
                                        setSchedulingItemId(null);
                                      }}
                                      className="w-full text-left px-2.5 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                                    >
                                      {formatHourLabel(h)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {item.sourceType === 'task' && item.rawTask && (
                          <button
                            type="button"
                            onClick={() => handleStartFocus(item)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Focus Pomodoro"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                            else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Unified Hourly Timeline Stream (Global Famous Planner Canvas) */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 relative">
        {hours.map(hour => {
          const startingItems = itemsByHour.starting[hour] || [];
          const continuingItems = itemsByHour.continuing[hour] || [];
          const freeInfo = itemsByHour.freeTimeInfoByHour[hour];
          const hasContent = startingItems.length > 0 || continuingItems.length > 0;
          const isCurrentHourSlot = isToday && hour === currentHour;
          const label = formatHourLabel(hour);

          return (
            <div
              key={hour}
              className={`flex flex-col sm:flex-row group relative transition-colors ${
                isCurrentHourSlot ? 'bg-indigo-50/30 dark:bg-indigo-950/15' : 'hover:bg-slate-50/40 dark:hover:bg-slate-850/20'
              }`}
            >
              {/* Vertical Current Hour Live Indicator Bar (Red beacon with exact minute) */}
              {isCurrentHourSlot && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: `${Math.min(95, Math.max(5, (currentMinute / 60) * 100))}%` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-200 dark:ring-rose-950 -ml-1 animate-pulse" />
                  <div className="flex-1 h-0.5 bg-rose-500 shadow-xs" />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.2 rounded mr-3 border border-rose-200 dark:border-rose-900 uppercase">
                    Now
                  </span>
                </div>
              )}

              {/* Hourly Time Ruler Column */}
              <div className="w-24 sm:w-28 py-2 px-2.5 shrink-0 flex flex-row items-center justify-between whitespace-nowrap border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-950/20">
                <span
                  className={`text-xs sm:text-sm font-bold font-mono tracking-tight ${
                    isCurrentHourSlot
                      ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {label}
                </span>

                {/* Instant Quick Add Trigger on Hour Ruler */}
                <button
                  type="button"
                  onClick={() => onAddAtHour(hour)}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                  title={`Block schedule at ${label}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Grouped Timeblock Cards under this Hour Slot */}
              <div className="flex-1 p-1.5 sm:p-2 min-h-[48px] flex flex-col justify-center">
                {hasContent ? (
                  <div className="space-y-2">
                    {/* 1. Multi-hour continuing blocks in progress through this hour */}
                    {continuingItems.map(item => (
                      <div
                        key={`cont-${item.id}-${hour}`}
                        className="rounded-xl border border-dashed p-2.5 sm:p-3 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 relative bg-indigo-50/25 dark:bg-indigo-950/15 border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-50/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-4 h-4 rounded-md border border-indigo-400/50 bg-indigo-100/60 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                            <CornerDownRight className="w-3 h-3 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <span
                                onClick={() => {
                                  if (item.sourceType === 'event') onEditItem(item.rawSchedule);
                                  else if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                                  else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                                }}
                                className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-indigo-600 truncate"
                              >
                                ↳ In Progress: {item.title}
                              </span>
                              <span className="text-[10px] font-semibold bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                                Hour {item.currentHourIndex} of {item.totalHours} • Until {item.endTime}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{item.startTime} – {item.endTime}</span>
                              <span>·</span>
                              <span>Multi-Hour Big Event</span>
                              {item.category && (
                                <>
                                  <span>·</span>
                                  <span className="capitalize">{item.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          {(item.sourceType === 'task' || (item.sourceType === 'event' && item.rawSchedule?.taskId)) && (
                            <button
                              type="button"
                              onClick={() => handleStartFocus(item)}
                              className="p-1.5 rounded-md text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 transition cursor-pointer"
                              title="Focus on this event"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (item.sourceType === 'event') onEditItem(item.rawSchedule);
                              else if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                              else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* 2. Items starting in this hour slot */}
                    {startingItems.map(item => {
                      const isChecked = item.completed;
                      const accent = getCategoryAccent(item.sourceType, item.category);
                      const durationLabel = calculateDurationLabel(item.startTime, item.endTime);
                      const conflictInfo = itemsByHour.overlapsMap[item.id];
                      const isAlignedFreeTime = itemsByHour.alignedInFreeTimeSet.has(item.id);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-2.5 sm:p-3 transition-all shadow-2xs flex flex-col justify-between gap-2 relative hover:shadow-xs ${
                            accent.bg
                          } ${accent.borderLeft} ${isChecked ? 'opacity-65' : ''}`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Checkbox status toggle */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (handleToggleWithCelebration) {
                                    if (item.sourceType === 'task') {
                                      handleToggleWithCelebration(item.rawTask.id, 'task');
                                    } else if (item.sourceType === 'event') {
                                      handleToggleWithCelebration(item.rawSchedule.id, 'schedule');
                                    } else if (item.sourceType === 'habit') {
                                      const habitId = item.id.replace('habit-', '');
                                      handleToggleWithCelebration(habitId, 'habit');
                                    }
                                  }
                                }}
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                  isChecked
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>

                              {/* Timeblock details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  {item.sourceType === 'event' && item.priority && (
                                    <span
                                      className={`w-2 h-2 rounded-full ring-2 ${
                                        PRIORITY_DOTS[item.priority] || PRIORITY_DOTS.P2
                                      }`}
                                      title={`Priority: ${item.priority}`}
                                    />
                                  )}

                                  <span
                                    onClick={() => {
                                      if (item.sourceType === 'event') onEditItem(item.rawSchedule);
                                      else if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                                      else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                                    }}
                                    className={`text-xs sm:text-sm font-bold tracking-tight cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 truncate ${
                                      isChecked
                                        ? 'line-through text-slate-400 dark:text-slate-500'
                                        : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                  >
                                    {item.title}
                                  </span>

                                  {item.isMultiHour && (
                                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                      <Layers className="w-3 h-3 text-indigo-500" />
                                      <span>Big Block • {durationLabel}</span>
                                    </span>
                                  )}

                                  {isAlignedFreeTime && !conflictInfo && (
                                    <span className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-900/60 flex items-center gap-0.5">
                                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                                      <span>Aligned in Free Time</span>
                                    </span>
                                  )}

                                  {item.sourceType === 'task' && item.rawTask?.priority && (
                                    <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-0.5">
                                      <Star className="w-3 h-3 fill-current" />
                                      {item.rawTask.priority}
                                    </span>
                                  )}
                                </div>

                                {/* Zero-Pill Unboxed Clean Metadata */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                    {item.startTime} {item.endTime ? `– ${item.endTime}` : ''}
                                  </span>
                                  {durationLabel && (
                                    <>
                                      <span>·</span>
                                      <span>{durationLabel}</span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span className="capitalize">{item.sourceType}</span>
                                  {item.sourceType === 'event' && item.category && (
                                    <>
                                      <span>·</span>
                                      <span className="capitalize">{item.category}</span>
                                    </>
                                  )}
                                  {item.sourceType === 'event' && item.rawSchedule?.location && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5 truncate max-w-[140px]">
                                        <MapPin className="w-3 h-3 text-slate-400" />
                                        <span>{item.rawSchedule.location}</span>
                                      </span>
                                    </>
                                  )}
                                  {item.sourceType === 'habit' && (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-500 flex items-center gap-0.5 font-semibold">
                                        <Flame className="w-3 h-3 fill-current" />
                                        {item.rawHabit?.currentStreak || 0}d streak
                                      </span>
                                    </>
                                  )}
                                  {item.sourceType === 'task' && item.subtasks && item.subtasks.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[10px] text-slate-400">
                                        {item.subtasks.filter((s: any) => s.completed).length}/{item.subtasks.length} subtasks
                                      </span>
                                    </>
                                  )}
                                </div>

                                {item.notes && (
                                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Specific Action Buttons per card */}
                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                              {(item.sourceType === 'task' || (item.sourceType === 'event' && item.rawSchedule?.taskId)) && (
                                <button
                                  type="button"
                                  onClick={() => handleStartFocus(item)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                                  title="Start Focus Timer"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Focus</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.sourceType === 'event') onEditItem(item.rawSchedule);
                                  else if (item.sourceType === 'task' && onEditTask) onEditTask(item.rawTask);
                                  else if (item.sourceType === 'habit' && onEditHabit) onEditHabit(item.rawHabit);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {item.sourceType === 'event' && (
                                <button
                                  type="button"
                                  onClick={() => deleteScheduleItem(item.id.replace('event-', ''))}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                                  title="Delete schedule block"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Conflict & Smart Free-Time Alignment Banner */}
                          {conflictInfo && (
                            <div className="mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-[11px] text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 min-w-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="truncate">
                                  Scheduled inside <strong>"{conflictInfo.conflictingItem.title}"</strong> ({conflictInfo.conflictingItem.startTime} – {conflictInfo.conflictingItem.endTime})
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAlignItemToNextFreeSlot(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] cursor-pointer transition shadow-2xs shrink-0"
                                title="Align to open free time slot"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Align to Free Time</span>
                              </button>
                            </div>
                          )}

                          {/* Celebration overlay logic */}
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <CheckmarkCelebration
                              activeKey={
                                celebratingPlannerId ===
                                (item.sourceType === 'task'
                                  ? item.rawTask?.id
                                  : item.sourceType === 'event'
                                  ? item.rawSchedule?.id
                                  : item.id.replace('habit-', ''))
                                  ? plannerCelebrationKey
                                  : null
                              }
                              badgeText={plannerBadgeText || 'Done!'}
                              ringColor={item.sourceType === 'habit' ? 'border-[#4c6ef5]' : item.sourceType === 'event' ? 'border-blue-500' : 'border-emerald-500'}
                              align="right"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Verified Free Time Window Slot */
                  <div
                    onClick={() => onAddAtHour(hour)}
                    className="group/slot flex items-center justify-between text-xs py-2 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/40 hover:bg-emerald-50/30 dark:bg-slate-900/20 dark:hover:bg-emerald-950/15 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 group-hover/slot:scale-125 transition-transform" />
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover/slot:text-emerald-700 dark:group-hover/slot:text-emerald-300">
                        Free Time Window ({label})
                      </span>
                      {freeInfo?.isBetween ? (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-500 italic truncate hidden md:inline">
                          • Between "{freeInfo.prev?.title}" and "{freeInfo.next?.title}"
                        </span>
                      ) : freeInfo?.prev ? (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-500 italic truncate hidden md:inline">
                          • Open window after "{freeInfo.prev?.title}" ({freeInfo.prev?.endTime})
                        </span>
                      ) : freeInfo?.next ? (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-500 italic truncate hidden md:inline">
                          • Open window before "{freeInfo.next?.title}" ({freeInfo.next?.startTime})
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-slate-400 dark:text-slate-500 italic hidden sm:inline">
                          • Available for focus or tasks
                        </span>
                      )}
                    </div>
                    <span className="opacity-0 group-hover/slot:opacity-100 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 transition shrink-0">
                      <Plus className="w-3 h-3" />
                      <span>Schedule in Free Time</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Adjust Toolbar: Add later hour */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-50/60 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <button
          type="button"
          onClick={addLaterScheduleHour}
          disabled={scheduleEndHour >= 23}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[11px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
          title="Append 1 hour later"
        >
          <Plus className="w-3 h-3" />
          <span>Add later hour ({formatHourLabel(String(Math.min(23, scheduleEndHour + 1)).padStart(2, '0'))})</span>
        </button>

        {scheduleEndHour > scheduleStartHour + 1 && (
          <button
            type="button"
            onClick={removeLaterScheduleHour}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-[10px]"
            title="Remove bottom hour slot"
          >
            <span>Hide {endLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
