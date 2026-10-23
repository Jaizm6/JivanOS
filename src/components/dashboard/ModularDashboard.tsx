import React, { useState } from 'react';
import { Sliders, LayoutDashboard, Sparkles, HeartPulse, CheckSquare, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailySummaryWidget } from './widgets/DailySummaryWidget';
import { MedsWidget } from './widgets/MedsWidget';
import { HydrationWidget } from './widgets/HydrationWidget';
import { TasksWidget } from './widgets/TasksWidget';
import { HabitsWidget } from './widgets/HabitsWidget';
import { QuickJournalWidget } from './widgets/QuickJournalWidget';
import { FocusTimerWidget } from './widgets/FocusTimerWidget';
import { AnalyticsSnapshotWidget } from './widgets/AnalyticsSnapshotWidget';
import { QuoteStatsWidget } from './widgets/QuoteStatsWidget';
import { UpcomingBillsWidget } from './widgets/UpcomingBillsWidget';
import { ActiveGoalsWidget } from './widgets/ActiveGoalsWidget';
import { SyncStatusWidget } from './widgets/SyncStatusWidget';
import { WidgetId } from '../../types';
import { QuoteBanner } from '../common/QuoteBanner';

type DashboardViewCategory = 'all' | 'health' | 'productivity' | 'reflection';

export const ModularDashboard: React.FC = () => {
  const { widgets, setIsWidgetModalOpen } = useApp();
  const [activeViewCategory, setActiveViewCategory] = useState<DashboardViewCategory>('all');

  // Filter widgets by category if selected
  const categoryMap: Record<DashboardViewCategory, WidgetId[] | null> = {
    all: null,
    health: ['daily_summary', 'meds_today', 'hydration', 'habit_streaks'],
    productivity: ['sync_status', 'urgent_tasks', 'focus_timer', 'active_goals', 'upcoming_bills'],
    reflection: ['daily_summary', 'quick_journal', 'analytics_snapshot'],
  };

  // Sort enabled widgets by order and apply view filter
  const activeWidgets = widgets
    .filter(w => w.enabled)
    .filter(w => {
      const allowed = categoryMap[activeViewCategory];
      if (!allowed) return true;
      return allowed.includes(w.id);
    })
    .sort((a, b) => a.order - b.order);

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'sync_status':
        return <SyncStatusWidget />;
      case 'daily_summary':
        return <DailySummaryWidget />;
      case 'meds_today':
        return <MedsWidget />;
      case 'hydration':
        return <HydrationWidget />;
      case 'urgent_tasks':
        return <TasksWidget />;
      case 'habit_streaks':
        return <HabitsWidget />;
      case 'quick_journal':
        return <QuickJournalWidget />;
      case 'focus_timer':
        return <FocusTimerWidget />;
      case 'upcoming_bills':
        return <UpcomingBillsWidget />;
      case 'active_goals':
        return <ActiveGoalsWidget />;
      case 'analytics_snapshot':
        return <AnalyticsSnapshotWidget />;
      case 'quote_stats':
        return <QuoteStatsWidget />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 ultra-compact">
      {/* Dashboard Title Bar with View Controls */}
      <div className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Dashboard
              </h2>
              <span className="text-[9.5px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                {activeWidgets.length} widgets active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Personalized modular layout with real-time health and task synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Quick View Filter Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setActiveViewCategory('all')}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeViewCategory === 'all'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>All</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewCategory('health')}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeViewCategory === 'health'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <HeartPulse className="w-3 h-3" />
              <span>Health</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewCategory('productivity')}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeViewCategory === 'productivity'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              <span>Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewCategory('reflection')}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeViewCategory === 'reflection'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>Insights</span>
            </button>
          </div>

          <button
            id="btn-edit-widgets-top"
            onClick={() => setIsWidgetModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget (Positioned under the top dashboard header) */}
      <QuoteBanner />

      {/* Dynamic Modular Widget Grid - Balanced Responsive Bento Grid with 50% Whitespace Reduction */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
        {activeWidgets.map(widget => {
          const content = renderWidget(widget.id);
          if (!content) return null;

          const isFullWidth = widget.size === 'full';
          const isMedium = widget.size === 'medium';

          return (
            <div
              key={widget.id}
              className={`transition-all ${
                isFullWidth
                  ? 'col-span-1 md:col-span-2 lg:col-span-3'
                  : isMedium
                  ? 'col-span-1 md:col-span-2 lg:col-span-2'
                  : 'col-span-1'
              }`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
