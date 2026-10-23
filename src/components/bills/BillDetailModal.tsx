import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptText, X, Edit2, Trash2, Calendar, CheckCircle2, AlertTriangle, Clock, IndianRupee } from 'lucide-react';
import { Bill } from '../../types';
import { useApp } from '../../context/AppContext';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';

interface BillDetailModalProps {
  bill: Bill;
  onClose: () => void;
  onEdit: (bill: Bill) => void;
  onDelete: (billId: string) => void;
}

export const BillDetailModal: React.FC<BillDetailModalProps> = ({
  bill: initialBill,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { bills, markBillPaid, currencySymbol } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const bill = bills.find(b => b.id === initialBill.id) || initialBill;
  const isOverdue = !bill.isPaid && bill.dueDate < new Date().toISOString().split('T')[0];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
              style={{ backgroundColor: `${bill.color}20`, color: bill.color }}
            >
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {bill.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize">
                {bill.category.replace('_', ' ')} • {bill.recurring}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CardCalendarButton
              item={{
                id: bill.id,
                title: bill.title,
                type: 'bill',
                color: bill.color,
                dueDate: bill.dueDate,
                frequency: bill.recurring,
                reminderType: bill.reminderType || 'notification',
                reminderDaysBefore: bill.reminderDaysBefore,
              }}
            />
            <button
              onClick={() => {
                onEdit(bill);
                onClose();
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Edit Bill"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              title="Delete Bill"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Amount & Status Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1">Amount Due</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {bill.currency || currencySymbol || '₹'}{bill.amount.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1">Status</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                bill.isPaid
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : isOverdue
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {bill.isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {bill.isPaid ? 'Paid' : isOverdue ? 'Overdue' : `Due ${bill.dueDate}`}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 block font-semibold mb-0.5">Due Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{bill.dueDate}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 block font-semibold mb-0.5">Auto-Pay</span>
              <span className={`font-bold ${bill.autoPay ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {bill.autoPay ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {bill.accountNumberLast4 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 block font-semibold mb-0.5">Account / Card Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">•••• {bill.accountNumberLast4}</span>
              </div>
            )}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 block font-semibold mb-0.5">Reminder</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{bill.reminderDaysBefore} days before</span>
            </div>
          </div>

          {/* Notes */}
          {bill.notes && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Notes / Description</span>
              <p className="text-slate-700 dark:text-slate-300 italic">"{bill.notes}"</p>
            </div>
          )}

          {/* Payment History Log */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
              Payment History & Log
            </h4>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              {bill.isPaid ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block">Paid Successfully</span>
                      <span className="text-[10px] text-slate-400">Date: {bill.paidDate || bill.dueDate}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {bill.currency || currencySymbol || '₹'}{bill.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No payment recorded yet for this billing cycle.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
          {!bill.isPaid ? (
            <button
              onClick={() => {
                markBillPaid(bill.id, bill.amount);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Mark as Paid ({bill.currency || currencySymbol || '₹'}{bill.amount.toLocaleString('en-IN')})
            </button>
          ) : (
            <div className="w-full text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 py-1">
              ✓ Bill is Paid for this cycle
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Bill?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete "{bill.title}"? This action cannot be undone.
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
                    onDelete(bill.id);
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
