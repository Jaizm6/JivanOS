import React from 'react';

/**
 * Optically-centered Subtask Branch Icon (16x16) matching reference image_e61afc49.
 * Engineered so the top of the vertical stem (y=2.2) aligns with the cap-height of "1/3"
 * and the lower branch + dot (y=12.2) aligns with the exact numeric baseline of "1/3".
 */
export const SubtaskBranchIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Main vertical trunk aligned from cap-height (y=2.2) to numeric baseline (y=12.2) */}
    <path d="M2.5 2.2V9.8C2.5 11.2 3.5 12.2 4.9 12.2H9.6" />

    {/* Upper horizontal branch */}
    <path d="M2.5 6.2H9.6" />

    {/* Upper node dot */}
    <circle cx="13" cy="6.2" r="1.35" fill="currentColor" stroke="none" />

    {/* Lower node dot */}
    <circle cx="13" cy="12.2" r="1.35" fill="currentColor" stroke="none" />
  </svg>
);
