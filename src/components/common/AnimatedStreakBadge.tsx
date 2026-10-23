import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';

export interface AnimatedStreakBadgeProps {
  streak: number;
  isCompleted?: boolean;
  isAnimating?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showZero?: boolean;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  tooltipText?: string;
  variant?: 'badge' | 'inline';
}

/**
 * AnimatedStreakBadge: A delightful, animated streak counter for tasks and habits
 * that increments smoothly upon completion with positive reinforcement animations,
 * an ember ripple, and a floating "+1 🔥" celebration badge.
 */
export const AnimatedStreakBadge: React.FC<AnimatedStreakBadgeProps> = ({
  streak,
  isCompleted = false,
  isAnimating = false,
  size = 'xs',
  className = '',
  showZero = false,
  label = 'd',
  onClick,
  tooltipText,
  variant = 'badge',
}) => {
  const [showPop, setShowPop] = useState(false);
  const prevCompletedRef = useRef<boolean>(isCompleted);
  const prevStreakRef = useRef<number>(streak);

  // Trigger positive reinforcement pulse when task or habit completes or streak increases
  useEffect(() => {
    const wasCompleted = prevCompletedRef.current;
    const prevStreak = prevStreakRef.current;

    if ((!wasCompleted && isCompleted) || (streak > prevStreak && prevStreak > 0)) {
      setShowPop(true);
      const timer = setTimeout(() => setShowPop(false), 950);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, streak]);

  useEffect(() => {
    prevCompletedRef.current = isCompleted;
    prevStreakRef.current = streak;
  }, [isCompleted, streak]);

  // If streak is 0 and showZero is false, hide or show minimal starter cue
  if (streak <= 0 && !showZero && !isCompleted && !isAnimating) {
    return null;
  }

  // Display streak count (at least 1 if completed or animating)
  const displayStreak = Math.max(isCompleted || isAnimating ? 1 : 0, streak);

  const sizeClasses = {
    xs: {
      badge: 'px-1.5 py-0.2 text-[12px] gap-0.5 rounded-md border border-amber-400/90 dark:border-amber-500/80 shadow-2xs font-bold',
      icon: 'w-3 h-3',
      label: 'text-[11px]',
    },
    sm: {
      badge: 'px-2 py-0.5 text-[13px] gap-1 rounded-lg border border-amber-400/90 dark:border-amber-500/80 shadow-2xs font-bold',
      icon: 'w-3.5 h-3.5',
      label: 'text-[12px]',
    },
    md: {
      badge: 'px-2.5 py-1 text-[15px] gap-1.5 rounded-xl border border-amber-400/90 dark:border-amber-500/80 shadow-2xs font-bold',
      icon: 'w-4 h-4',
      label: 'text-[14px]',
    },
  }[size];

  const defaultTooltip = `${displayStreak} day consistency streak! ${
    isCompleted
      ? 'Completed today • Streak safe! 🔥'
      : 'Complete to keep your daily momentum going! 🔥'
  }`;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center select-none ${className}`}
      title={tooltipText || defaultTooltip}
    >
      {/* Floating "+1 🔥" celebratory reinforcement */}
      <AnimatePresence>
        {showPop && (
          <motion.span
            key="plus-one-badge"
            initial={{ opacity: 0, y: 4, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [4, -13, -16, -18],
              scale: [0.6, 1.15, 1, 0.85],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black text-amber-500 dark:text-amber-400 pointer-events-none drop-shadow-xs whitespace-nowrap z-30 flex items-center gap-0.5"
          >
            +1<Flame className="w-3 h-3 fill-current text-amber-500 inline" />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Ripple ring on increment */}
      <AnimatePresence>
        {showPop && (
          <motion.span
            key="streak-ripple"
            initial={{ scale: 0.85, opacity: 0.8 }}
            animate={{ scale: 1.55, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 rounded-[inherit] bg-amber-400/35 border border-amber-500/50 pointer-events-none z-10"
          />
        )}
      </AnimatePresence>

      {/* Main Animated Badge Container */}
      <motion.div
        animate={
          showPop
            ? {
                scale: [1, 1.28, 0.95, 1.08, 1],
                rotate: [0, -6, 6, -3, 0],
              }
            : {}
        }
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className={`relative inline-flex items-center font-bold tracking-tight transition-colors duration-200 shrink-0 ${
          variant === 'inline'
            ? 'bg-transparent border-0 shadow-none p-0 text-amber-600 dark:text-amber-400'
            : `${sizeClasses.badge} ${
                isCompleted || showPop
                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-400/80 dark:border-amber-500/70 shadow-2xs'
                  : displayStreak > 0
                  ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300/80 dark:border-amber-700/70 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/80'
              }`
        }`}
      >
        {/* Flame Icon with flame vibration and glow on complete */}
        <motion.span
          animate={
            showPop
              ? {
                  scale: [1, 1.4, 1.1, 1],
                  filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                }
              : {}
          }
          transition={{ duration: 0.35 }}
          className="inline-flex items-center justify-center shrink-0"
        >
          <Flame
            className={`${sizeClasses.icon} fill-current transition-colors duration-200 ${
              isCompleted || showPop
                ? 'text-amber-500 fill-amber-500'
                : displayStreak > 0
                ? 'text-amber-500/90 fill-amber-500/80'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </motion.span>

        {/* Animated Counter Digit */}
        <motion.span
          key={`digit-${displayStreak}-${showPop}`}
          initial={showPop ? { y: 4, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="font-mono font-black leading-none inline-block tabular-nums"
        >
          {displayStreak}
          {label && <span className={`${sizeClasses.label} font-sans font-bold opacity-85 ml-0.5`}>{label}</span>}
        </motion.span>
      </motion.div>
    </div>
  );
};
