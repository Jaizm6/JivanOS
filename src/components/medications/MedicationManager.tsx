import React, { useState } from 'react';
import {
  Pill,
  Plus,
  Clock,
  AlertTriangle,
  Check,
  X,
  Droplets,
  Calendar,
  History,
  RotateCcw,
  Sparkles,
  Package,
  Edit2,
  Trash2,
  Bell,
  BellOff,
  AlarmClock,
  Volume2,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Medication, MedicationFrequency, ReminderType, MedicationCustomDateTime } from '../../types';
import { soundEngine } from '../../utils/audio';
import { IconRenderer } from '../common/IconRenderer';
import { QuoteBanner } from '../common/QuoteBanner';
import { ActivityManager } from '../common/ActivityManager';
import { MedicationDetailModal } from './MedicationDetailModal';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';

export interface MedConsumptionStats {
  dailyRate: number;
  daysRemaining: number;
  estimatedEmptyDateStr: string;
  needsRefillSoon: boolean;
  recommendedRefillDateStr: string;
}

export const formatMedFrequency = (freq: MedicationFrequency, customDays?: string[]) => {
  switch (freq) {
    case 'daily':
      return 'Daily';
    case 'twice_daily':
      return '2x Daily';
    case 'thrice_daily':
      return '3x Daily';
    case 'alternate_days':
      return 'Alternate Days';
    case 'every_3_days':
      return 'Every 3 Days';
    case 'every_4_days':
      return 'Every 4 Days';
    case 'every_5_days':
      return 'Every 5 Days';
    case 'every_6_days':
      return 'Every 6 Days';
    case 'weekly':
    case 'weekly_days':
      return customDays && customDays.length > 0 ? customDays.join(', ') : 'Weekly';
    case 'custom_dates':
      return 'Specific Dates';
    case 'as_needed':
      return 'As Needed';
    default:
      return freq;
  }
};

export const getMedConsumptionStats = (med: Medication, doseLogs: any[]): MedConsumptionStats => {
  let plannedDosesPerDay = med.schedules?.length || 1;
  if (med.frequency === 'weekly' || med.frequency === 'weekly_days') {
    const daysCount = med.customDays?.length || 1;
    plannedDosesPerDay = ((med.schedules?.length || 1) * daysCount) / 7;
  } else if (med.frequency === 'alternate_days') {
    plannedDosesPerDay = (med.schedules?.length || 1) / 2;
  } else if (med.frequency === 'every_3_days') {
    plannedDosesPerDay = (med.schedules?.length || 1) / 3;
  } else if (med.frequency === 'every_4_days') {
    plannedDosesPerDay = (med.schedules?.length || 1) / 4;
  } else if (med.frequency === 'every_5_days') {
    plannedDosesPerDay = (med.schedules?.length || 1) / 5;
  } else if (med.frequency === 'every_6_days') {
    plannedDosesPerDay = (med.schedules?.length || 1) / 6;
  } else if (med.frequency === 'twice_daily') {
    plannedDosesPerDay = Math.max(2, med.schedules?.length || 2);
  } else if (med.frequency === 'thrice_daily') {
    plannedDosesPerDay = Math.max(3, med.schedules?.length || 3);
  } else if (med.frequency === 'as_needed' || med.frequency === 'custom_dates') {
    plannedDosesPerDay = (med.schedules?.length || 1) * 0.5;
  }

  const dosageMatch = (med.dosage || '').match(/(\d+(\.\d+)?)/);
  const unitsPerDose = dosageMatch ? parseFloat(dosageMatch[1]) : 1;
  
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const medLogs = doseLogs.filter(
    l => l.medicationId === med.id && l.status === 'taken' && new Date(l.loggedAt) >= fourteenDaysAgo
  );

  let dailyRate = plannedDosesPerDay * unitsPerDose;
  if (medLogs.length >= 4) {
    const datesSet = new Set(medLogs.map(l => l.loggedAt.split('T')[0]));
    const daysCount = Math.max(1, datesSet.size);
    const totalUnitsTaken = medLogs.length * unitsPerDose;
    const empiricalRate = totalUnitsTaken / daysCount;
    dailyRate = Math.round((empiricalRate * 0.6 + dailyRate * 0.4) * 10) / 10;
  }

  dailyRate = Math.max(0.1, dailyRate);
  const daysRemaining = Math.max(0, Math.round((med.remainingPills / dailyRate) * 10) / 10);

  const emptyDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
  const estimatedEmptyDateStr = emptyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const refillTargetDate = new Date(now.getTime() + Math.max(0, daysRemaining - 2) * 24 * 60 * 60 * 1000);
  const recommendedRefillDateStr = refillTargetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const needsRefillSoon = (med.active ?? true) && (daysRemaining <= 5 || med.remainingPills <= med.refillThreshold);

  return {
    dailyRate,
    daysRemaining,
    estimatedEmptyDateStr,
    needsRefillSoon,
    recommendedRefillDateStr,
  };
};

