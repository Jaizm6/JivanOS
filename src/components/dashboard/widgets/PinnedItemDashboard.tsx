import React, { useState } from 'react';
import { Target, ArrowUpRight, Settings2, Check, Plus, Minus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { IconRenderer } from '../../common/IconRenderer';
import { AnimatedStreakBadge } from '../../common/AnimatedStreakBadge';

export const PinnedItemDashboard: React.FC = () => {
  const { habits, tasks, pinnedSidebarItemId, setPinnedSidebarItemId, setActiveTab, toggleHabitDay, updateHabitCounter, updateTask } = useApp();
  const [showSelector, setShowSelector] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Find pinned habit or task
  const pinnedHabit = habits.find(h => h.id === pinnedSidebarItemId);
  const pinnedTask = tasks.find(t => t.id === pinnedSidebarItemId);

  // If user pinned a task, prioritize task; if user pinned a habit, prioritize habit; otherwise fallback
  const targetHabit = pinnedHabit ? pinnedHabit : !pinnedTask ? (habits[0] || null) : null;
  const targetTask = pinnedTask ? pinnedTask : (!targetHabit && !pinnedHabit ? (tasks[0] || null) : null);

  const isHabit = Boolean(targetHabit);
  const item = targetHabit || targetTask;

  if (!item) {
    return null;
  }

  const habitColor = isHabit ? (targetHabit?.color || '#6366f1') : '#3b82f6';
  const isCompletedToday = isHabit
    ? !!targetHabit?.completionHistory?.[todayStr]
    : Boolean(targetTask?.completed);

  const handleJump = () => {
    if (isHabit && targetHabit) {
      setActiveTab('habits');
      window.dispatchEvent(new CustomEvent('omni-jump-to-habit', { detail: { habitId: targetHabit.id } }));
      setTimeout(() => {
        const el = document.getElementById(`habit-${targetHabit.id}`) || document.querySelector(`[data-habit-id="${targetHabit.id}"]`);
        if (el) {
          el.classList.add('pip-highlight-blink');
          setTimeout(() => el.classList.remove('pip-highlight-blink'), 2000);
        }
      }, 150);
    } else if (targetTask) {
      setActiveTab('tasks');
      setTimeout(() => {
        const el = document.getElementById(`task-${targetTask.id}`);
        if (el) {
          el.classList.add('pip-highlight-blink');
          setTimeout(() => el.classList.remove('pip-highlight-blink'), 2000);
        }
      }, 150);
    }
  };

  return (
    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xs space-y-1.5 select-none transition-all relative">
      <div className="flex items-center justify-between gap-1">
        <div
          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer group"
          onClick={() => setShowFullTitle(!showFullTitle)}
          title={showFullTitle ? 'Click to collapse title' : `Click to show full name: ${(item as any).name || (item as any).title}`}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs shadow-2xs"
            style={{ backgroundColor: `${habitColor}20`, color: habitColor }}
          >
            <IconRenderer icon={isHabit ? targetHabit?.icon : 'check-square'} className="w-3 h-3" fallback="🎯" />
          </div>
          <span
            className={`font-bold text-[11px] text-slate-800 dark:text-zinc-200 tracking-tight transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${
              showFullTitle ? 'whitespace-normal break-words' : 'truncate'
            }`}
          >
            {(item as any).name || (item as any).title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSelector(!showSelector)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition cursor-pointer shadow-2xs"
            title="Reassign to another habit or task"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleJump}
            className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/90 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shadow-2xs"
            title="Jump to item"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action / Status Row */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-zinc-800 text-[10px]">
        {isHabit && targetHabit ? (
          <AnimatedStreakBadge
            streak={targetHabit?.currentStreak || 0}
            isCompleted={isCompletedToday}
            size="xs"
            showZero={true}
          />
        ) : (
          <span className="text-slate-500 font-medium capitalize truncate max-w-[90px]">
            {targetTask?.dueDate || 'Task'}
          </span>
        )}
        {isHabit && targetHabit ? (
          targetHabit.habitType === 'counter' || targetHabit.habitType === 'measurement' ? (
            <div className="flex items-center gap-1.5 font-mono font-bold">
              <button
                type="button"
                onClick={() => (targetHabit.counterValue || 0) > 0 && updateHabitCounter(targetHabit.id, -(targetHabit.incrementStep || 1))}
                disabled={(targetHabit.counterValue || 0) <= 0}
                className="w-5.5 h-5.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-600 flex items-center justify-center font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs transition shadow-2xs"
                title={`Subtract ${targetHabit.incrementStep || 1} ${targetHabit.unit || ''}`}
              >
                -
              </button>
              <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold">
                {targetHabit.counterValue || 0}/{targetHabit.targetCount || 10}
              </span>
              <button
                type="button"
                onClick={() => updateHabitCounter(targetHabit.id, targetHabit.incrementStep || 1)}
                className="w-5.5 h-5.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-black cursor-pointer text-xs transition shadow-2xs"
                title={`Add ${targetHabit.incrementStep || 1} ${targetHabit.unit || ''}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleHabitDay(targetHabit.id, todayStr)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shadow-2xs text-[11px] ${
                isCompletedToday
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700'
              }`}
            >
              {isCompletedToday ? 'Done ✓' : 'Mark Done'}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => targetTask && updateTask({ ...targetTask, completed: !targetTask.completed })}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shadow-2xs text-[11px] ${
              targetTask?.completed
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700'
            }`}
          >
            {targetTask?.completed ? 'Done ✓' : 'Complete'}
          </button>
        )}
      </div>

      {/* Pinned Selector Popover */}
      {showSelector && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 z-50 space-y-1.5 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 uppercase border-b border-slate-100 dark:border-zinc-800 pb-1">
            <span>Reassign Widget</span>
            <button
              type="button"
              onClick={() => setShowSelector(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase px-1">Habits</div>
          {habits.map(h => (
            <div
              key={h.id}
              onClick={() => {
                setPinnedSidebarItemId(h.id);
                setShowSelector(false);
              }}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer truncate transition flex items-center gap-1.5 ${
                (pinnedSidebarItemId === h.id || (!pinnedSidebarItemId && targetHabit?.id === h.id))
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
              }`}
            >
              <span>{h.icon || '🎯'}</span>
              <span className="truncate">{h.name}</span>
            </div>
          ))}
          <div className="text-[9px] font-bold text-slate-400 uppercase px-1 pt-1 border-t border-slate-100 dark:border-zinc-800">Tasks</div>
          {tasks.slice(0, 10).map(t => (
            <div
              key={t.id}
              onClick={() => {
                setPinnedSidebarItemId(t.id);
                setShowSelector(false);
              }}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer truncate transition flex items-center gap-1.5 ${
                pinnedSidebarItemId === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
              }`}
            >
              <span>☑️</span>
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
