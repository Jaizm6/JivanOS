import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  X,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  Pill,
  Droplets,
  ReceiptText,
  CheckSquare,
  Trash2,
  History,
  ShieldCheck,
  Sliders,
  Quote,
} from 'lucide-react';
import { AppNotification, AlarmHistoryItem } from '../../types';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { notificationService, NotificationPermissionStatus } from '../../utils/notifications';
import {
  PetalShapeBadge,
  PetalExpressiveShape,
  M3SegmentedGroup,
  getPetalGroupRadiusClass,
} from '../common/PetalExpressive';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadNotificationsCount,
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
  const [sysPerm, setSysPerm] = useState<NotificationPermissionStatus>(() => notificationService.getPermission());

  if (!isOpen) return null;

  const unreadNotifications = notifications.filter(n => !n.read);
  const urgentTasks = tasks.filter(
    t => !t.completed && !t.archived && t.status !== 'archived' && (t.priority === 'high' || t.priority === 'medium')
  );
  const unpaidBills = bills.filter(b => !b.isPaid && !b.archived);
  const scheduledMeds = medications.filter(m => !m.archived && m.active && m.schedules.length > 0);

  const getCategoryMeta = (
    category: AppNotification['category'] | AlarmHistoryItem['category'] | string
  ): {
    icon: React.ReactNode;
    shape: PetalExpressiveShape;
    fillClass: string;
    strokeClass: string;
  } => {
    switch (category) {
      case 'medication':
        return {
          icon: <Pill className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />,
          shape: 'pill',
          fillClass: 'text-amber-100 dark:text-amber-950/80',
          strokeClass: 'text-amber-300/60 dark:text-amber-800/60',
        };
      case 'water':
        return {
          icon: <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />,
          shape: 'clover',
          fillClass: 'text-cyan-100 dark:text-cyan-950/80',
          strokeClass: 'text-cyan-300/60 dark:text-cyan-800/60',
        };
      case 'task':
        return {
          icon: <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />,
          shape: 'squircle',
          fillClass: 'text-indigo-100 dark:text-indigo-950/80',
          strokeClass: 'text-indigo-300/60 dark:text-indigo-800/60',
        };
      case 'bill':
      case 'bills':
        return {
          icon: <ReceiptText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />,
          shape: 'cookie12',
          fillClass: 'text-emerald-100 dark:text-emerald-950/80',
          strokeClass: 'text-emerald-300/60 dark:text-emerald-800/60',
        };
      case 'calendar':
      case 'schedule':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />,
          shape: 'arch',
          fillClass: 'text-blue-100 dark:text-blue-950/80',
          strokeClass: 'text-blue-300/60 dark:text-blue-800/60',
        };
      case 'habit':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" />,
          shape: 'scallop',
          fillClass: 'text-purple-100 dark:text-purple-950/80',
          strokeClass: 'text-purple-300/60 dark:text-purple-800/60',
        };
      case 'quote':
        return {
          icon: <Quote className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" />,
          shape: 'flower',
          fillClass: 'text-violet-100 dark:text-violet-950/80',
          strokeClass: 'text-violet-300/60 dark:text-violet-800/60',
        };
      default:
        return {
          icon: <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />,
          shape: 'cookie9',
          fillClass: 'text-indigo-100 dark:text-indigo-950/80',
          strokeClass: 'text-indigo-300/60 dark:text-indigo-800/60',
        };
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

  const markAllUnreadRead = () => {
    unreadNotifications.forEach(n => markNotificationRead(n.id));
  };

  const currentWaterMl = hydration.todayLogs.reduce((sum, l) => sum + l.amountMl, 0);
  const activeAlertCount = unreadNotifications.length + urgentTasks.length + unpaidBills.length + scheduledMeds.length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[390px] h-full bg-[#eef3fb] dark:bg-[#090b10] border-l border-slate-200/80 dark:border-zinc-800/90 rounded-l-[28px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250"
        role="dialog"
        aria-modal="true"
        aria-label="Notification Center"
      >
        {/* Material 3 Expressive Header */}
        <div className="px-4 pt-4 pb-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200/70 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PetalShapeBadge
                shape="cookie9"
                sizeClass="w-9 h-9"
                fillClass="text-indigo-100 dark:text-indigo-950/90"
                strokeClass="text-indigo-300/70 dark:text-indigo-800/70"
              >
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              </PetalShapeBadge>
              <div className="min-w-0">
                <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none truncate">
                  Notifications
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-1 truncate">
                  {unreadNotificationsCount > 0
                    ? `${unreadNotificationsCount} unread notification${unreadNotificationsCount > 1 ? 's' : ''}`
                    : 'Reminders, Alerts & History'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllUnreadRead}
                  className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  title="Mark all unread notifications as read"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Read all</span>
                </button>
              )}

              <button
                type="button"
                id="btn-open-notif-settings"
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800/90 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                title="Notification & Alarm Settings"
                aria-label="Settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="btn-close-notif-drawer"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800/90 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* M3 Expressive Segmented Tabs */}
          <M3SegmentedGroup<'reminders' | 'history' | 'alarm_history'>
            value={activeSubTab}
            onChange={val => setActiveSubTab(val)}
            className="w-full grid grid-cols-3"
            options={[
              {
                id: 'reminders',
                label: 'Alerts',
                icon: <Clock className="w-3 h-3" />,
                badge: activeAlertCount,
              },
              {
                id: 'history',
                label: 'History',
                icon: <History className="w-3 h-3" />,
                badge: notificationHistory.length,
              },
              {
                id: 'alarm_history',
                label: 'Alarms',
                icon: <Bell className="w-3 h-3" />,
                badge: alarmHistory.length,
              },
            ]}
          />
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5">
          {sysPerm !== 'granted' && sysPerm !== 'unsupported' && (
            <div className="p-3 rounded-[20px] bg-indigo-50/95 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-indigo-950 dark:text-indigo-200">
                  System Notifications
                </div>
                <p className="text-[10.5px] text-indigo-700/90 dark:text-indigo-300/80 leading-snug mt-0.5">
                  Allow device banners & lock-screen alarms.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const granted = await notificationService.requestPermission();
                  setSysPerm(notificationService.getPermission());
                  if (granted) {
                    await notificationService.testNotificationAlert();
                  }
                }}
                className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shrink-0 transition active:scale-95 cursor-pointer"
              >
                {sysPerm === 'denied' ? 'Blocked' : 'Enable'}
              </button>
            </div>
          )}

          {activeSubTab === 'reminders' ? (
            <div className="space-y-4">
              {/* Unread Notifications Section (Controls the Bell Red Dot) */}
              {unreadNotifications.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Unread ({unreadNotifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={markAllUnreadRead}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Clear dot
                    </button>
                  </div>
                  <div className="space-y-[3px]">
                    {unreadNotifications.map((notif, idx) => {
                      const meta = getCategoryMeta(notif.category);
                      return (
                        <div
                          key={notif.id}
                          className={`${getPetalGroupRadiusClass(idx, unreadNotifications.length, true)} px-3 py-2.5 bg-white/95 dark:bg-zinc-900/95 border border-indigo-200/80 dark:border-indigo-900/50 flex items-center gap-2.5`}
                        >
                          <PetalShapeBadge
                            shape={meta.shape}
                            sizeClass="w-7 h-7"
                            fillClass={meta.fillClass}
                            strokeClass={meta.strokeClass}
                          >
                            {meta.icon}
                          </PetalShapeBadge>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">
                                {notif.title}
                              </span>
                              <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 shrink-0 tabular-nums">
                                {formatTimestamp(notif.timestamp)}
                              </span>
                            </div>
                            {notif.body && (
                              <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate mt-0.5">
                                {notif.body}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              markNotificationRead(notif.id);
                              dismissNotification(notif.id);
                            }}
                            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                            title="Mark read"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compact Hydration Quick Card */}
              <div className="px-3 py-2.5 rounded-[20px] bg-cyan-50/90 dark:bg-cyan-950/35 border border-cyan-200/80 dark:border-cyan-800/50 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PetalShapeBadge
                    shape="clover"
                    sizeClass="w-8 h-8"
                    fillClass="text-cyan-100 dark:text-cyan-900/80"
                    strokeClass="text-cyan-300/70 dark:text-cyan-700/60"
                  >
                    <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
                  </PetalShapeBadge>
                  <div className="min-w-0">
                    <h5 className="text-[12px] font-extrabold text-cyan-950 dark:text-cyan-100 leading-tight">
                      Hydration
                    </h5>
                    <p className="text-[10.5px] font-medium text-cyan-700 dark:text-cyan-300 tabular-nums">
                      {currentWaterMl} / {hydration.targetMl} ml today
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addWater(250);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-[11px] font-extrabold rounded-full bg-cyan-600 hover:bg-cyan-500 text-white transition active:scale-95 cursor-pointer shrink-0"
                >
                  +250 ml
                </button>
              </div>

              {/* Medication Reminders */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <Pill className="w-3.5 h-3.5 text-amber-500" />
                    <span>Medications</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('medications');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                {scheduledMeds.length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic px-3 py-2.5 rounded-[18px] bg-white/70 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70">
                    No medications scheduled today.
                  </p>
                ) : (
                  <div className="space-y-[3px]">
                    {scheduledMeds.map((m, idx) => (
                      <div
                        key={m.id}
                        className={`${getPetalGroupRadiusClass(idx, scheduledMeds.length, true)} px-3 py-2.5 border border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/90 flex items-center justify-between gap-2 text-xs`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: m.color || '#f59e0b' }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-[12px] text-slate-900 dark:text-white truncate block">
                              {m.name}
                            </span>
                            <span className="text-slate-500 dark:text-zinc-400 text-[10.5px] block truncate">
                              {m.dosage}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 shrink-0">
                          {m.schedules.map(s => s.time).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Tasks Due */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Priority Tasks</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('tasks');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Open tasks
                  </button>
                </div>
                {urgentTasks.length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic px-3 py-2.5 rounded-[18px] bg-white/70 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70">
                    No priority tasks pending.
                  </p>
                ) : (
                  <div className="space-y-[3px]">
                    {urgentTasks.slice(0, 5).map((t, idx, arr) => (
                      <div
                        key={t.id}
                        className={`${getPetalGroupRadiusClass(idx, arr.length, true)} px-3 py-2.5 border border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/90 flex items-center justify-between gap-2 text-xs`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded-full uppercase ${
                              t.priority === 'high'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {t.priority}
                          </span>
                          <span className="font-bold text-[12px] text-slate-900 dark:text-white truncate">
                            {t.title}
                          </span>
                        </div>
                        {t.dueDate && (
                          <span className="text-[10.5px] text-slate-400 dark:text-zinc-500 shrink-0 font-medium tabular-nums">
                            {t.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Bills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <ReceiptText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Pending Bills</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('bills');
                      onClose();
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    View bills
                  </button>
                </div>
                {unpaidBills.length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic px-3 py-2.5 rounded-[18px] bg-white/70 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70">
                    All bills are paid!
                  </p>
                ) : (
                  <div className="space-y-[3px]">
                    {unpaidBills.slice(0, 4).map((b, idx, arr) => (
                      <div
                        key={b.id}
                        className={`${getPetalGroupRadiusClass(idx, arr.length, true)} px-3 py-2.5 border border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/90 flex items-center justify-between gap-2 text-xs`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[12px] text-slate-900 dark:text-white truncate block">
                            {b.title}
                          </span>
                          <span className="text-slate-500 dark:text-zinc-400 text-[10.5px] block">
                            Due: {b.dueDate}
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-[12px] text-emerald-600 dark:text-emerald-400 shrink-0">
                          ₹{b.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeSubTab === 'alarm_history' ? (() => {
            const filteredAlarmHistory = alarmHistory.filter(item => {
              if (alarmHistoryFilter === 'all') return true;
              return item.status === alarmHistoryFilter;
            });

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Alarm Log ({filteredAlarmHistory.length})
                  </span>
                  {alarmHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearAlarmHistory()}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {(['all', 'completed', 'snoozed', 'dismissed'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAlarmHistoryFilter(f)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition capitalize cursor-pointer shrink-0 ${
                        alarmHistoryFilter === f
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white/90 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {filteredAlarmHistory.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70">
                    <PetalShapeBadge
                      shape="cookie12"
                      sizeClass="w-11 h-11 mx-auto mb-2.5"
                      fillClass="text-slate-200 dark:text-zinc-800"
                      strokeClass="text-slate-300 dark:text-zinc-700"
                    >
                      <Bell className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                    </PetalShapeBadge>
                    <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-zinc-200">
                      No Alarm History
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      Completed, snoozed, and dismissed alarms appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-[3px]">
                    {filteredAlarmHistory.map((item, idx) => {
                      const meta = getCategoryMeta(item.category);
                      const statusPill =
                        item.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'snoozed'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400';

                      return (
                        <div
                          key={item.id}
                          className={`${getPetalGroupRadiusClass(idx, filteredAlarmHistory.length, true)} px-3 py-2.5 border border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/90 flex items-start gap-2.5 text-xs`}
                        >
                          <PetalShapeBadge
                            shape={meta.shape}
                            sizeClass="w-7 h-7 mt-0.5"
                            fillClass={meta.fillClass}
                            strokeClass={meta.strokeClass}
                          >
                            {meta.icon}
                          </PetalShapeBadge>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <h5 className="font-bold text-slate-900 dark:text-white truncate text-[12px]">
                                {item.title}
                              </h5>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${statusPill}`}>
                                {item.status}
                              </span>
                            </div>
                            {item.subtitle && (
                              <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-1 text-[9.5px] text-slate-400 dark:text-zinc-500">
                              <span className="tabular-nums">{formatTimestamp(item.triggeredAt)}</span>
                              <span className="capitalize font-semibold">{item.category}</span>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      History ({filteredHistory.length})
                    </span>
                    {notificationHistory.length > 0 && (
                      <button
                        type="button"
                        id="btn-clear-notif-history"
                        onClick={() => clearNotificationHistory()}
                        className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  {/* Compact M3 Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'quote', label: 'Quotes' },
                        { id: 'task', label: 'Tasks' },
                        { id: 'medication', label: 'Meds' },
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHistoryFilter(tab.id)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer shrink-0 ${
                          historyFilter === tab.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white/90 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-[24px] bg-white/70 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70">
                    <PetalShapeBadge
                      shape="flower"
                      sizeClass="w-11 h-11 mx-auto mb-2.5"
                      fillClass="text-slate-200 dark:text-zinc-800"
                      strokeClass="text-slate-300 dark:text-zinc-700"
                    >
                      <History className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                    </PetalShapeBadge>
                    <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-zinc-200">
                      No Notifications Yet
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                      Triggered reminders and alerts will be logged here.
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
                    <div className="space-y-3.5">
                      {Array.from(groupedMap.entries()).map(([cat, items]) => (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10.5px] font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                            <span className="capitalize">{cat}</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono bg-white/80 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border border-slate-200/70 dark:border-zinc-800">
                              {items.length}
                            </span>
                          </div>

                          <div className="space-y-[3px]">
                            {items.map((notif, idx) => {
                              const meta = getCategoryMeta(notif.category);
                              return (
                                <div
                                  key={notif.id}
                                  onClick={() => {
                                    if (notif.category === 'task') setActiveTab('tasks');
                                    if (notif.category === 'medication') setActiveTab('medications');
                                    if (notif.category === 'quote') setActiveTab('quotes');
                                    if (notif.category === 'calendar') setActiveTab('planner');
                                    if (notif.category === 'bills') setActiveTab('bills');
                                    if (notif.category === 'habit') setActiveTab('habits');
                                    onClose();
                                  }}
                                  className={`${getPetalGroupRadiusClass(idx, items.length, true)} px-3 py-2 border border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/90 flex items-center gap-2.5 text-xs transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer`}
                                >
                                  <PetalShapeBadge
                                    shape={meta.shape}
                                    sizeClass="w-7 h-7"
                                    fillClass={meta.fillClass}
                                    strokeClass={meta.strokeClass}
                                  >
                                    {meta.icon}
                                  </PetalShapeBadge>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h5 className="font-bold text-slate-900 dark:text-white truncate text-[11.5px] leading-tight">
                                        {notif.title}
                                      </h5>
                                      <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 shrink-0 tabular-nums">
                                        {formatTimestamp(notif.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-slate-500 dark:text-zinc-400 text-[10.5px] mt-0.5 leading-tight truncate">
                                      {notif.body}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
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

        {/* Material 3 Expressive Footer */}
        <div className="px-4 py-3 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Notification Settings</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-[11.5px] font-bold hover:bg-slate-300/80 dark:hover:bg-zinc-700 transition cursor-pointer"
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
