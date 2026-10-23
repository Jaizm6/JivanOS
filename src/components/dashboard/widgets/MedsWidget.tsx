import React from 'react';
import { Pill, Check, X, AlertTriangle, ArrowRight, Clock, Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { IconRenderer } from '../../common/IconRenderer';

export const MedsWidget: React.FC = () => {
  const { medications, doseLogs, logDose, setActiveTab } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  // Flatten all schedules for active meds today
  const activeMeds = medications.filter(m => m.active);
  const scheduledItems = activeMeds.flatMap(med =>
    med.schedules.map(sched => {
      const log = doseLogs.find(
        d =>
          d.medicationId === med.id &&
          d.scheduledTime === sched.time &&
          d.loggedAt.startsWith(todayStr)
      );
      return {
        med,
        sched,
        status: log ? log.status : 'pending',
      };
    })
  );

  // Sort by time
  scheduledItems.sort((a, b) => a.sched.time.localeCompare(b.sched.time));

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0">
            <Pill className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Medications & Supplements</span>
            <span className="text-[9.5px] font-medium font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/50 hidden sm:inline">
              {scheduledItems.length} Scheduled
            </span>
          </span>
        </div>
        <button
          id="btn-goto-meds"
          onClick={() => setActiveTab('medications')}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition"
        >
          <span>Manage</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Doses List */}
      <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto max-h-72">
        {scheduledItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No medication schedules configured yet.
          </div>
        ) : (
          scheduledItems.map(({ med, sched, status }, idx) => (
            <div
              key={`${med.id}-${sched.time}-${idx}`}
              className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 shadow-2xs ${
                status === 'taken'
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800'
                  : status === 'skipped'
                  ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-75'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-750'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
                  style={{ backgroundColor: `${med.color}20`, color: med.color }}
                >
                  <IconRenderer icon={med.iconType} className="w-4 h-4" fallback={<Pill className="w-4 h-4" />} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {med.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {med.dosage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {sched.time} ({sched.label})
                    </span>
                    <span>&bull;</span>
                    <span className="truncate">{med.instructions}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {status === 'taken' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    Taken
                  </span>
                ) : status === 'skipped' ? (
                  <span className="text-xs text-slate-400 px-2 py-1 font-medium">Skipped</span>
                ) : (
                  <>
                    <button
                      id={`btn-take-med-${med.id}-${sched.time}`}
                      onClick={() => logDose(med.id, sched.time, 'taken')}
                      title="Take Dose Now"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Take
                    </button>
                    <button
                      id={`btn-skip-med-${med.id}-${sched.time}`}
                      onClick={() => logDose(med.id, sched.time, 'skipped')}
                      title="Skip Dose"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pill Inventory Alert footer if any */}
      {activeMeds.some(m => m.remainingPills <= m.refillThreshold) && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Refill warning: Low medication stock</span>
          </div>
          <button
            onClick={() => setActiveTab('medications')}
            className="text-amber-800 dark:text-amber-200 font-semibold underline text-[11px]"
          >
            Refill Now
          </button>
        </div>
      )}
    </div>
  );
};
