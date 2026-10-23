import React from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = useApp();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-18 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-amber-500/50 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2 select-none"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
      </span>
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span className="tracking-tight">
        Offline Mode &bull; All data saved locally
      </span>
    </div>
  );
};
