import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Cloud,
  CloudOff,
  Database,
  Moon,
  Sun,
  ShieldCheck,
  RefreshCw,
  User,
  CheckCircle2,
  Sliders,
  Palette,
  Sparkles,
  Check,
  Quote,
  LayoutGrid,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OmniLogo } from '../common/OmniLogo';
import { AccentTone } from '../../types';
import { DEFAULT_AVATAR_PHOTO } from '../../utils/initialData';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    theme,
    setTheme,
    accentTone,
    setAccentTone,
    isOnline,
    syncStatus,
    syncWithCloud,
    syncEmail,
    unreadNotificationsCount,
    setIsNotificationDrawerOpen,
    setIsBackupModalOpen,
    setIsAuthModalOpen,
    setIsWidgetModalOpen,
    setIsAIChatOpen,
    profile,
    firebaseUser,
    loginWithGoogle,
    isSidebarCollapsed,
    toggleSidebar,
  } = useApp();

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [hoveredTone, setHoveredTone] = useState<string | null>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    if (isThemeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isThemeMenuOpen]);

  const toneOptions: { id: AccentTone; label: string; desc: string; color: string }[] = [
    { id: 'indigo', label: 'Indigo', desc: 'Royal Blue', color: '#6366f1' },
    { id: 'emerald', label: 'Emerald', desc: 'Forest Green', color: '#10b981' },
    { id: 'violet', label: 'Violet', desc: 'Deep Purple', color: '#8b5cf6' },
    { id: 'rose', label: 'Rose', desc: 'Ruby Crimson', color: '#f43f5e' },
    { id: 'amber', label: 'Amber', desc: 'Warm Gold', color: '#f59e0b' },
    { id: 'cyan', label: 'Cyan', desc: 'Ocean Teal', color: '#06b6d4' },
  ];

  const activeOption = toneOptions.find(t => t.id === (hoveredTone || accentTone)) || toneOptions[0];

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors shadow-2xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 min-h-12 sm:min-h-13 py-1.5 flex items-center justify-between gap-1 sm:gap-1.5 min-w-0">
        {/* Brand / Title & Desktop Sidebar Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          {/* Desktop/Tablet Sidebar Toggle Button */}
          <button
            id="btn-toggle-sidebar"
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar to full width (Ctrl+B)"}
            className="hidden md:flex p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-500 hover:text-slate-700 dark:text-slate-300" />
            )}
          </button>

          <OmniLogo
            size="sm"
            subtitle="Unified Life Log System"
            className="hover:opacity-95 transition"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* AI Assistant Button (Positioned right before Synced button) */}
          <button
            id="btn-nav-ai"
            onClick={() => setIsAIChatOpen(true)}
            title="Open AI Assistant"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:from-indigo-500/25 hover:to-purple-500/25 transition shrink-0 cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI</span>
          </button>

          {/* Cloud Sync Status Indicator */}
          <button
            id="btn-cloud-sync"
            onClick={() => syncWithCloud()}
            title={isOnline ? `Sync with Cloud (${syncStatus}) · Account: ${syncEmail}` : 'Offline - local cache active'}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          >
            {isOnline ? (
              syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                  <span className="hidden sm:inline text-indigo-600 dark:text-indigo-400">Syncing...</span>
                </>
              ) : syncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">Synced</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline text-slate-600 dark:text-slate-300">Sync</span>
                </>
              )
            ) : (
              <>
                <CloudOff className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline text-amber-600 dark:text-amber-400">Offline</span>
              </>
            )}
            <span className="hidden xl:inline text-[9.5px] text-slate-400 dark:text-slate-500 font-mono border-l border-slate-200 dark:border-slate-700 pl-1.5 max-w-[120px] truncate" title={`Sync target: ${syncEmail}`}>
              {syncEmail}
            </span>
          </button>

          {/* Backup & Cloud Storage (GDrive / Open Source / Restore) */}
          <button
            id="btn-cloud-backup"
            onClick={() => setIsBackupModalOpen(true)}
            title={`Cloud Backup & Storage · Account: ${syncEmail}`}
            className="hidden sm:flex px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition items-center gap-1 shrink-0"
          >
            <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden md:inline">Cloud Backup</span>
          </button>

          {/* Direct Quotes Page Link - Mobile shows icon/logo only to save space */}
          <button
            id="btn-nav-quotes"
            onClick={() => setActiveTab('quotes')}
            title="Quotes Section (2,800+ Wisdom Library, Add/Edit/Delete)"
            className={`flex p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold border transition items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'quotes'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Quote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Quotes</span>
          </button>

          {/* Settings Button */}
          <button
            id="btn-nav-settings"
            onClick={() => setActiveTab('settings')}
            title="System Settings & Cloud Sync"
            className={`flex p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold border transition items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Dark / Light Mode Tiny Button */}
          <button
            type="button"
            id="btn-nav-theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            className="p-1.5 sm:p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer shadow-2xs flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Notification Center */}
          <button
            id="btn-notifications-drawer"
            onClick={() => setIsNotificationDrawerOpen(true)}
            title="Notification Center & Reminder Scheduler"
            className="relative p-1 sm:p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* User Account / Sign In */}
          {firebaseUser ? (
            <button
              id="btn-user-account"
              onClick={() => setIsAuthModalOpen(true)}
              title={`Logged in as ${firebaseUser.displayName || firebaseUser.email || profile.name} • Click to manage account`}
              className="flex items-center gap-1.5 p-0.5 sm:px-2 sm:py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/70 transition text-[11px] text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer shadow-2xs"
            >
              {firebaseUser.photoURL || profile.avatarPhoto ? (
                <img
                  src={firebaseUser.photoURL || profile.avatarPhoto}
                  alt={firebaseUser.displayName || profile.name}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover shrink-0 ring-1.5 ring-emerald-500 shadow-2xs"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {firebaseUser.displayName ? firebaseUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="hidden sm:inline max-w-[90px] truncate font-semibold text-emerald-900 dark:text-emerald-200">
                {firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : (profile.nickname || 'User')}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Cloud Sync Active" />
            </button>
          ) : (
            <button
              id="btn-user-signin"
              onClick={() => setIsAuthModalOpen(true)}
              title="Sign in with your ID to sync your data across phone and web"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition cursor-pointer shadow-2xs active:scale-95 shrink-0"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
