import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  Smile,
  Brain,
  Dumbbell,
  Salad,
  Moon,
  MessageCircle,
  Palette,
  Compass,
  CheckCircle2,
  RefreshCw,
  Award,
} from 'lucide-react';

interface TipCard {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
  bgGradient: string;
  borderColor: string;
  description: string;
}

const SELF_CARE_TIPS: TipCard[] = [
  {
    id: 'tip_1',
    title: 'Take a Deep Breath',
    tag: 'Mindfulness',
    tagColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    icon: <Brain className="w-5 h-5 text-indigo-500" />,
    bgGradient: 'from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20',
    borderColor: 'border-indigo-100 dark:border-indigo-900/50',
    description: 'Practice 4-7-8 breathing: Inhale for 4 seconds, hold for 7, and exhale slowly for 8. Repeat 4 times to calm your nervous system instantly.',
  },
  {
    id: 'tip_2',
    title: '10-Min Stretch',
    tag: 'Exercise',
    tagColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
    icon: <Dumbbell className="w-5 h-5 text-emerald-500" />,
    bgGradient: 'from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20',
    borderColor: 'border-emerald-100 dark:border-emerald-900/50',
    description: 'Relieve accumulated tension with neck rolls, gentle shoulder shrugs, and hamstring stretches right beside your desk.',
  },
  {
    id: 'tip_3',
    title: 'Eat the Rainbow',
    tag: 'Nutrition',
    tagColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60',
    icon: <Salad className="w-5 h-5 text-amber-500" />,
    bgGradient: 'from-amber-50/70 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20',
    borderColor: 'border-amber-100 dark:border-amber-900/50',
    description: 'Aim for 5 different colored fruits and vegetables today for optimal micronutrients, phytonutrients, and gut microbiome vitality.',
  },
  {
    id: 'tip_4',
    title: 'Wind Down Ritual',
    tag: 'Sleep',
    tagColor: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60',
    icon: <Moon className="w-5 h-5 text-violet-500" />,
    bgGradient: 'from-violet-50/70 to-fuchsia-50/40 dark:from-violet-950/30 dark:to-fuchsia-950/20',
    borderColor: 'border-violet-100 dark:border-violet-900/50',
    description: 'Dim overhead lights 1 hour before sleep. Switch to warm yellow lighting or candle glow to trigger natural melatonin synthesis.',
  },
  {
    id: 'tip_5',
    title: 'Connect Today',
    tag: 'Social',
    tagColor: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60',
    icon: <MessageCircle className="w-5 h-5 text-sky-500" />,
    bgGradient: 'from-sky-50/70 to-blue-50/40 dark:from-sky-950/30 dark:to-blue-950/20',
    borderColor: 'border-sky-100 dark:border-sky-900/50',
    description: 'Send a quick appreciation text to a friend, mentor, or family member. Strengthening social bonds significantly lowers cortisol.',
  },
  {
    id: 'tip_6',
    title: 'Create Something',
    tag: 'Creativity',
    tagColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60',
    icon: <Palette className="w-5 h-5 text-rose-500" />,
    bgGradient: 'from-rose-50/70 to-pink-50/40 dark:from-rose-950/30 dark:to-pink-950/20',
    borderColor: 'border-rose-100 dark:border-rose-900/50',
    description: 'Doodle, write a poem, or cook a new recipe for 15 minutes with no pressure on perfection—just pure playful exploration.',
  },
  {
    id: 'tip_7',
    title: 'Step Outside',
    tag: 'Nature',
    tagColor: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60',
    icon: <Compass className="w-5 h-5 text-teal-500" />,
    bgGradient: 'from-teal-50/70 to-emerald-50/40 dark:from-teal-950/30 dark:to-emerald-950/20',
    borderColor: 'border-teal-100 dark:border-teal-900/50',
    description: 'Spend 15 mindful minutes in natural sunlight. Natural light recalibrates your circadian clock and lifts cognitive clarity.',
  },
  {
    id: 'tip_8',
    title: 'Gratitude Practice',
    tag: 'Gratitude',
    tagColor: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60',
    icon: <Heart className="w-5 h-5 text-cyan-500" />,
    bgGradient: 'from-cyan-50/70 to-blue-50/40 dark:from-cyan-950/30 dark:to-blue-950/20',
    borderColor: 'border-cyan-100 dark:border-cyan-900/50',
    description: 'List 3 specific things you are genuinely grateful for right now. Gratitude physically rewires neural pathways toward optimism.',
  },
];

