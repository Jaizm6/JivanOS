import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Circle,
  Flag,
  Calendar as CalendarIcon,
  Star,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { TaskItem, Priority } from '../../types';
import { formatLocalDate, toDateString } from '../../utils/date';
import { formatDDMMYYYY } from '../../utils/dateFormats';

interface TaskCalendarViewProps {
  tasks: TaskItem[];
  onToggleTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onAddTaskAtDate: (dateStr: string) => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  onToggleTask,
  onEditTask,
  onAddTaskAtDate,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(formatLocalDate());
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const todayStr = formatLocalDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(todayStr);
  };

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach(t => {
      const d = t.dueDate || 'no-date';
      if (!map[d]) map[d] = [];
      map[d].push(t);
    });
    return map;
  }, [tasks]);

  // Priority styling
  const priorityMeta: Record<Priority, { text: string; bg: string; dot: string }> = {
    high: { text: 'text-rose-950 dark:text-rose-200 font-semibold', bg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800', dot: 'bg-rose-600' },
    medium: { text: 'text-amber-950 dark:text-amber-200 font-semibold', bg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800', dot: 'bg-amber-600' },
    low: { text: 'text-blue-950 dark:text-blue-200 font-semibold', bg: 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800', dot: 'bg-blue-600' },
  };

  // Build grid days for Month View
  const monthGridDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month tail days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = toDateString(prevYear, prevMonth, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateString(year, month, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Next month starting days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = toDateString(nextYear, nextMonth, d);
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Week View Days
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const dayOfWeek = curr.getDay(); // First day is Sunday
    const startOfWeek = new Date(y, m - 1, d - dayOfWeek);
    const days: { dateStr: string; dayNum: number; dayName: string }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const iterDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
      const dateStr = formatLocalDate(iterDate);
      days.push({
        dateStr,
        dayNum: iterDate.getDate(),
        dayName: dayNames[i],
      });
    }
    return days;
  }, [selectedDay]);

  // Selected Day Tasks
  const selectedDayTasks = tasksByDate[selectedDay] || [];

  return (
    <div className="space-y-4">
      {/* Calendar Header Bar */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-500" />
            <span>{monthNames[month]} {year}</span>
          </h3>
        </div>

        {/* View mode toggle & Quick add */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setCalendarMode('month')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition ${
                calendarMode === 'month'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarMode('week')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition ${
                calendarMode === 'week'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Week
            </button>
          </div>

          <button
            onClick={() => onAddTaskAtDate(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add on {selectedDay === todayStr ? 'Today' : formatDDMMYYYY(selectedDay)}</span>
          </button>
        </div>
      </div>

      {calendarMode === 'month' ? (
        /* Month Grid */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 py-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/60">
            {monthGridDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const dayTasks = tasksByDate[dateStr] || [];
              const pendingCount = dayTasks.filter(t => !t.completed).length;
              const completedCount = dayTasks.filter(t => t.completed).length;

              return (
                <div
                  key={`task-grid-${dateStr}-${idx}`}
                  onClick={() => setSelectedDay(dateStr)}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 transition flex flex-col group cursor-pointer ${
                    !isCurrentMonth
                      ? 'bg-slate-50/40 dark:bg-slate-950/20 text-slate-400 dark:text-slate-600'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  } ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20 dark:bg-indigo-950/20'
                      : ''
                  }`}
                >
                  {/* Day number & count */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                        isToday
                          ? 'bg-indigo-600 text-white font-bold'
                          : isSelected
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold'
                          : isCurrentMonth
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Quick Add icon on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTaskAtDate(dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      title="Add task for this day"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Day Task Pills (Max 3 visible, then "+X more") */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {dayTasks.slice(0, 3).map(task => {
                      const pMeta = priorityMeta[task.priority] || priorityMeta.medium;
                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTask(task);
                          }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] truncate border font-medium transition cursor-pointer hover:shadow-xs ${
                            task.completed
                              ? 'line-through opacity-60 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-transparent'
                              : `${pMeta.bg} ${pMeta.text}`
                          }`}
                          title={`${task.title} (${task.priority})`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task.id);
                            }}
                            className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            ) : (
                              <Circle className="w-2.5 h-2.5" />
                            )}
                          </button>
                          <span className="truncate flex-1">{task.title}</span>
                          {task.isStarred && <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />}
                        </div>
                      );
                    })}

                    {dayTasks.length > 3 && (
                      <div className="mt-0.5">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60 inline-block shadow-2xs transition">
                          +{dayTasks.length - 3} more
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week View */
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDays.map(({ dateStr, dayNum, dayName }, idx) => {
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const dayTasks = tasksByDate[dateStr] || [];

            return (
              <div
                key={`task-week-${dateStr}-${idx}`}
                onClick={() => setSelectedDay(dateStr)}
                className={`p-3 rounded-2xl border transition flex flex-col min-h-[220px] cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{dayName}</span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <span>{dayNum}</span>
                      {isToday && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                          Today
                        </span>
                      )}
                    </h4>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTaskAtDate(dateStr);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[300px] no-scrollbar">
                  {dayTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic py-6">
                      No tasks
                    </div>
                  ) : (
                    dayTasks.map(t => (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(t);
                        }}
                        className={`p-2 rounded-xl border text-xs transition ${
                          t.completed
                            ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-100 dark:border-slate-800 line-through'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(t.id);
                            }}
                            className="mt-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                          >
                            {t.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Circle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-semibold leading-snug line-clamp-2 flex-1">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                          <span className="font-bold text-rose-500">{t.priority}</span>
                          {t.project && <span>• {t.project}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Day Agenda Drawer Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              Tasks for {selectedDay === todayStr ? 'Today' : formatDDMMYYYY(selectedDay)}
            </h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
              {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={() => onAddTaskAtDate(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        {selectedDayTasks.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            <CalendarIcon className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p>No tasks scheduled for this day.</p>
            <button
              onClick={() => onAddTaskAtDate(selectedDay)}
              className="mt-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              + Create task for {formatDDMMYYYY(selectedDay)}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {selectedDayTasks.map(task => {
              const pMeta = priorityMeta[task.priority] || priorityMeta.medium;
              return (
                <div
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className={`p-3 rounded-xl border transition flex items-start justify-between gap-2.5 cursor-pointer hover:shadow-xs ${
                    task.completed
                      ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-800 opacity-60'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTask(task.id);
                      }}
                      className="mt-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h5 className={`text-xs font-semibold text-slate-900 dark:text-white break-words whitespace-normal leading-snug ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                        {task.title}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 flex-wrap">
                        <span className={`px-1.5 py-0.2 rounded-md font-bold uppercase ${pMeta.bg} ${pMeta.text}`}>
                          {task.priority}
                        </span>
                        {task.dueTime && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {task.dueTime}
                          </span>
                        )}
                        {task.project && <span>• {task.project}</span>}
                      </div>
                    </div>
                  </div>
                  {task.isStarred && (
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
