import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { TaskManager } from './components/tasks/TaskManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ActiveAlarmBanner } from './components/notifications/ActiveAlarmBanner';
import { UndoSnackbar } from './components/common/UndoSnackbar';
import { DraggablePiPWidget } from './components/common/DraggablePiPWidget';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { AndroidToastContainer } from './components/common/AndroidToast';
import { QuoteReminderService } from './components/quotes/QuoteReminderService';

import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { ActiveTab } from './types';
import {
  getSavedPetalColorStyle,
  getSavedAmoledBlack,
  getSavedExpressiveShapes,
} from './components/common/PetalExpressive';
import { getVisualPaletteMode } from './utils/activityStyles';
import { getInitialLiquidGlassConfig, getInitialMotionConfig, applyLiquidGlassAndMotionToCSS } from './utils/liquidGlass';
import { lazyWithRetry } from './utils/lazyWithRetry';
import {
  getRealSyncOverview,
  requestOpenBackupSyncScreen,
} from './sync/syncConnectionState';
import { isDesktop } from './desktop/KeychainService';
import { TrayService } from './desktop/TrayService';
import { exportLocalBackup } from './utils/localBackupEngine';
import { showAndroidToast } from './components/common/AndroidToast';
import {
  DRIVE_SYNC_STATE_EVENT,
  formatRelativeSyncTime,
} from './utils/googleDriveSync';
import { DROPBOX_SYNC_STATE_EVENT } from './utils/dropboxSync';
import {
  TELEGRAM_SYNC_STATE_EVENT,
  telegramSyncProvider,
} from './sync/providers/TelegramSyncProvider';
import {
  MEGA_SYNC_STATE_EVENT,
  megaSyncProvider,
} from './sync/providers/MEGASyncProvider';
import {
  JIVANOS_CLOUD_STATE_EVENT,
  firestoreSyncProvider,
} from './sync/providers/FirestoreSyncProvider';
import { googleDriveSyncProvider } from './sync/providers/GoogleDriveProvider';
import { dropboxSyncProvider } from './sync/providers/DropboxProvider';

