import React, { useState } from 'react';
import { Droplets, ArrowUpRight, Plus, Minus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const HydrationDashboard: React.FC = () => {
  const { hydration, habits, setActiveTab, addWater } = useApp();
  const [showFullTitle, setShowFullTitle] = useState(false);

  const pref = (hydration?.preferredUnit || 'ml').toLowerCase();
  const isLitre = ['l', 'litre', 'litres'].includes(pref);
  const isGlasses = ['glasses', 'glass', 'gl'].includes(pref);
  const targetMl = hydration?.targetMl || 3000;
  const todayLogs = hydration?.todayLogs || [];
  const currentTotalMl = Math.max(0, todayLogs.reduce((acc, curr) => acc + (curr.amountMl || 0), 0));
  const achievementPct = Math.max(0, Math.min(100, Math.round((currentTotalMl / targetMl) * 100)));
  const remainingMl = Math.max(0, targetMl - currentTotalMl);

  const currentDisplay = isLitre
    ? `${(currentTotalMl / 1000).toFixed(1).replace(/\.0$/, '')}`
    : isGlasses
      ? `${currentTotalMl % 250 === 0 ? Math.round(currentTotalMl / 250) : (currentTotalMl / 250).toFixed(1).replace(/\.0$/, '')}`
      : `${currentTotalMl}`;

  const targetDisplay = isLitre
    ? `${(targetMl / 1000).toFixed(1).replace(/\.0$/, '')}L`
    : isGlasses
      ? `${Math.round(targetMl / 250)}gl`
      : `${targetMl}ml`;

  const remainingDisplay = isLitre
    ? `${(remainingMl / 1000).toFixed(1).replace(/\.0$/, '')}L left`
    : isGlasses
      ? `${Math.max(0, Math.round(remainingMl / 250))}gl left`
      : `${remainingMl}ml left`;

  const waterHabit =
    habits.find(h => Boolean(h.syncHydration)) ||
    habits.find(h => h.name.toLowerCase().includes('water') || h.name.toLowerCase().includes('hydrat')) ||
    habits.find(h => h.id === 'hab_1') ||
    habits[0];

  const handleJumpToWater = () => {
    setActiveTab('habits');
    const targetId = waterHabit?.id || 'hab_1';
    window.dispatchEvent(new CustomEvent('omni-jump-to-habit', { detail: { habitId: targetId } }));
    setTimeout(() => {
      const el = document.getElementById(`habit-${targetId}`) || document.querySelector(`[data-habit-id="${targetId}"]`);
      if (el) {
        el.classList.add('pip-highlight-blink');
        setTimeout(() => el.classList.remove('pip-highlight-blink'), 2000);
      }
    }, 150);
  };

  const handleQuickAdd = (e: React.MouseEvent, amountMl: number) => {
    e.stopPropagation();
    addWater(amountMl, 'ml');
  };

  return (
    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-2xs space-y-2 select-none transition-all relative">
      {/* Tiny Header with live progress & controls */}
      <div className="flex items-center justify-between gap-1">
        {/* Title container - Clicking toggles showing full name */}
        <div
          className="flex items-center gap-1.5 min-w-0 cursor-pointer flex-1 group"
          onClick={() => setShowFullTitle(!showFullTitle)}
          title={showFullTitle ? 'Click to collapse title' : `Click to show full name: ${waterHabit ? waterHabit.name : 'Drink Water'}`}
        >
          <div className="w-5 h-5 rounded-md bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center shrink-0">
            <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
          </div>
          <span
            className={`font-bold text-[11px] text-slate-800 dark:text-zinc-200 tracking-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors ${
              showFullTitle ? 'whitespace-normal break-words' : 'truncate'
            }`}
          >
            {waterHabit ? waterHabit.name : 'Drink Water'}
          </span>
        </div>

        {/* Action Controls Cluster on Right: '-' then '+' then Jump Arrow */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (currentTotalMl > 0) {
                addWater(-250, 'ml');
              }
            }}
            disabled={currentTotalMl <= 0}
            className={`p-1 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 text-xs font-black active:scale-95 ${
              currentTotalMl <= 0
                ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200/80 dark:border-zinc-700/80'
                : 'bg-cyan-100/80 dark:bg-cyan-900/60 hover:bg-cyan-200 dark:hover:bg-cyan-800 text-cyan-800 dark:text-cyan-200 border-cyan-200/80 dark:border-cyan-700 shadow-2xs'
            }`}
            title={currentTotalMl <= 0 ? 'Minimum reached (0)' : `Subtract -${isLitre ? '0.25L' : isGlasses ? '1 gl' : '250ml'}`}
          >
            <Minus className="w-3 h-3 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={(e) => handleQuickAdd(e, isLitre ? 250 : isGlasses ? 250 : 250)}
            className="p-1 rounded-md bg-cyan-100/80 hover:bg-cyan-200 dark:bg-cyan-900/60 dark:hover:bg-cyan-800 text-cyan-800 dark:text-cyan-200 border border-cyan-200/80 dark:border-cyan-700 transition cursor-pointer shadow-2xs"
            title={`Quick add +${isLitre ? '0.25L' : isGlasses ? '1 gl' : '250ml'}`}
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleJumpToWater}
            className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 transition cursor-pointer border border-cyan-100 dark:border-cyan-900/40"
            title="Jump to Drink Water habit in Tracker"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-500 to-teal-400 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, achievementPct)}%` }}
        />
      </div>

      {/* Visual Metrics Row */}
      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-zinc-400">
        <span className="font-mono">
          <strong className="text-slate-800 dark:text-zinc-200 font-bold">{currentDisplay}</strong>/{targetDisplay}
        </span>
        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50">
          {achievementPct}%
        </span>
        <span className="text-[9px]">
          {achievementPct >= 100 ? (
            <span className="text-teal-600 dark:text-teal-400 font-bold">Goal Met! 💧</span>
          ) : (
            <span>{remainingDisplay}</span>
          )}
        </span>
      </div>
    </div>
  );
};
