import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart3,
  AlertCircle,
  Quote,
  FolderKanban,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Cloud,
  CloudOff,
  PanelLeftClose,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Settings,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle2,
  ReceiptText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { soundEngine } from '../../utils/audio';
import { showAndroidToast } from '../common/AndroidToast';
import {
  getRealSyncOverview,
  requestOpenBackupSyncScreen,
} from '../../sync/syncConnectionState';
import { DRIVE_SYNC_STATE_EVENT } from '../../utils/googleDriveSync';
import { DROPBOX_SYNC_STATE_EVENT } from '../../utils/dropboxSync';
import { TELEGRAM_SYNC_STATE_EVENT } from '../../sync/providers/TelegramSyncProvider';
import { MEGA_SYNC_STATE_EVENT } from '../../sync/providers/MEGASyncProvider';
import { JIVANOS_CLOUD_STATE_EVENT } from '../../sync/providers/FirestoreSyncProvider';

import { JivanLogoMark } from '../common/JivanLogo';
import { SidebarClockCard } from './SidebarClockCard';
export { JivanLogoMark };

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    theme,
    setTheme,
    isOnline,
    syncStatus,
    syncWithCloud,
    medications,
    tasks,
    bills,
    notifications,
    pomodoro,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    switchPomodoroMode,
    setPomodoroDuration,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setIsAuthModalOpen,
    unreadNotificationsCount,
    setIsNotificationDrawerOpen,
    profile,
    firebaseUser,
    joplinSyncSettings,
    setIsAIChatOpen,
  } = useApp();

  // Exclude fixed-course/deadline meds from refill stock alerts
  const lowStockMeds = useMemo(
    () =>
      medications.filter(
        m =>
          m.active &&
          !m.archived &&
          !m.endDate &&
          m.remainingPills <= m.refillThreshold
      ),
    [medications]
  );

  // Build unified stackable notification cards for the Left Panel secondary card
  const alertStack = useMemo(() => {
    const items: Array<{
      id: string;
      badge: string;
      title: string;
      subtitle: string;
      tone: 'amber' | 'indigo' | 'rose' | 'emerald';
      onClick: () => void;
    }> = [];

    // 1. Unread notifications from drawer
    const unreadList = notifications.filter(n => !n.read);
    unreadList.slice(0, 4).forEach(n => {
      items.push({
        id: `notif_${n.id}`,
        badge: 'Unread Alert',
        title: n.title,
        subtitle: n.body || 'Tap to view in Notification Center',
        tone: n.category === 'medication' ? 'rose' : 'indigo',
        onClick: () => {
          setIsNotificationDrawerOpen(true);
          setIsSidebarCollapsed(true);
        },
      });
    });

    // 2. Low-stock medication refill alerts
    lowStockMeds.forEach(med => {
      items.push({
        id: `refill_${med.id}`,
        badge: `Refill Alert (${lowStockMeds.length})`,
        title: med.name,
        subtitle: `${med.remainingPills} of ${med.totalPills} left • Tap to refill`,
        tone: 'amber',
        onClick: () => {
          setIsAIChatOpen(false);
          setActiveTab('medications');
          setIsSidebarCollapsed(true);
        },
      });
    });

    // 3. Today's pending high-priority / due tasks
    const todayStr = new Date().toISOString().split('T')[0];
    const dueTodayTasks = tasks.filter(
      t => !t.completed && !t.archived && t.dueDate && t.dueDate <= todayStr
    );
    if (dueTodayTasks.length > 0) {
      items.push({
        id: `due_tasks_${todayStr}`,
        badge: `Tasks Due (${dueTodayTasks.length})`,
        title: dueTodayTasks[0].title,
        subtitle:
          dueTodayTasks.length > 1
            ? `+${dueTodayTasks.length - 1} more due today • Tap to review`
            : `Scheduled for today${dueTodayTasks[0].dueTime ? ` at ${dueTodayTasks[0].dueTime}` : ''}`,
        tone: 'indigo',
        onClick: () => {
          setIsAIChatOpen(false);
          setActiveTab('tasks');
          setIsSidebarCollapsed(true);
        },
      });
    }

    // 4. Unpaid upcoming bills
    const unpaidBills = bills.filter(b => !b.isPaid && b.status !== 'paid' && !b.archived);
    if (unpaidBills.length > 0) {
      items.push({
        id: `unpaid_bills`,
        badge: `Bills Pending (${unpaidBills.length})`,
        title: unpaidBills[0].title,
        subtitle: `Due ${unpaidBills[0].dueDate} • Tap to manage bills`,
        tone: 'rose',
        onClick: () => {
          setIsAIChatOpen(false);
          setActiveTab('bills');
          setIsSidebarCollapsed(true);
        },
      });
    }

    return items;
  }, [
    notifications,
    lowStockMeds,
    tasks,
    bills,
    setActiveTab,
    setIsAIChatOpen,
    setIsNotificationDrawerOpen,
    setIsSidebarCollapsed,
  ]);

  const [stackIndex, setStackIndex] = useState(0);
  const stackTouchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (stackIndex >= alertStack.length) {
      setStackIndex(0);
    }
  }, [alertStack.length, stackIndex]);

  const cycleStackNext = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (alertStack.length <= 1) return;
      setStackIndex(prev => (prev + 1) % alertStack.length);
    },
    [alertStack.length]
  );

  const cycleStackPrev = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (alertStack.length <= 1) return;
      setStackIndex(prev => (prev - 1 + alertStack.length) % alertStack.length);
    },
    [alertStack.length]
  );

  // Focus Clock Preset & Custom Duration Dropdown state
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('');

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleNavigate = (tab: ActiveTab) => {
    setIsAIChatOpen(false);
    setActiveTab(tab);
    setIsSidebarCollapsed(true);
  };

  // Interactive Focus Clock Dial mechanics (supports click & pointer drag to set 5..60 minutes)
  const dialRef = useRef<SVGSVGElement | null>(null);
  const isDraggingDialRef = useRef(false);

  const updateDurationFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = dialRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angleDeg < 0) angleDeg += 360;
      const maxMins = pomodoro.mode === 'break' ? 30 : 60;
      const rawMins = Math.round((angleDeg / 360) * maxMins);
      const snapped =
        pomodoro.mode === 'break'
          ? Math.max(1, Math.min(30, rawMins || 5))
          : Math.max(5, Math.min(60, Math.round(rawMins / 5) * 5 || 5));
      setPomodoroDuration(snapped);
    },
    [pomodoro.mode, setPomodoroDuration]
  );

  const handleDialPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pomodoro.isRunning) return;
    e.stopPropagation();
    isDraggingDialRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateDurationFromPointer(e.clientX, e.clientY);
  };

  const handleDialPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingDialRef.current || pomodoro.isRunning) return;
    e.stopPropagation();
    updateDurationFromPointer(e.clientX, e.clientY);
  };

  const handleDialPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingDialRef.current) return;
    isDraggingDialRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Focus clock SVG geometry (sleek compact layout)
  const dialSize = 104;
  const dialCenter = dialSize / 2;
  const dialRadius = 42;
  const dialCircumference = 2 * Math.PI * dialRadius;
  const totalSec = Math.max(60, pomodoro.initialDuration || 25 * 60);
  const maxDialScaleSec = (pomodoro.mode === 'break' ? 30 : 60) * 60;
  const clockFraction = pomodoro.isRunning
    ? Math.max(0, Math.min(1, pomodoro.timeRemaining / totalSec))
    : Math.max(0.04, Math.min(1, pomodoro.timeRemaining / maxDialScaleSec));
  const strokeOffset = dialCircumference * (1 - clockFraction);
  const handAngleDeg = clockFraction * 360;
  const handRad = ((handAngleDeg - 90) * Math.PI) / 180;
  const handEndX = dialCenter + (dialRadius - 10) * Math.cos(handRad);
  const handEndY = dialCenter + (dialRadius - 10) * Math.sin(handRad);
  const thumbX = dialCenter + dialRadius * Math.cos(handRad);
  const thumbY = dialCenter + dialRadius * Math.sin(handRad);

  const isOpen = !isSidebarCollapsed;
  const [syncStateTick, setSyncStateTick] = useState(0);

  useEffect(() => {
    const bump = () => setSyncStateTick(t => t + 1);
    window.addEventListener(DRIVE_SYNC_STATE_EVENT, bump);
    window.addEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
    window.addEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
    window.addEventListener(MEGA_SYNC_STATE_EVENT, bump);
    window.addEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    return () => {
      window.removeEventListener(DRIVE_SYNC_STATE_EVENT, bump);
      window.removeEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
      window.removeEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
      window.removeEventListener(MEGA_SYNC_STATE_EVENT, bump);
      window.removeEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    };
  }, []);

  const realSyncOverview = useMemo(
    () => getRealSyncOverview(firebaseUser, joplinSyncSettings),
    [firebaseUser, joplinSyncSettings, syncStateTick]
  );
  const hasRealSyncConnection = realSyncOverview.hasAnyConnected;
  const hasRealSyncSuccess =
    hasRealSyncConnection && Boolean(realSyncOverview.latestSyncedAt);

  const openBackupSyncDirect = useCallback(() => {
    setIsAIChatOpen(false);
    setActiveTab('settings');
    requestOpenBackupSyncScreen();
    setIsSidebarCollapsed(true);
  }, [setActiveTab, setIsAIChatOpen, setIsSidebarCollapsed]);

  const quickPresets = pomodoro.mode === 'break' ? [5, 10, 15, 20] : [15, 25, 45, 60];
  const currentSetMinutes = Math.max(1, Math.round((pomodoro.timeRemaining || 1500) / 60));
  const hasUnreadNotifications = unreadNotificationsCount > 0;
  const currentAlertCard = alertStack[stackIndex] || null;

  return (
    <>
      {/* Dedicated Left-Edge Touch-Drag & Desktop Click Sensor Strip */}
      <div
        data-drawer-edge-sensor="true"
        aria-hidden="true"
        onClick={() => {
          if (!isOpen) setIsSidebarCollapsed(false);
        }}
        title="Open Left Panel (Ctrl+B)"
        className={`fixed top-14 bottom-16 left-0 z-[35] w-3 sm:w-4 touch-pan-y select-none ${
          isOpen ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'
        }`}
      />

      <aside
        data-drawer-sidebar="true"
        data-open={isOpen ? 'true' : 'false'}
        aria-hidden={!isOpen}
        className="fixed inset-y-0 left-0 z-[80] w-[288px] sm:w-[308px] bg-[#edf2fa] dark:bg-[#090b10] border-r border-slate-200/90 dark:border-zinc-800/90 flex flex-col select-none touch-pan-y overscroll-contain"
      >
        <div className="flex flex-col h-full min-h-0 p-2.5 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-2 overflow-hidden">
          {/* 1. CLEAN TOP HEADER CARD WITH JIVANOS EMBLEM & ANIMATED BELL */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[22px] bg-white dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs shrink-0">
            <button
              type="button"
              id="btn-sidebar-profile"
              onClick={() => {
                setIsAuthModalOpen(true);
                setIsSidebarCollapsed(true);
              }}
              title="Manage Account & Profile"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left group cursor-pointer rounded-xl p-0.5 hover:opacity-95 transition"
            >
              <div className="relative shrink-0">
                {firebaseUser?.photoURL || profile.avatarPhoto ? (
                  <img
                    src={firebaseUser?.photoURL || profile.avatarPhoto}
                    alt={firebaseUser?.displayName || profile.name || 'Jivan OS'}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/35 dark:ring-indigo-400/35"
                  />
                ) : (
                  <JivanLogoMark withFrame className="w-9 h-9 shadow-xs" />
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                    !hasRealSyncConnection
                      ? 'bg-slate-400'
                      : !isOnline || syncStatus === 'offline'
                      ? 'bg-amber-500'
                      : syncStatus === 'syncing'
                      ? 'bg-indigo-500 animate-pulse'
                      : syncStatus === 'error'
                      ? 'bg-rose-500'
                      : hasRealSyncSuccess
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-zinc-100 leading-tight truncate">
                  Jivan <span className="text-indigo-600 dark:text-indigo-400">OS</span>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                id="btn-notifications-drawer"
                onClick={() => {
                  setIsNotificationDrawerOpen(true);
                  setIsSidebarCollapsed(true);
                }}
                title="Notifications"
                className={`relative w-9 h-9 rounded-2xl flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                  hasUnreadNotifications
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 ring-1 ring-rose-300/70 dark:ring-rose-800/70'
                    : 'bg-[#eef2fb] dark:bg-zinc-800/90 hover:bg-indigo-100/80 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
                )}
              </button>

              <button
                type="button"
                id="btn-close-sidebar"
                onClick={() => setIsSidebarCollapsed(true)}
                title="Close Panel (Ctrl+B)"
                className="w-9 h-9 rounded-2xl bg-[#eef2fb] dark:bg-zinc-800/90 hover:bg-indigo-100/80 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. SCROLLABLE MATERIAL 3 EXPRESSIVE BODY (overscroll-contain locks scroll inside drawer) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar space-y-2 pr-0.5">
            {/* REVAMPED DIGITAL & ANALOG CLOCK WIDGET */}
            <SidebarClockCard />

            {/* SECONDARY STACKABLE SWIPE-UP / SWIPE-DOWN NOTIFICATION & ALERT STACK CARD */}
            {currentAlertCard && (
              <div
                data-no-drawer-swipe="true"
                onTouchStart={e => {
                  if (e.touches.length === 1) {
                    stackTouchStartYRef.current = e.touches[0].clientY;
                  }
                }}
                onTouchEnd={e => {
                  if (stackTouchStartYRef.current === null || e.changedTouches.length === 0) return;
                  const dy = e.changedTouches[0].clientY - stackTouchStartYRef.current;
                  stackTouchStartYRef.current = null;
                  if (Math.abs(dy) >= 18) {
                    if (dy < 0) cycleStackNext();
                    else cycleStackPrev();
                  }
                }}
                onClick={currentAlertCard.onClick}
                className="relative group cursor-pointer select-none pt-0.5 pb-1"
                title="Swipe up/down or tap arrows to cycle notifications"
              >
                {/* Stacked Deck Layer Illusion Behind Card when multiple alerts exist */}
                {alertStack.length > 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-2.5 -bottom-0.5 h-3 rounded-b-[18px] bg-white/70 dark:bg-zinc-800/70 border border-slate-200/70 dark:border-zinc-700/70 z-0 transition-transform"
                  />
                )}

                <div
                  className={`relative z-10 px-3 py-2 rounded-[18px] border shadow-2xs flex items-center justify-between gap-2 transition ${
                    currentAlertCard.tone === 'amber'
                      ? 'bg-amber-50/95 dark:bg-amber-950/75 border-amber-300/90 dark:border-amber-800/80 text-amber-900 dark:text-amber-100'
                      : currentAlertCard.tone === 'rose'
                      ? 'bg-rose-50/95 dark:bg-rose-950/75 border-rose-300/90 dark:border-rose-800/80 text-rose-900 dark:text-rose-100'
                      : 'bg-indigo-50/95 dark:bg-indigo-950/75 border-indigo-200/90 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {currentAlertCard.tone === 'amber' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : currentAlertCard.tone === 'rose' ? (
                        <ReceiptText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-85 truncate">
                        {currentAlertCard.badge}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate mt-0.5">
                      {currentAlertCard.title}
                    </div>
                    <div className="text-[10.5px] opacity-80 truncate">
                      {currentAlertCard.subtitle}
                    </div>
                  </div>

                  {/* Stack Counter & Vertical Swipe / Cycle Buttons */}
                  {alertStack.length > 1 && (
                    <div
                      onClick={e => e.stopPropagation()}
                      className="flex flex-col items-center justify-center gap-0.5 pl-1.5 border-l border-current/15 shrink-0"
                    >
                      <button
                        type="button"
                        onClick={cycleStackPrev}
                        className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
                        title="Previous notification"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <span className="text-[9.5px] font-mono font-black tabular-nums leading-none">
                        {stackIndex + 1}/{alertStack.length}
                      </span>
                      <button
                        type="button"
                        onClick={cycleStackNext}
                        className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
                        title="Next notification"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* M3 EXPRESSIVE 2-IN-A-ROW NAVIGATION & UTILITY GRID (App APK Removed) */}
            <div className="space-y-1.5">
              {/* Row 1: Tags | Quotes */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="sidebar-btn-entities"
                  onClick={() => handleNavigate('tags')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 min-h-[46px] rounded-l-[20px] rounded-r-[10px] text-[13px] transition-all duration-200 active:scale-[0.97] cursor-pointer border ${
                    activeTab === 'tags'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white dark:bg-zinc-900/95 hover:bg-indigo-50/70 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-200/80 dark:border-zinc-800/80 font-semibold'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'tags'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <span className="truncate">Tags</span>
                </button>

                <button
                  id="sidebar-nav-quotes"
                  type="button"
                  onClick={() => handleNavigate('quotes')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 min-h-[46px] rounded-r-[20px] rounded-l-[10px] text-[13px] transition-all duration-200 active:scale-[0.97] cursor-pointer border ${
                    activeTab === 'quotes'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white dark:bg-zinc-900/95 hover:bg-indigo-50/70 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-200/80 dark:border-zinc-800/80 font-semibold'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'quotes'
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    <Quote className="w-4 h-4" />
                  </span>
                  <span className="truncate">Quotes</span>
                </button>
              </div>

              {/* Row 2: Analytics | Jivan AI */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="sidebar-nav-analytics"
                  type="button"
                  onClick={() => handleNavigate('analytics')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 min-h-[46px] rounded-l-[20px] rounded-r-[10px] text-[13px] transition-all duration-200 active:scale-[0.97] cursor-pointer border ${
                    activeTab === 'analytics'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white dark:bg-zinc-900/95 hover:bg-indigo-50/70 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-200/80 dark:border-zinc-800/80 font-semibold'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'analytics'
                        ? 'bg-white/20 text-white'
                        : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <span className="truncate">Analytics</span>
                </button>

                <button
                  type="button"
                  id="sidebar-btn-ai"
                  onClick={() => {
                    setIsAIChatOpen(true);
                    setIsSidebarCollapsed(true);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 min-h-[46px] rounded-r-[20px] rounded-l-[10px] text-[13px] font-semibold bg-white dark:bg-zinc-900/95 hover:bg-violet-50/70 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-200/80 dark:border-zinc-800/80 transition-all duration-200 active:scale-[0.97] cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="truncate">Jivan AI</span>
                </button>
              </div>
            </div>

            {/* BACKUP & CLOUD SYNC CARD */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[20px] bg-white dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs">
              <button
                type="button"
                id="sidebar-btn-backup"
                onClick={openBackupSyncDirect}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer hover:opacity-90 transition"
              >
                <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-slate-800 dark:text-zinc-100 leading-tight truncate">
                    Backup &amp; Sync
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {hasRealSyncConnection
                      ? realSyncOverview.connectedCount === 1
                        ? realSyncOverview.connectedProviders[0].label
                        : `${realSyncOverview.connectedCount} providers connected`
                      : 'Local only'}
                  </div>
                </div>
              </button>

              {/* Real Sync Status Pill — only shows Synced when a real provider is connected and synced */}
              <button
                type="button"
                id="btn-sidebar-sync-status"
                onClick={() => {
                  if (!hasRealSyncConnection) {
                    openBackupSyncDirect();
                  } else {
                    syncWithCloud();
                  }
                }}
                title={
                  !hasRealSyncConnection
                    ? 'Open Backup & Sync to connect a provider'
                    : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : !isOnline || syncStatus === 'offline'
                    ? 'Offline — Tap to retry'
                    : hasRealSyncSuccess
                    ? 'Synced — Tap to sync now'
                    : 'Connected — Tap to sync now'
                }
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 ${
                  !hasRealSyncConnection
                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                    : syncStatus === 'syncing'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70'
                    : !isOnline || syncStatus === 'offline'
                    ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                    : syncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                    : hasRealSyncSuccess
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/70'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/90 dark:border-indigo-800/70'
                }`}
              >
                {!hasRealSyncConnection ? (
                  <span>Not connected</span>
                ) : syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>Syncing</span>
                  </>
                ) : !isOnline || syncStatus === 'offline' ? (
                  <>
                    <CloudOff className="w-3 h-3 text-amber-500" />
                    <span>Offline</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <Cloud className="w-3 h-3 text-rose-500" />
                    <span>Error</span>
                  </>
                ) : hasRealSyncSuccess ? (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Synced</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    <span>Sync</span>
                  </>
                )}
              </button>
            </div>

            {/* DE-BLOATED INTERACTIVE FOCUS CLOCK WIDGET */}
            <div
              data-no-drawer-swipe="true"
              className="relative p-3 rounded-[22px] bg-white dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs space-y-2"
            >
              {/* Clock Header: Full Title + Focus/Break Switcher */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-200 whitespace-nowrap">
                  Focus Timer
                </span>

                <div className="flex items-center p-0.5 rounded-xl bg-[#eef2fb] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 shrink-0">
                  <button
                    type="button"
                    onClick={() => switchPomodoroMode('work')}
                    className={`px-2.5 py-0.5 rounded-[9px] text-[10px] font-bold transition cursor-pointer ${
                      pomodoro.mode === 'work'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPomodoroMode('break')}
                    className={`px-2.5 py-0.5 rounded-[9px] text-[10px] font-bold transition cursor-pointer ${
                      pomodoro.mode === 'break'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Break
                  </button>
                </div>
              </div>

              {/* Sleek Unbloated Dial + Action Controls */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative shrink-0 flex items-center justify-center">
                  <svg
                    ref={dialRef}
                    width={dialSize}
                    height={dialSize}
                    viewBox={`0 0 ${dialSize} ${dialSize}`}
                    onPointerDown={handleDialPointerDown}
                    onPointerMove={handleDialPointerMove}
                    onPointerUp={handleDialPointerUp}
                    onPointerCancel={handleDialPointerUp}
                    className={`touch-none select-none ${
                      pomodoro.isRunning ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                    }`}
                    aria-label="Interactive focus timer clock dial"
                  >
                    <circle
                      cx={dialCenter}
                      cy={dialCenter}
                      r={dialRadius + 5}
                      className="fill-[#f5f7fc] dark:fill-zinc-950/80 stroke-slate-200/70 dark:stroke-zinc-800"
                      strokeWidth="1"
                    />

                    {Array.from({ length: 12 }).map((_, i) => {
                      const a = ((i * 30 - 90) * Math.PI) / 180;
                      const rOuter = dialRadius + 2;
                      const rInner = dialRadius - (i % 3 === 0 ? 4 : 2);
                      return (
                        <line
                          key={i}
                          x1={dialCenter + rInner * Math.cos(a)}
                          y1={dialCenter + rInner * Math.sin(a)}
                          x2={dialCenter + rOuter * Math.cos(a)}
                          y2={dialCenter + rOuter * Math.sin(a)}
                          className="stroke-slate-300 dark:stroke-zinc-700"
                          strokeWidth={i % 3 === 0 ? '1.6' : '1'}
                          strokeLinecap="round"
                        />
                      );
                    })}

                    <circle
                      cx={dialCenter}
                      cy={dialCenter}
                      r={dialRadius}
                      fill="none"
                      className="stroke-slate-200/80 dark:stroke-zinc-800"
                      strokeWidth="5.5"
                    />

                    <circle
                      cx={dialCenter}
                      cy={dialCenter}
                      r={dialRadius}
                      fill="none"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeDasharray={dialCircumference}
                      strokeDashoffset={strokeOffset}
                      transform={`rotate(-90 ${dialCenter} ${dialCenter})`}
                      className={
                        pomodoro.mode === 'break'
                          ? 'stroke-emerald-500 transition-[stroke-dashoffset] duration-300'
                          : 'stroke-indigo-600 dark:stroke-indigo-500 transition-[stroke-dashoffset] duration-300'
                      }
                    />

                    <line
                      x1={dialCenter}
                      y1={dialCenter}
                      x2={handEndX}
                      y2={handEndY}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      className={
                        pomodoro.mode === 'break' ? 'stroke-emerald-500/70' : 'stroke-indigo-500/70'
                      }
                    />
                    <circle
                      cx={dialCenter}
                      cy={dialCenter}
                      r="2.8"
                      className={
                        pomodoro.mode === 'break'
                          ? 'fill-emerald-500'
                          : 'fill-indigo-600 dark:fill-indigo-400'
                      }
                    />

                    {!pomodoro.isRunning && (
                      <circle
                        cx={thumbX}
                        cy={thumbY}
                        r="5"
                        className={`stroke-white dark:stroke-zinc-900 ${
                          pomodoro.mode === 'break'
                            ? 'fill-emerald-500'
                            : 'fill-indigo-600 dark:fill-indigo-400'
                        }`}
                        strokeWidth="2"
                      />
                    )}
                  </svg>

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                      {formatTimer(pomodoro.timeRemaining)}
                    </span>
                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-1">
                      {pomodoro.isRunning ? 'ACTIVE' : 'DRAG DIAL'}
                    </span>
                  </div>
                </div>

                {/* Right Side: Duration Dropdown Picker + Primary Play/Pause & Reset */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      disabled={pomodoro.isRunning}
                      onClick={() => setIsDurationMenuOpen(prev => !prev)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#f4f7fc] dark:bg-zinc-800/70 hover:bg-indigo-50/70 dark:hover:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70 flex items-center justify-between gap-1.5 text-left transition cursor-pointer disabled:opacity-70 disabled:cursor-default"
                      title="Select preset or custom timer duration"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-xs font-extrabold text-slate-800 dark:text-zinc-100 tabular-nums truncate">
                          {pomodoro.isRunning ? 'Running' : `${currentSetMinutes} min`}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0 transition-transform ${
                          isDurationMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isDurationMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setIsDurationMenuOpen(false)}
                        />
                        <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl p-2.5 z-40 space-y-2 animate-view-enter">
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            Quick Presets
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {quickPresets.map(mins => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setPomodoroDuration(mins);
                                  setIsDurationMenuOpen(false);
                                }}
                                className={`py-1 rounded-lg text-[10.5px] font-bold tabular-nums transition cursor-pointer ${
                                  currentSetMinutes === mins
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                }`}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>

                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              const parsed = parseInt(customMinutesInput, 10);
                              if (!isNaN(parsed) && parsed >= 1 && parsed <= 180) {
                                setPomodoroDuration(parsed);
                                setCustomMinutesInput('');
                                setIsDurationMenuOpen(false);
                              }
                            }}
                            className="pt-1.5 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-1"
                          >
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={customMinutesInput}
                              onChange={e => setCustomMinutesInput(e.target.value)}
                              placeholder="Custom (1-180m)"
                              className="w-full px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-semibold text-slate-900 dark:text-white outline-hidden"
                            />
                            <button
                              type="submit"
                              className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                            >
                              Set
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="btn-sidebar-focus-timer"
                      onClick={() => {
                        if (pomodoro.isRunning) {
                          pausePomodoro();
                        } else {
                          startPomodoro(undefined, currentSetMinutes);
                        }
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${
                        pomodoro.isRunning
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : pomodoro.mode === 'break'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {pomodoro.isRunning ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Start</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetPomodoro({ restart: false, clearTask: true })}
                      title="Reset Focus Clock"
                      className="p-2 rounded-xl bg-[#eef2fb] dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. PINNED BOTTOM 2-IN-A-ROW CONTROLS: Theme Toggle | Settings */}
          <div className="pt-1.5 border-t border-slate-200/80 dark:border-zinc-800/80 shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="btn-sidebar-theme-toggle"
                onClick={() => {
                  const nextTheme = theme === 'dark' ? 'light' : 'dark';
                  setTheme(nextTheme);
                  try {
                    soundEngine.playClick();
                  } catch {}
                  showAndroidToast(nextTheme === 'dark' ? 'Dark mode' : 'Light mode');
                }}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                className="py-2.5 px-3 min-h-[44px] rounded-l-[18px] rounded-r-[10px] flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer border bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-800/80 shadow-2xs"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Dark</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-sidebar-settings"
                onClick={() => handleNavigate('settings')}
                title="Open System Settings"
                className={`py-2.5 px-3 min-h-[44px] rounded-r-[18px] rounded-l-[10px] flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer border ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-800/80 shadow-2xs'
                }`}
              >
                <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