// Lazy-loaded secondary tabs and modals with automatic network retry
const MedicationManager = lazyWithRetry(() => import('./components/medications/MedicationManager').then(m => ({ default: m.MedicationManager })));
const HabitTracker = lazyWithRetry(() => import('./components/habits/HabitTracker').then(m => ({ default: m.HabitTracker })));
const GoalsManager = lazyWithRetry(() => import('./components/goals/GoalsManager').then(m => ({ default: m.GoalsManager })));
const BillsManager = lazyWithRetry(() => import('./components/bills/BillsManager').then(m => ({ default: m.BillsManager })));
const AnalyticsView = lazyWithRetry(() => import('./components/analytics/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const QuotesManager = lazyWithRetry(() => import('./components/quotes/QuotesManager').then(m => ({ default: m.QuotesManager })));

const WidgetCustomizerModal = lazyWithRetry(() => import('./components/dashboard/WidgetCustomizerModal').then(m => ({ default: m.WidgetCustomizerModal })));
const AppLockScreen = lazyWithRetry(() => import('./components/security/AppLockScreen').then(m => ({ default: m.AppLockScreen })));
const ProfileModal = lazyWithRetry(() => import('./components/common/ProfileModal').then(m => ({ default: m.ProfileModal })));
const AIChatDrawer = lazyWithRetry(() => import('./components/ai/AIChatDrawer').then(m => ({ default: m.AIChatDrawer })));
const TagsManager = lazyWithRetry(() => import('./components/tags/TagsManager').then(m => ({ default: m.TagsManager })));
const ActivityManager = lazyWithRetry(() => import('./components/common/ActivityManager').then(m => ({ default: m.ActivityManager })));
const InstallAppModal = lazyWithRetry(() => import('./components/pwa/InstallAppModal').then(m => ({ default: m.InstallAppModal })));

const ActiveViewCanvas: React.FC<{ activeTab: ActiveTab }> = React.memo(({ activeTab }) => {
  switch (activeTab) {
    case 'tasks':
      return <TaskManager initialViewMode="list" />;
    case 'planner':
    case 'timeline':
    case 'calendar':
    case 'schedule':
      return <TaskManager initialViewMode="events" />;
    case 'medications':
      return <MedicationManager />;
    case 'habits':
      return <HabitTracker />;
    case 'goals':
      return <GoalsManager />;
    case 'bills':
      return <BillsManager />;
    case 'quotes':
      return <QuotesManager />;
    case 'tags':
      return <TagsManager />;
    case 'analytics':
      return <AnalyticsView />;
    case 'settings':
      return <SettingsManager />;
    default:
      return <TaskManager initialViewMode="list" />;
  }
});

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
    isAIChatOpen,
    setIsAIChatOpen,
    isInstallModalOpen,
    setIsInstallModalOpen,
    isWidgetModalOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    isAuthModalOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    appLock,
    exportEncryptedJSON,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  } = useApp();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const isSidebarCollapsedRef = useRef(isSidebarCollapsed);
  isSidebarCollapsedRef.current = isSidebarCollapsed;

  const setIsSidebarCollapsedRef = useRef(setIsSidebarCollapsed);
  setIsSidebarCollapsedRef.current = setIsSidebarCollapsed;

  const drawerDragRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    dx: number;
    dy: number;
    vx: number;
    lockedAxis: 'x' | 'y' | null;
    startOpen: boolean;
    startOffsetPx: number;
    drawerWidth: number;
    isEdgeStart: boolean;
  } | null>(null);

  const drawerSettleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // If toggled via button click while no touch-drag settle timer is owning inline styles, ensure CSS data-open rules control transform smoothly
    if (drawerDragRef.current === null && drawerSettleTimerRef.current === null) {
      const sidebar = document.querySelector<HTMLElement>('[data-drawer-sidebar="true"]');
      if (sidebar) {
        sidebar.style.removeProperty('transition');
        sidebar.style.removeProperty('transform');
        sidebar.style.removeProperty('pointer-events');
      }
      const backdrop = document.querySelector<HTMLElement>('[data-drawer-backdrop="true"]');
      if (backdrop) {
        backdrop.style.removeProperty('transition');
        backdrop.style.removeProperty('opacity');
        backdrop.style.removeProperty('visibility');
        backdrop.style.removeProperty('pointer-events');
      }
    }
  }, [isSidebarCollapsed]);

  // Fluid Real-Time Touch-Drag Physics for Left Panel Drawer
  // Animates sidebar & backdrop directly on the GPU compositor with mid-flight catch & zero scroll blocking.
  useEffect(() => {
    let isTouchMoveAttached = false;
    let rafId: number | null = null;
    let pendingOffsetPx: number | null = null;
    let pendingDrawerWidth = 276;
    let transitionEndCleanup: (() => void) | null = null;

    const getSidebarEl = () =>
      document.querySelector<HTMLElement>('[data-drawer-sidebar="true"]');
    const getBackdropEl = () =>
      document.querySelector<HTMLElement>('[data-drawer-backdrop="true"]');

    const clearInlineDragStyles = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      transitionEndCleanup?.();
      transitionEndCleanup = null;
      pendingOffsetPx = null;
      const sidebar = getSidebarEl();
      if (sidebar) {
        sidebar.style.removeProperty('transition');
        sidebar.style.removeProperty('transform');
        sidebar.style.removeProperty('pointer-events');
      }
      const backdrop = getBackdropEl();
      if (backdrop) {
        backdrop.style.removeProperty('transition');
        backdrop.style.removeProperty('opacity');
        backdrop.style.removeProperty('visibility');
        backdrop.style.removeProperty('pointer-events');
      }
    };

    const detachMoveListeners = () => {
      if (isTouchMoveAttached) {
        window.removeEventListener('touchmove', onTouchMove, { capture: true });
        isTouchMoveAttached = false;
      }
      window.removeEventListener('touchend', onTouchEndOrCancel, { capture: true });
      window.removeEventListener('touchcancel', onTouchEndOrCancel, { capture: true });
    };

    // Yield to horizontal chip/date strips only if they can actually scroll backwards (scrollLeft > 2)
    const hasActiveLeftScrollAncestor = (el: HTMLElement | null): boolean => {
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        if (cur.scrollLeft > 2 && cur.scrollWidth > cur.clientWidth + 4) {
          const style = window.getComputedStyle(cur);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
            return true;
          }
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const applyDragFrame = () => {
      rafId = null;
      if (pendingOffsetPx === null) return;
      const offsetPx = pendingOffsetPx;
      const drawerWidth = pendingDrawerWidth;
      const progress = Math.max(0, Math.min(1, offsetPx / drawerWidth));
      const sidebar = getSidebarEl();
      if (sidebar) {
        sidebar.style.transform = `translate3d(${(offsetPx - drawerWidth).toFixed(1)}px, 0, 0)`;
      }
      const backdrop = getBackdropEl();
      if (backdrop) {
        backdrop.style.opacity = progress.toFixed(3);
      }
    };

    const settleDrawer = (targetOpen: boolean) => {
      // Flush any unapplied final finger coordinate before starting release glide
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingOffsetPx !== null) {
        applyDragFrame();
        pendingOffsetPx = null;
      }
      if (drawerSettleTimerRef.current !== null) {
        clearTimeout(drawerSettleTimerRef.current);
        drawerSettleTimerRef.current = null;
      }
      transitionEndCleanup?.();
      transitionEndCleanup = null;

      isSidebarCollapsedRef.current = !targetOpen;
      const sidebar = getSidebarEl();
      const backdrop = getBackdropEl();
      const durationMs = targetOpen ? 280 : 220;
      const easing = targetOpen
        ? 'cubic-bezier(0.05, 0.7, 0.1, 1)'
        : 'cubic-bezier(0.2, 0, 0, 1)';

      if (sidebar) {
        // Ensure current inline transform is committed on the compositor before applying transition
        void sidebar.offsetWidth;
        sidebar.setAttribute('data-open', targetOpen ? 'true' : 'false');
        sidebar.style.transition = `transform ${durationMs}ms ${easing}`;
        sidebar.style.transform = targetOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)';
        sidebar.style.pointerEvents = targetOpen ? 'auto' : 'none';

        const onTransitionEnd = (ev: TransitionEvent) => {
          if (ev.target === sidebar && ev.propertyName === 'transform') {
            if (drawerSettleTimerRef.current !== null) {
              clearTimeout(drawerSettleTimerRef.current);
              drawerSettleTimerRef.current = null;
            }
            clearInlineDragStyles();
          }
        };
        sidebar.addEventListener('transitionend', onTransitionEnd);
        transitionEndCleanup = () => sidebar.removeEventListener('transitionend', onTransitionEnd);
      }
      if (backdrop) {
        backdrop.setAttribute('data-open', targetOpen ? 'true' : 'false');
        backdrop.style.transition = `opacity ${durationMs}ms ${easing}`;
        backdrop.style.visibility = 'visible';
        backdrop.style.opacity = targetOpen ? '1' : '0';
        backdrop.style.pointerEvents = targetOpen ? 'auto' : 'none';
      }

      setIsSidebarCollapsedRef.current(!targetOpen);

      drawerSettleTimerRef.current = window.setTimeout(() => {
        drawerSettleTimerRef.current = null;
        clearInlineDragStyles();
      }, durationMs + 50);
    };

    const forceAbortDrag = () => {
      detachMoveListeners();
      const state = drawerDragRef.current;
      drawerDragRef.current = null;
      if (state?.lockedAxis === 'x') {
        settleDrawer(!isSidebarCollapsedRef.current);
      } else if (drawerSettleTimerRef.current === null) {
        clearInlineDragStyles();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        if (drawerDragRef.current) forceAbortDrag();
        return;
      }

      const drawerWidth = window.innerWidth >= 640 ? 292 : 276;
      let liveOffsetPx: number | null = null;

      // Catch mid-flight settle cleanly from actual compositor pixel position instead of snapping
      if (drawerSettleTimerRef.current !== null) {
        clearTimeout(drawerSettleTimerRef.current);
        drawerSettleTimerRef.current = null;
        transitionEndCleanup?.();
        transitionEndCleanup = null;
        const sidebar = getSidebarEl();
        if (sidebar) {
          const matrixStr = window.getComputedStyle(sidebar).transform;
          let currentTx = 0;
          if (matrixStr && matrixStr !== 'none') {
            try {
              currentTx = new DOMMatrixReadOnly(matrixStr).m41;
            } catch {
              currentTx = 0;
            }
          }
          liveOffsetPx = Math.max(0, Math.min(drawerWidth, drawerWidth + currentTx));
          sidebar.style.transition = 'none';
          sidebar.style.transform = `translate3d(${(liveOffsetPx - drawerWidth).toFixed(1)}px, 0, 0)`;
          sidebar.style.pointerEvents = 'auto';
          const backdrop = getBackdropEl();
          if (backdrop) {
            backdrop.style.transition = 'none';
            backdrop.style.visibility = 'visible';
            backdrop.style.opacity = (liveOffsetPx / drawerWidth).toFixed(3);
            backdrop.style.pointerEvents = 'auto';
          }
        }
      }

      const t = e.touches[0];
      const target = e.target as HTMLElement | null;

      const isEdgeSensor = Boolean(target?.closest('[data-drawer-edge-sensor]'));
      // Left-side thumb zone (~30% width, 96..132px) clears Android/iOS OS back bezel cleanly
      const thumbZoneWidth = Math.max(96, Math.min(132, Math.round(window.innerWidth * 0.3)));
      const isEdgeStart = isEdgeSensor || t.clientX <= thumbZoneWidth;
      const startOpen = !isSidebarCollapsedRef.current;
      const isInFlight = liveOffsetPx !== null && liveOffsetPx > 12;

      if (!startOpen && !isEdgeStart && !isInFlight) {
        drawerDragRef.current = null;
        return;
      }

      // Do not hijack touch gestures inside dialogs, alerts/toasts, inputs, or explicit opt-outs
      if (
        !isEdgeSensor &&
        target?.closest('[role="dialog"], [role="alert"], .modal-content, input, textarea, select, [data-no-drawer-swipe]')
      ) {
        drawerDragRef.current = null;
        return;
      }

      // Only yield to horizontal strips outside the strict 44px left bezel when scrolled right
      if (!startOpen && !isEdgeSensor && t.clientX > 44 && hasActiveLeftScrollAncestor(target)) {
        drawerDragRef.current = null;
        return;
      }

      const now = performance.now();

      drawerDragRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastTime: now,
        dx: 0,
        dy: 0,
        vx: 0,
        lockedAxis: null,
        startOpen,
        startOffsetPx: liveOffsetPx ?? (startOpen ? drawerWidth : 0),
        drawerWidth,
        isEdgeStart,
      };

      if (!isTouchMoveAttached) {
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        isTouchMoveAttached = true;
      }
      window.addEventListener('touchend', onTouchEndOrCancel, { passive: true, capture: true });
      window.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true, capture: true });
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = drawerDragRef.current;
      if (!state || e.touches.length !== 1) return;

      const t = e.touches[0];
      const now = performance.now();
      const dt = Math.max(1, now - state.lastTime);
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Determine gesture axis lock on initial movement
      if (state.lockedAxis === null) {
        if (absDx < 5 && absDy < 5) return;

        // If drawer is closed at rest and user swipes left instead of right, yield immediately for horizontal scrolling
        if (!state.startOpen && state.startOffsetPx === 0 && dx < -6) {
          drawerDragRef.current = null;
          detachMoveListeners();
          return;
        }

        const isStrongEdge = state.isEdgeStart && state.startX <= 42;
        const minHorizontalDelta = state.startOpen || state.startOffsetPx > 0 ? 7 : isStrongEdge ? 6 : 9;
        const horizontalDominanceRatio = state.startOpen || state.startOffsetPx > 0 ? 1.0 : isStrongEdge ? 0.85 : 1.08;
        const minVerticalBail = isStrongEdge ? 16 : 12;

        const wantsToOpen = (!state.startOpen || state.startOffsetPx < state.drawerWidth) && dx > minHorizontalDelta;
        const wantsToClose = (state.startOpen || state.startOffsetPx > 0) && dx < -minHorizontalDelta;

        if ((wantsToOpen || wantsToClose) && absDx >= absDy * horizontalDominanceRatio) {
          state.lockedAxis = 'x';
          const sidebar = getSidebarEl();
          if (sidebar) {
            sidebar.style.transition = 'none';
            sidebar.style.pointerEvents = 'auto';
          }
          const backdrop = getBackdropEl();
          if (backdrop) {
            backdrop.style.transition = 'none';
            backdrop.style.visibility = 'visible';
            backdrop.style.pointerEvents = 'auto';
          }
        } else if (absDy > minVerticalBail && absDy > absDx * 1.15) {
          state.lockedAxis = 'y';
          drawerDragRef.current = null;
          detachMoveListeners();
          return;
        } else {
          return;
        }
      }

      if (state.lockedAxis === 'x') {
        if (e.cancelable) {
          e.preventDefault();
        }

        const instVx = (t.clientX - state.lastX) / dt;
        state.vx = state.vx * 0.35 + instVx * 0.65;
        state.lastX = t.clientX;
        state.lastTime = now;
        state.dx = dx;
        state.dy = dy;

        pendingOffsetPx = Math.max(0, Math.min(state.drawerWidth, state.startOffsetPx + dx));
        pendingDrawerWidth = state.drawerWidth;

        if (rafId === null) {
          rafId = requestAnimationFrame(applyDragFrame);
        }
      }
    };

    const onTouchEndOrCancel = (e?: TouchEvent) => {
      if (e && e.type === 'touchend' && e.touches.length > 0) return;
      detachMoveListeners();
      const state = drawerDragRef.current;
      drawerDragRef.current = null;
      if (!state) return;

      if (state.lockedAxis === 'x') {
        const { dx, vx, startOpen, startOffsetPx, drawerWidth } = state;
        const offsetPx = Math.max(0, Math.min(drawerWidth, startOffsetPx + dx));
        const progress = offsetPx / drawerWidth;

        if (!startOpen) {
          const shouldOpen =
            (dx >= 32 || (vx >= 0.2 && dx >= 12) || progress >= 0.22) && vx > -0.2;
          settleDrawer(shouldOpen);
        } else {
          const shouldClose =
            (dx <= -32 || (vx <= -0.2 && dx <= -12) || progress <= 0.78) && vx < 0.2;
          settleDrawer(!shouldClose);
        }
      } else if (drawerSettleTimerRef.current === null && !isSidebarCollapsedRef.current !== state.startOpen) {
        // Restore clean state if interrupted settle was barely touched without locking X
        clearInlineDragStyles();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) forceAbortDrag();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('blur', forceAbortDrag);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (drawerSettleTimerRef.current !== null) clearTimeout(drawerSettleTimerRef.current);
      clearInlineDragStyles();
      detachMoveListeners();
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('blur', forceAbortDrag);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const doc = document.documentElement;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      doc.style.setProperty('--app-height', `${viewportHeight}px`);
      
      // Heuristic: If viewport is significantly smaller than window height, keyboard is likely active.
      const isKeyboardActive = window.visualViewport && (window.visualViewport.height < window.innerHeight * 0.85);
      if (isKeyboardActive) {
        doc.classList.add('keyboard-active');
      } else {
        doc.classList.remove('keyboard-active');
      }
    };

    window.visualViewport?.addEventListener('resize', setAppHeight);
    window.addEventListener('resize', setAppHeight);
    setAppHeight();

    return () => {
      window.visualViewport?.removeEventListener('resize', setAppHeight);
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  // Initialize saved Petal Material You color style, visual palette mode, AMOLED Pure Black mode, and Motion config
  useEffect(() => {
    try {
      const root = document.documentElement;
      const savedPalette = getVisualPaletteMode();
      const savedStyle = getSavedPetalColorStyle();
      root.setAttribute('data-visual-palette', savedPalette);
      document.body?.setAttribute('data-visual-palette', savedPalette);
      root.setAttribute('data-color-style', savedStyle);
      root.setAttribute('data-amoled', String(getSavedAmoledBlack()));
      root.setAttribute('data-expressive-shapes', String(getSavedExpressiveShapes()));
      applyLiquidGlassAndMotionToCSS(getInitialLiquidGlassConfig(), getInitialMotionConfig());
    } catch {
      // Ignore initialization errors
    }
  }, []);

  // Bind horizontal wheel scrolling directly to hovered overflow-x containers so window has zero scroll-blocking wheel listeners
  React.useEffect(() => {
    const boundStrips = new WeakSet<HTMLElement>();

    const onStripWheel = function (this: HTMLElement, e: WheelEvent) {
      if (e.shiftKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const canScrollLeft = e.deltaY < 0 && this.scrollLeft > 0;
      const canScrollRight = e.deltaY > 0 && this.scrollLeft < this.scrollWidth - this.clientWidth - 1;
      if (canScrollLeft || canScrollRight) {
        this.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    const handlePointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const target = e.target as HTMLElement | null;
      const scrollable = target?.closest(
        '.overflow-x-auto, .overflow-x-scroll, [class*="overflow-x-auto"], [class*="overflow-x-scroll"], .custom-scrollbar'
      ) as HTMLElement | null;

      if (scrollable && !boundStrips.has(scrollable)) {
        boundStrips.add(scrollable);
        scrollable.addEventListener('wheel', onStripWheel, { passive: false });
      }
    };

    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    return () => document.removeEventListener('pointerover', handlePointerOver);
  }, []);

  // Safeguard: AI is a full-length popup card, not a dedicated page view
  React.useEffect(() => {
    if ((activeTab as string) === 'ai') {
      setIsAIChatOpen(true);
      setActiveTab('tasks');
    }
  }, [activeTab, setActiveTab, setIsAIChatOpen]);

  // Unified Backup & Sync flow: redirect any legacy BackupModal trigger straight to Settings -> Backup & Sync
  React.useEffect(() => {
    if (isBackupModalOpen) {
      setIsBackupModalOpen(false);
      setActiveTab('settings');
      requestOpenBackupSyncScreen();
    }
  }, [isBackupModalOpen, setIsBackupModalOpen, setActiveTab]);

  // Phase 9 Desktop Shell: hydrate OS keychain tokens, register Tray menu & global shortcuts (Ctrl+S, Ctrl+E, Ctrl+,)
  const desktopContextRef = useRef({
    firebaseUser,
    joplinSyncSettings,
    exportEncryptedJSON,
    syncDriveNow,
    setActiveTab,
  });
  desktopContextRef.current = {
    firebaseUser,
    joplinSyncSettings,
    exportEncryptedJSON,
    syncDriveNow,
    setActiveTab,
  };

  React.useEffect(() => {
    if (!isDesktop()) return;

    const refreshTrayTooltip = () => {
      const ctx = desktopContextRef.current;
      const overview = getRealSyncOverview(ctx.firebaseUser, ctx.joplinSyncSettings);
      if (overview.latestSyncedAt) {
        void TrayService.updateTraySyncTooltip(
          `Synced ${formatRelativeSyncTime(overview.latestSyncedAt)}`
        );
      } else if (overview.hasAnyConnected) {
        void TrayService.updateTraySyncTooltip(
          `JivanOS — ${overview.connectedCount} sync target${overview.connectedCount === 1 ? '' : 's'} ready`
        );
      } else {
        void TrayService.updateTraySyncTooltip('JivanOS — Local only');
      }
    };

    // Hydrate OS keychain cache silently on desktop startup
    void Promise.allSettled([
      googleDriveSyncProvider.silentReAuth(),
      dropboxSyncProvider.silentReAuth(),
      telegramSyncProvider.silentReAuth(),
    ]).then(() => refreshTrayTooltip());

    const handleDesktopSyncNow = async () => {
      const ctx = desktopContextRef.current;
      const overview = getRealSyncOverview(ctx.firebaseUser, ctx.joplinSyncSettings);
      if (!overview.hasAnyConnected) {
        showAndroidToast('Connect a sync provider in Settings → Backup & Sync', 2800, 'default');
        ctx.setActiveTab('settings');
        requestOpenBackupSyncScreen();
        return;
      }

      const preferredId = ctx.joplinSyncSettings.primaryTarget;
      const normalized = preferredId === 'nextcloud' ? 'webdav' : preferredId;
      const target =
        overview.connectedProviders.find((p) => p.id === normalized) ||
        overview.connectedProviders[0];

      if (!target) return;
      await TrayService.updateTraySyncTooltip(`Syncing ${target.label}…`);

      try {
        const localPayload = JSON.parse(ctx.exportEncryptedJSON()) as Record<string, unknown>;
        if (target.id === 'gdrive') {
          await googleDriveSyncProvider.backup(localPayload);
        } else if (target.id === 'dropbox') {
          await dropboxSyncProvider.backup(localPayload);
        } else if (target.id === 'telegram') {
          await telegramSyncProvider.backup(localPayload);
        } else if (target.id === 'mega') {
          await megaSyncProvider.backup(localPayload);
        } else if (target.id === 'firebase') {
          await firestoreSyncProvider.backup(localPayload);
          await TrayService.sendDesktopSyncNotification(true);
        } else {
          await ctx.syncDriveNow(target.id);
          await TrayService.sendDesktopSyncNotification(true);
        }
        await TrayService.updateTraySyncTooltip('Synced just now');
        showAndroidToast(`Synced to ${target.label}`, 2400, 'success');
      } catch (err: any) {
        const message = err?.message || 'Desktop sync failed';
        await TrayService.updateTraySyncTooltip('JivanOS — Sync failed');
        await TrayService.sendDesktopSyncNotification(false);
        showAndroidToast(message, 3200, 'error');
      }
    };

    const handleDesktopExport = async () => {
      try {
        const ctx = desktopContextRef.current;
        await exportLocalBackup(ctx.exportEncryptedJSON());
        showAndroidToast('Exported JivanOS local backup', 2400, 'success');
      } catch (err: any) {
        showAndroidToast(err?.message || 'Backup export failed', 3000, 'error');
      }
    };

    const cleanupTray = TrayService.initDesktopTrayAndShortcuts({
      onSyncNow: handleDesktopSyncNow,
      onExportBackup: handleDesktopExport,
      onOpenSettings: () => {
        desktopContextRef.current.setActiveTab('settings');
      },
    });

    const syncEvents = [
      DRIVE_SYNC_STATE_EVENT,
      DROPBOX_SYNC_STATE_EVENT,
      TELEGRAM_SYNC_STATE_EVENT,
      MEGA_SYNC_STATE_EVENT,
      JIVANOS_CLOUD_STATE_EVENT,
    ];
    syncEvents.forEach((ev) => window.addEventListener(ev, refreshTrayTooltip));
    const tooltipTimer = window.setInterval(refreshTrayTooltip, 60000);

    return () => {
      cleanupTray();
      window.clearInterval(tooltipTimer);
      syncEvents.forEach((ev) => window.removeEventListener(ev, refreshTrayTooltip));
    };
  }, []);

  const isDrawerOpen = !isSidebarCollapsed;

  // Prevent background page scrolling when Left Panel drawer is open
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    }
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isDrawerOpen]);

  return (
    <div
      className="min-h-[var(--app-height)] w-full max-w-full overflow-x-clip flex flex-col transition-colors selection:bg-indigo-500 selection:text-white bg-slate-50 dark:bg-black"
    >
      {/* Smooth GPU-Composited Left Panel Drawer */}
      <Sidebar />

      {/* Tap-to-Close Scrim Overlay (synchronized CSS opacity + delayed visibility on close, touch-none blocks background scroll) */}
      <div
        data-drawer-backdrop="true"
        data-open={isDrawerOpen ? 'true' : 'false'}
        onClick={() => setIsSidebarCollapsed(true)}
        onTouchMove={e => {
          if (isDrawerOpen && e.cancelable) e.preventDefault();
        }}
        aria-hidden="true"
        className="fixed inset-0 z-[75] bg-black/25 dark:bg-black/50 cursor-pointer touch-none overscroll-none"
      />

      {/* Main Viewport Container (Stationary, zero blur, crisp native rendering) */}
      <div
        data-drawer-viewport="true"
        className="relative min-h-[var(--app-height)] w-full max-w-full flex flex-col flex-1"
      >
        {/* Top Navigation */}
        <Navbar />

        <div className="flex-1 flex max-w-7xl w-full mx-auto min-w-0 items-stretch">
          {/* Main Application Canvas */}
          <main className={`flex-1 flex-grow min-h-full min-w-0 w-full max-w-full overflow-x-clip pt-0.5 sm:pt-1 pb-16 sm:pb-18 pb-nav-clearance ${activeTab === 'tasks' || activeTab === 'planner' || activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule' ? 'px-1 sm:px-2.5 flex flex-col' : 'p-1.5 sm:p-3 lg:p-3.5'}`}>
            <ErrorBoundary fallbackTitle="View Loading Error">
              <div
                key={(activeTab === 'planner' || activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule') ? 'tasks' : activeTab}
                className="animate-page-enter flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-clip [&>*]:w-full [&>*]:min-w-0 [&>*]:max-w-full"
              >
                <Suspense
                  fallback={
                    <div className="flex-1 flex flex-col gap-2.5 p-2 animate-pulse">
                      <div className="h-10 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 w-full" />
                      <div className="h-14 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 w-full" />
                      <div className="h-14 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 w-full" />
                      <div className="h-14 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 w-full" />
                    </div>
                  }
                >
                  <ActiveViewCanvas activeTab={activeTab} />
                </Suspense>
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Unified Bottom Navigation across PC, Tablet, and Phone (Placed outside transformed content wrapper so it stays strictly fixed at bottom on scroll) */}
      <BottomNav />

      {/* Lazy-Loaded Modals & Drawers */}
      <Suspense fallback={null}>
        {isWidgetModalOpen && <WidgetCustomizerModal />}
        {isAuthModalOpen && <ProfileModal />}
        <AIChatDrawer isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
        {appLock?.isLocked && <AppLockScreen />}
        {isNotificationDrawerOpen && (
          <NotificationDrawer
            isOpen={isNotificationDrawerOpen}
            onClose={() => setIsNotificationDrawerOpen(false)}
          />
        )}
        {isInstallModalOpen && (
          <InstallAppModal
            isOpen={isInstallModalOpen}
            onClose={() => setIsInstallModalOpen(false)}
          />
        )}
        {isQuickAddOpen && (
          <ActivityManager
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            type={
              activeTab === 'planner' || (activeTab as string) === 'calendar' || (activeTab as string) === 'timeline' || (activeTab as string) === 'schedule'
                ? 'event'
                : activeTab === 'habits'
                ? 'habit'
                : 'task'
            }
          />
        )}
      </Suspense>

      {/* Global Interactive Alarm & Action Banner (Audible chime, Snooze & Mark Done) */}
      <ActiveAlarmBanner />

      {/* Real-time Offline Connectivity Toast */}
      <OfflineIndicator />

      {/* Global Undo Completion Snackbar (Appears for 3s upon task or habit completion) */}
      <UndoSnackbar />

      {/* Minimal Android-style Bottom Micro-Toast (Theme switch, lightweight confirmations) */}
      <AndroidToastContainer />

      {/* Always-mounted Daily Quote Reminder Service (runs across all tabs) */}
      <QuoteReminderService />

      {/* Draggable Floating PiP Stopwatch / Timer Widget */}
      <DraggablePiPWidget />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ActiveSessionProvider>
        <AppContent />
      </ActiveSessionProvider>
    </AppProvider>
  );
}
