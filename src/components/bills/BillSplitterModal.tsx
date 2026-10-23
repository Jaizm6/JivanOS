import React, { useState } from 'react';
import {
  X,
  Users,
  Percent,
  Plus,
  Trash2,
  Copy,
  Check,
  Share2,
  IndianRupee,
  Receipt,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface BillSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetTotal?: number;
  onAddToBills?: (bill: { title: string; amount: number; category: any }) => void;
}

interface Participant {
  id: string;
  name: string;
  sharePercent?: number;
  customAmount?: number;
}

export const BillSplitterModal: React.FC<BillSplitterModalProps> = ({
  isOpen,
  onClose,
  presetTotal,
  onAddToBills,
}) => {
  const { currency = 'INR', currencySymbol = '₹', formatCurrency } = useApp();

  const [billTitle, setBillTitle] = useState('Dinner & Utilities');
  const [totalAmount, setTotalAmount] = useState<string>(presetTotal ? String(presetTotal) : '2400');
  const [taxPercent, setTaxPercent] = useState<string>('5');
  const [tipPercent, setTipPercent] = useState<string>('0');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [peopleCount, setPeopleCount] = useState<number>(4);

  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'You (Jaiz)' },
    { id: '2', name: 'Friend 1' },
    { id: '3', name: 'Friend 2' },
    { id: '4', name: 'Friend 3' },
  ]);

  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const baseAmt = parseFloat(totalAmount) || 0;
  const taxAmt = baseAmt * ((parseFloat(taxPercent) || 0) / 100);
  const tipAmt = baseAmt * ((parseFloat(tipPercent) || 0) / 100);
  const grandTotal = baseAmt + taxAmt + tipAmt;

  const count = splitMode === 'equal' ? Math.max(1, peopleCount) : Math.max(1, participants.length);
  const perPersonEqual = grandTotal / count;

  const handleAddParticipant = () => {
    const nextNum = participants.length + 1;
    setParticipants([...participants, { id: `p_${Date.now()}`, name: `Person ${nextNum}` }]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length <= 1) return;
    setParticipants(participants.filter(p => p.id !== id));
  };

  const handleNameChange = (id: string, newName: string) => {
    setParticipants(participants.map(p => (p.id === id ? { ...p, name: newName } : p)));
  };

  const generateSummaryText = () => {
    let summary = `🧾 *${billTitle} - Split Bill Summary*\n`;
    summary += `Total Bill: ${currencySymbol}${grandTotal.toFixed(2)} (Base: ${currencySymbol}${baseAmt.toFixed(2)}, Tax: ${taxPercent}%, Tip: ${tipPercent}%)\n`;
    summary += `Split among ${count} people:\n\n`;

    if (splitMode === 'equal') {
      participants.slice(0, count).forEach((p, i) => {
        summary += `• ${p.name || `Person ${i + 1}`}: ${currencySymbol}${perPersonEqual.toFixed(2)}\n`;
      });
    } else {
      participants.forEach(p => {
        const amt = p.customAmount ?? perPersonEqual;
        summary += `• ${p.name}: ${currencySymbol}${amt.toFixed(2)}\n`;
      });
    }
    summary += `\nShared via OmniLifeOS`;
    return summary;
  };

  const handleCopy = () => {
    const text = generateSummaryText();
    navigator.clipboard?.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateSummaryText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Smart Bill Splitter</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Split restaurant bills, rent, or travel costs with tax & tip
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Bill Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Bill Title / Occasion
              </label>
              <input
                type="text"
                value={billTitle}
                onChange={e => setBillTitle(e.target.value)}
                placeholder="e.g. Goa Trip Villa, Dinner"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Base Bill Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Tax & Tip */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                GST / Tax (%)
              </label>
              <div className="flex gap-1">
                {['0', '5', '12', '18'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTaxPercent(val)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                      taxPercent === val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Tip / Service (%)
              </label>
              <div className="flex gap-1">
                {['0', '5', '10', '15'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTipPercent(val)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                      tipPercent === val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSplitMode('equal')}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                splitMode === 'equal' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Equal Split (By People)
            </button>
            <button
              type="button"
              onClick={() => setSplitMode('custom')}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                splitMode === 'custom' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              By Name / Custom
            </button>
          </div>

          {/* Equal Mode: Quick Number Slider */}
          {splitMode === 'equal' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Number of People:</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{peopleCount} People</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[2, 3, 4, 5, 6, 8, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setPeopleCount(n);
                      // sync participants array
                      while (participants.length < n) {
                        participants.push({ id: `p_${Date.now()}_${participants.length}`, name: `Friend ${participants.length}` });
                      }
                      setParticipants([...participants]);
                    }}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition ${
                      peopleCount === n
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Mode: Participants list */}
          {splitMode === 'custom' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Participants ({participants.length})</span>
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Person</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {participants.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => handleNameChange(p.id, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      placeholder={`Person ${idx + 1}`}
                    />
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {currencySymbol}{perPersonEqual.toFixed(2)}
                    </span>
                    {participants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculations Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Base: {currencySymbol}{baseAmt.toFixed(2)}</span>
              {taxAmt > 0 && <span>+ Tax ({taxPercent}%): {currencySymbol}{taxAmt.toFixed(2)}</span>}
              {tipAmt > 0 && <span>+ Tip ({tipPercent}%): {currencySymbol}{tipAmt.toFixed(2)}</span>}
              <span className="font-bold text-slate-900 dark:text-white">
                Total: {currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Each Person Pays</span>
                <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {currencySymbol}{perPersonEqual.toFixed(2)}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Split among</span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {count} people
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-xs"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>

          {onAddToBills && (
            <button
              type="button"
              onClick={() => {
                onAddToBills({
                  title: `${billTitle} (My Share)`,
                  amount: Math.round(perPersonEqual),
                  category: 'other',
                });
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
            >
              <span>+ Log My Share in Bills</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
