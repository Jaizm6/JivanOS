import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive } from 'lucide-react';
import { PetalShapeBadge } from './PetalExpressive';
import { FORM_EASE, FORM_SPRING, FORM_EXIT_TRANSITION, useModalScrollLock } from './FormPrimitives';

export interface ArchiveConfirmModalProps {
  isOpen: boolean;
  itemName?: string;
  itemType?: string;
  count?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ArchiveConfirmModal: React.FC<ArchiveConfirmModalProps> = ({
  isOpen,
  itemName,
  itemType = 'item',
  count,
  onConfirm,
  onCancel,
}) => {
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onCancel]);

  if (typeof document === 'undefined') return null;

  const isDarkMode = document.documentElement.classList.contains('dark');
  const titleText =
    count && count > 1
      ? `Archive ${count} ${itemType.toLowerCase()}?`
      : itemName
      ? `Archive "${itemName}"?`
      : `Archive this ${itemType.toLowerCase()}?`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="archive-confirm-modal-root"
          data-unified-modal="true"
          className="fixed inset-0 z-[260] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-confirm-title"
        >
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none"
            onClick={e => {
              e.stopPropagation();
              onCancel();
            }}
          />

          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: FORM_SPRING }}
            exit={{ opacity: 0, scale: 0.94, y: 10, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-sm rounded-[28px] bg-white dark:bg-[#141418] text-zinc-900 dark:text-zinc-100 ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <PetalShapeBadge
                shape="scallop"
                sizeClass="w-11 h-11 shrink-0"
                fillColor={isDarkMode ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.12)'}
                strokeColor={isDarkMode ? 'rgba(251, 191, 36, 0.35)' : 'rgba(245, 158, 11, 0.25)'}
              >
                <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </PetalShapeBadge>

              <div className="min-w-0 flex-1">
                <h3
                  id="archive-confirm-title"
                  className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-white leading-snug break-words"
                >
                  {titleText}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  This hides it from active lists, reminders, badge counts, and analytics without deleting your history. You can restore it anytime from Archived.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-[#f3f6fc] dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Confirm Archive</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
