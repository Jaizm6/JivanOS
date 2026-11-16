import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Flag,
  Star,
  Play,
  CheckSquare,
  Sparkles,
  Tag,
  Flame,
} from 'lucide-react';
import { TaskItem, Priority } from '../../types';

interface TaskTimelineViewProps {
  tasks: TaskItem[];
  onToggleTask: (taskId: string) => void;
  onEditTask: (task: TaskItem) => void;
  onStartPomodoro?: (taskId: string) => void;
  onRescheduleTask?: (taskId: string, newDate: string) => void;
}

export const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({
  tasks,
  onToggleTask,
  onEditTask,
  onStartPomodoro,
  onRescheduleTask,
}) => {
  const [activeGrouping, setActiveGrouping] = useState<'timeframe' | 'project'>('timeframe');
  const todayStr = new Date().toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  // Group tasks by temporal horizon
  const timeframeGroups = useMemo(() => {
    const overdue: TaskItem[] = [];
    const today: TaskItem[] = [];
    const tomorrowTasks: TaskItem[] = [];
    const thisWeek: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const someday: TaskItem[] = [];

    tasks.forEach(t => {
      if (!t.dueDate || t.isSomeday) {
        someday.push(t);
      } else if (!t.completed && t.dueDate < todayStr) {
        overdue.push(t);
      } else if (t.dueDate === todayStr) {
        today.push(t);
      } else if (t.dueDate === tomorrowStr) {
        tomorrowTasks.push(t);
      } else if (t.dueDate > tomorrowStr && t.dueDate <= nextWeekStr) {
        thisWeek.push(t);
      } else {
        upcoming.push(t);
      }
    });

    const groups: {
      id: string;
      title: string;
      subtitle: string;
      color: string;
      badgeColor: string;
      icon: React.ReactNode;
      tasks: TaskItem[];
    }[] = [
      {
        id: 'overdue',
        title: 'Overdue Attention',
        subtitle: 'Tasks needing immediate action',
        color: 'border-rose-500 text-rose-600 dark:text-rose-400',
        badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400',
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
        tasks: overdue,
      },
      {
        id: 'today',
        title: 'Today’s Horizon',
        subtitle: `Commitments for ${todayStr}`,
        color: 'border-indigo-500 text-indigo-600 dark:text-indigo-400',
        badgeColor: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400',
        icon: <Clock className="w-4 h-4 text-indigo-500" />,
        tasks: today,
      },
      {
        id: 'tomorrow',
        title: 'Tomorrow',
        subtitle: `Pre-staged for ${tomorrowStr}`,
        color: 'border-blue-500 text-blue-600 dark:text-blue-400',
        badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
        icon: <Calendar className="w-4 h-4 text-blue-500" />,
        tasks: tomorrowTasks,
      },
      {
        id: 'thisWeek',
        title: 'This Week',
        subtitle: 'Upcoming in next 7 days',
        color: 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
        badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
        icon: <Calendar className="w-4 h-4 text-emerald-500" />,
        tasks: thisWeek,
      },
      {
        id: 'upcoming',
        title: 'Future Roadmap',
        subtitle: 'Planned beyond 7 days',
        color: 'border-purple-500 text-purple-600 dark:text-purple-400',
        badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
        icon: <ArrowRight className="w-4 h-4 text-purple-500" />,
        tasks: upcoming,
      },
      {
        id: 'someday',
        title: 'Someday / Incubator',
        subtitle: 'Backlog without fixed deadlines',
        color: 'border-slate-400 text-slate-600 dark:text-slate-400',
        badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        icon: <Sparkles className="w-4 h-4 text-slate-400" />,
        tasks: someday,
      },
    ];

    return groups.filter(g => g.tasks.length > 0);
  }, [tasks, todayStr, tomorrowStr, nextWeekStr]);

  // Project groups
  const projectGroups = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach(t => {
      const p = t.project || 'General / Inbox';
      if (!map[p]) map[p] = [];
      map[p].push(t);
    });
    return Object.entries(map).map(([projName, projTasks]) => ({
      id: projName,
      title: projName,
      tasks: projTasks,
    }));
  }, [tasks]);

  const priorityMeta: Record<Priority, { text: string; bg: string }> = {
    high: { text: 'text-rose-950 dark:text-rose-200 font-semibold', bg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800' },
    medium: { text: 'text-amber-950 dark:text-amber-200 font-semibold', bg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800' },
    low: { text: 'text-blue-950 dark:text-blue-200 font-semibold', bg: 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800' },
  };

  const handlePushTomorrow = (taskId: string) => {
    if (onRescheduleTask) {
      onRescheduleTask(taskId, tomorrowStr);
    }
  };

  const handlePushWeek = (taskId: string) => {
    if (onRescheduleTask) {
      onRescheduleTask(taskId, nextWeekStr);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Chronological Task Timeline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visual roadmap sequenced by execution horizon and urgency
            </p>
          </div>
        </div>

        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
          <button
            onClick={() => setActiveGrouping('timeframe')}
            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition ${
              activeGrouping === 'timeframe'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            By Horizon
          </button>
          <button
            onClick={() => setActiveGrouping('project')}
            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition ${
              activeGrouping === 'project'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            By Project
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
          <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h4 className="font-bold text-slate-800 dark:text-slate-200">No tasks in this view</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Adjust your filters or add tasks with due dates to see your timeline unfold.
          </p>
        </div>
      ) : activeGrouping === 'timeframe' ? (
        /* Timeframe groups with vertical timeline connectors */
        <div className="space-y-6">
          {timeframeGroups.map((group, groupIdx) => {
            const completedCount = group.tasks.filter(t => t.completed).length;
            const totalCount = group.tasks.length;
            const pct = Math.round((completedCount / totalCount) * 100);

            return (
              <div key={group.id} className="relative">
                {/* Section Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${group.badgeColor}`}>
                      {group.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{group.title}</span>
                        <span className="text-xs font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {totalCount}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">{group.subtitle}</p>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                </div>

                {/* Timeline Items Feed */}
                <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {group.tasks.map(task => {
                    const pMeta = priorityMeta[task.priority] || priorityMeta.medium;
                    const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
                    const subtasksTotal = task.subtasks?.length || 0;

                    return (
                      <div
                        key={task.id}
                        className="relative group flex items-start gap-3"
                      >
                        {/* Timeline Node Icon */}
                        <div
                          onClick={() => onToggleTask(task.id)}
                          className={`absolute -left-6 top-3.5 w-5 h-5 rounded-full border-2 bg-white dark:bg-slate-900 flex items-center justify-center cursor-pointer transition z-10 ${
                            task.completed
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                          }`}
                        >
                          {task.completed && <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                        </div>

                        {/* Task Card */}
                        <div
                          onClick={() => onEditTask(task)}
                          className={`flex-1 p-3.5 rounded-2xl border transition cursor-pointer hover:shadow-md ${
                            task.completed
                              ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${pMeta.bg} ${pMeta.text}`}>
                                  {task.priority}
                                </span>
                                {task.project && (
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                    {task.project}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {task.dueDate} {task.dueTime ? `at ${task.dueTime}` : ''}
                                  </span>
                                )}
                              </div>

                              <h5 className={`font-semibold text-sm mt-1.5 text-slate-900 dark:text-white ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                                {task.title}
                              </h5>

                              {task.notes && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                  {task.notes}
                                </p>
                              )}

                              {/* Subtasks and stats */}
                              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 flex-wrap">
                                {subtasksTotal > 0 && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <CheckSquare className="w-3 h-3 text-indigo-500" />
                                    {subtasksDone}/{subtasksTotal} subtasks
                                  </span>
                                )}
                                {task.estimatedPomodoros > 0 && (
                                  <span className="flex items-center gap-1">
                                    <span>🍅</span>
                                    {task.completedPomodoros}/{task.estimatedPomodoros}
                                  </span>
                                )}
                                {task.isStarred && (
                                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    Starred
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              {onStartPomodoro && !task.completed && (
                                <button
                                  onClick={() => onStartPomodoro(task.id)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition"
                                  title="Start Focus Timer"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onRescheduleTask && !task.completed && (
                                <button
                                  onClick={() => handlePushTomorrow(task.id)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                                  title="Reschedule to Tomorrow"
                                >
                                  +1d
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Project Grouped Timeline */
        <div className="space-y-6">
          {projectGroups.map(group => (
            <div key={group.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center justify-between">
                <span>{group.title}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {group.tasks.length} tasks
                </span>
              </h4>
              <div className="space-y-2">
                {group.tasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t.id);
                        }}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`text-xs font-semibold truncate ${t.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {t.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {t.dueDate || 'No date'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
