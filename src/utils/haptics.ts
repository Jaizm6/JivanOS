/**
 * Global Haptic Feedback Utility
 * Provides subtle, device-appropriate micro-vibrations (10ms)
 * to enhance tactile user feedback across completion, switches, and modal interactions.
 */

export class HapticFeedbackService {
  private isEnabled: boolean = true;
  private lastTriggerTime: number = 0;
  private minIntervalMs: number = 40; // Throttle rapid multiple vibrations

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omniplan_haptics_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }
    }
  }

  /**
   * Set haptics enabled/disabled preference
   */
  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('omniplan_haptics_enabled', String(enabled));
      } catch {}
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Core micro-vibration method. Supports duration in ms or pattern array [vibrate, pause, vibrate...].
   */
  public trigger(pattern: number | number[] = 10): boolean {
    if (!this.isEnabled) return false;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

    // Check navigator.vibrate support
    if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') {
      return false;
    }

    const now = Date.now();
    if (now - this.lastTriggerTime < this.minIntervalMs) {
      return false;
    }
    this.lastTriggerTime = now;

    try {
      return navigator.vibrate(pattern as any);
    } catch {
      return false;
    }
  }

  /**
   * TickTick snappy micro-tick (12ms) for task & subtask completion
   */
  public tick() {
    this.trigger(12);
  }

  /**
   * Tickit bubble pop double micro-pulse [10ms, 25ms, 12ms] for habit check-off
   */
  public pop() {
    this.trigger([10, 25, 12]);
  }

  /**
   * Tickit coin clink sharp double tap [8ms, 15ms, 8ms]
   */
  public coin() {
    this.trigger([8, 15, 8]);
  }

  /**
   * Tickit wood knock crisp medium pulse (18ms)
   */
  public knock() {
    this.trigger(18);
  }

  /**
   * Streak celebration & milestone fanfare vibration [15ms, 35ms, 20ms, 45ms, 30ms]
   */
  public celebration() {
    this.trigger([15, 35, 20, 45, 30]);
  }

  /**
   * Alarms do not vibrate per user preference
   */
  public alarm() {
    // Intentionally silent on vibration
  }

  /**
   * Context-aware complete haptic: selects pattern by type (task, habit, streak, etc.)
   */
  public complete(type?: 'task' | 'habit' | 'streak' | 'medicine' | 'bill') {
    if (type === 'streak') {
      this.celebration();
    } else if (type === 'habit') {
      this.pop();
    } else if (type === 'bill') {
      this.coin();
    } else {
      this.tick();
    }
  }

  /**
   * 10ms micro-vibration when toggling switches, filters, checkboxes or segmented tabs
   */
  public toggle() {
    this.trigger(10);
  }

  /**
   * 10ms micro-vibration when opening/closing modals, drawers, or dialogs
   */
  public modal() {
    this.trigger(10);
  }

  /**
   * 8ms micro-vibration for general button clicks and actions
   */
  public light() {
    this.trigger(8);
  }
}

export const haptics = new HapticFeedbackService();
export const triggerHaptic = (pattern: number | number[] = 10) => haptics.trigger(pattern);
