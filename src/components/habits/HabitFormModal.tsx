import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Habit } from '../../types';
import { HabitForm } from './HabitForm';
import { useApp } from '../../context/AppContext';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  UNIFIED_MODAL_POSITION_CLASS,
  UNIFIED_FORM_SHEET_CLASS,
  useModalScrollLock,
} from '../common/FormPrimitives';

export interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitToEdit?: Habit | null;
  editingHabit?: Habit | null;
  defaultGoalId?: string;
  defaultTags?: string[];
  defaultTimeOfDay?: Habit['targetTimeOfDay'];
  defaultColor?: string;
  onSwitchType?: (type: 'task' | 'event') => void;
  onSwitchToTask?: () => void;
  onSwitchToEvent?: () => void;
  zIndexClass?: string;
  onCreatedHabit?: (habit: Habit) => void;
}

export const HabitFormModal: React.FC<HabitFormModalProps> = ({
  isOpen,
  onClose,
  habitToEdit = null,
  editingHabit = null,
  defaultGoalId = '',
  defaultTags,
  defaultTimeOfDay,
  defaultColor,
  onSwitchType,
  onSwitchToTask,
  onSwitchToEvent,
  zIndexClass = 'z-[200]',
  onCreatedHabit,
}) => {
  const { addHabit, updateHabit, deleteHabit } = useApp();
  const resolvedHabit = habitToEdit || editingHabit;

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const initialHabitObj: Partial<Habit> | undefined = resolvedHabit
    ? resolvedHabit
    : (defaultGoalId || (defaultTags && defaultTags.length > 0) || defaultTimeOfDay || defaultColor)
    ? {
        ...(defaultGoalId ? { goalId: defaultGoalId } : {}),
        ...(defaultTags && defaultTags.length > 0 ? { tags: defaultTags } : {}),
        ...(defaultTimeOfDay ? { targetTimeOfDay: defaultTimeOfDay } : {}),
        ...(defaultColor ? { color: defaultColor, accentColor: defaultColor } : {}),
      }
    : undefined;

  const handleSwitchToTask =
    onSwitchToTask || (onSwitchType ? () => onSwitchType('task') : undefined);
  const handleSwitchToEvent =
    onSwitchToEvent || (onSwitchType ? () => onSwitchType('event') : undefined);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="habit-form-modal-root"
          data-unified-modal="true"
          className={`${UNIFIED_MODAL_POSITION_CLASS} ${zIndexClass}`}
        >
          {/* Separate GPU-light Backdrop Scrim */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
            onClick={onClose}
          />

          {/* Separate Composited Modal Sheet / Card */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
            exit={{ opacity: 0, y: 16, scale: 0.97, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
            className={UNIFIED_FORM_SHEET_CLASS}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/95 dark:bg-[#141418]/95 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
            </div>

            <HabitForm
              initialHabit={initialHabitObj}
              showHeader={true}
              onSwitchToTask={handleSwitchToTask}
              onSwitchToEvent={handleSwitchToEvent}
              onSubmit={habitData => {
                if (resolvedHabit && resolvedHabit.id) {
                  updateHabit({ ...resolvedHabit, ...habitData } as Habit);
                } else {
                  const created = addHabit(
                    habitData as Omit<
                      Habit,
                      'id' | 'currentStreak' | 'bestStreak' | 'completionHistory' | 'createdAt'
                    >
                  );
                  onCreatedHabit?.(created);
                }
                onClose();
              }}
              onDelete={
                resolvedHabit && resolvedHabit.id
                  ? id => {
                      deleteHabit(id);
                      onClose();
                    }
                  : undefined
              }
              onClose={onClose}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
