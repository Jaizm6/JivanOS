import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Sliders,
  Plus,
  Trash2,
  CloudRain,
  SunMedium,
} from 'lucide-react';
import { CBTRecord, CBTEmotion, MoodType } from '../../types';

interface CBTThoughtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCBT: (entryData: {
    title: string;
    content: string;
    cbtRecord: CBTRecord;
    mood: MoodType;
    tags: string[];
    date: string;
  }) => void;
}

const COMMON_DISTORTIONS = [
  { id: 'catastrophizing', label: 'Catastrophizing', icon: '🧨', desc: 'Expecting the worst possible outcome' },
  { id: 'prediction', label: 'Prediction', icon: '🔮', desc: 'Assuming future negative outcomes as fact' },
  { id: 'black_and_white', label: 'Black-and-white thinking', icon: '🌗', desc: 'All-or-nothing judgments without middle ground' },
  { id: 'mind_reading', label: 'Mind reading', icon: '🧠', desc: 'Assuming others are judging or disliking you' },
  { id: 'emotional_reasoning', label: 'Emotional reasoning', icon: '🎭', desc: '"I feel anxious/guilty, therefore something is wrong"' },
  { id: 'overgeneralization', label: 'Overgeneralization', icon: '🔁', desc: 'Using words like "always" or "never" based on one event' },
  { id: 'labeling', label: 'Labeling', icon: '🏷️', desc: 'Attaching harsh labels to yourself like "I am a failure"' },
  { id: 'should_statements', label: 'Should statements', icon: '⚖️', desc: 'Imposing rigid demands like "I must always be perfect"' },
];

const PRESET_EMOTIONS = [
  { name: 'Shame', emoji: '🫣', defaultVal: 65 },
  { name: 'Anxiety', emoji: '😰', defaultVal: 75 },
  { name: 'Irritation', emoji: '😤', defaultVal: 60 },
  { name: 'Vulnerability', emoji: '🥺', defaultVal: 65 },
  { name: 'Grief', emoji: '😭', defaultVal: 65 },
  { name: 'Sadness', emoji: '😔', defaultVal: 70 },
  { name: 'Guilt', emoji: '😞', defaultVal: 55 },
  { name: 'Overwhelm', emoji: '🤯', defaultVal: 80 },
];

