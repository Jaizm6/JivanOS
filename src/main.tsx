import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CURRENT_APP_BUILD_VERSION = '3.1.0';
const INSTALLED_VERSION_STORAGE_KEY = 'jivanos_installed_app_version';

const ARRAY_COLLECTION_KEYS = [
  'jivanos_v2_tasks',
  'jivanos_v2_habits',
  'jivanos_v2_routines',
  'jivanos_v2_meds',
  'jivanos_v2_doselogs',
  'jivanos_v2_goals',
  'jivanos_v2_bills',
  'jivanos_v2_tags',
  'jivanos_v2_todo_lists',
  'jivanos_v2_list_groups',
  'jivanos_v2_schedule',
  'jivanos_v2_inbox',
  'jivanos_v2_widgets',
  'jivanos_v2_notif_history',
  'jivanos_v2_alarm_history',
  'jivanos_v2_workflow_stages',
];

function sanitizeInPlaceUpgradeStorage(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  let isVersionUpgrade = false;
  try {
    const previousVersion = localStorage.getItem(INSTALLED_VERSION_STORAGE_KEY);
    isVersionUpgrade = previousVersion !== CURRENT_APP_BUILD_VERSION;

    // Always repair deleted_ids if a previous version serialized it as an object {"0": "id"}
    const rawDeleted = localStorage.getItem('jivanos_v2_deleted_ids');
    if (rawDeleted) {
      try {
        const parsedDeleted = JSON.parse(rawDeleted);
        if (!Array.isArray(parsedDeleted)) {
          const recovered =
            parsedDeleted && typeof parsedDeleted === 'object'
              ? Object.values(parsedDeleted).filter((v): v is string => typeof v === 'string' && v.length > 0)
              : [];
          localStorage.setItem('jivanos_v2_deleted_ids', JSON.stringify(recovered.slice(-500)));
        }
      } catch {
        localStorage.setItem('jivanos_v2_deleted_ids', '[]');
      }
    }

    // Repair any collection key that may have been corrupted during an older version's sync merge
    for (const key of ARRAY_COLLECTION_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(item => item !== null && item !== undefined);
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        } else if (parsed && typeof parsed === 'object') {
          const recovered = Object.values(parsed).filter(
            item => item !== null && typeof item === 'object'
          );
          localStorage.setItem(key, JSON.stringify(recovered));
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }

    // Migrate any v2 unified sync key accidentally written by older builds into v1
    const straySyncV2 = localStorage.getItem('jivanos_unified_sync_settings_v2');
    if (straySyncV2) {
      if (!localStorage.getItem('jivanos_unified_sync_settings_v1')) {
        localStorage.setItem('jivanos_unified_sync_settings_v1', straySyncV2);
      }
      localStorage.removeItem('jivanos_unified_sync_settings_v2');
    }

    if (isVersionUpgrade) {
      localStorage.setItem(INSTALLED_VERSION_STORAGE_KEY, CURRENT_APP_BUILD_VERSION);
    }
  } catch {
    // Never block app boot if storage is restricted
  }
  return isVersionUpgrade;
}

const didUpgradeVersion = sanitizeInPlaceUpgradeStorage();

const isTauriOrNativeShell =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    window.location.hostname.includes('tauri') ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()));

if ('serviceWorker' in navigator) {
  if (isTauriOrNativeShell) {
    // Unregister any stale service workers inside Tauri Desktop or Capacitor WebView
    // so they never intercept local asset navigation with an "Offline" response or serve old APK bundles.
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => {
        registrations.forEach(reg => {
          reg.unregister().catch(() => {});
        });
      })
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then(keys => {
          keys.forEach(k => caches.delete(k).catch(() => {}));
        })
        .catch(() => {});
    }
  } else {
    if (didUpgradeVersion && 'caches' in window) {
      caches
        .keys()
        .then(keys => {
          keys.forEach(k => caches.delete(k).catch(() => {}));
        })
        .catch(() => {});
    }
    window.addEventListener('load', () => {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(registration => {
            registration.update().catch(() => {});
          })
          .catch(() => {});
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(registerSW, { timeout: 3000 });
      } else {
        setTimeout(registerSW, 1500);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
