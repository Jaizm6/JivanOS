import React, { useEffect } from 'react';
import { Menu, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuoteBanner } from '../common/QuoteBanner';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    isSidebarCollapsed,
    toggleSidebar,
    syncStatus,
    isOnline,
  } = useApp();

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

  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b border-slate-200/75 dark:border-zinc-900 bg-[var(--m3-surface-container-low,#f3f6fc)] dark:bg-black transition-colors">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 min-h-11 sm:min-h-12 py-1 flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0">
        {/* Left: Compact M3 Tonal Navigation Drawer Button (3 Horizontal Lines Stacked Vertically - Hamburger Menu) */}
        <button
          id="btn-toggle-sidebar"
          type="button"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Open Left Panel (Ctrl+B)' : 'Close Left Panel (Ctrl+B)'}
          aria-label="Toggle Left Navigation Panel"
          className="relative w-9 h-9 rounded-[12px] bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/90 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0 shadow-2xs"
        >
          <Menu className="w-4.5 h-4.5 stroke-[2.2]" />
        </button>

        {/* Top Bar Quote Strip (or page heading when viewing Quotes / Tags) */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {activeTab === 'quotes' || activeTab === 'tags' ? (
            <span className="text-sm sm:text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-zinc-100 truncate select-none px-1">
              {activeTab === 'tags' ? 'Tags' : 'Quotes'}
            </span>
          ) : (
            <QuoteBanner />
          )}
        </div>

        {/* Right: Subtle Sync / Connection Status Indicator */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {syncStatus === 'syncing' ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 text-[11px] font-semibold animate-pulse shadow-2xs select-none">
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span>Syncing...</span>
            </div>
          ) : !isOnline || syncStatus === 'offline' ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 text-[11px] font-semibold shadow-2xs select-none">
              <CloudOff className="w-3 h-3 text-amber-500" />
              <span>Offline</span>
            </div>
          ) : syncStatus === 'error' ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-[11px] font-semibold shadow-2xs select-none" title="Sync Error">
              <Cloud className="w-3 h-3 text-rose-500" />
              <span>Sync Error</span>
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-slate-400 dark:text-zinc-500 text-[10.5px] font-medium select-none" title="Cloud Synced">
              <Cloud className="w-3 h-3 text-emerald-500" />
              <span>Synced</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


