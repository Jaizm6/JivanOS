import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface SettingsSubpageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: React.ReactNode;
}

/**
 * Compact Material 3 Expressive single-row top app bar for Settings sub-screens.
 * Mirrors native Android / ColorOS compact hierarchy: ← arrow + clean title + optional right action.
 */
export const SettingsSubpageHeader: React.FC<SettingsSubpageHeaderProps> = ({
  title,
  onBack,
  actions,
}) => {
  return (
    <div
      data-inpage-header="true"
      className="flex items-center justify-between gap-2 min-h-[44px] pb-0.5 w-full min-w-0"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Settings"
          title="Back to Settings"
          className="w-10 h-10 min-w-[40px] min-h-[40px] -ml-1.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-900 dark:text-zinc-100 inline-flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-[19px] sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
          {title}
        </h1>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
