import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  AlarmClock,
  Sparkles,
  X,
  Check,
  CalendarDays,
  Info,
} from 'lucide-react';
import { ReminderType } from '../../types';
import { parseLocalDate, formatLocalDate, formatOSDate } from '../../utils/date';
import { soundEngine } from '../../utils/audio';

export interface ReminderCalendarItem {
  id: string;
  title: string;
  type: 'medication' | 'task' | 'bill' | 'habit' | 'schedule';
  color?: string;
  reminderType?: ReminderType;
  reminderTiming?: string;
  dueDate?: string; // "YYYY-MM-DD"
  dueTime?: string; // "HH:MM"
  isAllDay?: boolean;
  frequency?: string; // e.g. 'daily' | 'alternate_days' | 'every_3_days' | 'every_4_days' | 'every_5_days' | 'every_6_days' | 'weekly_days' | 'weekly' | 'custom_dates' | 'monthly' | 'yearly' etc.
  customDays?: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  customDateTimes?: Array<{ date: string; time: string; label?: string }>;
  schedules?: Array<{ time: string; label: string }>;
  repeatType?: string;
  repeatUntil?: string;
  startDate?: string;
  endDate?: string;
  reminderDaysBefore?: number;
}

export interface CardReminderCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReminderCalendarItem | null;
}

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_ABBR_MAP: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/**
 * Deterministically checks if a given date (YYYY-MM-DD) matches the item's reminder schedule
 */
