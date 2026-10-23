import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, Check, AlarmClock, X, Volume2, VolumeX, RotateCcw, Quote, Copy, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { soundEngine } from '../../utils/audio';

export interface ActiveAlarmData {
  id: string;
  source: 'task' | 'medication' | 'bill' | 'habit' | 'schedule' | 'quote';
  title: string;
  subtitle?: string;
  dueTime?: string;
  reminderType: 'notification' | 'alarm';
  rawId?: string;
}

export const ActiveAlarmBanner: React.FC = () => {
  const { toggleTask, markBillPaid, toggleScheduleItem, recordAlarmHistory } = useApp();
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlarmData[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const audioIntervalRef = useRef<any>(null);

  // Listen for custom trigger events across the entire application
  useEffect(() => {
    const handleTrigger = (e: CustomEvent<ActiveAlarmData>) => {
      const data = e.detail;
      if (!data || data.reminderType !== 'alarm') return;
      
      setActiveAlerts(prev => {
        // Prevent duplicate alarms: check id, rawId, or title + dueTime match
        if (prev.some(alert => alert.id === data.id)) return prev;
        if (data.rawId && prev.some(alert => alert.rawId === data.rawId)) return prev;
        if (prev.some(alert => alert.title === data.title && alert.dueTime === data.dueTime)) return prev;
        return [...prev, data];
      });

      soundEngine.resume();
      soundEngine.playAlarmChime();
    };

    window.addEventListener('omnilifeos_trigger_alarm' as any, handleTrigger);
    return () => {
      window.removeEventListener('omnilifeos_trigger_alarm' as any, handleTrigger);
    };
  }, []);

  // Manage continuous audio ticker if there are active alarms and not muted
  useEffect(() => {
    clearInterval(audioIntervalRef.current);
    if (activeAlerts.length > 0 && !isMuted) {
      audioIntervalRef.current = setInterval(() => {
        soundEngine.playAlarmChime();
      }, 4000);
    }
    return () => {
      clearInterval(audioIntervalRef.current);
    };
  }, [activeAlerts.length, isMuted]);

  const stopAudioIfEmpty = (remainingAlerts: ActiveAlarmData[]) => {
    if (remainingAlerts.length === 0) {
      clearInterval(audioIntervalRef.current);
    }
  };

  const handleDismiss = (id: string, status: 'dismissed' | 'completed' | 'snoozed' = 'dismissed') => {
    const alert = activeAlerts.find(a => a.id === id);
    if (alert) {
      recordAlarmHistory({
        alarmId: alert.id,
        title: alert.title,
        subtitle: alert.subtitle,
        category: alert.source,
        status,
      });
    }
    setActiveAlerts(prev => {
      const updated = prev.filter(a => a.id !== id);
      stopAudioIfEmpty(updated);
      return updated;
    });
  };

  const handleDismissCategory = (source: string) => {
    activeAlerts.filter(a => a.source === source).forEach(alert => {
      recordAlarmHistory({
        alarmId: alert.id,
        title: alert.title,
        subtitle: alert.subtitle,
        category: alert.source,
        status: 'dismissed',
      });
    });
    setActiveAlerts(prev => {
      const updated = prev.filter(a => a.source !== source);
      stopAudioIfEmpty(updated);
      return updated;
    });
  };

  const handleSnooze = (id: string, minutes = 5) => {
    const alertToSnooze = activeAlerts.find(a => a.id === id);
    if (alertToSnooze) {
      handleDismiss(id, 'snoozed');
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('omnilifeos_trigger_alarm', { detail: alertToSnooze })
        );
      }, minutes * 60 * 1000);
    }
  };

  const handleMarkAsDone = (alert: ActiveAlarmData) => {
    if (alert.source === 'task' && alert.rawId) {
      toggleTask(alert.rawId);
    } else if (alert.source === 'bill' && alert.rawId) {
      markBillPaid(alert.rawId);
    } else if (alert.source === 'schedule' && alert.rawId) {
      toggleScheduleItem(alert.rawId);
    }
    soundEngine.playWaterDropNotification();
    handleDismiss(alert.id, 'completed');
  };

  const toggleCategoryExpand = (source: string) => {
    setExpandedCategories(prev => {
      const current = prev[source] !== undefined ? prev[source] : (soundEngine.getStackExpandBehavior() === 'expanded');
      return {
        ...prev,
        [source]: !current,
      };
    });
  };

  if (activeAlerts.length === 0) return null;

  // Group alerts by source category
  const groupedAlerts = activeAlerts.reduce((acc, alert) => {
    const cat = alert.source;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(alert);
    return acc;
  }, {} as Record<string, ActiveAlarmData[]>);

  const sourceConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    task: { label: 'Tasks', icon: <Check className="w-3.5 h-3.5" />, color: 'bg-indigo-600 text-white' },
    medication: { label: 'Medications', icon: <Bell className="w-3.5 h-3.5" />, color: 'bg-emerald-600 text-white' },
    bill: { label: 'Bills & Finance', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-600 text-white' },
    habit: { label: 'Daily Habits', icon: <RotateCcw className="w-3.5 h-3.5" />, color: 'bg-purple-600 text-white' },
    schedule: { label: 'Schedule', icon: <AlarmClock className="w-3.5 h-3.5" />, color: 'bg-blue-600 text-white' },
    quote: { label: 'Daily Wisdom', icon: <Quote className="w-3.5 h-3.5" />, color: 'bg-amber-600 text-white' },
  };

  const snoozeOptions = soundEngine.getSnoozeOptions();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[94vw] max-w-sm flex flex-col gap-2.5 max-h-[85vh] overflow-y-auto pointer-events-none p-1">
      {Object.entries(groupedAlerts).map(([source, alerts]) => {
        const config = sourceConfig[source] || sourceConfig.task;
        const defaultExpand = soundEngine.getStackExpandBehavior() === 'expanded';
        const isExpanded = expandedCategories[source] !== undefined ? expandedCategories[source] : (defaultExpand || alerts.length === 1);

        // Special handling for quote category
        if (source === 'quote') {
          return alerts.map((alert, idx) => {
            const handleCopy = () => {
              const textToCopy = alert.subtitle
                ? `"${alert.subtitle}" ${alert.title ? `— ${alert.title}` : ''}`
                : alert.title || '';
              navigator.clipboard?.writeText(textToCopy);
              setCopiedQuoteId(alert.id);
              soundEngine.playSuccessChime();
              setTimeout(() => setCopiedQuoteId(null), 2000);
            };

            return (
              <div
                key={alert.id || idx}
                className="pointer-events-auto animate-in slide-in-from-top-6 fade-in duration-200 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-amber-400/80 dark:border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-2 ring-amber-500/30 text-slate-900 dark:text-slate-100 space-y-1.5 transition-all"
              >
                <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-amber-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <span className="p-1 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      <Quote className="w-3.5 h-3.5" />
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 uppercase tracking-wider shrink-0">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-ping" />
                      Daily Wisdom
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                      title="Copy quote text"
                    >
                      {copiedQuoteId === alert.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {alert.subtitle && (
                  <p className="text-[12px] sm:text-[13px] font-sentinel font-bold text-slate-900 dark:text-slate-100 leading-snug px-0.5 pt-0.5">
                    "{alert.subtitle}"
                  </p>
                )}
              </div>
            );
          });
        }

        // If single item in category, render standard card
        if (alerts.length === 1) {
          const alert = alerts[0];
          return (
            <div
              key={alert.id}
              className="pointer-events-auto p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border animate-in slide-in-from-top-6 fade-in duration-200 transition-all shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/30 border-indigo-500/90"
            >
              <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className={`p-0.5 rounded-full ${config.color}`}>
                    {config.icon}
                  </span>
                  <span className="tracking-wide uppercase text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {config.label} • now
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                    <AlarmClock className="w-2.5 h-2.5" /> ALARM
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={isMuted ? 'Unmute alarm' : 'Mute alarm tone'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="py-1.5">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white leading-snug">
                  {alert.title}
                </h4>
                {alert.subtitle && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                    {alert.subtitle}
                  </p>
                )}
                {alert.dueTime && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-3 h-3" />
                    <span>Due: {alert.dueTime}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleMarkAsDone(alert)}
                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider transition shadow-2xs cursor-pointer"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Mark as Done</span>
                </button>

                <div className="flex items-center gap-1">
                  {snoozeOptions.slice(0, 2).map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSnooze(alert.id, mins)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // Multiple items in category: Render Grouped Stack Card
        return (
          <div
            key={source}
            className="pointer-events-auto p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border animate-in slide-in-from-top-6 fade-in duration-200 transition-all shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-2 ring-indigo-500/30 border-indigo-500/90 space-y-2"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span className={`p-0.5 rounded-full ${config.color}`}>
                  {config.icon}
                </span>
                <span className="tracking-wide uppercase text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {config.label} Stack
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9.5px] font-extrabold bg-indigo-500 text-white shadow-xs">
                  <Layers className="w-2.5 h-2.5" /> {alerts.length} Active
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleCategoryExpand(source)}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition cursor-pointer"
                >
                  <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissCategory(source)}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title="Dismiss all in category"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stack Preview / Expanded List */}
            {isExpanded ? (
              <div className="space-y-2 pt-0.5 max-h-60 overflow-y-auto pr-1">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-[12px] font-bold text-slate-900 dark:text-white leading-snug">
                        {alert.title}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleDismiss(alert.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {alert.subtitle && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                        {alert.subtitle}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
                      {alert.dueTime && (
                        <span className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400">
                          Due: {alert.dueTime}
                        </span>
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        {snoozeOptions.slice(0, 1).map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleSnooze(alert.id, mins)}
                            className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9.5px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            {mins}m
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleMarkAsDone(alert)}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-[9.5px] font-bold text-white cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs py-1 px-0.5">
                <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                  {alerts[0].title} {alerts.length > 1 ? `and ${alerts.length - 1} more...` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => toggleCategoryExpand(source)}
                  className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] hover:underline shrink-0"
                >
                  View All
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
