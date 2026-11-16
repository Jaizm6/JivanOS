import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker during browser idle time so it never competes with initial boot
if ('serviceWorker' in navigator) {
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
