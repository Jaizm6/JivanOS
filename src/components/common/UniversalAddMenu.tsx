import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  Flame,
  Pill,
  ReceiptText,
  Target,
  X,
} from 'lucide-react';
import { FORM_EASE, FORM_EXIT_EASE, CRISP_TRANSFORM_TEMPLATE, useModalScrollLock } from './FormPrimitives';
import { haptics } from '../../utils/haptics';

interface UniversalAddMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (
    type: 'task' | 'habit' | 'event' | 'medication' | 'bill' | 'goal'
  ) => void;
}

export const UniversalAddMenu: React.FC<UniversalAddMenuProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const options: {
    id: 'task' | 'habit' | 'goal' | 'medication' | 'bill';
    label: string;
    icon: React.ReactNode;
    pillClass: string;
  }[] = [
    {
      id: 'task',
      label: 'Task',
      icon: <CheckSquare className="w-[18px] h-[18px] shrink-0 stroke-[2.2]" />,
      pillClass:
        'bg-[#e0e7ff] text-[#312e81] hover:bg-[#c7d2fe] dark:bg-[#1e1b4b] dark:text-[#e0e7ff] dark:hover:bg-[#312e81] ring-1 ring-indigo-500/20 dark:ring-indigo-400/25',
    },
    {
      id: 'habit',
      label: 'Habit',
      icon: <Flame className="w-[18px] h-[18px] shrink-0 stroke-[2.2]" />,
      pillClass:
        'bg-[#d1fae5] text-[#064e3b] hover:bg-[#a7f3d0] dark:bg-[#064e3b] dark:text-[#d1fae5] dark:hover:bg-[#065f46] ring-1 ring-emerald-500/20 dark:ring-emerald-400/25',
    },
    {
      id: 'goal',
      label: 'Goal',
      icon: <Target className="w-[18px] h-[18px] shrink-0 stroke-[2.2]" />,
      pillClass:
        'bg-[#ffedd5] text-[#7c2d12] hover:bg-[#fed7aa] dark:bg-[#431407] dark:text-[#ffedd5] dark:hover:bg-[#7c2d12] ring-1 ring-orange-500/20 dark:ring-orange-400/25',
    },
    {
      id: 'medication',
      label: 'Medication',
      icon: <Pill className="w-[18px] h-[18px] shrink-0 stroke-[2.2]" />,
      pillClass:
        'bg-[#f3e8ff] text-[#581c87] hover:bg-[#e9d5ff] dark:bg-[#3b0764] dark:text-[#f3e8ff] dark:hover:bg-[#581c87] ring-1 ring-purple-500/20 dark:ring-purple-400/25',
    },
    {
      id: 'bill',
      label: 'Bills',
      icon: <ReceiptText className="w-[18px] h-[18px] shrink-0 stroke-[2.2]" />,
      pillClass:
        'bg-[#fef3c7] text-[#78350f] hover:bg-[#fde68a] dark:bg-[#451a03] dark:text-[#fef3c7] dark:hover:bg-[#78350f] ring-1 ring-amber-500/20 dark:ring-amber-400/25',
    },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="m3-fab-menu-root"
          data-unified-modal="true"
          className="fixed inset-0 z-[110]"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Create Menu"
        >
          {/* Separate GPU-light Solid Translucent Scrim */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: FORM_EXIT_EASE } }}
            className="fixed inset-0 bg-slate-950/35 dark:bg-black/65 touch-none"
            onClick={() => {
              haptics.light();
              onClose();
            }}
          />

          {/* Material 3 Expressive FAB Menu: Right-Aligned Hovering Pills + Single Close FAB */}
          <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none pb-safe">
            <div className="max-w-7xl mx-auto px-2 sm:px-5 pb-2.5 sm:pb-3 flex flex-col items-end gap-2.5 max-h-[calc(100dvh-24px)] overflow-y-auto no-scrollbar">
              <div className="flex flex-col items-end gap-2.5 mb-2">
                {options.map((opt, idx) => {
                  // Enter: bottom-up stagger; Exit: top-down cascade back into FAB
                  const reverseIdx = options.length - 1 - idx;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      data-no-press-scale="true"
                      data-motion-anim="true"
                      initial={{ opacity: 0, y: 14, scale: 0.94 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: {
                          duration: 0.16,
                          ease: FORM_EASE,
                          delay: reverseIdx * 0.014,
                        },
                      }}
                      exit={{
                        opacity: 0,
                        y: 10,
                        scale: 0.94,
                        transition: {
                          duration: 0.11,
                          ease: FORM_EXIT_EASE,
                          delay: idx * 0.01,
                        },
                      }}
                      whileTap={{ scale: 0.96 }}
                      transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                      onClick={() => {
                        haptics.light();
                        onSelectType(opt.id);
                        onClose();
                      }}
                      className={`pointer-events-auto inline-flex items-center gap-2.5 h-11 sm:h-12 px-4.5 sm:px-5 rounded-full font-bold text-[13.5px] tracking-tight shadow-md cursor-pointer whitespace-nowrap select-none ${opt.pillClass}`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Single Circular Close ('×') FAB positioned cleanly in the exact '+' slot */}
              <motion.button
                type="button"
                data-no-press-scale="true"
                data-motion-anim="true"
                initial={{ opacity: 0, scale: 0.86, rotate: -45 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: 0,
                  transition: { duration: 0.15, ease: FORM_EASE },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.86,
                  rotate: -45,
                  transition: { duration: 0.11, ease: FORM_EXIT_EASE, delay: 0.02 },
                }}
                whileTap={{ scale: 0.92 }}
                transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                onClick={() => {
                  haptics.light();
                  onClose();
                }}
                aria-label="Close Quick Create"
                title="Close"
                className="pointer-events-auto w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/35 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
