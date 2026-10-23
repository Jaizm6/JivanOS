import React from 'react';
import {
  Check,
  Star,
  Clock,
  Calendar,
  RotateCw,
  FileText,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Bell,
  Folder,
  Pencil,
  Flame,
  Play,
} from 'lucide-react';
import { TaskItem, Habit, DEFAULT_TASK_CATEGORIES } from '../../types';
import { formatOSDate, formatLocalDate } from '../../utils/date';
import { getEisenhowerMeta } from '../../utils/eisenhower';
import { IconRenderer } from '../common/IconRenderer';

interface ActivityCardProps {
  activity: TaskItem | Habit;
  type: 'task' | 'habit';
  onToggle: (id: string) => void;
  onOpenDetail?: (activity: TaskItem | Habit) => void;
  onOpenEdit?: (activity: TaskItem | Habit) => void;
  className?: string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  type,
  onToggle,
  onOpenDetail,
  onOpenEdit,
  className = '',
}) => {
  const isTask = type === 'task';
  const task = isTask ? (activity as TaskItem) : null;
  const habit = !isTask ? (activity as Habit) : null;
  
  const name = isTask ? (activity as TaskItem).title : (activity as Habit).name;
  const isCompleted = isTask 
    ? (activity as TaskItem).completed 
    : !!(activity as Habit).completionHistory?.[formatLocalDate(new Date())];

  const eMeta = task ? getEisenhowerMeta(task.priority || task.quadrant) : { indicatorClass: 'bg-slate-300' };
  
  return (
    <div
      onClick={() => onOpenDetail?.(activity)}
      className={`group rounded-xl sm:rounded-2xl border transition-all cursor-pointer p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs ${
        isCompleted
          ? 'bg-slate-50/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60'
          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
      } ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {isTask && <span className={`w-1 h-5.5 rounded-full shrink-0 mt-0.5 ${eMeta.indicatorClass}`} />}
        
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle(activity.id); }}
          className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 cursor-pointer border mt-0.5 ${
            isCompleted
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500'
          }`}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className={`text-xs sm:text-[13px] font-bold tracking-tight leading-snug line-clamp-2 transition ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
            {name}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
             <span className="capitalize">{activity.category}</span>
             {!isTask && (habit as Habit).currentStreak ? (
               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-300/80 dark:border-amber-700/70 bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-mono font-black text-[12px]">
                 <Flame className="w-3 h-3 fill-current text-amber-500" />
                 {(habit as Habit).currentStreak}
                 <span className="text-[11px] font-sans font-bold opacity-85">d</span>
               </span>
             ) : null}
          </div>
        </div>

        <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenEdit?.(activity); }}
            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
        >
            <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
