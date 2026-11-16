import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellDot,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  Play,
  Smartphone,
  ShieldCheck,
  Sparkles,
  PictureInPicture2,
} from 'lucide-react';
import { notificationService, NotificationPermissionStatus } from '../../utils/notifications';
import {
  soundEngine,
  AlarmToneType,
  NotificationSoundType,
  EventSoundCategory,
  NotificationPopupStyle,
  AlarmPopupStyle,
  NOTIFICATION_SOUND_OPTIONS,
  ALARM_TONE_OPTIONS,
  EVENT_SOUND_ITEMS,
} from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { useApp } from '../../context/AppContext';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { pushNotification } = useApp();
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [selectedTone, setSelectedTone] = useState<AlarmToneType>('classic_phone');
  const [selectedNotificationSound, setSelectedNotificationSound] = useState<NotificationSoundType>('tick');
  const [eventSounds, setEventSounds] = useState<Record<EventSoundCategory, string>>(() => soundEngine.getAllEventSounds());
  const [notifPopupStyle, setNotifPopupStyle] = useState<NotificationPopupStyle>(() => soundEngine.getNotificationPopupStyle());
  const [alarmPopupStyle, setAlarmPopupStyle] = useState<AlarmPopupStyle>(() => soundEngine.getAlarmPopupStyle());
  const [hapticsActive, setHapticsActive] = useState<boolean>(() => haptics.getEnabled());
  const [volume, setVolume] = useState<number>(0.8);
  const [soundToggles, setSoundToggles] = useState<Record<string, boolean>>(soundEngine.getAllSoundToggles());
  const [snoozeOptions, setSnoozeOptions] = useState<number[]>(soundEngine.getSnoozeOptions());
  const [stackExpandBehavior, setStackExpandBehavior] = useState<'expanded' | 'collapsed'>(soundEngine.getStackExpandBehavior());
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [alarmCategoryFilter, setAlarmCategoryFilter] = useState<'all' | 'ticktick' | 'tickit'>('all');

  useEffect(() => {
    if (isOpen) {
      setPermission(notificationService.getPermission());
      setSelectedTone(soundEngine.getTone());
      setSelectedNotificationSound(soundEngine.getNotificationSound());
      setEventSounds(soundEngine.getAllEventSounds());
      setNotifPopupStyle(soundEngine.getNotificationPopupStyle());
      setAlarmPopupStyle(soundEngine.getAlarmPopupStyle());
      setHapticsActive(haptics.getEnabled());
      setVolume(soundEngine.getVolume());
      setSoundToggles(soundEngine.getAllSoundToggles());
      setSnoozeOptions(soundEngine.getSnoozeOptions());
      setStackExpandBehavior(soundEngine.getStackExpandBehavior());
      setTestStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermission(notificationService.getPermission());
    if (granted) {
      setTestStatus('✅ System notification permission granted!');
    } else {
      setTestStatus('⚠️ Permission was not granted. Check browser settings.');
    }
  };

  const handleToneChange = (tone: AlarmToneType) => {
    setSelectedTone(tone);
    soundEngine.setTone(tone);
    setEventSounds(soundEngine.getAllEventSounds());
    soundEngine.playAlarmChime(tone);
  };

  const handleNotificationSoundChange = (soundId: NotificationSoundType) => {
    setSelectedNotificationSound(soundId);
    soundEngine.setNotificationSound(soundId);
    setEventSounds(soundEngine.getAllEventSounds());
    soundEngine.playNotificationSound(soundId);
  };

  const handleEventSoundChange = (event: EventSoundCategory, soundId: string) => {
    soundEngine.setEventSound(event, soundId);
    setEventSounds(soundEngine.getAllEventSounds());
    setSelectedTone(soundEngine.getTone());
    setSelectedNotificationSound(soundEngine.getNotificationSound());
    soundEngine.playEventSound(event);
  };

  const handleNotifPopupStyleChange = (style: NotificationPopupStyle) => {
    setNotifPopupStyle(style);
    soundEngine.setNotificationPopupStyle(style);
    haptics.toggle();
  };

  const handleAlarmPopupStyleChange = (style: AlarmPopupStyle) => {
    setAlarmPopupStyle(style);
    soundEngine.setAlarmPopupStyle(style);
    haptics.toggle();
  };

  const handlePreviewNotificationPopup = () => {
    pushNotification(
      'YouTube Task',
      'Search about what value I can provide on YouTube',
      'task',
      { sound: 'task' }
    );
    setTestStatus(
      `✨ Previewing ${
        notifPopupStyle === 'ticktick_card'
          ? 'TickTick Bottom Task Pop-Up Card'
          : notifPopupStyle === 'dynamic_island'
            ? 'Dynamic Island / Camera Pill'
            : notifPopupStyle === 'android_heads_up'
              ? 'Android Heads-Up'
              : 'Compact Card'
      } notification!`
    );
  };

  const handlePreviewAlarmPip = () => {
    window.dispatchEvent(
      new CustomEvent('omnilifeos_trigger_alarm', {
        detail: {
          id: `preview_pip_alarm_${Date.now()}`,
          source: 'task',
          title: 'YouTube Task',
          subtitle: 'Search about what value I can provide on YouTube',
          dueDateLabel: 'Yesterday, 9:00am - 9:20am',
          listIcon: '👋',
          listLabel: 'Welcome',
          dueTime: '09:00',
          reminderType: 'alarm',
        },
      })
    );
    setTestStatus(
      `⏰ Triggered ${
        alarmPopupStyle === 'ticktick_card'
          ? 'TickTick Bottom Task Pop-Up Card'
          : alarmPopupStyle === 'pip_card'
            ? 'Floating PiP Alarm Card'
            : 'Classic Top Alarm Banner'
      } preview!`
    );
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    soundEngine.setVolume(newVol);
  };

  const handleToggleSound = (type: string, enabled: boolean) => {
    soundEngine.setSoundEnabled(type, enabled);
    setSoundToggles(soundEngine.getAllSoundToggles());
    haptics.toggle();
  };

  const handleToggleSnoozeOption = (mins: number) => {
    let updated = [...snoozeOptions];
    if (updated.includes(mins)) {
      if (updated.length > 1) {
        updated = updated.filter(m => m !== mins);
      }
    } else {
      updated.push(mins);
      updated.sort((a, b) => a - b);
    }
    setSnoozeOptions(updated);
    soundEngine.setSnoozeOptions(updated);
    haptics.toggle();
  };

  const handleStackExpandChange = (behavior: 'expanded' | 'collapsed') => {
    setStackExpandBehavior(behavior);
    soundEngine.setStackExpandBehavior(behavior);
    haptics.toggle();
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    setTestStatus('Testing alarm chime and push notification...');
    try {
      const res = await notificationService.testNotificationAlert(selectedTone);
      setTestStatus(`🔔 ${res.message}`);
    } catch {
      setTestStatus('Error triggering test alert.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Notification & Audio Alarm Settings"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <BellDot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Task Reminder Service
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exact-time notifications & audible alarms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Permission Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
              permission === 'granted'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                : permission === 'denied'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {permission === 'granted' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : permission === 'denied' ? (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              ) : (
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {permission === 'granted'
                    ? 'Browser Notifications: Active'
                    : permission === 'denied'
                    ? 'Browser Notifications: Blocked'
                    : 'Browser Notifications: Default'}
                </span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/40">
                  {permission}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {permission === 'granted'
                  ? 'Task reminders will pop up on your desktop/mobile lock screen with sound and action buttons.'
                  : permission === 'denied'
                  ? 'Notifications are blocked in your browser settings. Please allow notifications in site permissions to receive desktop alerts.'
                  : 'Grant notification permission to allow JivanOS to deliver popup reminders even when the tab is hidden.'}
              </p>
              {permission !== 'granted' && permission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="mt-2.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable System Notifications</span>
                </button>
              )}
            </div>
          </div>

          {/* Pop-Up & Floating PiP Display Styles */}
          <div className="space-y-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Notification Pop-Up Style</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Choose Camera Pill (Dynamic Island), Android Heads-Up, or Compact Card
                </p>
              </div>
              <button
                type="button"
                onClick={handlePreviewNotificationPopup}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition cursor-pointer shrink-0"
              >
                Preview Pop-Up
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'ticktick_card' as NotificationPopupStyle,
                  name: 'TickTick Task Pop-Up Card',
                  desc: 'Dark bottom-sheet card with schedule range, Focus target ◉, Snooze & Complete',
                  badge: 'Task Pop-Up',
                },
                {
                  id: 'dynamic_island' as NotificationPopupStyle,
                  name: 'Dynamic Island / Pill',
                  desc: 'Obsidian camera pill that expands on tap',
                  badge: 'Camera Pill',
                },
                {
                  id: 'android_heads_up' as NotificationPopupStyle,
                  name: 'Android Heads-Up',
                  desc: 'Material 3 pop-up banner with quick actions',
                  badge: 'Android',
                },
                {
                  id: 'compact_card' as NotificationPopupStyle,
                  name: 'Compact Card',
                  desc: 'Classic JivanOS swipeable card',
                  badge: 'Classic',
                },
              ].map(style => {
                const isSelected = notifPopupStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => handleNotifPopupStyleChange(style.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                        {style.badge}
                      </span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {style.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {style.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Alarm Floating PiP Card Option */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <PictureInPicture2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Active Alarm Display Style</span>
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Choose TickTick Task Pop-Up Card, Draggable Floating PiP Card, or Top Banner
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePreviewAlarmPip}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition cursor-pointer shrink-0"
                >
                  Preview Task Pop-Up
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'ticktick_card' as AlarmPopupStyle,
                    name: 'TickTick Task Pop-Up',
                    desc: 'Bottom-sheet task reminder card with schedule time, ◉ Focus, Snooze & Complete',
                    badge: 'TickTick Card',
                  },
                  {
                    id: 'pip_card' as AlarmPopupStyle,
                    name: 'Floating PiP Alarm Card',
                    desc: 'Draggable PiP monitor card with live active timer & minimize to pill',
                    badge: 'PiP Active Card',
                  },
                  {
                    id: 'classic_banner' as AlarmPopupStyle,
                    name: 'Classic Top Banner',
                    desc: 'Fixed top-center grouped alarm stack banner',
                    badge: 'Top Banner',
                  },
                ].map(style => {
                  const isSelected = alarmPopupStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => handleAlarmPopupStyleChange(style.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                          {style.badge}
                        </span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {style.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          {style.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 0. Per-Event & Feature Sound Assignment */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Custom Tone per Action (Notification, Alarm, Win Streak, etc.)</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Assign a dedicated tone for each action across JivanOS
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {EVENT_SOUND_ITEMS.map(item => {
                const currentVal = eventSounds[item.id] || item.defaultTone;
                const options = item.pool === 'alarm' ? ALARM_TONE_OPTIONS : NOTIFICATION_SOUND_OPTIONS;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{item.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.desc}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={currentVal}
                        onChange={e => handleEventSoundChange(item.id, e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.icon} {opt.name} ({opt.source})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => soundEngine.playEventSound(item.id)}
                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200/60 dark:border-indigo-800/60 transition cursor-pointer"
                        title={`Preview ${item.label}`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 1. Task & Habit Check-Off Notification Sound */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Check-Off &amp; Win Sound Library ({NOTIFICATION_SOUND_OPTIONS.length})</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Plays instantly when completing a task, habit streak, water log, or bill
                </p>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                TickTick &bull; Tickit
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {NOTIFICATION_SOUND_OPTIONS.map(opt => {
                const isSelected = selectedNotificationSound === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleNotificationSoundChange(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/40 text-indigo-950 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {opt.source}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold truncate flex items-center justify-between">
                        <span>{opt.name}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {opt.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Alarm & Reminder Ringtone Selection */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <BellDot className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Audible Alarm &amp; Reminder Ringtone</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Synthesized ringtones from TickTick and Tickit for exact-time alerts
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setAlarmCategoryFilter('all')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    alarmCategoryFilter === 'all'
                      ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All ({ALARM_TONE_OPTIONS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmCategoryFilter('ticktick')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    alarmCategoryFilter === 'ticktick'
                      ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  TickTick
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmCategoryFilter('tickit')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    alarmCategoryFilter === 'tickit'
                      ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Tickit
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 pt-1">
              {ALARM_TONE_OPTIONS.filter(t => {
                if (alarmCategoryFilter === 'ticktick') return t.source === 'TickTick';
                if (alarmCategoryFilter === 'tickit') return t.source === 'Tickit';
                return true;
              }).map(t => {
                const isSelected = selectedTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToneChange(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl mt-0.5 shrink-0">{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {t.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {t.source}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug line-clamp-1">
                        {t.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tactile Haptics */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tactile Micro-Haptics
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Device vibration patterned after TickTick checkmarks &amp; Tickit habit pops
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  haptics.setEnabled(true);
                  setHapticsActive(true);
                  if (selectedNotificationSound === 'bubble_pop') haptics.pop();
                  else if (selectedNotificationSound === 'coin_clink') haptics.coin();
                  else if (selectedNotificationSound === 'wood_tap') haptics.knock();
                  else if (selectedNotificationSound === 'streak_fanfare') haptics.celebration();
                  else haptics.tick();
                  soundEngine.playClick();
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
              >
                Test Pulse
              </button>
              <input
                type="checkbox"
                checked={hapticsActive}
                onChange={e => {
                  const val = e.target.checked;
                  setHapticsActive(val);
                  haptics.setEnabled(val);
                  if (val) haptics.tick();
                }}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                {volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-500" />
                )}
                <span>Alert Sound Volume</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={e => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
            />
          </div>

          {/* Per-Type Sound Toggles */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Sound Effects by Notification Type
            </h4>
            <div className="space-y-2">
              {[
                { id: 'task', label: 'Task Reminders', icon: '📝' },
                { id: 'medication', label: 'Medications', icon: '💊' },
                { id: 'water', label: 'Hydration / Water', icon: '💧' },
                { id: 'bill', label: 'Bills & Finance', icon: '💳' },
                { id: 'habit', label: 'Daily Habits', icon: '🔄' },
                { id: 'schedule', label: 'Schedule / Calendar', icon: '📅' },
                { id: 'quote', label: 'Daily Wisdom', icon: '✨' },
              ].map(item => {
                const isEnabled = soundToggles[item.id] !== false;
                return (
                  <div key={item.id} className="flex items-center justify-between text-xs py-1">
                    <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleSound(item.id, !isEnabled)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        isEnabled
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {isEnabled ? 'Sound ON' : 'Sound OFF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alarm Patterns Settings */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Alarm Patterns & Stack Behavior
            </h4>

            {/* Custom Snooze Durations */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Custom Snooze Durations
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[1, 2, 5, 10, 15, 30].map(mins => {
                  const isSelected = snoozeOptions.includes(mins);
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleToggleSnoozeOption(mins)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Select active snooze interval options available when alarms trigger.
              </p>
            </div>

            {/* Global Alarm Stack Expansion Behavior */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Simultaneous Alarm Stack Expansion
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStackExpandChange('expanded')}
                  className={`p-2 rounded-xl border text-left transition text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    stackExpandBehavior === 'expanded'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>Expanded by Default</span>
                  {stackExpandBehavior === 'expanded' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleStackExpandChange('collapsed')}
                  className={`p-2 rounded-xl border text-left transition text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    stackExpandBehavior === 'collapsed'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>Collapsed by Default</span>
                  {stackExpandBehavior === 'collapsed' && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                </button>
              </div>
            </div>
          </div>

          {/* Exact Scheduling Engine Info */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>High-Precision Background Scheduler</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Uses an unthrottled Web Worker background ticker combined with Service Worker notifications
              and HTML5 audio synthesis. Reminders trigger accurately down to the exact second even when
              tabs are backgrounded.
            </p>
          </div>

          {/* Test Status Feedback */}
          {testStatus && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium animate-in fade-in duration-150">
              {testStatus}
            </div>
          )}
        </div>

        {/* Footer with Test Button */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestAlert}
            disabled={isTesting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isTesting ? 'Testing...' : 'Test Alarm Sound & Alert'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
