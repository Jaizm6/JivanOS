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
  label = '',
  onClick,
  tooltipText,
  variant = 'inline',
}) => {
  const [showPop, setShowPop] = useState(false);
  const prevCompletedRef = useRef<boolean>(isCompleted);
  const prevStreakRef = useRef<number>(streak);

  // Trigger positive reinforcement pulse when task or habit completes or streak increases
  useEffect(() => {
    const wasCompleted = prevCompletedRef.current;
    const prevStreak = prevStreakRef.current;

    if (!isCompleted && streak <= 0) {
      setShowPop(false);
      return;
    }

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

  // If streak is 0 and showZero is false, hide
  if (streak <= 0 && !showZero && !isCompleted && !isAnimating) {
    return null;
  }

  // Display streak count (at least 1 if completed or animating)
  const displayStreak = Math.max(isCompleted || isAnimating ? 1 : 0, streak);
  const isActive = isCompleted || showPop || displayStreak > 0;

  const sizeClasses = {
    xs: {
      container: 'gap-1 text-[12px]',
      icon: 'w-3.5 h-3.5',
      label: 'text-[11px]',
    },
    sm: {
      container: 'gap-1 text-[13.5px]',
      icon: 'w-4 h-4',
      label: 'text-[12px]',
    },
    md: {
      container: 'gap-1.5 text-[15px]',
      icon: 'w-[18px] h-[18px]',
      label: 'text-[13px]',
    },
  }[size];

  const defaultTooltip = `${displayStreak} day consistency streak! ${
    isCompleted
      ? 'Completed today • Streak safe!'
      : 'Complete to keep your daily momentum going!'
  }`;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center select-none ${className}`}
      title={tooltipText || defaultTooltip}
      data-variant={variant}
    >
      {/* Floating "+1" celebratory reinforcement */}
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
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-500 dark:text-amber-400 pointer-events-none whitespace-nowrap z-30 flex items-center gap-0.5"
          >
            +1<Flame className="w-3 h-3 text-amber-500 dark:text-amber-400 inline" strokeWidth={2.2} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Main Clean Unboxed Streak Display (Outlined Amber Flame + Tabular Count) */}
      <motion.div
        animate={
          showPop
            ? {
                scale: [1, 1.22, 0.96, 1.06, 1],
                rotate: [0, -5, 5, -2, 0],
              }
            : {}
        }
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className={`relative inline-flex items-center leading-none tracking-tight transition-colors duration-200 shrink-0 ${sizeClasses.container}`}
      >
        {/* Outlined Flame Icon retaining our warm amber streak color */}
        <motion.span
          animate={
            showPop
              ? {
                  scale: [1, 1.35, 1.08, 1],
                }
              : {}
          }
          transition={{ duration: 0.35 }}
          className="relative inline-flex items-center justify-center shrink-0"
        >
          <AnimatePresence>
            {showPop && (
              <motion.span
                key="streak-ripple"
                initial={{ scale: 0.7, opacity: 0.75 }}
                animate={{ scale: 1.9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-amber-400/35 pointer-events-none"
              />
            )}
          </AnimatePresence>
          <Flame
            strokeWidth={2.15}
            className={`${sizeClasses.icon} fill-none transition-colors duration-200 ${
              isActive
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-slate-400 dark:text-zinc-500'
            }`}
          />
        </motion.span>

        {/* Clean Unboxed Counter Digit */}
        <motion.span
          key={`digit-${displayStreak}-${showPop}`}
          initial={showPop ? { y: 3, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`font-sans font-semibold leading-none inline-block tabular-nums transition-colors duration-200 ${
            showPop
              ? 'text-amber-600 dark:text-amber-400'
              : isActive
              ? 'text-slate-600 dark:text-zinc-300'
              : 'text-slate-400 dark:text-zinc-500'
          }`}
        >
          {displayStreak}
          {label && (
            <span className={`${sizeClasses.label} font-medium opacity-80 ml-0.5`}>
              {label}
            </span>
          )}
        </motion.span>
      </motion.div>
    </div>
  );
};
