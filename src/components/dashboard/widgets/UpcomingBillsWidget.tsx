import React from 'react';
import { ReceiptText, Calendar, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const UpcomingBillsWidget: React.FC = () => {
  const { bills, markBillPaid, setActiveTab } = useApp();

  const unpaidBills = bills
    .filter(b => !b.isPaid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalPendingAmount = unpaidBills.reduce((acc, b) => acc + b.amount, 0);

  const formatDaysLeft = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays}d left`;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-100/60 dark:border-blue-900/60 shrink-0">
            <ReceiptText className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Upcoming Bills & Dues</span>
            <span className="text-[9.5px] font-medium font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-800/50 hidden sm:inline">
              ₹{totalPendingAmount.toLocaleString('en-IN')} pending
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <span>Manage</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-72">
        {unpaidBills.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All Bills Settled!</p>
            <p className="text-[11px]">No upcoming payments due</p>
          </div>
        ) : (
          unpaidBills.slice(0, 4).map(bill => {
            const daysLeftStr = formatDaysLeft(bill.dueDate);
            const isOverdue = daysLeftStr.includes('overdue');
            const isDueToday = daysLeftStr === 'Due today';

            return (
              <div
                key={bill.id}
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {bill.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isOverdue
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                          : isDueToday
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {daysLeftStr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{bill.dueDate}</span>
                    <span>&bull;</span>
                    <span className="capitalize">{bill.category.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                    ₹{bill.amount.toLocaleString('en-IN')}
                  </span>
                  <button
                    type="button"
                    onClick={() => markBillPaid(bill.id)}
                    className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition"
                    title="Mark as paid"
                  >
                    Pay
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
