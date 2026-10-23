import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { getInitialLiquidGlassConfig, getInitialMotionConfig, applyLiquidGlassAndMotionToCSS } from './utils/liquidGlass';

// Apply stored Liquid Glass & Motion CSS variables on app launch
applyLiquidGlassAndMotionToCSS(getInitialLiquidGlassConfig(), getInitialMotionConfig());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Application Failed to Load">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register Progressive Web App (PWA) Service Worker for offline capability & background notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Silently handled in sandboxed iframe previews
      });
  });
}
