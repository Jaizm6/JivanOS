import React, { useState } from 'react';
import { TaskItem } from '../../types';
import { AlertTriangle, Check, X, GitMerge, ShieldAlert } from 'lucide-react';

interface TaskConflictModalProps {
  isOpen: boolean;
  localTask: TaskItem;
  serverTask: TaskItem;
  onResolve: (chosenTask: TaskItem) => void;
  onClose: () => void;
}

export const TaskConflictModal: React.FC<TaskConflictModalProps> = ({
  isOpen,
  localTask,
  serverTask,
  onResolve,
  onClose,
}) => {
  const [fieldChoices, setFieldChoices] = useState<{
    title: 'local' | 'server';
    notes: 'local' | 'server';
    priority: 'local' | 'server';
    status: 'local' | 'server';
    quadrant: 'local' | 'server';
    dueDate: 'local' | 'server';
  }>({
    title: localTask.title !== serverTask.title ? 'local' : 'local',
    notes: localTask.notes !== serverTask.notes ? 'local' : 'local',
    priority: localTask.priority !== serverTask.priority ? 'local' : 'local',
    status: localTask.status !== serverTask.status ? 'local' : 'local',
    quadrant: localTask.quadrant !== serverTask.quadrant ? 'local' : 'local',
    dueDate: localTask.dueDate !== serverTask.dueDate ? 'local' : 'local',
  });

  if (!isOpen) return null;

  const handleMergeSave = () => {
    const merged: TaskItem = {
      ...localTask,
      title: fieldChoices.title === 'local' ? localTask.title : serverTask.title,
      notes: fieldChoices.notes === 'local' ? localTask.notes : serverTask.notes,
      priority: fieldChoices.priority === 'local' ? localTask.priority : serverTask.priority,
      status: fieldChoices.status === 'local' ? localTask.status : serverTask.status,
      quadrant: fieldChoices.quadrant === 'local' ? localTask.quadrant : serverTask.quadrant,
      dueDate: fieldChoices.dueDate === 'local' ? localTask.dueDate : serverTask.dueDate,
      updatedAt: new Date().toISOString(),
    };
    onResolve(merged);
  };

  const fieldsToCheck: { key: keyof typeof fieldChoices; label: string; localVal: any; serverVal: any }[] = [
    { key: 'title', label: 'Task Title', localVal: localTask.title, serverVal: serverTask.title },
    { key: 'notes', label: 'Notes', localVal: localTask.notes || 'None', serverVal: serverTask.notes || 'None' },
    { key: 'priority', label: 'Priority', localVal: localTask.priority, serverVal: serverTask.priority },
    { key: 'status', label: 'Workflow Status', localVal: localTask.status, serverVal: serverTask.status },
    { key: 'quadrant', label: 'Eisenhower Quadrant', localVal: localTask.quadrant, serverVal: serverTask.quadrant },
    { key: 'dueDate', label: 'Due Date', localVal: localTask.dueDate || 'No Date', serverVal: serverTask.dueDate || 'No Date' },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 my-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Sync Conflict Resolution</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This task was edited on another device simultaneously. Review the side-by-side diffs and merge or choose a version.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Diff Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Local Version Header */}
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between font-bold text-indigo-700 dark:text-indigo-300">
            <span>Your Local Version</span>
            <button
              onClick={() => onResolve(localTask)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] hover:bg-indigo-700 transition cursor-pointer"
            >
              Keep All Local
            </button>
          </div>

          {/* Server Version Header */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
            <span>Server (Other Device)</span>
            <button
              onClick={() => onResolve(serverTask)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] hover:bg-emerald-700 transition cursor-pointer"
            >
              Use All Server
            </button>
          </div>
        </div>

        {/* Field Diff Rows */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {fieldsToCheck.map(field => {
            const isDiff = String(field.localVal) !== String(field.serverVal);
            return (
              <div key={field.key} className={`p-3 rounded-2xl border ${isDiff ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{field.label}</span>
                  {isDiff && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">Diff Detected</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className={`p-2 rounded-xl border flex items-start gap-2 cursor-pointer transition ${fieldChoices[field.key] === 'local' ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input
                      type="radio"
                      name={field.key}
                      checked={fieldChoices[field.key] === 'local'}
                      onChange={() => setFieldChoices(prev => ({ ...prev, [field.key]: 'local' }))}
                      className="mt-0.5"
                    />
                    <div className="break-all font-medium text-slate-800 dark:text-slate-200">{String(field.localVal)}</div>
                  </label>

                  <label className={`p-2 rounded-xl border flex items-start gap-2 cursor-pointer transition ${fieldChoices[field.key] === 'server' ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input
                      type="radio"
                      name={field.key}
                      checked={fieldChoices[field.key] === 'server'}
                      onChange={() => setFieldChoices(prev => ({ ...prev, [field.key]: 'server' }))}
                      className="mt-0.5"
                    />
                    <div className="break-all font-medium text-slate-800 dark:text-slate-200">{String(field.serverVal)}</div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMergeSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
          >
            <GitMerge className="w-4 h-4" />
            <span>Apply Custom Merge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
