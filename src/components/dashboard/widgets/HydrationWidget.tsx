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
  Plus,
  Settings2,
  Bell,
  BellOff,
  CheckCircle2,
  Target,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const HydrationWidget: React.FC = () => {
  const {
    hydration,
    addWater,
    setHydrationTarget,
    setHydrationPreferredUnit,
    toggleWaterReminder,
    toggleAdaptiveWaterReminder,
    sendAdaptiveHydrationNotification,
  } = useApp();

  const prefUnit = (hydration.preferredUnit || 'ml').toLowerCase().trim();
  const isLitre = ['l', 'litre', 'litres'].includes(prefUnit);
  const isGlasses = ['glasses', 'glass', 'gl'].includes(prefUnit);
  const isMl = !isLitre && !isGlasses;

  const targetMl = hydration.targetMl || 3000;
  const todayLogs = hydration.todayLogs || [];
  const currentTotalMl = Math.max(0, todayLogs.reduce((acc, c) => acc + (c.amountMl || 0), 0));
  const percent = Math.max(0, Math.min(100, Math.round((currentTotalMl / targetMl) * 100)));
  const remainingMl = Math.max(0, targetMl - currentTotalMl);

  // Exact glasses calculations without decimal artifacts when whole glasses
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

  const [customAmount, setCustomAmount] = useState(() => {
    if (isLitre) return '0.25';
    if (isGlasses) return '1';
    return '250';
  });

  const [customUnit, setCustomUnit] = useState(() => {
    if (isLitre) return 'litre';
    if (isGlasses) return 'glasses';
    return 'ml';
  });

  const [testNotificationSent, setTestNotificationSent] = useState(false);

  // Synchronize goalUnit and customTarget when hydration settings change
  React.useEffect(() => {
    const currentGoalUnit = isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml';
    setGoalUnit(currentGoalUnit);
    if (currentGoalUnit === 'litres') {
      setCustomTarget((targetMl / 1000).toFixed(1).replace(/\.0$/, ''));
      setCustomAmount('0.25');
      setCustomUnit('litre');
    } else if (currentGoalUnit === 'glasses') {
      setCustomTarget(Math.round(targetMl / 250).toString());
      setCustomAmount('1');
      setCustomUnit('glasses');
    } else {
      setCustomTarget(targetMl.toString());
      setCustomAmount('250');
      setCustomUnit('ml');
    }
  }, [targetMl, hydration.preferredUnit, isLitre, isGlasses]);

  // Compute adaptive pace status throughout active hours (07:30 to 22:00)
  const paceStatus = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (percent >= 100) {
      return { status: 'achieved', label: 'Goal Achieved! 🎉', color: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800' };
    }
    if (currentHour < 7.5 || currentHour > 22) {
      return { status: 'rest', label: 'Rest Window (Sleep Mode)', color: 'text-slate-500', badge: 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' };
    }
    const dayFraction = (currentHour - 7.5) / 14.5;
    const expectedMl = targetMl * dayFraction;
    const deficit = expectedMl - currentTotalMl;

    if (deficit > 300) {
      const deficitDisplay = isLitre
        ? `${(deficit / 1000).toFixed(1)}L`
        : isGlasses
          ? `${Math.round(deficit / 250)} glasses`
          : `${Math.round(deficit)}ml`;
      return { status: 'behind', label: `Falling Behind Pace (~${deficitDisplay} behind)`, color: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' };
    }
    if (deficit < -250) {
      return { status: 'ahead', label: 'Ahead of Pace 💧', color: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' };
    }
    return { status: 'on_track', label: 'On Track with Daily Pace 💧', color: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' };
  }, [currentTotalMl, targetMl, percent, isLitre, isGlasses]);

  // Group today's logs by hour buckets (06:00 to 22:00)
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

  const handleSaveGoal = (valToSave?: number, unitToSave?: 'litres' | 'ml' | 'glasses') => {
    const activeUnit = unitToSave || goalUnit;
    let targetInMl = 3000;

    if (valToSave !== undefined) {
      targetInMl =
        activeUnit === 'litres'
          ? Math.round(valToSave * 1000)
          : activeUnit === 'glasses'
            ? Math.round(valToSave * 250)
            : Math.round(valToSave);
    } else {
      const parsed = parseFloat(customTarget);
      if (isNaN(parsed) || parsed <= 0) return;
      targetInMl =
        activeUnit === 'litres'
          ? Math.round(parsed * 1000)
          : activeUnit === 'glasses'
            ? Math.round(parsed * 250)
            : Math.round(parsed);
    }

    if (targetInMl >= 250) {
      setHydrationTarget(targetInMl, activeUnit);
      setShowSettings(false);
    }
  };

  const handleCustomAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(customAmount);
    if (!customUnit || isNaN(amt) || amt <= 0) return;
    addWater(amt, customUnit);
    setCustomAmount(isLitre ? '0.25' : isGlasses ? '1' : '250');
  };

  const handleSendTestReminder = () => {
    sendAdaptiveHydrationNotification(true);
    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 3000);
  };

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-2 rounded-xl bg-slate-900/95 text-white border border-cyan-500/40 shadow-xl text-xs space-y-0.5">
          <p className="font-bold text-cyan-400 font-mono">{label}</p>
          <div className="flex items-center gap-1 text-slate-200">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span className="font-bold font-mono">
              {isLitre
                ? `${(data.ml / 1000).toFixed(2)} L`
                : isGlasses
                  ? `${(data.ml / 250).toFixed(1)} glasses`
                  : `${data.ml} ml`}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0 shadow-2xs">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Drink Water
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Target:</span>
              <strong className="text-cyan-700 dark:text-cyan-300 font-mono font-bold">{displayTarget}</strong>
              {!isGlasses && <span>({targetGlassesNum} glasses)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress Indicator (percentage completed badge) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 shadow-2xs">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-mono font-black">{percent}% completed</span>
          </div>

          {/* Goal Setting Button */}
          <button
            id="btn-hydration-settings"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
              showSettings
                ? 'bg-cyan-600 border-cyan-600 text-white shadow-2xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Set Daily Hydration Goal"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Set Goal</span>
          </button>
        </div>
      </div>

      {/* Preferred Unit Toggle: Liters / Milliliters / Glasses */}
      <div className="flex items-center justify-between p-1 bg-slate-100/80 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 px-2 uppercase tracking-wider">Unit:</span>
        <div className="grid grid-cols-3 gap-1 flex-1">
          {[
            { id: 'ml', label: '💧 ml' },
            { id: 'litres', label: '🚰 Litres (L)' },
            { id: 'glasses', label: '🥛 Glasses' },
          ].map(u => {
            const isActive =
              (u.id === 'ml' && isMl) ||
              (u.id === 'litres' && isLitre) ||
              (u.id === 'glasses' && isGlasses);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setHydrationPreferredUnit(u.id)}
                className={`py-1 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{u.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Adaptive Pace Live Badge */}
      <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs ${paceStatus.badge}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className={`font-bold truncate ${paceStatus.color}`}>
            {paceStatus.label}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSendTestReminder}
          className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 hover:underline flex items-center gap-1 shrink-0 cursor-pointer ml-2"
          title="Send instant intelligent reminder notification"
        >
          <Zap className="w-3 h-3" />
          <span>{testNotificationSent ? 'Sent! 💧' : 'Test Smart Nudge'}</span>
        </button>
      </div>

      {/* Daily Hydration Goal Setting Panel */}
      {showSettings ? (
        <div className="space-y-3 p-3.5 bg-cyan-50/50 dark:bg-slate-800/60 rounded-xl border border-cyan-100 dark:border-slate-700 text-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Define Daily Hydration Goal</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
              Current: {displayTarget}
            </span>
          </div>

          {/* Unit Toggle: Litres vs ml vs Glasses */}
          <div>
            <label className="block text-[11px] text-slate-600 dark:text-slate-300 font-semibold mb-1">
              Goal Measurement Unit:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'litres' as const, label: '🚰 Litres (L)' },
                { id: 'ml' as const, label: '💧 Millilitres (ml)' },
                { id: 'glasses' as const, label: '🥛 Glasses' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const currentNum = parseFloat(customTarget);
                    setGoalUnit(item.id);
                    if (!isNaN(currentNum) && currentNum > 0) {
                      if (goalUnit === 'ml' && item.id === 'litres') {
                        setCustomTarget((currentNum / 1000).toFixed(1).replace(/\.0$/, ''));
                      } else if (goalUnit === 'ml' && item.id === 'glasses') {
                        setCustomTarget(Math.max(1, Math.round(currentNum / 250)).toString());
                      } else if (goalUnit === 'litres' && item.id === 'ml') {
                        setCustomTarget(String(Math.round(currentNum * 1000)));
                      } else if (goalUnit === 'litres' && item.id === 'glasses') {
                        setCustomTarget(Math.max(1, Math.round(currentNum * 4)).toString());
                      } else if (goalUnit === 'glasses' && item.id === 'ml') {
                        setCustomTarget(String(Math.round(currentNum * 250)));
                      } else if (goalUnit === 'glasses' && item.id === 'litres') {
                        setCustomTarget((currentNum / 4).toFixed(1).replace(/\.0$/, ''));
                      }
                    }
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-1 ${
                    goalUnit === item.id
                      ? 'bg-cyan-600 border-cyan-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Target Presets based on chosen unit */}
          <div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Quick Target Presets:
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(goalUnit === 'litres'
                ? [2.0, 2.5, 3.0, 3.5, 4.0]
                : goalUnit === 'glasses'
                  ? [8, 10, 12, 14, 16]
                  : [2000, 2500, 3000, 3500, 4000]
              ).map(val => {
                const targetMatches =
                  goalUnit === 'litres'
                    ? targetMl === Math.round(val * 1000)
                    : goalUnit === 'glasses'
                      ? targetGlassesNum === val
                      : targetMl === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSaveGoal(val, goalUnit)}
                    className={`py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      targetMatches
                        ? 'bg-cyan-600 border-cyan-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {val}{goalUnit === 'litres' ? 'L' : goalUnit === 'glasses' ? ' gl' : 'ml'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Target Input */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSaveGoal();
            }}
            className="space-y-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-700"
          >
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-300 font-semibold mb-1">
                Custom Daily Target ({goalUnit === 'litres' ? 'Litres' : goalUnit === 'glasses' ? 'Glasses' : 'ml'}):
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={goalUnit === 'litres' ? '0.1' : '1'}
                  min={goalUnit === 'litres' ? '0.5' : goalUnit === 'glasses' ? '2' : '500'}
                  max={goalUnit === 'litres' ? '10' : goalUnit === 'glasses' ? '40' : '10000'}
                  value={customTarget}
                  onChange={e => setCustomTarget(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
                  placeholder={goalUnit === 'litres' ? 'e.g. 3.0' : goalUnit === 'glasses' ? 'e.g. 12' : 'e.g. 3000'}
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition cursor-pointer text-xs shadow-2xs"
                >
                  Save Goal
                </button>
              </div>
            </div>

            {/* Intelligent Adaptive Reminder Setting */}
            <div className="p-2.5 rounded-xl bg-cyan-100/40 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Intelligent Adaptive Reminders:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAdaptiveWaterReminder(!hydration.adaptiveRemindersEnabled)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                    hydration.adaptiveRemindersEnabled
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{hydration.adaptiveRemindersEnabled ? 'Active' : 'Disabled'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                Monitors your hourly drinking pace between 07:30 and 22:00, sending nudges when you fall behind or haven't logged in 2.5 hours.
              </p>
            </div>

            {/* Periodic Interval Reminder */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Backup Fixed Reminder (2h intervals):
              </span>
              <button
                type="button"
                onClick={() => toggleWaterReminder(!hydration.reminderEnabled)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  hydration.reminderEnabled
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {hydration.reminderEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                <span>{hydration.reminderEnabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Progress Indicator Hero Section */}
          <div className="p-3 bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-transparent dark:from-cyan-950/40 dark:via-teal-950/20 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/60 space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono tracking-tight text-cyan-700 dark:text-cyan-300">
                  {percent}%
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  completed
                </span>
              </div>
              <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white font-bold">{displayCurrent}</strong> / {displayTarget}
              </div>
            </div>

            {/* Glowing Dual-Tone Progress Bar */}
            <div className="w-full bg-slate-200/70 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 h-2.5 rounded-full transition-all duration-500 shadow-xs"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>

            {/* Dynamic Status message */}
            <div className="flex items-center justify-between text-[11px] font-medium pt-0.5">
              <span className="text-slate-500 dark:text-slate-400">
                🥛 {currentGlassesNum} of {targetGlassesNum} glasses
              </span>
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                {percent >= 100 ? (
                  <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Daily Goal Achieved! 🎉</span>
                  </span>
                ) : (
                  `${displayRemaining} remaining`
                )}
              </span>
            </div>
          </div>

          {/* Quick Metrics 3-Card Row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Intake</span>
              <div className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
                {displayCurrent}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Glasses</span>
              <div className="text-sm font-black font-mono text-teal-600 dark:text-teal-400 mt-0.5">
                {currentGlassesNum} <span className="text-[10px] font-sans font-normal text-slate-500">gl</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining</span>
              <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {displayRemaining}
              </div>
            </div>
          </div>

          {/* Custom Unit Input & Quick Add Bar */}
          <form onSubmit={handleCustomAdd} className="flex items-center gap-1.5 pt-0.5">
            <input
              type="number"
              step="any"
              placeholder="Amount"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-hidden"
            />
            <select
              value={customUnit}
              onChange={e => setCustomUnit(e.target.value)}
              className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="glasses">Glasses (250ml)</option>
              <option value="litre">Litre (L)</option>
              <option value="ml">ml</option>
              <option value="cups">Cup (250ml)</option>
              <option value="oz">Oz</option>
            </select>
            <button
              type="submit"
              className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Intake</span>
            </button>
          </form>

          {/* Quick Presets tailored to user preference */}
          <div className="grid grid-cols-4 gap-1.5">
            {isGlasses ? (
              <>
                <button
                  type="button"
                  onClick={() => addWater(1, 'glasses')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  🥛 +1 Glass
                </button>
                <button
                  type="button"
                  onClick={() => addWater(2, 'glasses')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  🥛 +2 Glasses
                </button>
                <button
                  type="button"
                  onClick={() => addWater(3, 'glasses')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  🥛 +3 Glasses
                </button>
                <button
                  type="button"
                  onClick={() => addWater(4, 'glasses')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-cyan-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  🥛 +4 Glasses
                </button>
              </>
            ) : isLitre ? (
              <>
                <button
                  type="button"
                  onClick={() => addWater(0.25, 'litre')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +0.25 L
                </button>
                <button
                  type="button"
                  onClick={() => addWater(0.5, 'litre')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +0.50 L
                </button>
                <button
                  type="button"
                  onClick={() => addWater(0.75, 'litre')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +0.75 L
                </button>
                <button
                  type="button"
                  onClick={() => addWater(1.0, 'litre')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +1.00 L
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => addWater(250, 'ml')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +250 ml
                </button>
                <button
                  type="button"
                  onClick={() => addWater(350, 'ml')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +350 ml
                </button>
                <button
                  type="button"
                  onClick={() => addWater(500, 'ml')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +500 ml
                </button>
                <button
                  type="button"
                  onClick={() => addWater(750, 'ml')}
                  className="py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  +750 ml
                </button>
              </>
            )}
          </div>

          {/* Hourly Trend Chart */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hourly Intake Trend</span>
              <span className="text-[9px] font-mono text-slate-400">Today</span>
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => (isLitre ? `${(v / 1000).toFixed(1)}` : isGlasses ? `${Math.round(v / 250)}` : `${v}`)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ml" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.ml > 0 ? '#06b6d4' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
