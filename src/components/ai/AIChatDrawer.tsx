import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Plus,
  Check,
  CheckCircle2,
  Calendar,
  DollarSign,
  Flame,
  Target,
  ArrowRight,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActionableItem } from '../../types';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose }) => {
  const { aiMessages, isAILoading, sendAIMessage, applyActionableItem, pushNotification, setActiveTab } = useApp();
  const [inputText, setInputText] = useState('');
  const [appliedItemIds, setAppliedItemIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const starterSuggestions = [
    'Add habit: 30 min cardio workout in fitness',
    'Remind me to pay electric bill $75 on Friday',
    'Create task: Complete sprint review tomorrow P1',
    'Set goal: Save $5,000 for emergency fund by Dec',
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAILoading) return;
    const text = inputText;
    setInputText('');
    await sendAIMessage(text);
  };

  const handleApply = (item: ActionableItem, index: number) => {
    applyActionableItem(item);
    setAppliedItemIds(prev => ({ ...prev, [`${item.type}_${index}`]: true }));
    const title = item.type === 'habit' ? item.name : item.title;
    pushNotification('Created via AI', `Successfully added "${title}" to your ${item.type}s.`, 'system');

    // Optionally switch to the relevant tab so the user sees it immediately
    if (item.type === 'habit') setActiveTab('habits');
    else if (item.type === 'task') setActiveTab('tasks');
    else if (item.type === 'bill') setActiveTab('bills');
    else if (item.type === 'goal') setActiveTab('goals');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Jivan AI Companion
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  Gemini
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Natural-language creation for tasks, habits, bills & goals
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {aiMessages.length === 0 && (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              <Sparkles className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">How can I help you today?</p>
              <p className="text-[11px] mt-1">Type in natural language to create habits, schedule tasks, or track bills.</p>
            </div>
          )}

          {aiMessages.map((msg, idx) => {
            const isUser = msg.sender === 'user' || (msg as any).role === 'user';
            const messageText = msg.text || (msg as any).content || '';
            const actionItem = msg.actionableItem || (msg as any).actionableItems?.[0];

            return (
              <div
                key={msg.id || idx}
                className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-xs rounded-tr-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{messageText}</p>

                  {/* Structured Actionable Item Card (Ready to add in one click) */}
                  {actionItem && (
                    <div className="pt-2 mt-2 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Ready to Add:
                      </div>

                      {(() => {
                        const itemKey = `${actionItem.type}_${idx}`;
                        const isApplied = !!appliedItemIds[itemKey];
                        const title = actionItem.type === 'habit' ? actionItem.name : actionItem.title;
                        const subtitle =
                          actionItem.type === 'task'
                            ? `Priority ${actionItem.priority || 'P2'} • Due ${actionItem.dueDate || 'Today'}`
                            : actionItem.type === 'habit'
                            ? `Category: ${actionItem.category || 'Fitness'} • ${actionItem.frequency || 'Daily'}`
                            : actionItem.type === 'bill'
                            ? `Amount: $${actionItem.amount} • Due ${actionItem.dueDate}`
                            : `Target: ${actionItem.targetDate}`;

                        return (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 shrink-0">
                                {actionItem.type === 'task' && <Calendar className="w-3.5 h-3.5" />}
                                {actionItem.type === 'habit' && <Flame className="w-3.5 h-3.5" />}
                                {actionItem.type === 'bill' && <DollarSign className="w-3.5 h-3.5" />}
                                {actionItem.type === 'goal' && <Target className="w-3.5 h-3.5" />}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-white truncate">
                                  {title}
                                </div>
                                <div className="text-[10px] text-slate-500 capitalize truncate">
                                  {subtitle}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleApply(actionItem, idx)}
                              disabled={isApplied}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 transition ${
                                isApplied
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 cursor-default'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-xs'
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
                                  <span>Add Now</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isAILoading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Jivan AI is processing your request...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {starterSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(s);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[11px] text-slate-600 dark:text-slate-300 hover:text-indigo-600 whitespace-nowrap transition"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Footer */}
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60"
        >
          <input
            type="text"
            placeholder="e.g. Schedule gym tomorrow 8am or Pay credit card $200"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isAILoading}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isAILoading}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center transition active:scale-95 shadow-xs shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
