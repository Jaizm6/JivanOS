import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Star,
  Clock,
  Timer,
  Play,
  Pause,
  MessageSquare,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskItem, DEFAULT_TASK_CATEGORIES } from '../../types';
import { getQuadrantLabel, getSingleTaskDateReminder } from '../../utils/taskSorter';
import { formatOSDate, formatLocalDate } from '../../utils/date';
import { CheckmarkCelebration, AnimatedCheckIcon } from '../common/CheckmarkCelebration';
import { SubtaskBranchIcon } from '../common/SubtaskBranchIcon';
import { OverdueIcon } from '../common/OverdueIcon';
import { soundEngine } from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { getFontInlineStyle, getFontSizeClass, getFontTypeClass } from '../../utils/activityStyles';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';

interface UniformTaskCardProps {
  task: TaskItem;
  onToggleTask: (id: string) => void;
  onToggleStar: (id: string) => void;
  onOpenDetailTask: (task: TaskItem) => void;
  onOpenEditTask?: (task: TaskItem) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onCycleEisenhower?: (task: TaskItem) => void;
  onFilterCategory?: (catId: string) => void;
  onFilterTag?: (tag: string) => void;
  onFilterProject?: (project: string) => void;
  onMovePrev?: () => void;
  onMoveNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isBeingDragged?: boolean;
  isDropTarget?: boolean;
  dropPosition?: 'before' | 'after' | null;
  className?: string;
  isCompact?: boolean;
  index?: number;
}

