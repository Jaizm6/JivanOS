import React from 'react';

export const SubtaskBranchIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3 shrink-0' }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Dot at parent connection point */}
    <circle cx="4.5" cy="3.8" r="1.4" fill="currentColor" stroke="none" />
    {/* Elbow branch line down and extending right */}
    <path d="M4.5 4.8v5.2a2 2 0 0 0 2 2h6.5" />
  </svg>
);
