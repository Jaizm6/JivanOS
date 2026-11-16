import React, { useState } from 'react';
import { diagnoseTaskSync, SyncResult } from '../../utils/TaskSyncDiagnostics';
import { TaskItem } from '../../types';
import { AlertCircle, CheckCircle, RefreshCw, X } from 'lucide-react';

interface TaskSyncDiagnosticPanelProps {
  tasks: TaskItem[];
  onClose: () => void;
}

export const TaskSyncDiagnosticPanel: React.FC<TaskSyncDiagnosticPanelProps> = ({ tasks, onClose }) => {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = async () => {
    setIsChecking(true);
    const res = await diagnoseTaskSync(tasks);
    setResult(res);
    setIsChecking(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Sync Diagnostics</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <button 
          onClick={runCheck}
          disabled={isChecking}
          className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
        >
          {isChecking ? <RefreshCw className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          Run Sync Check
        </button>

        {result && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 p-3 rounded-xl font-bold ${result.status === 'synced' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {result.status === 'synced' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              Sync Status: {result.status.toUpperCase()}
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              {result.logs.map((log, i) => (
                <div key={i} className={log.type === 'warn' ? 'text-rose-600' : 'text-slate-600'}>
                  {log.type === 'warn' ? '⚠️ ' : 'ℹ️ '} {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
