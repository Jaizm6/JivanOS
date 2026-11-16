import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ArrowRightLeft,
  IndianRupee,
  Copy,
  Check,
  TrendingUp,
  RefreshCw,
  CreditCard,
  CalendarRange,
  Plus,
} from 'lucide-react';
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

const FX_STORAGE_KEY = 'jivanos_live_fx_rates_v1';

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  isOpen,
  onClose,
  onApplyToBill,
}) => {
  const [sourceAmount, setSourceAmount] = useState<string>('100');
  const [sourceCurrency, setSourceCurrency] = useState<SupportedCurrency>('USD');
  const [targetCurrency, setTargetCurrency] = useState<SupportedCurrency>('INR');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Live & Custom Exchange Rates (INR per 1 unit of currency)
  const [ratesMap, setRatesMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(FX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.rates) return parsed.rates;
      }
    } catch {}
    return CURRENCIES.reduce((acc, c) => ({ ...acc, [c.code]: c.inrRate }), {});
  });

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(FX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.timestamp || null;
      }
    } catch {}
    return null;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [customPairRate, setCustomPairRate] = useState<string>('');

  // Card Forex Markup & GST Calculator (for international bills/subscriptions)
  const [forexMarkupPct, setForexMarkupPct] = useState<string>('3.5');
  const [includeGstOnForex, setIncludeGstOnForex] = useState<boolean>(true);

  const syncLiveRates = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/INR');
      if (!res.ok) throw new Error('Primary rate server unavailable');
      const data = await res.json();
      if (data && data.rates) {
        const updated: Record<string, number> = { INR: 1 };
        CURRENCIES.forEach(c => {
          if (c.code === 'INR') {
            updated.INR = 1;
          } else {
            const foreignPerInr = data.rates[c.code];
            if (typeof foreignPerInr === 'number' && foreignPerInr > 0) {
              updated[c.code] = Number((1 / foreignPerInr).toFixed(4));
            } else {
              updated[c.code] = ratesMap[c.code] || c.inrRate;
            }
          }
        });
        const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setRatesMap(updated);
        setLastSyncedAt(nowLabel);
        setCustomPairRate('');
        try {
          localStorage.setItem(
            FX_STORAGE_KEY,
            JSON.stringify({ rates: updated, timestamp: nowLabel })
          );
        } catch {}
      }
    } catch {
      setSyncError('Using cached benchmark rates');
    } finally {
      setIsSyncing(false);
    }
  }, [ratesMap]);

  useEffect(() => {
    if (isOpen && !lastSyncedAt) {
      syncLiveRates();
    }
  }, [isOpen, lastSyncedAt, syncLiveRates]);

  if (!isOpen) return null;

  const activeCurrencies = CURRENCIES.map(c => ({
    ...c,
    inrRate: ratesMap[c.code] ?? c.inrRate,
  }));

  const numAmount = Math.max(0, parseFloat(sourceAmount) || 0);
  const sourceInfo = activeCurrencies.find(c => c.code === sourceCurrency) || activeCurrencies[0];
  const targetInfo = activeCurrencies.find(c => c.code === targetCurrency) || activeCurrencies[1];

  const defaultPairRate = sourceInfo.inrRate / (targetInfo.inrRate || 1);
  const effectivePairRate =
    customPairRate.trim() !== '' && !isNaN(parseFloat(customPairRate)) && parseFloat(customPairRate) > 0
      ? parseFloat(customPairRate)
      : defaultPairRate;

  const convertedTargetAmount = numAmount * effectivePairRate;
  const amountInINR =
    targetCurrency === 'INR'
      ? convertedTargetAmount
      : sourceCurrency === 'INR'
      ? numAmount
      : numAmount * sourceInfo.inrRate;

  // International Card Forex Markup Calculation
  const parsedMarkup = Math.max(0, parseFloat(forexMarkupPct) || 0);
  const forexFeeINR = amountInINR * (parsedMarkup / 100);
  const gstOnForexINR = includeGstOnForex ? forexFeeINR * 0.18 : 0;
  const totalBankDebitINR = amountInINR + forexFeeINR + gstOnForexINR;

  const handleSwap = () => {
    setSourceCurrency(targetCurrency);
    setTargetCurrency(sourceCurrency);
    setCustomPairRate('');
  };

  const handleCopy = (val: string, code: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Compact Header + Live Rate Sync Action */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50/60 to-indigo-50/50 dark:from-slate-800/60 dark:to-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8.5 h-8.5 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  FX & Bill Currency Hub
                </h3>
                <span
                  className={`text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full border ${
                    lastSyncedAt
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {lastSyncedAt ? `Live • ${lastSyncedAt}` : 'Benchmark'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {syncError || 'Live FX converter, card forex fee & subscription estimator'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={syncLiveRates}
              disabled={isSyncing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer disabled:opacity-60"
              title="Fetch latest live exchange rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Live'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* High-Density Body */}
        <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto text-xs">
          {/* 1. COMPACT SIDE-BY-SIDE CONVERTER CARD */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
              {/* FROM BOX */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400">
                  <span>From</span>
                  <select
                    value={sourceCurrency}
                    onChange={e => {
                      setSourceCurrency(e.target.value as SupportedCurrency);
                      setCustomPairRate('');
                    }}
                    className="bg-transparent text-slate-800 dark:text-slate-200 font-bold text-xs outline-hidden cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative flex items-center">
                  <span className="text-slate-400 font-bold font-mono text-sm mr-1.5">
                    {sourceInfo.symbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={sourceAmount}
                    onChange={e => setSourceAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-slate-900 dark:text-white text-base sm:text-lg font-mono font-black outline-hidden"
                  />
                </div>
              </div>

              {/* SWAP BUTTON */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 transition shadow-2xs active:scale-90 cursor-pointer"
                  title="Swap currencies"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* TO BOX */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 space-y-1">
                <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400">
                  <span>Converted</span>
                  <select
                    value={targetCurrency}
                    onChange={e => {
                      setTargetCurrency(e.target.value as SupportedCurrency);
                      setCustomPairRate('');
                    }}
                    className="bg-transparent text-slate-800 dark:text-slate-200 font-bold text-xs outline-hidden cursor-pointer"
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="text-base sm:text-lg font-mono font-black text-blue-600 dark:text-blue-400 truncate">
                    {targetInfo.symbol}
                    {convertedTargetAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(convertedTargetAmount.toFixed(2), targetInfo.code)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                    title="Copy converted amount"
                  >
                    {copiedCode === targetInfo.code ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Presets + Editable Custom Exchange Rate Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <div className="flex items-center gap-1 flex-wrap">
                {(sourceCurrency === 'INR'
                  ? [500, 1000, 2500, 5000, 10000]
                  : [10, 20, 50, 100, 500]
                ).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSourceAmount(String(val))}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                      sourceAmount === String(val)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {sourceInfo.symbol}
                    {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
              </div>

              {/* Editable Rate Override */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500 ml-auto">
                <span>1 {sourceInfo.code} =</span>
                <input
                  type="number"
                  step="any"
                  value={customPairRate !== '' ? customPairRate : defaultPairRate.toFixed(4)}
                  onChange={e => setCustomPairRate(e.target.value)}
                  title="Click to override with custom bank/invoice rate"
                  className="w-18 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px] text-right focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {targetInfo.code}
                </span>
              </div>
            </div>
          </div>

          {/* 2. INTERNATIONAL CARD FOREX MARKUP & SUBSCRIPTION HORIZON GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Card Forex Markup & Bank Debit Estimator */}
            <div className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Card Forex Markup</span>
                </span>
                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGstOnForex}
                    onChange={e => setIncludeGstOnForex(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 w-3 h-3"
                  />
                  <span>+18% GST</span>
                </label>
              </div>

              <div className="flex items-center gap-1">
                {['0', '1.5', '2', '3.5'].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setForexMarkupPct(pct)}
                    className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                      forexMarkupPct === pct
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <div className="relative flex-1 min-w-[52px]">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={forexMarkupPct}
                    onChange={e => setForexMarkupPct(e.target.value)}
                    className="w-full pl-1.5 pr-4 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[10.5px] text-slate-800 dark:text-slate-200 outline-hidden"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9.5px] text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Fee: +₹{Math.round(forexFeeINR + gstOnForexINR).toLocaleString('en-IN')}
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  Card Debit: ₹{Math.round(totalBankDebitINR).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Recurring Bill / SaaS Horizon Estimator */}
            <div className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-500" />
                  <span>If Recurring Bill (in ₹)</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  incl. Forex
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-[9.5px] font-semibold text-slate-400">Daily</div>
                  <div className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200 mt-0.5">
                    ₹{Math.round(totalBankDebitINR / 30).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-[9.5px] font-semibold text-slate-400">Monthly</div>
                  <div className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                    ₹{Math.round(totalBankDebitINR).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-[9.5px] font-semibold text-slate-400">Yearly</div>
                  <div className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ₹{Math.round(totalBankDebitINR * 12).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. COMPACT 4-COLUMN GLOBAL CURRENCY MATRIX (Click to select or copy) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span>
                  Live Cross-Rates for {sourceInfo.symbol}
                  {numAmount.toLocaleString()} {sourceInfo.code}
                </span>
              </h4>
              <span className="text-[10px] text-slate-400">Tap tile to set target & copy</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {activeCurrencies
                .filter(c => c.code !== sourceCurrency)
                .map(curr => {
                  const rawInr = numAmount * sourceInfo.inrRate;
                  const converted = curr.inrRate > 0 ? rawInr / curr.inrRate : 0;
                  const isTarget = curr.code === targetCurrency;
                  return (
                    <button
                      type="button"
                      key={curr.code}
                      onClick={() => {
                        setTargetCurrency(curr.code);
                        setCustomPairRate('');
                        handleCopy(converted.toFixed(2), curr.code);
                      }}
                      className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        isTarget
                          ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/50 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full text-[10.5px]">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {curr.flag} {curr.code}
                        </span>
                        {copiedCode === curr.code ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <span className="text-[9.5px] text-slate-400 font-mono">
                            ₹{curr.inrRate.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5">
                        {curr.symbol}
                        {converted.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-800/30">
          <div className="text-[11px] text-slate-500 truncate">
            Bank Debit incl. {parsedMarkup}% markup:{' '}
            <strong className="text-slate-900 dark:text-white font-mono">
              ₹{Math.round(totalBankDebitINR).toLocaleString('en-IN')}
            </strong>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onApplyToBill && (
              <button
                type="button"
                onClick={() => {
                  onApplyToBill(Math.round(totalBankDebitINR), '₹');
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Bill (₹{Math.round(totalBankDebitINR).toLocaleString('en-IN')})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
