import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnimatedCheckIconProps {
  className?: string;
  strokeWidth?: number;
  animate?: boolean;
}

/**
 * Minimalist Animated Checkmark SVG that draws the checkmark stroke with Framer Motion.
 * Matches the clean, minimal aesthetic from modern productivity apps.
 */
export const AnimatedCheckIcon: React.FC<AnimatedCheckIconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.5,
  animate = true,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <motion.path
        d="M4.5 12.75l6 6 9-13.5"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
};

export interface CheckmarkCelebrationProps {
  activeKey: number | string | null;
  badgeText?: string;
  ringColor?: string;
  className?: string;
  gradient?: string;
  badgeY?: number;
  align?: 'center' | 'right' | 'left';
  // Compatibility props
  colors?: string[];
  distanceOffset?: number;
}

/**
 * Micro-interaction ring ripple and strictly HORIZONTAL floating completion pill badge.
 * Supports smart alignment ('right', 'left', 'center') to guarantee the badge never
 * overflows past screen or card borders.
 */
export const CheckmarkCelebration: React.FC<CheckmarkCelebrationProps> = ({
  activeKey,
  badgeText,
  ringColor = 'border-emerald-500',
  className = '',
  gradient,
  badgeY = -28,
  align = 'center',
}) => {
  if (!activeKey) return null;

  // Determine badge styling based on badge content:
  // Habit: Rich warm vibrant orange pill (e.g. "Done🔥 13D")
  // Event: Clean electric blue pill (e.g. "Done✔️")
  // Task: Crisp emerald teal pill (e.g. "Done✅")
  const defaultGradient = badgeText?.includes('🔥')
    ? 'bg-gradient-to-r from-[#ff5e00] via-[#ff7a00] to-[#ff9100] text-white shadow-lg shadow-orange-500/35 border border-white/25'
    : badgeText?.includes('✔️')
    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-lg shadow-blue-500/35 border border-white/25'
    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/35 border border-white/25';

  const badgeStyle = gradient || defaultGradient;

  // Alignment positioning
  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'left'
      ? 'left-0'
      : 'left-1/2';

  const alignX =
    align === 'right'
      ? 0
      : align === 'left'
      ? 0
      : '-50%';

  return (
    <div className={`absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-50 ${className}`}>
      <AnimatePresence>
        {/* Localized Micro-Pulse Ring */}
        <motion.div
          key={`pulse-ring-${activeKey}`}
          initial={{ scale: 0.92, opacity: 0.75 }}
          animate={{ scale: 1.45, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-0 rounded-[inherit] border-2 ${ringColor} pointer-events-none`}
        />

        {/* Strictly HORIZONTAL Floating Pill Badge ("Done🔥 [N]D", "Done✅", "Done✔️") */}
        {badgeText && (
          <motion.div
            key={`badge-${activeKey}`}
            initial={{ opacity: 0, y: 0, x: alignX, scale: 0.8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, badgeY, badgeY - 3, badgeY - 6],
              x: alignX,
              scale: [0.8, 1.05, 1, 0.95],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.95, ease: 'easeOut', times: [0, 0.15, 0.75, 1] }}
            className={`absolute ${alignClass} -top-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-tight whitespace-nowrap inline-flex flex-row flex-nowrap items-center justify-center gap-1 pointer-events-none z-50 w-max min-w-max shadow-md select-none ${badgeStyle}`}
            style={{
              whiteSpace: 'nowrap',
              width: 'max-content',
              minWidth: 'max-content',
              display: 'inline-flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
            }}
          >
            <span className="whitespace-nowrap inline-block select-none" style={{ whiteSpace: 'nowrap' }}>
              {badgeText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
