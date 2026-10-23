import React, { useRef, useMemo, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatLocalDate } from '../../utils/date';
import { soundEngine } from '../../utils/audio';

interface ScrollableCompactDateStripProps {
  selectedDateStr: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  className?: string;
  showTodayJump?: boolean;
}

const THEMES: Record<string, { topBg: string; bottomBg: string; label: string }> = {
  emerald: { topBg: '#065f46', bottomBg: '#022c22', label: 'Dark Emerald' },
  rose: { topBg: '#881337', bottomBg: '#4c0519', label: 'Dark Crimson' },
  indigo: { topBg: '#312e81', bottomBg: '#1e1b4b', label: 'Dark Indigo' },
  amber: { topBg: '#78350f', bottomBg: '#451a03', label: 'Dark Amber' },
  violet: { topBg: '#581c87', bottomBg: '#3b0764', label: 'Dark Violet' },
  slate: { topBg: '#334155', bottomBg: '#0f172a', label: 'Dark Slate' },
};

export const ScrollableCompactDateStrip: React.FC<ScrollableCompactDateStripProps> = ({
  selectedDateStr,
  onSelectDate,
  className = '',
  showTodayJump = true,
}) => {
  const customizerRef = useRef<HTMLDivElement>(null);
  const todayStr = formatLocalDate();

  const [dateOffset, setDateOffset] = useState(0);

  // Sync dateOffset when selectedDateStr changes
  useEffect(() => {
    if (selectedDateStr) {
      const selectedDate = new Date(selectedDateStr + 'T00:00:00');
      const todayDate = new Date(todayStr + 'T00:00:00');
      const diffTime = selectedDate.getTime() - todayDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      setDateOffset(Math.floor(diffDays / 7));
    }
  }, [selectedDateStr, todayStr]);

  const [stripShape, setStripShape] = useState<'capsule' | 'bubble' | 'circle'>(() => {
    try { return (localStorage.getItem('omni_date_strip_shape') as any) || 'circle'; } catch { return 'circle'; }
  });
  const [stripTheme, setStripTheme] = useState<string>(() => {
    try { return localStorage.getItem('omni_date_strip_theme') || 'emerald'; } catch { return 'emerald'; }
  });
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('omni_date_strip_shape', stripShape);
  }, [stripShape]);

  useEffect(() => {
    localStorage.setItem('omni_date_strip_theme', stripTheme);
  }, [stripTheme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customizerRef.current && !customizerRef.current.contains(e.target as Node)) {
        setIsCustomizerOpen(false);
      }
    };
    if (isCustomizerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCustomizerOpen]);

  const activeTheme = THEMES[stripTheme] || THEMES.emerald;

  const shapeClasses = useMemo(() => {
    if (stripShape === 'circle') {
      return { outer: 'rounded-full', top: 'rounded-t-full', bottom: 'rounded-b-full' };
    }
    if (stripShape === 'bubble') {
      return { outer: 'rounded-3xl', top: 'rounded-t-3xl', bottom: 'rounded-b-3xl' };
    }
    // capsule (smooth modern curve)
    return { outer: 'rounded-2xl', top: 'rounded-t-2xl', bottom: 'rounded-b-2xl' };
  }, [stripShape]);

  // Generate 7 days for the current week based on dateOffset
  const weekDays = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + dateOffset * 7);
    const dayOfWeek = base.getDay(); // 0 (Sun) to 6 (Sat)
    const sunday = new Date(base);
    sunday.setDate(base.getDate() - dayOfWeek);

    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      list.push({
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
      });
    }
    return list;
  }, [dateOffset, todayStr, selectedDateStr]);

  const handleSelect = (dateStr: string) => {
    if (dateStr !== selectedDateStr) {
      try { soundEngine?.playPill?.(); } catch {}
      onSelectDate(dateStr);
    }
  };

  const handleJumpToday = () => {
    setDateOffset(0);
    handleSelect(todayStr);
  };

  return (
    <div className={`bg-white dark:bg-black rounded-2xl border border-slate-200/80 dark:border-zinc-900 p-2.5 sm:p-3 shadow-2xs space-y-2.5 select-none ${className}`}>
      {/* Date Strip Navigation Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDateOffset(prev => prev - 1)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-600 dark:text-zinc-300 transition cursor-pointer shadow-2xs"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm sm:text-base flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" style={{ color: activeTheme.bottomBg }} />
            {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </h3>
          <button
            type="button"
            onClick={() => setDateOffset(prev => prev + 1)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-600 dark:text-zinc-300 transition cursor-pointer shadow-2xs"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right side: Color & Shape Customizer Button & Today Button */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0 flex items-center" ref={customizerRef}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsCustomizerOpen(prev => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-bold shrink-0"
              title="Customize Date Box Colors & Shapes"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: activeTheme.bottomBg }} />
              <span className="hidden sm:inline capitalize">{activeTheme.label}</span>
            </motion.button>

            {/* Customizer Popover Menu */}
            <AnimatePresence>
              {isCustomizerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 space-y-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block mb-1.5">Date Box Shape (No Sharp Edges)</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'capsule', label: 'Capsule' },
                        { id: 'bubble', label: 'Bubble' },
                        { id: 'circle', label: 'Circle' },
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStripShape(s.id as any)}
                          className={`py-1.5 rounded-xl font-semibold border transition cursor-pointer text-center ${
                            stripShape === s.id
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block mb-1.5">Dark Dual-Tone Color Theme</span>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(THEMES).map(([id, t]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setStripTheme(id)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl font-semibold border transition cursor-pointer ${
                            stripTheme === id
                              ? 'border-slate-900 dark:border-white shadow-2xs ring-2 ring-indigo-500/20'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="w-3 h-3 rounded-full shrink-0 flex overflow-hidden border border-slate-400">
                            <div className="w-1.5 h-full" style={{ backgroundColor: t.topBg }} />
                            <div className="w-1.5 h-full" style={{ backgroundColor: t.bottomBg }} />
                          </div>
                          <span className="truncate">{t.label.replace('Dark ', '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showTodayJump && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleJumpToday}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                selectedDateStr === todayStr
                  ? 'opacity-40 cursor-default'
                  : 'text-white shadow-md'
              }`}
              style={
                selectedDateStr === todayStr
                  ? { backgroundColor: `${activeTheme.bottomBg}25`, color: activeTheme.bottomBg, border: `1px solid ${activeTheme.bottomBg}50` }
                  : { backgroundColor: activeTheme.bottomBg }
              }
              title="Jump to today"
            >
              Today
            </motion.button>
          )}
        </div>
      </div>

      {/* 7-Day Dark Dual-Tone Week Selector Grid (Zero Sharp Edges) */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1 select-none">
        {weekDays.map(day => {
          const isSelected = day.isSelected;
          const isToday = day.isToday;

          const containerClasses = isSelected
            ? 'shadow-md ring-2'
            : isToday
            ? 'border-2 shadow-xs'
            : 'border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700';

          const topHalfClasses = isSelected
            ? 'font-bold text-white'
            : isToday
            ? 'font-bold'
            : 'bg-slate-100 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold';

          const bottomHalfClasses = isSelected
            ? 'font-black text-white'
            : isToday
            ? 'font-black'
            : 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold';

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => handleSelect(day.dateStr)}
              className={`flex flex-col overflow-hidden transition-all cursor-pointer shadow-2xs relative ${shapeClasses.outer} ${containerClasses}`}
              style={
                isSelected
                  ? { backgroundColor: activeTheme.bottomBg, borderColor: activeTheme.bottomBg, color: '#ffffff', '--tw-ring-color': `${activeTheme.bottomBg}50` } as any
                  : isToday
                  ? { borderColor: activeTheme.bottomBg }
                  : undefined
              }
            >
              {/* Top Half */}
              <div
                className={`py-1 px-1 text-center text-[10px] sm:text-xs tracking-tight uppercase transition-colors ${shapeClasses.top} ${topHalfClasses}`}
                style={
                  isSelected
                    ? { backgroundColor: activeTheme.topBg, color: '#ffffff', borderBottom: `1px solid rgba(255,255,255,0.2)` }
                    : isToday
                    ? { backgroundColor: `${activeTheme.topBg}40`, color: activeTheme.bottomBg, borderBottom: `1px solid ${activeTheme.bottomBg}40` }
                    : { backgroundColor: undefined }
                }
              >
                <span>{day.dayName}</span>
              </div>

              {/* Bottom Half */}
              <div
                className={`py-1.5 px-1 text-center text-sm sm:text-base leading-none flex items-center justify-center gap-1 transition-colors relative ${shapeClasses.bottom} ${bottomHalfClasses}`}
                style={
                  isSelected
                    ? { backgroundColor: activeTheme.bottomBg, color: '#ffffff' }
                    : isToday
                    ? { backgroundColor: `${activeTheme.bottomBg}20`, color: activeTheme.bottomBg }
                    : { backgroundColor: undefined }
                }
              >
                <span>{day.dayNumber}</span>
              </div>

              {/* Glowing tiny horizontal bar attached to bottom as current date identifier */}
              {isToday && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-1 rounded-t-full bg-amber-400 dark:bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)] z-10"
                  title="Current Date (Today)"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
