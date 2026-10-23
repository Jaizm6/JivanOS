import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Droplets,
  Clock,
  Plus,
  CheckCircle2,
  GlassWater,
  Settings2,
  Bell,
  BellOff,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const HydrationProgressWidget: React.FC = () => {
  const {
    hydration,
    addWater,
    setHydrationTarget,
    setHydrationPreferredUnit,
    toggleWaterReminder,
    toggleAdaptiveWaterReminder,
    sendAdaptiveHydrationNotification,
  } = useApp();

  const pref = (hydration?.preferredUnit || 'ml').toLowerCase();
  const isLitre = ['l', 'litre', 'litres'].includes(pref);
  const isGlasses = ['glasses', 'glass', 'gl'].includes(pref);
  const isMl = !isLitre && !isGlasses;

  const targetMl = hydration?.targetMl || 3000;
  const todayLogs = hydration?.todayLogs || [];
  const currentTotalMl = Math.max(0, todayLogs.reduce((acc, curr) => acc + (curr.amountMl || 0), 0));
  const achievementPct = Math.max(0, Math.min(100, Math.round((currentTotalMl / targetMl) * 100)));
  const remainingMl = Math.max(0, targetMl - currentTotalMl);

  const currentGlassesNum = currentTotalMl % 250 === 0
    ? Math.round(currentTotalMl / 250)
    : Math.round((currentTotalMl / 250) * 10) / 10;
  const targetGlassesNum = Math.round(targetMl / 250);
  const remainingGlassesNum = Math.max(0, Math.round(remainingMl / 250));

  const [showSettings, setShowSettings] = useState(false);
  const [goalUnit, setGoalUnit] = useState<'litres' | 'ml' | 'glasses'>(
    isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml'
  );
  const [customTarget, setCustomTarget] = useState(() => {
    if (isLitre) return (targetMl / 1000).toFixed(1).replace(/\.0$/, '');
    if (isGlasses) return targetGlassesNum.toString();
    return targetMl.toString();
  });
  const [testSent, setTestSent] = useState(false);

  React.useEffect(() => {
    const currentGoalUnit = isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml';
    setGoalUnit(currentGoalUnit);
    if (currentGoalUnit === 'litres') {
      setCustomTarget((targetMl / 1000).toFixed(1).replace(/\.0$/, ''));
    } else if (currentGoalUnit === 'glasses') {
      setCustomTarget(Math.round(targetMl / 250).toString());
    } else {
      setCustomTarget(targetMl.toString());
    }
  }, [targetMl, hydration.preferredUnit, isLitre, isGlasses]);

  const displayTarget = isLitre
    ? `${(targetMl / 1000).toFixed(1).replace(/\.0$/, '')} L`
    : isGlasses
      ? `${targetGlassesNum} glasses`
      : `${targetMl} ml`;

  const displayCurrent = isLitre
    ? `${(currentTotalMl / 1000).toFixed(1).replace(/\.0$/, '')} L`
    : isGlasses
      ? `${currentGlassesNum} glasses`
      : `${currentTotalMl} ml`;

  const displayRemaining = isLitre
    ? `${(remainingMl / 1000).toFixed(1).replace(/\.0$/, '')} L`
    : isGlasses
      ? `${remainingGlassesNum} glasses`
      : `${remainingMl} ml`;

  // Compute adaptive pace status throughout active hours (07:30 to 22:00)
  const paceStatus = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (achievementPct >= 100) {
      return { status: 'achieved', label: 'Goal Completed! 🎉', color: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800' };
    }
    if (currentHour < 7.5 || currentHour > 22) {
      return { status: 'rest', label: 'Sleep Window Protected', color: 'text-slate-500', badge: 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' };
    }
    const dayFraction = (currentHour - 7.5) / 14.5;
    const expectedMl = targetMl * dayFraction;
    const deficit = expectedMl - currentTotalMl;

    if (deficit > 300) {
      const deficitDisplay = isLitre ? `${(deficit / 1000).toFixed(1)}L` : `${Math.round(deficit)}ml`;
      return { status: 'behind', label: `Falling Behind Pace (~${deficitDisplay} needed)`, color: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' };
    }
    if (deficit < -250) {
      return { status: 'ahead', label: 'Ahead of Pace 💧', color: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' };
    }
    return { status: 'on_track', label: 'On Track with Daily Target 💧', color: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' };
  }, [currentTotalMl, targetMl, achievementPct, isLitre]);

  // Group today's logs by hour buckets (06:00 to 23:00)
  const chartData = useMemo(() => {
    const hoursMap: Record<string, number> = {
      '06:00': 0,
      '08:00': 0,
      '10:00': 0,
      '12:00': 0,
      '14:00': 0,
      '16:00': 0,
      '18:00': 0,
      '20:00': 0,
      '22:00': 0,
    };

    todayLogs.forEach(log => {
      if (!log.timestamp) return;
      const hourNum = parseInt(log.timestamp.split(':')[0], 10);
      if (isNaN(hourNum)) return;

      if (hourNum < 7) hoursMap['06:00'] += log.amountMl;
      else if (hourNum < 9) hoursMap['08:00'] += log.amountMl;
      else if (hourNum < 11) hoursMap['10:00'] += log.amountMl;
      else if (hourNum < 13) hoursMap['12:00'] += log.amountMl;
      else if (hourNum < 15) hoursMap['14:00'] += log.amountMl;
      else if (hourNum < 17) hoursMap['16:00'] += log.amountMl;
      else if (hourNum < 19) hoursMap['18:00'] += log.amountMl;
      else if (hourNum < 21) hoursMap['20:00'] += log.amountMl;
      else hoursMap['22:00'] += log.amountMl;
    });

    return Object.entries(hoursMap).map(([hour, ml]) => ({
      hour,
      ml,
      glasses: (ml / 250).toFixed(1),
    }));
  }, [todayLogs]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customTarget);
    if (isNaN(val) || val <= 0) return;
    const valInMl = goalUnit === 'litres' ? Math.round(val * 1000) : Math.round(val);
    if (valInMl >= 250) {
      setHydrationTarget(valInMl, goalUnit);
      setShowSettings(false);
    }
  };

  const handleSendTestNotification = () => {
    sendAdaptiveHydrationNotification(true);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-2.5 rounded-xl bg-slate-900/95 dark:bg-slate-900/95 text-white border border-cyan-500/40 shadow-xl text-xs space-y-1 backdrop-blur-md">
          <p className="font-bold text-cyan-400 font-mono">{label} Window</p>
          <div className="flex items-center gap-1.5 text-slate-200">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold font-mono">
              {isLitre ? `${(data.ml / 1000).toFixed(2)} L` : `${data.ml} ml`}
            </span>
            <span className="text-slate-400 text-[10px]">({data.glasses} glasses)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-2xl bg-cyan-50 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
              Visual Hydration Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consumption trends vs. {displayTarget} goal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            {achievementPct}%
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Hydration Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Adaptive Pace Live Badge */}
      <div className={`px-3 py-2 rounded-2xl border flex items-center justify-between text-xs ${paceStatus.badge}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className={`font-bold truncate ${paceStatus.color}`}>
            {paceStatus.label}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSendTestNotification}
          className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:underline flex items-center gap-1 shrink-0 cursor-pointer ml-2"
        >
          <Zap className="w-3 h-3" />
          <span>{testSent ? 'Smart Alert Sent! 💧' : 'Test Smart Nudge'}</span>
        </button>
      </div>

      {showSettings ? (
        <form onSubmit={handleSaveSettings} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-3 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Goal Unit:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoalUnit('litres')}
                  className={`py-1.5 rounded-xl font-bold text-xs border cursor-pointer ${
                    goalUnit === 'litres'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  🚰 Litres (L)
                </button>
                <button
                  type="button"
                  onClick={() => setGoalUnit('ml')}
                  className={`py-1.5 rounded-xl font-bold text-xs border cursor-pointer ${
                    goalUnit === 'ml'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  💧 Millilitres (ml)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Hydration Goal ({goalUnit === 'litres' ? 'L' : 'ml'}):
                </label>
                <input
                  type="number"
                  step={goalUnit === 'litres' ? '0.1' : '100'}
                  value={customTarget}
                  onChange={e => setCustomTarget(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs font-mono"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Intelligent Reminders:
                </label>
                <button
                  type="button"
                  onClick={() => toggleAdaptiveWaterReminder(!hydration.adaptiveRemindersEnabled)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    hydration.adaptiveRemindersEnabled
                      ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Adaptive Reminders: {hydration.adaptiveRemindersEnabled ? 'Active' : 'Disabled'}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
            >
              Save Goal
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Logged</span>
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">
            {displayCurrent}
          </div>
          <p className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 mt-0.5">
            {achievementPct}% of goal
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Glasses</span>
            <GlassWater className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {currentGlassesNum} <span className="text-xs font-sans font-normal text-slate-500">/ {targetGlassesNum} gl</span>
          </div>
          <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
            (250ml per glass)
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Remaining</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {displayRemaining}
          </div>
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
            {currentTotalMl >= targetMl ? 'Goal reached! 🎉' : 'To hit daily goal'}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pace Status</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {achievementPct >= 100 ? 'Goal Completed 🎉' : achievementPct >= 50 ? 'On Track 💧' : 'Hydration Needed'}
          </div>
          <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {todayLogs.length} logs recorded
          </p>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="space-y-1 pt-1">
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, achievementPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-slate-500">
          <span>0 {isLitre ? 'L' : 'ml'}</span>
          <span className="font-bold text-cyan-600">{displayCurrent} ({achievementPct}%)</span>
          <span>Target: {displayTarget}</span>
        </div>
      </div>

      {/* Recharts Hourly Consumption Bar Chart */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Hourly Intake Dynamics (Today)
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">2-hour windows</span>
        </div>

        <div className="h-48 sm:h-52 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="hour"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={val => (isLitre ? `${(val / 1000).toFixed(1)}L` : `${val}ml`)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ml" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.ml > 0 ? '#06b6d4' : '#e2e8f0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Water Logging Actions */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-cyan-600" />
          <span>Quick Log:</span>
        </span>

        <div className="flex items-center gap-1.5">
          {isLitre ? (
            <>
              <button
                type="button"
                onClick={() => addWater(0.25, 'litre')}
                className="py-1 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 font-bold text-xs border border-cyan-200/60 dark:border-cyan-800/60 transition cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>🥛</span>
                <span>+0.25 L</span>
              </button>
              <button
                type="button"
                onClick={() => addWater(0.5, 'litre')}
                className="py-1 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 font-bold text-xs border border-cyan-200/60 dark:border-cyan-800/60 transition cursor-pointer active:scale-95"
              >
                +0.50 L
              </button>
              <button
                type="button"
                onClick={() => addWater(1.0, 'litre')}
                className="py-1 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95"
              >
                +1.00 L
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => addWater(250, 'ml')}
                className="py-1 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 font-bold text-xs border border-cyan-200/60 dark:border-cyan-800/60 transition cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>🥛</span>
                <span>+250 ml</span>
              </button>
              <button
                type="button"
                onClick={() => addWater(350, 'ml')}
                className="py-1 px-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 font-bold text-xs border border-cyan-200/60 dark:border-cyan-800/60 transition cursor-pointer active:scale-95"
              >
                +350 ml
              </button>
              <button
                type="button"
                onClick={() => addWater(500, 'ml')}
                className="py-1 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95"
              >
                +500 ml
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
