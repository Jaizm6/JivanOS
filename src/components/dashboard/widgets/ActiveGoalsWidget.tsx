import React from 'react';
import { Target, ArrowRight, CheckCircle2, Check } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { PetalShapeBadge, getPetalGroupRadiusClass } from '../../common/PetalExpressive';
import { InlineTagMeta } from '../../common/TagVisuals';

export const ActiveGoalsWidget: React.FC = () => {
  const { goals, tasks, habits = [], tags = [], toggleTask, toggleHabitDay, setActiveTab } = useApp();

  const activeGoals = goals.filter(g => !g.archived && g.status !== 'completed');
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full rounded-[24px] bg-white dark:bg-[#09090b] border border-slate-200/85 dark:border-zinc-800 p-4 sm:p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <PetalShapeBadge
            shape="clover"
            sizeClass="w-8 h-8"
            fillColor="rgba(79, 70, 229, 0.14)"
            strokeColor="rgba(79, 70, 229, 0.3)"
          >
            <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </PetalShapeBadge>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <span>Active Goals</span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 tabular-nums">
                · {activeGoals.length} active
              </span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>View All</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="mt-3 space-y-3 flex-1 overflow-y-auto max-h-80 pr-0.5 custom-scrollbar">
        {activeGoals.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-indigo-500 mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">All Goals Achieved!</p>
            <p className="text-[11px]">Link tasks or habits to your milestones</p>
          </div>
        ) : (
          activeGoals.slice(0, 3).map(goal => {
            const seenTaskIds = new Set<string>();
            const linkedTasks = tasks.filter(t => {
              if (t.archived || t.status === 'archived' || t.goalId !== goal.id || seenTaskIds.has(t.id)) return false;
              seenTaskIds.add(t.id);
              return true;
            });

            const seenHabitIds = new Set<string>();
            const linkedHabits = habits.filter(h => {
              if (h.archived || h.goalId !== goal.id || seenHabitIds.has(h.id)) return false;
              seenHabitIds.add(h.id);
              return true;
            });

            const totalCount = linkedTasks.length + linkedHabits.length;
            const completedCount =
              linkedTasks.filter(t => t.completed).length +
              linkedHabits.filter(h => Boolean(h.completionHistory?.[todayStr])).length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (goal.progress || 0);
            const accentColor = goal.accentColor || (goal.color && goal.color !== '#ffffff' ? goal.color : '#4f46e5');
            const primaryTag = (goal.tags && goal.tags[0]) || goal.tag;

            const previewItems = [
              ...linkedTasks.slice(0, 3).map(t => ({ kind: 'task' as const, id: t.id, title: t.title, done: t.completed })),
              ...linkedHabits.slice(0, 2).map(h => ({
                kind: 'habit' as const,
                id: h.id,
                title: h.icon ? `${h.icon} ${h.name}` : h.name,
                done: Boolean(h.completionHistory?.[todayStr]),
              })),
            ];

            return (
              <div
                key={goal.id}
                className="p-3.5 rounded-[20px] bg-[#f4f7fc] dark:bg-[#121217] text-xs space-y-2.5"
              >
                {/* Header: Petal Shape Badge, Title, Unboxed Tag/Date, Tabular Progress */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PetalShapeBadge
                      shape="clover"
                      sizeClass="w-8 h-8"
                      fillColor={`${accentColor}1f`}
                      strokeColor={`${accentColor}40`}
                    >
                      <Target className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    </PetalShapeBadge>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white truncate block text-xs">
                        {goal.title}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-zinc-500">
                        <span className="tabular-nums">Due {goal.targetDate}</span>
                        {primaryTag && (
                          <>
                            <span aria-hidden="true">·</span>
                            <InlineTagMeta tag={primaryTag} appTags={tags} className="text-[10.5px]" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-xs font-extrabold tabular-nums shrink-0"
                    style={{ color: accentColor }}
                  >
                    {progress}%
                  </span>
                </div>

                {/* M3 Thick Tonal Progress Track */}
                <div className="w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${progress}%`, backgroundColor: accentColor }}
                  />
                </div>

                {/* Linked Milestones */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-zinc-400 font-semibold tabular-nums">
                    <span>Milestones ({completedCount}/{totalCount})</span>
                  </div>

                  {totalCount > 0 ? (
                    <div className="space-y-[3px]">
                      {previewItems.map((item, idx) => (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className={`${getPetalGroupRadiusClass(idx, previewItems.length, true)} flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 bg-white dark:bg-[#191921]`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() =>
                                item.kind === 'task' ? toggleTask(item.id) : toggleHabitDay(item.id, todayStr)
                              }
                              className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                item.done
                                  ? item.kind === 'habit'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 text-white'
                                  : item.kind === 'habit'
                                  ? 'bg-[#f4f7fc] dark:bg-zinc-800 ring-1 ring-emerald-400/75 dark:ring-emerald-700 hover:ring-emerald-600'
                                  : 'bg-[#f4f7fc] dark:bg-zinc-800 ring-1 ring-slate-300 dark:ring-zinc-600 hover:ring-indigo-500'
                              }`}
                              title={item.done ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <span
                              className={`truncate select-none text-[11.5px] ${
                                item.done
                                  ? 'line-through text-slate-400 dark:text-zinc-500'
                                  : 'text-slate-800 dark:text-zinc-200 font-medium'
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold shrink-0 ${
                              item.kind === 'habit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-indigo-500 dark:text-indigo-400'
                            }`}
                          >
                            {item.kind === 'habit' ? 'Habit' : 'Task'}
                          </span>
                        </div>
                      ))}

                      {totalCount > 5 && (
                        <p className="text-[10.5px] text-slate-400 text-center pt-1 font-medium tabular-nums">
                          +{totalCount - 5} more item{totalCount - 5 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-1 text-[11px] text-slate-400">
                      <span>No tasks or habits linked yet</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('goals')}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[10.5px] cursor-pointer"
                      >
                        + Link Milestone
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
