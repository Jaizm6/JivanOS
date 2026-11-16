import React from 'react';

interface OmniLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const OmniLogo: React.FC<OmniLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle = 'Unified Life Log System',
  className = '',
  onClick,
}) => {
  const iconDimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const titleSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  }[size];

  const subtitleSizes = {
    xs: 'text-[8.5px]',
    sm: 'text-[9.5px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Circular Orange Emblem with Overlapping J and Mini-Squircle */}
      <div
        className={`${iconDimensions} relative shrink-0 rounded-full bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 p-0.5 shadow-md shadow-orange-500/20 flex items-center justify-center overflow-hidden group transition-transform hover:scale-105`}
      >
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Circular Orange Background */}
          <circle cx="20" cy="20" r="19" fill="url(#orangeBgGrad)" />

          {/* Top Vitality Dot for J */}
          <circle cx="23" cy="10" r="2.8" fill="#ffffff" />

          {/* Clean Minimalist Bold 'J' Letter */}
          <path
            d="M 23 14 V 24 C 23 28.5 19.5 31.5 15 31.5 C 11.2 31.5 8.8 28.8 8.8 25.2"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <defs>
            <linearGradient id="orangeBgGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ea580c" />
              <stop offset="0.5" stopColor="#f59e0b" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col min-w-0 justify-center">
          {/* Row 1: Brand Name */}
          <span
            className={`${titleSizes} font-black tracking-tight leading-none flex items-center shrink-0`}
          >
            <span className="text-slate-900 dark:text-white">Jivan</span>
            <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 bg-clip-text text-transparent ml-0.5">
              OS
            </span>
          </span>

          {/* Row 2: Official Tagline */}
          {subtitle && (
            <p className="text-[9.5px] sm:text-[10px] font-semibold text-slate-600 dark:text-slate-300 leading-tight tracking-tight truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
