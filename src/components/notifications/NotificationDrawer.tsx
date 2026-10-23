import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  Pill,
  Droplets,
  DollarSign,
  CheckSquare,
  Trash2,
  AlertTriangle,
  History,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Volume2,
  Quote,
} from 'lucide-react';
import { AppNotification, AlarmHistoryItem } from '../../types';
import { NotificationSettingsModal } from './NotificationSettingsModal';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    notificationHistory,
    clearNotificationHistory,
    alarmHistory,
    clearAlarmHistory,
    dismissNotification,
    markNotificationRead,
    medications,
    tasks,
    bills,
    hydration,
    addWater,
    setActiveTab,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'reminders' | 'history' | 'alarm_history'>('reminders');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'quote' | 'task' | 'medication'>('all');
  const [alarmHistoryFilter, setAlarmHistoryFilter] = useState<'all' | 'completed' | 'snoozed' | 'dismissed'>('all');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  if (!isOpen) return null;

  // Filter urgent reminders
  const urgentTasks = tasks.filter(t => !t.completed && (t.priority === 'high' || t.priority === 'medium'));
  const unpaidBills = bills.filter(b => !b.isPaid);
  const scheduledMeds = medications.filter(m => m.schedules.length > 0);

  const getCategoryIcon = (category: AppNotification['category'] | AlarmHistoryItem['category'] | string) => {
    switch (category) {
      case 'medication':
        return <Pill className="w-3.5 h-3.5 text-amber-500" />;
      case 'water':
        return <Droplets className="w-3.5 h-3.5 text-cyan-500" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />;
      case 'bill':
      case 'bills':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-500" />;
      case 'journal':
      case 'calendar':
      case 'schedule':
        return <Calendar className="w-3.5 h-3.5 text-blue-500" />;
      case 'habit':
        return <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />;
      case 'quote':
        return <Quote className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  const currentWaterMl = hydration.todayLogs.reduce((sum, l) => sum + l.amountMl, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250"
        role="dialog"
        aria-modal="true"
        aria-label="Notification Center"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Notification Center</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Reminders & Notification History</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-open-notif-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notification & Alarm Sound Settings"
              aria-label="Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-close-notif-drawer"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2 Sections Toggle: Reminders vs History */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-3 gap-2 bg-slate-50/70 dark:bg-slate-900/70">
          <button
            type="button"
            id="tab-notif-reminders"
            onClick={() => setActiveSubTab('reminders')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'reminders'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Reminders</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
              {urgentTasks.length + unpaidBills.length + scheduledMeds.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-notif-history"
            onClick={() => setActiveSubTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {notificationHistory.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-alarm-history"
            onClick={() => setActiveSubTab('alarm_history')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'alarm_history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>Alarm History</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
              {alarmHistory.length}
            </span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSubTab === 'reminders' ? (
            <div className="space-y-4">
              {/* Medication Reminders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-amber-500" />
                    <span>Medications Today</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('medications');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline capitalize font-semibold text-[11px]"
                  >
                    View All
                  </button>
                </div>
                {scheduledMeds.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    No medications scheduled for today.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {scheduledMeds.map(m => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: m.color || '#f59e0b' }}
                          />
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                            <span className="text-slate-400 text-[11px] block">{m.dosage}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                          {m.schedules.map(s => s.time).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Urgent Task Reminders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Priority Tasks Due</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('tasks');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline capitalize font-semibold text-[11px]"
                  >
                    View Board
                  </button>
                </div>
                {urgentTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    No urgent tasks pending.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {urgentTasks.slice(0, 5).map(t => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                              t.priority === 'high'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {t.priority}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                        </div>
                        {t.dueDate && (
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">{t.dueDate}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bills Due Reminders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Pending Bills</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('bills');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline capitalize font-semibold text-[11px]"
                  >
                    View Bills
                  </button>
                </div>
                {unpaidBills.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    All bills are marked as paid!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {unpaidBills.slice(0, 4).map(b => (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{b.title}</span>
                          <span className="text-slate-400 text-[11px] block">Due: {b.dueDate}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{b.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hydration Reminder Card */}
              <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <h5 className="text-xs font-bold text-cyan-900 dark:text-cyan-200">Hydration Sync</h5>
                    <p className="text-[11px] text-cyan-700 dark:text-cyan-400">
                      {currentWaterMl} / {hydration.targetMl} ml logged today
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addWater(250);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-xs cursor-pointer"
                >
                  +250 ml
                </button>
              </div>
            </div>
          ) : activeSubTab === 'alarm_history' ? (() => {
            const filteredAlarmHistory = alarmHistory.filter(item => {
              if (alarmHistoryFilter === 'all') return true;
              return item.status === alarmHistoryFilter;
            });

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Alarm Log ({filteredAlarmHistory.length})
                  </span>
                  {alarmHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearAlarmHistory()}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Alarm Log</span>
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs pb-0.5">
                  {(['all', 'completed', 'snoozed', 'dismissed'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAlarmHistoryFilter(f)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition capitalize cursor-pointer shrink-0 ${
                        alarmHistoryFilter === f
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {filteredAlarmHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <Bell className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No Alarm History Recorded
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Dismissed, completed, and snoozed alarms will be tracked here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredAlarmHistory.map(item => {
                      const statusColor =
                        item.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                          : item.status === 'snoozed'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200';

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex items-start gap-2.5 text-xs transition"
                        >
                          <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h5 className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px]">
                                {item.title}
                              </h5>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${statusColor}`}>
                                {item.status}
                              </span>
                            </div>
                            {item.subtitle && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400">
                              <span>Triggered: {formatTimestamp(item.triggeredAt)}</span>
                              <span className="capitalize font-medium text-slate-500 dark:text-slate-400">
                                Category: {item.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })() : (() => {
            const filteredHistory = notificationHistory.filter(notif => {
              if (historyFilter === 'all') return true;
              if (historyFilter === 'quote') {
                return (
                  notif.category === 'quote' ||
                  notif.title.toLowerCase().includes('wisdom') ||
                  notif.title.toLowerCase().includes('quote')
                );
              }
              if (historyFilter === 'task') {
                return (
                  notif.category === 'task' ||
                  notif.category === 'journal' ||
                  notif.category === 'bill' ||
                  notif.category === 'bills'
                );
              }
              if (historyFilter === 'medication') {
                return notif.category === 'medication' || notif.category === 'water';
              }
              return true;
            });

            return (
            <div className="space-y-3">
              {/* History Subtab Toolbar with Category Filters */}
              <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Filter Reminders ({filteredHistory.length})
                  </span>
                  {notificationHistory.length > 0 && (
                    <button
                      type="button"
                      id="btn-clear-notif-history"
                      onClick={() => clearNotificationHistory()}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear History</span>
                    </button>
                  )}
                </div>

                {/* Filter Pills: All | Quotes | Tasks | Medications */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs pb-0.5">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      historyFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                      {notificationHistory.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('quote')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      historyFilter === 'quote'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Quote className="w-3 h-3 text-amber-300" />
                    <span>Quotes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('task')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      historyFilter === 'task'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <CheckSquare className="w-3 h-3 text-indigo-300" />
                    <span>Tasks</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryFilter('medication')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                      historyFilter === 'medication'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Pill className="w-3 h-3 text-emerald-300" />
                    <span>Medications</span>
                  </button>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No {historyFilter !== 'all' ? `${historyFilter.charAt(0).toUpperCase() + historyFilter.slice(1)} ` : ''}Reminders Found
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Notifications in this category will appear here as they trigger.
                  </p>
                </div>
              ) : (() => {
                const groupedMap = new Map<string, typeof filteredHistory>();
                filteredHistory.forEach(n => {
                  const cat = n.category || 'system';
                  const list = groupedMap.get(cat) || [];
                  list.push(n);
                  groupedMap.set(cat, list);
                });

                return (
                  <div className="space-y-4">
                    {Array.from(groupedMap.entries()).map(([cat, items]) => (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(cat)}
                            <span className="capitalize">{cat} Reminders</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {items.length}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {items.map(notif => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (notif.category === 'task') setActiveTab('tasks');
                                if (notif.category === 'medication') setActiveTab('medications');
                                if (notif.category === 'quote') setActiveTab('quotes');
                                if (notif.category === 'calendar') setActiveTab('calendar');
                                onClose();
                              }}
                              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 flex items-start gap-2 text-xs transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer"
                            >
                              <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                                {getCategoryIcon(notif.category)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h5 className="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px] leading-tight">
                                    {notif.title}
                                  </h5>
                                  <span className="text-[9px] text-slate-400 shrink-0 tabular-nums">
                                    {formatTimestamp(notif.timestamp)}
                                  </span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5 leading-tight truncate">
                                  {notif.body}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="underline decoration-dotted">Notification & Alarm Settings</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Notification & Alarm Settings Modal */}
      <NotificationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
};
