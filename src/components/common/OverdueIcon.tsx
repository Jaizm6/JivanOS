import React from 'react';

interface OverdueIconProps {
  className?: string;
  size?: number;
  title?: string;
}

export const OverdueIcon: React.FC<OverdueIconProps> = ({
  className = 'w-3.5 h-3.5',
  size,
  title,
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <title>{title || 'Overdue'}</title>
      <defs>
        <linearGradient id="overdueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      {/* Clock Outer Ring & Ticks */}
      <circle
        cx="52"
        cy="52"
        r="40"
        stroke="url(#overdueGrad)"
        strokeWidth="6"
        fill="white"
        className="dark:fill-slate-900"
      />
      {/* Ticks */}
      <line x1="52" y1="16" x2="52" y2="22" stroke="url(#overdueGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="84" y1="52" x2="78" y2="52" stroke="url(#overdueGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="52" y1="88" x2="52" y2="82" stroke="url(#overdueGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="52" x2="26" y2="52" stroke="url(#overdueGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="75" y1="29" x2="71" y2="33" stroke="url(#overdueGrad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="75" y1="75" x2="71" y2="71" stroke="url(#overdueGrad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="29" y1="75" x2="33" y2="71" stroke="url(#overdueGrad)" strokeWidth="3" strokeLinecap="round" />
      <line x1="29" y1="29" x2="33" y2="33" stroke="url(#overdueGrad)" strokeWidth="3" strokeLinecap="round" />

      {/* Clock Hands: pointing up & right */}
      <line x1="52" y1="52" x2="52" y2="32" stroke="url(#overdueGrad)" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="52" y1="52" x2="68" y2="52" stroke="url(#overdueGrad)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="52" cy="52" r="4" fill="url(#overdueGrad)" />

      {/* Warning Triangle with Exclamation at bottom-left */}
      <g transform="translate(6, 44)">
        <polygon
          points="20,2 40,38 0,38"
          fill="white"
          stroke="url(#overdueGrad)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          className="dark:fill-slate-900"
        />
        <line x1="20" y1="13" x2="20" y2="25" stroke="url(#overdueGrad)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="20" cy="31" r="2.5" fill="url(#overdueGrad)" />
      </g>
    </svg>
  );
};
