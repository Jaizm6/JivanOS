import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Flame, Calendar, Pill, ReceiptText, FileText, Target, X } from 'lucide-react';

interface UniversalAddMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'task' | 'habit' | 'event' | 'medication' | 'bill' | 'journal' | 'goal') => void;
}

export const UniversalAddMenu: React.FC<UniversalAddMenuProps> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  if (!isOpen) return null;

  const options = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="w-4 h-4 text-indigo-500" />, color: 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' },
    { id: 'habit', label: 'Habit', icon: <Flame className="w-4 h-4 text-emerald-500" />, color: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' },
    { id: 'event', label: 'Event', icon: <Calendar className="w-4 h-4 text-blue-500" />, color: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' },
    { id: 'medication', label: 'Meds', icon: <Pill className="w-4 h-4 text-purple-500" />, color: 'bg-purple-50 dark:bg-purple-950/80 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300' },
    { id: 'bill', label: 'Bills', icon: <ReceiptText className="w-4 h-4 text-amber-500" />, color: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' },
    { id: 'journal', label: 'Journal', icon: <FileText className="w-4 h-4 text-rose-500" />, color: 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' },
    { id: 'goal', label: 'Goal', icon: <Target className="w-4 h-4 text-orange-500" />, color: 'bg-orange-50 dark:bg-orange-950/80 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative z-10 w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-2 mb-16 sm:mb-0"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Create</span>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 py-1">
          {options.map((opt, index) => (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              type="button"
              onClick={() => {
                onSelectType(opt.id as any);
                onClose();
              }}
              className={`flex items-center gap-3 w-full p-2.5 rounded-2xl border transition-all cursor-pointer font-semibold text-xs shadow-2xs hover:scale-[1.02] active:scale-98 ${opt.color}`}
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center shrink-0">
                {opt.icon}
              </div>
              <span className="flex-1 text-left">{opt.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
