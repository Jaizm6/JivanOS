/**
 * JivanOS Audio Engine
 * High-Fidelity Synthetic Audio Engine featuring authentic sound profiles from:
 * 1. TickTick (Task Check-Offs, Alarm Ringtones & Ambient Focus)
 * 2. Tickit: Habit Tracker & Daily Planner (Habit Check-Offs, Routine Bells & Fanfares)
 * 
 * 100% offline, zero external dependencies, instantaneous Web Audio API synthesis.
 */

import { AlarmToneType, NotificationSoundType, EventSoundCategory } from '../types';
import { haptics } from './haptics';

export type { AlarmToneType, NotificationSoundType, EventSoundCategory };

export interface SoundOption<T> {
  id: T;
  name: string;
  source: 'TickTick' | 'Tickit' | 'Both';
  desc: string;
  icon: string;
}

export interface EventSoundMeta {
  id: EventSoundCategory;
  label: string;
  desc: string;
  icon: string;
  pool: 'notification' | 'alarm';
  defaultTone: NotificationSoundType | AlarmToneType;
}

export const EVENT_SOUND_ITEMS: EventSoundMeta[] = [
  {
    id: 'task_complete',
    label: 'Task & Subtask Check-off',
    desc: 'Plays when completing tasks, subtasks, or inbox items',
    icon: '✅',
    pool: 'notification',
    defaultTone: 'tick',
  },
  {
    id: 'habit_complete',
    label: 'Habit Check-off',
    desc: 'Plays when logging daily habits or routines',
    icon: '🫧',
    pool: 'notification',
    defaultTone: 'bubble_pop',
  },
  {
    id: 'win_streak',
    label: 'Win Streak & Goal Milestone',
    desc: 'Plays when hitting a habit streak, goal win, or achievement',
    icon: '🏆',
    pool: 'notification',
    defaultTone: 'win_triumph',
  },
  {
    id: 'notification',
    label: 'General Notification & Alert',
    desc: 'Plays for system notifications, captures, and updates',
    icon: '🔔',
    pool: 'notification',
    defaultTone: 'bell_ding',
  },
  {
    id: 'water_log',
    label: 'Water & Hydration Log',
    desc: 'Plays when logging water intake or hydration goals',
    icon: '💧',
    pool: 'notification',
    defaultTone: 'water_drop',
  },
  {
    id: 'bill_paid',
    label: 'Bill Paid & Finance',
    desc: 'Plays when marking a bill paid or logging finance items',
    icon: '🪙',
    pool: 'notification',
    defaultTone: 'coin_clink',
  },
  {
    id: 'alarm_ringtone',
    label: 'Task & Schedule Alarm Ringtone',
    desc: 'Main ringtone for scheduled task & timeline alarms (no vibration)',
    icon: '📞',
    pool: 'alarm',
    defaultTone: 'classic_phone',
  },
  {
    id: 'medication_alarm',
    label: 'Medication Dose Alarm',
    desc: 'Ringtone for scheduled pill & supplement reminders',
    icon: '💊',
    pool: 'alarm',
    defaultTone: 'gentle_bell',
  },
  {
    id: 'timer_complete',
    label: 'Focus & Pomodoro Timer Finish',
    desc: 'Ringtone when a focus session or countdown completes',
    icon: '🧘',
    pool: 'alarm',
    defaultTone: 'zen_bell',
  },
];

export const NOTIFICATION_SOUND_OPTIONS: SoundOption<NotificationSoundType>[] = [
  {
    id: 'tick',
    name: 'Tick (TickTick Default)',
    source: 'TickTick',
    desc: 'The iconic crisp, acoustic check-off click (pomo_task_complete)',
    icon: '✓',
  },
  {
    id: 'bubble_pop',
    name: 'Bubble Pop',
    source: 'Tickit',
    desc: 'Soft, pleasant rising liquid bubble pop for habits',
    icon: '🫧',
  },
  {
    id: 'coin_clink',
    name: 'Coin Clink',
    source: 'Tickit',
    desc: 'Gamified double metallic coin reward clink',
    icon: '🪙',
  },
  {
    id: 'wood_tap',
    name: 'Wood Knock',
    source: 'Both',
    desc: 'Warm, organic acoustic hollow wood block tap',
    icon: '🪵',
  },
  {
    id: 'water_drop',
    name: 'Water Drop',
    source: 'Both',
    desc: 'Clean, soothing liquid droplet resonance',
    icon: '💧',
  },
  {
    id: 'bell_ding',
    name: 'Concierge Ding',
    source: 'TickTick',
    desc: 'Clear metallic service desk bell chime',
    icon: '🔔',
  },
  {
    id: 'harp_strum',
    name: 'Harp Flourish',
    source: 'Tickit',
    desc: 'Four-note ascending acoustic harp strum',
    icon: '🎵',
  },
  {
    id: 'streak_fanfare',
    name: 'Streak Fanfare',
    source: 'Tickit',
    desc: 'Triumphant celebratory chord for habit milestones',
    icon: '🏆',
  },
  {
    id: 'win_triumph',
    name: 'Victory Triumph',
    source: 'Tickit',
    desc: 'Grand brass & chime fanfare for goal wins & big streaks',
    icon: '👑',
  },
  {
    id: 'level_up',
    name: '8-Bit Level Up',
    source: 'Tickit',
    desc: 'Retro arcade power-up arpeggio for gamified wins',
    icon: '🕹️',
  },
  {
    id: 'magic_chime',
    name: 'Magic Shimmer',
    source: 'Tickit',
    desc: 'Sparkling high-harmonic fairy dust shimmer',
    icon: '🪄',
  },
  {
    id: 'glass_clink',
    name: 'Crystal Clink',
    source: 'TickTick',
    desc: 'Crisp high-frequency crystal glass ping',
    icon: '🥂',
  },
  {
    id: 'camera_snap',
    name: 'Shutter Snap',
    source: 'TickTick',
    desc: 'Tactile mechanical camera shutter click',
    icon: '📸',
  },
  {
    id: 'whistle_chirp',
    name: 'Upbeat Whistle',
    source: 'Tickit',
    desc: 'Cheerful two-note whistle tweet',
    icon: '😙',
  },
];

