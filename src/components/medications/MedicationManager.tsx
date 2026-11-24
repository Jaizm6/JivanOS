import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  Plus,
  Clock,
  AlertTriangle,
  Check,
  History,
  Package,
  Bell,
  Edit2,
  CheckCircle2,
  Trash2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Medication, MedicationFrequency } from '../../types';
import { soundEngine } from '../../utils/audio';
import { MedicationDetailModal } from './MedicationDetailModal';
import { MedicationFormModal, MedIconRenderer } from './MedicationFormModal';
import {
  PetalShapeBadge,
  getPetalGroupRadiusClass,
  useIsDesktopMd,
  distributeIntoTwoColumns,
} from '../common/PetalExpressive';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  CRISP_TRANSFORM_TEMPLATE,
  useModalScrollLock,
} from '../common/FormPrimitives';

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

  // Extract explicit unit count (e.g. "200 mg (2 Tablets)" -> 2, "2,000 IU (1 Softgel)" -> 1)
  // Avoid treating potency values like "200 mg" or "2,000 IU" as pill counts.
  const unitCountMatch = (med.dosage || '').match(
    /(\d+(?:\.\d+)?)\s*(?:tablets?|tabs?|capsules?|caps?|softgels?|pills?|gummies?|gummy|lozenges?|chews?|drops?|sprays?|puffs?|scoops?|sachets?|units?)\b/i
  );
  const unitsPerDose = unitCountMatch ? Math.max(0.25, parseFloat(unitCountMatch[1])) : 1;

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const medLogs = doseLogs.filter(
    l =>
      l.medicationId === med.id &&
      l.status === 'taken' &&
      new Date(l.loggedAt) >= fourteenDaysAgo
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
  const estimatedEmptyDateStr = emptyDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const refillTargetDate = new Date(
    now.getTime() + Math.max(0, daysRemaining - 2) * 24 * 60 * 60 * 1000
  );
  const recommendedRefillDateStr = refillTargetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Trigger refill alert strictly when active, not a fixed-end course med,
  // and remaining pills hit 0 (empty) or the user's configured refillThreshold.
  const threshold =
    typeof med.refillThreshold === 'number' && med.refillThreshold >= 0
      ? med.refillThreshold
      : 5;
  const isCourseMed = Boolean(med.endDate);
  const needsRefillSoon =
    (med.active ?? true) &&
    !isCourseMed &&
    (med.remainingPills <= 0 || med.remainingPills <= threshold);

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
    updateMedication,
    deleteMedication,
    doseLogs,
    logDose,
    unlogDose,
    refillPills,
    pushNotification,
    theme,
  } = useApp();

  const isDarkMode = theme === 'dark';
  const isDesktopMd = useIsDesktopMd();

  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'inventory' | 'history' | 'archived'>('schedule');
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [selectedMedDetail, setSelectedMedDetail] = useState<Medication | null>(null);
  const [refillMedId, setRefillMedId] = useState<string | null>(null);
  const [refillAmount, setRefillAmount] = useState('30');
  const [confirmDeleteInvId, setConfirmDeleteInvId] = useState<string | null>(null);

  useModalScrollLock(Boolean(refillMedId));

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handleOpenAddModal = () => {
    setEditingMed(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (med: Medication) => {
    setEditingMed(med);
    setShowModal(true);
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
      `Refill Soon: ${med.name}`,
      `Remaining dosage: ${med.remainingPills} pills (~${stats.daysRemaining} days left at ${stats.dailyRate}/day). Please reorder by ${stats.recommendedRefillDateStr}.`,
      'medication'
    );
    soundEngine?.playSuccessChime?.();
  };

  const activeMedications = useMemo(
    () => medications.filter(m => !m.archived),
    [medications]
  );

  const archivedMedications = useMemo(
    () => medications.filter(m => Boolean(m.archived)),
    [medications]
  );
  const [pendingArchiveMed, setPendingArchiveMed] = useState<Medication | null>(null);

  const executeToggleArchiveMed = (med: Medication) => {
    const wasArchived = Boolean(med.archived);
    updateMedication({
      ...med,
      archived: !wasArchived,
      archivedAt: !wasArchived ? new Date().toISOString() : undefined,
    });
    try { soundEngine?.playClick?.(); } catch {}
    pushNotification(
      wasArchived ? 'Medication Restored' : 'Medication Archived',
      wasArchived
        ? `${med.name} restored to your active schedule.`
        : `${med.name} moved to Archived Medications.`,
      'medication'
    );
  };

  const handleToggleArchiveMed = (med: Medication) => {
    if (med.archived) {
      executeToggleArchiveMed(med);
    } else {
      setPendingArchiveMed(med);
    }
  };

  const refillSoonMeds = useMemo(
    () => activeMedications.filter(m => getMedConsumptionStats(m, doseLogs).needsRefillSoon),
    [activeMedications, doseLogs]
  );

  const doseSummary = useMemo(() => {
    let totalToday = 0;
    let takenToday = 0;
    activeMedications.forEach(med => {
      med.schedules.forEach(sched => {
        totalToday += 1;
        const isTaken = doseLogs.some(
          d =>
            d.medicationId === med.id &&
            d.scheduledTime === sched.time &&
            d.loggedAt.startsWith(todayStr) &&
            d.status === 'taken'
        );
        if (isTaken) takenToday += 1;
      });
    });
    return { totalToday, takenToday };
  }, [activeMedications, doseLogs, todayStr]);

  const refillTargetMed = useMemo(
    () => medications.find(m => m.id === refillMedId) || null,
    [medications, refillMedId]
  );

  return (
    <div className="space-y-1.5 flex-1 flex flex-col min-h-full pb-6 animate-in fade-in duration-200">
      {/* 1. Material 3 Expressive Control Bar */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="p-1 rounded-[20px] flex items-center justify-between gap-1.5 w-full min-w-0 max-w-full overflow-hidden"
      >
        <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs overflow-x-auto no-scrollbar min-w-0">
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`px-3 py-1.5 ${
              activeSubTab === 'schedule' ? 'rounded-full' : 'rounded-l-full rounded-r-[6px]'
            } text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            Schedule
          </button>
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3 py-1.5 ${
              activeSubTab === 'inventory' ? 'rounded-full' : 'rounded-[6px]'
            } text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeSubTab === 'inventory'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span>Inventory ({activeMedications.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 ${
              activeSubTab === 'history' ? 'rounded-full' : 'rounded-[6px]'
            } text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Logs</span>
          </button>
          <button
            onClick={() => setActiveSubTab('archived')}
            className={`px-3 py-1.5 ${
              activeSubTab === 'archived' ? 'rounded-full' : 'rounded-r-full rounded-l-[6px]'
            } text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeSubTab === 'archived'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span>Archived{archivedMedications.length > 0 ? ` (${archivedMedications.length})` : ''}</span>
          </button>
        </div>

        <button
          id="btn-open-add-med"
          type="button"
          onClick={handleOpenAddModal}
          className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center ml-auto"
          title="Add Medication"
          aria-label="Add Medication"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Material 3 Expressive Compact KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-1.5">
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="px-2.5 py-1.5 rounded-[16px] flex items-center gap-2"
        >
          <PetalShapeBadge
            shape="clover"
            sizeClass="w-8 h-8"
            fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.35)' : 'rgba(79, 70, 229, 0.25)'}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex items-baseline justify-between flex-1 gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate">
              Doses Today
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums">
              {doseSummary.takenToday}/{doseSummary.totalToday}
            </span>
          </div>
        </div>

        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="px-2.5 py-1.5 rounded-[16px] flex items-center gap-2"
        >
          <PetalShapeBadge
            shape="cookie12"
            sizeClass="w-8 h-8"
            fillColor={
              refillSoonMeds.length > 0
                ? isDarkMode
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(245, 158, 11, 0.14)'
                : isDarkMode
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(16, 185, 129, 0.12)'
            }
            strokeColor={
              refillSoonMeds.length > 0
                ? 'rgba(245, 158, 11, 0.35)'
                : 'rgba(16, 185, 129, 0.3)'
            }
          >
            {refillSoonMeds.length > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
          </PetalShapeBadge>
          <div className="min-w-0 flex items-baseline justify-between flex-1 gap-1.5">
            <span
              className={`text-[11px] font-semibold truncate ${
                refillSoonMeds.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {refillSoonMeds.length > 0 ? 'Refill Alerts' : 'Stock'}
            </span>
            <span
              className={`text-sm sm:text-base font-extrabold leading-tight tabular-nums ${
                refillSoonMeds.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {refillSoonMeds.length > 0 ? `${refillSoonMeds.length} Low` : 'Good'}
            </span>
          </div>
        </div>
      </div>

      {/* Refill Soon Compact Notice Strip (Neutral card surface, subtle amber accent only) */}
      {refillSoonMeds.length > 0 && (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="px-3 py-1.5 rounded-[16px] text-xs text-slate-700 dark:text-zinc-200 flex items-center justify-between gap-2 border border-amber-400/45 dark:border-amber-500/35"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3 h-3" />
            </span>
            <span className="font-semibold truncate">
              <span className="text-amber-700 dark:text-amber-400">Refill ({refillSoonMeds.length}):</span>{' '}
              {refillSoonMeds
                .map(m =>
                  m.remainingPills <= 0
                    ? `${m.name} (Empty)`
                    : `${m.name} (${m.remainingPills} left)`
                )
                .join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refillSoonMeds.forEach(m => handleSendRefillReminder(m))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-[11px] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Bell className="w-3 h-3" />
            <span>Remind</span>
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {activeSubTab === 'schedule' && (
        activeMedications.length === 0 ? (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="p-7 rounded-[22px] text-center flex flex-col items-center justify-center gap-2.5"
          >
            <PetalShapeBadge
              shape="cookie9"
              sizeClass="w-12 h-12"
              fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(79, 70, 229, 0.1)'}
              strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(79, 70, 229, 0.2)'}
            >
              <Pill className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </PetalShapeBadge>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {archivedMedications.length > 0 ? 'No active medications' : 'No medications added yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Track daily doses, reminders, and automatic refill forecasts.
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const renderMedCard = (med: Medication, medIdx: number, colTotal: number) => {
              const stats = getMedConsumptionStats(med, doseLogs);
              const isEmptyStock = !med.endDate && med.remainingPills <= 0;
              const isLowStock = stats.needsRefillSoon;
              const stockPct = Math.min(100, Math.round((med.remainingPills / Math.max(1, med.totalPills)) * 100));
              const accent = med.color || '#3b82f6';
              const medRadius = getPetalGroupRadiusClass(medIdx, colTotal, false);

              const medSchedules = med.schedules || [];
              const takenCountToday = medSchedules.filter(sched =>
                doseLogs.some(
                  d =>
                    d.medicationId === med.id &&
                    d.scheduledTime === sched.time &&
                    d.loggedAt.startsWith(todayStr) &&
                    d.status === 'taken'
                )
              ).length;
              const prnTakenToday =
                medSchedules.length === 0
                  ? doseLogs.filter(
                      d =>
                        d.medicationId === med.id &&
                        d.loggedAt.startsWith(todayStr) &&
                        d.status === 'taken'
                    ).length
                  : 0;
              const nextUntakenSched = medSchedules.find(
                sched =>
                  !doseLogs.some(
                    d =>
                      d.medicationId === med.id &&
                      d.scheduledTime === sched.time &&
                      d.loggedAt.startsWith(todayStr) &&
                      d.status === 'taken'
                  )
              );
              const allTakenToday =
                medSchedules.length > 0
                  ? takenCountToday >= medSchedules.length
                  : prnTakenToday > 0;
              const hasPartialTaken =
                medSchedules.length > 1 && takenCountToday > 0 && !allTakenToday;

              const handleQuickSquircleTake = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (allTakenToday) {
                  unlogDose(med.id, medSchedules.length === 0 ? 'PRN' : 'ALL_TODAY', todayStr);
                  return;
                }
                if (medSchedules.length === 0) {
                  logDose(med.id, 'PRN', 'taken');
                  return;
                }
                if (nextUntakenSched) {
                  logDose(med.id, nextUntakenSched.time, 'taken');
                }
              };

              return (
                <div
                  key={med.id}
                  data-m3-tonal-card="true"
                  data-tonal-tone="neutral"
                  onClick={() => setSelectedMedDetail(med)}
                  className={`p-2.5 sm:p-3 ${medRadius} flex flex-col justify-between gap-2 cursor-pointer`}
                >
                  {/* Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <PetalShapeBadge
                          shape={isLowStock ? 'scallop' : 'cookie9'}
                          sizeClass="w-8 h-8 mt-0.5"
                          fillColor={`${accent}1c`}
                          strokeColor={`${accent}40`}
                        >
                          <span style={{ color: accent }}>
                            <MedIconRenderer
                              icon={med.iconType}
                              className="w-4 h-4"
                            />
                          </span>
                        </PetalShapeBadge>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-white leading-snug tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                            {med.name}
                          </h3>

                          {/* Unboxed Metadata Line */}
                          <div className="flex items-center gap-1 flex-wrap mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                            <span>{med.dosage}</span>
                            <span aria-hidden="true" className="opacity-50">·</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatMedFrequency(med.frequency, med.customDays)}
                            </span>
                            {med.instructions && (
                              <>
                                <span aria-hidden="true" className="opacity-50">·</span>
                                <span className="truncate">{med.instructions}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Large Thumb-Friendly Squircle Take / Tick Box */}
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={handleQuickSquircleTake}
                        className={`relative w-[50px] h-[50px] sm:w-[54px] sm:h-[54px] rounded-[16px] sm:rounded-[17px] flex flex-col items-center justify-center gap-0.5 shrink-0 transition-all duration-200 touch-manipulation cursor-pointer ${
                          allTakenToday
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_4px_12px_-3px_rgba(16,185,129,0.5)]'
                            : hasPartialTaken
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_12px_-3px_rgba(79,70,229,0.45)]'
                            : 'bg-indigo-50/95 dark:bg-indigo-950/45 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/55 text-indigo-600 dark:text-indigo-300 border-[1.75px] border-indigo-300/90 dark:border-indigo-700/80'
                        }`}
                        title={
                          allTakenToday
                            ? 'Taken today — tap to untick'
                            : nextUntakenSched
                            ? `Take ${nextUntakenSched.time} (${nextUntakenSched.label})`
                            : 'Log dose taken'
                        }
                      >
                        {allTakenToday ? (
                          <Check className="w-6 h-6 stroke-[3]" />
                        ) : hasPartialTaken ? (
                          <>
                            <Check className="w-4 h-4 stroke-[2.75]" />
                            <span className="text-[9.5px] font-extrabold leading-none tabular-nums">
                              {takenCountToday}/{medSchedules.length}
                            </span>
                          </>
                        ) : (
                          <>
                            <Check className="w-[18px] h-[18px] stroke-[2.5]" />
                            <span className="text-[9.5px] font-extrabold leading-none">
                              Take
                            </span>
                          </>
                        )}
                      </motion.button>
                    </div>

                    {/* Today's Scheduled Doses */}
                    <div className="space-y-1">
                      {medSchedules.length === 0 ? (
                        <div className="px-2.5 py-1.5 rounded-[12px] bg-[#f5f7fb] dark:bg-[#171a24] border border-slate-200/80 dark:border-zinc-800 text-[11.5px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                          <span>Take as needed</span>
                          {prnTakenToday > 0 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                unlogDose(med.id, 'PRN', todayStr);
                              }}
                              title="Tap to untick last dose"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 hover:bg-emerald-500/22 active:scale-95 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>{prnTakenToday} logged today</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-[3px]">
                          {medSchedules.map((sched, idx) => {
                            const doseLog = doseLogs.find(
                              d =>
                                d.medicationId === med.id &&
                                d.scheduledTime === sched.time &&
                                d.loggedAt.startsWith(todayStr)
                            );
                            const isTaken = doseLog?.status === 'taken';
                            const radiusCls = getPetalGroupRadiusClass(
                              idx,
                              medSchedules.length,
                              true
                            );

                            return (
                              <div
                                key={`${sched.time}-${idx}`}
                                className={`${radiusCls} px-2.5 py-1.5 flex items-center justify-between gap-2 border border-slate-200/80 dark:border-zinc-800/80 transition-colors ${
                                  isTaken
                                    ? 'bg-emerald-50/75 dark:bg-emerald-950/25'
                                    : 'bg-[#f5f7fb] dark:bg-[#171a24]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock
                                    className={`w-3 h-3 shrink-0 ${
                                      isTaken ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-500'
                                    }`}
                                  />
                                  <span className="font-mono font-bold text-[11.5px] text-slate-800 dark:text-zinc-100 tabular-nums">
                                    {sched.time}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                    {sched.label}
                                  </span>
                                </div>

                                {isTaken ? (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      unlogDose(med.id, sched.time, todayStr);
                                    }}
                                    title="Tap to untick dose"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 hover:bg-emerald-500/22 active:scale-95 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Taken</span>
                                  </button>
                                ) : medSchedules.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      logDose(med.id, sched.time, 'taken');
                                    }}
                                    className="px-2.5 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10.5px] transition-colors cursor-pointer shrink-0"
                                  >
                                    Take
                                  </button>
                                ) : (
                                  <span className="text-[10.5px] font-semibold text-slate-400 dark:text-zinc-500 shrink-0">
                                    Pending
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Course Duration Block OR Compact Tonal Stock & Supply Block */}
                  {med.endDate ? (() => {
                    const startMs = new Date(`${med.startDate || todayStr}T00:00:00`).getTime();
                    const endMs = new Date(`${med.endDate}T23:59:59`).getTime();
                    const nowMs = Date.now();
                    const totalCourseDays = Math.max(1, Math.ceil((endMs - startMs) / 86400000));
                    const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / 86400000));
                    const coursePct = Math.min(100, Math.max(5, Math.round(((totalCourseDays - daysLeft) / totalCourseDays) * 100)));
                    return (
                      <div
                        data-m3-tonal-card="true"
                        data-tonal-tone="subcard"
                        className="px-2.5 py-1.5 rounded-[12px] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-violet-700 dark:text-violet-300">
                            Course Deadline
                          </span>
                          <span className="font-bold tabular-nums text-slate-700 dark:text-zinc-200">
                            Ends {med.endDate} · {daysLeft}d left
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/90 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${coursePct}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })() : (
                    <div
                      data-m3-tonal-card="true"
                      data-tonal-tone="subcard"
                      className="px-2.5 py-1.5 rounded-[12px] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-slate-700 dark:text-zinc-200">
                            Supply
                          </span>
                          {isEmptyStock ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[9.5px] font-bold bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/25 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Empty
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[9.5px] font-bold bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Low ≤{med.refillThreshold}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`font-bold tabular-nums shrink-0 ${
                            isEmptyStock
                              ? 'text-rose-600 dark:text-rose-400'
                              : isLowStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-700 dark:text-zinc-200'
                          }`}
                        >
                          {med.remainingPills}/{med.totalPills} pills · ~{stats.daysRemaining}d left
                        </span>
                      </div>

                      <div className="w-full bg-slate-200/90 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${stockPct}%`,
                            backgroundColor: isEmptyStock ? '#ef4444' : isLowStock ? '#f59e0b' : accent,
                          }}
                        />
                      </div>

                      {isLowStock && (
                        <div className="pt-1 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                          <span
                            className={`text-[10.5px] font-semibold truncate ${
                              isEmptyStock
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {isEmptyStock
                              ? 'Out of stock — Refill now'
                              : `Reorder by ${stats.recommendedRefillDateStr}`}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleSendRefillReminder(med);
                            }}
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] transition-colors cursor-pointer shrink-0 flex items-center gap-1 whitespace-nowrap border ${
                              isEmptyStock
                                ? 'bg-rose-500/12 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                : 'bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/25'
                            }`}
                            title="Send notification reminder to refill"
                          >
                            <Bell className="w-2.5 h-2.5" />
                            <span>Remind</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            if (isDesktopMd && activeMedications.length > 1) {
              const [leftMeds, rightMeds] = distributeIntoTwoColumns(activeMedications);
              return (
                <div className="grid grid-cols-2 gap-2.5 items-start w-full min-w-0">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {leftMeds.map((m, idx) => renderMedCard(m, idx, leftMeds.length))}
                  </div>
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {rightMeds.map((m, idx) => renderMedCard(m, idx, rightMeds.length))}
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-[3px] w-full min-w-0">
                {activeMedications.map((m, idx) => renderMedCard(m, idx, activeMedications.length))}
              </div>
            );
          })()
        )
      )}

      {/* Pill Inventory Table View */}
      {activeSubTab === 'inventory' && (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="rounded-[22px] overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f7fc] dark:bg-[#121217] text-slate-500 dark:text-zinc-400 border-b border-slate-200/80 dark:border-zinc-800 font-bold text-[11px]">
                <tr>
                  <th className="p-3.5">Medication</th>
                  <th className="p-3.5">Dosage</th>
                  <th className="p-3.5">Remaining</th>
                  <th className="p-3.5">Consumption</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {activeMedications.map(med => {
                  const stats = getMedConsumptionStats(med, doseLogs);
                  return (
                    <tr
                      key={med.id}
                      className="hover:bg-[#f4f7fc]/60 dark:hover:bg-[#121217]/60 transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <PetalShapeBadge
                            shape="cookie9"
                            sizeClass="w-8 h-8"
                            fillColor={`${med.color || '#3b82f6'}1c`}
                            strokeColor={`${med.color || '#3b82f6'}38`}
                          >
                            <span style={{ color: med.color || '#3b82f6' }}>
                              <MedIconRenderer
                                icon={med.iconType}
                                className="w-3.5 h-3.5"
                              />
                            </span>
                          </PetalShapeBadge>
                          <span>{med.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-zinc-300">{med.dosage}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {med.remainingPills} pills
                      </td>
                      <td className="p-3.5 tabular-nums">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {stats.dailyRate} units/day
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            ~{stats.daysRemaining}d supply ({stats.estimatedEmptyDateStr})
                          </p>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[11px] font-bold ${
                            stats.needsRefillSoon
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {stats.needsRefillSoon ? 'Refill Soon' : 'Sufficient'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {stats.needsRefillSoon && (
                            <button
                              onClick={() => handleSendRefillReminder(med)}
                              className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                            >
                              <Bell className="w-3 h-3" />
                              <span>Remind</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(med)}
                            className="px-3 py-1 rounded-full bg-[#f4f7fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-200/70 font-bold text-[11px] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleArchiveMed(med)}
                            className="px-2.5 py-1 rounded-full bg-[#f4f7fc] dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                            title="Archive Medication"
                          >
                            <Archive className="w-3 h-3" />
                            <span>Archive</span>
                          </button>
                          <button
                            onClick={() => setRefillMedId(med.id)}
                            className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] cursor-pointer"
                          >
                            Refill
                          </button>
                          {confirmDeleteInvId === med.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => {
                                  deleteMedication(med.id);
                                  setConfirmDeleteInvId(null);
                                }}
                                className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10.5px] font-bold cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteInvId(null)}
                                className="px-2 py-1 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[10.5px] font-semibold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteInvId(med.id)}
                              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Delete Medication"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="rounded-[22px] p-3.5 sm:p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Dose Intake Log
            </h3>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 tabular-nums">
              {doseLogs.length} entries
            </span>
          </div>

          {doseLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500">
              No medication doses logged yet.
            </div>
          ) : (
            <div className="space-y-[3px] max-h-96 overflow-y-auto custom-scrollbar">
              {doseLogs.map((log, idx) => {
                const radiusCls = getPetalGroupRadiusClass(idx, doseLogs.length, true);
                const isTaken = log.status === 'taken';
                return (
                  <div
                    key={log.id}
                    className={`${radiusCls} px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs ${
                      isTaken
                        ? 'bg-emerald-50/55 dark:bg-emerald-950/20'
                        : 'bg-[#f4f6fb] dark:bg-[#131318]'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white truncate block">
                        {log.medicationName}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        Scheduled {log.scheduledTime} · Logged{' '}
                        {new Date(log.loggedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold capitalize shrink-0 ${
                        isTaken
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Archived Medications View */}
      {activeSubTab === 'archived' && (
        archivedMedications.length === 0 ? (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="p-7 rounded-[22px] text-center flex flex-col items-center justify-center gap-2.5"
          >
            <PetalShapeBadge
              shape="cookie9"
              sizeClass="w-12 h-12"
              fillColor={isDarkMode ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.1)'}
              strokeColor={isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.2)'}
            >
              <Archive className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
            </PetalShapeBadge>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                No archived medications
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Courses you finish or pause can be archived here to silence daily reminders while keeping your logs intact.
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const renderArchivedMedCard = (med: Medication, archIdx: number, colTotal: number) => {
              const accent = med.color || '#64748b';
              const archRadius = getPetalGroupRadiusClass(archIdx, colTotal, false);
              return (
                <div
                  key={med.id}
                  data-m3-tonal-card="true"
                  data-tonal-tone="archived"
                  className={`p-3 sm:p-3.5 ${archRadius} flex items-center justify-between gap-2.5`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <PetalShapeBadge
                      shape="cookie9"
                      sizeClass="w-10 h-10 mt-0.5"
                      fillColor={`${accent}1c`}
                      strokeColor={`${accent}40`}
                    >
                      <span style={{ color: accent }}>
                        <MedIconRenderer
                          icon={med.iconType}
                          className="w-4.5 h-4.5"
                        />
                      </span>
                    </PetalShapeBadge>
                    <div className="min-w-0 flex-1">
                      <h3
                        onClick={() => setSelectedMedDetail(med)}
                        className="text-[15px] font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {med.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11.5px] text-slate-500 dark:text-zinc-400 font-medium">
                        <span>{med.dosage}</span>
                        <span aria-hidden="true" className="opacity-50">·</span>
                        <span>{formatMedFrequency(med.frequency, med.customDays)}</span>
                        {med.archivedAt && (
                          <>
                            <span aria-hidden="true" className="opacity-50">·</span>
                            <span>Archived {med.archivedAt.slice(0, 10)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleArchiveMed(med)}
                      className="h-8 px-3 rounded-full bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      title="Restore Medication"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5 shrink-0" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMedication(med.id)}
                      className="w-8 h-8 rounded-full inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            };

            if (isDesktopMd && archivedMedications.length > 1) {
              const [leftArch, rightArch] = distributeIntoTwoColumns(archivedMedications);
              return (
                <div className="grid grid-cols-2 gap-2.5 items-start w-full min-w-0">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {leftArch.map((m, idx) => renderArchivedMedCard(m, idx, leftArch.length))}
                  </div>
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {rightArch.map((m, idx) => renderArchivedMedCard(m, idx, rightArch.length))}
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-[3px] w-full min-w-0">
                {archivedMedications.map((m, idx) => renderArchivedMedCard(m, idx, archivedMedications.length))}
              </div>
            );
          })()
        )
      )}

      {/* Unified Medication Add / Edit Modal */}
      <MedicationFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingMed(null);
        }}
        editingMed={editingMed}
      />

      {/* Material 3 Expressive Refill Modal (Portaled above Bottom Nav Bar) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {refillMedId && (
              <div
                key="med-refill-modal-root"
                data-unified-modal="true"
                className="fixed inset-0 z-[220] flex items-center justify-center p-4 overscroll-none"
              >
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
                  exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
                  className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
                  onClick={() => setRefillMedId(null)}
                />
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
                  exit={{ opacity: 0, y: 8, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
                  transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                  onClick={e => e.stopPropagation()}
                  className="relative z-10 w-full max-w-sm rounded-[28px] bg-white dark:bg-[#0d0d11] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <PetalShapeBadge
                      shape="cookie9"
                      sizeClass="w-11 h-11"
                      fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.12)'}
                      strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.35)' : 'rgba(79, 70, 229, 0.25)'}
                    >
                      <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </PetalShapeBadge>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                        Refill Supply
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {refillTargetMed?.name || 'Add tablets or doses to stock'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleRefillSubmit} className="space-y-3.5">
                    <div className="p-3.5 rounded-[20px] bg-[#f4f7fc] dark:bg-[#141418] space-y-2.5">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 block">
                        Quantity to add
                      </label>
                      <input
                        type="number"
                        value={refillAmount}
                        onChange={e => setRefillAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#0d0d11] text-slate-900 dark:text-white font-mono font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40 tabular-nums"
                      />
                      <div className="grid grid-cols-4 gap-1.5">
                        {['15', '30', '60', '90'].map(qty => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => setRefillAmount(qty)}
                            className={`py-1.5 text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                              refillAmount === qty
                                ? 'rounded-full bg-indigo-600 text-white'
                                : 'rounded-full bg-white dark:bg-[#0d0d11] text-slate-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                            }`}
                          >
                            +{qty}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRefillMedId(null)}
                        className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Confirm Refill</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Medication Detail & History Modal */}
      <AnimatePresence>
        {selectedMedDetail && (
          <MedicationDetailModal
            key={selectedMedDetail.id}
            medication={selectedMedDetail}
            doseLogs={doseLogs}
            onClose={() => setSelectedMedDetail(null)}
            onEdit={med => {
              setSelectedMedDetail(null);
              handleOpenEditModal(med);
            }}
            onDelete={id => {
              deleteMedication(id);
              setSelectedMedDetail(null);
            }}
            onRefill={id => {
              setSelectedMedDetail(null);
              setRefillMedId(id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Archive Medication Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveMed)}
        itemName={pendingArchiveMed?.name}
        itemType="Medication"
        onConfirm={() => {
          if (pendingArchiveMed) {
            executeToggleArchiveMed(pendingArchiveMed);
            setPendingArchiveMed(null);
          }
        }}
        onCancel={() => setPendingArchiveMed(null)}
      />
    </div>
  );
};
