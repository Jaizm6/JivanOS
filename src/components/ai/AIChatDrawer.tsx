import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  X,
  Plus,
  Check,
  CheckCircle2,
  Calendar,
  ReceiptText,
  Flame,
  Target,
  Pill,
  Layers,
  SlidersHorizontal,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckSquare,
  Zap,
  ArrowRight,
  Loader2,
  Maximize2,
  Minimize2,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActionableItem } from '../../types';
import { FORM_EASE, FORM_SPRING, FORM_EXIT_TRANSITION, CRISP_TRANSFORM_TEMPLATE } from '../common/FormPrimitives';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    defaultModel: 'gemini-4-hydrogen',
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    defaultModel: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-max', label: 'Qwen Max' },
    ],
  },
  {
    id: 'local',
    name: 'Local',
    defaultModel: 'llama3',
    models: [
      { id: 'llama3', label: 'Llama 3' },
      { id: 'llama3.1', label: 'Llama 3.1' },
      { id: 'qwen2.5', label: 'Qwen 2.5' },
      { id: 'mistral', label: 'Mistral' },
    ],
  },
];

function normalizeModelId(rawModel?: string | null): string {
  if (!rawModel || rawModel === 'gemini-3.8-flash') return 'gemini-4-hydrogen';
  return rawModel;
}

