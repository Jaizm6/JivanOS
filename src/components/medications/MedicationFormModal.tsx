import React, { useState, useEffect } from 'react';
import {
  Pill,
  Droplet,
  Syringe,
  Wind,
  Calendar,
  Bell,
  BellOff,
  AlarmClock,
  Volume2,
  Package,
  Plus,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  Medication,
  MedicationFrequency,
  DoseSchedule,
  ReminderType,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  UnifiedFormModal,
  UnifiedSubModal,
  FormHeroTitleCard,
  FormSectionGroup,
  FormDisclosureRow,
  FormStylePopoverContent,
} from '../common/FormPrimitives';
import { getPetalGroupRadiusClass } from '../common/PetalExpressive';

const getTodayStr = () => new Date().toISOString().split('T')[0];

const MED_PRESETS: {
  name: string;
  dosage: string;
  instructions: string;
  iconType: Medication['iconType'];
  color: string;
}[] = [
  { name: 'Vitamin D3', dosage: '60000 IU', instructions: 'After food', iconType: 'capsule', color: '#f59e0b' },
  { name: 'Omega 3', dosage: '1000 mg', instructions: 'With meal', iconType: 'capsule', color: '#0ea5e9' },
  { name: 'Multivitamin', dosage: '1 tablet', instructions: 'After food', iconType: 'pill', color: '#10b981' },
  { name: 'Magnesium', dosage: '400 mg', instructions: 'Before sleep', iconType: 'pill', color: '#8b5cf6' },
];

export const MedIconRenderer: React.FC<{
  icon: Medication['iconType'];
  className?: string;
}> = ({ icon, className = 'w-4 h-4' }) => {
  switch (icon) {
    case 'drop':
      return <Droplet className={className} />;
    case 'injection':
      return <Syringe className={className} />;
    case 'inhaler':
      return <Wind className={className} />;
    case 'pill':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <circle cx="12" cy="12" r="8.5" />
          <line x1="6.3" y1="17.7" x2="17.7" y2="6.3" />
        </svg>
      );
    case 'capsule':
    default:
      return <Pill className={className} />;
  }
};

export interface MedicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMed?: Medication | null;
}

