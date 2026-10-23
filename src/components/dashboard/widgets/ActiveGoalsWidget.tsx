import React from 'react';
import { Target, ArrowRight, CheckCircle2, Check, CheckSquare, Calendar, Clock, PlusCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const ActiveGoalsWidget: React.FC = () => {
  const { goals, tasks, scheduleItems, toggleTask, toggleScheduleItem, setActiveTab } = useApp();

  const activeGoals = goals.filter(g => g.status !== 'completed');

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Active Goals & OKRs</span>
            <span className="text-[9.5px] font-medium font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/50 hidden sm:inline">
              {activeGoals.length} targets
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="mt-3 space-y-3 flex-1 overflow-y-auto max-h-80 pr-0.5">
        {activeGoals.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-indigo-500 mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All Goals Achieved!</p>
            <p className="text-[11px]">Link daily tasks or scheduled events to your objectives</p>
          </div>
        ) : (
          activeGoals.slice(0, 3).map(goal => {
            const linkedTasks = tasks.filter(t => t.goalId === goal.id);
            const linkedEvents = scheduleItems.filter(
              e => e.goalId === goal.id || (e.taskId && linkedTasks.some(t => t.id === e.taskId))
            );

            const totalCount = linkedTasks.length + linkedEvents.length;
            const completedCount =
              linkedTasks.filter(t => t.completed).length + linkedEvents.filter(e => e.completed).length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (goal.progress || 0);

            return (
              <div
                key={goal.id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-2.5 shadow-2xs"
              >
                {/* Header: Title, Category Badge, Progress */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: goal.color || '#6366f1' }}
                    />
                    <span className="font-semibold text-slate-900 dark:text-white truncate text-xs">
                      {goal.title}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                      #{goal.category || (goal.tags && goal.tags[0]) || 'general'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono shrink-0">
                    {progress}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Linked Tasks and Events List */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/70">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>Linked Tasks & Events ({completedCount}/{totalCount})</span>
                    <span className="text-[9.5px] font-mono lowercase">due {goal.targetDate}</span>
                  </div>

                  {totalCount > 0 ? (
                    <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                      {/* Linked Tasks */}
                      {linkedTasks.slice(0, 3).map(task => (
                        <div
                          key={`task-${task.id}`}
                          className="flex items-center justify-between gap-2 text-xs py-0.5 px-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleTask(task.id)}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                task.completed
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                              }`}
                              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <span
                              className={`truncate select-none text-[11px] ${
                                task.completed ? 'line-through text-slate-400 dark:text-slate-500 opacity-60' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[8.5px] font-bold uppercase px-1 py-0.2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                            Task
                          </span>
                        </div>
                      ))}

                      {/* Linked Events */}
                      {linkedEvents.slice(0, 2).map(evt => (
                        <div
                          key={`evt-${evt.id}`}
                          className="flex items-center justify-between gap-2 text-xs py-0.5 px-1.5 rounded-lg bg-amber-50/40 dark:bg-amber-950/30 border border-amber-200/40 dark:border-amber-900/30"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleScheduleItem(evt.id)}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                evt.completed
                                  ? 'bg-amber-600 border-amber-600 text-white'
                                  : 'border-amber-300 dark:border-amber-700 hover:border-amber-600'
                              }`}
                              title={evt.completed ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {evt.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <span
                              className={`truncate select-none text-[11px] ${
                                evt.completed ? 'line-through text-slate-400 dark:text-slate-500 opacity-60' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {evt.title}
                            </span>
                          </div>
                          <span className="text-[8.5px] font-bold uppercase px-1 py-0.2 rounded bg-amber-100/70 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 shrink-0">
                            Event
                          </span>
                        </div>
                      ))}

                      {totalCount > 5 && (
                        <p className="text-[10px] text-slate-400 text-center pt-0.5 font-medium">
                          +{totalCount - 5} more linked item{totalCount - 5 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-1 text-[11px] text-slate-400 italic">
                      <span>No tasks or events linked yet.</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('goals')}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline not-italic text-[10px] cursor-pointer"
                      >
                        + Link Items
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
