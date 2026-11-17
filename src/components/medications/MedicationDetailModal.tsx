import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Pill,
  X,
  Edit2,
  Trash2,
  Clock,
  Check,
  RefreshCw,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Medication, DoseLog } from '../../types';
import { useApp } from '../../context/AppContext';
import { MedIconRenderer } from './MedicationFormModal';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { PetalShapeBadge, getPetalGroupRadiusClass } from '../common/PetalExpressive';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  UNIFIED_MODAL_POSITION_CLASS,
  useModalScrollLock,
} from '../common/FormPrimitives';

interface MedicationDetailModalProps {
  medication: Medication;
  doseLogs: DoseLog[];
  onClose: () => void;
  onEdit: (med: Medication) => void;
  onDelete: (medId: string) => void;
  onRefill: (medId: string) => void;
}

export const MedicationDetailModal: React.FC<MedicationDetailModalProps> = ({
  medication: initialMedication,
  doseLogs,
  onClose,
  onEdit,
  onDelete,
  onRefill,
}) => {
  const { medications, updateMedication, pushNotification } = useApp();
  const medication = medications.find(m => m.id === initialMedication.id) || initialMedication;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useModalScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const medLogs = doseLogs.filter(d => d.medicationId === medication.id);
  const stockPct =
    medication.totalPills > 0
      ? Math.min(100, Math.round((medication.remainingPills / medication.totalPills) * 100))
      : 0;
  const accent = medication.color || '#6366f1';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-unified-modal="true"
      className={`${UNIFIED_MODAL_POSITION_CLASS} z-[200]`}
    >
      {/* Separate GPU-light Backdrop Scrim */}
      <motion.div
        data-unified-modal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2, ease: FORM_EASE } }}
        exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
        style={{ willChange: 'opacity' }}
        className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
        onClick={onClose}
      />

      {/* Separate Composited Material 3 Expressive Sheet */}
      <motion.div
        data-unified-modal="true"
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
        exit={{ opacity: 0, y: 16, scale: 0.97, transition: FORM_EXIT_TRANSITION }}
        style={{ willChange: 'transform, opacity' }}
        onClick={e => e.stopPropagation()}
        className="relative z-10 w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[86dvh] min-h-0 bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 rounded-t-[28px] sm:rounded-[28px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl flex flex-col overflow-hidden touch-auto"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/95 dark:bg-[#141418]/95 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
        </div>

        {/* Clean Header: Icon + Title + Calendar + Close (Edit & Delete anchored in Footer like Tasks) */}
        <div className="flex items-center justify-between gap-2.5 px-4 py-3 bg-white/95 dark:bg-[#141418]/95 border-b border-zinc-200/60 dark:border-zinc-800/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <PetalShapeBadge
              shape="cookie9"
              sizeClass="w-10 h-10"
              fillColor={`${accent}1c`}
              strokeColor={`${accent}40`}
            >
              <span style={{ color: accent }}>
                <MedIconRenderer
                  icon={medication.iconType}
                  className="w-4.5 h-4.5"
                />
              </span>
            </PetalShapeBadge>

            <div className="min-w-0 flex-1">
              <h3 className="text-[15.5px] sm:text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-white truncate">
                {medication.name}
              </h3>
              <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                {medication.dosage} · {medication.frequency.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <CardCalendarButton
              item={{
                id: medication.id,
                title: medication.name,
                type: 'medication',
                color: medication.color,
                reminderType: medication.reminderType || 'alarm',
                frequency: medication.frequency,
                customDays: medication.customDays,
                customDateTimes: medication.customDateTimes,
                schedules: medication.schedules,
                startDate: medication.startDate,
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f1f4fa] dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-3 custom-scrollbar">
          {/* Inventory Stock Card */}
          <div className="bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[22px] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-200">Inventory Stock</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                {medication.remainingPills} / {medication.totalPills} units
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${stockPct}%`,
                  backgroundColor:
                    stockPct < 20 ? '#ef4444' : stockPct < 40 ? '#f59e0b' : accent || '#10b981',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span>Daily rate: {medication.schedules?.length || 1} units/day</span>
              <span className="font-semibold">{stockPct}% remaining</span>
            </div>
          </div>

          {/* Instructions & Notes */}
          {medication.instructions && (
            <div className="bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[22px] p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 block">
                Instructions &amp; Notes
              </span>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {medication.instructions}
              </p>
            </div>
          )}

          {/* Scheduled Doses (Petal Grouped Containment) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 px-1 block">
              Scheduled Doses ({medication.schedules.length})
            </span>
            {medication.schedules.length === 0 ? (
              <div className="bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[20px] px-3.5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                Take as needed (PRN)
              </div>
            ) : (
              <div className="space-y-[3px]">
                {medication.schedules.map((sched, idx) => {
                  const radiusCls = getPetalGroupRadiusClass(idx, medication.schedules.length);
                  return (
                    <div
                      key={`${sched.time}-${idx}`}
                      className={`${radiusCls} flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-[#18181e] ring-1 ring-black/[0.04] dark:ring-white/[0.06] text-xs`}
                    >
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          {sched.time} ({sched.label})
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        Active
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Adherence History & Logs */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 px-1 block tabular-nums">
              Adherence History &amp; Logs ({medLogs.length})
            </span>
            {medLogs.length > 0 ? (
              <div className="space-y-[3px] max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                {medLogs.map((log, idx) => {
                  const radiusCls = getPetalGroupRadiusClass(idx, medLogs.length);
                  return (
                    <div
                      key={log.id}
                      className={`${radiusCls} flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-[#18181e] ring-1 ring-black/[0.04] dark:ring-white/[0.06] text-xs`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-zinc-800 dark:text-white block truncate tabular-nums">
                            Dose Taken ({log.scheduledTime})
                          </span>
                          <span className="text-[10.5px] text-zinc-400 block truncate tabular-nums">
                            {new Date(log.loggedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        Taken
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[20px] py-5 text-center text-zinc-400 text-xs">
                No adherence logs recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Sticky Footer (Delete on left, Edit + Primary Refill CTA on right — matches Tasks) */}
        <div className="shrink-0 bg-white/95 dark:bg-[#141418]/95 border-t border-zinc-200/60 dark:border-zinc-800/70 px-4 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 z-10">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(medication.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-full bg-[#eff2f9] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Delete Medication"
              >
                <Trash2 size={13.5} />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                if (medication.archived) {
                  updateMedication({
                    ...medication,
                    archived: false,
                    archivedAt: undefined,
                  });
                  pushNotification(
                    'Medication Restored',
                    `${medication.name} restored to your active schedule.`,
                    'medication'
                  );
                  onClose();
                } else {
                  setConfirmArchive(true);
                }
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                medication.archived
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                  : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700'
              }`}
              title={medication.archived ? 'Restore Medication' : 'Archive Medication'}
            >
              {medication.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              <span>{medication.archived ? 'Restore' : 'Archive'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onEdit(medication);
                onClose();
              }}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => onRefill(medication.id)}
              className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw size={13} />
              <span>Refill</span>
            </button>
          </div>
        </div>
      </motion.div>

      <ArchiveConfirmModal
        isOpen={confirmArchive}
        itemName={medication.name}
        itemType="Medication"
        onConfirm={() => {
          setConfirmArchive(false);
          updateMedication({
            ...medication,
            archived: true,
            archivedAt: new Date().toISOString(),
          });
          pushNotification(
            'Medication Archived',
            `${medication.name} moved to Archived Medications.`,
            'medication'
          );
          onClose();
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>,
    document.body
  );
};
