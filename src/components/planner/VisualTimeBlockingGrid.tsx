import React, { useMemo, useState } from 'react';
import {
  Clock,
  Plus,
  Check,
  Play,
  Edit2,
  Trash2,
  AlertTriangle,
  Sparkles,
  Layers,
  CheckCheck,
  Zap,
  MapPin,
  Calendar,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ScheduleItem, Priority } from '../../types';
import { useApp } from '../../context/AppContext';

export interface VisualTimeBlockingGridProps {
  selectedDate: string;
  items: ScheduleItem[];
  timelineItems?: any[];
  onAddAtTime: (startTime: string, endTime?: string) => void;
  onEditItem: (item: ScheduleItem) => void;
  onEditTask?: (task: any) => void;
  onEditHabit?: (habit: any) => void;
  handleToggleWithCelebration?: (id: string, type: 'task' | 'schedule' | 'habit') => void;
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

const formatHourLabel = (hour: number): string => {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

const getCategoryStyles = (category?: string, isMultiHour?: boolean) => {
  return {
    bg: 'bg-white dark:bg-slate-850',
    border: 'border-slate-200 dark:border-slate-700/80',
    borderLeft: '',
    text: 'text-slate-900 dark:text-slate-100',
    tagBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    accentColor: '#6366f1',
  };
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
}) => {
  const {
    updateScheduleItem,
    addScheduleItem,
    updateTask,
    updateHabit,
    deleteScheduleItem,
    pushNotification,
    soundEngine,
    startPomodoro,
    setPomodoroTask,
  } = useApp();

  // Density: compact (52px/hr), standard (72px/hr), spacious (96px/hr)
  const [density, setDensity] = useState<'compact' | 'standard' | 'spacious'>('compact');
  const [highlightOverlapsOnly, setHighlightOverlapsOnly] = useState(false);
  const [isOverlapBannerDismissed, setIsOverlapBannerDismissed] = useState(false);

  const [resizingState, setResizingState] = useState<{
    blockId: string;
    startMin: number;
    initialEndMin: number;
    currentEndMin: number;
  } | null>(null);

  const pixelsPerHour = density === 'compact' ? 52 : density === 'standard' ? 72 : 96;
  const pixelsPerMinute = pixelsPerHour / 60;

  // Real-time tracker for today
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  // Unified items list
  const rawList = useMemo(() => {
    if (timelineItems && timelineItems.length > 0) return timelineItems;
    return items.map(s => ({
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
  }, [timelineItems, items]);

  // Scheduled timed items augmented with minutes and duration
  const scheduledBlocks = useMemo(() => {
    const list: any[] = [];
    rawList.forEach(item => {
      const sMin = parseTimeToMinutes(item.startTime);
      if (sMin === null) return;
      let eMin = parseTimeToMinutes(item.endTime);
      if (eMin === null || eMin <= sMin) {
        if (item.sourceType === 'task' && item.rawTask?.durationMinutes) {
          eMin = sMin + item.rawTask.durationMinutes;
        } else {
          eMin = sMin + 60; // default 1 hour duration
        }
      }
      
      let finalEndMin = eMin;
      if (resizingState && resizingState.blockId === item.id) {
        finalEndMin = resizingState.currentEndMin;
      }
      
      const duration = finalEndMin - sMin;
      const isMultiHour = duration >= 90; // spans 1.5+ hours (e.g. 6 to 9 = 180 min)
      list.push({
        ...item,
        startMin: sMin,
        endMin: finalEndMin,
        duration,
        isMultiHour,
      });
    });
    return list.sort((a, b) => a.startMin - b.startMin);
  }, [rawList, resizingState]);

  // Determine grid hour range dynamically based on events and daylight hours
  const { gridStartHour, gridEndHour, hoursList } = useMemo(() => {
    let minH = 6; // Default starts at 6:00 AM
    let maxH = 22; // Default ends at 10:00 PM

    scheduledBlocks.forEach(b => {
      const sH = Math.floor(b.startMin / 60);
      const eH = Math.ceil(b.endMin / 60);
      if (sH < minH) minH = Math.max(0, sH);
      if (eH > maxH) maxH = Math.min(24, eH);
    });

    const hours: number[] = [];
    for (let h = minH; h <= maxH; h++) {
      hours.push(h);
    }
    return { gridStartHour: minH, gridEndHour: maxH, hoursList: hours };
  }, [scheduledBlocks]);

  const gridStartMin = gridStartHour * 60;
  const gridEndMin = gridEndHour * 60;
  const totalGridHeight = (gridEndHour - gridStartHour) * pixelsPerHour;

  // Dynamic Overlap Calculation (Interval Graph Coloring / Concurrent Tracks)
  const { positionedBlocks, overlapsMap, hasOverlaps, overlapClustersCount } = useMemo(() => {
    if (scheduledBlocks.length === 0) {
      return {
        positionedBlocks: [],
        overlapsMap: {},
        hasOverlaps: false,
        overlapClustersCount: 0,
      };
    }

    // Step 1: Group overlapping blocks into collision clusters
    const clusters: (typeof scheduledBlocks)[] = [];
    let currentCluster: typeof scheduledBlocks = [];
    let clusterEnd = -1;

    scheduledBlocks.forEach(block => {
      if (currentCluster.length === 0) {
        currentCluster.push(block);
        clusterEnd = block.endMin;
      } else {
        if (block.startMin < clusterEnd) {
          // Overlaps with the current cluster
          currentCluster.push(block);
          clusterEnd = Math.max(clusterEnd, block.endMin);
        } else {
          clusters.push(currentCluster);
          currentCluster = [block];
          clusterEnd = block.endMin;
        }
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Step 2: Assign column tracks within each cluster using greedy coloring
    const positioned: any[] = [];
    const overlaps: Record<string, { conflictingWith: any; reason: string }> = {};
    let overlapCount = 0;

    clusters.forEach(cluster => {
      const columns: number[] = []; // track the end minute of each column
      const clusterItemsWithCol: { block: any; col: number }[] = [];

      cluster.forEach(block => {
        let placedCol = -1;
        for (let c = 0; c < columns.length; c++) {
          if (columns[c] <= block.startMin) {
            placedCol = c;
            columns[c] = block.endMin;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = columns.length;
          columns.push(block.endMin);
        }
        clusterItemsWithCol.push({ block, col: placedCol });
      });

      const totalColsInCluster = columns.length;
      if (totalColsInCluster > 1) {
        overlapCount++;
      }

      clusterItemsWithCol.forEach(({ block, col }) => {
        // Detect direct overlaps with any other item in this cluster
        const conflictingOther = cluster.find(
          other => other.id !== block.id && block.startMin < other.endMin && block.endMin > other.startMin
        );

        if (conflictingOther) {
          overlaps[block.id] = {
            conflictingWith: conflictingOther,
            reason: `Overlaps during "${conflictingOther.title}" (${conflictingOther.startTime} – ${conflictingOther.endTime})`,
          };
        }

        positioned.push({
          ...block,
          colIndex: col,
          totalCols: totalColsInCluster,
          isOverlapping: Boolean(conflictingOther),
          conflictingItem: conflictingOther,
        });
      });
    });

    return {
      positionedBlocks: positioned,
      overlapsMap: overlaps,
      hasOverlaps: Object.keys(overlaps).length > 0,
      overlapClustersCount: overlapCount,
    };
  }, [scheduledBlocks]);

  // Calculate True Free Time Slots (Empty Intervals between scheduled blocks)
  const freeIntervals = useMemo(() => {
    if (scheduledBlocks.length === 0) {
      // Entire grid is free
      const dur = gridEndMin - gridStartMin;
      return [
        {
          id: 'free-all-day',
          startMin: gridStartMin,
          endMin: gridEndMin,
          duration: dur,
          startStr: formatMinutesToTime(gridStartMin),
          endStr: formatMinutesToTime(gridEndMin),
          durationLabel: `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim(),
          context: 'Full day open for focus and scheduling',
        },
      ];
    }

    // Merge scheduled blocks into unified occupied spans
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

    // Gap before first event
    if (mergedOccupied[0].start > gridStartMin) {
      const dur = mergedOccupied[0].start - gridStartMin;
      if (dur >= 20) {
        const nextFirst = scheduledBlocks.find(b => b.startMin === mergedOccupied[0].start);
        slots.push({
          id: `free-morning-${gridStartMin}`,
          startMin: gridStartMin,
          endMin: mergedOccupied[0].start,
          duration: dur,
          startStr: formatMinutesToTime(gridStartMin),
          endStr: formatMinutesToTime(mergedOccupied[0].start),
          durationLabel: `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim(),
          context: nextFirst ? `Morning focus window before "${nextFirst.title}"` : 'Morning focus window',
        });
      }
    }

    // Gaps between consecutive occupied blocks
    for (let i = 0; i < mergedOccupied.length - 1; i++) {
      const gapStart = mergedOccupied[i].end;
      const gapEnd = mergedOccupied[i + 1].start;
      const dur = gapEnd - gapStart;
      if (dur >= 20) {
        const prevEvent = scheduledBlocks.find(b => b.endMin === gapStart);
        const nextEvent = scheduledBlocks.find(b => b.startMin === gapEnd);
        slots.push({
          id: `free-between-${gapStart}-${gapEnd}`,
          startMin: gapStart,
          endMin: gapEnd,
          duration: dur,
          startStr: formatMinutesToTime(gapStart),
          endStr: formatMinutesToTime(gapEnd),
          durationLabel: `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim(),
          context: prevEvent && nextEvent
            ? `Free interval between "${prevEvent.title}" and "${nextEvent.title}"`
            : prevEvent
            ? `Free interval after "${prevEvent.title}"`
            : 'Available open interval',
          isBetween: Boolean(prevEvent && nextEvent),
          prevTitle: prevEvent?.title,
          nextTitle: nextEvent?.title,
        });
      }
    }

    // Gap after last event
    const lastOccEnd = mergedOccupied[mergedOccupied.length - 1].end;
    if (lastOccEnd < gridEndMin) {
      const dur = gridEndMin - lastOccEnd;
      if (dur >= 20) {
        const lastEvent = scheduledBlocks.find(b => b.endMin === lastOccEnd);
        slots.push({
          id: `free-evening-${lastOccEnd}`,
          startMin: lastOccEnd,
          endMin: gridEndMin,
          duration: dur,
          startStr: formatMinutesToTime(lastOccEnd),
          endStr: formatMinutesToTime(gridEndMin),
          durationLabel: `${Math.floor(dur / 60)}h ${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim(),
          context: lastEvent ? `Evening window after "${lastEvent.title}"` : 'Evening open window',
        });
      }
    }

    return slots;
  }, [scheduledBlocks, gridStartMin, gridEndMin]);

  // Smart Alignment: Shift an overlapping item to the nearest true free slot
  const handleAlignItemToFreeSlot = (item: any) => {
    const curDur = item.duration || 60;
    // Find the first free slot that fits this duration (or nearest slot after the conflicting block)
    const conflict = item.conflictingItem;
    const targetMinAfter = conflict ? conflict.endMin : item.endMin;

    let chosenSlot = freeIntervals.find(slot => slot.startMin >= targetMinAfter && slot.duration >= curDur);
    if (!chosenSlot) {
      // Find ANY free slot that can fit the item
      chosenSlot = freeIntervals.find(slot => slot.duration >= curDur);
    }
    if (!chosenSlot && freeIntervals.length > 0) {
      // Use the largest free slot
      chosenSlot = [...freeIntervals].sort((a, b) => b.duration - a.duration)[0];
    }

    if (!chosenSlot) {
      pushNotification('Schedule Full', 'No open free-time interval found for this item.', 'calendar');
      return;
    }

    const newStartMins = chosenSlot.startMin;
    const newEndMins = newStartMins + Math.min(curDur, chosenSlot.duration);
    const newStartStr = formatMinutesToTime(newStartMins);
    const newEndStr = formatMinutesToTime(newEndMins);

    const auditNote = `Aligned in free time (${newStartStr} – ${newEndStr}) outside "${conflict?.title || 'busy block'}"`;

    if (item.sourceType === 'event' && item.rawSchedule) {
      updateScheduleItem({
        ...item.rawSchedule,
        startTime: newStartStr,
        endTime: newEndStr,
        notes: item.rawSchedule.notes ? `${item.rawSchedule.notes} • ${auditNote}` : auditNote,
      });
    } else if (item.sourceType === 'task' && item.rawTask) {
      updateTask({
        ...item.rawTask,
        dueTime: newStartStr,
        notes: item.rawTask.notes ? `${item.rawTask.notes} • ${auditNote}` : auditNote,
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
        notes: auditNote,
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
        notes: auditNote,
      });
    }

    soundEngine?.playSuccessChime?.();
    pushNotification(
      'Aligned in Free Time',
      `"${item.title}" successfully aligned to open free interval (${newStartStr} – ${newEndStr}).`,
      'calendar'
    );
  };

  // Auto-Align ALL overlapping items to free intervals in one click
  const handleAlignAllOverlaps = () => {
    const overlappingItems = positionedBlocks.filter(b => b.isOverlapping);
    if (overlappingItems.length === 0) return;

    overlappingItems.forEach(item => {
      handleAlignItemToFreeSlot(item);
    });
  };

  const handleResizeStart = (e: React.MouseEvent, block: any) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const initialEndMin = block.endMin;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMin = Math.round(deltaY / pixelsPerMinute);
      
      // Snap to nearest 5 minutes
      const snapInterval = 5;
      const snappedDeltaMin = Math.round(deltaMin / snapInterval) * snapInterval;
      
      let targetEndMin = initialEndMin + snappedDeltaMin;
      // Constraint: at least 15 min duration, at most 24h (1440 mins)
      targetEndMin = Math.max(block.startMin + 15, Math.min(1440, targetEndMin));

      setResizingState({
        blockId: block.id,
        startMin: block.startMin,
        initialEndMin,
        currentEndMin: targetEndMin,
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setResizingState(prev => {
        if (prev && prev.blockId === block.id) {
          const finalEndMin = prev.currentEndMin;
          const finalEndStr = formatMinutesToTime(finalEndMin);

          if (block.sourceType === 'event' && block.rawSchedule) {
            updateScheduleItem({
              ...block.rawSchedule,
              endTime: finalEndStr,
            });
          } else if (block.sourceType === 'task' && block.rawTask) {
            updateTask({
              ...block.rawTask,
              durationMinutes: finalEndMin - block.startMin,
            });
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Metrics summary
  const totalPlannedMinutes = scheduledBlocks.reduce((acc, curr) => acc + curr.duration, 0);
  const totalFreeMinutes = freeIntervals.reduce((acc, curr) => acc + curr.duration, 0);
  const formattedPlanned = `${Math.floor(totalPlannedMinutes / 60)}h ${totalPlannedMinutes % 60 > 0 ? `${totalPlannedMinutes % 60}m` : ''}`.trim() || '0m';
  const formattedFree = `${Math.floor(totalFreeMinutes / 60)}h ${totalFreeMinutes % 60 > 0 ? `${totalFreeMinutes % 60}m` : ''}`.trim() || '0m';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* Top Controls & Metrics Bar */}
      <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Title + Inline Metrics */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Grid
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-900/40 shrink-0">
              {scheduledBlocks.length} Blk ({formattedPlanned})
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-900/40 shrink-0">
              {freeIntervals.length} Free ({formattedFree})
            </span>
          </div>
        </div>

        {/* Right: Density Switcher & Quick Add */}
        <div className="flex items-center gap-2">
          {hasOverlaps && (
            <button
              type="button"
              onClick={handleAlignAllOverlaps}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
              title="Automatically align all overlapping events into open free intervals"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Align All ({Object.keys(overlapsMap).length})</span>
            </button>
          )}

          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`px-2 py-0.5 rounded-md transition ${density === 'compact' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'hover:text-slate-900'}`}
              title="Compact grid (52px/hr)"
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setDensity('standard')}
              className={`px-2 py-0.5 rounded-md transition ${density === 'standard' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'hover:text-slate-900'}`}
              title="Standard grid (72px/hr)"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setDensity('spacious')}
              className={`px-2 py-0.5 rounded-md transition ${density === 'spacious' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'hover:text-slate-900'}`}
              title="Spacious grid (96px/hr)"
            >
              Spacious
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAddAtTime('09:00', '10:00')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Block</span>
          </button>
        </div>
      </div>

      {/* Overlap Alert Notice Banner if collisions exist */}
      {hasOverlaps && !isOverlapBannerDismissed && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              {Object.keys(overlapsMap).length} schedule overlap{Object.keys(overlapsMap).length === 1 ? '' : 's'} detected on this date.
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden md:inline">
              Events render side-by-side. Use 'Auto-Align All' above or 'Align to Free Time' on cards to re-align.
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsOverlapBannerDismissed(true)}
              className="px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
              title="Cancel and dismiss overlap alert"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Continuous Canvas Container */}
      <div className="relative overflow-x-auto overflow-y-visible max-h-[760px] select-none">
        <div
          className="relative min-w-[620px] flex"
          style={{ height: `${totalGridHeight}px` }}
        >
          {/* 1. Time Axis Column (Ruler - Compact width, zero empty space, +1px bold high contrast) */}
          <div className="w-14 sm:w-18 shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 relative">
            {hoursList.map((hour, idx) => {
              const topPx = idx * pixelsPerHour;
              return (
                <div
                  key={`ruler-${hour}`}
                  className="absolute left-0 right-0 border-t border-slate-200/70 dark:border-slate-800/60 px-0.5 pt-0.5 flex items-start justify-between"
                  style={{ top: `${topPx}px`, height: `${pixelsPerHour}px` }}
                >
                  <span className="text-[13px] font-extrabold font-mono text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                    {formatHourLabel(hour)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddAtTime(`${String(hour).padStart(2, '0')}:00`)}
                    className="opacity-0 hover:opacity-100 text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer transition"
                    title={`Add block at ${formatHourLabel(hour)}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 2. Grid Lines Background Canvas */}
          <div className="flex-1 relative bg-white dark:bg-slate-900/60">
            {hoursList.map((hour, idx) => {
              const topPx = idx * pixelsPerHour;
              const halfPx = topPx + pixelsPerHour / 2;
              return (
                <React.Fragment key={`gridlines-${hour}`}>
                  {/* Full hour solid line */}
                  <div
                    className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800/70 pointer-events-none"
                    style={{ top: `${topPx}px` }}
                  />
                  {/* Half hour subtle dashed line */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-slate-100/60 dark:border-slate-800/30 pointer-events-none"
                    style={{ top: `${halfPx}px` }}
                  />
                </React.Fragment>
              );
            })}

            {/* LIVE "NOW" RED LINE INDICATOR (for today's date) */}
            {isToday && currentTotalMinutes >= gridStartMin && currentTotalMinutes <= gridEndMin && (
              <div
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                style={{ top: `${(currentTotalMinutes - gridStartMin) * pixelsPerMinute}px` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-200 dark:ring-rose-950 -ml-1 animate-pulse" />
                <div className="flex-1 h-0.5 bg-rose-500 shadow-xs" />
                <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900 mr-2 uppercase">
                  Now • {formatMinutesToTime(currentTotalMinutes)}
                </span>
              </div>
            )}

            {/* 3. FREE TIME INTERVALS (Rendered as distinct empty interval cards between scheduled blocks) */}
            {freeIntervals.map(slot => {
              const topPx = (slot.startMin - gridStartMin) * pixelsPerMinute;
              const heightPx = slot.duration * pixelsPerMinute;
              if (heightPx < 18) return null; // Skip micro gaps

              return (
                <div
                  key={slot.id}
                  onClick={() => onAddAtTime(slot.startStr, slot.endStr)}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx - 3}px`,
                    left: '6px',
                    right: '6px',
                  }}
                  className="absolute z-10 rounded-xl border border-dashed border-emerald-300/60 dark:border-emerald-800/50 bg-emerald-50/20 hover:bg-emerald-50/40 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group flex flex-col justify-between p-2.5"
                  title={`Click to schedule an event inside this free time interval (${slot.startStr} – ${slot.endStr})`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500/80 group-hover:scale-125 transition-transform shrink-0" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                        {slot.startStr} – {slot.endStr}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded">
                        {slot.durationLabel} Free Time
                      </span>
                      {slot.context && (
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 italic truncate hidden sm:inline">
                          • {slot.context}
                        </span>
                      )}
                    </div>

                    <span className="opacity-0 group-hover:opacity-100 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 transition shrink-0 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-2xs border border-emerald-200 dark:border-emerald-800">
                      <Plus className="w-3 h-3" />
                      <span>Schedule in Free Time</span>
                    </span>
                  </div>

                  {heightPx >= 64 && (
                    <div className="text-[10.5px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                      <span>Available for deep focus, breaks, or task timeblocking</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Empty Interval</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 4. VISUAL SCHEDULED BLOCKS (Proportionally positioned and dynamically partitioned for overlaps) */}
            {positionedBlocks.map(block => {
              const topPx = (block.startMin - gridStartMin) * pixelsPerMinute;
              const heightPx = Math.max(34, block.duration * pixelsPerMinute);
              const styling = getCategoryStyles(block.category, block.isMultiHour);

              // Multi-column width calculation for overlapping events
              const totalCols = block.totalCols || 1;
              const colIndex = block.colIndex || 0;
              const colWidthPercent = 100 / totalCols;
              const leftPercent = colIndex * colWidthPercent;

              const isChecked = block.completed;
              const isOverlapping = block.isOverlapping;
              const conflictingItem = block.conflictingItem;

              // Check if item has notes indicating it was aligned into free time
              const isAlignedInFreeTime = (block.notes || '').includes('Aligned in free time') || (block.notes || '').includes('Aligned to free time');

              return (
                <div
                  key={block.id}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx - 3}px`,
                    left: `calc(${leftPercent}% + 6px)`,
                    width: `calc(${colWidthPercent}% - 10px)`,
                  }}
                  className={`absolute z-20 rounded-xl border p-2 sm:p-2.5 transition-all shadow-xs flex flex-col justify-between overflow-hidden group ${
                    isOverlapping
                      ? 'ring-1 ring-amber-400 dark:ring-amber-500 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-850'
                      : `${styling.bg} ${styling.border}`
                  } ${isChecked ? 'opacity-65' : ''}`}
                >
                  {/* Card Header Row: Checkbox, Title, Badges */}
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (handleToggleWithCelebration) {
                            if (block.sourceType === 'task') {
                              handleToggleWithCelebration(block.rawTask.id, 'task');
                            } else if (block.sourceType === 'event') {
                              handleToggleWithCelebration(block.rawSchedule.id, 'schedule');
                            } else if (block.sourceType === 'habit') {
                              handleToggleWithCelebration(block.id.replace('habit-', ''), 'habit');
                            }
                          }
                        }}
                        className={`w-3.5 h-3.5 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                          <span
                            onClick={() => {
                              if (block.sourceType === 'event') onEditItem(block.rawSchedule);
                              else if (block.sourceType === 'task' && onEditTask) onEditTask(block.rawTask);
                              else if (block.sourceType === 'habit' && onEditHabit) onEditHabit(block.rawHabit);
                            }}
                            className={`text-xs font-bold truncate cursor-pointer hover:underline ${
                              isChecked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {block.title}
                          </span>

                          {/* Multi-Hour Big Event Badge */}
                          {block.isMultiHour && (
                            <span className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
                              <Layers className="w-2.5 h-2.5" />
                              <span>Big Block ({Math.floor(block.duration / 60)}h)</span>
                            </span>
                          )}

                          {/* Aligned in Free Time Badge */}
                          {isAlignedInFreeTime && !isOverlapping && (
                            <span className="text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                              <CheckCheck className="w-2.5 h-2.5 text-emerald-500" />
                              <span>Aligned in Free Time</span>
                            </span>
                          )}

                          {/* Overlap / Conflict Warning Badge */}
                          {isOverlapping && conflictingItem && (
                            <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/70 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Overlaps with "{conflictingItem.title}"</span>
                            </span>
                          )}
                        </div>

                        {/* Timing interval label */}
                        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {block.startTime} – {block.endTime}
                          </span>
                          <span>•</span>
                          <span>
                            {Math.floor(block.duration / 60) > 0 ? `${Math.floor(block.duration / 60)}h ` : ''}
                            {block.duration % 60 > 0 ? `${block.duration % 60}m` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                      {isOverlapping && (
                        <button
                          type="button"
                          onClick={() => handleAlignItemToFreeSlot(block)}
                          className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                          title="Move to next open free time slot outside the conflict"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Align to Free Time</span>
                        </button>
                      )}

                      {(block.sourceType === 'task' || (block.sourceType === 'event' && block.rawSchedule?.taskId)) && (
                        <button
                          type="button"
                          onClick={() => {
                            const tId = block.sourceType === 'task' ? block.rawTask?.id : block.rawSchedule?.taskId;
                            if (tId) setPomodoroTask(tId);
                            startPomodoro();
                          }}
                          className="p-1 rounded text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Focus Timer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (block.sourceType === 'event') onEditItem(block.rawSchedule);
                          else if (block.sourceType === 'task' && onEditTask) onEditTask(block.rawTask);
                          else if (block.sourceType === 'habit' && onEditHabit) onEditHabit(block.rawHabit);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Block"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {block.sourceType === 'event' && (
                        <button
                          type="button"
                          onClick={() => deleteScheduleItem(block.id.replace('event-', ''))}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Delete Block"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Extended details if block is tall enough */}
                  {heightPx >= 75 && (
                    <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 mt-1 text-[10.5px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span className="capitalize">{block.category || 'General'}</span>
                      {block.notes && (
                        <span className="italic truncate max-w-[200px]" title={block.notes}>
                          {block.notes}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Draggable bottom resize handle */}
                  <div
                    onMouseDown={e => handleResizeStart(e, block)}
                    className="absolute bottom-0 left-0 right-0 h-2.5 bg-transparent hover:bg-indigo-500/20 dark:hover:bg-indigo-400/20 cursor-ns-resize flex items-center justify-center transition-colors group/handle z-30"
                    title="Drag bottom edge to change duration"
                  >
                    <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover/handle:bg-indigo-500 transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
