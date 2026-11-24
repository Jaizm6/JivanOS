import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskItem, Priority, EisenhowerQuadrant, ScheduleItem, TaskStatus } from '../../types';
import { TaskForm } from './TaskForm';
import { useApp } from '../../context/AppContext';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  CRISP_TRANSFORM_TEMPLATE,
  UNIFIED_MODAL_POSITION_CLASS,
  UNIFIED_FORM_SHEET_CLASS,
  useModalScrollLock,
} from '../common/FormPrimitives';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: TaskItem | null;
  editingTask?: TaskItem | null;
  eventToEdit?: ScheduleItem | null;
  editingEvent?: ScheduleItem | null;
  initialMode?: 'task' | 'event';
  initialTitle?: string;
  initialSubtasks?: string[];
  initialHour?: string;
  defaultListId?: string;
  defaultPriority?: Priority;
  defaultDate?: string;
  defaultDueDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultIsAllDay?: boolean;
  defaultStatus?: TaskStatus | string;
  defaultQuadrant?: EisenhowerQuadrant;
  defaultTags?: string[];
  defaultGoalId?: string;
  defaultCategory?: string;
  defaultProject?: string;
  defaultProjectId?: string;
  defaultIsSomeday?: boolean;
  defaultIsStarred?: boolean;
  onSaveSuccess?: () => void;
  onDeleteTask?: (id: string) => void;
  onSwitchType?: (type: 'habit' | 'event') => void;
  onSwitchToHabit?: () => void;
  onSwitchToEvent?: () => void;
  onSwitchToGoal?: () => void;
  onSwitchToMed?: () => void;
  onSwitchToBill?: () => void;
  zIndexClass?: string;
  onCreatedTask?: (task: TaskItem) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit = null,
  editingTask = null,
  eventToEdit = null,
  editingEvent = null,
  initialMode = 'task',
  initialTitle = '',
  initialSubtasks = [],
  initialHour,
  defaultListId,
  defaultPriority = 'medium',
  defaultDate,
  defaultDueDate,
  defaultStartTime,
  defaultEndTime,
  defaultIsAllDay = false,
  defaultStatus = 'todo',
  defaultQuadrant = 'neither',
  defaultTags = [],
  defaultGoalId = '',
  defaultCategory,
  defaultProject,
  defaultProjectId,
  defaultIsSomeday = false,
  defaultIsStarred = false,
  onSaveSuccess,
  onDeleteTask,
  onSwitchType,
  onSwitchToHabit,
  zIndexClass = 'z-[200]',
  onCreatedTask,
}) => {
  const { addTask, updateTask, deleteTask, addScheduleItem, updateScheduleItem, deleteScheduleItem, pushNotification } =
    useApp();

  const resolvedTask = taskToEdit || editingTask;
  const resolvedEvent = eventToEdit || editingEvent;
  const resolvedDate =
    defaultDueDate || defaultDate || new Date().toISOString().split('T')[0];

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

  const initialTaskObj: Partial<TaskItem> | undefined = resolvedTask
    ? resolvedTask
    : {
        title: initialTitle,
        subtasks: initialSubtasks.map((st, idx) => ({
          id: `st_${idx}_${Date.now()}`,
          title: st,
          completed: false,
        })),
        listId: defaultListId,
        priority: defaultPriority,
        dueDate: resolvedDate,
        dueTime: defaultStartTime,
        isAllDay: defaultIsAllDay,
        status: defaultStatus as TaskStatus,
        quadrant: defaultQuadrant,
        tags: defaultTags,
        goalId: defaultGoalId || undefined,
        category: defaultCategory,
        project: defaultProject || defaultProjectId,
        isSomeday: defaultIsSomeday,
        isStarred: defaultIsStarred,
      };

  const resolvedEventStartTime =
    defaultStartTime !== undefined
      ? defaultStartTime || '09:00'
      : initialHour
      ? initialHour.includes(':')
        ? initialHour
        : `${initialHour.padStart(2, '0')}:00`
      : '09:00';

  const resolvedEventEndTime = (() => {
    if (defaultEndTime) return defaultEndTime;
    const [hStr, mStr] = resolvedEventStartTime.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return '10:00';
    const endTotal = Math.min(23 * 60 + 55, h * 60 + m + 60);
    return `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
  })();

  const initialEventObj: Partial<ScheduleItem> | null = resolvedEvent
    ? resolvedEvent
    : initialMode === 'event'
    ? {
        title: initialTitle,
        date: resolvedDate,
        startTime: resolvedEventStartTime,
        endTime: resolvedEventEndTime,
        isAllDay: defaultIsAllDay,
        goalId: defaultGoalId || undefined,
      }
    : null;

  const handleSwitchToHabit =
    onSwitchToHabit || (onSwitchType ? () => onSwitchType('habit') : undefined);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="task-form-modal-root"
          data-unified-modal="true"
          className={`${UNIFIED_MODAL_POSITION_CLASS} ${zIndexClass}`}
        >
          {/* Separate GPU-light Backdrop Scrim */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
            onClick={onClose}
          />

          {/* Separate Composited Modal Sheet / Card */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
            exit={{ opacity: 0, y: 10, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
            transformTemplate={CRISP_TRANSFORM_TEMPLATE}
            onClick={e => e.stopPropagation()}
            className={UNIFIED_FORM_SHEET_CLASS}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/95 dark:bg-[#141418]/95 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
            </div>

            <TaskForm
              initialTask={initialTaskObj}
              initialEvent={initialEventObj}
              initialMode={resolvedEvent ? 'event' : initialMode}
              initialHour={initialHour}
              showHeader={true}
              onSwitchToHabit={handleSwitchToHabit}
              onSubmit={taskData => {
                if (resolvedTask && resolvedTask.id) {
                  updateTask({ ...resolvedTask, ...taskData } as TaskItem);
                } else {
                  const created = addTask({ ...taskData, completed: false } as Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>);
                  onCreatedTask?.(created);
                }
                onSaveSuccess?.();
                onClose();
              }}
              onSubmitEvent={eventData => {
                if (resolvedEvent && resolvedEvent.id) {
                  updateScheduleItem({ ...resolvedEvent, ...eventData } as ScheduleItem);
                } else {
                  addScheduleItem({ ...eventData, completed: false } as Omit<ScheduleItem, 'id' | 'createdAt'>);
                }
                onSaveSuccess?.();
                onClose();
              }}
              onDelete={
                resolvedTask && resolvedTask.id
                  ? id => {
                      if (onDeleteTask) {
                        onDeleteTask(id);
                      } else {
                        deleteTask(id);
                      }
                      onClose();
                    }
                  : undefined
              }
              onDeleteEvent={
                resolvedEvent && resolvedEvent.id
                  ? id => {
                      deleteScheduleItem(id);
                      onClose();
                    }
                  : undefined
              }
              onArchiveToggle={
                resolvedTask && resolvedTask.id
                  ? () => {
                      const wasArchived = Boolean(resolvedTask.archived || resolvedTask.status === 'archived');
                      updateTask({
                        ...resolvedTask,
                        archived: !wasArchived,
                        archivedAt: !wasArchived ? new Date().toISOString() : undefined,
                        status: wasArchived && resolvedTask.status === 'archived'
                          ? (resolvedTask.completed ? 'done' : 'todo')
                          : resolvedTask.status,
                      });
                      pushNotification(
                        wasArchived ? 'Task Restored' : 'Task Archived',
                        wasArchived
                          ? `"${resolvedTask.title}" moved back to your active tasks.`
                          : `"${resolvedTask.title}" moved to Archive.`,
                        'task'
                      );
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
