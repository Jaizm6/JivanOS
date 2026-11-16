import React, { useMemo } from 'react';
import {
  BarChart3,
  AlertCircle,
  Timer,
  Quote,
  FolderKanban,
  Sun,
  Moon,
  Database,
  RefreshCw,
  CheckCircle2,
  Cloud,
  CloudOff,
  PanelLeftClose,
  LayoutGrid,
  User,
  Play,
  Pause,
  Bell,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { soundEngine } from '../../utils/audio';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    theme,
    setTheme,
    isOnline,
    syncStatus,
    syncWithCloud,
    syncEmail,
    medications,
    pomodoro,
    startPomodoro,
    pausePomodoro,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setIsBackupModalOpen,
    setIsAuthModalOpen,
    setIsWidgetModalOpen,
    unreadNotificationsCount,
    setIsNotificationDrawerOpen,
    profile,
    firebaseUser,
    pushNotification,
    setIsAIChatOpen,
  } = useApp();

  const lowStockMeds = useMemo(
    () => medications.filter(m => m.active && m.remainingPills <= m.refillThreshold),
    [medications]
  );

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

  // Only items NOT in the bottom menu appear in the first left panel
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'quotes',
      label: 'Quotes',
      icon: <Quote className="w-[17px] h-[17px]" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-[17px] h-[17px]" />,
    },
  ];

  const isOpen = !isSidebarCollapsed;

  return (
    <>
      {/* Dedicated Left-Edge Touch-Drag Sensor Strip (kept mounted below top bar so Navbar toggle button is never occluded) */}
      <div
        data-drawer-edge-sensor="true"
        aria-hidden="true"
        className={`fixed top-14 bottom-16 left-0 z-[35] w-7 touch-pan-y select-none ${
          isOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      />

      <aside
        data-drawer-sidebar="true"
        data-open={isOpen ? 'true' : 'false'}
        aria-hidden={!isOpen}
        className="fixed inset-y-0 left-0 z-[80] w-[276px] sm:w-[292px] bg-[#edf2fa] dark:bg-[#08090d] border-r border-slate-200/90 dark:border-zinc-800/90 flex flex-col select-none touch-pan-y"
      >
      <div className="flex flex-col h-full min-h-0 p-2.5 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-1.5 overflow-hidden">
        {/* 1. TOP BRAND & USER PROFILE CARD (Namida Header Card + Sync Icon + Close Control) */}
        <div className="flex items-center justify-between gap-1.5 p-2 rounded-2xl bg-white dark:bg-zinc-900/95 border border-slate-200/70 dark:border-zinc-800/80 shadow-2xs shrink-0">
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
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/40 dark:ring-indigo-400/40"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  J
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                  !isOnline || syncStatus === 'offline'
                    ? 'bg-amber-500'
                    : syncStatus === 'syncing'
                    ? 'bg-indigo-500 animate-pulse'
                    : syncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
                title={!isOnline ? 'Offline' : syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Synced'}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[14px] tracking-tight text-slate-900 dark:text-zinc-100 truncate">
                  Jivan <span className="text-indigo-600 dark:text-indigo-400">OS</span>
                </span>
              </div>
              <div className="text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">
                <User className="w-2.5 h-2.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate">
                  {firebaseUser?.displayName
                    ? firebaseUser.displayName.split(' ')[0]
                    : profile.nickname || profile.name || 'Sign In'}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {/* Shifted Cloud Sync Status Pill / Button in Left Panel */}
            <button
              type="button"
              id="btn-sidebar-sync-status"
              onClick={() => syncWithCloud()}
              title={
                syncStatus === 'syncing'
                  ? 'Syncing with Cloud...'
                  : !isOnline || syncStatus === 'offline'
                  ? 'Offline Mode — Tap to retry'
                  : 'Cloud Synced — Tap to Sync Now'
              }
              className={`px-2 py-1.5 rounded-xl border text-[10.5px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 ${
                syncStatus === 'syncing'
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70'
                  : !isOnline || syncStatus === 'offline'
                  ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                  : syncStatus === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/70'
              }`}
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Syncing</span>
                </>
              ) : !isOnline || syncStatus === 'offline' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Offline</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-rose-500" />
                  <span>Retry</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Synced</span>
                </>
              )}
            </button>

            {/* Notification Center Bell */}
            <button
              type="button"
              id="btn-notifications-drawer"
              onClick={() => {
                setIsNotificationDrawerOpen(true);
                setIsSidebarCollapsed(true);
              }}
              title="Notifications & Reminders"
              className="relative p-2 rounded-xl bg-slate-100 dark:bg-zinc-800/90 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>

            {/* Close Left Panel Button */}
            <button
              type="button"
              id="btn-close-sidebar"
              onClick={() => setIsSidebarCollapsed(true)}
              title="Close Panel (Ctrl+B)"
              className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800/90 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-600 dark:text-zinc-300 transition active:scale-95 cursor-pointer shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. SCROLLABLE MATERIAL 4 GROUPED CONTAINMENT NAVIGATION STACK */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
          {/* Connected Group 1: Primary Drawer Destinations (Quotes & Analytics) */}
          <div className="space-y-[3px]">
            {navItems.map((item, idx) => {
              const isActive =
                activeTab === item.id ||
                (item.id === 'tasks' &&
                  (activeTab === 'planner' || activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule'));
              const radiusClass =
                idx === 0
                  ? 'rounded-t-[20px] rounded-b-[5px]'
                  : idx === navItems.length - 1
                  ? 'rounded-t-[5px] rounded-b-[20px]'
                  : 'rounded-[5px]';

              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 ${radiusClass} text-[13px] transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.985] cursor-pointer ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-950/90 text-indigo-700 dark:text-indigo-200 border border-indigo-300/70 dark:border-indigo-800/70 font-extrabold shadow-2xs'
                      : 'bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 border border-slate-200/75 dark:border-zinc-800/80 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 transition-transform duration-200 ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-300 scale-105'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Connected Group 2: Quick Utility Cards (AI Assistant, Tags & Backup) */}
          <div className="space-y-[3px]">
            {/* AI Assistant Pop Up Card Trigger */}
            <button
              type="button"
              id="sidebar-btn-ai"
              onClick={() => {
                setIsAIChatOpen(true);
                setIsSidebarCollapsed(true);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-t-[20px] rounded-b-[5px] text-[13px] font-semibold bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 border border-slate-200/75 dark:border-zinc-800/80 transition-all duration-200 active:scale-[0.985] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-[17px] h-[17px] text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Jivan AI</span>
              </div>
            </button>

            {/* Tags Page Link */}
            <button
              type="button"
              id="sidebar-btn-entities"
              onClick={() => handleNavigate('tags')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-[5px] text-[13px] transition-all duration-200 active:scale-[0.985] cursor-pointer ${
                activeTab === 'tags'
                  ? 'bg-indigo-500/20 dark:bg-indigo-400/25 text-indigo-700 dark:text-indigo-200 font-bold border border-indigo-400/35'
                  : 'font-semibold bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 border border-slate-200/75 dark:border-zinc-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="w-[17px] h-[17px] text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Tags</span>
              </div>
            </button>

            {/* Dashboard Widgets Customizer Card */}
            <button
              type="button"
              id="sidebar-btn-widgets"
              onClick={() => {
                setIsWidgetModalOpen(true);
                setIsSidebarCollapsed(true);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-[5px] text-[13px] font-semibold bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 border border-slate-200/75 dark:border-zinc-800/80 transition-all duration-200 active:scale-[0.985] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-[17px] h-[17px] text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Widgets</span>
              </div>
            </button>

            {/* Cloud Sync & Backup Card */}
            <div className="flex items-stretch gap-[3px]">
              <button
                type="button"
                id="sidebar-btn-backup"
                onClick={() => {
                  setIsBackupModalOpen(true);
                  setIsSidebarCollapsed(true);
                }}
                className="flex-1 flex items-center justify-between px-3.5 py-2 rounded-tl-[5px] rounded-tr-[5px] rounded-bl-[20px] rounded-br-[5px] text-[13px] font-semibold bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 border border-slate-200/75 dark:border-zinc-800/80 transition-all duration-200 active:scale-[0.985] cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Database className="w-[17px] h-[17px] text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="truncate text-left">
                    <div className="leading-tight truncate">Backup</div>
                    <div className="text-[9.5px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                      {!isOnline ? 'Offline' : syncStatus === 'syncing' ? 'Syncing...' : syncEmail}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => syncWithCloud()}
                title="Sync Now"
                className="px-3 rounded-tl-[5px] rounded-bl-[5px] rounded-tr-[5px] rounded-br-[20px] bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800/90 border border-slate-200/75 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
              >
                {!isOnline ? (
                  <CloudOff className="w-4 h-4 text-amber-500" />
                ) : syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            </div>
          </div>

          {lowStockMeds.length > 0 && (
            <div
              onClick={() => handleNavigate('medications')}
              className="p-2.5 rounded-[18px] bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-xs cursor-pointer hover:opacity-95 transition"
            >
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Refill Alert ({lowStockMeds.length})</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 font-medium">
                {lowStockMeds[0].name} ({lowStockMeds[0].remainingPills} left)
              </p>
            </div>
          )}
        </div>

        {/* 3. PINNED BOTTOM CONTROLS STACK (Exact Namida Bottom Architecture) */}
        <div className="pt-1.5 border-t border-slate-200/75 dark:border-zinc-800/80 space-y-1.5 shrink-0">
          {/* Collapsible Theme & Material You Palette Drawer (Triggered by Theme button) */}
          {/* Row B: Namida Full-Width Focus Timer Pill Button */}
          <button
            type="button"
            id="btn-sidebar-focus-timer"
            onClick={() => {
              if (pomodoro.isRunning) {
                pausePomodoro();
              } else {
                startPomodoro(undefined, 25);
              }
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer border ${
              pomodoro.isRunning
                ? 'bg-indigo-500/20 dark:bg-indigo-400/25 text-indigo-700 dark:text-indigo-200 border-indigo-400/35'
                : 'bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200/70 dark:border-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Timer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{pomodoro.isRunning ? 'Focus Session Active' : 'Focus Timer'}</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span>{formatTimer(pomodoro.timeRemaining)}</span>
              {pomodoro.isRunning ? (
                <Pause className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Play className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </button>

          {/* Row C: 2-Column Action Buttons: [ 1-Tap Quick Theme Toggle ] [ System Settings ] */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-sidebar-theme-toggle"
              onClick={() => {
                const nextTheme = theme === 'dark' ? 'light' : 'dark';
                setTheme(nextTheme);
                try { soundEngine.playClick(); } catch {}
                pushNotification('Theme Switched', `Active: ${nextTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}`, 'system');
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="py-2.5 px-3 rounded-[14px] flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer border bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200/70 dark:border-zinc-800/80 shadow-2xs"
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
              className={`py-2.5 px-3 rounded-[14px] flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] cursor-pointer border ${
                activeTab === 'settings'
                  ? 'bg-indigo-500/20 dark:bg-indigo-400/25 text-indigo-700 dark:text-indigo-200 border-indigo-400/35'
                  : 'bg-white dark:bg-zinc-900/95 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200/70 dark:border-zinc-800/80 shadow-2xs'
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