export const UniformTaskCard = React.memo<UniformTaskCardProps>(({
  task,
  onToggleTask,
  onToggleStar,
  onOpenDetailTask,
  onToggleSubtask,
  onMovePrev,
  onMoveNext,
  prevLabel,
  nextLabel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  isBeingDragged = false,
  isDropTarget = false,
  dropPosition = null,
  className = '',
  isCompact = false,
}) => {
  const { pomodoro, startPomodoro, pausePomodoro, stopPomodoro, pushNotification } = useApp();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSuccessScale, setIsSuccessScale] = useState(false);
  const [subtaskSuccessId, setSubtaskSuccessId] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState<number>(0);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [isNotePeekOpen, setIsNotePeekOpen] = useState(false);
  const [notePeekState, setNotePeekState] = useState<{
    x: number;
    y: number;
    position: 'above' | 'below';
    arrowOffset: number;
  } | null>(null);

  const triggerNotePeek = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = window.innerWidth < 640 ? 280 : 320;
    
    // Centered horizontally on the note icon
    let x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    // Keep inside screen boundaries with a 16px margin on left/right edges
    const minX = 16;
    const maxX = window.innerWidth - tooltipWidth - 16;
    if (x < minX) x = minX;
    if (x > maxX) x = maxX;
    
    // Calculate vertical position (check space above)
    const approxHeight = Math.min(240, 60 + Math.ceil((task.notes || '').length / 28) * 18);
    const hasSpaceAbove = rect.top > approxHeight + 20;
    
    let y = 0;
    let position: 'above' | 'below' = 'above';
    
    if (hasSpaceAbove) {
      y = rect.top - 10; // Positioned 10px above
      position = 'above';
    } else {
      y = rect.bottom + 10; // Positioned 10px below
      position = 'below';
    }
    
    // Align the arrow dynamically with the notes icon's center relative to the tooltip left edge
    const arrowOffset = Math.max(12, Math.min(tooltipWidth - 12, rect.left + (rect.width / 2) - x));
    
    setNotePeekState({ x, y, position, arrowOffset });
    setIsNotePeekOpen(true);
  };

  const handleNoteMouseLeave = () => {
    setIsNotePeekOpen(false);
    setNotePeekState(null);
  };

  const [isHandleActive, setIsHandleActive] = useState(false);
  const isDraggingRef = useRef(false);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnimating) return;
    const wasCompleted = task.completed;
    if (!wasCompleted) {
      setIsAnimating(true);
      setIsSuccessScale(true);
      setTimeout(() => {
        setIsSuccessScale(false);
      }, 300);

      try {
        soundEngine.playWaterDropNotification();
        haptics.complete();
      } catch {}

      setTimeout(() => {
        setCelebrationKey(prev => prev + 1);
      }, 260);

      setTimeout(() => {
        setIsAnimating(false);
        onToggleTask(task.id);
      }, 850);
    } else {
      haptics.toggle();
      onToggleTask(task.id);
    }
  };

  const subtasks = (Array.isArray(task.subtasks) && task.subtasks.length > 0)
    ? task.subtasks
    : (Array.isArray(task.checklist) && task.checklist.length > 0)
    ? task.checklist
    : [];
  const hasSubtasks = subtasks.length > 0;
  const completedSubs = subtasks.filter(s => s.completed).length;
  const todayStr = formatLocalDate(new Date());

  // Compute Eisenhower matrix border class for the tick box
  const qStr = (task.quadrant || '').toString().toLowerCase();
  const isDone = task.completed || isAnimating;
  const checkboxClasses = (() => {
    if (qStr === 'urgent_important' || qStr === 'urgent-important' || (!task.quadrant && (task.priority === 'high' || (task.priority as string) === 'p1'))) {
      return isDone
        ? 'bg-rose-500 border-[3px] border-rose-500 text-white shadow-2xs'
        : 'border-[3px] border-rose-500 dark:border-rose-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (qStr === 'not_urgent_important' || qStr === 'not-urgent-important' || (!task.quadrant && (task.priority === 'medium' || (task.priority as string) === 'p2'))) {
      return isDone
        ? 'bg-amber-500 border-[3px] border-amber-500 text-white shadow-2xs'
        : 'border-[3px] border-amber-500 dark:border-amber-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    if (qStr === 'urgent_not_important' || qStr === 'urgent-not-important') {
      return isDone
        ? 'bg-blue-500 border-[3px] border-blue-500 text-white shadow-2xs'
        : 'border-[3px] border-blue-500 dark:border-blue-400 bg-white dark:bg-slate-800 hover:scale-105';
    }
    return isDone
      ? 'bg-emerald-500 border-[3px] border-emerald-500 text-white shadow-2xs'
      : 'border-[3px] border-emerald-500 dark:border-emerald-400 bg-white dark:bg-slate-800 hover:scale-105';
  })();

  return (
    <motion.div
      animate={isSuccessScale ? { scale: [1, 1.025, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      draggable={true}
      onDragStart={(e: any) => {
        isDraggingRef.current = true;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.setData('text', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }
        onDragStart?.(e);
      }}
      onDragEnd={() => {
        setIsHandleActive(false);
        setTimeout(() => { isDraggingRef.current = false; }, 250);
        onDragEnd?.();
      }}
      onDragOver={(e: any) => onDragOver?.(e)}
      onDragEnter={(e: any) => onDragEnter?.(e)}
      onDragLeave={(e: any) => onDragLeave?.(e)}
      onDrop={(e: any) => onDrop?.(e)}
      className={`relative group select-none transition-all w-full ${
        isCompact
          ? 'px-2.5 py-1.5 min-h-[34px] hover:bg-slate-50/80 dark:hover:bg-slate-800/50 flex flex-col justify-center'
          : 'rounded-xl border px-2.5 py-1.5 flex flex-col justify-between gap-1 shadow-2xs hover:shadow-xs bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
      } ${
        isBeingDragged ? 'opacity-40 scale-[0.98] border-dashed border-2 border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-none' : ''
      } ${
        isDropTarget && dropPosition === 'before'
          ? 'border-t-2 border-t-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
          : isDropTarget && dropPosition === 'after'
          ? 'border-b-2 border-b-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
          : ''
      } ${
        task.completed
          ? 'bg-slate-50/50 dark:bg-slate-900/40'
          : ''
      } ${className}`}
    >
      {/* Primary Row: Checkbox on top + Title */}
      <div className="flex items-start gap-2 min-w-0 w-full">
        {/* Checkbox on top */}
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <CheckmarkCelebration
            activeKey={isAnimating ? celebrationKey : null}
            badgeText="Done✅"
            ringColor="border-emerald-500"
            align="left"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            animate={isSuccessScale ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={handleCheckboxClick}
            title={`Eisenhower: ${qStr === 'urgent_important' ? 'DO (Urg & Imp)' : qStr === 'not_urgent_important' ? 'PLAN (Imp)' : qStr === 'urgent_not_important' ? 'PASS (Urg)' : 'SKIP (Neither)'} — Click to toggle completion`}
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${checkboxClasses}`}
          >
            {(task.completed || isAnimating) && (
              <AnimatedCheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} animate={isAnimating} />
            )}
          </motion.button>
        </div>

        {/* Task Title */}
        <div
          className="flex-1 min-w-0 cursor-pointer overflow-hidden"
          onClick={() => {
            if (isDraggingRef.current) return;
            onOpenDetailTask(task);
          }}
        >
          {(() => {
            const fontInlineStyle = getFontInlineStyle({
              fontColor: task.fontColor,
              fontSize: task.fontSize,
              fontType: task.fontType,
              isBold: task.isBold,
              isDone: task.completed,
            });
            const fontSizeClass = task.fontSize ? getFontSizeClass(task.fontSize) : 'text-[13.8px] sm:text-[14.8px]';
            const fontTypeClass = getFontTypeClass(task.fontType);

            const qMeta = getQuadrantLabel(task.quadrant);
            const rankNum = (task.rank !== undefined && task.rank > 0) ? task.rank : (task.order !== undefined && task.order > 0) ? task.order : 1;

            return (
              <span
                className={`block w-full ${fontSizeClass} ${fontTypeClass} font-semibold break-words whitespace-normal leading-snug transition ${
                  task.completed ? 'line-through text-slate-400 dark:text-slate-500 opacity-75' : task.fontColor ? '' : 'text-slate-900 dark:text-white'
                }`}
                style={{
                  ...fontInlineStyle,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility',
                }}
                title={task.title}
              >
                <span
                  className={`font-mono font-bold text-[14px] sm:text-[15px] mr-1.5 inline-block shrink-0 ${qMeta.textCol}`}
                  title={`Rank ${rankNum} (${qMeta.name})`}
                >
                  {rankNum}
                </span>
                <span className="break-words whitespace-normal">{task.title}</span>
              </span>
            );
          })()}
        </div>

        {/* Right side quick items: Note peek & Subtasks */}
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {/* Note Peek Indicator */}
          {task.notes && task.notes.trim().length > 0 && (
            <div
              className="relative inline-flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                if (isNotePeekOpen) {
                  handleNoteMouseLeave();
                } else {
                  triggerNotePeek(e);
                }
              }}
              onMouseEnter={(e) => triggerNotePeek(e)}
              onMouseLeave={handleNoteMouseLeave}
            >
              <span
                className="inline-flex items-center justify-center p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 shrink-0 shadow-2xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
                title="Has note (hover/click to view)"
              >
                <MessageSquare className="w-2.5 h-2.5 shrink-0" />
              </span>

              {isNotePeekOpen && notePeekState && (
                <div
                  className="note-preview-bubble note-preview-bubble-dynamic"
                  style={{
                    left: `${notePeekState.x}px`,
                    top: `${notePeekState.y}px`,
                    transform: notePeekState.position === 'above' ? 'translateY(-100%)' : 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="leading-normal font-normal">
                    {task.notes}
                  </p>
                  <div
                    className={`absolute pointer-events-none w-0 h-0 border-[5px] border-transparent ${
                      notePeekState.position === 'above'
                        ? 'bottom-[-10px] border-t-slate-700/95 dark:border-t-slate-800/95'
                        : 'top-[-10px] border-b-slate-700/95 dark:border-b-slate-800/95'
                    }`}
                    style={{
                      left: `${notePeekState.arrowOffset}px`,
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Subtasks Count Accordion Badge */}
          {hasSubtasks && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSubtasksExpanded(!isSubtasksExpanded);
              }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 shrink-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
              title={isSubtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              <SubtaskBranchIcon className="w-2.5 h-2.5 text-indigo-500" />
              <span>{completedSubs}/{subtasks.length}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isSubtasksExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Below Task Title: Strictly aligned bottom row starting from yellow highlighted left area under checkbox */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap pl-0.5 pt-0.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Single Compact Date & Reminder Badge */}
          {(() => {
            const dr = getSingleTaskDateReminder(task);
            if (!dr) return null;
            return (
              <span
                className={`h-5 px-1.5 inline-flex items-center gap-1 rounded text-[10px] font-mono font-medium border shrink-0 transition ${
                  dr.isOverdue
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title={`Due: ${dr.display}`}
              >
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{dr.display}</span>
                {dr.isOverdue && <OverdueIcon className="w-3 h-3 shrink-0 ml-0.5" />}
              </span>
            );
          })()}

          {/* 3. Eisenhower Tag Badge */}
          {(() => {
            const qMeta = getQuadrantLabel(task.quadrant);
            return (
              <span
                className={`h-5.5 inline-flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 rounded-md border border-transparent shadow-2xs ${qMeta.badgeBg}`}
                title={`Eisenhower Quadrant: ${qMeta.name}`}
              >
                <span>{qMeta.tag}</span>
              </span>
            );
          })()}
        </div>

        {/* Focus Clock Badge / Icon at the bottom corner of each task card */}
        <div className="shrink-0 flex items-center ml-auto gap-1">
          {(() => {
            const isThisTaskFocused = pomodoro.taskId === task.id;
            const isPomRunning = isThisTaskFocused && pomodoro.isRunning;
            const formattedFocusTimer = isThisTaskFocused
              ? `${Math.floor(pomodoro.timeRemaining / 60)}:${String(pomodoro.timeRemaining % 60).padStart(2, '0')}`
              : null;

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isThisTaskFocused) {
                    if (pomodoro.isRunning) {
                      pausePomodoro();
                      soundEngine?.playClick?.();
                      pushNotification('Focus Paused', `Paused focus timer for "${task.title}".`, 'task');
                    } else {
                      startPomodoro(task.id);
                      soundEngine?.playSuccessChime?.();
                      pushNotification('Focus Resumed', `Resumed focus timer for "${task.title}".`, 'task');
                    }
                  } else {
                    startPomodoro(task.id, 25);
                    soundEngine?.playSuccessChime?.();
                    pushNotification('Focus Started', `Started 25m focus timer for "${task.title}".`, 'task');
                  }
                }}
                className={`h-5.5 inline-flex items-center justify-center rounded-md transition cursor-pointer shrink-0 shadow-2xs ${
                  isPomRunning
                    ? 'px-1.5 gap-1 bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-mono text-[10px] font-bold shadow-rose-500/20'
                    : isThisTaskFocused && pomodoro.timeRemaining > 0
                    ? 'px-1.5 gap-1 bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-mono text-[10px] font-bold shadow-amber-500/20'
                    : 'w-5.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800'
                }`}
                title={
                  isPomRunning
                    ? `Focus Clock Active: ${formattedFocusTimer} (click to pause)`
                    : isThisTaskFocused
                    ? `Focus Clock Paused: ${formattedFocusTimer} (click to resume)`
                    : 'Start 25m Focus Clock'
                }
              >
                <Timer className={`w-3 h-3 shrink-0 ${isPomRunning ? 'animate-pulse text-white' : ''}`} />
                {isThisTaskFocused && <span>{formattedFocusTimer}</span>}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Expandable Subtasks Checklist Accordion */}
      {hasSubtasks && (
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isSubtasksExpanded
              ? 'max-h-[500px] opacity-100 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-1.5 space-y-0.5 border-t border-slate-100/80 dark:border-slate-800/60 rounded-b-lg'
              : 'max-h-0 opacity-0'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {subtasks.map(sub => (
            <div
              key={sub.id}
              className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 py-0.2"
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                animate={subtaskSuccessId === sub.id ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!sub.completed) {
                    setSubtaskSuccessId(sub.id);
                    setTimeout(() => setSubtaskSuccessId(null), 300);
                  }
                  onToggleSubtask?.(task.id, sub.id);
                }}
                className={`w-3 h-3 rounded-xs border flex items-center justify-center transition shrink-0 cursor-pointer ${
                  sub.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500'
                }`}
                title={sub.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {sub.completed && <Check className="w-2 h-2 text-white stroke-[3]" />}
              </motion.button>
              <span
                className={`truncate transition select-none ${
                  sub.completed
                    ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                    : 'text-slate-700 dark:text-slate-300 font-medium'
                }`}
              >
                {sub.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
});
