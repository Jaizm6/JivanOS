import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
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
import { Bell, X, Check, Clock, ExternalLink, AlertCircle, ChevronDown, ChevronUp, Pill, Quote, CheckSquare } from 'lucide-react';
import { NotificationPopupStyle } from './utils/audio';

import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { ActiveTab, AppNotification } from './types';
import {
  getSavedPetalColorStyle,
  getSavedAmoledBlack,
  getSavedExpressiveShapes,
  PetalShapeBadge,
  PetalExpressiveShape,
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

const TOTAL_TOAST_DURATION = 5500;

const AutoDismissToast: React.FC<{
  notif: AppNotification;
  index?: number;
  popupStyle: NotificationPopupStyle;
  onDismiss: (id: string) => void;
  onOpenHistory: () => void;
}> = ({
  notif,
  index = 0,
  popupStyle,
  onDismiss,
  onOpenHistory,
}) => {
  const { soundEngine, toggleTask, tasks, startPomodoro, setActiveTab } = useApp();
  const [isHovered, setIsHovered] = useState(false);
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const [translateX, setTranslateX] = useState<number>(0);
  const [translateY, setTranslateY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const toastDragRef = useRef<{
    active: boolean;
    hasLockedDrag: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
  } | null>(null);

  // Toast display lifetime countdown (in milliseconds)
  const [toastRemainingMs, setToastRemainingMs] = useState<number>(TOTAL_TOAST_DURATION);

  // Auto-dismiss timer & 1s countdown tick (reduces React re-renders by 5x while keeping smooth CSS transition)
  useEffect(() => {
    if (isHovered || isDragging || isIslandExpanded) return;
    const interval = setInterval(() => {
      setToastRemainingMs(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isHovered, isDragging, isIslandExpanded]);

  useEffect(() => {
    if (toastRemainingMs <= 0) {
      onDismiss(notif.id);
    }
  }, [toastRemainingMs, notif.id, onDismiss]);

  // Scheduled event remaining time calculation
  const scheduledTimeStr = notif.scheduledTime || notif.timestamp;
  const eventTimes = useMemo(() => {
    if (!scheduledTimeStr) return null;
    const schedMs = new Date(scheduledTimeStr).getTime();
    if (isNaN(schedMs)) return null;
    const createdMs = notif.timestamp ? new Date(notif.timestamp).getTime() : schedMs - 15 * 60 * 1000;
    const validCreatedMs = isNaN(createdMs) || createdMs >= schedMs ? schedMs - 15 * 60 * 1000 : createdMs;
    const totalMs = Math.max(1000, schedMs - validCreatedMs);
    return { schedMs, totalMs };
  }, [scheduledTimeStr, notif.timestamp]);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!eventTimes || eventTimes.schedMs <= Date.now()) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [eventTimes]);

  // Fill ratio (0 to 1) for the circular progress ring around the bell
  const fillRatio = useMemo(() => {
    if (eventTimes && eventTimes.schedMs > nowMs) {
      const remainingMs = Math.max(0, eventTimes.schedMs - nowMs);
      return 1 - Math.min(1, Math.max(0, remainingMs / eventTimes.totalMs));
    }
    return Math.min(1, Math.max(0, (TOTAL_TOAST_DURATION - toastRemainingMs) / TOTAL_TOAST_DURATION));
  }, [eventTimes, nowMs, toastRemainingMs]);

  const remainingTimeLabel = useMemo(() => {
    if (eventTimes && eventTimes.schedMs > nowMs) {
      const diffSec = Math.ceil((eventTimes.schedMs - nowMs) / 1000);
      if (diffSec < 60) return `${diffSec}s remaining until event`;
      const diffMin = Math.ceil(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m remaining until event`;
      const diffHr = (diffMin / 60).toFixed(1);
      return `${diffHr}h remaining until event`;
    }
    const sec = (toastRemainingMs / 1000).toFixed(1);
    return `${sec}s remaining`;
  }, [eventTimes, nowMs, toastRemainingMs]);

  const handleDone = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundEngine.playSuccessChime();
    if (notif.taskId) {
      toggleTask(notif.taskId);
    }
    onDismiss(notif.id);
  };

  const handleSnooze = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundEngine.playSuccessChime();
    onDismiss(notif.id);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('omnilifeos_trigger_alarm', {
          detail: {
            id: `snoozed_${Date.now()}`,
            source: notif.category,
            title: `⏱ Snoozed: ${notif.title}`,
            subtitle: notif.body,
            reminderType: 'notification',
          },
        })
      );
    }, 5 * 60 * 1000);
  };

  const handleDoneRef = useRef(handleDone);
  const handleSnoozeRef = useRef(handleSnooze);
  const onDismissRef = useRef(onDismiss);
  handleDoneRef.current = handleDone;
  handleSnoozeRef.current = handleSnooze;
  onDismissRef.current = onDismiss;

  const handlePointerStart = (clientX: number, clientY: number, immediateLock = false) => {
    const now = performance.now();
    toastDragRef.current = {
      active: true,
      hasLockedDrag: immediateLock,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      lastTime: now,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
    };
    setIsDragging(true);
    if (immediateLock) {
      isDraggingRef.current = true;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const target = e.target as HTMLElement | null;
    const isHandle = Boolean(target?.closest('[data-toast-handle]'));
    handlePointerStart(touch.clientX, touch.clientY, isHandle);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;
    e.stopPropagation();
    const isHandle = Boolean(target?.closest('[data-toast-handle]'));
    handlePointerStart(e.clientX, e.clientY, isHandle);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (clientX: number, clientY: number, ev?: TouchEvent) => {
      const state = toastDragRef.current;
      if (!state || !state.active) return;

      const now = performance.now();
      const dt = Math.max(1, now - state.lastTime);
      const dx = clientX - state.startX;
      const dy = clientY - state.startY;

      if (!state.hasLockedDrag) {
        if (Math.hypot(dx, dy) < 5) return;
        state.hasLockedDrag = true;
        isDraggingRef.current = true;
      }

      if (ev && ev.cancelable) {
        ev.preventDefault();
      }

      const instVx = (clientX - state.lastX) / dt;
      const instVy = (clientY - state.lastY) / dt;
      state.vx = state.vx * 0.35 + instVx * 0.65;
      state.vy = state.vy * 0.35 + instVy * 0.65;
      state.lastX = clientX;
      state.lastY = clientY;
      state.lastTime = now;
      state.dx = dx;
      state.dy = dy;

      setTranslateX(dx);
      setTranslateY(dy);
    };

    const handleMouseMoveWindow = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMoveWindow = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    };

    const handlePointerEnd = () => {
      const state = toastDragRef.current;
      toastDragRef.current = null;
      setIsDragging(false);

      if (!state || !state.hasLockedDrag) {
        setTranslateX(0);
        setTranslateY(0);
        isDraggingRef.current = false;
        return;
      }

      const { dx, dy, vx, vy } = state;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      const isRightTrigger = dx >= 45 || (vx >= 0.25 && dx >= 16);
      const isLeftTrigger = dx <= -45 || (vx <= -0.25 && dx <= -16);
      const isVerticalTrigger = absY >= 45 || (Math.abs(vy) >= 0.25 && absY >= 16);

      if ((isRightTrigger || isLeftTrigger) && absX >= absY * 0.8) {
        if (isRightTrigger) {
          handleDoneRef.current();
        } else {
          handleSnoozeRef.current();
        }
      } else if (isVerticalTrigger) {
        onDismissRef.current(notif.id);
      } else {
        setTranslateX(0);
        setTranslateY(0);
      }

      setTimeout(() => {
        isDraggingRef.current = false;
      }, 150);
    };

    window.addEventListener('mousemove', handleMouseMoveWindow);
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('touchmove', handleTouchMoveWindow, { passive: false });
    window.addEventListener('touchend', handlePointerEnd);
    window.addEventListener('touchcancel', handlePointerEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveWindow);
      window.removeEventListener('mouseup', handlePointerEnd);
      window.removeEventListener('touchmove', handleTouchMoveWindow);
      window.removeEventListener('touchend', handlePointerEnd);
      window.removeEventListener('touchcancel', handlePointerEnd);
    };
  }, [isDragging, notif.id]);

  const isTask = notif.category === 'task';
  const isMed = notif.category === 'medication';
  const isQuote = notif.category === 'quote';
  const priority = notif.priority || 'medium';
  const isActionableReminder =
    Boolean(notif.taskId) ||
    notif.category === 'medication' ||
    (notif.category as string) === 'reminder' ||
    (notif.category as string) === 'alarm';

  const isScheduledTimePassed = React.useMemo(() => {
    if (!scheduledTimeStr) return false;
    const timeMs = new Date(scheduledTimeStr).getTime();
    if (isNaN(timeMs)) return false;
    return timeMs < Date.now() - 2000;
  }, [scheduledTimeStr]);

  const formattedDueTime = React.useMemo(() => {
    if (!scheduledTimeStr) return null;
    try {
      if (typeof scheduledTimeStr === 'string' && scheduledTimeStr.match(/^\d{1,2}:\d{2}/)) {
        return scheduledTimeStr;
      }
      const d = new Date(scheduledTimeStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [scheduledTimeStr]);

  const priorityBorder = 
    priority === 'high' ? 'border-rose-500/90 ring-2 ring-rose-500/30 shadow-rose-500/10' :
    priority === 'medium' ? 'border-amber-500/80 ring-1 ring-amber-500/20' :
    'border-slate-300 dark:border-slate-700';

  const priorityBadge = (
    <div className="inline-flex items-center gap-1 shrink-0 flex-wrap">
      {priority === 'high' ? (
        <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-rose-500 text-white uppercase tracking-wider">High</span>
      ) : priority === 'medium' ? (
        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500 text-white uppercase tracking-wider">Med</span>
      ) : (
        <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Low</span>
      )}

      {isScheduledTimePassed && (
        <span
          className="inline-flex items-center gap-1 px-1 py-0.2 rounded text-[8.5px] font-extrabold bg-rose-600 text-white shadow-2xs shrink-0 border border-rose-400"
          title={`Notification scheduled time has passed! ${formattedDueTime ? `(Due ${formattedDueTime})` : ''}`}
        >
          <span className="flex items-center gap-0.5 animate-pulse">
            <AlertCircle className="w-2.5 h-2.5 text-white stroke-[3]" />
            <span>!</span>
          </span>
          {formattedDueTime && (
            <span className="text-[8px] font-mono font-bold tracking-tight bg-rose-700/80 px-1 py-0.2 rounded text-white/95">
              Due {formattedDueTime}
            </span>
          )}
        </span>
      )}
    </div>
  );

  const rotateDeg = translateX * 0.035;

  const catShape: PetalExpressiveShape = isMed
    ? 'pill'
    : isQuote
      ? 'flower'
      : isTask
        ? 'squircle'
        : 'cookie9';

  const catFillClass = isMed
    ? 'text-amber-100 dark:text-amber-950/80'
    : isQuote
      ? 'text-violet-100 dark:text-violet-950/80'
      : isTask
        ? 'text-indigo-100 dark:text-indigo-950/80'
        : 'text-sky-100 dark:text-sky-950/80';

  const catStrokeClass = isMed
    ? 'text-amber-300/70 dark:text-amber-800/60'
    : isQuote
      ? 'text-violet-300/70 dark:text-violet-800/60'
      : isTask
        ? 'text-indigo-300/70 dark:text-indigo-800/60'
        : 'text-sky-300/70 dark:text-sky-800/60';

  const catIconColor = isMed
    ? 'text-amber-600 dark:text-amber-300'
    : isQuote
      ? 'text-violet-600 dark:text-violet-300'
      : isTask
        ? 'text-indigo-600 dark:text-indigo-300'
        : 'text-sky-600 dark:text-sky-300';

  const CategoryGlyph = isMed ? Pill : isQuote ? Quote : isTask ? CheckSquare : Bell;

  // ============================================================================
  // STYLE 0: MATERIAL 3 EXPRESSIVE COMPACT CARD (DEFAULT)
  // ============================================================================
  if (popupStyle === 'ticktick_card') {
    const matchedTask = notif.taskId ? tasks.find(t => t.id === notif.taskId) : undefined;
    const listName = matchedTask?.project || matchedTask?.category || notif.category || 'Alert';

    return (
      <div
        data-no-drawer-swipe="true"
        className={`relative pointer-events-auto w-[92vw] max-w-[376px] transition-all duration-300 ${
          index > 0 ? '-mt-2.5' : ''
        }`}
        style={{ zIndex: 100 - index }}
      >
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => {
            if (Math.abs(translateX) > 6 || Math.abs(translateY) > 6 || isDraggingRef.current) return;
            onOpenHistory();
          }}
          style={{
            transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg)`,
            opacity: Math.max(0, 1 - Math.max(Math.abs(translateX), Math.abs(translateY)) / 210),
            transition: isDragging
              ? 'none'
              : 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
          }}
          className={`relative overflow-hidden rounded-[24px] bg-white/95 dark:bg-zinc-900/95 text-slate-900 dark:text-white border border-slate-200/90 dark:border-zinc-800/90 shadow-[0_14px_38px_rgba(15,23,42,0.16)] dark:shadow-[0_18px_44px_rgba(0,0,0,0.68)] backdrop-blur-xl px-3.5 pt-2.5 pb-3 select-none touch-pan-y animate-in slide-in-from-bottom-4 fade-in duration-200 ${
            isDragging ? 'cursor-grabbing ring-2 ring-indigo-500/40' : 'cursor-grab'
          }`}
        >
          {/* Top Slim M3 Progress Line */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 dark:bg-indigo-400 transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(0, (1 - fillRatio) * 100)}%` }}
            />
          </div>

          {/* Header Row */}
          <div className="flex items-start gap-2.5">
            <PetalShapeBadge
              shape={catShape}
              sizeClass="w-8 h-8 mt-0.5"
              fillClass={catFillClass}
              strokeClass={catStrokeClass}
            >
              <CategoryGlyph className={`w-3.5 h-3.5 ${catIconColor}`} />
            </PetalShapeBadge>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 capitalize">
                  {listName}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">•</span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 tabular-nums">
                  {formattedDueTime || 'Now'}
                </span>
                {priority === 'high' && priorityBadge}
              </div>

              <h3 className="text-[13.5px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug mt-0.5 truncate">
                {notif.title}
              </h3>

              {notif.body ? (
                <p className="text-[11.5px] text-slate-600 dark:text-zinc-300 font-normal leading-snug mt-0.5 line-clamp-2">
                  {notif.body}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isActionableReminder && matchedTask && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    startPomodoro(matchedTask.id);
                    setActiveTab('tasks');
                    onDismiss(notif.id);
                  }}
                  className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-center transition cursor-pointer"
                  title="Start Focus"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onDismiss(notif.id);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Pills ONLY for actionable reminders */}
          {isActionableReminder && (
            <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={handleSnooze}
                className="py-1.5 px-3 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98] text-slate-700 dark:text-zinc-200 font-bold text-[11.5px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Snooze 5m</span>
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="py-1.5 px-3 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[11.5px] flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                <span>Complete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // STYLE 1: DYNAMIC ISLAND / CAMERA PILL POP-UP
  // ============================================================================
  if (popupStyle === 'dynamic_island') {
    const accentGlow =
      priority === 'high'
        ? 'ring-1 ring-rose-500/45 shadow-[0_12px_32px_rgba(244,63,94,0.28)]'
        : isTask
          ? 'ring-1 ring-blue-500/40 shadow-[0_12px_32px_rgba(59,130,246,0.22)]'
          : isMed
            ? 'ring-1 ring-amber-500/40 shadow-[0_12px_32px_rgba(245,158,11,0.22)]'
            : 'ring-1 ring-indigo-500/40 shadow-[0_12px_32px_rgba(99,102,241,0.24)]';

    return (
      <div
        data-no-drawer-swipe="true"
        className={`relative pointer-events-auto flex justify-center transition-all duration-300 ${
          index > 0 ? '-mt-2' : ''
        }`}
        style={{ zIndex: 100 - index }}
      >
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => {
            if (Math.abs(translateX) > 6 || Math.abs(translateY) > 6 || isDraggingRef.current) return;
            setIsIslandExpanded(prev => !prev);
          }}
          style={{
            transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg)`,
            opacity: Math.max(0, 1 - Math.max(Math.abs(translateX), Math.abs(translateY)) / 200),
            transition: isDragging
              ? 'none'
              : 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
          }}
          className={`relative z-10 bg-zinc-950/95 text-white border border-white/15 backdrop-blur-2xl select-none touch-pan-y overflow-hidden will-change-transform animate-in fade-in zoom-in-95 slide-in-from-top-3 duration-200 ${accentGlow} ${
            isIslandExpanded
              ? 'rounded-[26px] px-3.5 py-2.5 w-[92vw] max-w-[350px]'
              : 'rounded-full pl-2 pr-2 py-1.5 min-w-[252px] max-w-[340px]'
          } ${isDragging ? 'cursor-grabbing scale-[1.02]' : 'cursor-pointer hover:border-white/25'}`}
          title="Tap to expand Pill • Swipe right to complete • Swipe left to snooze"
        >
          {!isIslandExpanded ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 border border-white/10 shrink-0">
                  <CategoryGlyph className={`w-3.5 h-3.5 ${catIconColor}`} />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[11.5px] text-white truncate">
                      {notif.title}
                    </span>
                    {formattedDueTime && (
                      <span className="text-[9.5px] font-mono text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded-full shrink-0">
                        {formattedDueTime}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate leading-tight">
                    {notif.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleDone}
                  className="relative w-6 h-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="Mark Done"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsIslandExpanded(true);
                  }}
                  className="w-5 h-5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="Expand Pill"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(notif.id);
                  }}
                  className="w-5 h-5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                    <CategoryGlyph className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-300">
                        {notif.category || 'Alert'}
                      </span>
                      {priority === 'high' && priorityBadge}
                    </div>
                    <h4 className="font-bold text-[12px] text-white leading-snug truncate">
                      {notif.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsIslandExpanded(false);
                    }}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 transition cursor-pointer"
                    title="Collapse Pill"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(notif.id);
                    }}
                    className="p-1 rounded-full bg-white/10 hover:bg-rose-500/30 text-zinc-300 hover:text-rose-200 transition cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-300 leading-snug line-clamp-2">
                {notif.body}
              </p>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleDone}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-[10.5px] transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Complete</span>
                </button>
                <button
                  type="button"
                  onClick={handleSnooze}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-[10.5px] transition active:scale-95 cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>Snooze 5m</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenHistory();
                  }}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Open Notification Drawer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // STYLE 2: ANDROID HEADS-UP MATERIAL 3 EXPRESSIVE POP-UP
  // ============================================================================
  if (popupStyle === 'android_heads_up') {
    return (
      <div
        data-no-drawer-swipe="true"
        className={`relative pointer-events-auto w-[92vw] max-w-[366px] transition-all duration-200 ${
          index > 0 ? '-mt-2' : ''
        }`}
        style={{ zIndex: 100 - index }}
      >
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => {
            if (Math.abs(translateX) > 6 || Math.abs(translateY) > 6 || isDraggingRef.current) return;
            onOpenHistory();
          }}
          style={{
            transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg)`,
            opacity: Math.max(0, 1 - Math.max(Math.abs(translateX), Math.abs(translateY)) / 200),
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
          }}
          className={`relative z-10 rounded-[24px] bg-white/95 dark:bg-zinc-900/95 border border-slate-200/90 dark:border-zinc-800/90 shadow-[0_14px_36px_rgba(15,23,42,0.16)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl px-3.5 pt-2.5 pb-2.5 flex flex-col gap-1.5 select-none touch-pan-y overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 ${
            isDragging ? 'cursor-grabbing ring-2 ring-indigo-500/40' : 'cursor-grab'
          }`}
          title="Swipe right to complete • Swipe left to snooze • Swipe up to dismiss"
        >
          {/* Top Progress Line */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(0, (1 - fillRatio) * 100)}%` }}
            />
          </div>

          <div className="flex items-start gap-2.5">
            <PetalShapeBadge
              shape={catShape}
              sizeClass="w-7 h-7 mt-0.5"
              fillClass={catFillClass}
              strokeClass={catStrokeClass}
            >
              <CategoryGlyph className={`w-3.5 h-3.5 ${catIconColor}`} />
            </PetalShapeBadge>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400">
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 capitalize">
                  {notif.category || 'Reminder'}
                </span>
                <span>•</span>
                <span className="tabular-nums">{formattedDueTime || 'Now'}</span>
                {priority === 'high' && priorityBadge}
              </div>

              <h4 className="font-extrabold text-[12.5px] text-slate-900 dark:text-white leading-snug truncate mt-0.5">
                {notif.title}
              </h4>
              {notif.body && (
                <p className="text-[11px] text-slate-600 dark:text-zinc-300 line-clamp-2 leading-snug">
                  {notif.body}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notif.id);
              }}
              className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isActionableReminder && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={handleDone}
                className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] transition active:scale-95 cursor-pointer"
              >
                Mark Done
              </button>
              <button
                type="button"
                onClick={handleSnooze}
                className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-[10.5px] transition active:scale-95 cursor-pointer"
              >
                Snooze 5m
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenHistory();
                }}
                className="px-2.5 py-1 rounded-full text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 font-semibold text-[10.5px] transition cursor-pointer ml-auto"
              >
                Open
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // STYLE 3: MATERIAL 3 EXPRESSIVE COMPACT PILL-CARD
  // ============================================================================
  return (
    <div
      data-no-drawer-swipe="true"
      className={`relative pointer-events-auto w-[90vw] max-w-[336px] transition-all duration-200 ${
        index > 0 ? '-mt-2' : ''
      }`}
      style={{ zIndex: 100 - index }}
    >
      {/* Underlying Action Backdrops (Revealed on Swipe / Drag) */}
      <div className="absolute inset-0 rounded-[22px] overflow-hidden flex items-center justify-between px-3.5 text-xs font-bold pointer-events-none bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700">
        <div
          className={`flex items-center gap-1.5 transition-opacity duration-150 ${
            translateX > 10 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="p-1 rounded-full bg-emerald-600 text-white">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Complete
          </span>
        </div>

        <div
          className={`flex items-center gap-1.5 ml-auto transition-opacity duration-150 ${
            translateX < -10 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Snooze
          </span>
          <div className="p-1 rounded-full bg-amber-500 text-white">
            <Clock className="w-3 h-3 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Foreground Compact Expressive Toast */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (Math.abs(translateX) > 6 || Math.abs(translateY) > 6 || isDraggingRef.current) return;
          onOpenHistory();
        }}
        style={{
          transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg)`,
          opacity: Math.max(0, 1 - Math.max(Math.abs(translateX), Math.abs(translateY)) / 200),
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
        }}
        className={`relative z-10 px-3 py-2.5 rounded-[22px] bg-white/95 dark:bg-zinc-900/95 border border-slate-200/90 dark:border-zinc-800/90 shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-2 select-none touch-pan-y overflow-hidden will-change-transform animate-in fade-in slide-in-from-top-2 duration-150 ${
          isDragging ? 'ring-2 ring-indigo-500/40 cursor-grabbing' : 'cursor-grab'
        }`}
        title={`Time remaining: ${remainingTimeLabel} • Swipe right to complete • Swipe left to snooze`}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(0, (1 - fillRatio) * 100)}%` }}
          />
        </div>

        <div className="flex items-start gap-2 min-w-0">
          <PetalShapeBadge
            shape={catShape}
            sizeClass="w-7 h-7"
            fillClass={catFillClass}
            strokeClass={catStrokeClass}
          >
            <CategoryGlyph className={`w-3.5 h-3.5 ${catIconColor}`} />
          </PetalShapeBadge>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h5 className="font-extrabold text-slate-900 dark:text-white truncate text-[12px] leading-tight">
                {notif.title}
              </h5>
              {Boolean((notif as any).count && (notif as any).count > 1) && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-600 text-white">
                  +{(notif as any).count - 1}
                </span>
              )}
              {priority === 'high' && priorityBadge}
            </div>
            {notif.body && (
              <p className="text-slate-600 dark:text-zinc-300 text-[11px] truncate leading-snug mt-0.5">
                {notif.body}
              </p>
            )}
          </div>

          <button
            type="button"
            id={`btn-close-toast-${notif.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notif.id);
            }}
            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {isActionableReminder && (
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 text-[10.5px]">
            <button
              type="button"
              onClick={handleDone}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition active:scale-95 cursor-pointer"
            >
              <Check className="w-3 h-3 stroke-[2.8]" />
              <span>Done</span>
            </button>

            <button
              type="button"
              onClick={handleSnooze}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold transition active:scale-95 cursor-pointer"
            >
              <Clock className="w-3 h-3" />
              <span>Snooze 5m</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
    notifications,
    dismissNotification,
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
    soundEngine,
    undoSnackbar,
    exportEncryptedJSON,
    firebaseUser,
    joplinSyncSettings,
    syncDriveNow,
  } = useApp();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [notifPopupStyle, setNotifPopupStyle] = useState<NotificationPopupStyle>(() =>
    soundEngine.getNotificationPopupStyle()
  );

  useEffect(() => {
    const syncStyle = () => {
      setNotifPopupStyle(soundEngine.getNotificationPopupStyle());
    };
    window.addEventListener('omni_popup_style_changed', syncStyle);
    return () => window.removeEventListener('omni_popup_style_changed', syncStyle);
  }, [soundEngine]);

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

  // Group notifications by category for toast notifications stack
  const groupedNotifications = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    notifications.forEach(n => {
      const cat = n.category || 'system';
      const list = map.get(cat) || [];
      list.push(n);
      map.set(cat, list);
    });

    const result: (AppNotification & { count?: number; subIds?: string[] })[] = [];
    map.forEach((items, cat) => {
      if (items.length === 0) return;
      const primary = items[0];
      if (items.length > 1) {
        result.push({
          ...primary,
          title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Reminders (${items.length})`,
          body: items.map(i => i.title).join(' • '),
          count: items.length,
          subIds: items.map(i => i.id),
        });
      } else {
        result.push(primary);
      }
    });
    return result;
  }, [notifications]);

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

      {/* In-App Toast Notifications Stack (TickTick Bottom Card / Dynamic Island / Android Heads-Up / Compact Card) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-1.5 max-w-md w-auto pointer-events-none px-2 sm:px-0 ${
          notifPopupStyle === 'ticktick_card'
            ? undoSnackbar
              ? 'bottom-36'
              : 'bottom-20 sm:bottom-4'
            : 'top-2.5 sm:top-3.5'
        }`}
      >
        {groupedNotifications.slice(0, 3).map((notif, index) => (
          <AutoDismissToast
            key={notif.id}
            notif={notif}
            index={index}
            popupStyle={notifPopupStyle}
            onDismiss={(id) => {
              if ((notif as any).subIds) {
                (notif as any).subIds.forEach((subId: string) => dismissNotification(subId));
              } else {
                dismissNotification(id);
              }
            }}
            onOpenHistory={() => setIsNotificationDrawerOpen(true)}
          />
        ))}
      </div>

      {/* Global Undo Completion Snackbar (Appears for 3s upon task or habit completion) */}
      <UndoSnackbar />

      {/* Minimal Android-style Bottom Micro-Toast (Theme switch, lightweight confirmations) */}
      <AndroidToastContainer />

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
