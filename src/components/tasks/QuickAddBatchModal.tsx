import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Calendar,
  Clock,
  Tag,
  Folder,
  Layers,
  CheckCircle2,
  ListPlus,
  HelpCircle,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { TaskItem, Priority, EisenhowerQuadrant, TaskStatus, DEFAULT_TASK_CATEGORIES } from '../../types';
import { useApp } from '../../context/AppContext';
import { EisenhowerIcon } from './TaskManager';

interface QuickAddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: string;
  defaultPriority?: Priority;
  defaultListId?: string;
}

interface ParsedTaskPreview {
  title: string;
  category: string;
  categoryObj: typeof DEFAULT_TASK_CATEGORIES[0];
  priority: Priority;
  quadrant: EisenhowerQuadrant;
  dueDate: string;
  dueTime?: string;
  tags: string[];
  estimatedPomodoros: number;
}

const QUADRANT_MAP: Record<Priority, EisenhowerQuadrant> = {
  high: 'urgent_important',
  medium: 'not_urgent_important',
  low: 'urgent_not_important',
};

export const QuickAddBatchModal: React.FC<QuickAddBatchModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'work',
  defaultPriority = 'medium',
  defaultListId = 'inbox',
}) => {
  const { batchAddTasks, todoLists, soundEngine, pushNotification } = useApp();

  const [batchText, setBatchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    defaultCategory !== 'all' ? defaultCategory : 'work'
  );
  const [selectedPriority, setSelectedPriority] = useState<Priority>(defaultPriority);
  const [selectedListId, setSelectedListId] = useState(
    defaultListId !== 'all' ? defaultListId : 'inbox'
  );
  const [selectedDueDate, setSelectedDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isStarred, setIsStarred] = useState(false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);

  // Live syntax parser for Super Productivity speed
  const parsedTasks = useMemo<ParsedTaskPreview[]>(() => {
    const lines = batchText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    return lines.map(rawLine => {
      let line = rawLine;
      let priority = selectedPriority;
      let categoryId = selectedCategory;
      let dueDate = selectedDueDate || todayStr;
      let dueTime: string | undefined = undefined;
      const tags: string[] = [];
      let estimatedPomodoros = 1;

      // 1. Parse Priority: !p1, !p2, !p3, !p4 or !urgent, !high, !medium, !low
      const pMatch = line.match(/!(p[1-4]|urgent|high|normal|medium|low)/i);
      if (pMatch) {
        const pKey = pMatch[1].toLowerCase();
        if (pKey === 'p1' || pKey === 'urgent' || pKey === 'high') priority = 'high';
        else if (pKey === 'p2' || pKey === 'normal' || pKey === 'medium') priority = 'medium';
        else if (pKey === 'p3' || pKey === 'p4' || pKey === 'low') priority = 'low';
        line = line.replace(pMatch[0], '');
      }

      // 2. Parse Category: @work, @health, @finance, @growth, @personal, etc.
      const catMatch = line.match(/@([a-zA-Z0-9_-]+)/);
      if (catMatch) {
        const catQuery = catMatch[1].toLowerCase();
        const found = DEFAULT_TASK_CATEGORIES.find(
          c => c.id.toLowerCase().includes(catQuery) || c.name.toLowerCase().includes(catQuery)
        );
        if (found) {
          categoryId = found.id;
        }
        line = line.replace(catMatch[0], '');
      }

      // 3. Parse Due Date: today, tomorrow, or YYYY-MM-DD
      const dateMatch = line.match(/\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/i);
      if (dateMatch) {
        const dStr = dateMatch[1].toLowerCase();
        if (dStr === 'today') dueDate = todayStr;
        else if (dStr === 'tomorrow') dueDate = tomorrowStr;
        else if (dStr.includes('/')) {
          const parts = dStr.split('/');
          if (parts.length === 3) {
            dueDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else {
          dueDate = dStr;
        }
        line = line.replace(dateMatch[0], '');
      }

      // 4. Parse Time: HH:MM or 14:30
      const timeMatch = line.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
      if (timeMatch) {
        dueTime = timeMatch[0];
        line = line.replace(timeMatch[0], '');
      }

      // 5. Parse Pomodoros: 2🍅 or 3pomo or est:2
      const pomoMatch = line.match(/(\d+)\s*(🍅|pomo|pomos|pomodoros)\b/i);
      if (pomoMatch) {
        estimatedPomodoros = Math.max(1, parseInt(pomoMatch[1], 10) || 1);
        line = line.replace(pomoMatch[0], '');
      }

      // 6. Parse Tags: #tag1, #deepwork, #urgent
      const tagMatches = line.match(/#([a-zA-Z0-9_-]+)/g);
      if (tagMatches) {
        tagMatches.forEach(tm => {
          const cleanTag = tm.replace('#', '').trim();
          if (cleanTag && !tags.includes(cleanTag)) {
            tags.push(cleanTag);
          }
          line = line.replace(tm, '');
        });
      }

      // Clean up extra whitespace
      const cleanTitle = line.replace(/\s+/g, ' ').trim();
      const catObj =
        DEFAULT_TASK_CATEGORIES.find(c => c.id === categoryId) || DEFAULT_TASK_CATEGORIES[0];

      return {
        title: cleanTitle || rawLine,
        category: categoryId,
        categoryObj: catObj,
        priority,
        quadrant: QUADRANT_MAP[priority] || 'urgent_important',
        dueDate,
        dueTime,
        tags,
        estimatedPomodoros,
      };
    });
  }, [batchText, selectedCategory, selectedPriority, selectedDueDate]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (parsedTasks.length === 0) return;

    soundEngine?.playClick();

    const newTasks: Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>[] = parsedTasks.map(
      pt => ({
        title: pt.title,
        completed: false,
        priority: pt.priority,
        quadrant: pt.quadrant,
        dueDate: pt.dueDate,
        dueTime: pt.dueTime,
        project: pt.categoryObj.name,
        category: pt.category,
        listId: selectedListId,
        isStarred,
        isSomeday: false,
        estimatedPomodoros: pt.estimatedPomodoros,
        subtasks: [],
        tags: pt.tags,
        status: 'todo' as TaskStatus,
        recurring: 'none' as const,
      })
    );

    batchAddTasks(newTasks);
    soundEngine?.playPill();
    pushNotification(
      `⚡ Batch Created ${newTasks.length} Tasks`,
      `Successfully added to ${DEFAULT_TASK_CATEGORIES.find(c => c.id === selectedCategory)?.name || 'LifeOS'}.`,
      'task'
    );

    setBatchText('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleLoadSample = (type: 'work' | 'life' | 'sprint') => {
    if (type === 'work') {
      setBatchText(
        `Finalize quarterly architecture roadmap #deepwork !p1 @work today 14:00 2🍅\nReview pull requests and schema changes !p2 @work #engineering\nDraft weekly team sync agenda @work !p3 tomorrow\nAudit backend security headers and tokens #security !p1`
      );
    } else if (type === 'life') {
      setBatchText(
        `Morning hydration and 20min meditation @personal !p2 #habit today 07:30\nOrder prescription refill for Omega-3 @health !p1 #wellness\nGrocery haul: avocados, olive oil, berries @home !p3 tomorrow\nFamily dinner reservation for weekend @relationships !p2`
      );
    } else {
      setBatchText(
        `Sprint retrospective prep @work !p2 #retro\nSync IndexedDB encryption contracts @work !p1 #crypto 3🍅\nImplement push notification listener @work !p1 #pwa\nUpdate LifeOS category color maps @creative !p3`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Super Productivity Quick-Add Batching"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-emerald-50/40 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Quick-Add Batch Tasks
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Super Productivity Speed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type multiple tasks separated by newlines to instantly populate your LifeOS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Quick Syntax Pills & Templates */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Insert Sample:
              </span>
              <button
                type="button"
                onClick={() => handleLoadSample('work')}
                className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium transition cursor-pointer"
              >
                💼 Work & Eng
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('life')}
                className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium transition cursor-pointer"
              >
                🌿 LifeOS Daily
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('sprint')}
                className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 text-[11px] font-medium transition cursor-pointer"
              >
                ⚡ Sprint Batch
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSyntaxHelp(!showSyntaxHelp)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showSyntaxHelp ? 'Hide Syntax' : 'Fast Syntax Tips'}</span>
            </button>
          </div>

          {/* Syntax Help Callout */}
          {showSyntaxHelp && (
            <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs space-y-1.5 animate-in fade-in">
              <span className="font-bold text-indigo-950 dark:text-indigo-200 block">
                ⚡ Rapid Entry Syntax Shortcuts:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  <code>!p1</code>, <code>!p2</code>, <code>!p3</code>, <code>!p4</code> &rarr; Eisenhower Quadrant
                </div>
                <div>
                  <code>@work</code>, <code>@health</code>, <code>@finance</code> &rarr; LifeOS Category
                </div>
                <div>
                  <code>#tag</code>, <code>#urgent</code>, <code>#retro</code> &rarr; Tags
                </div>
                <div>
                  <code>today</code>, <code>tomorrow</code>, <code>14:30</code> &rarr; Planned Date & Time
                </div>
              </div>
            </div>
          )}

          {/* Main Multi-Line Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-indigo-500" />
                <span>Type or Paste Task Titles (1 per line):</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border">Ctrl+Enter</kbd> to add
              </span>
            </div>

            <textarea
              autoFocus
              rows={6}
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Review quarterly architecture roadmap #deepwork !p1 @work today 14:00
Order prescription refill for Omega-3 @health !p2
Finalize weekly budget allocation @finance !p2
Call dentist for cleaning appointment !p3`}
              className="w-full p-3.5 text-xs sm:text-sm font-mono rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition leading-relaxed resize-y"
            />
          </div>

          {/* Batch Default Overrides Bar (LifeOS Category, Eisenhower, Target List, Date) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Default LifeOS Attributes for This Batch:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Category */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  LifeOS Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  {DEFAULT_TASK_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target List */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Target List
                </label>
                <select
                  value={selectedListId}
                  onChange={e => setSelectedListId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  {todoLists.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.icon} {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Planned Date */}
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Planned Date
                </label>
                <input
                  type="date"
                  value={selectedDueDate}
                  onChange={e => setSelectedDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Live Parsed Preview */}
          {parsedTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Ready to Create ({parsedTasks.length} {parsedTasks.length === 1 ? 'task' : 'tasks'}):
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Parsed with LifeOS tags & quadrants
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {parsedTasks.map((pt, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-mono shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {pt.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {/* Category Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${pt.categoryObj.bgColor} ${pt.categoryObj.textColor} ${pt.categoryObj.borderColor}`}
                      >
                        <span>{pt.categoryObj.icon}</span>
                        <span>{pt.categoryObj.name}</span>
                      </span>

                      {/* Priority */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          pt.priority === 'high'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                            : pt.priority === 'medium'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {pt.priority}
                      </span>

                      {/* Date */}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pt.dueDate}
                        {pt.dueTime ? ` @ ${pt.dueTime}` : ''}
                      </span>

                      {/* Tags */}
                      {pt.tags.map(t => (
                        <span
                          key={t}
                          className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsedTasks.length > 0 ? (
              <span>
                Will add <strong>{parsedTasks.length}</strong> tasks to LifeOS
              </span>
            ) : (
              <span>Enter one or more task titles above</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={parsedTasks.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create {parsedTasks.length > 0 ? `${parsedTasks.length} Tasks` : 'Tasks'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