export const MedicationManager: React.FC = () => {
  const {
    medications,
    addMedication,
    updateMedication,
    deleteMedication,
    doseLogs,
    logDose,
    refillPills,
    pushNotification,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'inventory' | 'history'>('schedule');
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [selectedMedDetail, setSelectedMedDetail] = useState<Medication | null>(null);
  const [refillMedId, setRefillMedId] = useState<string | null>(null);
  const [refillAmount, setRefillAmount] = useState('30');

  // Form state for adding/editing medication (Details vs Reminders, identical to HabitForm structure)
  const [medModalTab, setMedModalTab] = useState<'details' | 'reminders'>('details');
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
  const [customWeekDays, setCustomWeekDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('After meal with water');
  const [color, setColor] = useState('#6366f1');
  const [iconType, setIconType] = useState<Medication['iconType']>('pill');
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['08:00']);
  const [newTimeInput, setNewTimeInput] = useState('13:00');
  const [customDateTimes, setCustomDateTimes] = useState<MedicationCustomDateTime[]>([]);
  const [newCustomDate, setNewCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newCustomTime, setNewCustomTime] = useState('09:00');
  const [totalPills, setTotalPills] = useState('60');
  const [remainingPills, setRemainingPills] = useState('60');
  const [refillThreshold, setRefillThreshold] = useState('10');
  const [active, setActive] = useState(true);
  const [reminderType, setReminderType] = useState<ReminderType>('alarm');

  const [endDate, setEndDate] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const handleOpenAddModal = () => {
    setEditingMed(null);
    setMedModalTab('details');
    setFrequency('daily');
    setCustomWeekDays(['Mon', 'Wed', 'Fri']);
    setName('');
    setDosage('');
    setInstructions('After meal with water');
    setColor('#6366f1');
    setIconType('pill');
    setScheduleTimes(['08:00']);
    setNewTimeInput('13:00');
    setCustomDateTimes([]);
    setNewCustomDate(todayStr);
    setNewCustomTime('09:00');
    setTotalPills('60');
    setRemainingPills('60');
    setRefillThreshold('10');
    setActive(true);
    setReminderType('alarm');
    setEndDate('');
    setShowModal(true);
  };

  const handleOpenEditModal = (med: Medication) => {
    setEditingMed(med);
    setMedModalTab('details');
    setName(med.name);
    setDosage(med.dosage);
    setInstructions(med.instructions);
    setFrequency(med.frequency || 'daily');
    setCustomWeekDays(med.customDays && med.customDays.length > 0 ? med.customDays : ['Mon', 'Wed', 'Fri']);
    setColor(med.color);
    setIconType(med.iconType);
    setScheduleTimes(med.schedules && med.schedules.length > 0 ? med.schedules.map(s => s.time) : ['08:00']);
    setNewTimeInput('13:00');
    setCustomDateTimes(med.customDateTimes || []);
    setNewCustomDate(todayStr);
    setNewCustomTime('09:00');
    setTotalPills(String(med.totalPills));
    setRemainingPills(String(med.remainingPills));
    setRefillThreshold(String(med.refillThreshold));
    setActive(med.active ?? true);
    setReminderType(med.reminderType || 'alarm');
    setEndDate(med.endDate || '');
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const schedules = scheduleTimes.map((time, idx) => ({
      time,
      label: idx === 0 ? 'Morning' : idx === 1 ? 'Afternoon' : idx === 2 ? 'Evening' : 'Night',
    }));

    const parsedTotal = Math.max(1, parseInt(totalPills, 10) || 30);
    const parsedThreshold = Math.max(1, parseInt(refillThreshold, 10) || 10);
    const parsedRemaining = Math.max(0, parseInt(remainingPills, 10) || 0);

    const isWeekly = frequency === 'weekly' || frequency === 'weekly_days';

    if (editingMed) {
      updateMedication({
        ...editingMed,
        name: name.trim(),
        dosage: dosage.trim() || '1 tablet',
        instructions: instructions.trim() || 'With water',
        frequency,
        customDays: isWeekly ? customWeekDays : undefined,
        color,
        iconType,
        schedules,
        customDateTimes,
        totalPills: parsedTotal,
        remainingPills: parsedRemaining,
        refillThreshold: parsedThreshold,
        active,
        reminderType,
        endDate: endDate || undefined,
      });
    } else {
      addMedication({
        name: name.trim(),
        dosage: dosage.trim() || '1 tablet',
        instructions: instructions.trim() || 'With water',
        frequency,
        customDays: isWeekly ? customWeekDays : undefined,
        color,
        iconType,
        schedules,
        customDateTimes,
        totalPills: parsedTotal,
        remainingPills: parsedRemaining || parsedTotal,
        refillThreshold: parsedThreshold,
        startDate: todayStr,
        endDate: endDate || undefined,
        active: true,
        reminderType,
      });
    }

    setShowModal(false);
  };

  const handleDeleteCurrentMed = () => {
    if (editingMed) {
      deleteMedication(editingMed.id);
      setShowModal(false);
    }
  };

  const handleAddTime = () => {
    if (newTimeInput && !scheduleTimes.includes(newTimeInput)) {
      setScheduleTimes([...scheduleTimes, newTimeInput].sort());
    }
  };

  const handleRemoveTime = (timeToRemove: string) => {
    if (scheduleTimes.length > 1) {
      setScheduleTimes(scheduleTimes.filter(t => t !== timeToRemove));
    }
  };

  const handleRefillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refillMedId) {
      const amt = parseInt(refillAmount, 10) || 30;
      refillPills(refillMedId, amt);
      setRefillMedId(null);
    }
  };

  const handleSendRefillReminder = (med: Medication) => {
    const stats = getMedConsumptionStats(med, doseLogs);
    pushNotification(
      `💊 Refill Soon: ${med.name}`,
      `Remaining dosage: ${med.remainingPills} pills (~${stats.daysRemaining} days left at ${stats.dailyRate}/day). Please reorder by ${stats.recommendedRefillDateStr}.`,
      'medication'
    );
    soundEngine?.playSuccessChime?.();
  };

  const refillSoonMeds = medications.filter(m => getMedConsumptionStats(m, doseLogs).needsRefillSoon);
  const lowStockCount = refillSoonMeds.length;

  return (
    <div className="space-y-3.5 sm:space-y-4 flex-1 flex flex-col min-h-full pb-4">
      {/* Medication Title Bar */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <Pill className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Medications & Health
              </h2>
              {lowStockCount > 0 ? (
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  {lowStockCount} Refill
                </span>
              ) : (
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                  {medications.filter(m => m.active).length} active
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Schedule dosages and health logs
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <button
            id="btn-open-add-med"
            onClick={handleOpenAddModal}
            className="p-1 sm:px-2.5 sm:py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition active:scale-95 shrink-0 cursor-pointer flex items-center justify-center"
            title="Add Medication"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget (Positioned under the top medication header) */}
      <QuoteBanner />

      {/* Refill Soon Smart Consumption Banner */}
      {refillSoonMeds.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm block text-amber-950 dark:text-amber-100">
                Refill Soon Reminder ({refillSoonMeds.length} Low Stock)
              </span>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5 truncate">
                {refillSoonMeds.map(m => {
                  const st = getMedConsumptionStats(m, doseLogs);
                  return `${m.name} (~${st.daysRemaining} days remaining • Reorder by ${st.recommendedRefillDateStr})`;
                }).join(' • ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refillSoonMeds.forEach(m => handleSendRefillReminder(m))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Send Refill Reminders</span>
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeSubTab === 'schedule'
              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Daily Schedule
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeSubTab === 'inventory'
              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Pill Inventory ({medications.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Adherence Logs</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'schedule' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {medications.map(med => {
            const stats = getMedConsumptionStats(med, doseLogs);
            const isLowStock = stats.needsRefillSoon;
            const stockPct = Math.min(100, Math.round((med.remainingPills / med.totalPills) * 100));

            return (
              <div
                key={med.id}
                className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-xs transition flex flex-col justify-between ${
                  isLowStock
                    ? 'border-amber-300/80 dark:border-amber-800/80 ring-1 ring-amber-400/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Pill Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0"
                        style={{ backgroundColor: `${med.color}25`, color: med.color }}
                      >
                        <IconRenderer icon={med.iconType} className="w-5 h-5" fallback={<Pill className="w-5 h-5" />} />
                      </div>
                      <div className="min-w-0">
                        <h3
                          onClick={() => setSelectedMedDetail(med)}
                          className="text-sm font-bold text-slate-900 dark:text-white break-words cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition leading-snug"
                        >
                          {med.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {med.dosage} &bull; {formatMedFrequency(med.frequency, med.customDays)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRefillMedId(med.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        + Refill
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Notes:</span> {med.instructions}
                  </div>

                  {/* Schedules */}
                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Scheduled Doses Today
                    </span>
                    <div className="space-y-1.5">
                      {med.schedules.map(sched => {
                        const doseLog = doseLogs.find(
                          d =>
                            d.medicationId === med.id &&
                            d.scheduledTime === sched.time &&
                            d.loggedAt.startsWith(todayStr)
                        );
                        const isTaken = doseLog?.status === 'taken';

                        return (
                          <div
                            key={sched.time}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 text-xs"
                          >
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              {sched.time} ({sched.label})
                            </span>

                            {isTaken ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-3.5 h-3.5" /> Taken
                              </span>
                            ) : (
                              <button
                                onClick={() => logDose(med.id, sched.time, 'taken')}
                                className="px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer"
                              >
                                Take Now
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Stock bar & Consumption Rate Metrics */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Inventory Remaining
                    </span>
                    <span className={`font-semibold ${isLowStock ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                      {med.remainingPills} / {med.totalPills} pills
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isLowStock ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>Daily Rate: <strong className="text-slate-700 dark:text-slate-200">{stats.dailyRate} units/day</strong></span>
                    <span>Supply: <strong className={isLowStock ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'}>~{stats.daysRemaining} days left</strong></span>
                  </div>

                  {isLowStock && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block">
                          Refill Soon Alert
                        </span>
                        <span className="text-[10px] text-amber-800 dark:text-amber-300 block truncate">
                          Depletes {stats.estimatedEmptyDateStr} &bull; Reorder by {stats.recommendedRefillDateStr}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendRefillReminder(med)}
                        className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shadow-2xs transition cursor-pointer shrink-0 flex items-center gap-1 whitespace-nowrap"
                        title="Send notification reminder to refill"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Remind</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pill Inventory Table View */}
      {activeSubTab === 'inventory' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Medication</th>
                  <th className="p-3.5">Dosage</th>
                  <th className="p-3.5">Remaining Stock</th>
                  <th className="p-3.5">Daily Consumption & Supply</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {medications.map(med => {
                  const stats = getMedConsumptionStats(med, doseLogs);
                  return (
                    <tr key={med.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold"
                          style={{ backgroundColor: `${med.color}20`, color: med.color }}
                        >
                          <IconRenderer icon={med.iconType} className="w-4 h-4" fallback={<Pill className="w-4 h-4" />} />
                        </div>
                        {med.name}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">{med.dosage}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {med.remainingPills} pills
                      </td>
                      <td className="p-3.5">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{stats.dailyRate} units/day</span>
                          <p className="text-[11px] text-slate-500">
                            ~{stats.daysRemaining}d supply (Depletes {stats.estimatedEmptyDateStr})
                          </p>
                        </div>
                      </td>
                      <td className="p-3.5">
                        {stats.needsRefillSoon ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                            Refill Soon
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                            Sufficient
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {stats.needsRefillSoon && (
                          <button
                            onClick={() => handleSendRefillReminder(med)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 hover:bg-amber-200 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                            title="Send Refill Notification Reminder"
                          >
                            <Bell className="w-3 h-3" />
                            <span>Remind</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(med)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setRefillMedId(med.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-semibold cursor-pointer"
                        >
                          Refill
                        </button>
                        <button
                          onClick={() => deleteMedication(med.id)}
                          className="px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adherence Dose Logs View */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Dose Intake Log
            </h3>
            <span className="text-xs text-slate-400">Total logs: {doseLogs.length}</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {doseLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No medication doses logged yet.
              </div>
            ) : (
              doseLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {log.medicationName}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Scheduled: {log.scheduledTime} &bull; Logged:{' '}
                      {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[11px] capitalize ${
                      log.status === 'taken'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Unified Medication Form Modal for Both Adding and Editing */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    editingMed
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {editingMed ? <Edit2 className="w-4 h-4" /> : <Pill className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {editingMed ? 'Edit Medication' : 'Add Medication / Supplement'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {editingMed ? 'Update dosage, schedule times, or pill inventory stock.' : 'Schedule a new medication with dose reminders and tracking.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 ml-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Tab Bar: Details vs Reminders & Schedule (Identical to HabitForm layout) */}
            <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 sm:px-6 shrink-0">
              <button
                type="button"
                onClick={() => setMedModalTab('details')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  medModalTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                <span>Medication Details</span>
              </button>
              <button
                type="button"
                onClick={() => setMedModalTab('reminders')}
                className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  medModalTab === 'reminders'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Schedule & Reminders</span>
                {(scheduleTimes.length > 0 || customDateTimes.length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs [scrollbar-width:thin]">
                {/* TAB 1: MEDICATION DETAILS */}
                {medModalTab === 'details' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                        Medication Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Lisinopril, Omega-3, Multivitamin"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                        Medicine Form & Icon
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { type: 'pill', label: 'Pill' },
                          { type: 'capsule', label: 'Capsule' },
                          { type: 'drop', label: 'Drops' },
                          { type: 'injection', label: 'Injection' },
                          { type: 'inhaler', label: 'Inhaler' },
                        ].map(item => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => setIconType(item.type as Medication['iconType'])}
                            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                              iconType === item.type
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <IconRenderer icon={item.type} className="w-4 h-4" />
                            <span className="text-[10px] leading-tight">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Dosage
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2,000 IU (1 Softgel), 10mg"
                          value={dosage}
                          onChange={e => setDosage(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Instructions / Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Take with morning meal or water"
                          value={instructions}
                          onChange={e => setInstructions(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                    </div>

                    {/* Inventory Details */}
                    <div className={`grid ${editingMed ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
                      {editingMed && (
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                            Current Remaining
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={remainingPills}
                            onChange={e => setRemainingPills(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          {editingMed ? 'Total Capacity' : 'Initial Stock Count'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={totalPills}
                          onChange={e => setTotalPills(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Refill Threshold
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={refillThreshold}
                          onChange={e => setRefillThreshold(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                    </div>

                    {/* Color picker */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                        Tag Color
                      </label>
                      <div className="flex items-center gap-2">
                        {['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`w-7 h-7 rounded-full transition cursor-pointer ${
                              color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Active Toggle for editing */}
                    {editingMed && (
                      <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setActive(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                          />
                          <span>Active in daily regimen & dose reminders</span>
                        </label>
                      </div>
                    )}

                    {/* Quick Jump to Next Tab (Just like HabitForm!) */}
                    <button
                      type="button"
                      onClick={() => setMedModalTab('reminders')}
                      className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Next: Configure Reminders & Frequency</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* TAB 2: REMINDERS & SCHEDULE (Dedicated Reminder Form like HabitForm) */}
                {medModalTab === 'reminders' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* 1. Frequency Cadence Selection */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Frequency & Cadence</span>
                          </label>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            {formatMedFrequency(frequency, customWeekDays)}
                          </span>
                        </div>

                        {/* Clean, crystal-clear frequency options */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                          {[
                            { id: 'daily', label: 'Every Day', desc: 'Daily dosage' },
                            { id: 'alternate_days', label: 'Alternate Days', desc: 'Every 2nd day' },
                            { id: 'every_3_days', label: 'Every 3 Days', desc: 'In every 3 days' },
                            { id: 'every_4_days', label: 'Every 4 Days', desc: 'In every 4 days' },
                            { id: 'every_5_days', label: 'Every 5 Days', desc: 'In every 5 days' },
                            { id: 'every_6_days', label: 'Every 6 Days', desc: 'In every 6 days' },
                            { id: 'weekly_days', label: 'Days of Week', desc: 'Choose days' },
                            { id: 'custom_dates', label: 'Specific Dates', desc: 'Custom dates' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setFrequency(opt.id as MedicationFrequency)}
                              className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                                frequency === opt.id
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="text-xs font-bold leading-tight">{opt.label}</span>
                              <span className="text-[9.5px] opacity-75">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sub-config: Days of Week (Mon, Tue, Wed... like HabitForm!) */}
                      {(frequency === 'weekly_days' || frequency === 'weekly') && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Active Days of the Week ({customWeekDays.length} selected)
                          </label>
                          <div className="flex justify-between gap-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                              const isSelected = customWeekDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    setCustomWeekDays(prev =>
                                      prev.includes(day)
                                        ? prev.length > 1 ? prev.filter(d => d !== day) : prev
                                        : [...prev, day]
                                    );
                                  }}
                                  className={`flex-1 py-1.5 text-center rounded-lg font-bold text-[10px] sm:text-xs transition cursor-pointer border ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {day.slice(0, 2)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Sub-config: Specific Dates & Times (Notify at exact dates like Nov 26, Nov 28, Nov 30) */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Notify at Specific Dates & Times (e.g. Nov 26, Nov 28, Nov 30)
                          </label>
                          {customDateTimes.length > 0 && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              {customDateTimes.length} date{customDateTimes.length > 1 ? 's' : ''} added
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="date"
                            value={newCustomDate}
                            onChange={e => setNewCustomDate(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                          />
                          <input
                            type="time"
                            value={newCustomTime}
                            onChange={e => setNewCustomTime(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newCustomDate) return;
                              const newEntry: MedicationCustomDateTime = {
                                id: `dt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                date: newCustomDate,
                                time: newCustomTime || '09:00',
                              };
                              setCustomDateTimes(prev => [...prev, newEntry]);
                              if (frequency !== 'custom_dates' && customDateTimes.length === 0) {
                                setFrequency('custom_dates');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                          >
                            + Add Date
                          </button>
                        </div>

                        {customDateTimes.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {customDateTimes.map(item => (
                              <span
                                key={item.id}
                                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                              >
                                <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{item.date} @ {item.time}</span>
                                <button
                                  type="button"
                                  onClick={() => setCustomDateTimes(prev => prev.filter(c => c.id !== item.id))}
                                  className="text-slate-400 hover:text-rose-500 font-bold ml-1 text-xs cursor-pointer"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            Optional: Add specific dates to be notified on exact calendar days.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2. Daily Dose Times */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Dose Reminder Times</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {scheduleTimes.length} {scheduleTimes.length === 1 ? 'dose' : 'doses'}/day
                        </span>
                      </div>

                      {/* Active Scheduled Times Badges */}
                      <div className="flex flex-wrap gap-2">
                        {scheduleTimes.map(t => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                          >
                            <Clock className="w-3 h-3 text-indigo-500" />
                            {t}
                            {scheduleTimes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTime(t)}
                                className="hover:text-rose-500 ml-1 text-sm font-bold cursor-pointer"
                              >
                                &times;
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      {/* Quick Presets (Morning, Midday, Evening, Night) */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          Quick Presets:
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { t: '08:00', label: '🌅 Morning', sub: '8:00 AM' },
                            { t: '13:00', label: '☀️ Midday', sub: '1:00 PM' },
                            { t: '19:00', label: '🌆 Evening', sub: '7:00 PM' },
                            { t: '22:00', label: '🌙 Night', sub: '10:00 PM' },
                          ].map(p => (
                            <button
                              key={p.t}
                              type="button"
                              onClick={() => {
                                if (!scheduleTimes.includes(p.t)) {
                                  setScheduleTimes(prev => [...prev, p.t].sort());
                                }
                              }}
                              className={`py-1.5 px-1 rounded-xl text-center transition cursor-pointer border ${
                                scheduleTimes.includes(p.t)
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="text-[10.5px] leading-tight font-bold">{p.label}</div>
                              <div className="text-[9px] opacity-75">{p.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Time Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="time"
                          value={newTimeInput}
                          onChange={e => setNewTimeInput(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleAddTime}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-xs transition cursor-pointer"
                        >
                          + Add Time
                        </button>
                      </div>
                    </div>

                    {/* 3. Reminder Delivery Mode */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Reminder Delivery Mode</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {reminderType === 'alarm' ? 'Plays audio chime & alert banner' : reminderType === 'notification' ? 'Standard app notification' : 'No sound or alerts (Disabled)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setReminderType('none')}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                            reminderType === 'none'
                              ? 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300 font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <BellOff className="w-4 h-4 text-slate-500 mb-1" />
                          <div className="text-[11px] font-bold">None</div>
                          <div className="text-[9px] text-slate-400 hidden sm:block">Silent</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReminderType('notification')}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                            reminderType === 'notification'
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Bell className="w-4 h-4 text-indigo-500 mb-1" />
                          <div className="text-[11px] font-bold">Notification</div>
                          <div className="text-[9px] text-slate-400 hidden sm:block">Quiet Chime</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReminderType('alarm');
                            soundEngine?.playSuccessChime?.();
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                            reminderType === 'alarm'
                              ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <AlarmClock className="w-4 h-4 text-rose-500 mb-1" />
                          <div className="text-[11px] font-bold">Alarm</div>
                          <div className="text-[9px] text-slate-400 hidden sm:block">Full Alert</div>
                        </button>
                      </div>
                    </div>

                    {/* 4. Treatment Duration & End Date */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Treatment End Date</span>
                        </label>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/60">
                          {endDate ? `Ends ${endDate}` : '♾️ No End Date (Ongoing Treatment)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={endDate ? 'custom_date' : 'forever'}
                          onChange={e => {
                            if (e.target.value === 'forever') {
                              setEndDate('');
                            } else {
                              const nextMonth = new Date();
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              setEndDate(nextMonth.toISOString().split('T')[0]);
                            }
                          }}
                          className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="forever">♾️ No End Date (Ongoing Treatment / Continuous)</option>
                          <option value="custom_date">📅 Specific End Date</option>
                        </select>

                        {Boolean(endDate) && (
                          <input
                            type="date"
                            min={todayStr}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-900/80 backdrop-blur-xs">
                {editingMed ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentMed}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    {editingMed ? 'Save Changes' : 'Add Medication'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refill Modal */}
      {refillMedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Refill Medication Stock
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter number of pills or tablets added to your supply:
            </p>
            <form onSubmit={handleRefillSubmit} className="space-y-3">
              <input
                type="number"
                value={refillAmount}
                onChange={e => setRefillAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefillAmount('30')}
                  className="flex-1 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  +30
                </button>
                <button
                  type="button"
                  onClick={() => setRefillAmount('60')}
                  className="flex-1 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  +60
                </button>
                <button
                  type="button"
                  onClick={() => setRefillAmount('90')}
                  className="flex-1 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  +90
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefillMedId(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Confirm Refill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Medication Detail & History Modal */}
      {selectedMedDetail && (
        <MedicationDetailModal
          medication={selectedMedDetail}
          doseLogs={doseLogs}
          onClose={() => setSelectedMedDetail(null)}
          onEdit={(med) => {
            setSelectedMedDetail(null);
            handleOpenEditModal(med);
          }}
          onDelete={(id) => {
            deleteMedication(id);
            setSelectedMedDetail(null);
          }}
          onRefill={(id) => {
            setSelectedMedDetail(null);
            setRefillMedId(id);
          }}
        />
      )}
    </div>
  );
};
