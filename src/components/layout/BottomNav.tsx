import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Flame,
  Target,
  Pill,
  ReceiptText,
  Sparkles,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { ActivityManager } from '../common/ActivityManager';
import { UniversalAddMenu } from '../common/UniversalAddMenu';
import { ScheduleEventModal } from '../schedule/ScheduleEventModal';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, tasks, todoLists = [], medications, doseLogs, bills, isSidebarCollapsed, isAIChatOpen, setIsAIChatOpen } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAddType, setSelectedAddType] = useState<'task' | 'habit' | 'event' | 'medication' | 'bill' | 'goal'>('task');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const pendingTasksCount = useMemo(() => {
    const excludedListIds = new Set(todoLists.filter(l => l.excludeFromAll).map(l => l.id));
    let count = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.completed || t.status === 'done' || t.archived || t.status === 'archived' || t.isSomeday) continue;
      if (t.listId && excludedListIds.has(t.listId)) continue;
      count++;
    }
    return count;
  }, [tasks, todoLists]);

  const pendingMedsCount = useMemo(() => {
    const activeMedIds = new Set(medications.filter(m => m.active && !m.archived).map(m => m.id));
    const takenMedsCount = doseLogs.filter(d => d.status === 'taken' && d.loggedAt.startsWith(todayStr) && activeMedIds.has(d.medicationId)).length;
    return Math.max(0, activeMedIds.size - takenMedsCount);
  }, [doseLogs, medications, todayStr]);

  const unpaidBillsCount = useMemo(() => bills.filter(b => !b.isPaid && !b.archived).length, [bills]);

  const allNavItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    desc: string;
  }[] = useMemo(() => [
    {
      id: 'tasks',
      label: 'Task',
      icon: <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      desc: 'Unified Tasks, Timeline & Time-blocking',
    },
    {
      id: 'habits',
      label: 'Habits',
      icon: <Flame className="w-5 h-5" />,
      desc: 'Streak tracking & habit chains',
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: <Target className="w-5 h-5" />,
      desc: 'Workspaces, OKRs & milestones',
    },
    {
      id: 'medications',
      label: 'Meds',
      icon: <Pill className="w-5 h-5" />,
      badge: pendingMedsCount > 0 ? pendingMedsCount : undefined,
      desc: 'Dose schedules & inventory alerts',
    },
    {
      id: 'bills',
      label: 'Bills',
      icon: <ReceiptText className="w-5 h-5" />,
      badge: unpaidBillsCount > 0 ? unpaidBillsCount : undefined,
      desc: 'Subscriptions & recurring utilities',
    },
  ], [pendingTasksCount, pendingMedsCount, unpaidBillsCount]);

  // Auto-scroll the active tab into view only if clipped
  useEffect(() => {
    const activeEl = document.getElementById(`tab-mobile-${activeTab}`);
    const container = scrollContainerRef.current;
    if (activeEl && container) {
      const elLeft = activeEl.offsetLeft;
      const elRight = elLeft + activeEl.clientWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      if (elLeft < viewLeft || elRight > viewRight) {
        const targetLeft = elLeft - (container.clientWidth - activeEl.clientWidth) / 2;
        container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  const isDrawerOpen = !isSidebarCollapsed;

  return (
    <>
      <nav
        data-drawer-bottomnav="true"
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[var(--m3-surface-container-low,#f3f6fc)] dark:bg-black border-t border-slate-200/80 dark:border-zinc-800/90 pb-safe"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-15 sm:h-16 px-1 sm:px-4">
          {/* Unified Material 4 / Material You Navigation Bar across phone, tablet, and PC */}
          <div
            ref={scrollContainerRef}
            className="flex-1 flex items-center justify-around sm:justify-center overflow-x-auto no-scrollbar gap-0.5 sm:gap-2 md:gap-4 px-0.5 py-1"
          >
            {allNavItems.map(tab => {
              const isTabSelected =
                activeTab === tab.id ||
                (tab.id === 'tasks' && (activeTab === 'planner' || activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule'));
              const isActive = !isAIChatOpen && isTabSelected;
              return (
                <button
                  key={tab.id}
                  id={`tab-mobile-${tab.id}`}
                  type="button"
                  onClick={() => {
                    if (isAIChatOpen) setIsAIChatOpen(false);
                    if (!isTabSelected) setActiveTab(tab.id);
                  }}
                  className="group relative isolate shrink-0 flex-1 max-w-[104px] flex flex-col items-center justify-center min-w-[48px] sm:min-w-[64px] h-13.5 min-h-[44px] px-0.5 text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] select-none cursor-pointer"
                >
                  {/* Material 4 Active Pill Indicator around Icon */}
                  <div className="relative flex items-center justify-center w-13 sm:w-15 h-7 rounded-full">
                    {isActive && (
                      <div
                        className="animate-m3-indicator absolute inset-0 rounded-full bg-indigo-100 dark:bg-indigo-950/85 border border-indigo-200/80 dark:border-indigo-800/70 z-0"
                      />
                    )}
                    <span
                      className={`relative z-10 transition-transform duration-200 ${
                        isActive
                          ? 'text-indigo-700 dark:text-indigo-300 scale-105'
                          : 'text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="absolute -top-1 right-1 px-1.2 min-w-[16px] h-[15px] flex items-center justify-center rounded-full bg-indigo-600 text-white text-[9px] font-extrabold ring-1.5 ring-white dark:ring-black z-20">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`relative z-10 mt-0.5 text-[10.5px] sm:text-[11px] tracking-tight leading-tight whitespace-nowrap transition-colors duration-200 ${
                      isActive
                        ? 'font-extrabold text-indigo-700 dark:text-indigo-300'
                        : 'font-semibold text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}

            {/* AI Button (Just before the + button) */}
            <button
              id="tab-mobile-ai"
              type="button"
              onClick={() => setIsAIChatOpen(!isAIChatOpen)}
              title="Jivan AI"
              className="group relative isolate shrink-0 flex-1 max-w-[104px] flex flex-col items-center justify-center min-w-[48px] sm:min-w-[64px] h-13.5 min-h-[44px] px-0.5 text-xs font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] select-none cursor-pointer"
            >
              <div className="relative flex items-center justify-center w-13 sm:w-15 h-7 rounded-full">
                {isAIChatOpen && (
                  <div
                    className="animate-m3-indicator absolute inset-0 rounded-full bg-indigo-100 dark:bg-indigo-950/85 border border-indigo-200/80 dark:border-indigo-800/70 z-0"
                  />
                )}
                <span
                  className={`relative z-10 transition-transform duration-200 ${
                    isAIChatOpen
                      ? 'text-indigo-700 dark:text-indigo-300 scale-105'
                      : 'text-slate-600 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </span>
              </div>
              <span
                className={`relative z-10 mt-0.5 text-[10.5px] sm:text-[11px] tracking-tight leading-tight whitespace-nowrap transition-colors duration-200 ${
                  isAIChatOpen
                    ? 'font-extrabold text-indigo-700 dark:text-indigo-300'
                    : 'font-semibold text-slate-600 dark:text-zinc-400'
                }`}
              >
                AI
              </span>
            </button>
          </div>

          {/* Material 3 Expressive Quick Create FAB Trigger */}
          <div className="shrink-0 pl-1.5 sm:pl-2.5 border-l border-slate-200/80 dark:border-zinc-800/80 pr-1">
            <button
              id="tab-mobile-add"
              type="button"
              onClick={() => {
                if (isAIChatOpen) setIsAIChatOpen(false);
                setIsMenuOpen(prev => !prev);
              }}
              aria-expanded={isMenuOpen}
              className={`relative flex items-center justify-center w-10 h-10 rounded-[14px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all duration-150 active:scale-92 active:rounded-full cursor-pointer ${
                isMenuOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100'
              }`}
              title="Quick Create"
            >
              <Plus className="w-5 h-5 stroke-[2.6]" />
            </button>
          </div>
        </div>
      </nav>

      {/* Material 3 Expressive FAB Menu */}
      <UniversalAddMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSelectType={(type) => {
          if (type === 'event') {
            setIsEventModalOpen(true);
          } else {
            setSelectedAddType(type);
            setIsAddModalOpen(true);
          }
        }}
      />

      {/* Activity Manager for Tasks, Habits, Meds, Bills, Goals (kept mounted so close animations finish) */}
      <ActivityManager
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        type={selectedAddType as any}
      />

      {/* Schedule / Event Modal */}
      {isEventModalOpen && (
        <ScheduleEventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
        />
      )}
    </>
  );
};
