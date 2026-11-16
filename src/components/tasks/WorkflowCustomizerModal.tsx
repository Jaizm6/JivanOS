import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkflowStage } from '../../types';

interface WorkflowCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStageForEdit?: (stage: WorkflowStage) => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#64748b', // Slate
];

export const WorkflowCustomizerModal: React.FC<WorkflowCustomizerModalProps> = ({ isOpen, onClose }) => {
  const {
    workflowStages,
    addWorkflowStage,
    updateWorkflowStage,
    deleteWorkflowStage,
    setWorkflowStages,
    tasks,
    updateTask,
  } = useApp();

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');

  // Add new stage fields
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');
  const [showAddForm, setShowAddForm] = useState(false);

  // Deletion confirm state
  const [stageToDelete, setStageToDelete] = useState<WorkflowStage | null>(null);

  if (!isOpen) return null;

  const sortedStages = [...workflowStages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleStartEdit = (stage: WorkflowStage) => {
    setEditingStageId(stage.id);
    setEditLabel(stage.label);
    setEditColor(stage.color);
  };

  const handleSaveEdit = (stageId: string) => {
    if (!editLabel.trim()) return;
    const current = workflowStages.find(s => s.id === stageId);
    updateWorkflowStage({
      id: stageId,
      label: editLabel.trim(),
      color: editColor,
      order: current?.order,
    });
    setEditingStageId(null);
  };

  const handleAddNewStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    addWorkflowStage({
      label: newStageName.trim(),
      color: newStageColor,
      order: sortedStages.length,
    });
    setNewStageName('');
    setShowAddForm(false);
  };

  const handleMoveStage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedStages.length) return;

    const newStages = [...sortedStages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    // Update orders
    const updated = newStages.map((s, idx) => ({ ...s, order: idx }));
    setWorkflowStages(updated);
  };

  const handleConfirmDelete = () => {
    if (!stageToDelete) return;
    // Find fallback stage (first stage that isn't the deleted one)
    const fallbackStage = sortedStages.find(s => s.id !== stageToDelete.id);
    if (fallbackStage) {
      // Reassign all tasks from the deleted stage to fallback
      tasks
        .filter(t => t.status === stageToDelete.id)
        .forEach(t => {
          updateTask({
            ...t,
            status: fallbackStage.id as any,
          });
        });
    }

    deleteWorkflowStage(stageToDelete.id);
    setStageToDelete(null);
  };

  const handleResetDefaults = () => {
    const defaults: WorkflowStage[] = [
      { id: 'todo', label: 'To Do', color: '#64748b', order: 0 },
      { id: 'in_progress', label: 'In Progress', color: '#6366f1', order: 1 },
      { id: 'review', label: 'In Review', color: '#f59e0b', order: 2 },
      { id: 'done', label: 'Completed', color: '#10b981', order: 3 },
    ];
    setWorkflowStages(defaults);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Customize Workflow Stages
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tailor your Kanban board columns, rename stages, choose accents, and reorder.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stages List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
            <span>Current Workflow Stages ({sortedStages.length})</span>
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              title="Reset stages to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {sortedStages.map((stage, idx) => {
            const isEditing = editingStageId === stage.id;
            const stageTaskCount = tasks.filter(t => (t.status || 'todo') === stage.id).length;

            return (
              <div
                key={stage.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 transition"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="Stage name"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(stage.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => setEditingStageId(null)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Color Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 mr-1">Accent:</span>
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            editColor === c ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: stage.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {stage.label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                            {stageTaskCount} {stageTaskCount === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {/* Reorder Left */}
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveStage(idx, 'left')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 hover:bg-white dark:hover:bg-slate-700 transition"
                        title="Move stage earlier"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Reorder Right */}
                      <button
                        disabled={idx === sortedStages.length - 1}
                        onClick={() => handleMoveStage(idx, 'right')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 hover:bg-white dark:hover:bg-slate-700 transition"
                        title="Move stage later"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleStartEdit(stage)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition"
                        title="Rename or change color"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        disabled={sortedStages.length <= 1}
                        onClick={() => setStageToDelete(stage)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-20 hover:bg-white dark:hover:bg-slate-700 transition"
                        title="Delete stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Stage Form / Toggle */}
        {showAddForm ? (
          <form
            onSubmit={handleAddNewStage}
            className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3"
          >
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
              Add New Stage
            </h4>
            <input
              type="text"
              required
              placeholder="e.g. Blocked, QA Testing, Deployed"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Choose Color:</span>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewStageColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newStageColor === c ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
              >
                Add Stage
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Workflow Stage</span>
          </button>
        )}

        {/* Delete Confirmation Alert */}
        {stageToDelete && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Delete Stage: "{stageToDelete.label}"</span>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
              Any tasks currently in this column will be safely moved to your first stage. Are you sure you want to delete this column?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStageToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
              >
                Yes, Delete Stage
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
