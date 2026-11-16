import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Zap,
  Droplets,
  Home,
  Wifi,
  Tv,
  ShieldCheck,
  ReceiptText,
  Calendar,
  Bell,
  FileText,
  Check,
  Trash2,
  Sparkles,
  Tag,
  Hash,
  Globe,
  Clock,
} from 'lucide-react';
import { Bill, BillCategory, BillRecurring, ReminderType } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  UnifiedFormModal,
  UnifiedSubModal,
  FormHeroTitleCard,
  FormSectionGroup,
  FormDisclosureRow,
  FormStylePopoverContent,
  CentralizedReminderPicker,
} from '../common/FormPrimitives';
import { M3Switch } from '../common/PetalExpressive';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export const BILL_CATEGORIES: Record<
  BillCategory,
  { label: string; icon: React.ReactNode; defaultColor: string }
> = {
  credit_card: {
    label: 'Card',
    icon: <CreditCard className="w-4 h-4" />,
    defaultColor: '#2563eb',
  },
  electricity: {
    label: 'Light',
    icon: <Zap className="w-4 h-4" />,
    defaultColor: '#f59e0b',
  },
  water: {
    label: 'Water',
    icon: <Droplets className="w-4 h-4" />,
    defaultColor: '#06b6d4',
  },
  rent: {
    label: 'Rent',
    icon: <Home className="w-4 h-4" />,
    defaultColor: '#8b5cf6',
  },
  internet: {
    label: 'WiFi',
    icon: <Wifi className="w-4 h-4" />,
    defaultColor: '#3b82f6',
  },
  subscription: {
    label: 'OTT',
    icon: <Tv className="w-4 h-4" />,
    defaultColor: '#ec4899',
  },
  insurance: {
    label: 'Insure',
    icon: <ShieldCheck className="w-4 h-4" />,
    defaultColor: '#10b981',
  },
  other: {
    label: 'Other',
    icon: <ReceiptText className="w-4 h-4" />,
    defaultColor: '#64748b',
  },
};

const POPULAR_TEMPLATES: {
  label: string;
  icon: React.ReactNode;
  category: BillCategory;
  color: string;
  defaultRecurring: BillRecurring;
}[] = [
  { label: 'Light', icon: <Zap className="w-3.5 h-3.5" />, category: 'electricity', color: '#f59e0b', defaultRecurring: 'monthly' },
  { label: 'WiFi', icon: <Wifi className="w-3.5 h-3.5" />, category: 'internet', color: '#3b82f6', defaultRecurring: 'monthly' },
  { label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" />, category: 'credit_card', color: '#2563eb', defaultRecurring: 'monthly' },
  { label: 'Rent', icon: <Home className="w-3.5 h-3.5" />, category: 'rent', color: '#8b5cf6', defaultRecurring: 'monthly' },
  { label: 'OTT', icon: <Tv className="w-3.5 h-3.5" />, category: 'subscription', color: '#ec4899', defaultRecurring: 'monthly' },
  { label: 'Water', icon: <Droplets className="w-3.5 h-3.5" />, category: 'water', color: '#06b6d4', defaultRecurring: 'monthly' },
  { label: 'Insure', icon: <ShieldCheck className="w-3.5 h-3.5" />, category: 'insurance', color: '#10b981', defaultRecurring: 'yearly' },
];

export interface BillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBill?: Bill | null;
  initialTitle?: string;
  initialAmount?: number;
  initialCategory?: BillCategory;
  initialDueDate?: string;
}

