import React, { useState } from 'react';
import { Check, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playLockSound, soundEngine } from '../../utils/audio';
import { M3Switch } from '../common/PetalExpressive';

/* ─────────────────────────────────────────────────────────────────────────── */
/* 1. Security & Privacy                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export const SecuritySettingsSection: React.FC = () => {
  const { appLock, configureAppLock, lockApp, setMasterPassphrase, pushNotification } = useApp();

  const [appLockEnabled, setAppLockEnabled] = useState(appLock.isEnabled);
  const [lockType, setLockType] = useState(appLock.type || appLock.lockType || 'passcode');
  const [lockPasscode, setLockPasscode] = useState(appLock.passcode);
  const [requireOnResume, setRequireOnResume] = useState(appLock.requireOnResume ?? false);
  const [saveLockMsg, setSaveLockMsg] = useState('');

  const [showPassModal, setShowPassModal] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState('');

  const handleSaveAppLock = (e: React.FormEvent) => {
    e.preventDefault();
    configureAppLock({
      isEnabled: appLockEnabled,
      type: lockType,
      passcode: lockPasscode || '1234',
      requireOnResume,
    });
    setSaveLockMsg('Saved');
    setTimeout(() => setSaveLockMsg(''), 2500);
    pushNotification('Security Updated', 'App lock configuration saved.', 'system');
  };

  const handleSavePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassphrase.trim()) return;
    setMasterPassphrase(newPassphrase.trim());
    setShowPassModal(false);
    setNewPassphrase('');
    pushNotification('Security Updated', 'Master encryption passphrase updated.', 'system');
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Group 1: App Lock */}
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          App lock
        </div>

        <form
          onSubmit={handleSaveAppLock}
          className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden"
        >
          <div
            onClick={() => setAppLockEnabled(!appLockEnabled)}
            className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Enable app lock
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Require biometrics or PIN to open JivanOS
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <M3Switch checked={appLockEnabled} onChange={setAppLockEnabled} />
            </div>
          </div>

          {appLockEnabled && (
            <>
              <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                      Authentication method
                    </label>
                    <select
                      value={lockType}
                      onChange={(e) => setLockType(e.target.value as any)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="both">Biometrics &amp; PIN</option>
                      <option value="biometric">Biometrics only</option>
                      <option value="passcode">PIN passcode only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                      PIN passcode (4–8 digits)
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      placeholder="Enter PIN"
                      value={lockPasscode}
                      onChange={(e) => setLockPasscode(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white font-mono tracking-widest"
                    />
                  </div>
                </div>
              </div>

              <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

              <div
                onClick={() => setRequireOnResume(!requireOnResume)}
                className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                    Auto-lock on resume
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Lock immediately when switching back
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <M3Switch checked={requireOnResume} onChange={setRequireOnResume} />
                </div>
              </div>
            </>
          )}

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          <div className="px-4 py-3 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                playLockSound();
                lockApp();
              }}
              className="h-10 px-4 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>Lock now</span>
            </button>

            <div className="flex items-center gap-2.5">
              {saveLockMsg && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {saveLockMsg}
                </span>
              )}
              <button
                type="submit"
                className="h-10 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Group 2: Encryption Vault */}
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Encryption vault
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPassModal(true)}
            className="w-full min-h-[58px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Client-side AES-256
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                Local AES-GCM · Tap to change passphrase
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] shrink-0">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Protected</span>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600" />
            </div>
          </button>
        </div>
      </div>

      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-[24px] bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Master passphrase
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Stays strictly on your device and is never uploaded.
              </p>
            </div>
            <form onSubmit={handleSavePassphrase} className="space-y-3.5">
              <input
                type="password"
                required
                placeholder="New secret passphrase"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="h-10 px-4 rounded-full border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 2. Jivan AI                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

interface AiSettingsSectionProps {
  aiProviderInput: string;
  selectedAiModelInput: string;
  onAiSummaryChange: (provider: string, model: string) => void;
}

