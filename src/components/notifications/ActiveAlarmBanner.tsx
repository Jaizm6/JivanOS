import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  Check,
  AlarmClock,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Quote,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  GripHorizontal,
  Minimize2,
  Maximize2,
  ExternalLink,
  PictureInPicture2,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { soundEngine, AlarmPopupStyle } from '../../utils/audio';
import { formatLocalDate } from '../../utils/date';

export interface ActiveAlarmData {
  id: string;
  source: 'task' | 'medication' | 'bill' | 'habit' | 'schedule' | 'quote';
  title: string;
  subtitle?: string;
  dueTime?: string;
  dueDateLabel?: string;
  listLabel?: string;
  listIcon?: string;
  isRecurring?: boolean;
  reminderType: 'notification' | 'alarm';
  rawId?: string;
  triggeredAtMs?: number;
}

type AlarmPiPSizeMode = 'extended' | 'compact' | 'mini';

export const ActiveAlarmBanner: React.FC = () => {
  const {
    tasks,
    habits,
    toggleTask,
    updateTask,
    toggleHabitDay,
    markBillPaid,
    toggleScheduleItem,
    recordAlarmHistory,
    setActiveTab,
    startPomodoro,
  } = useApp();

  const [activeAlerts, setActiveAlerts] = useState<ActiveAlarmData[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [alarmPopupStyle, setAlarmPopupStyle] = useState<AlarmPopupStyle>(() =>
    soundEngine.getAlarmPopupStyle()
  );
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);

  // Floating PiP Alarm Card State
  const [pipMode, setPipMode] = useState<AlarmPiPSizeMode>('extended');
  const [activePipIndex, setActivePipIndex] = useState(0);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(12, window.innerWidth - 356),
        y: 76,
      };
    }
    return { x: 20, y: 76 };
  });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pipCardRef = useRef<HTMLDivElement>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const audioIntervalRef = useRef<any>(null);

  // Sync popup style preference
  useEffect(() => {
    const syncStyle = () => {
      setAlarmPopupStyle(soundEngine.getAlarmPopupStyle());
    };
    window.addEventListener('omni_popup_style_changed', syncStyle);
    return () => window.removeEventListener('omni_popup_style_changed', syncStyle);
  }, []);

  // Listen for custom trigger events across the entire application
  useEffect(() => {
    const handleTrigger = (e: CustomEvent<ActiveAlarmData>) => {
      const data = e.detail;
      if (!data || data.reminderType !== 'alarm') return;

      const enriched: ActiveAlarmData = {
        ...data,
        triggeredAtMs: data.triggeredAtMs || Date.now(),
      };

      setActiveAlerts(prev => {
        if (prev.some(alert => alert.id === enriched.id)) return prev;
        if (enriched.rawId && prev.some(alert => alert.rawId === enriched.rawId)) return prev;
        if (prev.some(alert => alert.title === enriched.title && alert.dueTime === enriched.dueTime)) return prev;
        return [...prev, enriched];
      });

      soundEngine.resume();
      soundEngine.playAlarmChime();
    };

    window.addEventListener('omnilifeos_trigger_alarm' as any, handleTrigger);
    return () => {
      window.removeEventListener('omnilifeos_trigger_alarm' as any, handleTrigger);
    };
  }, []);

  // Live 1-second ticker for active alarm elapsed timer in PiP card
  useEffect(() => {
    if (activeAlerts.length === 0) return;
    const t = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [activeAlerts.length]);

  // Manage continuous audio ticker if there are active alarms and not muted (NO vibration)
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

  // Keep PiP index in bounds when alerts change
  useEffect(() => {
    if (activePipIndex >= activeAlerts.length && activeAlerts.length > 0) {
      setActivePipIndex(activeAlerts.length - 1);
    }
  }, [activeAlerts.length, activePipIndex]);

  // Draggable PiP Pointer / Touch Handlers
  const handlePipPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDraggingPip(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    pipDragStartRef.current = {
      x: clientX - pipPosition.x,
      y: clientY - pipPosition.y,
    };
  };

  useEffect(() => {
    if (!isDraggingPip) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const cardWidth = pipCardRef.current?.offsetWidth || 320;
      const cardHeight = pipCardRef.current?.offsetHeight || 200;

      const maxX = Math.max(12, window.innerWidth - cardWidth - 12);
      const maxY = Math.max(12, window.innerHeight - cardHeight - 12);

      setPipPosition({
        x: Math.max(12, Math.min(maxX, clientX - pipDragStartRef.current.x)),
        y: Math.max(12, Math.min(maxY, clientY - pipDragStartRef.current.y)),
      });
    };

    const handleUp = () => {
      setIsDraggingPip(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingPip]);

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
    } else if (alert.source === 'habit' && alert.rawId) {
      toggleHabitDay(alert.rawId, formatLocalDate(new Date()));
    } else if (alert.source === 'bill' && alert.rawId) {
      markBillPaid(alert.rawId);
    } else if (alert.source === 'schedule' && alert.rawId) {
      toggleScheduleItem(alert.rawId);
    }
    soundEngine.playWaterDropNotification();
    handleDismiss(alert.id, 'completed');
  };

  const handleJumpToItem = (alert: ActiveAlarmData) => {
    if (alert.source === 'task') {
      setActiveTab('tasks');
    } else if (alert.source === 'habit') {
      setActiveTab('habits');
    } else if (alert.source === 'medication') {
      setActiveTab('medications');
    } else if (alert.source === 'bill') {
      setActiveTab('bills');
    } else if (alert.source === 'schedule') {
      setActiveTab('planner');
    } else if (alert.source === 'quote') {
      setActiveTab('quotes');
    }
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

  const sourceConfig: Record<string, { label: string; badge: string; icon: React.ReactNode; color: string; accent: string }> = {
    task: {
      label: 'Tasks',
      badge: 'TASK ALARM',
      icon: <Check className="w-3.5 h-3.5" />,
      color: 'bg-indigo-600 text-white',
      accent: 'from-indigo-500/25 via-violet-500/15 to-transparent border-indigo-500/50',
    },
    medication: {
      label: 'Medications',
      badge: 'MEDICATION ALARM',
      icon: <Bell className="w-3.5 h-3.5" />,
      color: 'bg-emerald-600 text-white',
      accent: 'from-emerald-500/25 via-teal-500/15 to-transparent border-emerald-500/50',
    },
    bill: {
      label: 'Bills & Finance',
      badge: 'BILL ALARM',
      icon: <Clock className="w-3.5 h-3.5" />,
      color: 'bg-amber-600 text-white',
      accent: 'from-amber-500/25 via-orange-500/15 to-transparent border-amber-500/50',
    },
    habit: {
      label: 'Daily Habits',
      badge: 'HABIT ALARM',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      color: 'bg-purple-600 text-white',
      accent: 'from-purple-500/25 via-fuchsia-500/15 to-transparent border-purple-500/50',
    },
    schedule: {
      label: 'Schedule',
      badge: 'SCHEDULE ALARM',
      icon: <AlarmClock className="w-3.5 h-3.5" />,
      color: 'bg-blue-600 text-white',
      accent: 'from-blue-500/25 via-sky-500/15 to-transparent border-blue-500/50',
    },
    quote: {
      label: 'Daily Wisdom',
      badge: 'WISDOM ALARM',
      icon: <Quote className="w-3.5 h-3.5" />,
      color: 'bg-amber-600 text-white',
      accent: 'from-amber-500/25 via-yellow-500/15 to-transparent border-amber-500/50',
    },
  };

  const snoozeOptions = soundEngine.getSnoozeOptions();

  const formatElapsedActive = (triggeredAtMs?: number) => {
    const start = triggeredAtMs || nowTick;
    const sec = Math.max(0, Math.floor((nowTick - start) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to format 24h "09:00" into TickTick "9:00am - 9:20am" style range
  const formatTickTickScheduleLabel = (alert: ActiveAlarmData) => {
    if (alert.dueDateLabel) return alert.dueDateLabel;

    const matchedTask = alert.source === 'task' && alert.rawId ? tasks.find(t => t.id === alert.rawId) : undefined;
    const matchedHabit = alert.source === 'habit' && alert.rawId ? habits.find(h => h.id === alert.rawId) : undefined;

    const todayIso = formatLocalDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayIso = formatLocalDate(yesterdayDate);

    let dayPrefix = 'Today';
    const itemDueDate = matchedTask?.dueDate;
    if (itemDueDate) {
      if (itemDueDate === yesterdayIso) {
        dayPrefix = 'Yesterday';
      } else if (itemDueDate === todayIso) {
        dayPrefix = 'Today';
      } else {
        const parsed = new Date(`${itemDueDate}T00:00:00`);
        if (!isNaN(parsed.getTime())) {
          dayPrefix = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      }
    }

    const rawTime = alert.dueTime || matchedTask?.dueTime || matchedHabit?.reminderTime || '09:00';
    const to12h = (h: number, m: number) => {
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    };

    const match24 = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const startH = parseInt(match24[1], 10);
      const startM = parseInt(match24[2], 10);
      const durationMins = matchedTask?.durationMinutes || matchedHabit?.timerMinutes || 20;
      const totalEndMins = startH * 60 + startM + durationMins;
      const endH = Math.floor(totalEndMins / 60) % 24;
      const endM = totalEndMins % 60;
      return `${dayPrefix}, ${to12h(startH, startM)} - ${to12h(endH, endM)}`;
    }

    return `${dayPrefix}, ${rawTime}`;
  };

  // ============================================================================
  // MODE 0: TICKTICK BOTTOM-SHEET TASK REMINDER / ALARM POP-UP CARD (ticktick_card)
  // ============================================================================
  if (alarmPopupStyle === 'ticktick_card') {
    const currentAlert = activeAlerts[Math.min(activePipIndex, activeAlerts.length - 1)] || activeAlerts[0];
    const matchedTask =
      currentAlert.source === 'task' && currentAlert.rawId
        ? tasks.find(t => t.id === currentAlert.rawId)
        : undefined;
    const matchedHabit =
      currentAlert.source === 'habit' && currentAlert.rawId
        ? habits.find(h => h.id === currentAlert.rawId)
        : undefined;

    const scheduleLabel = formatTickTickScheduleLabel(currentAlert);
    const listIcon =
      currentAlert.listIcon ||
      (currentAlert.source === 'task'
        ? '👋'
        : currentAlert.source === 'habit'
          ? matchedHabit?.icon || '🔥'
          : currentAlert.source === 'medication'
            ? '💊'
            : currentAlert.source === 'bill'
              ? '💳'
              : '📅');
    const listLabel =
      currentAlert.listLabel ||
      matchedTask?.project ||
      matchedTask?.category ||
      (currentAlert.source === 'task'
        ? 'Welcome'
        : currentAlert.source === 'habit'
          ? 'Habits'
          : currentAlert.source === 'medication'
            ? 'Medications'
            : currentAlert.source === 'bill'
              ? 'Bills'
              : 'Schedule');

    const bodyDescription =
      currentAlert.subtitle ||
      matchedTask?.notes ||
      matchedHabit?.notes ||
      '';

    const taskSubtasks = matchedTask?.subtasks || matchedTask?.checklist || [];

    return (
      <div
        data-no-drawer-swipe="true"
        className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[430px] z-[99999] pointer-events-auto select-none animate-in slide-in-from-bottom-6 fade-in duration-250"
      >
        <div className="rounded-[28px] bg-[#1c1c1e]/98 text-white border border-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl px-5 pt-4.5 pb-5 flex flex-col justify-between min-h-[250px]">
          {/* TOP HEADER ROW: Schedule Date/Time + Repeat Icon | List Badge + Concentric Focus Circle + Close X */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Date & Time Range + Repeat Icon */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13.5px] sm:text-[14px] font-medium text-[#4c8df6] tracking-tight truncate">
                {scheduleLabel}
              </span>
              <Repeat className="w-3.5 h-3.5 text-[#4c8df6] stroke-[2.2] shrink-0" />
            </div>

            {/* Right: Category/List + Concentric Target Icon + Multi-Alert Switcher + Close X */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 text-[13.5px] sm:text-[14px] font-medium text-[#98989f]">
                <span className="text-sm leading-none">{listIcon}</span>
                <span className="truncate max-w-[95px] capitalize">{listLabel}</span>
              </div>

              {activeAlerts.length > 1 && (
                <div className="flex items-center gap-0.5 bg-white/10 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePipIndex(prev => (prev - 1 + activeAlerts.length) % activeAlerts.length)
                    }
                    className="hover:text-white cursor-pointer"
                    title="Previous alert"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span>
                    {activePipIndex + 1}/{activeAlerts.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePipIndex(prev => (prev + 1) % activeAlerts.length)}
                    className="hover:text-white cursor-pointer"
                    title="Next alert"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Concentric Circle Target / Focus Button (Exact TickTick Icon) */}
              <button
                type="button"
                onClick={() => {
                  if (matchedTask) {
                    startPomodoro(matchedTask.id);
                  }
                  handleJumpToItem(currentAlert);
                }}
                className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer p-0.5"
                title="Start Focus Timer / Open Item"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="w-[19px] h-[19px]"
                  stroke="currentColor"
                >
                  <circle cx="10" cy="10" r="7.2" strokeWidth="1.7" />
                  <circle cx="10" cy="10" r="2.8" strokeWidth="1.7" />
                </svg>
              </button>

              {/* Close / Dismiss X Button */}
              <button
                type="button"
                onClick={() => handleDismiss(currentAlert.id)}
                className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer p-0.5"
                title="Dismiss"
              >
                <X className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </div>

          {/* MAIN CONTENT BODY: Title, Description, and Optional Subtasks */}
          <div className="pt-3.5 pb-6 flex-1 flex flex-col justify-start">
            <h3 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-snug">
              {currentAlert.title}
            </h3>

            {bodyDescription ? (
              <p className="text-[14.5px] sm:text-[15px] text-[#98989f] font-normal leading-relaxed mt-1.5">
                {bodyDescription}
              </p>
            ) : null}

            {/* Interactive Subtasks inside Pop-Up Card if task has checklist */}
            {taskSubtasks.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                {taskSubtasks.map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      if (!matchedTask) return;
                      const updated = taskSubtasks.map(s =>
                        s.id === sub.id ? { ...s, completed: !s.completed } : s
                      );
                      updateTask({
                        ...matchedTask,
                        subtasks: updated,
                        checklist: updated,
                      });
                    }}
                    className="w-full flex items-center gap-2.5 text-left py-1 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        sub.completed
                          ? 'bg-[#4c8df6] border-[#4c8df6] text-white'
                          : 'border-zinc-500'
                      }`}
                    >
                      {sub.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span
                      className={`text-[13px] truncate ${
                        sub.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OPTIONAL SNOOZE DURATION PILL BAR (Revealed when Snooze is toggled) */}
          {showSnoozePicker && (
            <div className="flex items-center justify-between gap-1.5 pb-2.5 animate-in fade-in duration-150">
              {[5, 10, 15, 30, 60].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setShowSnoozePicker(false);
                    handleSnooze(currentAlert.id, mins);
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs font-semibold text-[#4c8df6] transition cursor-pointer"
                >
                  {mins === 60 ? '1h' : `${mins}m`}
                </button>
              ))}
            </div>
          )}

          {/* BOTTOM DUAL-BUTTON ACTION BAR: Snooze & Complete */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (!showSnoozePicker) {
                  handleSnooze(currentAlert.id, snoozeOptions[0] || 5);
                } else {
                  setShowSnoozePicker(false);
                }
              }}
              onContextMenu={e => {
                e.preventDefault();
                setShowSnoozePicker(prev => !prev);
              }}
              className="py-3 px-4 rounded-[14px] bg-[#2c2c2e] hover:bg-[#363638] active:scale-[0.98] text-[#d1d1d6] font-semibold text-[15px] text-center transition cursor-pointer"
              title="Tap to Snooze • Right-click for custom snooze durations"
            >
              Snooze
            </button>

            <button
              type="button"
              onClick={() => handleMarkAsDone(currentAlert)}
              className="py-3 px-4 rounded-[14px] bg-[#2c2c2e] hover:bg-[#363638] active:scale-[0.98] text-[#4c8df6] font-semibold text-[15px] text-center transition cursor-pointer"
            >
              Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 1: DRAGGABLE FLOATING PiP ALARM CARD (pip_card)
  // ============================================================================
  if (alarmPopupStyle === 'pip_card') {
    const currentAlert = activeAlerts[Math.min(activePipIndex, activeAlerts.length - 1)] || activeAlerts[0];
    const cfg = sourceConfig[currentAlert.source] || sourceConfig.task;
    const elapsedStr = formatElapsedActive(currentAlert.triggeredAtMs);

    return (
      <div
        ref={pipCardRef}
        data-no-drawer-swipe="true"
        onMouseDown={handlePipPointerDown}
        onTouchStart={handlePipPointerDown}
        style={{
          left: `${pipPosition.x}px`,
          top: `${pipPosition.y}px`,
          touchAction: 'none',
        }}
        className={`fixed z-[99999] select-none transition-shadow duration-200 ${
          isDraggingPip ? 'cursor-grabbing scale-[1.02]' : 'cursor-grab'
        }`}
      >
        {/* 1A. MINI FLOATING ORB / PILL MODE */}
        {pipMode === 'mini' && (
          <div
            onClick={() => {
              if (!isDraggingPip) setPipMode('extended');
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-zinc-950/95 text-white border border-rose-500/60 shadow-[0_14px_35px_rgba(244,63,94,0.35)] ring-2 ring-rose-500/30 backdrop-blur-2xl cursor-pointer hover:scale-105 transition-transform"
            title="Active Alarm PiP • Tap to expand"
          >
            <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white">
              <AlarmClock className="w-3.5 h-3.5 animate-bounce" />
              <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-40" />
            </span>
            <div className="flex flex-col min-w-0 max-w-[140px]">
              <span className="text-[10px] font-extrabold text-white truncate leading-tight">
                {currentAlert.title}
              </span>
              <span className="text-[8.5px] font-mono font-bold text-rose-300">
                ACTIVE • {elapsedStr}
              </span>
            </div>
            <Maximize2 className="w-3.5 h-3.5 text-zinc-400 hover:text-white shrink-0" />
          </div>
        )}

        {/* 1B. COMPACT FLOATING PiP BAR MODE */}
        {pipMode === 'compact' && (
          <div className="w-[300px] sm:w-[325px] rounded-2xl bg-zinc-950/95 text-white border border-indigo-500/50 shadow-[0_18px_45px_rgba(0,0,0,0.65)] ring-2 ring-indigo-500/25 backdrop-blur-2xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.color} shadow-sm`}>
                <AlarmClock className="w-4 h-4 animate-bounce" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-rose-400">
                    {cfg.badge}
                  </span>
                  <span className="text-[8.5px] font-mono text-zinc-400">
                    {elapsedStr}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-white truncate">
                  {currentAlert.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleMarkAsDone(currentAlert)}
                className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold transition active:scale-90 cursor-pointer"
                title="Mark as Done"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <button
                type="button"
                onClick={() => handleSnooze(currentAlert.id, snoozeOptions[0] || 5)}
                className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition cursor-pointer"
                title="Snooze"
              >
                {snoozeOptions[0] || 5}m
              </button>
              <button
                type="button"
                onClick={() => setPipMode('extended')}
                className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Expand PiP Card"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(currentAlert.id)}
                className="p-1.5 rounded-xl hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                title="Dismiss Alarm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 1C. EXTENDED FLOATING PiP ALARM CARD MODE */}
        {pipMode === 'extended' && (
          <div
            className={`w-[320px] sm:w-[350px] rounded-3xl bg-zinc-950/95 text-white border bg-gradient-to-b ${cfg.accent} shadow-[0_24px_60px_rgba(0,0,0,0.75)] ring-2 ring-indigo-500/30 backdrop-blur-2xl overflow-hidden flex flex-col`}
          >
            {/* PiP Drag Bar & Window Controls Header */}
            <div className="px-3.5 pt-2.5 pb-2 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.03]">
              <div className="flex items-center gap-1.5 min-w-0">
                <GripHorizontal className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className={`p-1 rounded-lg ${cfg.color} shrink-0`}>
                  {cfg.icon}
                </span>
                <span className="text-[9.5px] font-black uppercase tracking-wider text-white truncate">
                  {cfg.badge}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  {elapsedStr}
                </span>
              </div>

              {/* Multi-Alarm Switcher & Window Controls */}
              <div className="flex items-center gap-0.5 shrink-0">
                {activeAlerts.length > 1 && (
                  <div className="flex items-center gap-0.5 mr-1 bg-white/10 rounded-lg px-1 py-0.5 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePipIndex(prev => (prev - 1 + activeAlerts.length) % activeAlerts.length)
                      }
                      className="p-0.5 hover:text-indigo-300 cursor-pointer"
                      title="Previous active alarm"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span>
                      {activePipIndex + 1}/{activeAlerts.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePipIndex(prev => (prev + 1) % activeAlerts.length)}
                      className="p-0.5 hover:text-indigo-300 cursor-pointer"
                      title="Next active alarm"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title={isMuted ? 'Unmute alarm ringtone' : 'Mute alarm ringtone'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPipMode('compact')}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Compact PiP Bar"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setPipMode('mini')}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Minimize to Floating Alarm Pill"
                >
                  <PictureInPicture2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDismiss(currentAlert.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                  title="Dismiss Alarm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Active Item Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                      Active Now • PiP Monitor
                    </span>
                    {!isMuted && (
                      <span className="inline-flex items-end gap-0.5 h-2.5 px-1">
                        <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="w-0.5 h-2.5 bg-indigo-400 rounded-full animate-pulse" />
                        <span className="w-0.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-[15px] font-extrabold text-white leading-snug">
                    {currentAlert.title}
                  </h3>
                  {currentAlert.subtitle && (
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed line-clamp-2">
                      {currentAlert.subtitle}
                    </p>
                  )}
                </div>

                {/* Jump to Active Task / Habit / Item */}
                <button
                  type="button"
                  onClick={() => handleJumpToItem(currentAlert)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition shrink-0 cursor-pointer"
                  title={`Open in ${cfg.label}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Metadata Pill Row */}
              <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 bg-white/[0.04] rounded-xl px-3 py-1.5 border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>
                    {currentAlert.dueTime ? `Scheduled: ${currentAlert.dueTime}` : 'Scheduled Alarm Active'}
                  </span>
                </div>
                <span className="font-mono text-[9.5px] text-emerald-400 font-semibold">
                  No Vibration • Audio Chime
                </span>
              </div>

              {/* Primary Complete & Snooze Controls */}
              <div className="flex flex-col gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleMarkAsDone(currentAlert)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Mark {cfg.label.replace(/s$/, '')} Done</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {snoozeOptions.map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSnooze(currentAlert.id, mins)}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 hover:text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Snooze {mins}m</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleDismiss(currentAlert.id)}
                    className="py-1.5 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[10px] uppercase tracking-wider transition active:scale-95 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODE 2: CLASSIC TOP ALARM BANNER STACK (classic_banner)
  // ============================================================================
  const groupedAlerts = activeAlerts.reduce((acc, alert) => {
    const cat = alert.source;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(alert);
    return acc;
  }, {} as Record<string, ActiveAlarmData[]>);

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

