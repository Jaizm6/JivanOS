import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  ReceiptText,
  CheckCircle2,
  Users,
  MoreHorizontal,
  ChevronDown,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  X,
  Wallet,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Bill, BillCategory } from '../../types';
import { getSafeFontColor } from '../../utils/activityStyles';
import { soundEngine } from '../../utils/audio';
import { CurrencyConverterModal } from './CurrencyConverterModal';
import { BillSplitterModal } from './BillSplitterModal';
import { BillDetailModal } from './BillDetailModal';
import { BillFormModal } from './BillFormModal';
import { CardCalendarButton } from '../common/CardReminderCalendarModal';
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

export const BillsManager: React.FC = () => {
  const {
    bills,
    addBill,
    updateBill,
    deleteBill,
    markBillPaid,
    unmarkBillPaid,
    pushNotification,
    theme,
    currencySymbol,
  } = useApp();
  const isDarkMode = theme === 'dark';
  const isDesktopMd = useIsDesktopMd();

  const [selectedCategory, setSelectedCategory] = useState<BillCategory | 'all'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'unpaid' | 'paid' | 'overdue' | 'soon' | 'archived'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'amountDesc' | 'amountAsc' | 'title'>('dueDate');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [showSplitterModal, setShowSplitterModal] = useState(false);
  const [splitterPreset, setSplitterPreset] = useState<{ amount: number; title: string } | null>(null);

  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [activeMenuBillId, setActiveMenuBillId] = useState<string | null>(null);
  const [confirmDeleteBillId, setConfirmDeleteBillId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [selectedBillDetail, setSelectedBillDetail] = useState<Bill | null>(null);
  const [presetAmount, setPresetAmount] = useState<number | undefined>(undefined);
  const [pendingArchiveBill, setPendingArchiveBill] = useState<Bill | null>(null);

  // Pay Modal
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  useModalScrollLock(Boolean(payingBill));

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const categoryIcons: Record<
    BillCategory,
    { icon: React.ReactNode; label: string; defaultColor: string }
  > = {
    credit_card: {
      icon: <CreditCard className="w-4 h-4" />,
      label: 'Card',
      defaultColor: '#2563eb',
    },
    electricity: {
      icon: <Zap className="w-4 h-4" />,
      label: 'Light',
      defaultColor: '#f59e0b',
    },
    water: { icon: <Droplets className="w-4 h-4" />, label: 'Water', defaultColor: '#06b6d4' },
    rent: {
      icon: <Home className="w-4 h-4" />,
      label: 'Rent',
      defaultColor: '#8b5cf6',
    },
    internet: {
      icon: <Wifi className="w-4 h-4" />,
      label: 'WiFi',
      defaultColor: '#10b981',
    },
    subscription: {
      icon: <Tv className="w-4 h-4" />,
      label: 'OTT',
      defaultColor: '#ec4899',
    },
    insurance: {
      icon: <Shield className="w-4 h-4" />,
      label: 'Insure',
      defaultColor: '#6366f1',
    },
    other: {
      icon: <ReceiptText className="w-4 h-4" />,
      label: 'Other',
      defaultColor: '#64748b',
    },
  };

  const activeBills = useMemo(() => bills.filter(b => !b.archived), [bills]);
  const archivedBills = useMemo(() => bills.filter(b => Boolean(b.archived)), [bills]);

  const overdueBills = useMemo(
    () => activeBills.filter(b => !b.isPaid && b.dueDate < todayStr),
    [activeBills, todayStr]
  );

  const soonDueBills = useMemo(() => {
    return activeBills.filter(b => {
      if (b.isPaid) return false;
      const diff = (new Date(b.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= 3;
    });
  }, [activeBills, todayStr]);

  const unpaidBillsCount = useMemo(() => activeBills.filter(b => !b.isPaid).length, [activeBills]);
  const paidBillsCount = useMemo(() => activeBills.filter(b => b.isPaid).length, [activeBills]);

  const totalUnpaidAmount = useMemo(
    () => activeBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.amount, 0),
    [activeBills]
  );
  const totalPaidAmount = useMemo(
    () => activeBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0),
    [activeBills]
  );

  const filteredBills = useMemo(() => {
    const result = bills.filter(b => {
      if (filterPaid === 'archived') {
        if (!b.archived) return false;
      } else {
        if (b.archived) return false;
      }

      if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;

      if (filterPaid === 'unpaid' && b.isPaid) return false;
      if (filterPaid === 'paid' && !b.isPaid) return false;
      if (filterPaid === 'overdue' && (b.isPaid || b.dueDate >= todayStr)) return false;
      if (filterPaid === 'soon') {
        if (b.isPaid) return false;
        const diff = (new Date(b.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
        if (diff < 0 || diff > 3) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = b.title.toLowerCase().includes(q);
        const matchesCategory = b.category.toLowerCase().includes(q);
        const matchesAccount = b.accountNumberLast4?.includes(q);
        const matchesRef = b.referenceNumber?.toLowerCase().includes(q);
        const matchesNotes = b.notes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesAccount && !matchesRef && !matchesNotes) {
          return false;
        }
      }

      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
      if (sortBy === 'amountDesc') return b.amount - a.amount;
      if (sortBy === 'amountAsc') return a.amount - b.amount;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [bills, selectedCategory, filterPaid, searchQuery, sortBy, todayStr]);

  const openAddModal = (initialAmt?: number) => {
    setEditingBill(null);
    setPresetAmount(initialAmt);
    setShowAddModal(true);
  };

  const openEditModal = (b: Bill) => {
    setEditingBill(b);
    setPresetAmount(undefined);
    setShowAddModal(true);
    setActiveMenuBillId(null);
    setConfirmDeleteBillId(null);
  };

  const handleDuplicateBill = (b: Bill) => {
    const { id: _id, paymentHistory: _ph, ...rest } = b;
    addBill({
      ...rest,
      title: `${b.title} (Copy)`,
      isPaid: false,
      paidDate: undefined,
    });
    try { soundEngine.playClick(); } catch {}
    pushNotification('Bill Duplicated', `Created a copy of ${b.title}`, 'system');
    setActiveMenuBillId(null);
  };

  const handleConfirmDeleteBill = (id: string, title: string) => {
    deleteBill(id);
    try { soundEngine.playClick(); } catch {}
    pushNotification('Bill Deleted', `Removed ${title}`, 'system');
    setActiveMenuBillId(null);
    setConfirmDeleteBillId(null);
  };

  const handleOpenSplitterForBill = (b: Bill) => {
    setSplitterPreset({ amount: b.amount, title: b.title });
    setShowSplitterModal(true);
    setActiveMenuBillId(null);
  };

  const handleOpenPay = (b: Bill) => {
    setPayingBill(b);
    setPayAmount(b.amount.toString());
  };

  const handleConfirmPayment = () => {
    if (payingBill) {
      const amt = parseFloat(payAmount) || payingBill.amount;
      markBillPaid(payingBill.id, amt);
      try { soundEngine.playSuccessChime(); } catch {}
      pushNotification(
        'Payment Recorded',
        `Marked ${payingBill.title} as paid (${payingBill.currency || '₹'}${amt.toLocaleString('en-IN')})`,
        'system'
      );
      setPayingBill(null);
    }
  };

  const handleRevertPayment = (b: Bill) => {
    unmarkBillPaid(b.id);
  };

  const executeToggleArchiveBill = (b: Bill) => {
    const wasArchived = Boolean(b.archived);
    updateBill({
      ...b,
      archived: !wasArchived,
      archivedAt: !wasArchived ? new Date().toISOString() : undefined,
    });
    try { soundEngine.playClick(); } catch {}
    pushNotification(
      wasArchived ? 'Bill Restored' : 'Bill Archived',
      wasArchived ? `${b.title} moved back to active bills` : `${b.title} moved to archive`,
      'system'
    );
    setActiveMenuBillId(null);
  };

  const handleToggleArchiveBill = (b: Bill) => {
    setActiveMenuBillId(null);
    if (b.archived) {
      executeToggleArchiveBill(b);
    } else {
      setPendingArchiveBill(b);
    }
  };

  const getDueBadgeInfo = (bill: Bill) => {
    if (bill.isPaid) {
      return {
        label: bill.paidDate ? `Paid ${bill.paidDate}` : 'Paid',
        tone: 'paid' as const,
      };
    }
    const dueTime = new Date(bill.dueDate + 'T00:00:00').getTime();
    const nowTime = new Date(todayStr + 'T00:00:00').getTime();
    const diffDays = Math.round((dueTime - nowTime) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      const overdueBy = Math.abs(diffDays);
      return {
        label: overdueBy === 1 ? 'Overdue 1d' : `Overdue ${overdueBy}d`,
        tone: 'overdue' as const,
      };
    }
    if (diffDays === 0) return { label: 'Due Today', tone: 'today' as const };
    if (diffDays === 1) return { label: 'Due Tomorrow', tone: 'soon' as const };
    if (diffDays <= 3) return { label: `Due in ${diffDays}d`, tone: 'soon' as const };

    const formatted = new Date(bill.dueDate + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return { label: `Due ${formatted}`, tone: 'upcoming' as const };
  };

  return (
    <div className="space-y-1.5 animate-in fade-in duration-200 pb-6">
      {/* 1. Material 3 Expressive Control Bar */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="p-1 rounded-[20px] flex items-center justify-between gap-1.5 w-full min-w-0 max-w-full relative z-20"
      >
        <div className="inline-flex items-center gap-[2px] p-0.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs overflow-x-auto no-scrollbar min-w-0">
          {(
            [
              { id: 'unpaid', label: `Pending (${unpaidBillsCount})` },
              { id: 'paid', label: `Paid (${paidBillsCount})` },
              { id: 'all', label: `All (${activeBills.length})` },
              {
                id: 'archived',
                label: archivedBills.length > 0 ? `Archived (${archivedBills.length})` : 'Archived',
              },
            ] as const
          ).map((tab, idx, tabs) => {
            const isActive = filterPaid === tab.id;
            const shapeClass = isActive
              ? 'rounded-full'
              : idx === 0
              ? 'rounded-l-full rounded-r-[6px]'
              : idx === tabs.length - 1
              ? 'rounded-r-full rounded-l-[6px]'
              : 'rounded-[6px]';
            return (
              <button
                key={tab.id}
                onClick={() => setFilterPaid(tab.id)}
                className={`px-3 py-1.5 ${shapeClass} font-bold text-[11px] sm:text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums flex items-center gap-1 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.id === 'archived' && <Archive className="w-3 h-3 shrink-0" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <div className="relative">
            <button
              id="btn-bills-more-tools"
              onClick={() => setIsMoreActionsOpen(!isMoreActionsOpen)}
              className="h-8 inline-flex items-center gap-1 px-2.5 text-xs font-semibold rounded-full bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="More bill utilities"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Tools</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isMoreActionsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMoreActionsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 max-w-[calc(100vw-32px)] bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 rounded-[20px] shadow-xl z-50 p-1.5 text-xs origin-top-right space-y-0.5">
                  <button
                    id="btn-bill-splitter"
                    onClick={() => {
                      setSplitterPreset(null);
                      setShowSplitterModal(true);
                      setIsMoreActionsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-slate-700 dark:text-zinc-200 hover:bg-[#f3f6fc] dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer font-semibold"
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
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-slate-700 dark:text-zinc-200 hover:bg-[#f3f6fc] dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer font-semibold"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Currency Converter</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            id="btn-add-bill"
            type="button"
            onClick={() => openAddModal()}
            className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center"
            title="Add New Bill"
            aria-label="Add New Bill"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. Urgent / Overdue Tonal Notice */}
      {(overdueBills.length > 0 || soonDueBills.length > 0) && (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone={overdueBills.length > 0 ? 'overdue' : 'soon'}
          className="px-3 py-1.5 rounded-[16px] flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold truncate">
              {overdueBills.length > 0 && (
                <strong className="text-rose-600 dark:text-rose-400">
                  {overdueBills.length} Overdue
                </strong>
              )}
              {overdueBills.length > 0 && soonDueBills.length > 0 && ' · '}
              {soonDueBills.length > 0 && (
                <strong className="text-amber-600 dark:text-amber-400">
                  {soonDueBills.length} Due within 3 days
                </strong>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {overdueBills.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterPaid(filterPaid === 'overdue' ? 'unpaid' : 'overdue')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  filterPaid === 'overdue'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 hover:bg-rose-100/70'
                }`}
              >
                Overdue
              </button>
            )}
            {soonDueBills.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterPaid(filterPaid === 'soon' ? 'unpaid' : 'soon')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  filterPaid === 'soon'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70'
                }`}
              >
                Due ≤ 3d
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Material 3 Expressive 3-Column Metrics Strip */}
      <div className="grid grid-cols-3 gap-1.5">
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="overdue"
          className="px-2 py-1.5 rounded-[16px] flex items-center gap-2 min-w-0"
        >
          <PetalShapeBadge
            shape="clover"
            sizeClass="w-7 h-7 hidden sm:flex"
            fillColor={isDarkMode ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(251, 113, 133, 0.35)' : 'rgba(244, 63, 94, 0.25)'}
          >
            <Wallet className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 block truncate">
              Unpaid
            </span>
            <div className="text-[13px] sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate tabular-nums">
              {currencySymbol || '₹'}
              {Math.round(totalUnpaidAmount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div
          data-m3-tonal-card="true"
          data-tonal-tone="paid"
          className="px-2 py-1.5 rounded-[16px] flex items-center gap-2 min-w-0"
        >
          <PetalShapeBadge
            shape="cookie12"
            sizeClass="w-7 h-7 hidden sm:flex"
            fillColor={isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)'}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
              Paid
            </span>
            <div className="text-[13px] sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate tabular-nums">
              {currencySymbol || '₹'}
              {Math.round(totalPaidAmount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div
          data-m3-tonal-card="true"
          data-tonal-tone="soon"
          className="px-2 py-1.5 rounded-[16px] flex items-center gap-2 min-w-0"
        >
          <PetalShapeBadge
            shape="scallop"
            sizeClass="w-7 h-7 hidden sm:flex"
            fillColor={isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)'}
            strokeColor={isDarkMode ? 'rgba(251, 191, 36, 0.35)' : 'rgba(245, 158, 11, 0.25)'}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </PetalShapeBadge>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block truncate">
              Due ≤ 3d
            </span>
            <div className="text-[13px] sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate tabular-nums">
              {soonDueBills.length}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Search, Sort & Category Filter Strip */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search bills, card last 4, ref..."
              className="w-full h-7.5 pl-8.5 pr-8 rounded-full border border-slate-300/85 dark:border-zinc-700 bg-white dark:bg-[#111319] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'dueDate' | 'amountDesc' | 'amountAsc' | 'title')}
            aria-label="Sort bills"
            className="h-7.5 px-2.5 rounded-full border border-slate-300/85 dark:border-zinc-700 bg-white dark:bg-[#111319] text-[11px] font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/35 shrink-0"
          >
            <option value="dueDate">Due Soonest</option>
            <option value="amountDesc">Amount ↓</option>
            <option value="amountAsc">Amount ↑</option>
            <option value="title">Name A–Z</option>
          </select>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white/90 dark:bg-[#11131b] text-slate-600 dark:text-zinc-400 border border-slate-200/85 dark:border-zinc-800 hover:bg-[#f4f7fc] dark:hover:bg-zinc-900'
            }`}
          >
            All
          </button>
          {(Object.keys(categoryIcons) as BillCategory[]).map(cat => {
            const isCatActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 cursor-pointer ${
                  isCatActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white/90 dark:bg-[#11131b] text-slate-600 dark:text-zinc-400 border border-slate-200/85 dark:border-zinc-800 hover:bg-[#f4f7fc] dark:hover:bg-zinc-900'
                }`}
              >
                <span style={{ color: isCatActive ? '#ffffff' : categoryIcons[cat].defaultColor }}>
                  {categoryIcons[cat].icon}
                </span>
                <span>{categoryIcons[cat].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Material 3 Expressive Bill Cards */}
      {filteredBills.length === 0 ? (
        <div
          data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="col-span-full p-7 rounded-[22px] text-center space-y-2 flex flex-col items-center"
          >
            <PetalShapeBadge
              shape="arch"
              sizeClass="w-12 h-12"
              fillColor={isDarkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(79, 70, 229, 0.1)'}
              strokeColor={isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(79, 70, 229, 0.2)'}
            >
              <ReceiptText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </PetalShapeBadge>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {filterPaid === 'archived' && !searchQuery && selectedCategory === 'all'
                ? 'No archived bills'
                : 'No bills match your filters'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">
              {searchQuery
                ? `No results for "${searchQuery}". Clear your search or filters.`
                : filterPaid === 'archived'
                ? 'Paid or unneeded bills you archive will appear here for safe keeping or restoration.'
                : 'Add your utilities, subscriptions, rent, or credit cards to stay ahead.'}
            </p>
            {(searchQuery || selectedCategory !== 'all' || filterPaid !== 'unpaid') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setFilterPaid('all');
                }}
                className="mt-1 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          (() => {
            const renderBillCard = (bill: Bill, idx: number, colTotal: number) => {
              const badgeInfo = getDueBadgeInfo(bill);
              const catMeta = categoryIcons[bill.category] || categoryIcons.other;
              const accent = bill.color || catMeta.defaultColor;
              const safeTitleColor = getSafeFontColor(bill.fontColor, isDarkMode);
              const petalRadius = getPetalGroupRadiusClass(idx, colTotal, false);
              const tonalTone = bill.archived ? 'archived' : 'neutral';

              return (
                <div
                  key={bill.id}
                  id={`bill-card-${bill.id}`}
                  data-m3-tonal-card="true"
                  data-tonal-tone={tonalTone}
                  className={`group relative p-2.5 sm:p-3 ${petalRadius} flex flex-col justify-between gap-1.5 transition-colors`}
                >
                {/* Top Row: Petal Badge + Unboxed Details + Hero Tabular Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <PetalShapeBadge
                      shape={bill.isPaid ? 'cookie12' : 'arch'}
                      sizeClass="w-8 h-8 mt-0.5"
                      fillColor={`${accent}1f`}
                      strokeColor={`${accent}45`}
                    >
                      <span style={{ color: accent }}>{catMeta.icon}</span>
                    </PetalShapeBadge>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <h4
                          onClick={() => setSelectedBillDetail(bill)}
                          style={safeTitleColor ? { color: safeTitleColor } : undefined}
                          className={`text-[14px] leading-snug tracking-tight cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate ${
                            bill.isBold ? 'font-extrabold' : 'font-bold'
                          } text-slate-900 dark:text-white ${
                            bill.fontType === 'mono'
                              ? 'font-mono'
                              : bill.fontType === 'serif'
                              ? 'font-serif'
                              : 'font-sans'
                          }`}
                          title="View bill details"
                        >
                          {bill.title}
                        </h4>

                        {bill.billUrl && (
                          <a
                            href={bill.billUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-0.5 rounded-full text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shrink-0"
                            title="Open payment portal"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Clean Unboxed Typographic Metadata Line */}
                      <div className="flex items-center gap-1 flex-wrap mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                        <span>{catMeta.label}</span>
                        <span aria-hidden="true" className="opacity-50">·</span>
                        <span className="capitalize">{bill.recurring.replace('_', ' ')}</span>
                        {bill.accountNumberLast4 && (
                          <>
                            <span aria-hidden="true" className="opacity-50">·</span>
                            <span className="font-mono text-[10.5px] tabular-nums">
                              •••• {bill.accountNumberLast4}
                            </span>
                          </>
                        )}
                        {bill.autoPay && (
                          <>
                            <span aria-hidden="true" className="opacity-50">·</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              AutoPay
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Hero Amount + Semantic Status Text */}
                  <div className="text-right shrink-0">
                    <div className="text-[15.5px] sm:text-base font-extrabold text-slate-900 dark:text-white font-mono tracking-tight tabular-nums leading-tight">
                      {bill.currency || currencySymbol || '₹'}
                      {bill.amount.toLocaleString('en-IN')}
                    </div>

                    <div
                      className={`mt-0.5 inline-flex items-center justify-end gap-1 text-[10.5px] font-bold ${
                        badgeInfo.tone === 'paid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : badgeInfo.tone === 'overdue'
                          ? 'text-rose-600 dark:text-rose-400'
                          : badgeInfo.tone === 'today' || badgeInfo.tone === 'soon'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {badgeInfo.tone === 'paid' ? (
                        <Check className="w-3 h-3 stroke-[2.75]" />
                      ) : badgeInfo.tone === 'overdue' ? (
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{badgeInfo.label}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-1.5 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs min-w-0">
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
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium truncate tabular-nums">
                      {bill.reminderType === 'none'
                        ? 'Silent'
                        : bill.reminderDaysBefore === 0
                        ? 'Due day'
                        : `${bill.reminderDaysBefore}d prior`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenSplitterForBill(bill)}
                      title="Split bill"
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(bill)}
                      title="Edit Bill"
                      className="w-7 h-7 rounded-full flex items-center justify-center bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteBillId(null);
                          setActiveMenuBillId(activeMenuBillId === bill.id ? null : bill.id);
                        }}
                        title="More options"
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuBillId === bill.id && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => {
                              setActiveMenuBillId(null);
                              setConfirmDeleteBillId(null);
                            }}
                          />
                          <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white dark:bg-[#121217] border border-slate-200/90 dark:border-zinc-800 rounded-[20px] shadow-xl z-40 p-1.5 text-xs space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBillDetail(bill);
                                setActiveMenuBillId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-slate-700 dark:text-zinc-200 hover:bg-[#f4f7fc] dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer font-medium"
                            >
                              <ReceiptText className="w-3.5 h-3.5 text-slate-500" />
                              <span>Full Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateBill(bill)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-slate-700 dark:text-zinc-200 hover:bg-[#f4f7fc] dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer font-medium"
                            >
                              <Copy className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Duplicate</span>
                            </button>

                            {!bill.archived && (
                              <button
                                type="button"
                                onClick={() => handleToggleArchiveBill(bill)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-slate-700 dark:text-zinc-200 hover:bg-[#f4f7fc] dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer font-medium"
                              >
                                <Archive className="w-3.5 h-3.5 text-amber-500" />
                                <span>Archive Bill</span>
                              </button>
                            )}

                            <div className="pt-0.5 border-t border-slate-100 dark:border-zinc-800">
                              {confirmDeleteBillId === bill.id ? (
                                <div className="flex items-center justify-between gap-1 px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeleteBill(bill.id, bill.title)}
                                    className="flex-1 py-1 rounded-full bg-rose-600 text-white text-[10.5px] font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteBillId(null)}
                                    className="flex-1 py-1 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10.5px] font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteBillId(bill.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer font-semibold"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {bill.archived ? (
                      <button
                        type="button"
                        onClick={() => handleToggleArchiveBill(bill)}
                        className="h-7 px-2.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        title="Restore bill to active list"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    ) : !bill.isPaid ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPay(bill)}
                        className="h-7 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                        title="Record Payment"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Pay</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevertPayment(bill)}
                        className="h-7 px-2.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        title="Paid — tap to untick"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                        <span>Paid</span>
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            };

            if (isDesktopMd && filteredBills.length > 1) {
              const [leftBills, rightBills] = distributeIntoTwoColumns(filteredBills);
              return (
                <div className="grid grid-cols-2 gap-2.5 items-start w-full min-w-0">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {leftBills.map((b, idx) => renderBillCard(b, idx, leftBills.length))}
                  </div>
                  <div className="flex flex-col gap-[3px] min-w-0">
                    {rightBills.map((b, idx) => renderBillCard(b, idx, rightBills.length))}
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-[3px] w-full min-w-0">
                {filteredBills.map((b, idx) => renderBillCard(b, idx, filteredBills.length))}
              </div>
            );
          })()
        )}

      {/* Material 3 Expressive Record Payment Modal (Portaled above Bottom Nav Bar) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {payingBill && (
              <div
                key="bill-pay-modal-root"
                data-unified-modal="true"
                className="fixed inset-0 z-[220] flex items-center justify-center p-4 overscroll-none"
              >
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
                  exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
                  className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
                  onClick={() => setPayingBill(null)}
                />
                <motion.div
                  data-unified-modal="true"
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
                  exit={{ opacity: 0, y: 8, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
                  transformTemplate={CRISP_TRANSFORM_TEMPLATE}
                  onClick={e => e.stopPropagation()}
                  className="relative z-10 w-full max-w-sm bg-white dark:bg-[#0d0d11] rounded-[28px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <PetalShapeBadge
                      shape="cookie12"
                      sizeClass="w-11 h-11"
                      fillColor={isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)'}
                      strokeColor={isDarkMode ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)'}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </PetalShapeBadge>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                        Record Payment
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {payingBill.title}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5 rounded-[20px] bg-[#f4f7fc] dark:bg-[#141418]">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                      Amount ({payingBill.currency || currencySymbol || '₹'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[14px] bg-white dark:bg-[#0d0d11] font-mono font-extrabold text-xl text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 tabular-nums"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPayingBill(null)}
                      className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Confirm Paid</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Bill Splitter Modal */}
      {showSplitterModal && (
        <BillSplitterModal
          isOpen={showSplitterModal}
          onClose={() => {
            setShowSplitterModal(false);
            setSplitterPreset(null);
          }}
          presetTotal={splitterPreset?.amount}
          presetTitle={splitterPreset?.title}
          onAddToBills={billDraft => {
            addBill({
              title: billDraft.title,
              amount: billDraft.amount,
              currency: currencySymbol || '₹',
              autoPay: false,
              category: billDraft.category || 'other',
              dueDate: todayStr,
              isPaid: false,
              recurring: 'one_time',
              reminderDaysBefore: 0,
              reminderType: 'notification',
              color: '#6366f1',
            });
            pushNotification(
              'Split Share Added',
              `Logged "${billDraft.title}" (${currencySymbol || '₹'}${billDraft.amount}) in Bills.`,
              'bill'
            );
          }}
        />
      )}

      {/* Currency Converter Modal */}
      {showConverterModal && (
        <CurrencyConverterModal
          isOpen={showConverterModal}
          onClose={() => setShowConverterModal(false)}
          onApplyToBill={amt => {
            setShowConverterModal(false);
            openAddModal(amt);
          }}
        />
      )}

      {/* Bill Detail Modal */}
      <AnimatePresence>
        {selectedBillDetail && (
          <BillDetailModal
            key={selectedBillDetail.id}
            bill={selectedBillDetail}
            onClose={() => setSelectedBillDetail(null)}
            onEdit={bill => {
              setSelectedBillDetail(null);
              openEditModal(bill);
            }}
            onDelete={billId => {
              deleteBill(billId);
              setSelectedBillDetail(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Add / Edit Bill Modal (kept mounted so UnifiedFormModal AnimatePresence animates closed) */}
      <BillFormModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingBill(null);
          setPresetAmount(undefined);
        }}
        editingBill={editingBill}
        initialAmount={presetAmount}
      />

      {/* Archive Confirmation Modal */}
      <ArchiveConfirmModal
        isOpen={Boolean(pendingArchiveBill)}
        itemName={pendingArchiveBill?.title}
        itemType="Bill"
        onConfirm={() => {
          if (pendingArchiveBill) {
            executeToggleArchiveBill(pendingArchiveBill);
            setPendingArchiveBill(null);
          }
        }}
        onCancel={() => setPendingArchiveBill(null)}
      />
    </div>
  );
};
