import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const isTauriOrNativeShell =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    window.location.hostname.includes('tauri') ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()));

if ('serviceWorker' in navigator) {
  if (isTauriOrNativeShell) {
    // Unregister any stale service workers inside Tauri Desktop or Capacitor WebView
    // so they never intercept local asset navigation with an "Offline" response.
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
