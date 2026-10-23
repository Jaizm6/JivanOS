import React, { useState, useMemo } from 'react';
import { Printer, Copy, Check, Clock, Plus, Minus, SlidersHorizontal, FileText } from 'lucide-react';
import { ScheduleItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface PrintableScheduleViewProps {
  selectedDate: string;
  items: ScheduleItem[];
  onToggleItem: (id: string) => void;
}

const formatHourLabel = (h24: number): string => {
  if (h24 === 0) return '12 AM';
  if (h24 < 12) return `${h24} AM`;
  if (h24 === 12) return '12 PM';
  return `${h24 - 12} PM`;
};

export const PrintableScheduleView: React.FC<PrintableScheduleViewProps> = ({
  selectedDate,
  items,
  onToggleItem,
}) => {
  const {
    scheduleStartHour,
    setScheduleStartHour,
    scheduleEndHour,
    setScheduleEndHour,
    addEarlierScheduleHour,
    removeEarlierScheduleHour,
    addLaterScheduleHour,
    removeLaterScheduleHour,
    setScheduleTimingPreset,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [showTimingCustomizer, setShowTimingCustomizer] = useState(false);

  // Dynamically generate hour slots from scheduleStartHour to scheduleEndHour
  const printHours = useMemo(() => {
    const list: { raw: string; hourNum: number; label: string }[] = [];
    for (let h = scheduleStartHour; h <= scheduleEndHour; h++) {
      const raw = `${String(h).padStart(2, '0')}:00`;
      list.push({
        raw,
        hourNum: h,
        label: formatHourLabel(h),
      });
    }
    return list;
  }, [scheduleStartHour, scheduleEndHour]);

  // Group items by hour
  const itemsByHour = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    items.forEach(item => {
      const h = item.startTime.split(':')[0];
      if (!map[h]) map[h] = [];
      map[h].push(item);
    });
    return map;
  }, [items]);

  // DD/MM/YYYY formatting
  const { fullDateStr, numericDateStr } = useMemo(() => {
    try {
      const [year, month, day] = selectedDate.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      const full = d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return {
        fullDateStr: full,
        numericDateStr: `${day}/${month}/${year}`,
      };
    } catch {
      return {
        fullDateStr: selectedDate,
        numericDateStr: selectedDate,
      };
    }
  }, [selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `HOURLY SCHEDULE\nDate: ${fullDateStr} (${numericDateStr})\nHours: ${printHours[0]?.label} - ${printHours[printHours.length - 1]?.label}\n\n`;
    printHours.forEach(slot => {
      const h = String(slot.hourNum).padStart(2, '0');
      const slotItems = itemsByHour[h] || [];
      if (slotItems.length > 0) {
        slotItems.forEach(i => {
          text += `${slot.label} [${i.completed ? 'x' : ' '}] ${i.title} (${i.priority})\n`;
        });
      } else {
        text += `${slot.label} ________________________\n`;
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Control & Customization Bar (print:hidden) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                Printable Hourly Planner Sheet
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Range: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatHourLabel(scheduleStartHour)} to {formatHourLabel(scheduleEndHour)}</span> ({printHours.length} hours)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-toggle-timing-customizer"
              onClick={() => setShowTimingCustomizer(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Customize schedule start and end times"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>Timing Options</span>
            </button>

            <button
              type="button"
              id="btn-copy-schedule-plan"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              id="btn-print-hourly-sheet"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Expandable Timing Options Toolbar */}
        {showTimingCustomizer && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/70 dark:bg-slate-950/40 p-3 rounded-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Quick Presets:</span>
              <button
                type="button"
                onClick={() => setScheduleTimingPreset('standard')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  scheduleStartHour === 6 && scheduleEndHour === 22
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                6 AM – 10 PM
              </button>
              <button
                type="button"
                onClick={() => setScheduleTimingPreset('workday')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  scheduleStartHour === 8 && scheduleEndHour === 20
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                8 AM – 8 PM
              </button>
              <button
                type="button"
                onClick={() => setScheduleTimingPreset('early')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  scheduleStartHour === 5 && scheduleEndHour === 21
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                5 AM – 9 PM
              </button>
              <button
                type="button"
                onClick={() => setScheduleTimingPreset('night')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  scheduleStartHour === 9 && scheduleEndHour === 23
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                9 AM – 11 PM
              </button>
            </div>

            {/* Dropdown selectors for exact custom start/end hour */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Start:</span>
                <select
                  aria-label="Schedule start time"
                  value={scheduleStartHour}
                  onChange={e => setScheduleStartHour(parseInt(e.target.value, 10))}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={`start_${i}`} value={i} disabled={i >= scheduleEndHour}>
                      {formatHourLabel(i)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">End:</span>
                <select
                  aria-label="Schedule end time"
                  value={scheduleEndHour}
                  onChange={e => setScheduleEndHour(parseInt(e.target.value, 10))}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={`end_${i}`} value={i} disabled={i <= scheduleStartHour}>
                      {formatHourLabel(i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Sheet (Exclusively isolated during window.print()) */}
      <div
        id="printable-hourly-schedule"
        className="max-w-2xl mx-auto bg-white text-slate-900 border-2 border-slate-900 rounded-xl p-5 sm:p-7 shadow-md font-sans print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
      >
        {/* Optimized & Aligned Compact Header */}
        <div className="pb-3 border-b-2 border-slate-900">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-black tracking-wider uppercase text-slate-950">
              HOURLY SCHEDULE
            </h1>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
              OMNILIFEOS PLANNER
            </span>
          </div>

          {/* Date row: aligned baseline with clean underline */}
          <div className="mt-2.5 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900">
            <div className="flex items-center gap-2">
              <span className="uppercase font-black text-slate-800 tracking-wider">DATE:</span>
              <span className="font-mono font-bold text-slate-950 border-b-2 border-slate-900 px-2 pb-0.5 inline-block text-left">
                {numericDateStr} — {fullDateStr.toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-600">
              {printHours[0]?.label} – {printHours[printHours.length - 1]?.label}
            </span>
          </div>
        </div>

        {/* Lined Hourly Grid */}
        <div className="divide-y-2 divide-slate-800 border-b-2 border-slate-800 mt-2">
          {printHours.map(slot => {
            const h = String(slot.hourNum).padStart(2, '0');
            const slotItems = itemsByHour[h] || [];

            return (
              <div key={slot.label} className="flex min-h-[42px]">
                {/* Left Hour Column */}
                <div className="w-28 sm:w-32 py-2 px-3 border-r-2 border-slate-800 shrink-0 flex items-center">
                  <span className="text-xs sm:text-sm font-black tracking-tight text-slate-900 font-mono">
                    {slot.label}
                  </span>
                </div>

                {/* Right Content Line */}
                <div className="flex-1 py-1.5 px-3 flex flex-col justify-center">
                  {slotItems.length > 0 ? (
                    <div className="space-y-1">
                      {slotItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 group cursor-pointer"
                          onClick={() => onToggleItem(item.id)}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border-2 border-slate-900 flex items-center justify-center shrink-0 ${
                              item.completed ? 'bg-slate-900 text-white' : 'bg-white'
                            }`}
                          >
                            {item.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              item.completed ? 'line-through text-slate-500' : 'text-slate-950'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="text-[10px] font-bold px-1 py-0.2 rounded border border-slate-800 text-slate-800 shrink-0">
                            {item.priority}
                          </span>
                          {item.location && (
                            <span className="text-[10px] text-slate-600 truncate hidden sm:inline">
                              • {item.location}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-4 border-b border-dotted border-slate-300 w-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Notes area on the printed page */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Priority Notes & Reflection:
          </div>
          <div className="space-y-2.5">
            <div className="border-b border-slate-300 h-4" />
            <div className="border-b border-slate-300 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