export function checkIsReminderDate(
  dateStr: string,
  item: ReminderCalendarItem
): { isReminder: boolean; times: string[]; note?: string } {
  if (!dateStr || !item) return { isReminder: false, times: [] };

  const targetDate = parseLocalDate(dateStr);

  // Check explicit endDate boundary if provided
  if (item.endDate) {
    const endBoundary = parseLocalDate(item.endDate);
    if (targetDate > endBoundary) {
      return { isReminder: false, times: [] };
    }
  }

  const targetDayOfWeek = DAY_ABBR_MAP[targetDate.getDay()];
  const defaultTimes = item.schedules && item.schedules.length > 0
    ? item.schedules.map(s => s.time)
    : item.dueTime
    ? [item.dueTime]
    : ['09:00'];

  // 1. MEDICATION
  if (item.type === 'medication') {
    // Check specific custom dates first
    if (item.customDateTimes && item.customDateTimes.length > 0) {
      const matchCustom = item.customDateTimes.filter(cd => cd.date === dateStr);
      if (matchCustom.length > 0) {
        return {
          isReminder: true,
          times: matchCustom.map(c => c.time),
          note: 'Specific custom scheduled dose',
        };
      }
    }

    const freq = item.frequency || 'daily';
    if (freq === 'daily' || freq === 'twice_daily' || freq === 'thrice_daily') {
      return { isReminder: true, times: defaultTimes, note: 'Daily scheduled dose' };
    }

    if (freq === 'weekly' || freq === 'weekly_days') {
      const activeDays = item.customDays || ['Mon', 'Wed', 'Fri'];
      if (activeDays.includes(targetDayOfWeek)) {
        return { isReminder: true, times: defaultTimes, note: `Weekly dose on ${targetDayOfWeek}` };
      }
      return { isReminder: false, times: [] };
    }

    // Interval days: alternate_days (2), every_3_days (3), every_4_days (4), every_5_days (5), every_6_days (6)
    let step = 1;
    if (freq === 'alternate_days') step = 2;
    else if (freq === 'every_3_days') step = 3;
    else if (freq === 'every_4_days') step = 4;
    else if (freq === 'every_5_days') step = 5;
    else if (freq === 'every_6_days') step = 6;

    if (step > 1) {
      // Reference anchor date
      const anchor = item.startDate ? parseLocalDate(item.startDate) : new Date(2026, 0, 1);
      const diffMs = targetDate.getTime() - anchor.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays % step === 0) {
        return {
          isReminder: true,
          times: defaultTimes,
          note: `Scheduled cadence (Every ${step === 2 ? 'other day' : `${step} days`})`,
        };
      }
    }

    return { isReminder: false, times: [] };
  }

  // 2. TASK
  if (item.type === 'task') {
    if (!item.dueDate) return { isReminder: false, times: [] };

    // Repeat schedule
    const repeat = item.repeatType || 'none';
    if (repeat === 'none') {
      if (item.dueDate === dateStr) {
        return {
          isReminder: true,
          times: item.dueTime ? [item.dueTime] : ['All Day'],
          note: `Task Due Date${item.reminderTiming && item.reminderTiming !== 'none' ? ` (${item.reminderTiming.replace('_', ' ')})` : ''}`,
        };
      }
      return { isReminder: false, times: [] };
    }

    const startDue = parseLocalDate(item.dueDate);
    if (targetDate < startDue) return { isReminder: false, times: [] };

    // Check repeatUntil boundary (date string or duration preset)
    if (item.repeatUntil && item.repeatUntil !== 'forever') {
      if (item.repeatUntil.match(/^\d{4}-\d{2}-\d{2}$/)) {
        if (targetDate > parseLocalDate(item.repeatUntil)) return { isReminder: false, times: [] };
      } else {
        const maxDate = new Date(startDue);
        if (item.repeatUntil === '1_week') maxDate.setDate(maxDate.getDate() + 7);
        else if (item.repeatUntil === '2_weeks') maxDate.setDate(maxDate.getDate() + 14);
        else if (item.repeatUntil === '1_month') maxDate.setMonth(maxDate.getMonth() + 1);
        else if (item.repeatUntil === '3_months') maxDate.setMonth(maxDate.getMonth() + 3);
        else if (item.repeatUntil === '6_months') maxDate.setMonth(maxDate.getMonth() + 6);
        else if (item.repeatUntil === '1_year') maxDate.setFullYear(maxDate.getFullYear() + 1);
        if (targetDate > maxDate) return { isReminder: false, times: [] };
      }
    }

    if (repeat === 'daily') {
      return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Recurring Daily Task' };
    }
    if (repeat === 'weekdays') {
      const day = targetDate.getDay();
      if (day >= 1 && day <= 5) {
        return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Weekday Recurring Task' };
      }
      return { isReminder: false, times: [] };
    }
    if (repeat === 'weekly') {
      if (targetDate.getDay() === startDue.getDay()) {
        return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Weekly Recurring Task' };
      }
      return { isReminder: false, times: [] };
    }
    if (repeat === 'biweekly') {
      const diffDays = Math.round((targetDate.getTime() - startDue.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays % 14 === 0) {
        return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Bi-Weekly Recurring Task' };
      }
      return { isReminder: false, times: [] };
    }
    if (repeat === 'monthly') {
      if (targetDate.getDate() === startDue.getDate()) {
        return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Monthly Recurring Task' };
      }
      return { isReminder: false, times: [] };
    }
    if (repeat === 'yearly') {
      if (targetDate.getDate() === startDue.getDate() && targetDate.getMonth() === startDue.getMonth()) {
        return { isReminder: true, times: item.dueTime ? [item.dueTime] : ['All Day'], note: 'Yearly Recurring Task' };
      }
      return { isReminder: false, times: [] };
    }

    return { isReminder: false, times: [] };
  }

  // 3. BILL
  if (item.type === 'bill') {
    if (!item.dueDate) return { isReminder: false, times: [] };

    const startDue = parseLocalDate(item.dueDate);
    const recurring = item.frequency || 'monthly';

    // Due date match
    const isDueMatch = (() => {
      if (recurring === 'one_time') {
        return item.dueDate === dateStr;
      }
      if (recurring === 'monthly') {
        return targetDate.getDate() === startDue.getDate() && targetDate >= startDue;
      }
      if (recurring === 'yearly') {
        return targetDate.getDate() === startDue.getDate() && targetDate.getMonth() === startDue.getMonth() && targetDate >= startDue;
      }
      if (recurring === 'quarterly') {
        const monthDiff = (targetDate.getFullYear() - startDue.getFullYear()) * 12 + (targetDate.getMonth() - startDue.getMonth());
        return targetDate.getDate() === startDue.getDate() && monthDiff >= 0 && monthDiff % 3 === 0;
      }
      return item.dueDate === dateStr;
    })();

    if (isDueMatch) {
      return { isReminder: true, times: ['Payment Due'], note: 'Bill Due Date' };
    }

    // Reminder days before trigger
    const reminderDays = item.reminderDaysBefore ?? 3;
    if (reminderDays > 0) {
      const reminderTriggerDate = new Date(targetDate);
      reminderTriggerDate.setDate(reminderTriggerDate.getDate() + reminderDays);
      const isTriggerForDue = (() => {
        if (recurring === 'one_time') {
          return formatLocalDate(reminderTriggerDate) === item.dueDate;
        }
        if (recurring === 'monthly') {
          return reminderTriggerDate.getDate() === startDue.getDate() && reminderTriggerDate >= startDue;
        }
        return false;
      })();

      if (isTriggerForDue) {
        return {
          isReminder: true,
          times: [`${reminderDays}d Before`],
          note: `Bill Reminder Trigger (${reminderDays} days prior to due date)`,
        };
      }
    }

    return { isReminder: false, times: [] };
  }

  // 4. HABIT
  if (item.type === 'habit') {
    const freq = item.frequency || 'daily';
    if (freq === 'daily') {
      return { isReminder: true, times: defaultTimes, note: 'Daily habit goal' };
    }
    if (freq === 'weekly' || freq === 'custom') {
      const activeDays = item.customDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      if (activeDays.includes(targetDayOfWeek)) {
        return { isReminder: true, times: defaultTimes, note: `Habit schedule (${targetDayOfWeek})` };
      }
    }
    return { isReminder: false, times: [] };
  }

  return { isReminder: false, times: [] };
}

