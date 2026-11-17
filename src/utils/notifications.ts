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
  timerRef?: number | ReturnType<typeof setTimeout>;
}

export interface ScheduledSystemReminder {
  id: string;
  entityId?: string;
  title: string;
  body: string;
  targetTs: number;
  category: 'task' | 'medication' | 'habit' | 'bill' | 'schedule';
  isAlarm?: boolean;
  sound?: 'pill' | 'water' | 'task' | 'alarm' | 'drop' | 'drip';
}

interface CapacitorLocalNotificationsPlugin {
  checkPermissions?: () => Promise<{ display: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' }>;
  requestPermissions?: () => Promise<{ display: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' }>;
  createChannel?: (channel: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    visibility?: number;
    sound?: string;
    vibration?: boolean;
    lights?: boolean;
  }) => Promise<void>;
  registerActionTypes?: (options: {
    types: Array<{ id: string; actions: Array<{ id: string; title: string; destructive?: boolean; foreground?: boolean }> }>;
  }) => Promise<void>;
  schedule?: (options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId?: string;
      actionTypeId?: string;
      extra?: Record<string, any>;
      schedule?: { at: Date; allowWhileIdle?: boolean };
      sound?: string;
      smallIcon?: string;
    }>;
  }) => Promise<any>;
  cancel?: (options: { notifications: Array<{ id: number }> }) => Promise<void>;
  addListener?: (eventName: string, listenerFunc: (event: any) => void) => Promise<{ remove: () => void }>;
}

const REMINDER_CHANNEL_ID = 'jivanos_reminders';
const ALARM_CHANNEL_ID = 'jivanos_alarms';
const TASK_ACTION_TYPE_ID = 'JIVAN_TASK_ACTIONS';
const SYNCED_IDS_STORAGE_KEY = 'jivanos_native_scheduled_ids';

function hashToInt32(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash) % 2000000000;
  return positive === 0 ? 1 : positive;
}

export class NotificationService {
  private static instance: NotificationService;
  private worker: Worker | null = null;
  private workerCallbacks: Set<() => void> = new Set();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();
  private syncedWebTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private nativePermission: NotificationPermissionStatus = 'default';
  private nativeInitialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initServiceWorker();
      this.initNativeCapacitorNotifications();
      this.initBackgroundTicker();

