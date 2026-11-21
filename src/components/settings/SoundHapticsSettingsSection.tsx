import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Play, Volume2, VolumeX } from 'lucide-react';
import {
  ALARM_TONE_OPTIONS,
  AlarmToneType,
  EVENT_SOUND_ITEMS,
  EventSoundCategory,
  NOTIFICATION_SOUND_OPTIONS,
  NotificationSoundType,
  soundEngine,
} from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { M3Switch } from '../common/PetalExpressive';

type SoundDrawer = 'alarm' | 'notification' | 'actions' | 'channels' | null;

const SOUND_CHANNELS = [
  { key: 'task', label: 'Tasks & subtasks' },
  { key: 'habit', label: 'Habit streaks' },
  { key: 'schedule', label: 'Timeline blocks' },
  { key: 'medication', label: 'Medication doses' },
  { key: 'water', label: 'Water & hydration' },
  { key: 'bill', label: 'Bills & finance' },
] as const;

export const SoundHapticsSettingsSection: React.FC = () => {
  const [masterVolume, setMasterVolume] = useState<number>(() => soundEngine.getVolume());
  const [selectedTone, setSelectedTone] = useState<AlarmToneType>(() => soundEngine.getTone());
  const [selectedNotificationSound, setSelectedNotificationSound] =
    useState<NotificationSoundType>(() => soundEngine.getNotificationSound());
  const [eventSounds, setEventSounds] = useState<Record<EventSoundCategory, string>>(() =>
    soundEngine.getAllEventSounds()
  );
  const [alarmCategoryFilter, setAlarmCategoryFilter] = useState<'all' | 'ticktick' | 'tickit'>(
    'all'
  );
  const [soundToggles, setSoundToggles] = useState<Record<string, boolean>>(() =>
    soundEngine.getAllSoundToggles()
  );
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => haptics.getEnabled());
  const [openDrawer, setOpenDrawer] = useState<SoundDrawer>(null);

  const volumePercent = Math.round(masterVolume * 100);
  const selectedAlarmLabel =
    ALARM_TONE_OPTIONS.find((t) => t.id === selectedTone)?.name || 'Default';
  const selectedNotifLabel =
    NOTIFICATION_SOUND_OPTIONS.find((t) => t.id === selectedNotificationSound)?.name || 'Default';
  const enabledChannelCount = SOUND_CHANNELS.filter((c) => soundToggles[c.key] !== false).length;

  const toggleDrawer = (drawer: Exclude<SoundDrawer, null>) => {
    setOpenDrawer((prev) => (prev === drawer ? null : drawer));
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Group 1: Volume & Haptics (Thick M3 Expressive Pill Slider) */}
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Volume &amp; vibration
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          {/* Thick M3 Pill Volume Slider */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Master volume
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = masterVolume > 0 ? 0 : 0.8;
                  setMasterVolume(next);
                  soundEngine.setVolume(next);
                  if (next > 0) soundEngine.playClick();
                }}
                className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer tabular-nums"
              >
                {volumePercent === 0 ? 'Muted · Unmute' : `${volumePercent}%`}
              </button>
            </div>

            <div className="relative h-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 overflow-hidden select-none">
              <div
                className="absolute inset-y-0 left-0 bg-[#4F46E5] transition-[width] duration-75 rounded-2xl"
                style={{ width: `${Math.max(volumePercent, volumePercent > 0 ? 11 : 0)}%` }}
              />
              <div className="relative z-10 h-full px-3.5 flex items-center justify-between pointer-events-none">
                {volumePercent === 0 ? (
                  <VolumeX className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    volumePercent >= 88
                      ? 'text-white'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {volumePercent}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Master volume"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setMasterVolume(val);
                  soundEngine.setVolume(val);
                }}
                onMouseUp={() => soundEngine.playClick()}
                onTouchEnd={() => soundEngine.playClick()}
                className="absolute inset-0 z-20 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Tactile Haptics Row */}
          <div
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              haptics.setEnabled(next);
              if (next) haptics.trigger(15);
            }}
            className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Tactile haptics
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Subtle vibration for taps &amp; check-offs
              </p>
            </div>
            <div
              className="flex items-center gap-3 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  haptics.setEnabled(true);
                  setHapticsEnabled(true);
                  haptics.trigger(20);
                  soundEngine.playClick();
                }}
                className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Test
              </button>
              <M3Switch
                checked={hapticsEnabled}
                onChange={(enabled) => {
                  setHapticsEnabled(enabled);
                  haptics.setEnabled(enabled);
                  if (enabled) haptics.trigger(15);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Group 2: Ringtones, Tones & Channels (Compact Expandable Phone Rows) */}
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Ringtones &amp; sounds
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          {/* 1. Alarm ringtone */}
          <button
            type="button"
            onClick={() => toggleDrawer('alarm')}
            className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Alarm ringtone
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500 shrink-0 max-w-[50%]">
              <span className="truncate">{selectedAlarmLabel}</span>
              {openDrawer === 'alarm' ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
            </div>
          </button>

          {openDrawer === 'alarm' && (
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
                  {ALARM_TONE_OPTIONS.length} synthesized tones
                </span>
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-zinc-800">
                  {[
                    { id: 'all' as const, label: 'All' },
                    { id: 'ticktick' as const, label: 'Classic' },
                    { id: 'tickit' as const, label: 'Modern' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAlarmCategoryFilter(tab.id)}
                      className={`min-h-[30px] px-2.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                        alarmCategoryFilter === tab.id
                          ? 'bg-white dark:bg-[#4F46E5] text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-0.5">
                {ALARM_TONE_OPTIONS.filter((t) => {
                  if (alarmCategoryFilter === 'ticktick') return t.source === 'TickTick';
                  if (alarmCategoryFilter === 'tickit') return t.source === 'Tickit';
                  return true;
                }).map((t) => {
                  const isSelected = selectedTone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTone(t.id);
                        soundEngine.setTone(t.id);
                        setEventSounds(soundEngine.getAllEventSounds());
                        soundEngine.playAlarmChime(t.id);
                      }}
                      className={`min-h-[54px] px-3 py-2.5 rounded-2xl text-left transition cursor-pointer flex flex-col justify-between gap-0.5 ${
                        isSelected
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-slate-50 dark:bg-zinc-800/70 text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{t.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <span
                        className={`text-[11px] line-clamp-1 ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* 2. Notification tone */}
          <button
            type="button"
            onClick={() => toggleDrawer('notification')}
            className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Notification tone
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500 shrink-0 max-w-[50%]">
              <span className="truncate">{selectedNotifLabel}</span>
              {openDrawer === 'notification' ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
            </div>
          </button>

          {openDrawer === 'notification' && (
            <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-0.5">
                {NOTIFICATION_SOUND_OPTIONS.map((opt) => {
                  const isSelected = selectedNotificationSound === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedNotificationSound(opt.id);
                        soundEngine.setNotificationSound(opt.id);
                        setEventSounds(soundEngine.getAllEventSounds());
                        soundEngine.playNotificationSound(opt.id);
                      }}
                      className={`min-h-[54px] px-3 py-2.5 rounded-2xl text-left transition cursor-pointer flex flex-col justify-between gap-0.5 ${
                        isSelected
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-slate-50 dark:bg-zinc-800/70 text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{opt.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <span
                        className={`text-[11px] line-clamp-1 ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* 3. Tone per action */}
          <button
            type="button"
            onClick={() => toggleDrawer('actions')}
            className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Tone per action
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500 shrink-0 tabular-nums">
              <span>{EVENT_SOUND_ITEMS.length} actions</span>
              {openDrawer === 'actions' ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
            </div>
          </button>

          {openDrawer === 'actions' && (
            <div className="px-4 pb-3 pt-1 divide-y divide-slate-100 dark:divide-zinc-800/80 border-t border-slate-100 dark:border-zinc-800/80">
              {EVENT_SOUND_ITEMS.map((item) => {
                const currentVal = eventSounds[item.id] || item.defaultTone;
                const options =
                  item.pool === 'alarm' ? ALARM_TONE_OPTIONS : NOTIFICATION_SOUND_OPTIONS;
                return (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                        {item.label}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {item.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          soundEngine.setEventSound(item.id, val);
                          setEventSounds(soundEngine.getAllEventSounds());
                          setSelectedTone(soundEngine.getTone());
                          setSelectedNotificationSound(soundEngine.getNotificationSound());
                          soundEngine.playEventSound(item.id);
                        }}
                        className="h-9 max-w-[140px] sm:max-w-[170px] px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-xs font-medium text-slate-800 dark:text-zinc-200 cursor-pointer"
                      >
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => soundEngine.playEventSound(item.id)}
                        aria-label={`Preview ${item.label}`}
                        className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[#4F46E5] dark:text-indigo-300 inline-flex items-center justify-center transition cursor-pointer shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* 4. Sound channels */}
          <button
            type="button"
            onClick={() => toggleDrawer('channels')}
            className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Sound channels
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500 shrink-0 tabular-nums">
              <span>
                {enabledChannelCount} of {SOUND_CHANNELS.length} on
              </span>
              {openDrawer === 'channels' ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
            </div>
          </button>

          {openDrawer === 'channels' && (
            <div className="px-4 pb-2 divide-y divide-slate-100 dark:divide-zinc-800/80 border-t border-slate-100 dark:border-zinc-800/80">
              {SOUND_CHANNELS.map((cat) => {
                const isOn = soundToggles[cat.key] !== false;
                return (
                  <div
                    key={cat.key}
                    onClick={() => {
                      const next = !isOn;
                      soundEngine.setSoundEnabled(cat.key, next);
                      setSoundToggles(soundEngine.getAllSoundToggles());
                      if (next) soundEngine.playClick();
                    }}
                    className="min-h-[48px] py-2 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                      {cat.label}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <M3Switch
                        checked={isOn}
                        onChange={(next) => {
                          soundEngine.setSoundEnabled(cat.key, next);
                          setSoundToggles(soundEngine.getAllSoundToggles());
                          if (next) soundEngine.playClick();
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