function formatSelectedModelName(modelId: string): string {
  const normalized = normalizeModelId(modelId);
  for (const p of AI_PROVIDERS) {
    const found = p.models.find(m => m.id === normalized);
    if (found) return found.label;
  }
  return normalized
    .split('-')
    .map(part => (part.length <= 2 && /^[a-z]+$/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function renderFormattedText(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose }) => {
  const {
    aiMessages,
    isAILoading,
    sendAIMessage,
    applyActionableItem,
    applyMultipleActionableItems,
    clearAIChat,
    verifyAIApiKey,
    pushNotification,
    setActiveTab,
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [appliedItemIds, setAppliedItemIds] = useState<Record<string, boolean>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const [provider, setProvider] = useState(() => localStorage.getItem('omni_ai_provider') || 'gemini');
  const [model, setModel] = useState(() => normalizeModelId(localStorage.getItem('omni_ai_model')));
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(`omni_custom_${localStorage.getItem('omni_ai_provider') || 'gemini'}_api_key`) || ''
  );
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('omni_ai_base_url') || '');

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  }>({
    tested: false,
    success: false,
    message: '',
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync persisted model & provider whenever card opens (keeps Settings & AI card aligned)
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      return;
    }
    const savedProvider = localStorage.getItem('omni_ai_provider') || 'gemini';
    const savedModel = normalizeModelId(localStorage.getItem('omni_ai_model'));
    setProvider(savedProvider);
    setModel(savedModel);
    setApiKey(localStorage.getItem(`omni_custom_${savedProvider}_api_key`) || '');
    setBaseUrl(localStorage.getItem('omni_ai_base_url') || '');
  }, [isOpen]);

  const handleSelectProvider = (newProvider: string) => {
    setProvider(newProvider);
    localStorage.setItem('omni_ai_provider', newProvider);
    const matched = AI_PROVIDERS.find(p => p.id === newProvider);
    const defaultMod = matched ? matched.defaultModel : 'gemini-4-hydrogen';
    setModel(defaultMod);
    localStorage.setItem('omni_ai_model', defaultMod);
    setApiKey(localStorage.getItem(`omni_custom_${newProvider}_api_key`) || '');
    setVerifyStatus({ tested: false, success: false, message: '' });
  };

  const handleSelectModel = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem('omni_ai_model', newModel);
    setVerifyStatus({ tested: false, success: false, message: '' });
  };

  const handleSaveConfig = () => {
    localStorage.setItem('omni_ai_provider', provider);
    localStorage.setItem('omni_ai_model', model);
    localStorage.setItem(`omni_custom_${provider}_api_key`, apiKey.trim());
    if (baseUrl.trim()) {
      localStorage.setItem('omni_ai_base_url', baseUrl.trim());
    } else {
      localStorage.removeItem('omni_ai_base_url');
    }
    pushNotification('Model Updated', `Active model set to ${formatSelectedModelName(model)}`, 'system');
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsVerifying(true);
    setVerifyStatus({ tested: false, success: false, message: 'Testing connection...' });
    try {
      const res = await verifyAIApiKey(provider, apiKey.trim(), model, baseUrl.trim());
      setVerifyStatus({
        tested: true,
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
      });
    } catch (err: any) {
      setVerifyStatus({
        tested: true,
        success: false,
        message: err?.message || 'Connection failed. Check API key and model.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const starterCards = [
    {
      label: 'Plan my day',
      desc: 'Time-block tasks and habits for today',
      prompt: 'Analyze my schedule, pending tasks, and habits for today. Create a structured, time-blocked action plan.',
    },
    {
      label: 'Priority triage',
      desc: 'Sort open tasks by urgency and impact',
      prompt: 'Review all my incomplete tasks and categorize the top 4 urgent and important priorities into DO, PLAN, and PASS.',
    },
    {
      label: 'Meds & bills check',
      desc: 'Audit pending doses and upcoming dues',
      prompt: 'Audit my pending medication doses for today and any upcoming unpaid bills due this week.',
    },
    {
      label: 'Quick habit win',
      desc: '15-minute action to keep streaks alive',
      prompt: 'Look at my habit streaks and recommend a 15-minute quick win I can complete right now.',
    },
  ];

  const quickChips = [
    { label: 'Plan morning', prompt: 'Plan my morning schedule based on my pending tasks and habits' },
    { label: 'Add task', prompt: 'Add task: Client review tomorrow 2pm P1' },
    { label: 'Add habit', prompt: 'Add habit: 20 min morning stretch daily' },
    { label: 'Log bill', prompt: 'Log bill: High speed WiFi ₹999 due in 5 days' },
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAILoading) return;
    const text = inputText;
    setInputText('');
    await sendAIMessage(text);
  };

  const handleApplySingle = (item: ActionableItem, keyId: string) => {
    applyActionableItem(item);
    setAppliedItemIds(prev => ({ ...prev, [keyId]: true }));
    const title = item.type === 'habit' || item.type === 'medication' ? item.name : item.title;
    pushNotification('Created by Jivan AI', `Added "${title}" to your ${item.type}s.`, 'system');

    if (item.type === 'habit') setActiveTab('habits');
    else if (item.type === 'task') setActiveTab('tasks');
    else if (item.type === 'bill') setActiveTab('bills');
    else if (item.type === 'goal') setActiveTab('goals');
    else if (item.type === 'medication') setActiveTab('medications');
    else if (item.type === 'event') setActiveTab('tasks');
  };

  const handleApplyAll = (items: ActionableItem[], msgId: string) => {
    applyMultipleActionableItems(items);
    const newApplied: Record<string, boolean> = {};
    items.forEach((_, idx) => {
      newApplied[`${msgId}_${idx}`] = true;
    });
    setAppliedItemIds(prev => ({ ...prev, ...newApplied }));
  };

  const activeProviderConfig = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];
  const selectedModelLabel = formatSelectedModelName(model);
  const hasConversation = aiMessages.some(m => m.sender === 'user') || aiMessages.length > 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="jivan-ai-drawer-root"
          role="dialog"
          aria-modal="true"
          aria-label="Jivan AI"
          data-unified-modal="true"
          className={`fixed inset-0 z-50 flex items-center justify-center ${
            isMaximized ? 'p-0' : 'p-2.5 pb-20 sm:p-4 sm:pb-6 md:p-6'
          }`}
        >
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.14, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            onClick={handleBackdropClick}
            className={`fixed inset-0 touch-none ${
              isMaximized
                ? 'bg-black/75 dark:bg-black/85'
                : 'bg-black/50 dark:bg-black/75'
            }`}
          />
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
            exit={{ opacity: 0, y: 10, scale: 0.985, transition: FORM_EXIT_TRANSITION }}
            transformTemplate={CRISP_TRANSFORM_TEMPLATE}
            onClick={e => e.stopPropagation()}
            className={`relative z-10 w-full ${
              isMaximized
                ? 'h-full max-h-none rounded-none'
                : 'max-w-3xl h-[calc(100dvh-5.25rem)] sm:h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)] max-h-[90dvh] rounded-[28px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28)]'
            } bg-[#fefcff] dark:bg-[#141418] text-slate-900 dark:text-zinc-100 flex flex-col border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden`}
          >
        {/* M3 EXPRESSIVE HEADER: Clean title + tiny single selected-model readout + compact circular controls */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 bg-[#f9f8fe] dark:bg-[#191a20]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[14px] bg-indigo-100 dark:bg-indigo-950/90 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-[15px] sm:text-base tracking-tight text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                Jivan AI
              </h3>
              <button
                type="button"
                onClick={() => setShowConfig(prev => !prev)}
                title="Change AI model"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition leading-none whitespace-nowrap cursor-pointer"
              >
                <span>{selectedModelLabel}</span>
                <ChevronDown
                  className={`w-3 h-3 opacity-70 transition-transform duration-150 ${
                    showConfig ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasConversation && (
              confirmClear ? (
                <button
                  type="button"
                  onClick={() => {
                    clearAIChat();
                    setConfirmClear(false);
                  }}
                  onMouseLeave={() => setConfirmClear(false)}
                  className="h-9 px-3 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  Clear?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  title="Clear chat"
                  aria-label="Clear chat"
                  className="w-9 h-9 rounded-full text-slate-500 dark:text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setShowConfig(prev => !prev)}
              title="Model & API settings"
              aria-label="Model settings"
              aria-expanded={showConfig}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${
                showConfig
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMaximized(prev => !prev)}
              title={isMaximized ? 'Restore size' : 'Expand view'}
              aria-label={isMaximized ? 'Restore size' : 'Expand view'}
              className="hidden sm:flex w-9 h-9 rounded-full text-slate-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-800 items-center justify-center transition cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close Jivan AI"
              className="w-9 h-9 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-300/70 dark:hover:bg-zinc-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* COMPACT MODEL & KEY SETTINGS PANEL */}
        {showConfig && (
          <div className="p-4 bg-[#f4f3fa] dark:bg-[#1a1b22] border-b border-slate-200/80 dark:border-zinc-800 space-y-3 animate-in slide-in-from-top-2 duration-150 text-xs shrink-0">
            {/* Provider Tabs */}
            <div className="grid grid-cols-5 gap-1.5">
              {AI_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProvider(p.id)}
                  className={`py-1.5 px-2 rounded-xl font-semibold text-[11px] transition text-center truncate cursor-pointer ${
                    provider === p.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Active Model Selector (Only Selected Model Highlighted) */}
            <div className="flex flex-wrap gap-1.5">
              {activeProviderConfig.models.map(m => {
                const active = model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectModel(m.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/50'
                        : 'bg-white dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Optional Custom API Key & Base URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={provider === 'gemini' ? 'Optional Gemini API key (uses default if blank)' : `Enter ${activeProviderConfig.name} API key`}
                  value={apiKey}
                  onChange={e => {
                    setApiKey(e.target.value);
                    setVerifyStatus({ tested: false, success: false, message: '' });
                  }}
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(prev => !prev)}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  aria-label="Toggle API key visibility"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="Custom endpoint URL (optional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {verifyStatus.tested && (
              <div
                className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-medium ${
                  verifyStatus.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {verifyStatus.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <div className="flex-1 truncate">{verifyStatus.message}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-full font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        )}

        {/* CONVERSATION CANVAS */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">
          {aiMessages.length === 0 ? (
            <div className="py-6 px-2 text-center space-y-5 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-[20px] bg-indigo-100/90 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 stroke-[2]" />
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  How can I help today?
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Create tasks, habits, bills, medication schedules, or build your daily plan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {starterCards.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInputText(action.prompt)}
                    className="p-3 rounded-2xl bg-[#f4f3fa] dark:bg-zinc-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition text-slate-800 dark:text-zinc-200 group cursor-pointer"
                  >
                    <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {action.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            aiMessages.map((msg, idx) => {
              const isUser = msg.sender === 'user' || (msg as any).role === 'user';
              const messageText = msg.text || (msg as any).content || '';
              const actions: ActionableItem[] =
                msg.actionableItems && msg.actionableItems.length > 0
                  ? msg.actionableItems
                  : msg.actionableItem
                  ? [msg.actionableItem]
                  : [];

              const msgKey = msg.id || `msg_${idx}`;
              const allItemsApplied = actions.length > 0 && actions.every((_, i) => !!appliedItemIds[`${msgKey}_${i}`]);

              return (
                <div
                  key={msgKey}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-[11px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-[22px] px-4 py-3 space-y-2.5 ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-md shadow-xs'
                        : 'bg-[#f4f3fa] dark:bg-zinc-800/90 text-slate-900 dark:text-zinc-100 rounded-tl-md'
                    }`}
                  >
                    <div className="whitespace-pre-line text-[13px] leading-relaxed break-words">
                      {renderFormattedText(messageText)}
                    </div>

                    {actions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-700/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Suggested Actions ({actions.length})</span>
                          </span>

                          {actions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleApplyAll(actions, msgKey)}
                              disabled={allItemsApplied}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition ${
                                allItemsApplied
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer'
                              }`}
                            >
                              {allItemsApplied ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Added all</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Add all</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {actions.map((item, itemIdx) => {
                            const itemKey = `${msgKey}_${itemIdx}`;
                            const isApplied = !!appliedItemIds[itemKey];

                            const itemName =
                              item.type === 'habit' || item.type === 'medication' ? item.name : item.title;

                            let subtitle = '';
                            let badgeIcon = <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />;
                            let badgeColor = 'bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-600';

                            if (item.type === 'task') {
                              subtitle = `${item.priority || 'P2'} · Due ${item.dueDate || 'Today'}`;
                              badgeIcon = <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />;
                              badgeColor = 'bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-600';
                            } else if (item.type === 'habit') {
                              subtitle = `${item.category || 'health'} · ${item.frequency || 'Daily'} · ${item.targetDaysPerWeek || 7}d/wk`;
                              badgeIcon = <Flame className="w-3.5 h-3.5 text-amber-600" />;
                              badgeColor = 'bg-amber-100/80 dark:bg-amber-950/80 text-amber-600';
                            } else if (item.type === 'medication') {
                              subtitle = `${item.dosage || '1 tablet'} · ${(item.scheduleTimes || ['08:00']).join(', ')}`;
                              badgeIcon = <Pill className="w-3.5 h-3.5 text-emerald-600" />;
                              badgeColor = 'bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600';
                            } else if (item.type === 'event') {
                              subtitle = `${item.date || 'Today'} · ${item.startTime || '09:00'}–${item.endTime || '10:00'}`;
                              badgeIcon = <Calendar className="w-3.5 h-3.5 text-sky-600" />;
                              badgeColor = 'bg-sky-100/80 dark:bg-sky-950/80 text-sky-600';
                            } else if (item.type === 'bill') {
                              subtitle = `Amount: ${item.amount || 50} · Due ${item.dueDate} · ${item.recurring || 'monthly'}`;
                              badgeIcon = <ReceiptText className="w-3.5 h-3.5 text-violet-600" />;
                              badgeColor = 'bg-violet-100/80 dark:bg-violet-950/80 text-violet-600';
                            } else if (item.type === 'goal') {
                              subtitle = `Target: ${item.targetDate} · ${(item.milestones || []).length} milestones`;
                              badgeIcon = <Target className="w-3.5 h-3.5 text-rose-600" />;
                              badgeColor = 'bg-rose-100/80 dark:bg-rose-950/80 text-rose-600';
                            }

                            return (
                              <div
                                key={itemIdx}
                                className="p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-700/80 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`p-1.5 rounded-xl ${badgeColor} shrink-0`}>
                                    {badgeIcon}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 dark:text-white truncate text-xs">
                                      {itemName}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                      {subtitle}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleApplySingle(item, itemKey)}
                                  disabled={isApplied}
                                  className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shrink-0 transition ${
                                    isApplied
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 cursor-default'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 cursor-pointer'
                                  }`}
                                >
                                  {isApplied ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Added</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" />
                                      <span>Add</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isAILoading && (
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300 text-xs px-3.5 py-2.5 bg-[#f4f3fa] dark:bg-zinc-800/60 rounded-2xl w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* CONCISE PROMPT SUGGESTION CHIPS */}
        <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setInputText(chip.prompt)}
              className="px-3 py-1.5 rounded-full bg-[#f4f3fa] dark:bg-zinc-800/90 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/60 text-[11.5px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-700 dark:hover:text-indigo-300 whitespace-nowrap transition cursor-pointer shrink-0"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* M3 EXPRESSIVE PILL COMPOSER */}
        <form
          onSubmit={handleSubmit}
          className="px-3.5 pb-3.5 pt-1.5 sm:px-4 sm:pb-4 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder="Ask Jivan AI anything..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isAILoading}
            className="flex-1 px-4 py-2.5 rounded-full border border-slate-200/90 dark:border-zinc-700/90 bg-[#f4f3fa] dark:bg-zinc-800/90 text-slate-900 dark:text-white text-[13px] placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isAILoading}
            aria-label="Send message"
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition active:scale-95 disabled:bg-indigo-200 dark:disabled:bg-indigo-950/80 disabled:text-indigo-400 dark:disabled:text-indigo-600 disabled:pointer-events-none shadow-xs shrink-0 cursor-pointer"
          >
            {isAILoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
