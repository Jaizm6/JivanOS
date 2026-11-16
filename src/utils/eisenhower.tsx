import React from 'react';
import { Ban } from 'lucide-react';
import { Priority, EisenhowerQuadrant } from '../types';
import { HighPriorityIcon, MediumPriorityIcon, LowPriorityIcon } from '../components/common/PriorityIcon';

export interface EisenhowerConfig {
  priority: Priority;
  quadrant: EisenhowerQuadrant;
  label: string;
  shortLabel: string;
  formula: string; // e.g., "Urgent + Important"
  actionDescription: string;
  urgency: boolean;
  importance: boolean;
  color: string; // hex
  badgeClass: string;
  cardBorderClass: string;
  indicatorClass: string;
  iconColorClass: string;
  buttonClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const EISENHOWER_MATRIX: Record<string, EisenhowerConfig> = {
  high: {
    priority: 'high',
    quadrant: 'urgent_important',
    label: 'High',
    shortLabel: 'High',
    formula: 'High Priority',
    actionDescription: 'Crisis, pressing tasks, hard deadlines',
    urgency: true,
    importance: true,
    color: '#991b1b',
    badgeClass: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
    cardBorderClass: 'border-red-300/80 dark:border-red-800/80',
    indicatorClass: 'bg-red-600 dark:bg-red-500',
    iconColorClass: 'text-red-600 dark:text-red-400',
    buttonClass: 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900',
    Icon: HighPriorityIcon,
  },
  medium: {
    priority: 'medium',
    quadrant: 'not_urgent_important',
    label: 'Medium',
    shortLabel: 'Medium',
    formula: 'Medium Priority',
    actionDescription: 'Strategy, planning, important work',
    urgency: false,
    importance: true,
    color: '#f59e0b',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    cardBorderClass: 'border-amber-200/80 dark:border-amber-900/50',
    indicatorClass: 'bg-amber-500',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
    buttonClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/80',
    Icon: MediumPriorityIcon,
  },
  low: {
    priority: 'low',
    quadrant: 'not_urgent_not_important',
    label: 'Low',
    shortLabel: 'Low',
    formula: 'Low Priority',
    actionDescription: 'Routine, flexible, minor tasks',
    urgency: false,
    importance: false,
    color: '#8b5cf6',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800',
    cardBorderClass: 'border-violet-200/80 dark:border-violet-800',
    indicatorClass: 'bg-violet-500',
    iconColorClass: 'text-violet-500 dark:text-violet-400',
    buttonClass: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/80',
    Icon: LowPriorityIcon,
  },
  P1: {
    priority: 'high',
    quadrant: 'urgent_important',
    label: 'High',
    shortLabel: 'High',
    formula: 'High Priority',
    actionDescription: 'Crisis, pressing tasks, hard deadlines',
    urgency: true,
    importance: true,
    color: '#991b1b',
    badgeClass: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
    cardBorderClass: 'border-red-300/80 dark:border-red-800/80',
    indicatorClass: 'bg-red-600 dark:bg-red-500',
    iconColorClass: 'text-red-600 dark:text-red-400',
    buttonClass: 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900',
    Icon: HighPriorityIcon,
  },
  P2: {
    priority: 'medium',
    quadrant: 'not_urgent_important',
    label: 'Medium',
    shortLabel: 'Medium',
    formula: 'Medium Priority',
    actionDescription: 'Strategy, deep work, planning',
    urgency: false,
    importance: true,
    color: '#f59e0b',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    cardBorderClass: 'border-amber-200/80 dark:border-amber-900/50',
    indicatorClass: 'bg-amber-500',
    iconColorClass: 'text-amber-500 dark:text-amber-400',
    buttonClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/80',
    Icon: MediumPriorityIcon,
  },
  P3: {
    priority: 'low',
    quadrant: 'urgent_not_important',
    label: 'Pass',
    shortLabel: 'Pass',
    formula: 'Urgent · Delegate',
    actionDescription: 'Requests, chores, assignments',
    urgency: true,
    importance: false,
    color: '#3b82f6',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    cardBorderClass: 'border-blue-200/80 dark:border-blue-800',
    indicatorClass: 'bg-blue-500',
    iconColorClass: 'text-blue-500 dark:text-blue-400',
    buttonClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/80',
    Icon: LowPriorityIcon,
  },
  P4: {
    priority: 'low',
    quadrant: 'not_urgent_not_important',
    label: 'Low',
    shortLabel: 'Low',
    formula: 'Low Priority',
    actionDescription: 'Low-value noise, dismiss',
    urgency: false,
    importance: false,
    color: '#8b5cf6',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800',
    cardBorderClass: 'border-violet-200 dark:border-violet-800',
    indicatorClass: 'bg-violet-500',
    iconColorClass: 'text-violet-500 dark:text-violet-400',
    buttonClass: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/80',
    Icon: LowPriorityIcon,
  },
};

export const QUADRANT_TO_PRIORITY: Record<EisenhowerQuadrant, Priority> = {
  urgent_important: 'high',
  not_urgent_important: 'medium',
  urgent_not_important: 'low',
  not_urgent_not_important: 'low',
  neither: 'low',
};

export function getEisenhowerMeta(key?: Priority | EisenhowerQuadrant | string): EisenhowerConfig {
  if (!key) return EISENHOWER_MATRIX.high;
  const k = key.toLowerCase();
  if (k === 'high' || k === 'p1' || k === 'urgent_important') return EISENHOWER_MATRIX.high;
  if (k === 'medium' || k === 'p2' || k === 'not_urgent_important') return EISENHOWER_MATRIX.medium;
  if (k === 'low' || k === 'p3' || k === 'p4' || k === 'urgent_not_important' || k === 'not_urgent_not_important' || k === 'neither') return EISENHOWER_MATRIX.low;
  return EISENHOWER_MATRIX.high;
}

export function cycleEisenhower(currentPriority: Priority | string): {
  nextPriority: Priority;
  nextQuadrant: EisenhowerQuadrant;
  meta: EisenhowerConfig;
} {
  const cycleOrder: Record<string, Priority> = {
    high: 'medium',
    medium: 'low',
    low: 'high',
    p1: 'medium',
    p2: 'low',
    p3: 'high',
    p4: 'high',
    P1: 'medium',
    P2: 'low',
    P3: 'high',
    P4: 'high',
  };
  const key = (currentPriority || 'medium').toLowerCase();
  const nextP = cycleOrder[key] || 'high';
  const meta = EISENHOWER_MATRIX[nextP] || EISENHOWER_MATRIX.high;
  return {
    nextPriority: nextP,
    nextQuadrant: meta.quadrant,
    meta,
  };
}

/**
 * Eisenhower Badge / Button Component
 */
export const EisenhowerBadge: React.FC<{
  priority?: Priority;
  quadrant?: EisenhowerQuadrant;
  showFormula?: boolean;
  isInteractive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md';
  className?: string;
}> = ({
  priority,
  quadrant,
  showFormula = false,
  isInteractive = false,
  onClick,
  size = 'sm',
  className = '',
}) => {
  const meta = getEisenhowerMeta(priority || (quadrant ? QUADRANT_TO_PRIORITY[quadrant] : 'P1'));
  const IconComponent = meta.Icon;

  const baseContent = (
    <>
      <IconComponent className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span className="font-bold">{meta.label}</span>
      {showFormula && (
        <span className="text-[9px] opacity-75 font-normal hidden sm:inline">
          ({meta.formula})
        </span>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition shadow-2xs cursor-pointer select-none ${meta.buttonClass} ${className}`}
        title={`Eisenhower: ${meta.label} (${meta.formula}) — Click to cycle`}
      >
        {baseContent}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${meta.badgeClass} ${className}`}
      title={`${meta.label}: ${meta.formula}`}
    >
      {baseContent}
    </span>
  );
};
