/**
 * Synthetic Web Audio API Chimes & Fallback for Reminders, Medication Alerts & Pomodoro Bells
 * Zero external audio dependencies - 100% offline & instantaneous.
 */

// Simple WAV base64 beep generator for HTML5 audio fallback
function generateBeepWavDataUri(freq = 880, duration = 0.4): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 1, true); // BlockAlign
  view.setUint16(34, 8, true); // BitsPerSample
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true);

  // Write samples with envelope fade out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope;
    const byte = Math.floor((sample + 1) * 127.5);
    view.setUint8(44 + i, byte);
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Dedicated 16-bit PCM Liquid Water Drip Sound Generator (< 1 second, ~0.18s)
function generateWaterDropWavDataUri(volume = 0.85): string {
  const sampleRate = 22050;
  const duration = 0.18; // ~180ms
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // 1 = PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  // data chunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, numSamples * 2, true);

  let phase1 = 0;
  let phase2 = 0;
  let phase3 = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Main bubble Minnaert resonance: upward swoop from ~620Hz to ~1750Hz in 20ms, decaying to ~1450Hz
    const freq1 = t < 0.020
      ? 620 + (1750 - 620) * (t / 0.020)
      : 1750 * Math.exp(-3.5 * (t - 0.020));
    // Plop impact body (low-mid roundness)
    const freq2 = 520 * Math.exp(-12 * t);
    // Droplet cavity resonance
    const freq3 = 1850 * Math.exp(-6.0 * t);

    phase1 += (2 * Math.PI * freq1) / sampleRate;
    phase2 += (2 * Math.PI * freq2) / sampleRate;
    phase3 += (2 * Math.PI * freq3) / sampleRate;

    const attack1 = Math.min(1, t / 0.003);
    const attack2 = Math.min(1, t / 0.002);
    const attack3 = Math.min(1, t / 0.004);

    const env1 = attack1 * Math.exp(-22 * t);
    const env2 = attack2 * Math.exp(-38 * t);
    const env3 = attack3 * Math.exp(-28 * t);

    const s1 = Math.sin(phase1) * env1 * 0.70;
    const s2 = Math.sin(phase2) * env2 * 0.35;
    const s3 = Math.sin(phase3) * env3 * 0.18;
    const sample = Math.max(-1, Math.min(1, (s1 + s2 + s3) * volume));

    const intSample = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
    view.setInt16(44 + i * 2, intSample, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export type AlarmToneType = 'dual_bell' | 'melody' | 'urgent' | 'chime' | 'drop' | 'drip';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;
  private masterVolume = 0.8;
  private currentTone: AlarmToneType = 'dual_bell';
  private fallbackAudio: HTMLAudioElement | null = null;
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
      if (savedTone) this.currentTone = savedTone;

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

  isSoundEnabled(type: string): boolean {
    return this.typeSoundEnabled[type] !== false;
  }

  setSoundEnabled(type: string, enabled: boolean) {
    this.typeSoundEnabled[type] = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`omniplan_sound_toggle_${type}`, enabled.toString());
    }
  }

  getAllSoundToggles(): Record<string, boolean> {
    return { ...this.typeSoundEnabled };
  }

  setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_audio_volume', this.masterVolume.toString());
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  setTone(tone: AlarmToneType) {
    this.currentTone = tone;
    if (typeof window !== 'undefined') {
      localStorage.setItem('omniplan_alarm_tone', tone);
    }
  }

  getTone(): AlarmToneType {
    return this.currentTone;
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

  private initCtx() {
    this.resume();
  }

  private playFallbackWaterDrop() {
    try {
      if (this.masterVolume === 0) return;
      const audio = new Audio();
      audio.src = generateWaterDropWavDataUri(this.masterVolume);
      audio.volume = this.masterVolume;
      audio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }

  private playFallbackBeep(freq = 880) {
    try {
      if (this.masterVolume === 0) return;
      if (!this.fallbackAudio) {
        this.fallbackAudio = new Audio();
      }
      this.fallbackAudio.src = generateBeepWavDataUri(freq, 0.45);
      this.fallbackAudio.volume = this.masterVolume;
      this.fallbackAudio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }

  // Soft melodic chime for pill / task reminder
  playPillChime() {
    if (this.masterVolume === 0) return;
    try {
      this.initCtx();
      if (!this.ctx || this.ctx.state === 'suspended') {
        this.playFallbackBeep(659.25);
        return;
      }
      const now = this.ctx.currentTime;
      const notes = [587.33, 880, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.15 * this.masterVolume, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.6);
      });
    } catch {
      this.playFallbackBeep(659.25);
    }
  }

  playPill() {
    this.playPillChime();
  }

  // Gentle water droplet sound for hydration reminder
  playWaterChime() {
    if (this.masterVolume === 0) return;
    try {
      this.initCtx();
      if (!this.ctx || this.ctx.state === 'suspended') {
        this.playFallbackBeep(1200);
        return;
      }
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18 * this.masterVolume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      this.playFallbackBeep(1200);
    }
  }

  // Signature Single Water Drip Notification Sound (< 1s duration, ultra-crisp liquid drip)
  playWaterDripNotification() {
    if (this.masterVolume === 0) return;
    try {
      this.initCtx();
      let playedWebAudio = false;

      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = this.ctx.currentTime;

        // Acoustic lowpass smoothing filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, now);
        filter.Q.setValueAtTime(1.5, now);
        filter.connect(this.ctx.destination);

        // 1. Primary bubble tone: rapid upward swoop (~620Hz -> ~1750Hz in 20ms, settling to ~1450Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(620, now);
        osc1.frequency.exponentialRampToValueAtTime(1750, now + 0.020);
        osc1.frequency.exponentialRampToValueAtTime(1450, now + 0.09);

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.55 * this.masterVolume, now + 0.003);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

        osc1.connect(gain1);
        gain1.connect(filter);

        osc1.start(now);
        osc1.stop(now + 0.18);

        // 2. Liquid plop bottom body: fast warm punch (~520Hz -> ~380Hz)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(520, now);
        osc2.frequency.exponentialRampToValueAtTime(380, now + 0.035);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.30 * this.masterVolume, now + 0.002);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

        osc2.connect(gain2);
        gain2.connect(filter);

        osc2.start(now);
        osc2.stop(now + 0.08);

        playedWebAudio = true;
      }

      if (!playedWebAudio) {
        this.playFallbackWaterDrop();
      }
    } catch {
      this.playFallbackWaterDrop();
    }
  }

  // Alias for backward compatibility
  playWaterDropNotification() {
    this.playWaterDripNotification();
  }

  playWaterDrip() {
    this.playWaterDripNotification();
  }

  // Completion cue for tasks, habits & events - single, soft, non-irritating water drip sound (< 1s)
  playSuccessChime() {
    this.playWaterDripNotification();
  }

  // Attention-grabbing dual-bell alert chime for scheduled task & calendar reminders
  playAlarmChime(overrideTone?: AlarmToneType) {
    if (this.masterVolume === 0) return;
    const toneToUse = overrideTone || this.currentTone;

    try {
      this.initCtx();
      if (!this.ctx || this.ctx.state === 'suspended') {
        this.playFallbackBeep(880);
        return;
      }
      const now = this.ctx.currentTime;

      if (toneToUse === 'drop' || toneToUse === 'drip') {
        this.playWaterDripNotification();
        return;
      }

      if (toneToUse === 'melody') {
        // Upward energetic 4-note reminder melody: E5 -> G#5 -> B5 -> E6
        const melody = [659.25, 830.61, 987.77, 1318.51];
        melody.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.22 * this.masterVolume, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.4);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.4);
        });
      } else if (toneToUse === 'urgent') {
        // Rapid 3-pulse urgent notification
        for (let i = 0; i < 3; i++) {
          const t = now + i * 0.18;
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.5, t); // C6

          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(t);
          osc.stop(t + 0.14);
        }
      } else if (toneToUse === 'chime') {
        // Elegant acoustic glass bell chime
        const freqs = [783.99, 1174.66]; // G5, D6
        freqs.forEach(freq => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(now);
          osc.stop(now + 0.8);
        });
      } else {
        // Classic Dual-bell: Ding-Dong ... Ding-Dong
        const pulses = [
          { time: now, notes: [659.25, 880] }, // E5, A5
          { time: now + 0.22, notes: [880, 1174.66] }, // A5, D6
          { time: now + 0.55, notes: [659.25, 880] }, // E5, A5
          { time: now + 0.77, notes: [880, 1174.66] }, // A5, D6
        ];

        pulses.forEach(p => {
          p.notes.forEach((freq, nIdx) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = nIdx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, p.time);

            gain.gain.setValueAtTime(0, p.time);
            gain.gain.linearRampToValueAtTime(0.22 * this.masterVolume, p.time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, p.time + 0.38);

            osc.connect(gain);
            gain.connect(this.ctx!.destination);

            osc.start(p.time);
            osc.stop(p.time + 0.38);
          });
        });
      }
    } catch {
      this.playFallbackBeep(880);
    }
  }

  // Tactical click / lock sound
  playLockSound() {
    if (this.masterVolume === 0) return;
    try {
      this.initCtx();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12 * this.masterVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  playClick() {
    this.playLockSound();
  }

  playWaterSound() {
    this.playWaterChime();
  }

  playMedicationDose() {
    this.playPillChime();
  }

  playTaskComplete() {
    this.playWaterDropNotification();
  }
}

export const soundEngine = new SoundEngine();

export const playLockSound = () => soundEngine.playLockSound();
export const playPillChime = () => soundEngine.playPillChime();
export const playWaterChime = () => soundEngine.playWaterChime();
export const playWaterDropNotification = () => soundEngine.playWaterDropNotification();
export const playWaterDrop = () => soundEngine.playWaterDropNotification();
export const playWaterDripNotification = () => soundEngine.playWaterDripNotification();
export const playWaterDrip = () => soundEngine.playWaterDripNotification();
export const playSuccessChime = () => soundEngine.playSuccessChime();
export const playAlarmChime = (tone?: AlarmToneType) => soundEngine.playAlarmChime(tone);
