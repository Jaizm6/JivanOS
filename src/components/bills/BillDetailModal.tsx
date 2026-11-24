import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ReceiptText,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Globe,
  Check,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Bill } from '../../types';
import { useApp } from '../../context/AppContext';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
import { PetalShapeBadge } from '../common/PetalExpressive';
import { ArchiveConfirmModal } from '../common/ArchiveConfirmModal';
import {
  FORM_EASE,
  FORM_SPRING,
  FORM_EXIT_TRANSITION,
  CRISP_TRANSFORM_TEMPLATE,
  UNIFIED_MODAL_POSITION_CLASS,
  useModalScrollLock,
} from '../common/FormPrimitives';

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
  const { bills, markBillPaid, unmarkBillPaid, updateBill, pushNotification, currencySymbol } = useApp();
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

  const bill = bills.find(b => b.id === initialBill.id) || initialBill;
  const isOverdue = !bill.isPaid && bill.dueDate < new Date().toISOString().split('T')[0];
  const accent = bill.color || '#6366f1';
  const symbol = bill.currency || currencySymbol || '₹';

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
        animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
        exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
        className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
        onClick={onClose}
      />

      {/* Separate Composited Material 3 Expressive Sheet */}
      <motion.div
        data-unified-modal="true"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
        exit={{ opacity: 0, y: 10, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
        transformTemplate={CRISP_TRANSFORM_TEMPLATE}
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
              shape="arch"
              sizeClass="w-10 h-10"
              fillColor={`${accent}1c`}
              strokeColor={`${accent}40`}
            >
              <span style={{ color: accent }}>
                <ReceiptText className="w-4.5 h-4.5" />
              </span>
            </PetalShapeBadge>

            <div className="min-w-0 flex-1">
              <h3 className="text-[15.5px] sm:text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-white truncate">
                {bill.title}
              </h3>
              <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 font-medium capitalize truncate">
                {bill.category.replace('_', ' ')} · {bill.recurring.replace('_', '-')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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
          {/* Amount & Status Card */}
          <div className="bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[22px] p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 block mb-0.5">
                Amount Due
              </span>
              <div className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                {symbol}
                {bill.amount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-zinc-400 block mb-0.5">Status</span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
                  bill.isPaid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isOverdue
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {bill.isPaid ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isOverdue ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{bill.isPaid ? 'Paid' : isOverdue ? 'Overdue' : `Due ${bill.dueDate}`}</span>
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
              <span className="text-zinc-400 block font-semibold text-[10.5px] mb-0.5">
                Due Date
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                {bill.dueDate}
              </span>
            </div>

            <div className="p-3 rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
              <span className="text-zinc-400 block font-semibold text-[10.5px] mb-0.5">
                Auto-Pay
              </span>
              <span
                className={`font-bold ${
                  bill.autoPay
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {bill.autoPay ? 'Enabled' : 'Manual'}
              </span>
            </div>

            <div className="p-3 rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
              <span className="text-zinc-400 block font-semibold text-[10.5px] mb-0.5">
                Reminder
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                {bill.reminderType === 'none'
                  ? 'Silent'
                  : bill.reminderDaysBefore === 0
                  ? 'On due day'
                  : `${bill.reminderDaysBefore} days before`}
              </span>
            </div>

            {bill.accountNumberLast4 && (
              <div className="p-3 rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
                <span className="text-zinc-400 block font-semibold text-[10.5px] mb-0.5">
                  Account / Card
                </span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                  •••• {bill.accountNumberLast4}
                </span>
              </div>
            )}

            {bill.referenceNumber && (
              <div className="col-span-2 p-3 rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
                <span className="text-zinc-400 block font-semibold text-[10.5px] mb-0.5">
                  Reference / Invoice ID
                </span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                  #{bill.referenceNumber}
                </span>
              </div>
            )}
          </div>

          {/* Payment Portal Button */}
          {bill.billUrl && (
            <a
              href={bill.billUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-[20px] bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-between text-xs font-bold hover:bg-indigo-100/80 transition group"
            >
              <div className="flex items-center gap-2 truncate">
                <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Open Payment Portal / Website</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition" />
            </a>
          )}

          {/* Notes */}
          {bill.notes && (
            <div className="p-3.5 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] text-xs space-y-1">
              <span className="font-bold text-zinc-400 dark:text-zinc-500 text-[11px] block">
                Notes
              </span>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{bill.notes}</p>
            </div>
          )}

          {/* Payment History Log */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 px-1 block">
              Payment History &amp; Log
            </span>
            <div className="p-3.5 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] text-xs">
              {bill.isPaid ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-white block">
                        Paid Successfully
                      </span>
                      <span className="text-[10.5px] text-zinc-400 tabular-nums">
                        Date: {bill.paidDate || bill.dueDate}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {symbol}
                    {bill.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="text-center py-3 text-zinc-400 text-xs">
                  No payment recorded yet for this billing cycle.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Sticky Footer (Delete on left, Edit + Primary Mark Paid CTA on right — matches Tasks) */}
        <div className="shrink-0 bg-white/95 dark:bg-[#141418]/95 border-t border-zinc-200/60 dark:border-zinc-800/70 px-4 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 z-10">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(bill.id);
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
                title="Delete Bill"
              >
                <Trash2 size={13.5} />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                if (bill.archived) {
                  updateBill({
                    ...bill,
                    archived: false,
                    archivedAt: undefined,
                  });
                  pushNotification(
                    'Bill Restored',
                    `${bill.title} moved back to active bills`,
                    'system'
                  );
                  onClose();
                } else {
                  setConfirmArchive(true);
                }
              }}
              className="px-3 sm:px-3.5 py-2 rounded-full text-xs font-bold bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title={bill.archived ? 'Restore Bill' : 'Archive Bill'}
            >
              {bill.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              <span>{bill.archived ? 'Restore' : 'Archive'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onEdit(bill);
                onClose();
              }}
              className="px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </button>

            {!bill.archived && (
              bill.isPaid ? (
                <button
                  type="button"
                  onClick={() => unmarkBillPaid(bill.id)}
                  title="Paid — tap to untick"
                  className="px-4 sm:px-4.5 py-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Check size={14} className="stroke-[2.75]" />
                  <span>Paid</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    markBillPaid(bill.id, bill.amount);
                    onClose();
                  }}
                  className="px-4 sm:px-4.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 tabular-nums whitespace-nowrap shrink-0"
                >
                  <Check size={14} className="stroke-[2.5]" />
                  <span>
                    Pay {symbol}
                    {bill.amount.toLocaleString('en-IN')}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      </motion.div>

      <ArchiveConfirmModal
        isOpen={confirmArchive}
        itemName={bill.title}
        itemType="Bill"
        onConfirm={() => {
          setConfirmArchive(false);
          updateBill({
            ...bill,
            archived: true,
            archivedAt: new Date().toISOString(),
          });
          pushNotification('Bill Archived', `${bill.title} moved to archive`, 'system');
          onClose();
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>,
    document.body
  );
};