export const AiSettingsSection: React.FC<AiSettingsSectionProps> = ({
  aiProviderInput,
  selectedAiModelInput,
  onAiSummaryChange,
}) => {
  const { pushNotification } = useApp();

  const [provider, setProvider] = useState(aiProviderInput);
  const [model, setModel] = useState(selectedAiModelInput);
  const [baseUrlInput, setBaseUrlInput] = useState(() => {
    try {
      return localStorage.getItem('omni_ai_base_url') || 'https://api.openai.com/v1';
    } catch {
      return 'https://api.openai.com/v1';
    }
  });
  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('omni_custom_gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [customOpenaiKey, setCustomOpenaiKey] = useState(() => {
    try {
      return localStorage.getItem('omni_custom_openai_api_key') || '';
    } catch {
      return '';
    }
  });
  const [customDeepseekKey, setCustomDeepseekKey] = useState(() => {
    try {
      return localStorage.getItem('omni_custom_deepseek_api_key') || '';
    } catch {
      return '';
    }
  });
  const [customQwenKey, setCustomQwenKey] = useState(() => {
    try {
      return localStorage.getItem('omni_custom_qwen_api_key') || '';
    } catch {
      return '';
    }
  });
  const [customLocalKey, setCustomLocalKey] = useState(() => {
    try {
      return localStorage.getItem('omni_custom_local_api_key') || 'ollama';
    } catch {
      return 'ollama';
    }
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSettingsMsg, setAiSettingsMsg] = useState('');

  const handleProviderChange = (nextProvider: string) => {
    setProvider(nextProvider);
    if (nextProvider === 'gemini') {
      setModel('gemini-4-hydrogen');
      setBaseUrlInput('https://generativelanguage.googleapis.com');
    } else if (nextProvider === 'openai') {
      setModel('gpt-4o-mini');
      setBaseUrlInput('https://api.openai.com/v1');
    } else if (nextProvider === 'deepseek') {
      setModel('deepseek-chat');
      setBaseUrlInput('https://api.deepseek.com');
    } else if (nextProvider === 'qwen') {
      setModel('qwen-max');
      setBaseUrlInput('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
    } else if (nextProvider === 'local') {
      setModel('llama3');
      setBaseUrlInput('http://localhost:11434/v1');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('omni_ai_provider', provider);
      localStorage.setItem('omni_ai_model', model);
      localStorage.setItem('omni_ai_base_url', baseUrlInput.trim());
      localStorage.setItem('omni_custom_gemini_api_key', customGeminiKey.trim());
      localStorage.setItem('omni_custom_openai_api_key', customOpenaiKey.trim());
      localStorage.setItem('omni_custom_deepseek_api_key', customDeepseekKey.trim());
      localStorage.setItem('omni_custom_qwen_api_key', customQwenKey.trim());
      localStorage.setItem('omni_custom_local_api_key', customLocalKey.trim());

      onAiSummaryChange(provider, model);
      setAiSettingsMsg('Saved');
      setTimeout(() => setAiSettingsMsg(''), 2500);
      pushNotification(
        'AI Settings Updated',
        `Active provider: ${provider.toUpperCase()} (${model})`,
        'system'
      );
    } catch {
      setAiSettingsMsg('Could not save');
    }
  };

  const activeKeyValue =
    provider === 'gemini'
      ? customGeminiKey
      : provider === 'openai'
        ? customOpenaiKey
        : provider === 'deepseek'
          ? customDeepseekKey
          : provider === 'qwen'
            ? customQwenKey
            : customLocalKey;

  const setActiveKeyValue = (val: string) => {
    if (provider === 'gemini') setCustomGeminiKey(val);
    else if (provider === 'openai') setCustomOpenaiKey(val);
    else if (provider === 'deepseek') setCustomDeepseekKey(val);
    else if (provider === 'qwen') setCustomQwenKey(val);
    else setCustomLocalKey(val);
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 w-full min-w-0">
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Provider &amp; model
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          {/* Provider Pills */}
          <div className="p-4 space-y-2.5">
            <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              AI provider
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'gemini', label: 'Gemini' },
                { id: 'openai', label: 'OpenAI' },
                { id: 'deepseek', label: 'DeepSeek' },
                { id: 'qwen', label: 'Qwen' },
                { id: 'local', label: 'Local / Ollama' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`h-9 px-3.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    provider === p.id
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Model & Endpoint Fields */}
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white cursor-pointer"
              >
                {provider === 'gemini' && (
                  <>
                    <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Recommended)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fastest)</option>
                    <option value="gemini-4-argon">Gemini 4 Argon (Deep Reasoning)</option>
                  </>
                )}
                {provider === 'openai' && (
                  <>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {provider === 'deepseek' && (
                  <>
                    <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                    <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                  </>
                )}
                {provider === 'qwen' && (
                  <>
                    <option value="qwen-max">Qwen Max</option>
                    <option value="qwen-plus">Qwen Plus</option>
                    <option value="qwen-turbo">Qwen Turbo</option>
                  </>
                )}
                {provider === 'local' && (
                  <>
                    <option value="llama3">Llama 3</option>
                    <option value="llama3.1">Llama 3.1</option>
                    <option value="mistral">Mistral</option>
                    <option value="phi3">Phi-3</option>
                    <option value="qwen2.5">Qwen 2.5</option>
                    <option value="custom">Custom Model</option>
                  </>
                )}
              </select>
            </div>

            {provider !== 'gemini' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  API base URL
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Custom API key (optional)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={activeKeyValue}
                  onChange={(e) => setActiveKeyValue(e.target.value)}
                  placeholder="Stored locally on this device"
                  className="w-full h-11 pl-3 pr-14 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 cursor-pointer"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          <div className="px-4 py-3 flex items-center justify-end gap-2.5">
            {aiSettingsMsg && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {aiSettingsMsg}
              </span>
            )}
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 3. Regional & Schedule (Timezone & Timeline Day Hours — No Duplicate Currency) */
/* ─────────────────────────────────────────────────────────────────────────── */

interface RegionalScheduleSectionProps {
  timezoneInput: string;
  onTimezoneChange: (tz: string) => void;
}

export const RegionalScheduleSection: React.FC<RegionalScheduleSectionProps> = ({
  timezoneInput,
  onTimezoneChange,
}) => {
  const { scheduleStartHour, scheduleEndHour, setScheduleTimingPreset, pushNotification } =
    useApp();

  const [tz, setTz] = useState(timezoneInput);
  const [timezoneMsg, setTimezoneMsg] = useState('');

  const handleSaveTimezone = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('omni_timezone', tz);
      onTimezoneChange(tz);
      setTimezoneMsg('Saved');
      setTimeout(() => setTimezoneMsg(''), 2500);
      pushNotification('Timezone Updated', `Active timezone set to ${tz}.`, 'system');
    } catch {
      setTimezoneMsg('Failed');
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Group 1: Timezone */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Regional time
          </span>
          <button
            type="button"
            onClick={() => {
              try {
                const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detected) {
                  setTz(detected);
                  localStorage.setItem('omni_timezone', detected);
                  onTimezoneChange(detected);
                  setTimezoneMsg('Auto-detected');
                  setTimeout(() => setTimezoneMsg(''), 2500);
                }
              } catch {}
            }}
            className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Auto-detect
          </button>
        </div>

        <form
          onSubmit={handleSaveTimezone}
          className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden"
        >
          <div className="p-4 space-y-2.5">
            <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Active timezone
            </div>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+05:30)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
              <option value="America/Denver">America/Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST · UTC+04:00)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+08:00)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST · UTC+09:00)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
            </select>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          <div className="px-4 py-3 flex items-center justify-end gap-2.5">
            {timezoneMsg && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {timezoneMsg}
              </span>
            )}
            <button
              type="submit"
              className="h-10 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>

      {/* Group 2: Timeline Day Hours */}
      <div className="space-y-1.5">
        <div className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
          Timeline schedule
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Visible day hours
            </span>
            <span className="text-xs font-mono font-semibold text-[#4F46E5] dark:text-indigo-400 tabular-nums shrink-0">
              {scheduleStartHour}:00 – {scheduleEndHour}:00
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'standard' as const, label: 'Standard', range: '6:00–22:00', s: 6, e: 22 },
              { id: 'workday' as const, label: 'Workday', range: '8:00–18:00', s: 8, e: 18 },
              { id: 'early' as const, label: 'Early', range: '5:00–21:00', s: 5, e: 21 },
              { id: '24h' as const, label: 'Full Day', range: '0:00–24:00', s: 0, e: 24 },
            ].map((preset) => {
              const isActive = scheduleStartHour === preset.s && scheduleEndHour === preset.e;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setScheduleTimingPreset(preset.id);
                    soundEngine.playClick();
                  }}
                  className={`min-h-[54px] px-3 py-2 rounded-2xl text-left transition cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-50 dark:bg-zinc-800/70 text-slate-900 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-xs font-semibold">{preset.label}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      isActive ? 'text-white/85' : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    {preset.range}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
