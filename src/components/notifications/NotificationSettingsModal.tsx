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
} from 'lucide-react';
import { notificationService, NotificationPermissionStatus } from '../../utils/notifications';
import { soundEngine, AlarmToneType } from '../../utils/audio';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [selectedTone, setSelectedTone] = useState<AlarmToneType>('dual_bell');
  const [volume, setVolume] = useState<number>(0.8);
  const [soundToggles, setSoundToggles] = useState<Record<string, boolean>>(soundEngine.getAllSoundToggles());
  const [snoozeOptions, setSnoozeOptions] = useState<number[]>(soundEngine.getSnoozeOptions());
  const [stackExpandBehavior, setStackExpandBehavior] = useState<'expanded' | 'collapsed'>(soundEngine.getStackExpandBehavior());
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermission(notificationService.getPermission());
      setSelectedTone(soundEngine.getTone());
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
    soundEngine.playAlarmChime(tone);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    soundEngine.setVolume(newVol);
  };

  const handleToggleSound = (type: string, enabled: boolean) => {
    soundEngine.setSoundEnabled(type, enabled);
    setSoundToggles(soundEngine.getAllSoundToggles());
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
  };

  const handleStackExpandChange = (behavior: 'expanded' | 'collapsed') => {
    setStackExpandBehavior(behavior);
    soundEngine.setStackExpandBehavior(behavior);
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

  const toneOptions: { id: AlarmToneType; name: string; desc: string; icon: string }[] = [
    {
      id: 'drop',
      name: 'Water Drip',
      desc: 'Crisp liquid water drip chime (< 1s) for clean, non-irritating alerts',
      icon: '💧',
    },
    {
      id: 'dual_bell',
      name: 'Classic Dual Bell',
      desc: 'Distinctive Ding-Dong alert, perfect for deadlines',
      icon: '🔔',
    },
    {
      id: 'melody',
      name: 'Melodic Arpeggio',
      desc: 'Bright upward 4-note chime (E5-G#5-B5-E6)',
      icon: '🎵',
    },
    {
      id: 'urgent',
      name: 'Urgent Pulse',
      desc: 'Rapid triple pulse for high-priority task alarms',
      icon: '🚨',
    },
    {
      id: 'chime',
      name: 'Glass Bell Chime',
      desc: 'Gentle, resonant bell with sustained harmonic decay',
      icon: '✨',
    },
  ];

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
                  : 'Grant notification permission to allow OmniLifeOS to deliver popup reminders even when the tab is hidden.'}
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

          {/* Alarm Chime Tone Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Audible Alarm Tone</span>
              </label>
              <span className="text-[11px] text-slate-400">Click tone to preview</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {toneOptions.map(t => {
                const isSelected = selectedTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToneChange(t.id)}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl mt-0.5">{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                        {t.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
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