      const handleWake = () => {
        soundEngine.resume();
        this.triggerCallbacks();
      };
      window.addEventListener('visibilitychange', handleWake);
      window.addEventListener('focus', handleWake);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
          const { type, taskId } = event.data || {};
          if (type === 'NOTIFICATION_ACTION_SNOOZE' && taskId) {
            window.dispatchEvent(new CustomEvent('omnilifeos_snooze_task', { detail: { taskId } }));
          } else if (type === 'NOTIFICATION_ACTION_COMPLETE' && taskId) {
            window.dispatchEvent(new CustomEvent('omnilifeos_complete_task', { detail: { taskId } }));
          }
        });
      }
    }
  }

  private getNativePlugin(): CapacitorLocalNotificationsPlugin | null {
    if (typeof window === 'undefined') return null;
    const cap = (window as any).Capacitor;
    if (!cap) return null;
    const isNative = typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : Boolean(cap.isNative);
    if (!isNative) return null;
    return cap.Plugins?.LocalNotifications || null;
  }

  isNativePlatform(): boolean {
    return this.getNativePlugin() !== null;
  }

  private async initNativeCapacitorNotifications() {
    const plugin = this.getNativePlugin();
    if (!plugin || this.nativeInitialized) return;
    this.nativeInitialized = true;

    try {
      if (plugin.createChannel) {
        await plugin.createChannel({
          id: REMINDER_CHANNEL_ID,
          name: 'Task & Habit Reminders',
          description: 'Scheduled task reminders, habits, hydration & bills',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
        await plugin.createChannel({
          id: ALARM_CHANNEL_ID,
          name: 'Urgent Task & Medication Alarms',
          description: 'High-priority alarms that break through lock screen & tray',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
      }

      if (plugin.registerActionTypes) {
        await plugin.registerActionTypes({
          types: [
            {
              id: TASK_ACTION_TYPE_ID,
              actions: [
                { id: 'complete', title: 'Complete' },
                { id: 'snooze', title: 'Snooze 5m' },
              ],
            },
          ],
        });
      }

      if (plugin.addListener) {
        await plugin.addListener('localNotificationActionPerformed', (event: any) => {
          const actionId = event?.actionId;
          const taskId = event?.notification?.extra?.taskId;
          if (!taskId) return;
          if (actionId === 'complete') {
            window.dispatchEvent(new CustomEvent('omnilifeos_complete_task', { detail: { taskId } }));
          } else if (actionId === 'snooze') {
            window.dispatchEvent(new CustomEvent('omnilifeos_snooze_task', { detail: { taskId } }));
          }
        });
      }

      if (plugin.checkPermissions) {
        const perm = await plugin.checkPermissions();
        if (perm?.display === 'granted') {
          this.nativePermission = 'granted';
        } else if (perm?.display === 'denied') {
          this.nativePermission = 'denied';
        } else {
          this.nativePermission = 'default';
        }
      }
    } catch {
      // Ignore native init warnings on unsupported webviews
    }
  }

  private async initServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
    } catch {
      // Service worker registration skipped in restricted iframe
    }
  }

  private async getActiveSwRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      return this.swRegistration;
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 1200)),
        ]);
        if (reg && 'showNotification' in reg) {
          this.swRegistration = reg;
          return reg;
        }
      } catch {}
    }
    return null;
  }

  private initBackgroundTicker() {
    if (typeof window === 'undefined' || !window.Worker) return;

    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) {
              timer = setInterval(function() {
                self.postMessage('tick');
              }, 10000);
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
      setInterval(() => {
        this.triggerCallbacks();
      }, 10000);
    }
  }

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
    if (this.isNativePlatform()) return true;
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): NotificationPermissionStatus {
    if (this.isNativePlatform()) return this.nativePermission;
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  async requestPermission(): Promise<boolean> {
    const plugin = this.getNativePlugin();
    if (plugin) {
      try {
        if (plugin.requestPermissions) {
          const res = await plugin.requestPermissions();
          const granted = res?.display === 'granted';
          this.nativePermission = granted ? 'granted' : 'denied';
          return granted;
        }
      } catch {
        return false;
      }
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  async ensurePermissionSilentlyOnAction(): Promise<boolean> {
    const current = this.getPermission();
    if (current === 'granted') return true;
    if (current === 'default') {
      return await this.requestPermission();
    }
    return false;
  }

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
    const existing = this.scheduledReminders.get(reminder.id);
    if (existing && existing.timerRef) {
      clearTimeout(existing.timerRef);
    }

    const now = Date.now();
    const delayMs = reminder.targetTs - now;

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

  /**
   * Synchronize upcoming reminders/alarms directly with Android LocalNotifications
   * (so OS heads-up & lockscreen notifications fire outside the app even when closed)
   * AND register exact in-browser fallback timers.
   */
  async syncScheduledReminders(items: ScheduledSystemReminder[]) {
    const now = Date.now();
    const maxWindowMs = 7 * 24 * 60 * 60 * 1000;
    const upcoming = items
      .filter(i => i.targetTs > now + 2000 && i.targetTs <= now + maxWindowMs)
      .sort((a, b) => a.targetTs - b.targetTs)
      .slice(0, 48);

    // 1. Update Web exact timers for upcoming 24h
    this.syncedWebTimers.forEach(t => clearTimeout(t));
    this.syncedWebTimers.clear();
    upcoming.forEach(item => {
      const delayMs = item.targetTs - Date.now();
      if (delayMs > 0 && delayMs <= 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          this.syncedWebTimers.delete(item.id);
          // Only trigger OS notification if permission is granted (checkReminders handles in-app banner & audio)
          this.notify(item.title, {
            body: item.body,
            tag: item.id,
            taskId: item.entityId,
            category: item.category,
            sound: item.sound || (item.isAlarm ? 'alarm' : 'task'),
            isAlarm: item.isAlarm,
            skipSound: true,
          });
        }, delayMs);
        this.syncedWebTimers.set(item.id, timer);
      }
    });

    // 2. Sync native Android AlarmManager / LocalNotifications when running in Capacitor APK
    const plugin = this.getNativePlugin();
    if (!plugin || !plugin.schedule) return;

    try {
      if (this.nativePermission !== 'granted' && plugin.checkPermissions) {
        const p = await plugin.checkPermissions();
        if (p?.display === 'granted') {
          this.nativePermission = 'granted';
        }
      }
      if (this.nativePermission !== 'granted') return;

      // Cancel previously synced dynamic IDs
      try {
        const prevRaw = localStorage.getItem(SYNCED_IDS_STORAGE_KEY);
        if (prevRaw && plugin.cancel) {
          const prevIds: number[] = JSON.parse(prevRaw);
          if (Array.isArray(prevIds) && prevIds.length > 0) {
            await plugin.cancel({ notifications: prevIds.map(id => ({ id })) });
          }
        }
      } catch {}

      if (upcoming.length === 0) {
        localStorage.setItem(SYNCED_IDS_STORAGE_KEY, '[]');
        return;
      }

      const mapped = upcoming.map(item => {
        const numId = hashToInt32(item.id);
        return {
          id: numId,
          title: item.title,
          body: item.body,
          channelId: item.isAlarm ? ALARM_CHANNEL_ID : REMINDER_CHANNEL_ID,
          actionTypeId: item.entityId ? TASK_ACTION_TYPE_ID : undefined,
          extra: {
            taskId: item.entityId,
            category: item.category,
            isAlarm: Boolean(item.isAlarm),
          },
          schedule: {
            at: new Date(item.targetTs),
            allowWhileIdle: true,
          },
        };
      });

      await plugin.schedule({ notifications: mapped });
      localStorage.setItem(SYNCED_IDS_STORAGE_KEY, JSON.stringify(mapped.map(m => m.id)));
    } catch {
      // Non-fatal in case Android exact alarm permission wasn't granted yet
    }
  }

  // Dispatch audible alert + OS system notification outside the app (Native APK + Chrome SW + Desktop)
  async notify(
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
      isAlarm?: boolean;
      skipSound?: boolean;
    }
  ) {
    const category = options?.category || 'task';
    const soundAllowed = soundEngine.isSoundEnabled(category);

    // 1. Play synthetic audible alarm chime if enabled for this type
    if (soundAllowed && !options?.skipSound) {
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

    const bodyText = options?.body || 'JivanOS Reminder';
    const tagStr = options?.tag || `alert_${Date.now()}`;

    // 2. Native Android Capacitor System Notification (status bar + lock screen + heads-up banner)
    const plugin = this.getNativePlugin();
    if (plugin && plugin.schedule) {
      try {
        if (this.nativePermission === 'default' && plugin.checkPermissions) {
          const perm = await plugin.checkPermissions();
          this.nativePermission = perm?.display === 'granted' ? 'granted' : this.nativePermission;
        }
        if (this.nativePermission === 'granted') {
          await plugin.schedule({
            notifications: [
              {
                id: hashToInt32(tagStr),
                title,
                body: bodyText,
                channelId: options?.isAlarm ? ALARM_CHANNEL_ID : REMINDER_CHANNEL_ID,
                actionTypeId: options?.taskId ? TASK_ACTION_TYPE_ID : undefined,
                extra: {
                  taskId: options?.taskId,
                  category,
                },
                schedule: {
                  at: new Date(Date.now() + 120),
                  allowWhileIdle: true,
                },
              },
            ],
          });
          return;
        }
      } catch {
        // Fall through to Service Worker notification if native plugin call failed
      }
    }

    // 3. Web / Android Chrome PWA System Notification via Service Worker (works outside the app!)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notifOptions: any = {
        body: bodyText,
        icon: options?.icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: tagStr,
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: options?.vibrate === false ? undefined : [220, 100, 220],
        data: {
          taskId: options?.taskId,
          category,
          timestamp: Date.now(),
        },
      };

      const swOptions = {
        ...notifOptions,
        actions: options?.taskId
          ? [
              { action: 'complete', title: '✓ Complete' },
              { action: 'snooze', title: '⏱ Snooze 5m' },
              { action: 'open', title: '👀 Open' },
            ]
          : [{ action: 'open', title: '👀 Open JivanOS' }],
      };

      try {
        const reg = await this.getActiveSwRegistration();
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, swOptions as unknown as NotificationOptions);
          return;
        }
      } catch {
        // Fallback below
      }

      try {
        new Notification(title, notifOptions);
      } catch {
        // Chrome Android forbids `new Notification()` without SW; SW branch handles Chrome Android
      }
    }
  }

  async testNotificationAlert(tone?: AlarmToneType): Promise<{ success: boolean; message: string }> {
    soundEngine.resume();

    let granted = this.getPermission() === 'granted';
    if (!granted && this.isSupported()) {
      granted = await this.requestPermission();
    }

    await this.notify('🔔 Test Reminder: JivanOS Alert', {
      body: 'System-level OS banner, sound chime, and lock-screen alert verified!',
      sound: 'alarm',
      tone: tone || soundEngine.getTone(),
      tag: 'test_alert',
      isAlarm: true,
    });

    if (granted) {
      return { success: true, message: 'Audible alarm played & system OS notification delivered outside the app!' };
    } else {
      return { success: true, message: 'Audible chime played. Allow system notifications to receive alerts outside the app.' };
    }
  }
}

export const notificationService = NotificationService.getInstance();