export const CardReminderCalendarModal: React.FC<CardReminderCalendarModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatLocalDate(new Date()));

  // Reset viewing month to item's due date / today when opened
  React.useEffect(() => {
    if (isOpen && item) {
      if (item.dueDate) {
        const d = parseLocalDate(item.dueDate);
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        setSelectedDateStr(item.dueDate);
      } else {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDateStr(formatLocalDate(now));
      }
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const handlePrevMonth = () => {
    soundEngine?.playClick?.();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    soundEngine?.playClick?.();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleTodayJump = () => {
    soundEngine?.playClick?.();
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(formatLocalDate(now));
  };

  // Calendar grid math
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Days list
  const calendarCells = [];

  // 1. Prev month overflow days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = formatLocalDate(prevDate);
    const { isReminder, times } = checkIsReminderDate(dateStr, item);
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isReminder,
      times,
    });
  }

  // 2. Current month days
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const curDate = new Date(year, month, dayNum);
    const dateStr = formatLocalDate(curDate);
    const { isReminder, times, note } = checkIsReminderDate(dateStr, item);
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: true,
      isReminder,
      times,
      note,
    });
  }

  // 3. Next month overflow days to complete 6 rows (or full rows)
  const totalCellsNeeded = Math.ceil(calendarCells.length / 7) * 7;
  const overflowDays = totalCellsNeeded - calendarCells.length;
  for (let dayNum = 1; dayNum <= overflowDays; dayNum++) {
    const nextDate = new Date(year, month + 1, dayNum);
    const dateStr = formatLocalDate(nextDate);
    const { isReminder, times } = checkIsReminderDate(dateStr, item);
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isReminder,
      times,
    });
  }

  // Count reminder days in current month
  const remindersInMonthCount = calendarCells.filter(c => c.isCurrentMonth && c.isReminder).length;

  // Selected date info
  const selectedInfo = checkIsReminderDate(selectedDateStr, item);
  const selectedDateObj = parseLocalDate(selectedDateStr);
  const formattedSelectedHeader = selectedDateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const accentColor = item.color || '#6366f1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-5 space-y-4 animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-2xs"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {item.title}
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {item.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <Bell className="w-3 h-3 text-amber-500 inline shrink-0" />
                <span>
                  Reminder Calendar &bull; {item.reminderType === 'alarm' ? '🚨 Alarm Chime' : '🔔 Notification'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Navigation Strip */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight">
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={handleTodayJump}
              className="px-2 py-0.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map(day => (
              <span key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDateStr;

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(cell.dateStr);
                    soundEngine?.playClick?.();
                  }}
                  className={`h-9 sm:h-10 rounded-xl flex flex-col items-center justify-center relative text-xs font-semibold transition cursor-pointer border ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 z-10'
                      : ''
                  } ${
                    cell.isReminder
                      ? 'font-bold shadow-2xs'
                      : ''
                  } ${
                    cell.isReminder && cell.isCurrentMonth
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/80'
                      : cell.isCurrentMonth
                      ? 'border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'border-transparent text-slate-300 dark:text-slate-600 opacity-40 hover:opacity-75'
                  }`}
                  style={
                    cell.isReminder && cell.isCurrentMonth && accentColor
                      ? {
                          borderColor: `${accentColor}80`,
                          backgroundColor: `${accentColor}18`,
                          color: accentColor,
                        }
                      : undefined
                  }
                  title={`${cell.dateStr}${cell.isReminder ? ' (Reminder Scheduled)' : ''}`}
                >
                  <span className="leading-none">{cell.dayNum}</span>

                  {/* Reminder active indicator icon/dot */}
                  {cell.isReminder && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: accentColor || '#6366f1' }}
                      />
                    </div>
                  )}

                  {/* Today marker */}
                  {isToday && !cell.isReminder && (
                    <span className="w-1 h-1 rounded-full bg-slate-400 absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Inspector Panel */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
              <span>{formattedSelectedHeader}</span>
            </span>

            {selectedInfo.isReminder ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" />
                Reminder Scheduled
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400">
                No Reminder
              </span>
            )}
          </div>

          {selectedInfo.isReminder ? (
            <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>
                  <strong>Scheduled at:</strong> {selectedInfo.times.join(', ')}
                </span>
              </div>
              {selectedInfo.note && (
                <p className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                  {selectedInfo.note}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10.5px] text-slate-400 italic">
              No reminder is scheduled for this specific date based on current frequency cadence.
            </p>
          )}
        </div>

        {/* Cadence Summary & Month Occurrences */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1 truncate">
            <Info className="w-3 h-3 text-slate-400 shrink-0" />
            <span>
              <strong>{remindersInMonthCount}</strong> reminder date{remindersInMonthCount === 1 ? '' : 's'} in {monthName}
            </span>
          </span>

          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 ml-2">
            Cadence: {item.frequency ? item.frequency.replace(/_/g, ' ') : item.repeatType ? item.repeatType : 'Standard'}
          </span>
        </div>
      </div>
    </div>
  );
};

export interface CardCalendarButtonProps {
  item: ReminderCalendarItem;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

/**
 * Sleek, ultra-compact tiny calendar button for Cards
 * Shows calendar icon with subtle badge if reminder dates are set
 */
export const CardCalendarButton: React.FC<CardCalendarButtonProps> = ({
  item,
  className = '',
  onClick,
  title,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if today or upcoming has a reminder
  const hasReminderSet =
    item.reminderType !== 'none' &&
    (Boolean(item.dueDate) ||
      Boolean(item.schedules && item.schedules.length > 0) ||
      Boolean(item.customDateTimes && item.customDateTimes.length > 0) ||
      Boolean(item.frequency && item.frequency !== 'as_needed'));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else {
      soundEngine?.playClick?.();
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`h-5.5 px-1.5 inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-semibold transition cursor-pointer border shadow-2xs ${
          hasReminderSet
            ? 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80'
        } ${className}`}
        title={title || `View Reminder Calendar for "${item.title}"`}
      >
        <CalendarIcon className="w-3 h-3 shrink-0 text-indigo-500 dark:text-indigo-400" />
        <span className="hidden sm:inline">Cal</span>
        {hasReminderSet && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
        )}
      </button>

      {/* Render calendar modal */}
      {!onClick && (
        <CardReminderCalendarModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          item={item}
        />
      )}
    </>
  );
};
