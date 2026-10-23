import React, { useState } from 'react';
import { BookLock, Lock, Smile, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { MoodType } from '../../../types';

export const QuickJournalWidget: React.FC = () => {
  const { addJournalEntry, isJournalLocked, masterPassphrase, setActiveTab, soundEngine } = useApp();
  const [mood, setMood] = useState<MoodType>('calm');
  const [quickThought, setQuickThought] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const moods: { type: MoodType; emoji: string; label: string; color: string }[] = [
    { type: 'ecstatic', emoji: '🤩', label: 'Ecstatic', color: 'hover:bg-amber-100 dark:hover:bg-amber-950' },
    { type: 'good', emoji: '😊', label: 'Good', color: 'hover:bg-emerald-100 dark:hover:bg-emerald-950' },
    { type: 'calm', emoji: '😌', label: 'Calm', color: 'hover:bg-blue-100 dark:hover:bg-blue-950' },
    { type: 'anxious', emoji: '😰', label: 'Anxious', color: 'hover:bg-purple-100 dark:hover:bg-purple-950' },
    { type: 'down', emoji: '😔', label: 'Down', color: 'hover:bg-slate-200 dark:hover:bg-slate-800' },
  ];

  const handleSaveThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThought.trim()) return;

    addJournalEntry({
      title: `Daily Reflection (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      content: quickThought.trim(),
      mood,
      tags: ['Daily', 'Reflection'],
      date: new Date().toISOString().split('T')[0],
      isEncrypted: !!masterPassphrase,
    });

    setQuickThought('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-100/60 dark:border-amber-900/60 shrink-0">
            <BookLock className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span>Journal & Mood</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9.5px] font-medium font-mono text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/50 dark:border-emerald-800/50">
            <ShieldCheck className="w-3 h-3" />
            E2E
          </span>
          <button
            id="btn-goto-journal"
            onClick={() => setActiveTab('journal')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer transition"
          >
            <span>Open</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex-1 flex flex-col justify-between">
        {/* Mood Selector */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
            How are you feeling right now?
          </label>
          <div className="flex items-center justify-between gap-1">
            {moods.map(m => (
              <button
                key={m.type}
                type="button"
                id={`btn-mood-${m.type}`}
                onClick={() => setMood(m.type)}
                className={`flex-1 py-1.5 rounded-xl flex flex-col items-center transition border ${
                  mood === m.type
                    ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-750'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-200 font-medium capitalize mt-0.5">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick reflection text area */}
        <form onSubmit={handleSaveThought} className="mt-3">
          <textarea
            id="input-quick-journal-text"
            rows={2}
            placeholder="Record a quick private thought or reflection..."
            value={quickThought}
            onChange={e => setQuickThought(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-500" />
              Secured with AES-256 GCM
            </span>
            <button
              id="btn-save-quick-journal"
              type="submit"
              disabled={!quickThought.trim()}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  Saved
                </>
              ) : (
                'Save Note'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
