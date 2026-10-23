import React from 'react';
import { Check, Flame, Bell, Clock, RotateCw, Pill, CheckSquare, Target, ReceiptText, Calendar } from 'lucide-react';

export interface CompactActionItemProps {
  id: string;
  type: 'habit' | 'task' | 'medication' | 'bill' | 'schedule';
  title: string;
  subtitle?: string;
  time?: string;
  isRecurring?: boolean;
  points?: number;
  completed: boolean;
  color?: string; // hex or tailwind bg
  icon?: React.ReactNode;
  notes?: string;
  onToggle: () => void;
  onClickDetails?: () => void;
  className?: string;
}

export const CompactActionItemCard: React.FC<CompactActionItemProps> = ({
  id,
  type,
  title,
  subtitle,
  time,
  isRecurring = false,
  points,
  completed,
  color,
  icon,
  notes,
  onToggle,
  onClickDetails,
  className = '',
}) => {
  // Config per type
  const typeConfig = {
    habit: {
      label: points ? `Habit | ${points}P` : 'Habit',
      badgeStyle: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      iconBg: 'bg-emerald-600',
      defaultIcon: <Flame className="w-4 h-4 text-white" />,
    },
    task: {
      label: points ? `Task | ${points}P` : 'Task',
      badgeStyle: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      iconBg: 'bg-rose-600',
      defaultIcon: <CheckSquare className="w-4 h-4 text-white" />,
    },
    medication: {
      label: 'Medication',
      badgeStyle: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      iconBg: 'bg-purple-600',
      defaultIcon: <Pill className="w-4 h-4 text-white" />,
    },
    bill: {
      label: 'Bill',
      badgeStyle: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      iconBg: 'bg-amber-600',
      defaultIcon: <ReceiptText className="w-4 h-4 text-white" />,
    },
    schedule: {
      label: 'Event',
      badgeStyle: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      iconBg: 'bg-indigo-600',
      defaultIcon: <Calendar className="w-4 h-4 text-white" />,
    },
  }[type];

  return (
    <div
      onClick={onClickDetails}
      className={`group relative flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-2xs ${
        completed ? 'opacity-70 bg-slate-50/60 dark:bg-zinc-900/50' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
        {/* Left Colorful Icon Box */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${typeConfig.iconBg}`}
          style={color ? { backgroundColor: color } : undefined}
        >
          {icon || typeConfig.defaultIcon}
        </div>

        {/* Middle Details & Badges */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white transition ${
                completed ? 'line-through text-slate-400 dark:text-zinc-500' : ''
              }`}
              title={title}
            >
              {title}
            </h4>
            {subtitle && (
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate hidden sm:inline">
                {subtitle}
              </span>
            )}
          </div>

          {/* Unified Compact Badges Row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
            {/* Type & Points Badge */}
            <span
              className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md border tracking-tight shrink-0 ${typeConfig.badgeStyle}`}
            >
              {typeConfig.label}
            </span>

            {/* Time & Alarm Badge */}
            {time && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60 shrink-0">
                {isRecurring && <RotateCw className="w-2.5 h-2.5 text-indigo-500" />}
                <Bell className="w-2.5 h-2.5 text-amber-500" />
                <span>{time}</span>
              </span>
            )}

            {/* Completed Badge Indicator */}
            {completed && (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 shrink-0">
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Completion Toggle Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition shrink-0 cursor-pointer ${
          completed
            ? 'bg-rose-600 border-rose-600 text-white shadow-xs scale-102'
            : 'border-slate-300 dark:border-zinc-700 hover:border-rose-500 hover:bg-rose-500/10'
        }`}
        title={completed ? 'Mark pending' : 'Mark completed'}
      >
        {completed ? (
          <Check className="w-4 h-4 stroke-[3]" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-600 group-hover:bg-rose-500 transition" />
        )}
      </button>
    </div>
  );
};
