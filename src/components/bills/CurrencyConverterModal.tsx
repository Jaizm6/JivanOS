import React, { useState } from 'react';
import { X, ArrowRightLeft, IndianRupee, Copy, Check, TrendingUp } from 'lucide-react';
import { SupportedCurrency } from '../../types';

interface CurrencyConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToBill?: (amount: number, currency: string) => void;
}

interface CurrencyInfo {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  flag: string;
  // Rates against 1 INR (i.e. INR per 1 unit of foreign currency)
  inrRate: number; 
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', inrRate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', inrRate: 86.85 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', inrRate: 94.20 },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', inrRate: 110.50 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪', inrRate: 23.65 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', inrRate: 0.58 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', inrRate: 63.40 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', inrRate: 56.60 },
];

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  isOpen,
  onClose,
  onApplyToBill,
}) => {
  const [sourceAmount, setSourceAmount] = useState<string>('5000');
  const [sourceCurrency, setSourceCurrency] = useState<SupportedCurrency>('INR');
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>('USD');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(sourceAmount) || 0;
  const sourceInfo = CURRENCIES.find(c => c.code === sourceCurrency) || CURRENCIES[0];
  const targetInfo = CURRENCIES.find(c => c.code === targetCurrency) || CURRENCIES[1];

  // Convert source amount to INR first, then to target
  const amountInINR = numAmount * sourceInfo.inrRate;
  const convertedTargetAmount = targetInfo.inrRate > 0 ? amountInINR / targetInfo.inrRate : 0;

  const handleSwap = () => {
    setSourceCurrency(targetCurrency);
    setTargetCurrency(sourceCurrency);
  };

  const handleCopy = (val: string, code: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/60 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <span>Multi-Currency Converter</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  INR Live
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Instant exchange calculator tailored for India & global transactions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Main Convert Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
            {/* From */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>From Amount</span>
                <span>{sourceInfo.flag} {sourceInfo.name}</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    {sourceInfo.symbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={sourceAmount}
                    onChange={e => setSourceAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <select
                  value={sourceCurrency}
                  onChange={e => setSourceCurrency(e.target.value as SupportedCurrency)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(sourceCurrency === 'INR' ? [500, 1000, 2500, 5000, 10000] : [10, 50, 100, 250, 500]).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSourceAmount(val.toString())}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition"
                >
                  {sourceInfo.symbol}{val.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {/* Swap Button */}
            <div className="flex items-center justify-center -my-2 relative z-10">
              <button
                type="button"
                onClick={handleSwap}
                className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 transition shadow-xs active:scale-90"
                title="Swap Currencies"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Converted Value</span>
                <span>{targetInfo.flag} {targetInfo.name}</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 flex items-center justify-between">
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {targetInfo.symbol} {convertedTargetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(convertedTargetAmount.toFixed(2), targetInfo.code)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    title="Copy amount"
                  >
                    {copiedCode === targetInfo.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <select
                  value={targetCurrency}
                  onChange={e => setTargetCurrency(e.target.value as SupportedCurrency)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current Rate note */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Exchange Benchmark:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                1 {sourceInfo.code} = {(sourceInfo.inrRate / targetInfo.inrRate).toFixed(4)} {targetInfo.code}
              </span>
            </div>
          </div>

          {/* Complete Currency Matrix against INR */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              <span>Full Conversion Overview for {sourceInfo.symbol}{numAmount.toLocaleString()} {sourceInfo.code}</span>
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.filter(c => c.code !== sourceCurrency).map(curr => {
                const converted = curr.inrRate > 0 ? amountInINR / curr.inrRate : 0;
                return (
                  <div
                    key={curr.code}
                    className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{curr.flag}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{curr.code}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {curr.symbol} {converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-[11px] text-slate-400">
            Default system base: <strong className="text-slate-600 dark:text-slate-300">INR (₹)</strong>
          </div>
          <div className="flex items-center gap-2">
            {onApplyToBill && (
              <button
                type="button"
                onClick={() => {
                  onApplyToBill(
                    targetCurrency === 'INR' ? convertedTargetAmount : amountInINR,
                    '₹'
                  );
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-xs"
              >
                Use ₹{amountInINR.toFixed(0)} in New Bill
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
