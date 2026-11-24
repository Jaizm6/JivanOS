import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';

export interface UndoSnackbarProps {
  className?: string;
}

/**
 * Minimal Android-style text-only completion toast.
 * Replaces the heavy bottom completion card while preserving Ctrl+Z / Cmd+Z undo support.
 */
export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({ className = '' }) => {
  const { undoSnackbar, hideUndoSnackbar, triggerUndo } = useApp();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!undoSnackbar) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      hideUndoSnackbar();
    }, 1800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [undoSnackbar?.id, hideUndoSnackbar, undoSnackbar]);

  // Preserve silent Ctrl+Z / Cmd+Z keyboard undo while toast is visible
  useEffect(() => {
    if (!undoSnackbar) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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

  const prefix = undoSnackbar?.type === 'habit'
    ? 'Habit done'
    : undoSnackbar?.type === 'task'
      ? 'Task completed'
      : 'Completed';

  const toastText = undoSnackbar
    ? `${prefix}: ${undoSnackbar.title || 'Item'}${undoSnackbar.subtitle ? ` · ${undoSnackbar.subtitle}` : ''}`
    : '';

  return (
    <AnimatePresence>
      {undoSnackbar && (
        <motion.div
          key={undoSnackbar.id}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.14 } }}
          transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          className={`fixed bottom-[76px] sm:bottom-6 left-1/2 -translate-x-1/2 z-[100000] pointer-events-none flex justify-center px-4 w-full max-w-[92vw] ${className}`}
          role="status"
          aria-live="polite"
        >
          <div
            onClick={() => hideUndoSnackbar()}
            className="pointer-events-auto select-none cursor-pointer px-4 py-2 rounded-full bg-zinc-900/92 dark:bg-zinc-100/95 text-white dark:text-zinc-950 text-[12px] font-medium tracking-tight shadow-[0_6px_20px_rgba(0,0,0,0.22)] border border-white/10 dark:border-black/10 backdrop-blur-md max-w-[86vw] truncate"
          >
            {toastText}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
