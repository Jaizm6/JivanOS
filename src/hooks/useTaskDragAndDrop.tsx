import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TaskItem, TaskStatus } from '../types';
import { soundEngine } from '../utils/audio';
import { haptics } from '../utils/haptics';

export interface UseTaskDragAndDropOptions {
  tasks: TaskItem[];
  onReorderTasks: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onDropOnStage?: (draggedId: string, stageId: string) => void;
  onDropOnQuadrant?: (draggedId: string, quadId: string) => void;
  onDropOnCategory?: (draggedId: string, categoryId: string) => void;
  onDropOnProject?: (draggedId: string, projectId: string) => void;
  onDropOnGoal?: (draggedId: string, goalId: string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export type DragAndDropContextType = ReturnType<typeof useTaskDragAndDrop>;

export function useTaskDragAndDrop({
  tasks,
  onReorderTasks,
  onDropOnStage,
  onDropOnQuadrant,
  onDropOnCategory,
  onDropOnProject,
  onDropOnGoal,
  onDragStateChange,
}: UseTaskDragAndDropOptions) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [dragOverQuadrantId, setDragOverQuadrantId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dragOverGoalId, setDragOverGoalId] = useState<string | null>(null);

  // Mobile Touch Drag State
  const [touchGhostPos, setTouchGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [draggedTaskTitle, setDraggedTaskTitle] = useState<string | null>(null);

  const wasDraggingRef = useRef(false);
  const touchSessionRef = useRef<{
    active: boolean;
    taskId: string;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  const resetDragState = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDropPosition('before');
    setDragOverStageId(null);
    setDragOverCategory(null);
    setDragOverProjectId(null);
    setDragOverGoalId(null);
    setTouchGhostPos(null);
    setDraggedTaskTitle(null);
    touchSessionRef.current = null;
    onDragStateChange?.(false);
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 280);
  }, [onDragStateChange]);

