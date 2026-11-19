import React, { useId } from 'react';

interface JivanLogoMarkProps {
  className?: string;
  /** When true, renders the icon inside its minimal obsidian squircle container */
  withFrame?: boolean;
}

/**
 * Minimalist geometric JivanOS emblem:
 * A single sculptural "J" cradle paired with a luminous vitality orb.
 */
export const JivanLogoMark: React.FC<JivanLogoMarkProps> = ({
  className = 'w-6 h-6',
  withFrame = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const orbGradId = `jivan-orb-${uid}`;
  const bgGradId = `jivan-bg-${uid}`;

  if (withFrame) {
    return (
      <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={bgGradId} x1="6" y1="3" x2="58" y2="61" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#131C31" />
            <stop offset="55%" stopColor="#0B101D" />
            <stop offset="100%" stopColor="#070A12" />
          </linearGradient>
          <linearGradient id={orbGradId} x1="21" y1="18" x2="30" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="52%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill={`url(#${bgGradId})`} />
        <rect
          x="0.75"
          y="0.75"
          width="62.5"
          height="62.5"
          rx="14.25"
          stroke="#FFFFFF"
          strokeOpacity="0.1"
          strokeWidth="1.2"
        />
        <path
          d="M40.75 19.25 V34.5 A9.25 9.25 0 0 1 23 38.4"
          stroke="#F8FAFC"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25.5" cy="22.75" r="4.25" fill={`url(#${orbGradId})`} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={orbGradId} x1="17" y1="14" x2="30" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="52%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      <path
        d="M42.5 14.5 V34.5 A11.75 11.75 0 0 1 20 39.4"
        stroke="currentColor"
        strokeWidth="6.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.25" cy="19" r="5.25" fill={`url(#${orbGradId})`} />
    </svg>
  );
};

interface JivanLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const JivanLogo: React.FC<JivanLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle,
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
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-xs',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <JivanLogoMark
        withFrame
        className={`${iconDimensions} shrink-0 drop-shadow-xs transition-transform duration-150 hover:scale-[1.03]`}
      />

      {showText && (
        <div className="flex flex-col min-w-0 justify-center">
          <span className={`${titleSizes} font-bold tracking-tight leading-none whitespace-nowrap`}>
            <span className="text-slate-900 dark:text-white">Jivan</span>
            <span className="text-indigo-600 dark:text-indigo-400">OS</span>
          </span>
          {subtitle && (
            <span
              className={`${subtitleSizes} font-medium text-slate-500 dark:text-slate-400 leading-tight truncate mt-0.5`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
