import React from 'react';
import { ScheduleItem } from '../../types';
import { TaskFormModal } from '../tasks/TaskFormModal';

interface ScheduleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialHour?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialIsAllDay?: boolean;
  editingItem?: ScheduleItem | null;
  onSwitchToTask?: () => void;
  onSwitchToHabit?: () => void;
  onSwitchToGoal?: () => void;
  onSwitchToMed?: () => void;
  onSwitchToBill?: () => void;
}

export const ScheduleEventModal: React.FC<ScheduleEventModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialHour,
  initialStartTime,
  initialEndTime,
  initialIsAllDay,
  editingItem,
  onSwitchToHabit,
  onSwitchToGoal,
  onSwitchToMed,
  onSwitchToBill,
}) => {
  if (!isOpen) return null;

  return (
    <TaskFormModal
      isOpen={isOpen}
      onClose={onClose}
      initialMode="event"
      eventToEdit={editingItem || null}
      defaultDate={initialDate}
      initialHour={initialHour}
      defaultStartTime={initialStartTime}
      defaultEndTime={initialEndTime}
      defaultIsAllDay={initialIsAllDay}
      onSwitchToHabit={onSwitchToHabit}
      onSwitchToGoal={onSwitchToGoal}
      onSwitchToMed={onSwitchToMed}
      onSwitchToBill={onSwitchToBill}
    />
  );
};
