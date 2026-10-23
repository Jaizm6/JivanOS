import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, CheckCircle2, Flame, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface UndoSnackbarProps {
  className?: string;
}

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({ className = '' }) => {
  const { undoSnackbar, hideUndoSnackbar, triggerUndo } = useApp();
  const [isHovered, setIsHovered] = useState(false);
  const [supportsHover, setSupportsHover] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(2000);

  // Check if device supports true hover (not mouse emulation on mobile)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupportsHover(window.matchMedia('(hover: hover)').matches);
    }
  }, []);

  // Handle 2-second auto dismissal with pause-on-hover support
  useEffect(() => {
    if (!undoSnackbar) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    remainingTimeRef.current = 2000;
    startTimeRef.current = Date.now();

    const startTimer = (duration: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        hideUndoSnackbar();
      }, duration);
    };

    const shouldPause = isHovered && supportsHover;

    if (!shouldPause) {
      startTimer(remainingTimeRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [undoSnackbar?.id, isHovered, supportsHover, hideUndoSnackbar, undoSnackbar]);

  // Handle keyboard shortcut (Ctrl+Z / Cmd+Z) to trigger Undo
  useEffect(() => {
    if (!undoSnackbar) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If active element is an input or textarea, don't hijack normal text undo
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        triggerUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoSnackbar, triggerUndo]);

  const handleMouseEnter = () => {
    if (!supportsHover) return;
    setIsHovered(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
    }
  };

  const handleMouseLeave = () => {
    if (!supportsHover) return;
    setIsHovered(false);
    startTimeRef.current = Date.now();
  };

  if (!undoSnackbar) return null;

  const isHabit = undoSnackbar.type === 'habit';
  const isTask = undoSnackbar.type === 'task';

  return (
    <AnimatePresence>
      <motion.aside
        key={undoSnackbar.id}
        initial={{ opacity: 0, y: 32, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.94, transition: { duration: 0.2 } }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-[99999] max-w-lg w-[94vw] sm:w-auto ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-zinc-900/95 text-white backdrop-blur-xl border border-white/20 dark:border-zinc-700/80 shadow-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4 select-none">
          {/* 2-Second Animated Countdown Progress Bar */}
          <motion.div
            key={`progress-${undoSnackbar.id}`}
            initial={{ width: '100%' }}
            animate={{ width: (isHovered && supportsHover) ? undefined : '0%' }}
            transition={{ duration: 2, ease: 'linear' }}
            className={`absolute bottom-0 left-0 h-[2.5px] ${
              isHabit
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                : 'bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400'
            }`}
          />

          {/* Left Icon & Information */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isHabit
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isHabit ? (
                <Flame className="w-4 h-4 fill-orange-400/40" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-400">
                  {isHabit ? 'Habit Done' : isTask ? 'Task Completed' : 'Completed'}
                </span>
                <span
                  className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    isHabit
                      ? 'bg-orange-500/25 text-orange-300'
                      : 'bg-emerald-500/25 text-emerald-300'
                  }`}
                >
                  {isHabit ? 'Done🔥' : 'Done✅'}
                </span>
              </div>
              <p
                className="text-xs sm:text-sm font-bold text-white truncate max-w-[170px] sm:max-w-[260px]"
                title={undoSnackbar.title}
              >
                {undoSnackbar.title || 'Item'}
              </p>
            </div>
          </div>

          {/* Right Actions: Undo Button + Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              type="button"
              id="btn-snackbar-undo"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerUndo();
              }}
              className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30 hover:shadow-indigo-500/50 cursor-pointer border border-indigo-400/40"
              title="Undo status change (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Undo</span>
            </motion.button>

            <button
              type="button"
              id="btn-snackbar-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                hideUndoSnackbar();
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Dismiss snackbar"
              aria-label="Dismiss snackbar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
