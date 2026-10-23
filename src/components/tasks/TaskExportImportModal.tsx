import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  Check,
  AlertCircle,
  X,
  FileCode,
  Sparkles,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';
import { TaskItem, Priority, TaskStatus, EisenhowerQuadrant } from '../../types';
import { useApp } from '../../context/AppContext';
import { soundEngine } from '../../utils/audio';

interface TaskExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskExportImportModal: React.FC<TaskExportImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tasks, addTask, setTasks, setActiveTab } = useApp();

  // Import states
  const [importedTasks, setImportedTasks] = useState<TaskItem[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // PARSE FILE ON UPLOAD
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccessCount(null);
    setImportFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('File is empty.');

        if (file.name.endsWith('.json') || file.type === 'application/json') {
          parseJSONContent(content);
        } else if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') {
          parseCSVContent(content);
        } else {
          // Attempt JSON first, fallback to CSV
          try {
            parseJSONContent(content);
          } catch {
            parseCSVContent(content);
          }
        }
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse file.');
        setImportedTasks([]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read file.');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const parseJSONContent = (text: string) => {
    const parsed = JSON.parse(text);
    const rawList = Array.isArray(parsed) ? parsed : parsed.tasks || parsed.items || [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new Error('Valid tasks array not found in JSON file.');
    }

    const today = new Date().toISOString().split('T')[0];
    const normalized: TaskItem[] = rawList.map((item: any, idx: number) => {
      return {
        id: item.id || `imported-${Date.now()}-${idx}`,
        title: item.title || item.name || 'Untitled Task',
        notes: item.notes || item.description || '',
        priority: (['P1', 'P2', 'P3', 'P4'].includes(item.priority) ? item.priority : 'P2') as Priority,
        status: (item.status || 'todo') as TaskStatus,
        quadrant: (item.quadrant || 'not_urgent_important') as EisenhowerQuadrant,
        project: item.project || 'Personal',
        category: item.category || 'work',
        dueDate: item.dueDate || item.due || today,
        dueTime: item.dueTime || item.time || undefined,
        isAllDay: item.isAllDay ?? false,
        completed: Boolean(item.completed || item.isCompleted || item.done),
        subtasks: Array.isArray(item.subtasks)
          ? item.subtasks.map((st: any, sIdx: number) => ({
              id: st.id || `st-${idx}-${sIdx}`,
              title: typeof st === 'string' ? st : st.title || 'Subtask',
              completed: typeof st === 'object' ? Boolean(st.completed) : false,
            }))
          : [],
        estimatedPomodoros: item.estimatedPomodoros || 1,
        completedPomodoros: item.completedPomodoros || 0,
        recurring: item.recurring || item.repeatType || 'none',
        repeatType: item.repeatType || item.recurring || 'none',
        reminderType: item.reminderType || (item.alerts?.length ? 'notification' : undefined),
        createdAt: item.createdAt || new Date().toISOString(),
      };
    });

    setImportedTasks(normalized);
  };

  // Robust RFC-4180 CSV parser
  const parseCSVContent = (text: string) => {
    const lines: string[] = [];
    let curLine = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        curLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (curLine.trim()) lines.push(curLine);
        curLine = '';
      } else {
        curLine += char;
      }
    }
    if (curLine.trim()) lines.push(curLine);

    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const splitCSVLine = (lineStr: string): string[] => {
      const values: string[] = [];
      let curVal = '';
      let quotes = false;

      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"') {
          if (quotes && lineStr[i + 1] === '"') {
            curVal += '"';
            i++;
          } else {
            quotes = !quotes;
          }
        } else if (char === ',' && !quotes) {
          values.push(curVal.trim());
          curVal = '';
        } else {
          curVal += char;
        }
      }
      values.push(curVal.trim());
      return values;
    };

    const header = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const today = new Date().toISOString().split('T')[0];

    const titleIdx = header.findIndex(h => h.includes('title') || h.includes('task') || h.includes('name'));
    const prioIdx = header.findIndex(h => h.includes('priority'));
    const statusIdx = header.findIndex(h => h.includes('status'));
    const dueIdx = header.findIndex(h => h.includes('duedate') || h.includes('due') || h.includes('date'));
    const timeIdx = header.findIndex(h => h.includes('time') || h.includes('duetime'));
    const completedIdx = header.findIndex(h => h.includes('completed') || h.includes('done'));
    const categoryIdx = header.findIndex(h => h.includes('category'));
    const projectIdx = header.findIndex(h => h.includes('project'));
    const notesIdx = header.findIndex(h => h.includes('note') || h.includes('description'));
    const subtaskIdx = header.findIndex(h => h.includes('subtask'));

    if (titleIdx === -1) {
      throw new Error('CSV file must have a "Title" or "Task" column.');
    }

    const parsedTasks: TaskItem[] = [];

    for (let r = 1; r < lines.length; r++) {
      const row = splitCSVLine(lines[r]);
      const title = row[titleIdx];
      if (!title) continue;

      const priorityRaw = prioIdx !== -1 ? row[prioIdx]?.toLowerCase().trim() : 'medium';
      let priority: Priority = 'medium';
      if (priorityRaw === 'high' || priorityRaw === 'p1' || priorityRaw === '1') {
        priority = 'high';
      } else if (priorityRaw === 'low' || priorityRaw === 'p3' || priorityRaw === 'p4' || priorityRaw === '3' || priorityRaw === '4') {
        priority = 'low';
      } else {
        priority = 'medium';
      }
      const isCompleted = completedIdx !== -1 && (row[completedIdx]?.toLowerCase() === 'yes' || row[completedIdx]?.toLowerCase() === 'true' || row[completedIdx] === '1');

      let subtasks: { id: string; title: string; completed: boolean }[] = [];
      if (subtaskIdx !== -1 && row[subtaskIdx]) {
        const parts = row[subtaskIdx].split(';');
        subtasks = parts.map((p, pIdx) => ({
          id: `st-imp-${r}-${pIdx}`,
          title: p.replace(/^\[[ xX]\]\s*/, '').trim(),
          completed: p.startsWith('[x]') || p.startsWith('[X]'),
        }));
      }

      parsedTasks.push({
        id: `csv-imp-${Date.now()}-${r}`,
        title,
        priority,
        status: isCompleted ? 'done' : ((statusIdx !== -1 && row[statusIdx]) || 'todo') as TaskStatus,
        quadrant: priority === 'high' ? 'urgent_important' : 'not_urgent_important',
        project: (projectIdx !== -1 && row[projectIdx]) || 'Personal',
        category: (categoryIdx !== -1 && row[categoryIdx]) || 'work',
        dueDate: (dueIdx !== -1 && row[dueIdx]) || today,
        dueTime: (timeIdx !== -1 && row[timeIdx]) || undefined,
        completed: isCompleted,
        notes: (notesIdx !== -1 && row[notesIdx]) || '',
        subtasks,
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        recurring: 'none',
        createdAt: new Date().toISOString(),
      });
    }

    if (parsedTasks.length === 0) {
      throw new Error('No valid task rows could be extracted from this CSV file.');
    }

    setImportedTasks(parsedTasks);
  };

  // APPLY IMPORT
  const handleApplyImport = () => {
    if (importedTasks.length === 0) return;

    if (importMode === 'replace') {
      if (window.confirm(`Are you sure you want to REPLACE all existing ${tasks.length} tasks with ${importedTasks.length} imported tasks?`)) {
        setTasks(importedTasks);
        setImportSuccessCount(importedTasks.length);
        soundEngine.playSuccessChime();
        setTimeout(() => onClose(), 1500);
      }
    } else {
      // Merge mode
      let added = 0;
      const existingIds = new Set(tasks.map(t => t.id));
      const newTasks = [...tasks];

      importedTasks.forEach(imp => {
        if (!existingIds.has(imp.id)) {
          newTasks.push(imp);
          existingIds.add(imp.id);
          added++;
        } else {
          // generate unique ID
          newTasks.push({ ...imp, id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` });
          added++;
        }
      });

      setTasks(newTasks);
      setImportSuccessCount(added);
      soundEngine.playSuccessChime();
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import Tasks &amp; Restore
              </h3>
              <p className="text-xs text-slate-400">
                Restore tasks from JSON, CSV, or OmniLifeOS backup files
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export notice pointing to Settings */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Download className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Need to <strong>export</strong> tasks to Super Productivity, Todoist, or Google Tasks?</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setActiveTab('settings');
            }}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-bold transition shrink-0 cursor-pointer text-[11px]"
          >
            Open Settings Export Hub &rarr;
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="space-y-4">
              {/* File upload drag drop zone */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,.csv"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-3xl text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/30 group"
              >
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mx-auto mb-2 transition" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  {importFileName ? importFileName : 'Click to select or drop a JSON or CSV file'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports OmniLifeOS backups (.json) and standard spreadsheets (.csv)
                </p>
              </div>

              {isProcessing && (
                <div className="text-center py-2 text-xs font-semibold text-indigo-500 animate-pulse">
                  Parsing task file...
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccessCount !== null && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Successfully imported {importSuccessCount} tasks into your workspace!</span>
                </div>
              )}

              {importedTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Parsed {importedTasks.length} tasks from file
                    </span>

                    {/* Mode selector */}
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          importMode === 'merge'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Merge
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          importMode === 'replace'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Replace
                      </button>
                    </div>
                  </div>

                  {/* Preview sample list */}
                  <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {importedTasks.slice(0, 5).map((t, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {t.title}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            {t.dueDate || 'No date'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {t.priority}
                        </span>
                      </div>
                    ))}
                    {importedTasks.length > 5 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 italic">
                        + {importedTasks.length - 5} more tasks
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Import {importedTasks.length} Tasks Now ({importMode === 'merge' ? 'Merge' : 'Replace'})</span>
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};
