import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Lock } from 'lucide-react';
import { M3Switch } from '../common/PetalExpressive';
import { ConnectedProviderSummary, UnifiedProviderId } from '../../sync/syncConnectionState';

export interface SyncSettingsCardProps {
  connectedProviders: ConnectedProviderSummary[];
  primaryProviderId: UnifiedProviderId | null;
  onSelectPrimaryProvider: (id: UnifiedProviderId) => void;
  intervalMinutes: 0 | 15 | 30 | 60;
  onChangeInterval: (interval: 0 | 15 | 30 | 60) => void;
  syncOnChange: boolean;
  onToggleSyncOnChange: (val: boolean) => void;
  syncOnStartup: boolean;
  onToggleSyncOnStartup: (val: boolean) => void;
  e2eeEnabled: boolean;
  onToggleE2ee: (val: boolean) => void;
  e2eePassphrase: string;
  onChangeE2eePassphrase: (val: string) => void;
}

const INTERVAL_SEGMENTS: { label: string; value: 15 | 30 | 60 | 0 }[] = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: 'Manual', value: 0 },
];

export const SyncSettingsCard: React.FC<SyncSettingsCardProps> = ({
  connectedProviders,
  primaryProviderId,
  onSelectPrimaryProvider,
  intervalMinutes,
  onChangeInterval,
  syncOnChange,
  onToggleSyncOnChange,
  syncOnStartup,
  onToggleSyncOnStartup,
  e2eeEnabled,
  onToggleE2ee,
  e2eePassphrase,
  onChangeE2eePassphrase,
}) => {
  return (
    <section aria-labelledby="section-sync-settings-label" className="min-w-0">
      <h2
        id="section-sync-settings-label"
        className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500 dark:text-zinc-400 mt-5 mb-1 px-1"
      >
        Sync Settings
      </h2>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#E5E7EB]/80 dark:divide-zinc-800/80">
        {/* 1. Primary Target (Compact Dropdown) */}
        <div className="min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3">
          <label
            htmlFor="sync-primary-target-select"
            className="text-[13.5px] font-medium text-slate-800 dark:text-zinc-100 shrink-0"
          >
            Primary target
          </label>
          <div className="relative min-w-0 max-w-[58%]">
            <select
              id="sync-primary-target-select"
              value={primaryProviderId || ''}
              onChange={(e) => onSelectPrimaryProvider(e.target.value as UnifiedProviderId)}
              className="appearance-none w-full h-8 pl-2.5 pr-7 rounded-lg border border-[#E5E7EB] dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-[12px] font-medium text-slate-800 dark:text-zinc-100 outline-none focus:border-[#4F46E5] cursor-pointer truncate"
            >
              {connectedProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* 2. Sync Interval (32dp compact segmented control) */}
        <div className="min-h-[48px] px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
          <span className="text-[13.5px] font-medium text-slate-800 dark:text-zinc-100 shrink-0">
            Sync interval
          </span>
          <div
            role="radiogroup"
            aria-label="Sync interval"
            className="grid grid-cols-4 h-8 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-950 p-0.5 gap-0.5 w-full sm:w-auto sm:min-w-[208px]"
          >
            {INTERVAL_SEGMENTS.map((seg) => {
              const selected = intervalMinutes === seg.value;
              return (
                <button
                  key={seg.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangeInterval(seg.value)}
                  className={`h-full px-2 rounded-md text-[11.5px] font-semibold transition cursor-pointer whitespace-nowrap tabular-nums ${
                    selected
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Auto-sync on edit */}
        <div className="min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-medium text-slate-800 dark:text-zinc-100">
            Auto-sync on edit
          </span>
          <M3Switch
            size="sm"
            checked={syncOnChange}
            onChange={onToggleSyncOnChange}
          />
        </div>

        {/* 4. Sync on app launch */}
        <div className="min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-medium text-slate-800 dark:text-zinc-100">
            Sync on app launch
          </span>
          <M3Switch
            size="sm"
            checked={syncOnStartup}
            onChange={onToggleSyncOnStartup}
          />
        </div>

        {/* 5. E2E Encryption (AES-256) + inline passphrase when enabled */}
        <div className="px-4 py-2.5">
          <div className="min-h-[28px] flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-medium text-slate-800 dark:text-zinc-100">
              E2E Encryption (AES-256)
            </span>
            <M3Switch
              size="sm"
              checked={e2eeEnabled}
              onChange={onToggleE2ee}
            />
          </div>

          <AnimatePresence initial={false}>
            {e2eeEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-2.5">
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={e2eePassphrase}
                      onChange={(e) => onChangeE2eePassphrase(e.target.value)}
                      placeholder="Shared AES-256 passphrase"
                      aria-label="Encryption passphrase"
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/25 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