export const ALARM_TONE_OPTIONS: SoundOption<AlarmToneType>[] = [
  {
    id: 'classic_phone',
    name: 'Classic Phone Ring',
    source: 'Tickit',
    desc: 'Authentic vintage rotary telephone dual-bell ring (Brrr-Brrr!)',
    icon: '☎️',
  },
  {
    id: 'digital_phone',
    name: 'Modern Phone Ring',
    source: 'Both',
    desc: 'Classic electronic cellular phone trill ringtone',
    icon: '📱',
  },
  {
    id: 'twin_bell_alarm',
    name: 'Twin Bell Alarm Clock',
    source: 'Tickit',
    desc: 'Mechanical hammer striking twin metal alarm bells',
    icon: '⏰',
  },
  {
    id: 'digital_alarm',
    name: 'Digital Beep Alarm',
    source: 'TickTick',
    desc: 'Classic bedside quartz Beep-Beep-Beep-Beep alarm',
    icon: '📟',
  },
  {
    id: 'ticktick_default',
    name: 'TickTick Signature',
    source: 'TickTick',
    desc: 'Bright dual-bell harmonic chime (D5 → A5)',
    icon: '🔔',
  },
  {
    id: 'jingle',
    name: 'Jingle Bell',
    source: 'TickTick',
    desc: 'Bright dual-metallic bell ring',
    icon: '✨',
  },
  {
    id: 'spiral',
    name: 'Spiral Ascending',
    source: 'TickTick',
    desc: 'Upward 5-note melodic spiral arpeggio',
    icon: '🌀',
  },
  {
    id: 'aurora',
    name: 'Aurora Swell',
    source: 'TickTick',
    desc: 'Warm ambient synthesizer chord swell',
    icon: '🌌',
  },
  {
    id: 'breeze',
    name: 'Airy Breeze',
    source: 'TickTick',
    desc: 'Light acoustic wind chime melody',
    icon: '🍃',
  },
  {
    id: 'crystal',
    name: 'Crystal Strike',
    source: 'TickTick',
    desc: 'Sparkling high-register crystalline chime',
    icon: '💎',
  },
  {
    id: 'echo',
    name: 'Spatial Echo',
    source: 'TickTick',
    desc: 'Reverberant acoustic chime with rhythmic tail',
    icon: '📢',
  },
  {
    id: 'harp',
    name: 'Ascending Harp',
    source: 'TickTick',
    desc: 'Delicate acoustic harp arpeggio',
    icon: '🎶',
  },
  {
    id: 'marimba',
    name: 'Warm Marimba',
    source: 'TickTick',
    desc: 'Percussive wooden mallet melodic phrase',
    icon: '🪵',
  },
  {
    id: 'pulse',
    name: 'Electronic Pulse',
    source: 'TickTick',
    desc: 'Modern electronic rhythmic alert tone',
    icon: '⚡',
  },
  {
    id: 'radar',
    name: 'Radar Ping',
    source: 'TickTick',
    desc: 'High-visibility sonar ping for urgent alarms',
    icon: '🎯',
  },
  {
    id: 'ripple',
    name: 'Water Ripple',
    source: 'TickTick',
    desc: 'Hydro-harmonic cascading water ripple tone',
    icon: '🌊',
  },
  {
    id: 'telegraph',
    name: 'Telegraph Chirp',
    source: 'TickTick',
    desc: 'Rapid staccato two-tone notification',
    icon: '📡',
  },
  {
    id: 'twinkle',
    name: 'Music Box Twinkle',
    source: 'TickTick',
    desc: 'Star-like glockenspiel music-box phrase',
    icon: '⭐',
  },
  {
    id: 'xylophone',
    name: 'Bright Xylophone',
    source: 'TickTick',
    desc: 'Energetic acoustic wooden run',
    icon: '🎼',
  },
  {
    id: 'zen_bell',
    name: 'Zen Singing Bowl',
    source: 'Both',
    desc: 'Deep 432Hz Tibetan meditation bell with sustained resonance',
    icon: '🧘',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Chime',
    source: 'Tickit',
    desc: 'Gentle morning glockenspiel acoustic melody',
    icon: '🌅',
  },
  {
    id: 'gentle_bell',
    name: 'Gentle Morning Bell',
    source: 'Tickit',
    desc: 'Soft acoustic bell tone for routine habits',
    icon: '☀️',
  },
  {
    id: 'morning_birds',
    name: 'Morning Birds',
    source: 'Tickit',
    desc: 'Sweet rising woodland birdsong motif',
    icon: '🐦',
  },
  {
    id: 'rooster_alarm',
    name: 'Morning Rooster',
    source: 'Tickit',
    desc: 'Classic dawn rooster crow wake-up call',
    icon: '🐓',
  },
  {
    id: 'cuckoo_clock',
    name: 'Cuckoo Clock',
    source: 'Tickit',
    desc: 'Wooden chalet cuckoo two-note call (G5 → E5)',
    icon: '🕰️',
  },
  {
    id: 'bugle_reveille',
    name: 'Bugle Wake-Up',
    source: 'Tickit',
    desc: 'Energetic brass bugle wake-up fanfare',
    icon: '🎺',
  },
  {
    id: 'wind_chimes',
    name: 'Pentatonic Wind Chimes',
    source: 'Both',
    desc: 'Shimmering metallic patio tubes in the breeze',
    icon: '🎐',
  },
  {
    id: 'piano_chime',
    name: 'Grand Piano Chord',
    source: 'TickTick',
    desc: 'Warm acoustic piano major-9th arpeggio',
    icon: '🎹',
  },
  {
    id: 'guitar_strum',
    name: 'Acoustic Guitar',
    source: 'Tickit',
    desc: 'Warm 6-string acoustic guitar chord strum',
    icon: '🎸',
  },
  {
    id: 'kalimba',
    name: 'Thumb Piano (Kalimba)',
    source: 'Tickit',
    desc: 'Plucked African kalimba tine melody',
    icon: '🪘',
  },
  {
    id: 'singing_bowl',
    name: 'Deep Temple Bell',
    source: 'Both',
    desc: 'Low-frequency resonant temple bronze bell',
    icon: '🛕',
  },
  {
    id: 'brass_bell',
    name: "Ship's Brass Bell",
    source: 'TickTick',
    desc: 'Crisp double-strike maritime watch bell',
    icon: '🛎️',
  },
];

