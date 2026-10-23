import React, { useState } from 'react';
import {
  Download,
  Upload,
  CheckSquare,
  BookLock,
  Calendar,
  Flame,
  Pill,
  ReceiptText,
  Target,
  Quote as QuoteIcon,
  Archive,
  Check,
  FileSpreadsheet,
  FileText,
  Share2,
  Sparkles,
  Info,
  Smartphone,
  Laptop,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskExportImportModal } from '../tasks/TaskExportImportModal';
import {
  triggerFileDownload,
  exportTasksSuperProductivity,
  exportTasksTodoist,
  exportTasksGoogleTasks,
  exportTasksMarkdown,
  exportJournalMarkdown,
  exportJournalICal,
  exportPlannerICal,
  exportPlannerCsv,
  exportHabitsCsv,
  exportMedicationsCsv,
  exportMedicationsPrintable,
  exportBillsCsv,
  exportGoalsCsv,
  exportQuotesCsv,
} from '../../utils/universalExporters';

export interface PageExportConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  itemCount: number;
  selectedFormat: string;
  formats: { id: string; label: string; appTarget: string; extension: string }[];
}

export const UniversalExportHub: React.FC = () => {
  const {
    tasks,
    journalEntries,
    scheduleItems,
    habits,
    medications,
    doseLogs,
    bills,
    goals,
    quotes,
    downloadLocalBackupFile,
    pushNotification,
  } = useApp();

  const [selectedPages, setSelectedPages] = useState<Record<string, boolean>>({
    tasks: true,
    journal: true,
    planner: true,
    habits: true,
    medications: true,
    bills: true,
    goals: true,
    quotes: false,
  });

  const [formatSelections, setFormatSelections] = useState<Record<string, string>>({
    tasks: 'super_productivity',
    journal: 'markdown_obsidian',
    planner: 'ical',
    habits: 'loop_csv',
    medications: 'medisafe_csv',
    bills: 'finance_csv',
    goals: 'notion_csv',
    quotes: 'csv',
  });

  const [lastExportMessage, setLastExportMessage] = useState<string>('');
  const [showNativeGuide, setShowNativeGuide] = useState<boolean>(false);
  const [isTaskImportOpen, setIsTaskImportOpen] = useState<boolean>(false);

  const pageModules: PageExportConfig[] = [
    {
      id: 'tasks',
      name: 'Tasks & Todos',
      icon: <CheckSquare className="w-4 h-4 text-indigo-500" />,
      itemCount: tasks.length,
      selectedFormat: formatSelections.tasks,
      formats: [
        { id: 'super_productivity', label: 'Super Productivity (.json)', appTarget: 'Super Productivity App', extension: 'json' },
        { id: 'todoist', label: 'Todoist Import (.csv)', appTarget: 'Todoist Project Import', extension: 'csv' },
        { id: 'google_tasks', label: 'Google Tasks (.json)', appTarget: 'Google Tasks Format', extension: 'json' },
        { id: 'markdown', label: 'Markdown Checklist (.md)', appTarget: 'Obsidian, Logseq, GitHub', extension: 'md' },
        { id: 'raw_json', label: 'OmniLifeOS Tasks (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'journal',
      name: 'Personal Journal & Reflections',
      icon: <BookLock className="w-4 h-4 text-rose-500" />,
      itemCount: journalEntries.length,
      selectedFormat: formatSelections.journal,
      formats: [
        { id: 'markdown_obsidian', label: 'Obsidian & Day One (.md)', appTarget: 'Obsidian, Logseq, Day One', extension: 'md' },
        { id: 'ical', label: 'iCalendar Reflections (.ics)', appTarget: 'Google & Apple Calendar', extension: 'ics' },
        { id: 'raw_json', label: 'OmniLifeOS Journal (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'planner',
      name: 'Planner & Schedule',
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      itemCount: scheduleItems.length,
      selectedFormat: formatSelections.planner,
      formats: [
        { id: 'ical', label: 'Universal iCalendar (.ics)', appTarget: 'Google Calendar, Apple, Outlook', extension: 'ics' },
        { id: 'csv', label: 'Schedule Agenda (.csv)', appTarget: 'Excel, Google Sheets', extension: 'csv' },
        { id: 'raw_json', label: 'OmniLifeOS Planner (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'habits',
      name: 'Habits & Streaks',
      icon: <Flame className="w-4 h-4 text-emerald-500" />,
      itemCount: habits.length,
      selectedFormat: formatSelections.habits,
      formats: [
        { id: 'loop_csv', label: 'Loop Habit & Habitica (.csv)', appTarget: 'Loop Habit Tracker, Habitica', extension: 'csv' },
        { id: 'raw_json', label: 'OmniLifeOS Habits (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'medications',
      name: 'Medications & Health',
      icon: <Pill className="w-4 h-4 text-purple-500" />,
      itemCount: medications.length,
      selectedFormat: formatSelections.medications,
      formats: [
        { id: 'medisafe_csv', label: 'Medisafe & Apple Health (.csv)', appTarget: 'Medisafe, MyTherapy, Apple Health', extension: 'csv' },
        { id: 'printable_doc', label: 'Doctor Consultation Summary (.md)', appTarget: 'Printable for Doctor / Pharmacist', extension: 'md' },
        { id: 'raw_json', label: 'OmniLifeOS Meds (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'bills',
      name: 'Bills & Subscriptions',
      icon: <ReceiptText className="w-4 h-4 text-amber-500" />,
      itemCount: bills.length,
      selectedFormat: formatSelections.bills,
      formats: [
        { id: 'finance_csv', label: 'Personal Finance CSV (.csv)', appTarget: 'YNAB, Mint, Excel, Sheets', extension: 'csv' },
        { id: 'raw_json', label: 'OmniLifeOS Bills (.json)', appTarget: 'Native OmniLifeOS', extension: 'json' },
      ],
    },
    {
      id: 'goals',
      name: 'Goals & OKRs',
      icon: <Target className="w-4 h-4 text-orange-500" />,
      itemCount: goals.length,
      selectedFormat: formatSelections.goals,
      formats: [
        { id: 'notion_csv', label: 'Notion & ClickUp Goals (.csv)', appTarget: 'Notion, ClickUp, Airtable', extension: 'csv' },
        { id: 'raw_json', label: 'Jivan Goals (.json)', appTarget: 'Native Jivan', extension: 'json' },
      ],
    },
    {
      id: 'quotes',
      name: 'Wisdom Quotes',
      icon: <QuoteIcon className="w-4 h-4 text-cyan-500" />,
      itemCount: quotes.length,
      selectedFormat: formatSelections.quotes,
      formats: [
        { id: 'csv', label: 'Quotes Spreadsheet (.csv)', appTarget: 'Excel, Google Sheets', extension: 'csv' },
        { id: 'raw_json', label: 'Jivan Quotes (.json)', appTarget: 'Native Jivan', extension: 'json' },
      ],
    },
  ];

  const handleTogglePage = (pageId: string) => {
    setSelectedPages((prev) => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    pageModules.forEach((m) => {
      updated[m.id] = select;
    });
    setSelectedPages(updated);
  };

  const handleFormatChange = (pageId: string, formatId: string) => {
    setFormatSelections((prev) => ({ ...prev, [pageId]: formatId }));
  };

  const exportSingleModule = (pageId: string) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const fmt = formatSelections[pageId];

    switch (pageId) {
      case 'tasks': {
        if (fmt === 'super_productivity') {
          const content = exportTasksSuperProductivity(tasks);
          triggerFileDownload(`super_productivity_tasks_${dateStr}.json`, content, 'application/json');
        } else if (fmt === 'todoist') {
          const content = exportTasksTodoist(tasks);
          triggerFileDownload(`todoist_tasks_${dateStr}.csv`, content, 'text/csv');
        } else if (fmt === 'google_tasks') {
          const content = exportTasksGoogleTasks(tasks);
          triggerFileDownload(`google_tasks_${dateStr}.json`, content, 'application/json');
        } else if (fmt === 'markdown') {
          const content = exportTasksMarkdown(tasks);
          triggerFileDownload(`tasks_${dateStr}.md`, content, 'text/markdown');
        } else {
          triggerFileDownload(`omnilife_tasks_${dateStr}.json`, JSON.stringify(tasks, null, 2), 'application/json');
        }
        break;
      }
      case 'journal': {
        if (fmt === 'markdown_obsidian') {
          const content = exportJournalMarkdown(journalEntries);
          triggerFileDownload(`journal_obsidian_${dateStr}.md`, content, 'text/markdown');
        } else if (fmt === 'ical') {
          const content = exportJournalICal(journalEntries);
          triggerFileDownload(`journal_reflections_${dateStr}.ics`, content, 'text/calendar');
        } else {
          triggerFileDownload(`omnilife_journal_${dateStr}.json`, JSON.stringify(journalEntries, null, 2), 'application/json');
        }
        break;
      }
      case 'planner': {
        if (fmt === 'ical') {
          const content = exportPlannerICal(scheduleItems);
          triggerFileDownload(`planner_calendar_${dateStr}.ics`, content, 'text/calendar');
        } else if (fmt === 'csv') {
          const content = exportPlannerCsv(scheduleItems);
          triggerFileDownload(`planner_schedule_${dateStr}.csv`, content, 'text/csv');
        } else {
          triggerFileDownload(`omnilife_planner_${dateStr}.json`, JSON.stringify(scheduleItems, null, 2), 'application/json');
        }
        break;
      }
      case 'habits': {
        if (fmt === 'loop_csv') {
          const content = exportHabitsCsv(habits);
          triggerFileDownload(`loop_habits_${dateStr}.csv`, content, 'text/csv');
        } else {
          triggerFileDownload(`omnilife_habits_${dateStr}.json`, JSON.stringify(habits, null, 2), 'application/json');
        }
        break;
      }
      case 'medications': {
        if (fmt === 'medisafe_csv') {
          const content = exportMedicationsCsv(medications, doseLogs);
          triggerFileDownload(`medications_medisafe_${dateStr}.csv`, content, 'text/csv');
        } else if (fmt === 'printable_doc') {
          const content = exportMedicationsPrintable(medications);
          triggerFileDownload(`medications_doctor_schedule_${dateStr}.md`, content, 'text/markdown');
        } else {
          triggerFileDownload(`omnilife_medications_${dateStr}.json`, JSON.stringify({ medications, doseLogs }, null, 2), 'application/json');
        }
        break;
      }
      case 'bills': {
        if (fmt === 'finance_csv') {
          const content = exportBillsCsv(bills);
          triggerFileDownload(`bills_subscriptions_${dateStr}.csv`, content, 'text/csv');
        } else {
          triggerFileDownload(`omnilife_bills_${dateStr}.json`, JSON.stringify(bills, null, 2), 'application/json');
        }
        break;
      }
      case 'goals': {
        if (fmt === 'notion_csv') {
          const content = exportGoalsCsv(goals);
          triggerFileDownload(`goals_okrs_${dateStr}.csv`, content, 'text/csv');
        } else {
          triggerFileDownload(`omnilife_goals_${dateStr}.json`, JSON.stringify(goals, null, 2), 'application/json');
        }
        break;
      }
      case 'quotes': {
        if (fmt === 'csv') {
          const content = exportQuotesCsv(quotes);
          triggerFileDownload(`quotes_${dateStr}.csv`, content, 'text/csv');
        } else {
          triggerFileDownload(`omnilife_quotes_${dateStr}.json`, JSON.stringify(quotes, null, 2), 'application/json');
        }
        break;
      }
    }

    const mod = pageModules.find((m) => m.id === pageId);
    setLastExportMessage(`Exported ${mod?.name} (${mod?.formats.find((f) => f.id === fmt)?.label}).`);
    setTimeout(() => setLastExportMessage(''), 4000);
    pushNotification('Export Ready', `Downloaded ${mod?.name} file ready for import.`, 'system');
  };

  const handleExportSelected = () => {
    const activeIds = Object.keys(selectedPages).filter((id) => selectedPages[id]);
    if (activeIds.length === 0) {
      setLastExportMessage('Please select at least one page checkbox to export.');
      setTimeout(() => setLastExportMessage(''), 3000);
      return;
    }

    // Export each selected module
    activeIds.forEach((id, index) => {
      setTimeout(() => {
        exportSingleModule(id);
      }, index * 200);
    });

    setLastExportMessage(`Successfully queued export for ${activeIds.length} modules.`);
    setTimeout(() => setLastExportMessage(''), 4500);
  };

  const handleExportSelectedCombinedJSON = () => {
    const activeIds = Object.keys(selectedPages).filter((id) => selectedPages[id]);
    if (activeIds.length === 0) {
      setLastExportMessage('Please select at least one page checkbox to export.');
      setTimeout(() => setLastExportMessage(''), 3000);
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const bundle: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      includedModules: activeIds,
      system: 'Jivan Universal Hub',
      version: '2.5.0',
    };

    if (selectedPages.tasks) bundle.tasks = tasks;
    if (selectedPages.journal) bundle.journalEntries = journalEntries;
    if (selectedPages.planner) bundle.scheduleItems = scheduleItems;
    if (selectedPages.habits) bundle.habits = habits;
    if (selectedPages.medications) {
      bundle.medications = medications;
      bundle.doseLogs = doseLogs;
    }
    if (selectedPages.bills) bundle.bills = bills;
    if (selectedPages.goals) bundle.goals = goals;
    if (selectedPages.quotes) bundle.quotes = quotes;

    triggerFileDownload(`omnilife_selected_pages_${dateStr}.json`, JSON.stringify(bundle, null, 2), 'application/json');
    setLastExportMessage(`Exported combined JSON with ${activeIds.length} selected pages.`);
    setTimeout(() => setLastExportMessage(''), 4500);
    pushNotification('Export Complete', `Combined archive of ${activeIds.length} pages downloaded.`, 'system');
  };

  const selectedCount = Object.values(selectedPages).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-800/80 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Universal Data Export Hub
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                Cross-App Compatible
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select specific pages below to export into formats importable by Super Productivity, Todoist, Google Tasks, Obsidian, etc.
            </p>
          </div>
        </div>

        {/* Master All-in-One Download */}
        <button
          type="button"
          onClick={() => {
            downloadLocalBackupFile();
            setLastExportMessage('All-in-One master Jivan backup exported.');
            setTimeout(() => setLastExportMessage(''), 4000);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>All-in-One Master Backup (.json)</span>
        </button>
      </div>

      {/* Select All & Multi-Export Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectAll(selectedCount !== pageModules.length)}
            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {selectedCount === pageModules.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            <strong>{selectedCount}</strong> of {pageModules.length} pages ticked
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleExportSelectedCombinedJSON}
            title="Download a single combined JSON containing only the ticked pages"
            className="px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 disabled:opacity-50 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            <span>Combined JSON ({selectedCount})</span>
          </button>

          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleExportSelected}
            title="Download individual files in their selected target app formats (Super Productivity, Todoist, iCal, etc.)"
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Individual App Files ({selectedCount})</span>
          </button>
        </div>
      </div>

      {/* Pages Checklist Grid */}
      <div className="space-y-2.5">
        {pageModules.map((mod) => {
          const isChecked = !!selectedPages[mod.id];
          const activeFormat = mod.formats.find((f) => f.id === formatSelections[mod.id]) || mod.formats[0];

          return (
            <div
              key={mod.id}
              className={`p-3 rounded-2xl border transition-all ${
                isChecked
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/20'
                  : 'border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Checkbox + Module Name + Count */}
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    id={`export-chk-${mod.id}`}
                    checked={isChecked}
                    onChange={() => handleTogglePage(mod.id)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {mod.icon}
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor={`export-chk-${mod.id}`}
                        className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 block leading-tight truncate"
                      >
                        {mod.name}
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {mod.itemCount} item{mod.itemCount === 1 ? '' : 's'} recorded
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Target App / Format Selector + Quick Download */}
                <div className="flex items-center gap-2 pl-7 md:pl-0 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                      Format:
                    </span>
                    <select
                      value={formatSelections[mod.id]}
                      onChange={(e) => handleFormatChange(mod.id, e.target.value)}
                      className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs max-w-[210px] sm:max-w-[260px] truncate"
                    >
                      {mod.formats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} &rarr; {f.appTarget}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {mod.id === 'tasks' && (
                      <button
                        type="button"
                        onClick={() => setIsTaskImportOpen(true)}
                        title="Import tasks from JSON, CSV, Todoist, Super Productivity"
                        className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Import Tasks</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportSingleModule(mod.id)}
                      title={`Download ${mod.name} as ${activeFormat.label}`}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Target App Compatibility Badge */}
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10.5px] text-slate-500 pl-7 md:pl-0">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  <span>Target App: <strong>{activeFormat.appTarget}</strong> ({activeFormat.extension.toUpperCase()})</span>
                </span>
                <span className="text-slate-400 hidden sm:inline">100% Importable</span>
              </div>
            </div>
          );
        })}
      </div>

      {lastExportMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{lastExportMessage}</span>
        </div>
      )}

      {/* Conversion Guide Accordion: Native Android, Web App, Windows & Linux */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowNativeGuide(!showNativeGuide)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <span>How to convert Jivan into a Native Android App, Web App, or Desktop App</span>
          </div>
          {showNativeGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showNativeGuide && (
          <div className="mt-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-4 animate-in fade-in">
            {/* 1. Web App */}
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                <span>1. Web App (Already Active)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                Jivan is already fully built as a modern Progressive Web App (PWA). It runs standalone in any browser (Chrome, Edge, Safari, Firefox), supports offline caching, and works seamlessly across devices.
              </p>
            </div>

            {/* 2. Native Android App */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                <span>2. Native Android App (.APK &amp; Google Play .AAB)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                You can convert this PWA into an installable Android APK or Google Play Store bundle using two standard approaches:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Method A: Google Bubblewrap (TWA) - Fastest</span>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npx @bubblewrap/cli init --manifest=https://[YOUR_URL]/manifest.json</code> and then <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">bubblewrap build</code>. Generates a certified APK/AAB signed with your keystore.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Method B: Capacitor.js</span>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npm i @capacitor/core @capacitor/android</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npx cap add android</code>, and open in Android Studio to build a native binary.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Windows & Linux */}
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Terminal className="w-3.5 h-3.5 text-purple-500" />
                <span>3. Windows (.exe / .msi) &amp; Linux (.AppImage / .deb)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                <strong>Instant:</strong> Click &quot;Install Jivan&quot; in Chrome or Edge on Windows/Linux to get a native desktop app icon and standalone window.<br />
                <strong>Packaged Executable:</strong> Wrap the build directory using <strong>Electron</strong> (<code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">electron-builder</code>) or <strong>Tauri</strong> to produce native installers for Windows and Linux.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Task Export & Import Modal (Accessible directly from Settings) */}
      <TaskExportImportModal
        isOpen={isTaskImportOpen}
        onClose={() => setIsTaskImportOpen(false)}
      />
    </div>
  );
};
