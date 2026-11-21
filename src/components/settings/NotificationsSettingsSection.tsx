import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AlarmPopupStyle,
  NotificationPopupStyle,
  soundEngine,
} from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { notificationService } from '../../utils/notifications';
import { M3Switch } from '../common/PetalExpressive';

interface NotificationsSettingsSectionProps {
  onOpenAlarmStudio: () => void;
}

export const NotificationsSettingsSection: React.FC<NotificationsSettingsSectionProps> = ({
  onOpenAlarmStudio,
}) => {
  const {
    hydration,
    toggleWaterReminder,
    toggleAdaptiveWaterReminder,
    sendAdaptiveHydrationNotification,
    pushNotification,
  } = useApp();

  const [notifPopupStyle, setNotifPopupStyle] = useState<NotificationPopupStyle>(() =>
    soundEngine.getNotificationPopupStyle()
  );
  const [alarmPopupStyle, setAlarmPopupStyle] = useState<AlarmPopupStyle>(() =>
    soundEngine.getAlarmPopupStyle()
  );
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const permissionLabel =
    notifPermission === 'granted'
      ? 'Allowed'
      : notifPermission === 'denied'
        ? 'Blocked'
        : 'Ask';

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Group 1: Visual Notification Style Selector (Mini Phone Previews like 00:14) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Notification style
          </span>
          <button
            type="button"
            onClick={() =>
              pushNotification(
                'Sample Task Reminder',
                'Review your top priorities for today',
                'task',
                { sound: 'task' }
              )
            }
            className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Preview
          </button>
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 p-4">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { id: 'ticktick_card' as NotificationPopupStyle, label: 'Sheet', pos: 'bottom' },
              { id: 'dynamic_island' as NotificationPopupStyle, label: 'Pill', pos: 'pill' },
              { id: 'android_heads_up' as NotificationPopupStyle, label: 'Banner', pos: 'top' },
              { id: 'compact_card' as NotificationPopupStyle, label: 'Toast', pos: 'compact' },
            ].map((opt) => {
              const active = notifPopupStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setNotifPopupStyle(opt.id);
                    soundEngine.setNotificationPopupStyle(opt.id);
                    haptics.toggle();
                  }}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <div
                    className={`w-full max-w-[68px] h-[94px] rounded-[14px] p-1.5 border-2 transition flex flex-col justify-between bg-gradient-to-b from-sky-100/70 via-indigo-50/50 to-slate-100 dark:from-zinc-800 dark:to-zinc-950 ${
                      active
                        ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20'
                        : 'border-slate-200 dark:border-zinc-700 opacity-75 group-hover:opacity-100'
                    }`}
                  >
                    {opt.pos === 'pill' ? (
                      <div className="w-9 h-2.5 rounded-full bg-slate-900 dark:bg-indigo-400 mx-auto mt-0.5" />
                    ) : opt.pos === 'top' ? (
                      <div className="w-full h-5 rounded-md bg-white dark:bg-zinc-700 shadow-2xs" />
                    ) : opt.pos === 'compact' ? (
                      <div className="w-10 h-3 rounded-full bg-white dark:bg-zinc-700 shadow-2xs mx-auto mt-0.5" />
                    ) : (
                      <div />
                    )}

                    {opt.pos === 'bottom' ? (
                      <div className="w-full h-7 rounded-lg bg-slate-900 dark:bg-indigo-500/80" />
                    ) : (
                      <div className="h-1 w-5 rounded-full bg-slate-300 dark:bg-zinc-700 mx-auto" />
                    )}
                  </div>
                  <span
                    className={`text-xs truncate ${
                      active
                        ? 'font-semibold text-[#4F46E5] dark:text-indigo-400'
                        : 'font-medium text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Group 2: Alarm Overlay & Permissions */}
      <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
        {/* Active Alarm Overlay Segmented Row */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Active alarm display
            </span>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('omnilifeos_trigger_alarm', {
                    detail: {
                      id: `settings_pip_alarm_${Date.now()}`,
                      source: 'task',
                      title: 'Sample Scheduled Alarm',
                      subtitle: 'Tap Snooze or Complete to dismiss',
                      dueDateLabel: 'Today, 9:00 AM',
                      listIcon: '⏰',
                      listLabel: 'Reminders',
                      dueTime: '09:00',
                      reminderType: 'alarm',
                    },
                  })
                );
              }}
              className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Test alarm
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-slate-100 dark:bg-zinc-800">
            {[
              { id: 'ticktick_card' as AlarmPopupStyle, label: 'Action Sheet' },
              { id: 'pip_card' as AlarmPopupStyle, label: 'Floating PiP' },
              { id: 'classic_banner' as AlarmPopupStyle, label: 'Top Banner' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setAlarmPopupStyle(opt.id);
                  soundEngine.setAlarmPopupStyle(opt.id);
                  haptics.toggle();
                }}
                className={`min-h-[36px] px-2 rounded-full text-xs font-semibold transition cursor-pointer truncate ${
                  alarmPopupStyle === opt.id
                    ? 'bg-white dark:bg-[#4F46E5] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

        {/* Exact Alarms & Snooze */}
        <button
          type="button"
          onClick={onOpenAlarmStudio}
          className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
        >
          <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
            Exact alarms &amp; snooze
          </span>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
        </button>

        <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

        {/* System Notification Permission */}
        <button
          type="button"
          onClick={async () => {
            if (notifPermission !== 'granted') {
              const ok = await notificationService.requestPermission();
              setNotifPermission(ok ? 'granted' : 'denied');
            } else {
              soundEngine.playAlarmChime();
              pushNotification('Test Reminder Alert', 'Notifications are working.', 'task');
            }
          }}
          className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              System notifications
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {notifPermission === 'granted' ? 'Tap to send a test alert' : 'Tap to grant permission'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] shrink-0">
            <span
              className={
                notifPermission === 'granted'
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-slate-400 dark:text-zinc-500'
              }
            >
              {permissionLabel}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600" />
          </div>
        </button>
      </div>

      {/* Group 3: Hydration Reminders */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Hydration reminders
          </span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playWaterDropNotification();
              sendAdaptiveHydrationNotification(true);
            }}
            className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Test chime
          </button>
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          <div
            onClick={() =>
              toggleWaterReminder(!hydration.reminderEnabled, hydration.reminderIntervalHours || 2)
            }
            className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Water intake reminders
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <M3Switch
                checked={Boolean(hydration.reminderEnabled)}
                onChange={(val) => toggleWaterReminder(val, hydration.reminderIntervalHours || 2)}
              />
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100 shrink-0">
              Interval
            </span>
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-zinc-800">
              {[1, 2, 3, 4].map((hrs) => {
                const active = (hydration.reminderIntervalHours || 2) === hrs;
                return (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => toggleWaterReminder(true, hrs)}
                    className={`min-w-[40px] h-8 px-2.5 rounded-full text-xs font-semibold transition cursor-pointer tabular-nums ${
                      active
                        ? 'bg-[#4F46E5] text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {hrs}h
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          <div
            onClick={() => toggleAdaptiveWaterReminder(!hydration.adaptiveRemindersEnabled)}
            className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Adaptive pace coaching
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
                Adjusts prompts toward {hydration.targetMl} ml daily goal
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <M3Switch
                checked={Boolean(hydration.adaptiveRemindersEnabled)}
                onChange={toggleAdaptiveWaterReminder}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
