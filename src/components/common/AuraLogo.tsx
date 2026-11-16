import React from 'react';

interface AuraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const AuraLogo: React.FC<AuraLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const sizeMap = {
    xs: { box: 'w-6 h-6', icon: 'w-3.5 h-3.5', text: 'text-sm' },
    sm: { box: 'w-7 h-7', icon: 'w-4 h-4', text: 'text-base' },
    md: { box: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-base' },
    lg: { box: 'w-10 h-10', icon: 'w-6 h-6', text: 'text-xl' },
    xl: { box: 'w-14 h-14', icon: 'w-8 h-8', text: 'text-2xl' },
  };

  const { box, text } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${box} rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 shrink-0 flex items-center justify-center transition-transform hover:scale-105`}
      >
        <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
          {/* Subtle inner radial glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-cyan-500/10" />
          <svg viewBox="0 0 24 24" className="w-4/5 h-4/5 text-cyan-300 relative z-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" stroke="url(#logoRingGrad)" strokeDasharray="38 8" />
            <circle cx="12" cy="12" r="3" fill="#38bdf8" />
            <defs>
              <linearGradient id="logoRingGrad" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {showText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`${text} font-black text-slate-900 dark:text-white tracking-tight leading-none`}>
              Aura<span className="text-indigo-600 dark:text-indigo-400">Life</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 leading-none">
              LifeOS
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate hidden sm:block mt-0.5">
            Personal Life Operating System
          </p>
        </div>
      )}
    </div>
  );
};
