import React, { useState } from 'react';
import {
  Bell,
  AlarmClock,
  Clock,
  Calendar as CalendarIcon,
  RotateCcw,
  Sparkles,
  Volume2,
  Check,
} from 'lucide-react';
import { ReminderType } from '../../types';
import { soundEngine } from '../../utils/audio';

export interface UnifiedReminderConfigProps {
  dueDate: string;
  dueTime?: string;
  endDate?: string;
  isAllDay?: boolean;
  reminderTiming?: string;
  reminderType?: ReminderType;
  repeatType?: string;
  repeatUntil?: string;
  titleForTest?: string;
  sourceType?: 'task' | 'medication' | 'bill' | 'habit' | 'schedule';
  onChange: (updates: {
    dueDate?: string;
    dueTime?: string;
    endDate?: string;
    isAllDay?: boolean;
    reminderTiming?: string;
    reminderType?: ReminderType;
    repeatType?: string;
    repeatUntil?: string;
  }) => void;
  compact?: boolean;
}

export const UnifiedReminderConfig: React.FC<UnifiedReminderConfigProps> = ({
  dueDate,
  dueTime = '10:00',
  endDate,
  isAllDay = false,
  reminderTiming = 'on_time',
  reminderType = 'notification',
  repeatType = 'none',
  repeatUntil = 'forever',
  titleForTest = 'Scheduled Reminder',
  sourceType = 'task',
  onChange,
  compact = false,
}) => {
  const [testTriggered, setTestTriggered] = useState(false);

  const handleTestAlert = () => {
    soundEngine.resume();
    setTestTriggered(true);
    setTimeout(() => setTestTriggered(false), 2500);

    if (reminderType === 'alarm') {
      soundEngine.playAlarmChime();
      // Trigger ActiveAlarmBanner with audible chime and snooze/action controls (Big notification only)
      window.dispatchEvent(
        new CustomEvent('omnilifeos_trigger_alarm', {
          detail: {
            id: `test-${Date.now()}`,
            source: sourceType,
            title: titleForTest || 'Scheduled Reminder',
            subtitle: 'Audible Alarm Chime with Action Banner',
            dueTime: isAllDay ? 'All Day' : dueTime,
            reminderType: 'alarm',
          },
        })
      );
    } else {
      soundEngine.playSuccessChime();
      // Dispatch in-app toast notification (Small notification only)
      window.dispatchEvent(
        new CustomEvent('omnilifeos_push_toast', {
          detail: {
            title: `🔔 Test Reminder: ${titleForTest || 'Reminder'}`,
            body: `Scheduled for ${isAllDay ? 'All Day' : dueTime} (${reminderTiming.replace('_', ' ')}) • Repeat: ${repeatType !== 'none' ? repeatType : 'None'}`,
            category: sourceType === 'schedule' ? 'task' : sourceType,
            sound: 'task',
          },
        })
      );
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-3.5 sm:p-4 space-y-3.5 ${
      compact ? 'text-xs' : ''
    }`}>
      {/* 1. Due Date & All Day Toggle */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlarmClock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Due Date & Time
            </span>
            <span className="text-[11px] text-slate-400">
              {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Set date'}
              {!isAllDay && dueTime ? ` @ ${dueTime}` : ' (All Day)'}
            </span>
          </div>
        </div>

        {/* All Day Toggle switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span>All Day</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={e => onChange({ isAllDay: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
          </div>
        </label>
      </div>

      {/* Date & Time Input pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Date
          </label>
          <div className="relative">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="date"
              value={dueDate}
              onChange={e => onChange({ dueDate: e.target.value })}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {!isAllDay && (
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Time
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="time"
                value={dueTime}
                onChange={e => onChange({ dueTime: e.target.value })}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Reminder Timing & Reminder Type (Notification vs Alarm) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-indigo-500" />
            <span>Reminder Timing</span>
          </label>

          <select
            value={reminderTiming}
            onChange={e => onChange({ reminderTiming: e.target.value })}
            className="text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="none">No reminder</option>
            <option value="on_time">Remind me when due</option>
            <option value="5m">5 minutes before</option>
            <option value="10m">10 minutes before</option>
            <option value="15m">15 minutes before</option>
            <option value="30m">30 minutes before</option>
            <option value="1h">1 hour before</option>
            <option value="1d">1 day before</option>
          </select>
        </div>

        {/* Reminder Type (None vs Notification vs Alarm) */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Reminder Mode
            </span>
            <span className="text-[10px] text-slate-400 block max-w-xs mt-0.5">
              {reminderType === 'alarm'
                ? '🚨 Urgent: plays persistent audio chime & full-screen action banner with Snooze/Done options.'
                : reminderType === 'notification'
                  ? '🔔 Standard: plays a light notification chime & shows standard toast card.'
                  : '🔇 Disabled: silent. No sound, banner, or popups will trigger.'}
            </span>
          </div>

          {/* Segmented Selector for None vs Notification vs Alarm */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-700/70 text-xs shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => {
                onChange({ reminderType: 'none', reminderTiming: 'none' });
                soundEngine.playClick();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                reminderType === 'none'
                  ? 'bg-slate-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>None</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChange({ reminderType: 'notification', reminderTiming: reminderTiming === 'none' ? 'on_time' : reminderTiming });
                soundEngine.playClick();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                reminderType === 'notification'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notification</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChange({ reminderType: 'alarm', reminderTiming: reminderTiming === 'none' ? 'on_time' : reminderTiming });
                soundEngine.playAlarmChime();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                reminderType === 'alarm'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <AlarmClock className="w-3.5 h-3.5" />
              <span>Alarm</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Repeat & Repeat Until (matching screenshot 1) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span>Repeat</span>
          </label>
          <select
            value={repeatType}
            onChange={e => onChange({ repeatType: e.target.value })}
            className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="none">Never (One-time)</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Every weekday (Mon - Fri)</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {repeatType !== 'none' && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                <span>Repeat End Date</span>
              </span>
              {repeatUntil && repeatUntil !== 'forever' && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Ends {repeatUntil.match(/^\d{4}-\d{2}-\d{2}$/) ? repeatUntil : repeatUntil.replace('_', ' ')}
                </span>
              )}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={repeatUntil?.match(/^\d{4}-\d{2}-\d{2}$/) ? 'custom_date' : (repeatUntil || 'forever')}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom_date') {
                    const nextDate = new Date();
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    const dateStr = nextDate.toISOString().split('T')[0];
                    onChange({ repeatUntil: dateStr, endDate: dateStr });
                  } else {
                    onChange({ repeatUntil: val, endDate: undefined });
                  }
                }}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="forever">♾️ No End Date (Continuous / Forever)</option>
                <option value="custom_date">📅 Specific End Date</option>
                <option value="1_week">For 1 week</option>
                <option value="2_weeks">For 2 weeks</option>
                <option value="1_month">For 1 month</option>
                <option value="3_months">For 3 months</option>
                <option value="6_months">For 6 months</option>
                <option value="1_year">For 1 year</option>
              </select>

              {(repeatUntil?.match(/^\d{4}-\d{2}-\d{2}$/) || endDate) && (
                <input
                  type="date"
                  min={dueDate || undefined}
                  value={repeatUntil?.match(/^\d{4}-\d{2}-\d{2}$/) ? repeatUntil : endDate || ''}
                  onChange={e => {
                    onChange({ repeatUntil: e.target.value, endDate: e.target.value });
                  }}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Live Test Trigger Button */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          Preview how this {reminderType} will alert you
        </span>

        <button
          type="button"
          onClick={handleTestAlert}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition active:scale-95 cursor-pointer shadow-2xs"
        >
          {testTriggered ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Triggered!</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Test {reminderType === 'alarm' ? 'Alarm' : 'Reminder'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
