import React, { useState } from 'react';
import {
  Inbox,
  Pill,
  CheckSquare,
  BookLock,
  BarChart3,
  Droplets,
  AlertCircle,
  Timer,
  Plus,
  Flame,
  Target,
  ReceiptText,
  Settings,
  Quote,
  CalendarClock,
  Calendar as CalendarIcon,
  Clock,
  Settings2,
  Bell,
  BellOff,
  Check,
  Pause,
  Play,
  FolderKanban,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { ActiveTab } from '../../types';
import { HydrationDashboard } from '../dashboard/widgets/HydrationDashboard';
import { PinnedItemDashboard } from '../dashboard/widgets/PinnedItemDashboard';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    tasks,
    medications,
    hydration,
    addWater,
    setHydrationTarget,
    toggleWaterReminder,
    pomodoro,
    startPomodoro,
    pausePomodoro,
    stopPomodoro,
    habits,
    bills,
    quotes,
    isSidebarCollapsed,
    toggleSidebar,
    openEntitiesModal,
  } = useApp();

  const { session, pauseSession, resumeSession, stopSession } = useActiveSession();

  const [showHydrationSettings, setShowHydrationSettings] = useState(false);
  const [customHydrationTarget, setCustomHydrationTarget] = useState(hydration.targetMl.toString());
  const [glassStepperCount, setGlassStepperCount] = useState(1);

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter(t => !t.completed && t.dueDate <= todayStr);
  const lowStockMeds = medications.filter(m => m.active && m.remainingPills <= m.refillThreshold);
  const pendingBills = bills.filter(b => !b.isPaid);

  const currentHydrationTotal = Math.max(0, hydration.todayLogs.reduce((acc, c) => acc + (c.amountMl || 0), 0));
  const hydrationPct = Math.max(0, Math.min(100, Math.round((currentHydrationTotal / (hydration.targetMl || 3000)) * 100)));
  const currentGlasses = Math.max(0, Math.round((currentHydrationTotal / 250) * 10) / 10);
  const targetGlasses = Math.max(0, Math.round(((hydration.targetMl || 3000) / 250) * 10) / 10);

  const handleSaveHydrationTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customHydrationTarget, 10);
    if (!isNaN(val) && val >= 500) {
      setHydrationTarget(val);
      setShowHydrationSettings(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const activePomodoroTask = tasks.find(t => t.id === pomodoro.taskId);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'planner',
      label: 'Planner',
      icon: <CalendarClock className="w-4 h-4" />,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: pendingTasks.length > 0 ? pendingTasks.length : undefined,
    },
    {
      id: 'habits',
      label: 'Habits',
      icon: <Flame className="w-4 h-4" />,
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: <Target className="w-4 h-4" />,
    },
    {
      id: 'medications',
      label: 'Meds',
      icon: <Pill className="w-4 h-4" />,
      badge: lowStockMeds.length > 0 ? lowStockMeds.length : undefined,
    },
    {
      id: 'bills',
      label: 'Bills',
      icon: <ReceiptText className="w-4 h-4" />,
      badge: pendingBills.length > 0 ? pendingBills.length : undefined,
    },
    { id: 'journal', label: 'Journal', icon: <BookLock className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (isSidebarCollapsed) {
    return null;
  }

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 select-none self-stretch min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-3.125rem)] z-30">
      <div className="sticky top-12 sm:top-12.5 h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.125rem)] flex flex-col p-2.5 sm:p-3 overflow-y-auto custom-scrollbar">
      {/* Navigation items */}
      <div className="space-y-1">
        {navItems.map(item => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'planner' && (activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule'));
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="my-2.5 border-t border-slate-200 dark:border-slate-800" />

      {/* Quick Metrics & Mini Controls */}
      <div className="space-y-3">
        <HydrationDashboard />
        <PinnedItemDashboard />

        {/* Low Stock Warning if any */}
        {lowStockMeds.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Refill Alert ({lowStockMeds.length})</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 font-medium">
              {lowStockMeds[0].name} ({lowStockMeds[0].remainingPills} left)
            </p>
          </div>
        )}
        {/* Central Hub Management Button */}
        <button
          type="button"
          onClick={() => openEntitiesModal('goals')}
          className="mt-3 w-full py-2 px-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
          title="Manage Goals & Tags"
        >
          <FolderKanban className="w-4 h-4" />
          <span>Goals & Tags Hub</span>
        </button>

      </div>

      {/* Offline First Footer */}
      <div className="mt-auto pt-3 pb-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>E2E Encrypted &bull; Offline First</span>
      </div>
      </div>
    </aside>
  );
};