export type NotificationPopupStyle = 'ticktick_card' | 'dynamic_island' | 'android_heads_up' | 'compact_card';
export type AlarmPopupStyle = 'ticktick_card' | 'pip_card' | 'classic_banner';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;
  private masterVolume = 0.8;
  private currentAlarmTone: AlarmToneType = 'classic_phone';
  private currentNotificationSound: NotificationSoundType = 'tick';
  private notificationPopupStyle: NotificationPopupStyle = 'ticktick_card';
  private alarmPopupStyle: AlarmPopupStyle = 'ticktick_card';

  private eventSounds: Record<EventSoundCategory, string> = {
    task_complete: 'tick',
    habit_complete: 'bubble_pop',
    win_streak: 'win_triumph',
    notification: 'bell_ding',
    water_log: 'water_drop',
    bill_paid: 'coin_clink',
    alarm_ringtone: 'classic_phone',
    medication_alarm: 'gentle_bell',
    timer_complete: 'zen_bell',
  };

  private typeSoundEnabled: Record<string, boolean> = {
    task: true,
    medication: true,
    water: true,
    bill: true,
    habit: true,
    schedule: true,
    quote: true,
  };

  private snoozeOptions: number[] = [2, 5, 10];
  private stackExpandBehavior: 'expanded' | 'collapsed' = 'expanded';
  private toastSwipeThreshold = 70;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedVol = localStorage.getItem('omniplan_audio_volume');
      if (savedVol) this.masterVolume = parseFloat(savedVol) || 0.8;

      const savedTone = localStorage.getItem('omniplan_alarm_tone') as AlarmToneType | null;
      if (savedTone) {
        this.currentAlarmTone = this.normalizeAlarmTone(savedTone);
        this.eventSounds.alarm_ringtone = this.currentAlarmTone;
      }

      const savedNotif = localStorage.getItem('omniplan_completion_sound') as NotificationSoundType | null;
      if (savedNotif) {
        this.currentNotificationSound = savedNotif;
        this.eventSounds.task_complete = savedNotif;
      }

      const savedEventMap = localStorage.getItem('omniplan_event_sounds');
      if (savedEventMap) {
        try {
          const parsed = JSON.parse(savedEventMap);
          this.eventSounds = { ...this.eventSounds, ...parsed };
          if (parsed.alarm_ringtone) {
            this.currentAlarmTone = this.normalizeAlarmTone(parsed.alarm_ringtone);
          }
          if (parsed.task_complete) {
            this.currentNotificationSound = parsed.task_complete as NotificationSoundType;
          }
        } catch {}
      }

      const savedNotifPopup = localStorage.getItem('omniplan_notif_popup_style_v2') as NotificationPopupStyle | null;
      if (
        savedNotifPopup === 'ticktick_card' ||
        savedNotifPopup === 'dynamic_island' ||
        savedNotifPopup === 'android_heads_up' ||
        savedNotifPopup === 'compact_card'
      ) {
        this.notificationPopupStyle = savedNotifPopup;
      }

      const savedAlarmPopup = localStorage.getItem('omniplan_alarm_popup_style_v2') as AlarmPopupStyle | null;
      if (
        savedAlarmPopup === 'ticktick_card' ||
        savedAlarmPopup === 'pip_card' ||
        savedAlarmPopup === 'classic_banner'
      ) {
        this.alarmPopupStyle = savedAlarmPopup;
      }

      const savedSnooze = localStorage.getItem('omniplan_alarm_snooze_options');
      if (savedSnooze) {
        try {
          this.snoozeOptions = JSON.parse(savedSnooze);
        } catch {}
      }

      const savedExpand = localStorage.getItem('omniplan_alarm_stack_expand') as 'expanded' | 'collapsed' | null;
      if (savedExpand) this.stackExpandBehavior = savedExpand;

      const savedThreshold = localStorage.getItem('omniplan_toast_swipe_threshold');
      if (savedThreshold) {
        const val = parseInt(savedThreshold, 10);
        if (!isNaN(val)) this.toastSwipeThreshold = val;
      }

      ['task', 'medication', 'water', 'bill', 'habit', 'schedule', 'quote'].forEach(type => {
        const saved = localStorage.getItem(`omniplan_sound_toggle_${type}`);
        if (saved !== null) {
          this.typeSoundEnabled[type] = saved === 'true';
        }
      });

      const unlockAudio = () => {
        this.resume();
        if (this.ctx && this.ctx.state === 'running') {
          this.isUnlocked = true;
        }
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  private normalizeAlarmTone(tone: string): AlarmToneType {
    // Map legacy JivanOS tones to corresponding TickTick / Tickit equivalents
    if (tone === 'dual_bell') return 'jingle';
    if (tone === 'melody') return 'spiral';
    if (tone === 'urgent') return 'radar';
    if (tone === 'chime') return 'crystal';
    if (tone === 'drop' || tone === 'drip') return 'ripple';
    return (tone as AlarmToneType) || 'ticktick_default';
  }

  resume() {
    if (this.masterVolume === 0) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private initCtx(): AudioContext | null {
    this.resume();
    return this.ctx;
  }

  // Volume Controls
  setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_audio_volume', this.masterVolume.toString());
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  // Alarm Tone Controls
  setTone(tone: AlarmToneType) {
    this.currentAlarmTone = this.normalizeAlarmTone(tone);
    this.eventSounds.alarm_ringtone = this.currentAlarmTone;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_alarm_tone', this.currentAlarmTone);
      localStorage.setItem('omniplan_event_sounds', JSON.stringify(this.eventSounds));
    }
  }

  getTone(): AlarmToneType {
    return this.currentAlarmTone;
  }

  setAlarmTone(tone: AlarmToneType) {
    this.setTone(tone);
  }

  getAlarmTone(): AlarmToneType {
    return this.getTone();
  }

  // Notification / Completion Sound Controls
  setNotificationSound(sound: NotificationSoundType) {
    this.currentNotificationSound = sound;
    this.eventSounds.task_complete = sound;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_completion_sound', sound);
      localStorage.setItem('omniplan_event_sounds', JSON.stringify(this.eventSounds));
    }
  }

  getNotificationSound(): NotificationSoundType {
    return this.currentNotificationSound;
  }

  // Per-Event Sound Assignment Controls
  getEventSound(event: EventSoundCategory): string {
    return this.eventSounds[event] || 'tick';
  }

  setEventSound(event: EventSoundCategory, soundId: string) {
    this.eventSounds[event] = soundId;
    if (event === 'alarm_ringtone') {
      this.currentAlarmTone = this.normalizeAlarmTone(soundId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('omniplan_alarm_tone', this.currentAlarmTone);
      }
    } else if (event === 'task_complete') {
      this.currentNotificationSound = soundId as NotificationSoundType;
      if (typeof window !== 'undefined') {
        localStorage.setItem('omniplan_completion_sound', soundId);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_event_sounds', JSON.stringify(this.eventSounds));
    }
  }

  getAllEventSounds(): Record<EventSoundCategory, string> {
    return { ...this.eventSounds };
  }

  playEventSound(event: EventSoundCategory) {
    const meta = EVENT_SOUND_ITEMS.find(item => item.id === event);
    const assigned = this.eventSounds[event] || meta?.defaultTone || 'tick';
    if (meta?.pool === 'alarm') {
      this.playAlarmChime(assigned as AlarmToneType);
    } else {
      this.playNotificationSound(assigned as NotificationSoundType);
    }
  }

  // Category Sound Toggles
  isSoundEnabled(category: string): boolean {
    return this.typeSoundEnabled[category] !== false;
  }

  setSoundEnabled(category: string, enabled: boolean) {
    this.typeSoundEnabled[category] = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`omniplan_sound_toggle_${category}`, enabled.toString());
    }
  }

  getAllSoundToggles(): Record<string, boolean> {
    return { ...this.typeSoundEnabled };
  }

  getSnoozeOptions(): number[] {
    return [...this.snoozeOptions];
  }

  setSnoozeOptions(options: number[]) {
    this.snoozeOptions = options;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_alarm_snooze_options', JSON.stringify(options));
    }
  }

  getStackExpandBehavior(): 'expanded' | 'collapsed' {
    return this.stackExpandBehavior;
  }

  setStackExpandBehavior(behavior: 'expanded' | 'collapsed') {
    this.stackExpandBehavior = behavior;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_alarm_stack_expand', behavior);
    }
  }

  getToastSwipeThreshold(): number {
    return this.toastSwipeThreshold;
  }

  setToastSwipeThreshold(val: number) {
    this.toastSwipeThreshold = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_toast_swipe_threshold', val.toString());
    }
  }

  // Notification & Alarm Pop-Up Style Controls
  getNotificationPopupStyle(): NotificationPopupStyle {
    return this.notificationPopupStyle;
  }

  setNotificationPopupStyle(style: NotificationPopupStyle) {
    this.notificationPopupStyle = style;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_notif_popup_style_v2', style);
      window.dispatchEvent(new CustomEvent('omni_popup_style_changed'));
    }
  }

  getAlarmPopupStyle(): AlarmPopupStyle {
    return this.alarmPopupStyle;
  }

  setAlarmPopupStyle(style: AlarmPopupStyle) {
    this.alarmPopupStyle = style;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_alarm_popup_style_v2', style);
      window.dispatchEvent(new CustomEvent('omni_popup_style_changed'));
    }
  }

  /* ========================================================================
   * PART 1: NOTIFICATION & COMPLETION SOUND SYNTHESIS (TickTick & Tickit)
   * ======================================================================== */

  /**
   * 1. TickTick Signature "Tick" (pomo_task_complete)
   * Crisp, acoustic check-off click: snappy transient (~2400Hz -> 600Hz in 12ms) + woody body thump (340Hz -> 140Hz in 45ms).
   */
  private synthTick(ctx: AudioContext, time: number) {
    // Component A: Sharp transient click
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2400, time);
    osc1.frequency.exponentialRampToValueAtTime(600, time + 0.014);

    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.45 * this.masterVolume, time + 0.002);
    gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(time);
    osc1.stop(time + 0.05);

    // Component B: Woody resonant hollow body
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, time);
    filter.Q.setValueAtTime(2.2, time);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(360, time);
    osc2.frequency.exponentialRampToValueAtTime(140, time + 0.04);

    gain2.gain.setValueAtTime(0, time);
    gain2.gain.linearRampToValueAtTime(0.55 * this.masterVolume, time + 0.002);
    gain2.gain.exponentialRampToValueAtTime(0.0001, time + 0.065);

    osc2.connect(filter);
    filter.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(time);
    osc2.stop(time + 0.07);
  }

  /**
   * 2. Tickit Bubble Pop
   * High-pitch rising liquid bubble pop (420Hz -> 1800Hz in 15ms, then settling).
   */
  private synthBubblePop(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, time);
    osc.frequency.exponentialRampToValueAtTime(1850, time + 0.016);
    osc.frequency.exponentialRampToValueAtTime(1350, time + 0.06);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5 * this.masterVolume, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.085);
  }

  /**
   * 3. Tickit Coin Clink
   * Metallic coin reward double-ping (3520Hz + 4186Hz spaced 35ms apart).
   */
  private synthCoinClink(ctx: AudioContext, time: number) {
    const pings = [
      { t: time, freq: 3520 },
      { t: time + 0.035, freq: 4186 },
    ];

    pings.forEach(({ t, freq }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  /**
   * 4. Wood Knock (TickTick / Tickit)
   * Warm acoustic woodblock tap (~480Hz).
   */
  private synthWoodTap(ctx: AudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480, time);
    filter.Q.setValueAtTime(3.5, time);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, time);
    osc.frequency.exponentialRampToValueAtTime(220, time + 0.035);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5 * this.masterVolume, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.055);
  }

  /**
   * 5. Water Drop (TickTick / Tickit)
   * Natural liquid droplet downward scoop into round plop.
   */
  private synthWaterDrop(ctx: AudioContext, time: number) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.connect(ctx.destination);

    // Droplet bubble swoop
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(620, time);
    osc1.frequency.exponentialRampToValueAtTime(1750, time + 0.02);
    osc1.frequency.exponentialRampToValueAtTime(1450, time + 0.09);

    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.5 * this.masterVolume, time + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

    osc1.connect(gain1);
    gain1.connect(filter);
    osc1.start(time);
    osc1.stop(time + 0.17);

    // Impact body
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(520, time);
    osc2.frequency.exponentialRampToValueAtTime(380, time + 0.035);

    gain2.gain.setValueAtTime(0, time);
    gain2.gain.linearRampToValueAtTime(0.3 * this.masterVolume, time + 0.002);
    gain2.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

    osc2.connect(gain2);
    gain2.connect(filter);
    osc2.start(time);
    osc2.stop(time + 0.08);
  }

  /**
   * 6. Bell Ding (TickTick Concierge Ding)
   * High, clear metallic service bell strike (A6 1760Hz).
   */
  private synthBellDing(ctx: AudioContext, time: number) {
    const freqs = [1760, 3520];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime((idx === 0 ? 0.35 : 0.15) * this.masterVolume, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.7);
    });
  }

  /**
   * 7. Harp Strum (Tickit Routine Finish)
   * Four-note ascending acoustic harp flourish: C5, E5, G5, C6.
   */
  private synthHarpStrum(ctx: AudioContext, time: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = time + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  /**
   * 8. Streak Fanfare (Tickit Milestone Celebration)
   * Upbeat celebratory chord: F5, A5, C6, F6.
   */
  private synthStreakFanfare(ctx: AudioContext, time: number) {
    const chord = [698.46, 880, 1046.5, 1396.91];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.8);
    });
  }

  /**
   * 9. Victory Triumph (Goal Win & Streak Victory)
   * Three-step heroic brass fanfare: C5 -> G5 -> E6 + C6 chord
   */
  private synthWinTriumph(ctx: AudioContext, time: number) {
    const steps = [
      { freqs: [523.25], t: time, dur: 0.11 },
      { freqs: [783.99], t: time + 0.11, dur: 0.11 },
      { freqs: [1046.5, 1318.51, 1567.98], t: time + 0.22, dur: 0.65 },
    ];
    steps.forEach(step => {
      step.freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, step.t);
        gain.gain.setValueAtTime(0, step.t);
        gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, step.t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, step.t + step.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(step.t);
        osc.stop(step.t + step.dur + 0.02);
      });
    });
  }

  /**
   * 10. 8-Bit Level Up (Retro Arcade Powerup)
   * Fast square-filtered 6-note chiptune arpeggio
   */
  private synthLevelUp(ctx: AudioContext, time: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const t = time + idx * 0.055;
      const dur = idx === notes.length - 1 ? 0.25 : 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14 * this.masterVolume, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
  }

  /**
   * 11. Magic Shimmer (Fairy Dust Sparkle)
   */
  private synthMagicChime(ctx: AudioContext, time: number) {
    const sparkle = [1318.51, 1567.98, 1975.53, 2349.32, 2637.02, 3135.96];
    sparkle.forEach((f, idx) => {
      const t = time + idx * 0.038;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /**
   * 12. Crystal Clink (Glass Toast Ping)
   */
  private synthGlassClink(ctx: AudioContext, time: number) {
    const partials = [2793.83, 4186.01]; // F7, C8
    partials.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime((idx === 0 ? 0.3 : 0.14) * this.masterVolume, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.48);
    });
  }

  /**
   * 13. Shutter Snap (Mechanical Camera Click)
   */
  private synthCameraSnap(ctx: AudioContext, time: number) {
    [0, 0.045].forEach((offset, idx) => {
      const t = time + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 1800 : 1200, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.025);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    });
  }

  /**
   * 14. Upbeat Whistle (Two-Note Whistle Chirp)
   */
  private synthWhistleChirp(ctx: AudioContext, time: number) {
    const notes = [
      { f1: 1400, f2: 1850, t: time, d: 0.09 },
      { f1: 1650, f2: 2450, t: time + 0.11, d: 0.16 },
    ];
    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f1, n.t);
      osc.frequency.exponentialRampToValueAtTime(n.f2, n.t + n.d);
      gain.gain.setValueAtTime(0, n.t);
      gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, n.t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, n.t + n.d + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(n.t);
      osc.stop(n.t + n.d + 0.03);
    });
  }

  /**
   * Play any of the notification & check-off sounds
   */
  playNotificationSound(soundName?: NotificationSoundType) {
    const snd = soundName || this.currentNotificationSound;
    try {
      if (snd === 'tick' || snd === 'camera_snap') haptics.tick();
      else if (snd === 'bubble_pop' || snd === 'whistle_chirp') haptics.pop();
      else if (snd === 'coin_clink' || snd === 'glass_clink') haptics.coin();
      else if (snd === 'wood_tap') haptics.knock();
      else if (snd === 'streak_fanfare' || snd === 'win_triumph' || snd === 'level_up' || snd === 'magic_chime') {
        haptics.celebration();
      } else {
        haptics.complete();
      }
    } catch {}

    if (this.masterVolume === 0) return;
    try {
      const ctx = this.initCtx();
      if (!ctx || ctx.state === 'suspended') return;
      const time = ctx.currentTime;

      switch (snd) {
        case 'tick':
          this.synthTick(ctx, time);
          break;
        case 'bubble_pop':
          this.synthBubblePop(ctx, time);
          break;
        case 'coin_clink':
          this.synthCoinClink(ctx, time);
          break;
        case 'wood_tap':
          this.synthWoodTap(ctx, time);
          break;
        case 'water_drop':
          this.synthWaterDrop(ctx, time);
          break;
        case 'bell_ding':
          this.synthBellDing(ctx, time);
          break;
        case 'harp_strum':
          this.synthHarpStrum(ctx, time);
          break;
        case 'streak_fanfare':
          this.synthStreakFanfare(ctx, time);
          break;
        case 'win_triumph':
          this.synthWinTriumph(ctx, time);
          break;
        case 'level_up':
          this.synthLevelUp(ctx, time);
          break;
        case 'magic_chime':
          this.synthMagicChime(ctx, time);
          break;
        case 'glass_clink':
          this.synthGlassClink(ctx, time);
          break;
        case 'camera_snap':
          this.synthCameraSnap(ctx, time);
          break;
        case 'whistle_chirp':
          this.synthWhistleChirp(ctx, time);
          break;
        default:
          this.synthTick(ctx, time);
          break;
      }
    } catch {
      // Ignore
    }
  }

  /* ========================================================================
   * PART 2: ALARM & REMINDER RINGTONES (TickTick & Tickit)
   * ======================================================================== */

  playAlarmChime(overrideTone?: AlarmToneType) {
    if (this.masterVolume === 0) return;
    const toneToUse = this.normalizeAlarmTone(overrideTone || this.currentAlarmTone);

    try {
      const ctx = this.initCtx();
      if (!ctx || ctx.state === 'suspended') return;
      const now = ctx.currentTime;

      switch (toneToUse) {
        // 1. TickTick Signature Default: D5 -> A5 with harmonic shimmer
        case 'ticktick_default': {
          const notes = [
            { f: 587.33, t: now },
            { f: 880, t: now + 0.16 },
          ];
          notes.forEach(({ f, t }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.58);
          });
          break;
        }

        // 2. TickTick Jingle: Bright dual-bell ring
        case 'jingle': {
          const pulses = [
            { time: now, notes: [659.25, 880] },
            { time: now + 0.18, notes: [880, 1174.66] },
          ];
          pulses.forEach(p => {
            p.notes.forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = idx === 0 ? 'sine' : 'triangle';
              osc.frequency.setValueAtTime(freq, p.time);
              gain.gain.setValueAtTime(0, p.time);
              gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, p.time + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, p.time + 0.45);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(p.time);
              osc.stop(p.time + 0.48);
            });
          });
          break;
        }

        // 3. TickTick Spiral: Ascending 5-note melodic spiral (C5-D5-E5-G5-C6)
        case 'spiral': {
          const spiralNotes = [523.25, 587.33, 659.25, 783.99, 1046.5];
          spiralNotes.forEach((f, idx) => {
            const t = now + idx * 0.09;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22 * this.masterVolume, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.38);
          });
          break;
        }

        // 4. TickTick Aurora: Ambient synthesizer chord swell
        case 'aurora': {
          const auroraChord = [329.63, 493.88, 659.25, 830.61]; // E4, B4, E5, G#5
          auroraChord.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = idx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.45);
          });
          break;
        }

        // 5. TickTick Breeze: Airy acoustic wind chime
        case 'breeze': {
          const breezeNotes = [880, 1108.73, 1318.51]; // A5, C#6, E6
          breezeNotes.forEach((f, idx) => {
            const t = now + idx * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.72);
          });
          break;
        }

        // 6. TickTick Crystal: Sparkling high-register crystalline chime (2637Hz)
        case 'crystal': {
          const crystalNotes = [2637.02, 3135.96]; // E7, G7
          crystalNotes.forEach((f, idx) => {
            const t = now + idx * 0.06;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.62);
          });
          break;
        }

        // 7. TickTick Echo: Reverberant acoustic chime with spatial repeats
        case 'echo': {
          const echoDelays = [0, 0.16, 0.32];
          echoDelays.forEach((delay, idx) => {
            const t = now + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1046.5, t); // C6
            const vol = (0.28 / (idx + 1)) * this.masterVolume;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(vol, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.38);
          });
          break;
        }

        // 8. TickTick Harp: Delicate ascending acoustic harp arpeggio
        case 'harp': {
          const harpNotes = [440, 554.37, 659.25, 880, 1108.73]; // A major
          harpNotes.forEach((f, idx) => {
            const t = now + idx * 0.07;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.48);
          });
          break;
        }

        // 9. TickTick Marimba: Wooden mallet percussive phrase
        case 'marimba': {
          const marimbaNotes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
          marimbaNotes.forEach((f, idx) => {
            const t = now + idx * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(f, t);
            filter.Q.setValueAtTime(4.0, t);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.25);
          });
          break;
        }

        // 10. TickTick Pulse: Electronic rhythmic alert pulse
        case 'pulse': {
          for (let i = 0; i < 2; i++) {
            const t = now + i * 0.15;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, t);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1600, t);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22 * this.masterVolume, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.12);
          }
          break;
        }

        // 11. TickTick Radar: High-visibility sonar ping
        case 'radar': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1174.66, now); // D6
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.68);
          break;
        }

        // 12. TickTick Ripple: Hydro-harmonic ripple
        case 'ripple': {
          this.synthWaterDrop(ctx, now);
          setTimeout(() => {
            if (this.ctx && this.ctx.state === 'running') {
              this.synthWaterDrop(this.ctx, this.ctx.currentTime);
            }
          }, 120);
          break;
        }

        // 13. TickTick Telegraph: Rapid two-tone chirp
        case 'telegraph': {
          const tones = [987.77, 1318.51]; // B5, E6
          tones.forEach((f, idx) => {
            const t = now + idx * 0.07;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.26 * this.masterVolume, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.13);
          });
          break;
        }

        // 14. TickTick Twinkle: Glockenspiel music box run
        case 'twinkle': {
          const twinkleNotes = [1046.5, 783.99, 1318.51, 1046.5]; // C6, G5, E6, C6
          twinkleNotes.forEach((f, idx) => {
            const t = now + idx * 0.1;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.42);
          });
          break;
        }

        // 15. TickTick Xylophone: Bright acoustic wooden run
        case 'xylophone': {
          const xyloNotes = [587.33, 739.99, 880, 1174.66]; // D5, F#5, A5, D6
          xyloNotes.forEach((f, idx) => {
            const t = now + idx * 0.06;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
          });
          break;
        }

        // 16. Zen Singing Bowl (TickTick & Tickit)
        case 'zen_bell': {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(432, now); // Natural A=432Hz meditation fundamental
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(864, now); // Octave overtone

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 2.1);
          osc2.stop(now + 2.1);
          break;
        }

        // 17. Sunrise Melody (Tickit Morning Glockenspiel)
        case 'sunrise': {
          const sunriseNotes = [783.99, 987.77, 1174.66, 1567.98]; // G5, B5, D6, G6
          sunriseNotes.forEach((f, idx) => {
            const t = now + idx * 0.12;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.52);
          });
          break;
        }

        // 18. Gentle Bell (Tickit Morning Bell)
        case 'gentle_bell': {
          const notes = [523.25, 783.99]; // C5, G5
          notes.forEach((f, idx) => {
            const t = now + idx * 0.14;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.28 * this.masterVolume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.75);
          });
          break;
        }

        // 19. Morning Birds (Tickit Birdsong Motif)
        case 'morning_birds': {
          const chirps = [
            { f1: 1800, f2: 2400, t: now },
            { f1: 2200, f2: 2800, t: now + 0.08 },
            { f1: 2000, f2: 2600, t: now + 0.18 },
          ];
          chirps.forEach(({ f1, f2, t }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f1, t);
            osc.frequency.exponentialRampToValueAtTime(f2, t + 0.04);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, t + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
          });
          break;
        }

        // 20. Classic Phone Ring (Vintage Rotary / Desk Telephone Brrr-Brrr!)
        case 'classic_phone': {
          // Two bursts of 20Hz-modulated dual brass bell frequencies (1050Hz + 1350Hz + 2100Hz overtone)
          const bursts = [
            { start: now, dur: 0.38 },
            { start: now + 0.52, dur: 0.38 },
          ];
          bursts.forEach(b => {
            const strikes = 9;
            const step = b.dur / strikes;
            for (let i = 0; i < strikes; i++) {
              const st = b.start + i * step;
              [1046.5, 1396.91, 2093].forEach((freq, fIdx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = fIdx === 2 ? 'triangle' : 'sine';
                osc.frequency.setValueAtTime(freq, st);
                const amp = (fIdx === 0 ? 0.25 : fIdx === 1 ? 0.2 : 0.09) * this.masterVolume;
                gain.gain.setValueAtTime(0, st);
                gain.gain.linearRampToValueAtTime(amp, st + 0.004);
                gain.gain.exponentialRampToValueAtTime(0.001, st + step * 0.95);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(st);
                osc.stop(st + step);
              });
            }
          });
          break;
        }

        // 21. Modern Phone Ring (Cellular Warble Trill Ringtone)
        case 'digital_phone': {
          const bursts = [now, now + 0.48];
          bursts.forEach(bStart => {
            for (let i = 0; i < 6; i++) {
              const t = bStart + i * 0.055;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(i % 2 === 0 ? 987.77 : 1318.51, t); // B5 <-> E6 trill
              gain.gain.setValueAtTime(0, t);
              gain.gain.linearRampToValueAtTime(0.28 * this.masterVolume, t + 0.005);
              gain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t);
              osc.stop(t + 0.055);
            }
          });
          break;
        }

        // 22. Twin Bell Alarm Clock (Mechanical Hammer Hitting Metal Bells)
        case 'twin_bell_alarm': {
          for (let i = 0; i < 14; i++) {
            const t = now + i * 0.048;
            const bellFreq = i % 2 === 0 ? 1567.98 : 1760; // Alternating G6 & A6 twin bells
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bellFreq, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, t + 0.003);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.046);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.05);
          }
          break;
        }

        // 23. Digital Beep Alarm (Bedside Quartz Beep-Beep-Beep-Beep)
        case 'digital_alarm': {
          [0, 0.11, 0.22, 0.33].forEach(offset => {
            const t = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(2048, t); // Classic 2048Hz piezo buzzer frequency
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, t + 0.004);
            gain.gain.setValueAtTime(0.18 * this.masterVolume, t + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
          });
          break;
        }

        // 24. Morning Rooster (Dawn Wake-Up Motif)
        case 'rooster_alarm': {
          // 5-note pitch contour mimicking "Cock-a-doodle-doo!"
          const phrases = [
            { f1: 587.33, f2: 659.25, t: now, d: 0.09 },
            { f1: 659.25, f2: 783.99, t: now + 0.11, d: 0.09 },
            { f1: 880, f2: 1046.5, t: now + 0.22, d: 0.12 },
            { f1: 783.99, f2: 880, t: now + 0.36, d: 0.09 },
            { f1: 987.77, f2: 739.99, t: now + 0.47, d: 0.42 },
          ];
          phrases.forEach(p => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, p.t);
            filter.Q.setValueAtTime(2.5, p.t);

            osc.frequency.setValueAtTime(p.f1, p.t);
            osc.frequency.linearRampToValueAtTime(p.f2, p.t + p.d);
            gain.gain.setValueAtTime(0, p.t);
            gain.gain.linearRampToValueAtTime(0.28 * this.masterVolume, p.t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, p.t + p.d);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(p.t);
            osc.stop(p.t + p.d + 0.02);
          });
          break;
        }

        // 25. Cuckoo Clock (Wooden Chalet G5 -> E5 Call)
        case 'cuckoo_clock': {
          const calls = [
            { f: 783.99, t: now, d: 0.14 },
            { f: 659.25, t: now + 0.2, d: 0.26 },
            { f: 783.99, t: now + 0.58, d: 0.14 },
            { f: 659.25, t: now + 0.78, d: 0.26 },
          ];
          calls.forEach(c => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(c.f, c.t);
            gain.gain.setValueAtTime(0, c.t);
            gain.gain.linearRampToValueAtTime(0.32 * this.masterVolume, c.t + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, c.t + c.d);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(c.t);
            osc.stop(c.t + c.d + 0.02);
          });
          break;
        }

        // 26. Bugle Wake-Up (Reveille Brass Call)
        case 'bugle_reveille': {
          const bugleNotes = [
            { f: 523.25, t: now, d: 0.1 },
            { f: 659.25, t: now + 0.11, d: 0.1 },
            { f: 783.99, t: now + 0.22, d: 0.18 },
            { f: 659.25, t: now + 0.42, d: 0.1 },
            { f: 783.99, t: now + 0.53, d: 0.35 },
          ];
          bugleNotes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, n.t);
            gain.gain.setValueAtTime(0, n.t);
            gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, n.t + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, n.t + n.d);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(n.t);
            osc.stop(n.t + n.d + 0.02);
          });
          break;
        }

        // 27. Pentatonic Wind Chimes
        case 'wind_chimes': {
          const tubes = [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
          tubes.forEach((f, idx) => {
            const t = now + idx * 0.075;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22 * this.masterVolume, t + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.68);
          });
          break;
        }

        // 28. Grand Piano Chord (Warm Major-9th Arpeggio)
        case 'piano_chime': {
          const pianoNotes = [261.63, 329.63, 392.0, 493.88, 587.33]; // Cmaj9
          pianoNotes.forEach((f, idx) => {
            const t = now + idx * 0.065;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.26 * this.masterVolume, t + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.88);
          });
          break;
        }

        // 29. Acoustic Guitar Strum (6-String G Major Strum)
        case 'guitar_strum': {
          const strings = [196.0, 246.94, 293.66, 392.0, 493.88, 783.99];
          strings.forEach((f, idx) => {
            const t = now + idx * 0.028;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.24 * this.masterVolume, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.78);
          });
          break;
        }

        // 30. Thumb Piano / Kalimba
        case 'kalimba': {
          const tines = [523.25, 659.25, 783.99, 987.77, 1046.5];
          tines.forEach((f, idx) => {
            const t = now + idx * 0.085;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.28 * this.masterVolume, t + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.45);
          });
          break;
        }

        // 31. Deep Temple Bell
        case 'singing_bowl': {
          [288, 576, 864].forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime((0.32 / (idx + 1)) * this.masterVolume, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.85);
          });
          break;
        }

        // 32. Ship's Brass Bell (Double Strike Watch Bell)
        case 'brass_bell': {
          [0, 0.22].forEach(offset => {
            const t = now + offset;
            [1174.66, 2349.32].forEach((f, idx) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = idx === 0 ? 'sine' : 'triangle';
              osc.frequency.setValueAtTime(f, t);
              gain.gain.setValueAtTime(0, t);
              gain.gain.linearRampToValueAtTime((idx === 0 ? 0.32 : 0.14) * this.masterVolume, t + 0.003);
              gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t);
              osc.stop(t + 0.62);
            });
          });
          break;
        }

        default: {
          this.playAlarmChime('classic_phone');
          break;
        }
      }
    } catch {
      // Ignore
    }
  }

  /* ========================================================================
   * PART 3: EVENT-AWARE TRIGGERS & COMPATIBILITY METHODS
   * ======================================================================== */

  playSuccessChime() {
    this.playEventSound('task_complete');
  }

  playTaskComplete() {
    this.playEventSound('task_complete');
  }

  playHabitComplete() {
    this.playEventSound('habit_complete');
  }

  playWinStreak() {
    this.playEventSound('win_streak');
  }

  playGeneralNotification() {
    this.playEventSound('notification');
  }

  playBillPaid() {
    this.playEventSound('bill_paid');
  }

  playTimerComplete() {
    this.playEventSound('timer_complete');
  }

  playClick() {
    this.playNotificationSound('wood_tap');
  }

  playLockSound() {
    this.playNotificationSound('wood_tap');
  }

  playWaterDripNotification() {
    this.playEventSound('water_log');
  }

  playWaterDropNotification() {
    this.playEventSound('task_complete');
  }

  playWaterDrop() {
    this.playEventSound('water_log');
  }

  playWaterDrip() {
    this.playEventSound('water_log');
  }

  playWaterChime() {
    this.playEventSound('water_log');
  }

  playWaterSound() {
    this.playEventSound('water_log');
  }

  playPillChime() {
    this.playEventSound('medication_alarm');
  }

  playPill() {
    this.playPillChime();
  }

  playMedicationDose() {
    this.playPillChime();
  }
}

export const soundEngine = new SoundEngine();

export const playLockSound = () => soundEngine.playLockSound();
export const playPillChime = () => soundEngine.playPillChime();
export const playWaterChime = () => soundEngine.playWaterChime();
export const playWaterDropNotification = () => soundEngine.playWaterDropNotification();
export const playWaterDrop = () => soundEngine.playWaterDrop();
export const playWaterDripNotification = () => soundEngine.playWaterDripNotification();
export const playWaterDrip = () => soundEngine.playWaterDrip();
export const playSuccessChime = () => soundEngine.playSuccessChime();
export const playWinStreak = () => soundEngine.playWinStreak();
export const playHabitComplete = () => soundEngine.playHabitComplete();
export const playBillPaid = () => soundEngine.playBillPaid();
export const playAlarmChime = (tone?: AlarmToneType) => soundEngine.playAlarmChime(tone);
export const playNotificationSound = (sound?: NotificationSoundType) => soundEngine.playNotificationSound(sound);
