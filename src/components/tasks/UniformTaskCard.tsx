import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Bell,
  Repeat,
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
import { SmoothCollapse } from '../common/PetalExpressive';

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
        ? 'bg-rose-500 border-[2px] border-rose-500 text-white shadow-2xs'
        : 'border-[2px] border-rose-500 dark:border-rose-400 bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-100/60 hover:scale-105';
    }
    if (qStr === 'not_urgent_important' || qStr === 'not-urgent-important' || (!task.quadrant && (task.priority === 'medium' || (task.priority as string) === 'p2'))) {
      return isDone
        ? 'bg-amber-500 border-[2px] border-amber-500 text-white shadow-2xs'
        : 'border-[2px] border-amber-500 dark:border-amber-400 bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-100/60 hover:scale-105';
    }
    if (qStr === 'urgent_not_important' || qStr === 'urgent-not-important') {
      return isDone
        ? 'bg-blue-500 border-[2px] border-blue-500 text-white shadow-2xs'
        : 'border-[2px] border-blue-500 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-100/60 hover:scale-105';
    }
    return isDone
      ? 'bg-violet-500 border-[2px] border-violet-500 text-white shadow-2xs'
      : 'border-[2px] border-violet-500 dark:border-violet-400 bg-violet-50/40 dark:bg-violet-950/30 hover:bg-violet-100/60 hover:scale-105';
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
      className={`relative group select-none transition-all w-full min-w-0 ${
        isCompact
          ? 'px-2.5 py-1.5 min-h-[34px] hover:bg-slate-50/80 dark:hover:bg-slate-800/50 flex flex-col justify-center'
          : 'rounded-xl border px-3 py-2 flex flex-col justify-between gap-1 shadow-2xs hover:shadow-xs bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
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
      <div className="flex items-start gap-2.5 min-w-0 w-full">
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

        {/* Task Title + Unified Bottom Metadata Line */}
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
            const fontSizeClass = task.fontSize ? getFontSizeClass(task.fontSize) : 'text-[13.5px] sm:text-[14px]';
            const fontTypeClass = getFontTypeClass(task.fontType);

            const hasAlarmSet = Boolean(
              task.dueTime ||
                (task.alerts && task.alerts.length > 0) ||
                (task.reminderType && task.reminderType !== 'none') ||
                (task.dateSchedules &&
                  task.dateSchedules.some(ds => ds.dueTime || (ds.alerts && ds.alerts.length > 0)))
            );
            const hasRepeatSet = Boolean(
              (task.recurring && task.recurring !== 'none') ||
                (task.repeatType && task.repeatType !== 'none')
            );
            const allSubsDone = hasSubtasks && completedSubs === subtasks.length;

            const formatCompactTime12h = (tStr?: string) => {
              if (!tStr) return '';
              const [hS, mS] = tStr.split(':');
              const h = parseInt(hS, 10);
              if (isNaN(h)) return tStr;
              const period = h >= 12 ? 'pm' : 'am';
              const h12 = h % 12 === 0 ? 12 : h % 12;
              return `${h12}:${mS || '00'}${period}`;
            };

            const getBottomDateTimeDisplay = (): {
              label: string;
              tone: 'overdue' | 'today' | 'upcoming';
            } | null => {
              const time12 = formatCompactTime12h(task.dueTime);
              if (!task.dueDate) {
                return time12 ? { label: time12, tone: 'today' } : null;
              }
              if (task.dueDate === todayStr) {
                if (task.dueTime) {
                  const now = new Date();
                  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  const isOverdueTime = !task.completed && task.dueTime < nowHm;
                  return {
                    label: `Today, ${time12}`,
                    tone: isOverdueTime ? 'overdue' : 'today',
                  };
                }
                return { label: 'Today', tone: 'today' };
              }
              const [, m, d] = task.dueDate.split('-').map(Number);
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const shortDate = `${d} ${months[(m || 1) - 1] || ''}`;
              return {
                label: time12 ? `${shortDate}, ${time12}` : shortDate,
                tone: task.dueDate < todayStr ? 'overdue' : 'upcoming',
              };
            };

            const bottomDateTime = getBottomDateTimeDisplay();
            const hasBottomMetaLine = Boolean(
              bottomDateTime || hasAlarmSet || hasRepeatSet || hasSubtasks
            );

            return (
              <>
                <span
                  className={`block w-full ${fontSizeClass} ${fontTypeClass} font-medium break-words whitespace-normal leading-[19px] transition ${
                    !isSubtasksExpanded ? 'line-clamp-2' : ''
                  } ${
                    task.completed ? 'line-through text-slate-400 dark:text-slate-500 opacity-75' : task.fontColor ? '' : 'text-slate-800 dark:text-slate-100'
                  }`}
                  style={{
                    ...fontInlineStyle,
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                  }}
                  title={task.title}
                >
                  {task.title}
                </span>

                {hasBottomMetaLine && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] leading-[15px] font-sans">
                    {bottomDateTime && (
                      <span
                        className={`whitespace-nowrap shrink-0 leading-[15px] ${
                          task.completed
                            ? 'text-slate-400 dark:text-slate-500'
                            : bottomDateTime.tone === 'overdue'
                            ? 'text-rose-500 dark:text-rose-400 font-medium'
                            : bottomDateTime.tone === 'today'
                            ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400 font-normal'
                        }`}
                      >
                        {bottomDateTime.label}
                      </span>
                    )}

                    {(hasAlarmSet || hasRepeatSet) && (
                      <span
                        className={`inline-flex items-center gap-1 h-[15px] shrink-0 ${
                          task.completed
                            ? 'text-slate-400 dark:text-slate-500'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {hasAlarmSet && (
                          <Bell
                            className={`w-[12px] h-[12px] stroke-[2.2] shrink-0 ${
                              !task.completed && bottomDateTime?.tone === 'overdue'
                                ? 'text-rose-500 dark:text-rose-400'
                                : ''
                            }`}
                          />
                        )}
                        {hasRepeatSet && (
                          <Repeat className="w-[12px] h-[12px] stroke-[2.2] shrink-0" />
                        )}
                      </span>
                    )}

                    {hasSubtasks && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSubtasksExpanded(!isSubtasksExpanded);
                        }}
                        className={`inline-flex items-center gap-1 h-[15px] text-[11px] leading-[15px] font-sans transition-colors shrink-0 cursor-pointer ${
                          task.completed
                            ? 'text-slate-400 dark:text-slate-500'
                            : allSubsDone
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-normal'
                        }`}
                        title={`Subtasks: ${completedSubs}/${subtasks.length} completed`}
                      >
                        <SubtaskBranchIcon className="w-[12.5px] h-[12.5px] shrink-0" />
                        <span className="tabular-nums leading-[15px]">{completedSubs}/{subtasks.length}</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Right side quick items: Active Timer & Expand Chevron */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400 h-[19px]">
          {(() => {
            const isThisTaskFocused = pomodoro.taskId === task.id;
            const isPomRunning = isThisTaskFocused && pomodoro.isRunning;
            if (!isPomRunning) return null;
            const formattedFocusTimer = `${Math.floor(pomodoro.timeRemaining / 60)}:${String(pomodoro.timeRemaining % 60).padStart(2, '0')}`;
            return (
              <span className="h-[18px] px-1.5 inline-flex items-center gap-1 rounded-full bg-rose-500 text-white text-[9.5px] font-sans font-bold animate-pulse shadow-2xs shrink-0">
                <Timer className="w-2.5 h-2.5 text-white" />
                <span>{formattedFocusTimer}</span>
              </span>
            );
          })()}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSubtasksExpanded(!isSubtasksExpanded);
            }}
            className={`w-[20px] h-[20px] inline-flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer ${
              isSubtasksExpanded
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title={isSubtasksExpanded ? 'Hide details' : 'Show subtasks & actions'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSubtasksExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expandable Progressive-Disclosure Drawer: Subtasks, Notes, Due Date, Quadrant & Focus Timer */}
      <SmoothCollapse
        isOpen={isSubtasksExpanded}
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-2">
          <div className="bg-slate-50/90 dark:bg-zinc-900/60 px-2.5 py-2 space-y-2 border-t border-slate-100 dark:border-zinc-800/80 rounded-xl">
            {/* Subtasks list */}
            {hasSubtasks && (
              <div className="space-y-0.5">
                {subtasks.map(sub => (
                  <button
                    type="button"
                    key={sub.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!sub.completed) {
                        setSubtaskSuccessId(sub.id);
                        setTimeout(() => setSubtaskSuccessId(null), 250);
                      }
                      onToggleSubtask?.(task.id, sub.id);
                    }}
                    className="w-full flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 py-1 px-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 transition-colors cursor-pointer text-left group/sub"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center transition-colors shrink-0 ${
                        sub.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover/sub:border-indigo-500'
                      }`}
                    >
                      {sub.completed && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </span>
                    <span
                      className={`flex-1 min-w-0 break-words leading-snug transition-colors ${
                        sub.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200 font-medium'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Notes Preview */}
            {task.notes && task.notes.trim().length > 0 && (
              <div className="py-1 px-2.5 rounded-r-lg rounded-l-xs border-l-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 text-[10.5px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 shrink-0 text-amber-500 mt-0.5" />
                <span className="line-clamp-2 flex-1 min-w-0 font-normal">{task.notes}</span>
              </div>
            )}

            {/* Secondary Metadata & Quick Actions Strip */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-zinc-800/70 text-[10.5px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {/* Eisenhower Quadrant Chip */}
                {(() => {
                  const qMeta = getQuadrantLabel(task.quadrant);
                  return (
                    <span
                      className={`px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] bg-white dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 ${qMeta.textCol}`}
                      title={`Eisenhower Quadrant: ${qMeta.name}`}
                    >
                      {qMeta.tag}
                    </span>
                  );
                })()}

                {/* Due Date & Reminder */}
                {(() => {
                  const dr = getSingleTaskDateReminder(task);
                  if (!dr) return null;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 font-medium ${
                        dr.isOverdue
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                      title={`Due: ${dr.display}`}
                    >
                      <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
                      <span>
                        {task.dueDate
                          ? `${formatOSDate(task.dueDate, 'DDMonthYYYY')}${task.dueTime ? `, ${task.dueTime}` : ''}`
                          : dr.display}
                      </span>
                    </span>
                  );
                })()}
              </div>

                  {/* Right: Calendar Reminder & Focus Timer */}
                  <div className="shrink-0 flex items-center ml-auto gap-1">
                    <CardCalendarButton
                      item={{
                        id: task.id,
                        title: task.title,
                        type: 'task',
                        dueDate: task.dueDate,
                        dueTime: task.dueTime,
                        isAllDay: task.isAllDay,
                        repeatType: task.repeatType || task.recurring,
                        repeatUntil: task.repeatUntil,
                        reminderType: task.reminderType || (task.dueDate ? 'notification' : 'none'),
                        reminderTiming: task.reminderTiming,
                      }}
                    />
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
                              ? 'px-1.5 gap-1 bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-mono text-[10px] font-bold'
                              : isThisTaskFocused && pomodoro.timeRemaining > 0
                              ? 'px-1.5 gap-1 bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-mono text-[10px] font-bold'
                              : 'px-1.5 gap-1 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 border border-slate-200 dark:border-zinc-700'
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
                          <span>{isThisTaskFocused ? formattedFocusTimer : 'Focus'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
      </SmoothCollapse>
    </motion.div>
  );
});
