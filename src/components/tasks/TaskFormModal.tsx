import React, { useEffect, useRef } from 'react';
import { TaskForm, TaskFormProps } from './TaskForm';
import { TaskItem, Priority, EisenhowerQuadrant } from '../../types';
import { useApp } from '../../context/AppContext';

export interface TaskFormModalProps extends Partial<TaskFormProps> {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: TaskItem | null;
  defaultDate?: string;
  defaultStatus?: any;
  defaultQuadrant?: EisenhowerQuadrant;
  defaultCategory?: string;
  defaultPriority?: Priority;
  defaultProjectId?: string;
  defaultProject?: string;
  defaultGoalId?: string;
  defaultListId?: string;
  onSaveSuccess?: () => void;
  onSwitchToHabit?: () => void;
  onSwitchToEvent?: () => void;
  onSwitchToGoal?: () => void;
  onSwitchToMed?: () => void;
  onSwitchToBill?: () => void;
  onSwitchToJournal?: () => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialTask,
  onSubmit,
  onDelete,
  defaultDate,
  defaultStatus,
  defaultQuadrant,
  defaultCategory,
  defaultPriority,
  defaultProjectId,
  defaultProject,
  defaultGoalId,
  defaultListId,
  onSaveSuccess,
  showHeader = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addTask, updateTask, deleteTask } = useApp();

  // Prevent mobile keyboard from opening automatically on modal mount
  useEffect(() => {
    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve initial task data from taskToEdit or default props
  const resolvedInitialTask: Partial<TaskItem> = taskToEdit || initialTask || {
    dueDate: defaultDate || new Date().toISOString().split('T')[0],
    status: defaultStatus || 'todo',
    quadrant: defaultQuadrant || 'not_urgent_important',
    category: defaultCategory || 'General',
    priority: defaultPriority || 'high',
    projectId: defaultProjectId,
    project: defaultProject,
    goalId: defaultGoalId,
    listId: defaultListId,
  };

  const handleFormSubmit = (taskData: Partial<TaskItem>) => {
    if (onSubmit) {
      onSubmit(taskData);
      onSaveSuccess?.();
      onClose();
      return;
    }

    if (taskToEdit?.id) {
      updateTask({ ...taskToEdit, ...taskData } as TaskItem);
    } else {
      addTask({
        title: taskData.title || 'Untitled Task',
        status: taskData.status || 'todo',
        priority: taskData.priority || 'high',
        quadrant: taskData.quadrant || 'not_urgent_important',
        dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
        completed: false,
        subtasks: taskData.subtasks || [],
        checklist: taskData.checklist || taskData.subtasks || [],
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        recurring: 'none',
        category: taskData.category || 'General',
        ...taskData,
      } as any);
    }

    onSaveSuccess?.();
    onClose();
  };

  const handleFormDelete = (taskId: string) => {
    if (onDelete) {
      onDelete(taskId);
    } else {
      deleteTask(taskId);
    }
    onClose();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 h-[100svh] bg-black/60 dark:bg-black/85 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 focus:outline-none overflow-hidden"
    >
      <div className="w-full sm:max-w-md max-h-[78vh] sm:max-h-[88vh] bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border-0 sm:border sm:border-zinc-200 dark:sm:border-zinc-800 shadow-2xl overflow-hidden flex flex-col pb-safe">
        <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-1.5 sm:hidden shrink-0" />
        <TaskForm
          initialTask={resolvedInitialTask}
          onSubmit={handleFormSubmit}
          onDelete={taskToEdit?.id ? handleFormDelete : undefined}
          onClose={onClose}
          showHeader={showHeader}
        />
      </div>
    </div>
  );
};
