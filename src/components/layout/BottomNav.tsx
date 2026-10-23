import React, { useState, useRef, useEffect } from 'react';
import {
  Inbox,
  CheckSquare,
  Flame,
  Target,
  Pill,
  ReceiptText,
  BookLock,
  BarChart3,
  Settings,
  Plus,
  X,
  Lock,
  Quote,
  CalendarClock,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { ActiveTab } from '../../types';
import { playLockSound } from '../../utils/audio';
import { ActivityManager } from '../common/ActivityManager';
import { UniversalAddMenu } from '../common/UniversalAddMenu';
import { ScheduleEventModal } from '../schedule/ScheduleEventModal';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, tasks, medications, doseLogs, bills, lockApp } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAddType, setSelectedAddType] = useState<'task' | 'habit' | 'event' | 'medication' | 'bill' | 'journal' | 'goal' | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasksCount = tasks.filter(t => !t.completed && t.dueDate <= todayStr).length;

  // Meds due today count
  const takenMedsCount = doseLogs.filter(d => d.status === 'taken' && d.loggedAt.startsWith(todayStr)).length;
  const totalMedsToday = medications.filter(m => m.active).length;
  const pendingMedsCount = Math.max(0, totalMedsToday - takenMedsCount);
  const unpaidBillsCount = bills.filter(b => !b.isPaid).length;

  const allNavItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    desc: string;
  }[] = [
    {
      id: 'planner',
      label: 'Planner',
      icon: <CalendarClock className="w-5 h-5" />,
      desc: 'Calendar, Schedule & Time-blocking',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-5 h-5" />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      desc: 'Todoist priorities & Super Productivity Kanban',
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
    {
      id: 'journal',
      label: 'Journal',
      icon: <BookLock className="w-5 h-5" />,
      desc: 'AES-256 encrypted personal reflections',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      desc: 'Health adherence & productivity trends',
    },
  ];

  // Auto-scroll the active tab into view in the bottom bar container without page scroll
  useEffect(() => {
    const activeEl = document.getElementById(`tab-mobile-${activeTab}`);
    if (activeEl && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetLeft = activeEl.offsetLeft - (container.clientWidth - activeEl.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [activeTab]);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="flex items-center justify-between h-16 px-1">
          {/* Horizontally scrollable dock with smooth touch handling */}
          <div
            ref={scrollContainerRef}
            className="flex-1 flex items-center overflow-x-auto no-scrollbar scroll-smooth gap-1 px-1 py-1"
          >
            {allNavItems.map(tab => {
              const isActive =
                activeTab === tab.id ||
                (tab.id === 'planner' && (activeTab === 'calendar' || activeTab === 'timeline' || activeTab === 'schedule'));
              return (
                <button
                  key={tab.id}
                  id={`tab-mobile-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className="relative shrink-0 flex flex-col items-center justify-center min-w-[62px] h-14 min-h-[44px] px-1 text-xs font-medium transition select-none"
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobileNavPill"
                      className="absolute inset-x-1 top-1 bottom-1 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <span
                      className={
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {tab.icon}
                    </span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold ring-1 ring-white dark:ring-slate-900">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 text-[10.5px] tracking-tight leading-tight whitespace-nowrap ${
                      isActive
                        ? 'font-bold text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Universal Add Trigger */}
          <div className="shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800 pr-1">
            <button
              id="tab-mobile-add"
              onClick={() => setIsMenuOpen(true)}
              className="relative flex flex-col items-center justify-center w-12 h-14 min-h-[44px] text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition cursor-pointer"
              title="Universal Add"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Universal Add Menu Popup */}
      <UniversalAddMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSelectType={(type) => {
          if (type === 'event') {
            setIsEventModalOpen(true);
          } else {
            setSelectedAddType(type);
          }
        }}
      />

      {/* Activity Manager for Tasks, Habits, Meds, Bills, Journal, Goals */}
      {selectedAddType && (
        <ActivityManager
          isOpen={!!selectedAddType}
          onClose={() => setSelectedAddType(null)}
          type={selectedAddType as any}
        />
      )}

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
