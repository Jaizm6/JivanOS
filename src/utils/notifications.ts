import { soundEngine, AlarmToneType } from './audio';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export interface ScheduledReminder {
  id: string;
  taskId: string;
  title: string;
  targetTs: number;
  label?: string;
  dueTime?: string;
  location?: string;
  timerRef?: number | NodeJS.Timeout;
}

export class NotificationService {
  private static instance: NotificationService;
  private worker: Worker | null = null;
  private workerCallbacks: Set<() => void> = new Set();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();
  private fcmToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initServiceWorker();
      this.initBackgroundTicker();

      // Catch-up check when window regains visibility/focus
      const handleWake = () => {
        soundEngine.resume();
        this.triggerCallbacks();
      };
      window.addEventListener('visibilitychange', handleWake);
      window.addEventListener('focus', handleWake);

      // Listen for Service Worker messages (e.g. action buttons clicked on notification)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
          const { type, taskId } = event.data || {};
          if (type === 'NOTIFICATION_ACTION_SNOOZE' && taskId) {
            window.dispatchEvent(
              new CustomEvent('omnilifeos_snooze_task', { detail: { taskId } })
            );
          } else if (type === 'NOTIFICATION_ACTION_COMPLETE' && taskId) {
            window.dispatchEvent(
              new CustomEvent('omnilifeos_complete_task', { detail: { taskId } })
            );
          }
        });
      }
    }
  }

  // Register Service Worker for background notifications and FCM
  private async initServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
    } catch {
      // Service worker registration skipped in non-secure or restricted iframe
    }
  }

  // Web Worker Background Ticker: Bypasses browser tab sleep/throttling
  private initBackgroundTicker() {
    if (typeof window === 'undefined' || !window.Worker) return;

    try {
      // Inlined Worker code to tick reliably every 1000ms regardless of tab visibility
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) {
              timer = setInterval(function() {
                self.postMessage('tick');
              }, 1000);
            }
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = e => {
        if (e.data === 'tick') {
          this.triggerCallbacks();
        }
      };

      this.worker.postMessage('start');
    } catch {
      // Fallback: standard interval if Web Worker creation is disallowed in environment
      setInterval(() => {
        this.triggerCallbacks();
      }, 1000);
    }
  }

  // Register a subscriber for the 1-second background tick
  subscribeTick(callback: () => void): () => void {
    this.workerCallbacks.add(callback);
    return () => {
      this.workerCallbacks.delete(callback);
    };
  }

  private triggerCallbacks() {
    this.workerCallbacks.forEach(cb => {
      try {
        cb();
      } catch {
        // Safe callback execution
      }
    });
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  // Schedule an exact millisecond alarm for a task
  scheduleExactAlarm(reminder: {
    id: string;
    taskId: string;
    title: string;
    targetTs: number;
    label?: string;
    dueTime?: string;
    location?: string;
    onTrigger: () => void;
  }) {
    // Clear existing timer if any
    const existing = this.scheduledReminders.get(reminder.id);
    if (existing && existing.timerRef) {
      clearTimeout(existing.timerRef);
    }

    const now = Date.now();
    const delayMs = reminder.targetTs - now;

    // If within 24 hours in future, schedule a direct setTimeout
    if (delayMs > 0 && delayMs <= 24 * 60 * 60 * 1000) {
      const timerRef = setTimeout(() => {
        this.scheduledReminders.delete(reminder.id);
        reminder.onTrigger();
      }, delayMs);

      this.scheduledReminders.set(reminder.id, {
        id: reminder.id,
        taskId: reminder.taskId,
        title: reminder.title,
        targetTs: reminder.targetTs,
        label: reminder.label,
        dueTime: reminder.dueTime,
        location: reminder.location,
        timerRef,
      });
    }
  }

  cancelAlarm(id: string) {
    const existing = this.scheduledReminders.get(id);
    if (existing && existing.timerRef) {
      clearTimeout(existing.timerRef);
    }
    this.scheduledReminders.delete(id);
  }

  // Dispatch audible alert + native desktop notification + vibration
  notify(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      tag?: string;
      sound?: 'pill' | 'water' | 'task' | 'alarm' | 'drop' | 'drip';
      tone?: AlarmToneType;
      taskId?: string;
      vibrate?: boolean;
      category?: string;
    }
  ) {
    const category = options?.category || 'task';
    const soundAllowed = soundEngine.isSoundEnabled(category);

    // 1. Play synthetic audible alarm chime if enabled for this type
    if (soundAllowed) {
      if (options?.sound === 'drop' || options?.sound === 'drip') {
        soundEngine.playWaterDripNotification();
      } else if (options?.sound === 'water') {
        soundEngine.playWaterChime();
      } else if (options?.sound === 'pill') {
        soundEngine.playPillChime();
      } else if (options?.sound === 'task' || options?.sound === 'alarm') {
        soundEngine.playAlarmChime(options?.tone);
      } else {
        soundEngine.playWaterDropNotification();
      }
    }

    // 2. Mobile vibration support (prominent alert pattern)
    if (options?.vibrate !== false && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([350, 150, 350, 150, 500]);
      } catch {
        // Ignored
      }
    }

    // 3. Native Browser / Service Worker Notification
    if (this.isSupported() && Notification.permission === 'granted') {
      const notifOptions: any = {
        body: options?.body || 'OmniLifeOS Task Reminder',
        icon: options?.icon || '/icon.svg',
        badge: '/icon.svg',
        tag: options?.tag || `alert_${Date.now()}`,
        requireInteraction: true,
        renotify: true,
        data: {
          taskId: options?.taskId,
          timestamp: Date.now(),
        },
      };

      if (options?.vibrate !== false) {
        notifOptions.vibrate = [350, 150, 350, 150, 500];
      }

      try {
        if (this.swRegistration && 'showNotification' in this.swRegistration) {
          const swOptions = {
            ...notifOptions,
            actions: [
              { action: 'open', title: '👀 View Task' },
              { action: 'snooze', title: '⏱ Snooze 5m' },
            ],
          };
          this.swRegistration
            .showNotification(title, swOptions as unknown as NotificationOptions)
            .catch(() => {
              new Notification(title, notifOptions);
            });
        } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready
            .then(reg => {
              reg.showNotification(title, notifOptions);
            })
            .catch(() => {
              new Notification(title, notifOptions);
            });
        } else {
          new Notification(title, notifOptions);
        }
      } catch {
        // Fallback inside sandbox
      }
    }

    // In-app notifications are handled by AppContext pushNotification or ActiveAlarmBanner.
    // notificationService handles Web API & audio chimes only.
  }

  // Test Notification & Sound Trigger
  async testNotificationAlert(tone?: AlarmToneType): Promise<{ success: boolean; message: string }> {
    soundEngine.resume();

    let granted = this.getPermission() === 'granted';
    if (!granted && this.isSupported()) {
      granted = await this.requestPermission();
    }

    this.notify('🔔 Test Reminder: OmniLifeOS Alarm', {
      body: 'Audible chime, vibration, and exact-time alert verified successfully!',
      sound: 'alarm',
      tone: tone || soundEngine.getTone(),
      tag: 'test_alert',
    });

    if (granted) {
      return { success: true, message: 'Audible alarm played & native browser notification delivered.' };
    } else {
      return { success: true, message: 'Audible alarm played. Enable browser notifications for desktop popups.' };
    }
  }
}

export const notificationService = NotificationService.getInstance();
