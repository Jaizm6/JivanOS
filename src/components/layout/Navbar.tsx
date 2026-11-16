import React, { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuoteBanner } from '../common/QuoteBanner';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    isSidebarCollapsed,
    toggleSidebar,
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
      </div>
    </header>
  );
};