export const HabitsSelfCareSection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'tips' | 'quiz'>('tips');

  // Quiz state
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [waterLevel, setWaterLevel] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const handleResetQuiz = () => {
    setEnergyLevel(null);
    setWaterLevel(null);
    setStressLevel(null);
    setQuizSubmitted(false);
  };

  const getWellnessScore = () => {
    if (energyLevel === null || waterLevel === null || stressLevel === null) return 0;
    // Energy: 1=1, 2=2, 3=3
    // Water: 1=1, 2=2, 3=3
    // Stress: 1=3 (low stress is good), 2=2, 3=1
    const stressScore = 4 - stressLevel;
    const total = energyLevel + waterLevel + stressScore;
    return Math.round((total / 9) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-teal-500/10 dark:from-rose-950/40 dark:via-amber-950/40 dark:to-teal-950/40 p-4 sm:p-5 rounded-3xl border border-rose-500/20">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Nurture Yourself & Daily Self-Care
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Science-backed daily micro-habits and quick wellness self-checkups to keep your mind and body balanced.
          </p>
        </div>

        {/* Subtab Segmented Switcher */}
        <div className="flex items-center p-1 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto shrink-0 shadow-xs">
          <button
            onClick={() => setActiveSubTab('tips')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'tips'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Daily Tips 💡
          </button>
          <button
            onClick={() => setActiveSubTab('quiz')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'quiz'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Wellness Quiz 🧪
          </button>
        </div>
      </div>

      {activeSubTab === 'tips' ? (
        /* Daily Tips Grid (Screenshot 3 Inspiration) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SELF_CARE_TIPS.map(tip => (
            <div
              key={tip.id}
              className={`p-5 rounded-3xl border ${tip.borderColor} bg-gradient-to-br ${tip.bgGradient} shadow-xs hover:shadow-md transition-all flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-2xl bg-white/80 dark:bg-slate-900/80 flex items-center justify-center shadow-2xs">
                    {tip.icon}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tip.tagColor}`}>
                    {tip.tag}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {tip.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {tip.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>Self-Care Micro-Habit</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" /> High Impact
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Wellness Quiz (Screenshot 4 Inspiration) */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs max-w-2xl mx-auto">
          {!quizSubmitted ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <span className="text-3xl">🧪</span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quick Daily Wellness Check
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  3 simple questions to assess your daily vitality balance
                </p>
              </div>

              {/* Q1: Energy Levels */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  1. How are your physical energy levels today?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1, label: 'Low / Drained', icon: '🔋' },
                    { val: 2, label: 'Moderate / Okay', icon: '⚡' },
                    { val: 3, label: 'High / Vibrant', icon: '🚀' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setEnergyLevel(opt.val)}
                      className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                        energyLevel === opt.val
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Hydration */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  2. Did you hydrate adequately today?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1, label: 'Under 1 Liter', icon: '💧' },
                    { val: 2, label: '1 - 2 Liters', icon: '🥤' },
                    { val: 3, label: '2+ Liters (Optimal)', icon: '🌊' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setWaterLevel(opt.val)}
                      className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                        waterLevel === opt.val
                          ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Stress */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  3. How is your mental stress / overwhelm level?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1, label: 'Calm & Relaxed', icon: '🧘' },
                    { val: 2, label: 'Mild Pressure', icon: '⏳' },
                    { val: 3, label: 'High / Stressed', icon: '🔥' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setStressLevel(opt.val)}
                      className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                        stressLevel === opt.val
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={energyLevel === null || waterLevel === null || stressLevel === null}
                onClick={() => setQuizSubmitted(true)}
                className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm shadow-md transition"
              >
                Calculate Wellness Score
              </button>
            </div>
          ) : (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 mx-auto flex items-center justify-center">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <span className="text-4xl font-black text-slate-900 dark:text-white">
                  {getWellnessScore()}%
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {getWellnessScore() >= 80
                    ? 'Superb Daily Harmony!'
                    : getWellnessScore() >= 55
                    ? 'Balanced, Room for Refreshment'
                    : 'Time for Intentional Recovery'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-2">
                  {getWellnessScore() >= 80
                    ? 'Your physical and mental rhythms are in sync. Maintain your momentum with a gentle evening wind-down.'
                    : getWellnessScore() >= 55
                    ? 'Consider hydrating with an extra glass of water and taking a 10-minute walk to release muscle tightness.'
                    : 'Your system is signaling for rest. Try the 4-7-8 breathing exercise above and step away from digital screens 30 minutes early.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 mx-auto transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake Checkup
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
