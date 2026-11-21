/**
 * Phase 9 — Desktop System Tray, Global Shortcuts, Native Notifications & Autostart Service
 *
 * Active only when running inside the Tauri v2 desktop wrapper (`isDesktop() === true`).
 * Safely no-ops on Web and Android.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import {
  isRegistered,
  register,
  unregister,
} from '@tauri-apps/plugin-global-shortcut';
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import { isDesktop } from './KeychainService';

export interface DesktopActionHandlers {
  onSyncNow: () => void | Promise<void>;
  onExportBackup: () => void | Promise<void>;
  onOpenSettings: () => void;
}

const DESKTOP_SHORTCUTS = {
  SYNC: 'CommandOrControl+S',
  EXPORT: 'CommandOrControl+E',
  SETTINGS: 'CommandOrControl+,',
} as const;

/**
 * Updates the system tray hover tooltip (e.g., "Synced 5 min ago" or "JivanOS — Offline").
 */
export async function updateTraySyncTooltip(statusText: string): Promise<void> {
  if (!isDesktop()) return;
  try {
    const clean = statusText.trim() || 'JivanOS — Ready';
    await invoke<void>('tray_set_tooltip', { tooltip: clean });
  } catch {
    // Ignore if tray is unavailable on headless Linux environments
  }
}

/**
 * Brings the main JivanOS window to the foreground.
 */
export async function showMainDesktopWindow(): Promise<void> {
  if (!isDesktop()) return;
  try {
    await invoke<void>('desktop_show_main_window');
  } catch {}
}

/**
 * Displays a native OS desktop notification for sync completion or failure.
 */
export async function sendDesktopSyncNotification(
  success: boolean,
  detail?: string
): Promise<void> {
  if (!isDesktop()) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === 'granted';
    }
    if (!granted) return;

    if (success) {
      sendNotification({
        title: 'JivanOS',
        body: detail ? `✓ ${detail}` : '✓ JivanOS synced successfully',
      });
    } else {
      sendNotification({
        title: 'JivanOS Sync',
        body: detail ? `⚠ ${detail}` : '⚠ Sync failed — tap to retry',
      });
    }
  } catch {
    // Notification plugin unavailable or permission dismissed
  }
}

/**
 * Check whether JivanOS is set to auto-launch at OS login.
 */
export async function getAutoLaunchEnabled(): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    return await isAutostartEnabled();
  } catch {
    return false;
  }
}

/**
 * Enable or disable auto-launch on Windows/Linux startup.
 */
export async function setAutoLaunchEnabled(enabled: boolean): Promise<boolean> {
  if (!isDesktop()) return false;
  try {
    if (enabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
    return await isAutostartEnabled();
  } catch {
    return false;
  }
}

/**
 * Initializes Tauri tray menu listeners and global keyboard shortcuts:
 * - Ctrl+S -> Sync Now
 * - Ctrl+E -> Export Backup
 * - Ctrl+, -> Open Settings
 *
 * Returns a cleanup function that unregisters shortcuts and event listeners.
 */
export function initDesktopTrayAndShortcuts(handlers: DesktopActionHandlers): () => void {
  if (!isDesktop()) {
    return () => {};
  }

  let disposed = false;
  const unlisteners: UnlistenFn[] = [];
  const registeredShortcuts: string[] = [];

  // 1. Listen to native system tray events from Rust
  listen('jivanos://tray-sync-now', () => {
    if (!disposed) handlers.onSyncNow();
  })
    .then((unlisten) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    })
    .catch(() => {});

  // 2. Register Tauri global shortcuts (with fallback to focused window keydown listener)
  const registerShortcutSafe = async (shortcut: string, cb: () => void) => {
    try {
      if (await isRegistered(shortcut)) {
        await unregister(shortcut);
      }
      await register(shortcut, (event) => {
        if (event.state === 'Pressed' && !disposed) {
          cb();
        }
      });
      if (disposed) {
        await unregister(shortcut).catch(() => {});
      } else {
        registeredShortcuts.push(shortcut);
      }
    } catch {
      // Wayland / restricted desktop environments may decline global hotkey registration
    }
  };

  void registerShortcutSafe(DESKTOP_SHORTCUTS.SYNC, () => {
    void handlers.onSyncNow();
  });
  void registerShortcutSafe(DESKTOP_SHORTCUTS.EXPORT, () => {
    void handlers.onExportBackup();
  });
  void registerShortcutSafe(DESKTOP_SHORTCUTS.SETTINGS, () => {
    void showMainDesktopWindow();
    handlers.onOpenSettings();
  });

  // 3. Focused-window keyboard shortcut fallback (works on Wayland / when global hotkey is busy)
  const handleWindowKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      void handlers.onSyncNow();
    } else if (key === 'e') {
      e.preventDefault();
      void handlers.onExportBackup();
    } else if (e.key === ',') {
      e.preventDefault();
      handlers.onOpenSettings();
    }
  };
  window.addEventListener('keydown', handleWindowKeyDown);

  return () => {
    disposed = true;
    window.removeEventListener('keydown', handleWindowKeyDown);
    for (const unlisten of unlisteners) {
      try {
        unlisten();
      } catch {}
    }
    for (const shortcut of registeredShortcuts) {
      void unregister(shortcut).catch(() => {});
    }
  };
}

export const TrayService = {
  updateTraySyncTooltip,
  showMainDesktopWindow,
  sendDesktopSyncNotification,
  getAutoLaunchEnabled,
  setAutoLaunchEnabled,
  initDesktopTrayAndShortcuts,
};