export const CBTThoughtModal: React.FC<CBTThoughtModalProps> = ({
  isOpen,
  onClose,
  onSaveCBT,
}) => {
  const [situation, setSituation] = useState('');
  const [automaticThoughts, setAutomaticThoughts] = useState('');
  const [emotions, setEmotions] = useState<CBTEmotion[]>([
    { name: 'Anxiety', intensity: 75 },
    { name: 'Vulnerability', intensity: 65 },
  ]);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([
    'Catastrophizing',
    'Prediction',
  ]);
  const [rationalReframe, setRationalReframe] = useState('');
  const [customEmotionName, setCustomEmotionName] = useState('');
  const [customEmotionVal, setCustomEmotionVal] = useState(60);

  if (!isOpen) return null;

  const toggleDistortion = (label: string) => {
    if (selectedDistortions.includes(label)) {
      setSelectedDistortions(prev => prev.filter(d => d !== label));
    } else {
      setSelectedDistortions(prev => [...prev, label]);
    }
  };

  const addPresetEmotion = (emotionName: string, defaultVal: number) => {
    if (emotions.some(e => e.name.toLowerCase() === emotionName.toLowerCase())) return;
    setEmotions(prev => [...prev, { name: emotionName, intensity: defaultVal }]);
  };

  const updateEmotionIntensity = (index: number, val: number) => {
    setEmotions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], intensity: val };
      return copy;
    });
  };

  const removeEmotion = (index: number) => {
    setEmotions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomEmotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmotionName.trim()) return;
    if (emotions.some(e => e.name.toLowerCase() === customEmotionName.trim().toLowerCase())) return;
    setEmotions(prev => [...prev, { name: customEmotionName.trim(), intensity: customEmotionVal }]);
    setCustomEmotionName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim() && !automaticThoughts.trim()) return;

    const cbtRecord: CBTRecord = {
      situation: situation.trim() || 'Unspecified Trigger',
      automaticThoughts: automaticThoughts.trim(),
      emotions,
      distortions: selectedDistortions,
      rationalReframe: rationalReframe.trim(),
    };

    const title = situation.trim()
      ? `CBT Reframe: ${situation.trim().slice(0, 35)}...`
      : 'CBT Negative Mindset Reframe';

    // Format readable Markdown content
    let content = `### 🌧️ Situation\n${situation.trim()}\n\n`;
    content += `### 💭 Automatic Negative Thoughts\n"${automaticThoughts.trim()}"\n\n`;
    if (emotions.length > 0) {
      content += `### 📉 Emotional Intensity\n`;
      emotions.forEach(em => {
        content += `- **${em.name}**: ${em.intensity}%\n`;
      });
      content += `\n`;
    }
    if (selectedDistortions.length > 0) {
      content += `### 🔍 Cognitive Distortions Identified\n`;
      selectedDistortions.forEach(d => {
        content += `- ${d}\n`;
      });
      content += `\n`;
    }
    if (rationalReframe.trim()) {
      content += `### ☀️ Compassionate & Rational Reframe\n${rationalReframe.trim()}\n`;
    }

    onSaveCBT({
      title,
      content,
      cbtRecord,
      mood: 'calm',
      tags: ['CBT-Reframe', 'Mindset', ...selectedDistortions.slice(0, 2)],
      date: new Date().toISOString().split('T')[0],
    });

    onClose();
  };

  // Prepopulate with a helpful example if empty
  const handleLoadExample = () => {
    setSituation('Had a presentation where I stumbled on slide 4 and took a long pause.');
    setAutomaticThoughts('Everyone thinks I am incompetent and I ruined the entire presentation.');
    setEmotions([
      { name: 'Shame', intensity: 70 },
      { name: 'Anxiety', intensity: 85 },
      { name: 'Vulnerability', intensity: 65 },
    ]);
    setSelectedDistortions(['Catastrophizing', 'Prediction', 'Mind reading']);
    setRationalReframe(
      'A brief pause is completely normal. The core points of the project were well received, and colleagues asked thoughtful follow-up questions. One awkward moment does not define my capability.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Negative Situations Diary</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  CBT Reframing
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Work through distress, identify cognitive distortions, and build balanced thoughts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadExample}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline px-2 py-1 font-semibold hidden sm:inline-block"
            >
              Load Example
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Step 1: Situation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-blue-500" />
                <span>1. The Triggering Situation</span>
              </label>
              <span className="text-[10px] text-slate-400">Facts only: who, what, when</span>
            </div>
            <input
              type="text"
              required
              value={situation}
              onChange={e => setSituation(e.target.value)}
              placeholder="e.g. Received critical feedback on a project draft from my manager..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>

          {/* Step 2: Negative Thoughts */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>2. Automatic Negative Thoughts</span>
              </label>
              <span className="text-[10px] text-slate-400">What went through your mind?</span>
            </div>
            <textarea
              rows={2}
              required
              value={automaticThoughts}
              onChange={e => setAutomaticThoughts(e.target.value)}
              placeholder="e.g. I feel like I'm terrible at my job and they're going to replace me..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>

          {/* Step 3: Negative Emotions with Intensity */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-500" />
                <span>3. Negative Emotions & Intensity</span>
              </label>
              <span className="text-[10px] text-slate-400">Rate 0 - 100%</span>
            </div>

            {/* Quick preset emotion adders */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_EMOTIONS.map(em => {
                const isSelected = emotions.some(e => e.name.toLowerCase() === em.name.toLowerCase());
                return (
                  <button
                    type="button"
                    key={em.name}
                    onClick={() => addPresetEmotion(em.name, em.defaultVal)}
                    disabled={isSelected}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
                      isSelected
                        ? 'opacity-40 bg-slate-200 dark:bg-slate-700 cursor-default'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{em.emoji}</span>
                    <span>{em.name}</span>
                    <Plus className="w-2.5 h-2.5 opacity-60" />
                  </button>
                );
              })}
            </div>

            {/* Emotion sliders */}
            <div className="space-y-2.5 pt-1">
              {emotions.map((em, idx) => (
                <div
                  key={em.name}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 min-w-[90px] text-xs">
                    {em.name}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={em.intensity}
                    onChange={e => updateEmotionIntensity(idx, Number(e.target.value))}
                    className="flex-1 accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 w-10 text-right">
                    {em.intensity}%
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEmotion(idx)}
                    className="text-slate-400 hover:text-rose-500 transition p-1"
                    title="Remove emotion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Cognitive Distortions Selection */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-indigo-500" />
                <span>4. Cognitive Distortions at Play</span>
              </label>
              <span className="text-[10px] text-slate-400">Select any traps present</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMON_DISTORTIONS.map(item => {
                const checked = selectedDistortions.includes(item.label);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleDistortion(item.label)}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition ${
                      checked
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 5: Positive / Rational Reframe */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                <SunMedium className="w-4 h-4 text-emerald-600" />
                <span>5. Positive & Compassionate Interpretation</span>
              </label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Balanced truth</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              What is a more realistic, supportive, or kindly truthful way to look at this? What would you tell a dear friend?
            </p>
            <textarea
              rows={3}
              required
              value={rationalReframe}
              onChange={e => setRationalReframe(e.target.value)}
              placeholder="e.g. Critical feedback helps me polish my work. One draft does not equal my value as a person or professional. Everyone receives edits..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold flex items-center gap-2 shadow-md transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save CBT Reflection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
