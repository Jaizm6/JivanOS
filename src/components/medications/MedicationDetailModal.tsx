import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, X, Edit2, Trash2, Clock, Check, AlertTriangle, Shield, Calendar, RefreshCw } from 'lucide-react';
import { Medication, DoseLog } from '../../types';
import { IconRenderer } from '../common/IconRenderer';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';

interface MedicationDetailModalProps {
  medication: Medication;
  doseLogs: DoseLog[];
  onClose: () => void;
  onEdit: (med: Medication) => void;
  onDelete: (medId: string) => void;
  onRefill: (medId: string) => void;
}

export const MedicationDetailModal: React.FC<MedicationDetailModalProps> = ({
  medication,
  doseLogs,
  onClose,
  onEdit,
  onDelete,
  onRefill,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const medLogs = doseLogs.filter(d => d.medicationId === medication.id);
  const stockPct = Math.min(100, Math.round((medication.remainingPills / medication.totalPills) * 100));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs font-bold mt-0.5"
                style={{ backgroundColor: `${medication.color}25`, color: medication.color }}
              >
                <IconRenderer icon={medication.iconType} className="w-5 h-5 sm:w-6 sm:h-6" fallback={<Pill className="w-5 h-5 sm:w-6 sm:h-6" />} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white break-words leading-tight">
                  {medication.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-normal mt-0.5">
                  {medication.dosage} &bull; {medication.frequency}
                </p>
              </div>
            </div>

            {/* Top Corner Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
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
                onClick={() => {
                  onEdit(medication);
                  onClose();
                }}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Edit Medication"
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 sm:p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                title="Delete Medication"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Inventory Stock Widget */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Inventory Stock</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {medication.remainingPills} / {medication.totalPills} pills
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${stockPct}%`,
                  backgroundColor: stockPct < 20 ? '#ef4444' : stockPct < 40 ? '#f59e0b' : medication.color || '#10b981',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Daily Rate: {medication.schedules?.length || 1} units/day</span>
              <button
                onClick={() => onRefill(medication.id)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refill Stock
              </button>
            </div>
          </div>

          {/* Instructions / Notes */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <span className="font-bold text-slate-500 dark:text-slate-400 block">Instructions & Notes</span>
            <p className="text-slate-700 dark:text-slate-300">{medication.instructions}</p>
          </div>

          {/* Schedule Slots Today */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Scheduled Doses
            </h4>
            <div className="space-y-1.5">
              {medication.schedules.map(sched => (
                <div
                  key={sched.time}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                >
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    {sched.time} ({sched.label})
                  </span>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Adherence History Logs */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Adherence History & Logs ({medLogs.length})
            </h4>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2 max-h-48 overflow-y-auto">
              {medLogs.length > 0 ? (
                medLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">Dose Taken ({log.scheduledTime})</span>
                        <span className="text-[10px] text-slate-400">Logged at: {new Date(log.loggedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Taken
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No adherence logs recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Medication?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete "{medication.name}"? This will remove all associated schedule and logs.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(medication.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
};