export const BillFormModal: React.FC<BillFormModalProps> = ({
  isOpen,
  onClose,
  editingBill = null,
  initialTitle = '',
  initialAmount,
  initialCategory = 'credit_card',
  initialDueDate,
}) => {
  const { addBill, updateBill, deleteBill, theme, currencySymbol } = useApp();
  const isDarkMode = theme === 'dark';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BillCategory>('credit_card');
  const [amount, setAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState(currencySymbol || '₹');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [recurring, setRecurring] = useState<BillRecurring>('monthly');
  const [autoPay, setAutoPay] = useState(false);
  const [accountNumberLast4, setAccountNumberLast4] = useState('');
  const [billUrl, setBillUrl] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [reminderType, setReminderType] = useState<ReminderType>('notification');
  const [color, setColor] = useState('#2563eb');
  const [fontColor, setFontColor] = useState('');
  const [fontType, setFontType] = useState<'sans' | 'mono' | 'serif' | 'rounded'>('sans');
  const [isBold, setIsBold] = useState(false);

  const [activePopup, setActivePopup] = useState<
    null | 'styling' | 'schedule' | 'category' | 'reminder' | 'payment' | 'notes'
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingBill) {
      setTitle(editingBill.title);
      setCategory(editingBill.category);
      setAmount(editingBill.amount.toString());
      setFormCurrency(editingBill.currency || currencySymbol || '₹');
      setDueDate(editingBill.dueDate);
      setRecurring(editingBill.recurring);
      setAutoPay(editingBill.autoPay);
      setAccountNumberLast4(editingBill.accountNumberLast4 || '');
      setBillUrl(editingBill.billUrl || '');
      setReferenceNumber(editingBill.referenceNumber || '');
      setNotes(editingBill.notes || '');
      setReminderDaysBefore(editingBill.reminderDaysBefore ?? 3);
      setReminderType(editingBill.reminderType || 'notification');
      setColor(editingBill.color || BILL_CATEGORIES[editingBill.category]?.defaultColor || '#2563eb');
      setFontColor(editingBill.fontColor || '');
      setFontType(editingBill.fontType || 'sans');
      setIsBold(Boolean(editingBill.isBold));
    } else {
      setTitle(initialTitle || '');
      setCategory(initialCategory || 'credit_card');
      setAmount(initialAmount !== undefined ? initialAmount.toString() : '');
      setFormCurrency(currencySymbol || '₹');
      setDueDate(initialDueDate || getTodayStr());
      setRecurring('monthly');
      setAutoPay(false);
      setAccountNumberLast4('');
      setBillUrl('');
      setReferenceNumber('');
      setNotes('');
      setReminderDaysBefore(3);
      setReminderType('notification');
      setColor(BILL_CATEGORIES[initialCategory || 'credit_card']?.defaultColor || '#2563eb');
      setFontColor('');
      setFontType('sans');
      setIsBold(false);
    }
    setActivePopup(null);
    setConfirmDelete(false);
  }, [isOpen, editingBill, currencySymbol, initialTitle, initialAmount, initialCategory, initialDueDate]);

  const handleApplyTemplate = (tmpl: typeof POPULAR_TEMPLATES[0]) => {
    setTitle(tmpl.label);
    setCategory(tmpl.category);
    setColor(tmpl.color);
    setRecurring(tmpl.defaultRecurring);
  };

  const handleDateShortcut = (daysFromNow: number | 'end_month' | 'first_next_month') => {
    const d = new Date();
    if (typeof daysFromNow === 'number') {
      d.setDate(d.getDate() + daysFromNow);
    } else if (daysFromNow === 'end_month') {
      d.setMonth(d.getMonth() + 1, 0);
    } else if (daysFromNow === 'first_next_month') {
      d.setMonth(d.getMonth() + 1, 1);
    }
    setDueDate(d.toISOString().split('T')[0]);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const parsedAmount = parseFloat(amount) || 0;

    const payload = {
      title: title.trim(),
      category,
      amount: parsedAmount,
      currency: formCurrency,
      dueDate: dueDate || getTodayStr(),
      recurring,
      autoPay,
      accountNumberLast4: accountNumberLast4.trim() || undefined,
      billUrl: billUrl.trim() || undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      reminderDaysBefore,
      reminderType,
      color,
      fontColor: fontColor || undefined,
      fontType,
      isBold,
    };

    if (editingBill) {
      updateBill({
        ...editingBill,
        ...payload,
      });
    } else {
      addBill({
        ...payload,
        isPaid: false,
      });
    }
    onClose();
  };

  const parsedNum = parseFloat(amount) || 0;
  const formattedDue = dueDate
    ? new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Pick date';

  return (
    <>
      <UnifiedFormModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBill ? 'Edit Bill' : 'New Bill'}
        headerShape="arch"
        headerIcon={BILL_CATEGORIES[category]?.icon || <ReceiptText size={15} />}
        accentColor={color}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {editingBill ? (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        deleteBill(editingBill.id);
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
                )
              ) : (
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                  {parsedNum > 0 ? (
                    <span>
                      <strong className="text-zinc-900 dark:text-white font-mono">
                        {formCurrency}
                        {parsedNum.toLocaleString('en-IN')}
                      </strong>{' '}
                      · {formattedDue}
                    </span>
                  ) : (
                    <span>Enter bill amount</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title.trim()}
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>
        }
      >
        {/* Hero Title Card with Integrated Amount & AutoPay */}
        <FormHeroTitleCard
          value={title}
          onChange={setTitle}
          placeholder="Bill name (e.g. Electricity, Amex, Rent)..."
          accentColor={color}
          icon={BILL_CATEGORIES[category]?.icon || <ReceiptText size={16} />}
          iconShape="arch"
          onIconClick={() => setActivePopup('category')}
          iconTooltip="Change Bill Category"
          onOpenStyle={() => setActivePopup('styling')}
          fontColor={fontColor}
          fontType={fontType}
          isBold={isBold}
          isDarkMode={isDarkMode}
          onEnterSubmit={handleSave}
          bottomSlot={
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <select
                    value={formCurrency}
                    onChange={e => setFormCurrency(e.target.value)}
                    aria-label="Select currency"
                    className="h-9 px-2.5 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-900 dark:text-white font-bold text-xs cursor-pointer outline-none shrink-0"
                  >
                    <option value="₹">₹</option>
                    <option value="$">$</option>
                    <option value="€">€</option>
                    <option value="£">£</option>
                    <option value="د.إ">AED</option>
                    <option value="¥">¥</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    placeholder="0.00"
                    aria-label="Bill amount"
                    className="w-full h-9 px-3 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 placeholder:text-zinc-400 tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setAutoPay(prev => !prev)}
                  className={`h-9 px-3 rounded-full text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                    autoPay
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#f3f5fa] dark:bg-[#111116] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {autoPay ? 'AutoPay On' : 'AutoPay'}
                </button>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[100, 500, 1000, 2000, 5000].map(val => (
                  <button
                    key={val}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => {
                      const curr = parseFloat(amount) || 0;
                      setAmount((curr + val).toString());
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116] text-[10.5px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer tabular-nums whitespace-nowrap shrink-0"
                  >
                    +{formCurrency}
                    {val}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="px-2 py-1 rounded-full text-[10.5px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 ml-auto cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          }
        />

        {/* Quick Utility Templates Strip (Only if adding new) */}
        {!editingBill && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {POPULAR_TEMPLATES.map(tmpl => (
              <button
                key={tmpl.label}
                type="button"
                data-no-press-scale="true"
                onClick={() => handleApplyTemplate(tmpl)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span style={{ color: tmpl.color }}>{tmpl.icon}</span>
                <span>{tmpl.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Compact Progressive-Disclosure Settings Rows (Fits 1 Screen) */}
        <FormSectionGroup>
          {/* 1. Due Date & Billing Cycle */}
          <FormDisclosureRow
            icon={<Calendar size={14} />}
            iconBgClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            iconShape="scallop"
            label="Due Date & Cycle"
            value={
              <span className="capitalize">
                {formattedDue} · {recurring.replace('_', ' ')}
              </span>
            }
            onClick={() => setActivePopup('schedule')}
          />

          {/* 2. Category */}
          <FormDisclosureRow
            icon={<Tag size={14} />}
            iconBgClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            iconShape="cookie9"
            label="Category"
            value={BILL_CATEGORIES[category]?.label || 'Other'}
            onClick={() => setActivePopup('category')}
          />

          {/* 3. Reminder & Alert Delivery */}
          <FormDisclosureRow
            icon={<Bell size={14} />}
            iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            iconShape="clover"
            label="Due Reminder Alert"
            value={
              reminderType === 'none'
                ? 'Silent'
                : `${reminderDaysBefore === 0 ? 'Due day' : `${reminderDaysBefore}d before`} · ${
                    reminderType === 'alarm' ? 'Alarm' : 'Chime'
                  }`
            }
            onClick={() => setActivePopup('reminder')}
          />

          {/* 4. Payment Account & AutoPay */}
          <FormDisclosureRow
            icon={<CreditCard size={14} />}
            iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            iconShape="arch"
            label="Account & AutoPay"
            value={`${autoPay ? 'AutoPay' : 'Manual'}${
              accountNumberLast4 ? ` · •••• ${accountNumberLast4}` : ''
            }`}
            onClick={() => setActivePopup('payment')}
          />

          {/* 5. Notes & Online Payment URL */}
          <FormDisclosureRow
            icon={<FileText size={14} />}
            iconBgClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            iconShape="squircle"
            label="Notes & Portal URL"
            value={
              referenceNumber || billUrl || notes
                ? [referenceNumber && `Ref: ${referenceNumber}`, billUrl && 'Portal URL', notes && 'Notes']
                    .filter(Boolean)
                    .join(' · ')
                : 'Optional'
            }
            valueClass={referenceNumber || billUrl || notes ? 'text-zinc-700 dark:text-zinc-300 font-medium' : 'text-zinc-400'}
            onClick={() => setActivePopup('notes')}
          />
        </FormSectionGroup>
      </UnifiedFormModal>

      {/* SUB-MODAL 1: Styling */}
      <UnifiedSubModal
        isOpen={activePopup === 'styling'}
        onClose={() => setActivePopup(null)}
        title="Bill Style & Colors"
        icon={<Sparkles size={14} className="text-indigo-500" />}
        iconShape="cookie12"
      >
        <FormStylePopoverContent
          accentColor={color}
          onChangeAccentColor={setColor}
          fontColor={fontColor}
          onChangeFontColor={setFontColor}
          fontType={fontType}
          onChangeFontType={setFontType}
          isBold={isBold}
          onChangeIsBold={setIsBold}
          isDarkMode={isDarkMode}
        />
      </UnifiedSubModal>

      {/* SUB-MODAL 2: Due Date & Cycle */}
      <UnifiedSubModal
        isOpen={activePopup === 'schedule'}
        onClose={() => setActivePopup(null)}
        title="Due Date & Cycle"
        icon={<Calendar size={14} className="text-violet-500" />}
        iconShape="scallop"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full h-10 px-3.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/35"
            />
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: 'In 3d', days: 3 },
                { label: 'In 7d', days: 7 },
                { label: 'End of Month', special: 'end_month' as const },
                { label: '1st Next Mo', special: 'first_next_month' as const },
              ].map((shortcut, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => handleDateShortcut(shortcut.special ?? shortcut.days!)}
                  className="px-2.5 py-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116] text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-600 dark:hover:text-violet-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Billing Cycle
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'monthly', label: 'Monthly', desc: 'Every month' },
                { id: 'quarterly', label: 'Quarterly', desc: 'Every 3 months' },
                { id: 'yearly', label: 'Yearly', desc: 'Once a year' },
                { id: 'one_time', label: 'One-Time', desc: 'Single payment' },
              ].map(freq => (
                <button
                  key={freq.id}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setRecurring(freq.id as BillRecurring)}
                  className={`p-3 text-left transition-colors cursor-pointer ${
                    recurring === freq.id
                      ? 'rounded-[20px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40 font-bold'
                      : 'rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{freq.label}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{freq.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 3: Category */}
      <UnifiedSubModal
        isOpen={activePopup === 'category'}
        onClose={() => setActivePopup(null)}
        title="Select Bill Category"
        icon={<Tag size={14} className="text-blue-500" />}
        iconShape="cookie9"
      >
        <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {(Object.keys(BILL_CATEGORIES) as BillCategory[]).map(catKey => {
            const item = BILL_CATEGORIES[catKey];
            const isSelected = category === catKey;
            return (
              <button
                key={catKey}
                type="button"
                data-no-press-scale="true"
                onClick={() => {
                  setCategory(catKey);
                  setColor(item.defaultColor);
                  setActivePopup(null);
                }}
                className={`flex items-center gap-2.5 p-2.5 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40 font-bold shadow-2xs'
                    : 'rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                }`}
              >
                <span
                  className="p-1.5 rounded-full text-white shrink-0"
                  style={{ backgroundColor: item.defaultColor }}
                >
                  {item.icon}
                </span>
                <span className="text-xs truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 4: Reminder & Alert Delivery */}
      <UnifiedSubModal
        isOpen={activePopup === 'reminder'}
        onClose={() => setActivePopup(null)}
        title="Bill Due Reminder"
        icon={<Bell size={14} className="text-amber-500" />}
        iconShape="clover"
      >
        <CentralizedReminderPicker
          reminderType={reminderType}
          onChangeReminderType={setReminderType}
          timingMode="days_before"
          daysBefore={reminderDaysBefore}
          onChangeDaysBefore={setReminderDaysBefore}
          testTitle={title ? `Bill Due: ${title}` : 'Upcoming Bill Payment'}
          testCategory="bill"
        />
      </UnifiedSubModal>

      {/* SUB-MODAL 5: Payment Method & AutoPay */}
      <UnifiedSubModal
        isOpen={activePopup === 'payment'}
        onClose={() => setActivePopup(null)}
        title="Account & AutoPay"
        icon={<CreditCard size={14} className="text-emerald-500" />}
        iconShape="arch"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="flex items-center justify-between p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116]">
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white">
                AutoPay / Standing Instruction
              </div>
              <div className="text-[11px] text-zinc-500">
                Automatically debited on due date
              </div>
            </div>
            <M3Switch checked={autoPay} onChange={setAutoPay} />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Card / Account Last 4 Digits (Optional)
            </label>
            <input
              type="text"
              maxLength={4}
              value={accountNumberLast4}
              onChange={e => setAccountNumberLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 4829"
              className="w-full px-3.5 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/35 tabular-nums"
            />
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 6: Notes, Portal Link & Reference Number */}
      <UnifiedSubModal
        isOpen={activePopup === 'notes'}
        onClose={() => setActivePopup(null)}
        title="Notes & Online Portal"
        icon={<FileText size={14} className="text-rose-500" />}
        iconShape="squircle"
      >
        <div className="space-y-3 bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
              Account / Consumer / Invoice ID
            </label>
            <div className="relative flex items-center">
              <Hash size={13} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="e.g. Consumer #10928374"
                className="w-full pl-9 pr-3 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/35"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
              Payment Portal URL (Optional)
            </label>
            <div className="relative flex items-center">
              <Globe size={13} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="url"
                value={billUrl}
                onChange={e => setBillUrl(e.target.value)}
                placeholder="https://pay.example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/35"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
              Personal Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Billing notes, customer care details..."
              className="w-full p-3 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/35 leading-relaxed resize-none"
            />
          </div>
        </div>
      </UnifiedSubModal>
    </>
  );
};
