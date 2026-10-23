import React from 'react';
import { Priority, EisenhowerQuadrant } from '../../types';

export const HighPriorityIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5 shrink-0' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-label="High Priority (III)">
    <circle cx="10" cy="10" r="9.5" fill="#f43f5e" />
    <text x="10" y="13.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="sans-serif">III</text>
  </svg>
);

export const MediumPriorityIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5 shrink-0' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-label="Medium Priority (II)">
    <circle cx="10" cy="10" r="9.5" fill="#f59e0b" />
    <text x="10" y="13.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">II</text>
  </svg>
);

export const LowPriorityIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5 shrink-0' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-label="Low Priority (I)">
    <circle cx="10" cy="10" r="9.5" fill="#10b981" />
    <text x="10" y="13.5" textAnchor="middle" fill="white" fontSize="10.5" fontWeight="bold" fontFamily="sans-serif">I</text>
  </svg>
);

interface PriorityIconProps {
  priority?: Priority | EisenhowerQuadrant | string;
  className?: string;
}

export const PriorityIcon: React.FC<PriorityIconProps> = ({ priority = 'medium', className = 'w-3.5 h-3.5 shrink-0' }) => {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high' || p === 'urgent_important' || p === 'p1') {
    return <HighPriorityIcon className={className} />;
  }
  if (p === 'medium' || p === 'not_urgent_important' || p === 'p2') {
    return <MediumPriorityIcon className={className} />;
  }
  return <LowPriorityIcon className={className} />;
};