  // HTML5 Native Drag & Drop Handlers (Desktop Mouse)
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string, taskTitle?: string) => {
    wasDraggingRef.current = true;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.setData('text', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
    setDraggedTaskTitle(taskTitle || null);
    onDragStateChange?.(true);
    haptics.light?.();
  }, [onDragStateChange]);

  const handleDragOverTask = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetId) return;
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';

    if (dragOverTaskId !== targetId || dropPosition !== pos) {
      setDragOverTaskId(targetId);
      setDropPosition(pos);
    }
  }, [draggedTaskId, dragOverTaskId, dropPosition]);

  const handleDragLeaveTask = useCallback((e: React.DragEvent, targetId: string) => {
    const currentTarget = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as Node | null;
    if (!related || !currentTarget.contains(related)) {
      if (dragOverTaskId === targetId) {
        setDragOverTaskId(null);
      }
    }
  }, [dragOverTaskId]);

  const handleDropOnTask = useCallback((e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId && draggedId !== targetTaskId) {
      const targetTask = tasks.find(t => t.id === targetTaskId);
      const draggedTask = tasks.find(t => t.id === draggedId);
      if (draggedTask && targetTask) {
        if (targetTask.status && draggedTask.status !== targetTask.status) {
          onDropOnStage?.(draggedId, targetTask.status);
        }
        const targetQuad = targetTask.quadrant || (targetTask.priority === 'high' ? 'urgent_important' : targetTask.priority === 'medium' ? 'not_urgent_important' : 'not_urgent_not_important');
        const draggedQuad = draggedTask.quadrant || (draggedTask.priority === 'high' ? 'urgent_important' : draggedTask.priority === 'medium' ? 'not_urgent_important' : 'not_urgent_not_important');
        if (draggedQuad !== targetQuad) {
          onDropOnQuadrant?.(draggedId, targetQuad);
        }
      }
      onReorderTasks(draggedId, targetTaskId, dropPosition);
      soundEngine?.playClick?.();
      haptics.toggle?.();
    }
    resetDragState();
  }, [draggedTaskId, dropPosition, tasks, onReorderTasks, onDropOnStage, onDropOnQuadrant, resetDragState]);

  const handleDropOnStage = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId) {
      onDropOnStage?.(draggedId, stageId);
      soundEngine?.playSuccessChime?.();
      haptics.complete?.();
    }
    resetDragState();
  }, [draggedTaskId, onDropOnStage, resetDragState]);

  const handleDropOnQuadrant = useCallback((e: React.DragEvent, quadId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId) {
      onDropOnQuadrant?.(draggedId, quadId);
      soundEngine?.playSuccessChime?.();
      haptics.complete?.();
    }
    resetDragState();
  }, [draggedTaskId, onDropOnQuadrant, resetDragState]);

  const handleDropOnCategory = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId) {
      onDropOnCategory?.(draggedId, catId);
      soundEngine?.playSuccessChime?.();
      haptics.complete?.();
    }
    resetDragState();
  }, [draggedTaskId, onDropOnCategory, resetDragState]);

  const handleDropOnProject = useCallback((e: React.DragEvent, projId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId) {
      onDropOnProject?.(draggedId, projId);
      soundEngine?.playSuccessChime?.();
      haptics.complete?.();
    }
    resetDragState();
  }, [draggedTaskId, onDropOnProject, resetDragState]);

  const handleDropOnGoal = useCallback((e: React.DragEvent, goalId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text') || draggedTaskId;
    if (draggedId) {
      onDropOnGoal?.(draggedId, goalId);
      soundEngine?.playSuccessChime?.();
      haptics.complete?.();
    }
    resetDragState();
  }, [draggedTaskId, onDropOnGoal, resetDragState]);

  // Touch Drag-and-Drop Handlers (Mobile Devices & Touch Screens)
  const handleTouchStart = useCallback((e: React.TouchEvent, taskId: string, taskTitle?: string) => {
    const touch = e.touches[0];
    if (!touch) return;

    touchSessionRef.current = {
      active: true,
      taskId,
      startX: touch.clientX,
      startY: touch.clientY,
      hasMoved: false,
    };

    setDraggedTaskId(taskId);
    setDraggedTaskTitle(taskTitle || null);
    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
  }, []);

  // Global Touch Move and Touch End listeners while dragging
  useEffect(() => {
    if (!draggedTaskId) return;

    const onGlobalTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !touchSessionRef.current?.active) return;

      const deltaX = Math.abs(touch.clientX - touchSessionRef.current.startX);
      const deltaY = Math.abs(touch.clientY - touchSessionRef.current.startY);

      if (deltaX > 4 || deltaY > 4) {
        touchSessionRef.current.hasMoved = true;
        wasDraggingRef.current = true;
        e.preventDefault(); // Prevent page scrolling during active item drag
      }

      setTouchGhostPos({ x: touch.clientX, y: touch.clientY });

      // Identify element underneath touch pointer
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!elem) return;

      // 1. Check for hovered task
      const taskContainer = elem.closest('[data-task-id]') as HTMLElement | null;
      if (taskContainer) {
        const targetId = taskContainer.getAttribute('data-task-id');
        if (targetId && targetId !== touchSessionRef.current.taskId) {
          const rect = taskContainer.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const pos = touch.clientY < midY ? 'before' : 'after';

          setDragOverTaskId(targetId);
          setDropPosition(pos);
          setDragOverStageId(null);
          setDragOverCategory(null);
          setDragOverProjectId(null);
          setDragOverGoalId(null);
          return;
        }
      }

      // 2. Check for hovered quadrant (Eisenhower Matrix)
      const quadContainer = elem.closest('[data-drop-type="quadrant"]') as HTMLElement | null;
      if (quadContainer) {
        const quadId = quadContainer.getAttribute('data-drop-id');
        if (quadId) {
          setDragOverQuadrantId(quadId);
          setDragOverTaskId(null);
          setDragOverStageId(null);
          setDragOverCategory(null);
          setDragOverProjectId(null);
          setDragOverGoalId(null);
          return;
        }
      }

      // 3. Check for hovered stage (Kanban)
      const stageContainer = elem.closest('[data-drop-type="stage"]') as HTMLElement | null;
      if (stageContainer) {
        const stageId = stageContainer.getAttribute('data-drop-id');
        if (stageId) {
          setDragOverStageId(stageId);
          setDragOverTaskId(null);
          setDragOverQuadrantId(null);
          setDragOverCategory(null);
          setDragOverProjectId(null);
          setDragOverGoalId(null);
          return;
        }
      }

      // 4. Check for hovered category
      const catContainer = elem.closest('[data-drop-type="category"]') as HTMLElement | null;
      if (catContainer) {
        const catId = catContainer.getAttribute('data-drop-id');
        if (catId) {
          setDragOverCategory(catId);
          setDragOverTaskId(null);
          setDragOverQuadrantId(null);
          setDragOverStageId(null);
          setDragOverProjectId(null);
          setDragOverGoalId(null);
          return;
        }
      }

      // 5. Check for hovered project
      const projContainer = elem.closest('[data-drop-type="project"]') as HTMLElement | null;
      if (projContainer) {
        const projId = projContainer.getAttribute('data-drop-id');
        if (projId) {
          setDragOverProjectId(projId);
          setDragOverTaskId(null);
          setDragOverQuadrantId(null);
          setDragOverStageId(null);
          setDragOverCategory(null);
          setDragOverGoalId(null);
          return;
        }
      }

      // 6. Check for hovered goal
      const goalContainer = elem.closest('[data-drop-type="goal"]') as HTMLElement | null;
      if (goalContainer) {
        const goalId = goalContainer.getAttribute('data-drop-id');
        if (goalId) {
          setDragOverGoalId(goalId);
          setDragOverTaskId(null);
          setDragOverQuadrantId(null);
          setDragOverStageId(null);
          setDragOverCategory(null);
          setDragOverProjectId(null);
          return;
        }
      }

      // If over neutral background
      setDragOverTaskId(null);
      setDragOverQuadrantId(null);
      setDragOverStageId(null);
      setDragOverCategory(null);
      setDragOverProjectId(null);
      setDragOverGoalId(null);
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      const session = touchSessionRef.current;
      if (!session || !session.active || !session.hasMoved) {
        resetDragState();
        return;
      }

      const draggedId = session.taskId;

      if (dragOverTaskId && dragOverTaskId !== draggedId) {
        const targetTask = tasks.find(t => t.id === dragOverTaskId);
        const draggedTask = tasks.find(t => t.id === draggedId);
        if (draggedTask && targetTask) {
          if (targetTask.status && draggedTask.status !== targetTask.status) {
            onDropOnStage?.(draggedId, targetTask.status);
          }
          const targetQuad = targetTask.quadrant || (targetTask.priority === 'high' ? 'urgent_important' : targetTask.priority === 'medium' ? 'not_urgent_important' : 'not_urgent_not_important');
          const draggedQuad = draggedTask.quadrant || (draggedTask.priority === 'high' ? 'urgent_important' : draggedTask.priority === 'medium' ? 'not_urgent_important' : 'not_urgent_not_important');
          if (draggedQuad !== targetQuad) {
            onDropOnQuadrant?.(draggedId, targetQuad);
          }
        }
        onReorderTasks(draggedId, dragOverTaskId, dropPosition);
        soundEngine?.playClick?.();
        haptics.toggle?.();
      } else if (dragOverQuadrantId) {
        onDropOnQuadrant?.(draggedId, dragOverQuadrantId);
        soundEngine?.playSuccessChime?.();
        haptics.complete?.();
      } else if (dragOverStageId) {
        onDropOnStage?.(draggedId, dragOverStageId);
        soundEngine?.playSuccessChime?.();
        haptics.complete?.();
      } else if (dragOverCategory) {
        onDropOnCategory?.(draggedId, dragOverCategory);
        soundEngine?.playSuccessChime?.();
        haptics.complete?.();
      } else if (dragOverProjectId) {
        onDropOnProject?.(draggedId, dragOverProjectId);
        soundEngine?.playSuccessChime?.();
        haptics.complete?.();
      } else if (dragOverGoalId) {
        onDropOnGoal?.(draggedId, dragOverGoalId);
        soundEngine?.playSuccessChime?.();
        haptics.complete?.();
      }

      resetDragState();
    };

    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd, { passive: true });
    window.addEventListener('touchcancel', resetDragState, { passive: true });

    return () => {
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', resetDragState);
    };
  }, [
    draggedTaskId,
    dragOverTaskId,
    dropPosition,
    dragOverStageId,
    dragOverCategory,
    dragOverProjectId,
    dragOverGoalId,
    onReorderTasks,
    onDropOnStage,
    onDropOnCategory,
    onDropOnProject,
    onDropOnGoal,
    resetDragState,
  ]);

  // Prop Generators for uniform DX across all task cards & views
  const [activeDragHandleId, setActiveDragHandleId] = useState<string | null>(null);

  const getTaskItemProps = useCallback((taskId: string, title?: string) => ({
    id: `task-${taskId}`,
    'data-task-id': taskId,
    draggable: true,
    onDragStart: (e: React.DragEvent) => handleDragStart(e, taskId, title),
    onDragEnd: () => resetDragState(),
    onDragOver: (e: React.DragEvent) => handleDragOverTask(e, taskId),
    onDragLeave: (e: React.DragEvent) => handleDragLeaveTask(e, taskId),
    onDrop: (e: React.DragEvent) => handleDropOnTask(e, taskId),
  }), [handleDragStart, resetDragState, handleDragOverTask, handleDragLeaveTask, handleDropOnTask]);

  const getGripHandleProps = useCallback((taskId: string, title?: string) => ({
    onMouseDown: (e: React.MouseEvent) => {
      setActiveDragHandleId(taskId);
    },
    onMouseUp: () => {
      setActiveDragHandleId(null);
    },
    onMouseLeave: () => {
      if (!draggedTaskId) setActiveDragHandleId(null);
    },
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      handleDragStart(e, taskId, title);
    },
    onDragEnd: () => {
      setActiveDragHandleId(null);
      resetDragState();
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation();
      setActiveDragHandleId(taskId);
      handleTouchStart(e, taskId, title);
    },
    className: 'cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center shrink-0 transition-all',
    title: 'Hold grey border handle to drag & drop / reorder',
  }), [handleDragStart, resetDragState, handleTouchStart, draggedTaskId]);

  const getStageDropProps = useCallback((stageId: string) => ({
    'data-drop-type': 'stage',
    'data-drop-id': stageId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverStageId !== stageId) setDragOverStageId(stageId);
    },
    onDragLeave: () => {
      if (dragOverStageId === stageId) setDragOverStageId(null);
    },
    onDrop: (e: React.DragEvent) => handleDropOnStage(e, stageId),
  }), [dragOverStageId, handleDropOnStage]);

  const getQuadrantDropProps = useCallback((quadId: string) => ({
    'data-drop-type': 'quadrant',
    'data-drop-id': quadId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverQuadrantId !== quadId) setDragOverQuadrantId(quadId);
    },
    onDragLeave: (e: React.DragEvent) => {
      const currentTarget = e.currentTarget as HTMLElement;
      const related = e.relatedTarget as Node | null;
      if (!related || !currentTarget.contains(related)) {
        if (dragOverQuadrantId === quadId) setDragOverQuadrantId(null);
      }
    },
    onDrop: (e: React.DragEvent) => handleDropOnQuadrant(e, quadId),
  }), [dragOverQuadrantId, handleDropOnQuadrant]);

  const getCategoryDropProps = useCallback((catId: string) => ({
    'data-drop-type': 'category',
    'data-drop-id': catId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverCategory !== catId) setDragOverCategory(catId);
    },
    onDragLeave: () => {
      if (dragOverCategory === catId) setDragOverCategory(null);
    },
    onDrop: (e: React.DragEvent) => handleDropOnCategory(e, catId),
  }), [dragOverCategory, handleDropOnCategory]);

  const getProjectDropProps = useCallback((projId: string) => ({
    'data-drop-type': 'project',
    'data-drop-id': projId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverProjectId !== projId) setDragOverProjectId(projId);
    },
    onDragLeave: () => {
      if (dragOverProjectId === projId) setDragOverProjectId(null);
    },
    onDrop: (e: React.DragEvent) => handleDropOnProject(e, projId),
  }), [dragOverProjectId, handleDropOnProject]);

  const getGoalDropProps = useCallback((goalId: string) => ({
    'data-drop-type': 'goal',
    'data-drop-id': goalId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverGoalId !== goalId) setDragOverGoalId(goalId);
    },
    onDragLeave: () => {
      if (dragOverGoalId === goalId) setDragOverGoalId(null);
    },
    onDrop: (e: React.DragEvent) => handleDropOnGoal(e, goalId),
  }), [dragOverGoalId, handleDropOnGoal]);

  return {
    draggedTaskId,
    dragOverTaskId,
    dropPosition,
    dragOverStageId,
    dragOverQuadrantId,
    dragOverCategory,
    dragOverProjectId,
    dragOverGoalId,
    isDragging: !!draggedTaskId,
    touchGhostPos,
    draggedTaskTitle,
    wasDraggingRef,
    resetDragState,
    getTaskItemProps,
    getGripHandleProps,
    getStageDropProps,
    getQuadrantDropProps,
    getCategoryDropProps,
    getProjectDropProps,
    getGoalDropProps,
  };
}

// Floating Touch Drag Ghost Component (Mobile & Touch Viewport)
export const TouchDragGhost: React.FC<{
  pos: { x: number; y: number } | null;
  title: string | null;
}> = ({ pos, title }) => {
  if (!pos || !title) return null;

  return (
    <div
      style={{
        left: pos.x,
        top: pos.y - 32,
      }}
      className="fixed z-9999 pointer-events-none -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-2xl border border-indigo-400/80 flex items-center gap-2 max-w-[240px] truncate animate-in fade-in zoom-in-95 duration-100"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <span className="truncate">{title}</span>
    </div>
  );
};
