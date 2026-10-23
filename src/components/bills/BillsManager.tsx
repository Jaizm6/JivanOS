import React, { useState } from 'react';
import {
  CreditCard,
  Zap,
  Droplets,
  Home,
  Wifi,
  Tv,
  Shield,
  Plus,
  Check,
  Calendar,
  AlertTriangle,
  Clock,
  IndianRupee,
  ArrowRightLeft,
  TrendingDown,
  Trash2,
  Edit2,
  ReceiptText,
  X,
  CheckCircle2,
  Users,
  RotateCcw,
  MoreHorizontal,
  ChevronDown,
  Bell,
  BellOff,
  AlarmClock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Bill, BillCategory, BillRecurring, ReminderType } from '../../types';
import { soundEngine } from '../../utils/audio';
import { CurrencyConverterModal } from './CurrencyConverterModal';
import { BillSplitterModal } from './BillSplitterModal';
import { BillDetailModal } from './BillDetailModal';
import { QuoteBanner } from '../common/QuoteBanner';
import { ActivityManager } from '../common/ActivityManager';

export const BillsManager: React.FC = () => {
  const {
    bills,
    addBill,
    updateBill,
    deleteBill,
    markBillPaid,
    currency = 'INR',
    currencySymbol = '₹',
    setCurrency,
    resetBillsToIndianDefaults,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<BillCategory | 'all'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [showSplitterModal, setShowSplitterModal] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [selectedBillDetail, setSelectedBillDetail] = useState<Bill | null>(null);

  // Pay Modal
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BillCategory>('credit_card');
  const [amount, setAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('₹');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState<BillRecurring>('monthly');
  const [autoPay, setAutoPay] = useState(false);
  const [accountNumberLast4, setAccountNumberLast4] = useState('');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [reminderType, setReminderType] = useState<ReminderType>('notification');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#2563eb');

  const todayStr = new Date().toISOString().split('T')[0];

  const categoryIcons: Record<BillCategory, { icon: React.ReactNode; label: string; defaultColor: string }> = {
    credit_card: { icon: <CreditCard className="w-5 h-5" />, label: 'Credit Card', defaultColor: '#2563eb' },
    electricity: { icon: <Zap className="w-5 h-5" />, label: 'Electricity / Light', defaultColor: '#f59e0b' },
    water: { icon: <Droplets className="w-5 h-5" />, label: 'Water', defaultColor: '#06b6d4' },
    rent: { icon: <Home className="w-5 h-5" />, label: 'Rent / Mortgage', defaultColor: '#8b5cf6' },
    internet: { icon: <Wifi className="w-5 h-5" />, label: 'Internet / Phone', defaultColor: '#10b981' },
    subscription: { icon: <Tv className="w-5 h-5" />, label: 'Subscription / Streaming', defaultColor: '#ec4899' },
    insurance: { icon: <Shield className="w-5 h-5" />, label: 'Insurance', defaultColor: '#6366f1' },
    other: { icon: <ReceiptText className="w-5 h-5" />, label: 'Other Expenses', defaultColor: '#64748b' },
  };

  const filteredBills = bills.filter(b => {
    if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
    if (filterPaid === 'unpaid' && b.isPaid) return false;
    if (filterPaid === 'paid' && !b.isPaid) return false;
    return true;
  });

  // Calculate statistics
  const totalUnpaidAmount = bills
    .filter(b => !b.isPaid)
    .reduce((sum, b) => sum + b.amount, 0);

  const totalPaidAmount = bills
    .filter(b => b.isPaid)
    .reduce((sum, b) => sum + b.amount, 0);

  // Due within 3 days
  const soonDueBills = bills.filter(b => {
    if (b.isPaid) return false;
    const diff = (new Date(b.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
    return diff >= 0 && diff <= 3;
  });

  const overdueBills = bills.filter(b => {
    if (b.isPaid) return false;
    return b.dueDate < todayStr;
  });

  const openAddModal = (presetAmount?: number, presetCurrency?: string) => {
    setEditingBill(null);
    setTitle('');
    setCategory('credit_card');
    setAmount(presetAmount !== undefined ? presetAmount.toString() : '');
    setFormCurrency(presetCurrency || currencySymbol || '₹');
    setDueDate(new Date().toISOString().split('T')[0]);
    setRecurring('monthly');
    setAutoPay(false);
    setAccountNumberLast4('');
    setReminderDaysBefore(3);
    setReminderType('notification');
    setNotes('');
    setColor('#2563eb');
    setShowAddModal(true);
  };

  const openEditModal = (b: Bill) => {
    setEditingBill(b);
    setTitle(b.title);
    setCategory(b.category);
    setAmount(b.amount.toString());
    setFormCurrency(b.currency || currencySymbol || '₹');
    setDueDate(b.dueDate);
    setRecurring(b.recurring);
    setAutoPay(b.autoPay);
    setAccountNumberLast4(b.accountNumberLast4 || '');
    setReminderDaysBefore(b.reminderDaysBefore);
    setReminderType(b.reminderType || 'notification');
    setNotes(b.notes || '');
    setColor(b.color);
    setShowAddModal(true);
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount)) return;

    if (editingBill) {
      updateBill({
        ...editingBill,
        title: title.trim(),
        category,
        amount: parsedAmount,
        currency: formCurrency,
        dueDate,
        recurring,
        autoPay,
        accountNumberLast4: accountNumberLast4.trim() || undefined,
        reminderDaysBefore,
        reminderType,
        notes: notes.trim() || undefined,
        color,
      });
    } else {
      addBill({
        title: title.trim(),
        category,
        amount: parsedAmount,
        currency: formCurrency,
        dueDate,
        recurring,
        autoPay,
        isPaid: false,
        accountNumberLast4: accountNumberLast4.trim() || undefined,
        reminderDaysBefore,
        reminderType,
        notes: notes.trim() || undefined,
        color,
      });
    }

    setShowAddModal(false);
  };

  const handleOpenPay = (b: Bill) => {
    setPayingBill(b);
    setPayAmount(b.amount.toString());
  };

  const handleConfirmPayment = () => {
    if (payingBill) {
      const amt = parseFloat(payAmount) || payingBill.amount;
      markBillPaid(payingBill.id, amt);
      setPayingBill(null);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200 pb-4">
      {/* Bills Title Bar */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
            <ReceiptText className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Financial Bills
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {bills.length} bills
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Track upcoming bills and subscriptions
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          {/* Consolidated Tools Menu */}
          <div className="relative">
            <button
              id="btn-bills-more-tools"
              onClick={() => setIsMoreActionsOpen(!isMoreActionsOpen)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-2xs cursor-pointer"
              title="More bill tools and utilities"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isMoreActionsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMoreActionsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 origin-top-right">
                  <div className="p-1 space-y-0.5">
                    <button
                      id="btn-bill-splitter"
                      onClick={() => {
                        setShowSplitterModal(true);
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-left"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Split Group Bill</span>
                    </button>

                    <button
                      id="btn-currency-converter"
                      onClick={() => {
                        setShowConverterModal(true);
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition text-left"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Currency Converter</span>
                    </button>
                  </div>

                  <div className="p-1">
                    <button
                      id="btn-reset-indian-bills"
                      onClick={() => {
                        resetBillsToIndianDefaults();
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition text-left"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Reset to ₹ Template Bills</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Add Bill */}
          <button
            id="btn-add-bill"
            onClick={() => openAddModal()}
            className="p-1 sm:px-2.5 sm:py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition active:scale-95 shrink-0 cursor-pointer flex items-center justify-center"
            title="Add Bill"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget (Positioned under the top bills header) */}
      <QuoteBanner />

      {/* Overdue / Soon Due Warning Alert */}
      {(overdueBills.length > 0 || soonDueBills.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs sm:text-sm">Attention: Upcoming Payments</h4>
            <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">
              {overdueBills.length > 0
                ? `${overdueBills.length} bill(s) are currently overdue! `
                : ''}
              {soonDueBills.length > 0
                ? `${soonDueBills.length} bill(s) are due within the next 72 hours.`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{Math.round(totalUnpaidAmount).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Due / Unpaid</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{Math.round(totalPaidAmount).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Paid this Cycle</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {soonDueBills.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Due within 3 Days</div>
          </div>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Paid / Unpaid toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
          {(['unpaid', 'paid', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterPaid(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition whitespace-nowrap shrink-0 ${
                filterPaid === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab === 'unpaid' ? 'Pending Bills' : tab === 'paid' ? 'Paid Bills' : 'All Bills'}
            </button>
          ))}
        </div>

        {/* Category Pill Select */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap shrink-0 transition ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            All Categories
          </button>
          {(Object.keys(categoryIcons) as BillCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{categoryIcons[cat].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bills Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredBills.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <ReceiptText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No bills match your filters</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Add your monthly credit cards, utilities, or recurring subscriptions.
            </p>
          </div>
        ) : (
          filteredBills.map(bill => {
            const isOverdue = !bill.isPaid && bill.dueDate < todayStr;
            const isSoon =
              !bill.isPaid &&
              bill.dueDate >= todayStr &&
              (new Date(bill.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24) <= 3;

            return (
              <div
                key={bill.id}
                id={`bill-card-${bill.id}`}
                className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-2xs flex flex-col justify-between ${
                  isOverdue
                    ? 'border-rose-400/80 dark:border-rose-800/80'
                    : isSoon
                    ? 'border-amber-400/80 dark:border-amber-800/80'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${bill.color}18`, color: bill.color }}
                    >
                      {categoryIcons[bill.category]?.icon || <ReceiptText className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4
                          onClick={() => setSelectedBillDetail(bill)}
                          className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                        >
                          {bill.title}
                        </h4>
                        {bill.accountNumberLast4 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                            •••• {bill.accountNumberLast4}
                          </span>
                        )}
                        {bill.autoPay && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded">
                            AutoPay
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{categoryIcons[bill.category]?.label || bill.category}</span>
                        <span>•</span>
                        <span className="capitalize">{bill.recurring}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount Badge */}
                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {bill.currency || '₹'}
                      {bill.amount.toLocaleString('en-IN')}
                    </div>
                    <div
                      className={`text-[10px] font-bold mt-0.2 ${
                        bill.isPaid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : isSoon
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {bill.isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : `Due ${bill.dueDate}`}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-500">
                    {bill.isPaid ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="w-3 h-3" />
                        Paid {bill.paidDate || 'today'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Remind {bill.reminderDaysBefore}d before
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!bill.isPaid ? (
                      <button
                        onClick={() => handleOpenPay(bill)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Mark Paid
                      </button>
                    ) : (
                      <button
                        onClick={() => updateBill({ ...bill, isPaid: false, paidDate: undefined })}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
                      >
                        Mark Unpaid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mark As Paid Confirm Modal */}
      {payingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white text-center">
              Record Bill Payment
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Log payment for <span className="font-semibold text-slate-800 dark:text-slate-200">{payingBill.title}</span>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount ({payingBill.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono font-bold text-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal ActivityManager Modal for New Bill Creation */}
      {showAddModal && !editingBill && (
        <ActivityManager
          isOpen={showAddModal && !editingBill}
          onClose={() => setShowAddModal(false)}
          type="bill"
        />
      )}

      {/* Edit Bill Modal */}
      {showAddModal && editingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingBill ? 'Edit Bill' : 'New Bill / Utility Reminder'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bill Name / Provider *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Light & Electricity, Amex Card"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => {
                      const newCat = e.target.value as BillCategory;
                      setCategory(newCat);
                      setColor(categoryIcons[newCat].defaultColor);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  >
                    <option value="credit_card">💳 Credit Card</option>
                    <option value="electricity">⚡ Electricity / Light</option>
                    <option value="water">💧 Water</option>
                    <option value="rent">🏠 Rent / Housing</option>
                    <option value="internet">📶 Internet / Telecom</option>
                    <option value="subscription">📺 Subscription</option>
                    <option value="insurance">🛡️ Insurance</option>
                    <option value="other">🧾 Other Utility</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount & Currency *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formCurrency}
                      onChange={e => setFormCurrency(e.target.value)}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold shrink-0 text-xs"
                    >
                      <option value="₹">₹ (INR)</option>
                      <option value="$">$ (USD)</option>
                      <option value="€">€ (EUR)</option>
                      <option value="£">£ (GBP)</option>
                      <option value="د.إ">د.إ (AED)</option>
                      <option value="¥">¥ (JPY)</option>
                      <option value="C$">C$ (CAD)</option>
                      <option value="A$">A$ (AUD)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={recurring}
                    onChange={e => setRecurring(e.target.value as BillRecurring)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-Time Payment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Card / Account Last 4
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4082"
                    value={accountNumberLast4}
                    onChange={e => setAccountNumberLast4(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Remind Days Before
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={reminderDaysBefore}
                    onChange={e => setReminderDaysBefore(parseInt(e.target.value, 10) || 3)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Reminder Type: None vs Notification vs Alarm */}
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Reminder Delivery Mode</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {reminderType === 'alarm' ? 'Plays audio chime & alert banner' : reminderType === 'notification' ? 'Standard notification' : 'No sound or alerts (Disabled)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReminderType('none')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition ${
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
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition ${
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
                      soundEngine?.playSuccessChime();
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition ${
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autopay-check"
                  checked={autoPay}
                  onChange={e => setAutoPay(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autopay-check" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  AutoPay enabled on bank / card portal
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Website portal, login hints, or customer ID"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {editingBill ? 'Save Changes' : 'Add Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Currency Converter Tool Modal */}
      <CurrencyConverterModal
        isOpen={showConverterModal}
        onClose={() => setShowConverterModal(false)}
        onApplyToBill={(convertedAmount, targetCurrency) => {
          setShowConverterModal(false);
          openAddModal(convertedAmount, targetCurrency);
        }}
      />
      {/* Bill Detail Modal */}
      {selectedBillDetail && (
        <BillDetailModal
          bill={selectedBillDetail}
          onClose={() => setSelectedBillDetail(null)}
          onEdit={(b) => {
            setSelectedBillDetail(null);
            openEditModal(b);
          }}
          onDelete={(id) => {
            deleteBill(id);
            setSelectedBillDetail(null);
          }}
        />
      )}
      <BillSplitterModal
        isOpen={showSplitterModal}
        onClose={() => setShowSplitterModal(false)}
        onAddToBills={(newBill) => {
          addBill({
            title: newBill.title,
            category: newBill.category || 'other',
            amount: newBill.amount,
            currency: '₹',
            dueDate: new Date().toISOString().split('T')[0],
            recurring: 'one_time',
            autoPay: false,
            isPaid: false,
            reminderDaysBefore: 1,
            color: '#6366f1',
          });
        }}
      />
    </div>
  );
};
