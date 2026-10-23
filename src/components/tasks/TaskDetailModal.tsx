import React from 'react';
import { TaskItem } from '../../types';
import { TaskFormModal } from './TaskFormModal';

export interface TaskDetailModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: TaskItem) => void;
  onDelete?: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => void;
  onToggleStar?: (taskId: string) => void;
  onUpdateTask?: (task: TaskItem) => void;
  onStartPomodoro?: (taskId: string) => void;
  onPausePomodoro?: () => void;
  isPomodoroRunning?: boolean;
  activePomodoroTaskId?: string | null;
  soundEngine?: any;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !task) return null;

  return (
    <TaskFormModal
      isOpen={isOpen}
      taskToEdit={task}
      onClose={onClose}
      onSaveSuccess={onClose}
    />
  );
};
