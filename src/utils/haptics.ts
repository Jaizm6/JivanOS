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
   * Core micro-vibration method (10ms only for crisp, subtle tactile response)
   */
  public trigger(durationMs: number = 10): boolean {
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
      // Exactly 10ms as requested for standard subtle device-appropriate vibration
      return navigator.vibrate(durationMs);
    } catch {
      return false;
    }
  }

  /**
   * 10ms micro-vibration when completing a task, habit, checklist or milestone
   */
  public complete() {
    this.trigger(10);
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
   * 10ms micro-vibration for general button clicks and actions
   */
  public light() {
    this.trigger(10);
  }
}

export const haptics = new HapticFeedbackService();
export const triggerHaptic = (durationMs: number = 10) => haptics.trigger(durationMs);