export const MedicationFormModal: React.FC<MedicationFormModalProps> = ({
  isOpen,
  onClose,
  editingMed = null,
}) => {
  const { addMedication, updateMedication, deleteMedication, theme, soundEngine } = useApp();
  const isDarkMode = theme === 'dark';

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1 tablet');
  const [instructions, setInstructions] = useState('After food');
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
  const [customDays, setCustomDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [schedules, setSchedules] = useState<DoseSchedule[]>([
    { time: '08:00', label: 'Morning Dose', reminderType: 'notification' },
  ]);
  const [color, setColor] = useState('#3b82f6');
  const [iconType, setIconType] = useState<Medication['iconType']>('pill');
  const [totalPills, setTotalPills] = useState(30);
  const [remainingPills, setRemainingPills] = useState(30);
  const [refillThreshold, setRefillThreshold] = useState(7);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('notification');

  const [activePopup, setActivePopup] = useState<
    null | 'styling' | 'dosage' | 'frequency' | 'schedule' | 'inventory'
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingMed) {
      setName(editingMed.name);
      setDosage(editingMed.dosage || '1 tablet');
      setInstructions(editingMed.instructions || 'After food');
      setFrequency(editingMed.frequency || 'daily');
      setCustomDays(editingMed.customDays || ['Mon', 'Wed', 'Fri']);
      setSchedules(
        editingMed.schedules?.length
          ? editingMed.schedules
          : [{ time: '08:00', label: 'Morning Dose', reminderType: 'notification' }]
      );
      setColor(editingMed.color || '#3b82f6');
      setIconType(editingMed.iconType || 'pill');
      setTotalPills(editingMed.totalPills ?? 30);
      setRemainingPills(editingMed.remainingPills ?? 30);
      setRefillThreshold(editingMed.refillThreshold ?? 7);
      setStartDate(editingMed.startDate || getTodayStr());
      setEndDate(editingMed.endDate || '');
      setReminderType(editingMed.reminderType || 'notification');
    } else {
      setName('');
      setDosage('1 tablet');
      setInstructions('After food');
      setFrequency('daily');
      setCustomDays(['Mon', 'Wed', 'Fri']);
      setSchedules([{ time: '08:00', label: 'Morning Dose', reminderType: 'notification' }]);
      setColor('#3b82f6');
      setIconType('pill');
      setTotalPills(30);
      setRemainingPills(30);
      setRefillThreshold(7);
      setStartDate(getTodayStr());
      setEndDate('');
      setReminderType('notification');
    }
    setActivePopup(null);
    setConfirmDelete(false);
  }, [isOpen, editingMed]);

  const handleFrequencyChange = (freq: MedicationFrequency) => {
    setFrequency(freq);
    if (freq === 'daily') {
      setSchedules([{ time: '08:00', label: 'Morning Dose', reminderType }]);
    } else if (freq === 'twice_daily') {
      setSchedules([
        { time: '08:00', label: 'Morning Dose', reminderType },
        { time: '20:00', label: 'Evening Dose', reminderType },
      ]);
    } else if (freq === 'thrice_daily') {
      setSchedules([
        { time: '08:00', label: 'Morning Dose', reminderType },
        { time: '14:00', label: 'Afternoon Dose', reminderType },
        { time: '20:00', label: 'Night Dose', reminderType },
      ]);
    } else if (freq === 'as_needed') {
      setSchedules([]);
    }
  };

  const applyCourseDaysPreset = (days: number) => {
    const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    setEndDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const normalizedSchedules = schedules.map(s => ({
      ...s,
      reminderType,
    }));

    const payload = {
      name: name.trim(),
      dosage: dosage.trim() || '1 dose',
      instructions: instructions.trim() || 'As directed',
      frequency,
      customDays: frequency === 'weekly_days' ? customDays : undefined,
      schedules: normalizedSchedules,
      color,
      iconType,
      totalPills: Math.max(1, totalPills),
      remainingPills: Math.max(0, remainingPills),
      refillThreshold: Math.max(0, refillThreshold),
      startDate: startDate || getTodayStr(),
      endDate: endDate || undefined,
      active: editingMed ? editingMed.active : true,
      reminderType,
    };

    if (editingMed) {
      updateMedication({
        ...editingMed,
        ...payload,
      });
    } else {
      addMedication(payload);
    }
    onClose();
  };

  const handleTestMedAlert = () => {
    const activeType = reminderType === 'none' ? 'notification' : reminderType;
    if (activeType === 'alarm') {
      soundEngine.playAlarmChime('urgent');
    } else {
      soundEngine.playSuccessChime();
    }
    window.dispatchEvent(
      new CustomEvent('omnilifeos_trigger_alarm', {
        detail: {
          id: `test_med_${Date.now()}`,
          source: 'medication',
          title: `Time for ${name || 'Medication'}`,
          subtitle: `${dosage} · ${instructions}`,
          reminderType: activeType,
        },
      })
    );
  };

  const freqLabelMap: Record<MedicationFrequency, string> = {
    daily: 'Once Daily',
    twice_daily: 'Twice Daily',
    thrice_daily: '3x Daily',
    alternate_days: 'Every 2 Days',
    every_3_days: 'Every 3 Days',
    every_4_days: 'Every 4 Days',
    every_5_days: 'Every 5 Days',
    every_6_days: 'Every 6 Days',
    weekly_days: `Specific Days (${customDays.join(', ')})`,
    weekly: 'Once Weekly',
    as_needed: 'As Needed (PRN)',
    custom_dates: 'Custom Dates',
  };

  return (
    <>
      <UnifiedFormModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingMed ? 'Edit Medication' : 'New Medication'}
        headerShape="cookie9"
        headerIcon={<MedIconRenderer icon={iconType} className="w-4 h-4" />}
        accentColor={color}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {editingMed ? (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        deleteMedication(editingMed.id);
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
                )
              ) : (
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
                  {dosage} · {freqLabelMap[frequency] || frequency} ·{' '}
                  {endDate ? `Until ${endDate}` : `${remainingPills} left`}
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
                disabled={!name.trim()}
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>
        }
      >
        {/* Hero Title Card + Quick Dosage Slot */}
        <FormHeroTitleCard
          value={name}
          onChange={setName}
          placeholder="Medication or supplement name..."
          accentColor={color}
          icon={<MedIconRenderer icon={iconType} className="w-4 h-4" />}
          iconShape="cookie9"
          onIconClick={() => setActivePopup('dosage')}
          iconTooltip="Change Form & Dosage"
          onOpenStyle={() => setActivePopup('styling')}
          isDarkMode={isDarkMode}
          onEnterSubmit={handleSave}
          bottomSlot={
            <div className="flex items-center justify-between gap-2 text-xs">
              <input
                type="text"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder="e.g. 500 mg"
                className="w-28 px-2.5 py-1.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/35 tabular-nums"
              />
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setActivePopup('dosage')}
                className="px-3 py-1.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 capitalize truncate cursor-pointer transition-colors"
              >
                {iconType} · {instructions}
              </button>
            </div>
          }
        />

        {/* Quick Preset Chips when Adding New */}
        {!editingMed && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {MED_PRESETS.map(p => (
              <button
                key={p.name}
                type="button"
                data-no-press-scale="true"
                onClick={() => {
                  setName(p.name);
                  setDosage(p.dosage);
                  setInstructions(p.instructions);
                  setIconType(p.iconType);
                  setColor(p.color);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span style={{ color: p.color }}>
                  <MedIconRenderer icon={p.iconType} className="w-3 h-3" />
                </span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Progressive-Disclosure Settings Rows */}
        <FormSectionGroup>
          {/* 1. Form, Dosage & Instructions */}
          <FormDisclosureRow
            icon={<MedIconRenderer icon={iconType} className="w-3.5 h-3.5" />}
            iconBgClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            iconShape="cookie9"
            label="Form & Instructions"
            value={
              <span className="capitalize">
                {iconType === 'pill' ? 'Tablet (Pill)' : iconType} · {dosage} ({instructions})
              </span>
            }
            onClick={() => setActivePopup('dosage')}
          />

          {/* 2. Frequency & Course Dates */}
          <FormDisclosureRow
            icon={<Calendar size={14} />}
            iconBgClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            iconShape="clover"
            label="Frequency & Course"
            value={`${freqLabelMap[frequency] || frequency}${
              endDate ? ` · Course until ${endDate}` : ' · Ongoing'
            }`}
            onClick={() => setActivePopup('frequency')}
          />

          {/* 3. Dose Times & Reminder Alerts */}
          <FormDisclosureRow
            icon={<Bell size={14} />}
            iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            iconShape="scallop"
            label="Dose Times & Alerts"
            value={
              frequency === 'as_needed'
                ? 'As needed'
                : `${schedules.map(s => s.time).join(', ') || 'None'} · ${
                    reminderType === 'alarm'
                      ? 'Alarm'
                      : reminderType === 'notification'
                      ? 'Chime'
                      : 'Silent'
                  }`
            }
            onClick={() => setActivePopup('schedule')}
          />

          {/* 4. Pill Inventory & Refill Threshold (Hidden when Fixed Course / End Date is active) */}
          {!endDate && (
            <FormDisclosureRow
              icon={<Package size={14} />}
              iconBgClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              iconShape="arch"
              label="Stock & Refill Tracker"
              value={`${remainingPills}/${totalPills} left (Alert ≤ ${refillThreshold})`}
              valueClass={
                remainingPills <= refillThreshold
                  ? 'text-amber-600 dark:text-amber-400 font-bold tabular-nums'
                  : 'text-emerald-600 dark:text-emerald-400 font-bold tabular-nums'
              }
              onClick={() => setActivePopup('inventory')}
            />
          )}
        </FormSectionGroup>
      </UnifiedFormModal>

      {/* SUB-MODAL 1: Color Style */}
      <UnifiedSubModal
        isOpen={activePopup === 'styling'}
        onClose={() => setActivePopup(null)}
        title="Medication Color Tag"
        icon={<Sparkles size={14} className="text-indigo-500" />}
        iconShape="cookie12"
      >
        <FormStylePopoverContent
          accentColor={color}
          onChangeAccentColor={setColor}
          isDarkMode={isDarkMode}
        />
      </UnifiedSubModal>

      {/* SUB-MODAL 2: Form, Dosage & Instructions */}
      <UnifiedSubModal
        isOpen={activePopup === 'dosage'}
        onClose={() => setActivePopup(null)}
        title="Form, Dosage & Instructions"
        icon={<Pill size={14} className="text-blue-500" />}
        iconShape="cookie9"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Medication Form
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'pill', label: 'Tablet' },
                  { id: 'capsule', label: 'Capsule' },
                  { id: 'drop', label: 'Drops' },
                  { id: 'injection', label: 'Syringe' },
                  { id: 'inhaler', label: 'Inhaler' },
                ] as const
              ).map(item => {
                const isSelected = iconType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => setIconType(item.id)}
                    className={`py-2.5 px-1 flex flex-col items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'rounded-full bg-indigo-600 text-white shadow-xs'
                        : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <MedIconRenderer icon={item.id} className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Dosage Strength / Quantity
            </label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              placeholder="e.g. 500 mg, 1 tablet, 5 ml"
              className="w-full px-3.5 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/35"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['1 tablet', '2 tablets', '500 mg', '250 mg', '5 ml', '1 puff'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDosage(p)}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    dosage === p
                      ? 'rounded-full bg-indigo-600 text-white shadow-2xs'
                      : 'rounded-full bg-[#f1f4fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Intake Instructions
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                'After food',
                'Before food',
                'With water',
                'Empty stomach',
                'Before sleep',
                'With meal',
              ].map(inst => (
                <button
                  key={inst}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => setInstructions(inst)}
                  className={`py-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                    instructions === inst
                      ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                      : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Custom instructions..."
              className="w-full px-3.5 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-900 dark:text-white outline-none"
            />
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 3: Frequency & Course Dates */}
      <UnifiedSubModal
        isOpen={activePopup === 'frequency'}
        onClose={() => setActivePopup(null)}
        title="Frequency & Course Duration"
        icon={<Calendar size={14} className="text-violet-500" />}
        iconShape="clover"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
              Schedule Frequency
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'daily', label: 'Once Daily' },
                  { id: 'twice_daily', label: 'Twice Daily' },
                  { id: 'thrice_daily', label: '3x Daily' },
                  { id: 'alternate_days', label: 'Alternate Days' },
                  { id: 'weekly_days', label: 'Specific Days' },
                  { id: 'as_needed', label: 'As Needed (PRN)' },
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  data-no-press-scale="true"
                  onClick={() => handleFrequencyChange(f.id)}
                  className={`py-2 px-3 text-xs font-bold transition-colors cursor-pointer ${
                    frequency === f.id
                      ? 'rounded-full bg-indigo-600 text-white shadow-xs'
                      : 'rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'weekly_days' && (
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">
                Days of Week
              </label>
              <div className="grid grid-cols-7 gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                  const active = customDays.includes(day);
                  const isSunday = day === 'Sun';
                  return (
                    <button
                      key={day}
                      type="button"
                      data-no-press-scale="true"
                      onClick={() =>
                        setCustomDays(prev =>
                          active ? prev.filter(d => d !== day) : [...prev, day]
                        )
                      }
                      className={`h-9 flex items-center justify-center text-[11px] font-mono font-extrabold transition-colors cursor-pointer ${
                        active
                          ? isSunday
                            ? 'rounded-full bg-rose-500 text-white shadow-xs'
                            : 'rounded-full bg-indigo-600 text-white shadow-xs'
                          : isSunday
                          ? 'rounded-[12px] bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400'
                          : 'rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {day.charAt(0)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Course Mode: Ongoing vs Fixed Course / Deadline */}
          <div className="space-y-2.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Course Duration Mode
              </label>
              <div className="inline-flex p-0.5 rounded-full bg-[#f3f5fa] dark:bg-[#111116]">
                <button
                  type="button"
                  onClick={() => setEndDate('')}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                    !endDate
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Ongoing (Refill)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!endDate) applyCourseDaysPreset(7);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition cursor-pointer ${
                    endDate
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Fixed Course / Deadline
                </button>
              </div>
            </div>

            {endDate && (
              <div className="flex flex-wrap gap-1.5">
                {[3, 5, 7, 10, 14, 30].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => applyCourseDaysPreset(d)}
                    className="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10.5px] font-bold transition cursor-pointer"
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
                  {endDate ? 'Course End Date' : 'End Date (Optional)'}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-bold text-zinc-900 dark:text-white outline-none"
                />
              </div>
            </div>
            {endDate && (
              <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                Fixed course active: Stock &amp; Refill Tracker is hidden and replaced with a Course Deadline countdown.
              </p>
            )}
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 4: Dose Schedule & Alert Delivery */}
      <UnifiedSubModal
        isOpen={activePopup === 'schedule'}
        onClose={() => setActivePopup(null)}
        title="Dose Times & Alerts"
        icon={<Bell size={14} className="text-amber-500" />}
        iconShape="scallop"
      >
        <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          {/* Alert Delivery Mode */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Reminder Alert Mode
              </label>
              <button
                type="button"
                onClick={handleTestMedAlert}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
              >
                <Volume2 size={11} />
                <span>Test Alert</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-[3px] p-1 rounded-full bg-[#f1f4fa] dark:bg-[#111116]">
              {[
                { id: 'none' as ReminderType, label: 'Silent', icon: <BellOff size={14} /> },
                { id: 'notification' as ReminderType, label: 'Chime', icon: <Bell size={14} /> },
                { id: 'alarm' as ReminderType, label: 'Alarm', icon: <AlarmClock size={14} /> },
              ].map((m, idx) => {
                const isSelected = reminderType === m.id;
                const segShape = isSelected
                  ? 'rounded-full'
                  : idx === 0
                  ? 'rounded-l-full rounded-r-[6px]'
                  : idx === 2
                  ? 'rounded-r-full rounded-l-[6px]'
                  : 'rounded-[6px]';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setReminderType(m.id)}
                    className={`${segShape} py-2 px-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white/75 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dose Time Slots */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Daily Dose Times
              </label>
              <button
                type="button"
                onClick={() =>
                  setSchedules(prev => [
                    ...prev,
                    {
                      time: '12:00',
                      label: `Dose ${prev.length + 1}`,
                      reminderType,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Dose</span>
              </button>
            </div>

            {schedules.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-2">
                No fixed daily times (taken as needed).
              </p>
            ) : (
              <div className="space-y-[3px] max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
                {schedules.map((slot, idx) => (
                  <div
                    key={idx}
                    className={`${getPetalGroupRadiusClass(
                      idx,
                      schedules.length,
                      true
                    )} flex items-center gap-2 p-2 bg-[#f3f5fa] dark:bg-[#111116]`}
                  >
                    <input
                      type="time"
                      value={slot.time}
                      onChange={e =>
                        setSchedules(prev =>
                          prev.map((s, i) => (i === idx ? { ...s, time: e.target.value } : s))
                        )
                      }
                      className="px-2.5 py-1.5 rounded-[12px] bg-white dark:bg-[#18181e] text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none tabular-nums"
                    />
                    <input
                      type="text"
                      value={slot.label}
                      onChange={e =>
                        setSchedules(prev =>
                          prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                        )
                      }
                      placeholder="Dose label..."
                      className="flex-1 px-2.5 py-1.5 rounded-[12px] bg-white dark:bg-[#18181e] text-xs font-medium text-zinc-800 dark:text-zinc-200 min-w-0 outline-none"
                    />
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSchedules(prev => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-zinc-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </UnifiedSubModal>

      {/* SUB-MODAL 5: Inventory & Refill Tracker */}
      <UnifiedSubModal
        isOpen={activePopup === 'inventory'}
        onClose={() => setActivePopup(null)}
        title="Pill Stock & Refill Alert"
        icon={<Package size={14} className="text-emerald-500" />}
        iconShape="arch"
      >
        <div className="space-y-3.5 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
                Current Stock
              </label>
              <input
                type="number"
                min={0}
                value={remainingPills}
                onChange={e => setRemainingPills(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
                Full Pack Size
              </label>
              <input
                type="number"
                min={1}
                value={totalPills}
                onChange={e => setTotalPills(Math.max(1, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-sm font-mono font-bold text-zinc-900 dark:text-white outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[10, 15, 30, 60, 90].map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  setTotalPills(sz);
                  if (!editingMed) setRemainingPills(sz);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer tabular-nums ${
                  totalPills === sz
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#f1f4fa] dark:bg-[#111116] text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {sz} pack
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 block">
              Low Supply Alert Threshold ({refillThreshold === 0 ? 'When empty (0)' : `≤ ${refillThreshold} left`})
            </label>
            <input
              type="number"
              min={0}
              value={refillThreshold}
              onChange={e => setRefillThreshold(Math.max(0, Number(e.target.value)))}
              className="w-full px-3.5 py-2.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-mono font-bold text-zinc-900 dark:text-white outline-none tabular-nums"
            />
          </div>
        </div>
      </UnifiedSubModal>
    </>
  );
};
