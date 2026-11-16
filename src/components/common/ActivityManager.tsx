import React, { useState, useEffect } from 'react';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { HabitFormModal } from '../habits/HabitFormModal';
import { GoalEditModal } from '../goals/GoalEditModal';
import { BillFormModal } from '../bills/BillFormModal';
import { MedicationFormModal } from '../medications/MedicationFormModal';

export type ActivityType =
  | 'task'
  | 'habit'
  | 'goal'
  | 'medication'
  | 'med'
  | 'bill'
  | 'bills'
  | 'event';

export interface ActivityManagerProps {
  isOpen: boolean;
  onClose: () => void;
  type?: ActivityType;
  initialType?: ActivityType;
  activityToEdit?: any;
  initialData?: any;
  defaultDate?: string;
}

export const ActivityManager: React.FC<ActivityManagerProps> = ({
  isOpen,
  onClose,
  type,
  initialType = 'task',
  activityToEdit,
  initialData,
  defaultDate,
}) => {
  const resolvedType = type || initialType;
  const [activeType, setActiveType] = useState<ActivityType>(resolvedType);

  useEffect(() => {
    if (isOpen) {
      setActiveType(type || initialType);
    }
  }, [isOpen, type, initialType]);

  const prefill = activityToEdit || initialData || {};

  // 1. Task or Event (Unified TaskFormModal with Task | Event switcher)
  if (activeType === 'task' || activeType === 'event') {
    const isEditingExistingTask = Boolean(
      activityToEdit && activityToEdit.id && activeType === 'task'
    );
    const isEditingExistingEvent = Boolean(
      activityToEdit && activityToEdit.id && activeType === 'event'
    );

    return (
      <TaskFormModal
        isOpen={isOpen}
        onClose={onClose}
        editingTask={isEditingExistingTask ? activityToEdit : null}
        editingEvent={isEditingExistingEvent ? activityToEdit : null}
        initialMode={activeType === 'event' ? 'event' : 'task'}
        initialTitle={prefill.title || prefill.name || ''}
        initialSubtasks={Array.isArray(prefill.subtasks) ? prefill.subtasks : []}
        defaultPriority={prefill.priority || 'medium'}
        defaultDueDate={prefill.dueDate || prefill.date || defaultDate}
        defaultStartTime={prefill.startTime}
        defaultEndTime={prefill.endTime}
        defaultIsAllDay={prefill.isAllDay}
        defaultQuadrant={prefill.quadrant || 'neither'}
        defaultGoalId={prefill.goalId || ''}
        onSwitchType={nextType => setActiveType(nextType)}
      />
    );
  }

  // 2. Habit (Unified HabitFormModal)
  if (activeType === 'habit') {
    const isEditingExistingHabit = Boolean(activityToEdit && activityToEdit.id);
    return (
      <HabitFormModal
        isOpen={isOpen}
        onClose={onClose}
        editingHabit={isEditingExistingHabit ? activityToEdit : null}
        defaultGoalId={prefill.goalId || ''}
        onSwitchType={nextType => setActiveType(nextType)}
      />
    );
  }

  // 3. Goal (Unified GoalEditModal)
  if (activeType === 'goal') {
    const isEditingExistingGoal = Boolean(activityToEdit && activityToEdit.id);
    return (
      <GoalEditModal
        isOpen={isOpen}
        onClose={onClose}
        goal={isEditingExistingGoal ? activityToEdit : null}
        initialTitle={prefill.title || ''}
        initialTargetDate={prefill.targetDate || defaultDate}
        initialMilestones={Array.isArray(prefill.milestones) ? prefill.milestones : []}
      />
    );
  }

  // 4. Bill / Utility (Unified BillFormModal)
  if (activeType === 'bill' || activeType === 'bills') {
    const isEditingExistingBill = Boolean(activityToEdit && activityToEdit.id);
    return (
      <BillFormModal
        isOpen={isOpen}
        onClose={onClose}
        editingBill={isEditingExistingBill ? activityToEdit : null}
        initialTitle={prefill.title || ''}
        initialAmount={prefill.amount}
        initialCategory={prefill.category || 'credit_card'}
        initialDueDate={prefill.dueDate || defaultDate}
      />
    );
  }

  // 5. Medication (Unified MedicationFormModal)
  if (activeType === 'medication' || activeType === 'med') {
    const isEditingExistingMed = Boolean(activityToEdit && activityToEdit.id);
    return (
      <MedicationFormModal
        isOpen={isOpen}
        onClose={onClose}
        editingMed={isEditingExistingMed ? activityToEdit : null}
      />
    );
  }

  return null;
};
