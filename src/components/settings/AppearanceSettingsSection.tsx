import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { showAndroidToast } from '../common/AndroidToast';
import { soundEngine } from '../../utils/audio';
import {
  getVisualPaletteMode,
  setVisualPaletteMode,
  VisualPaletteMode,
} from '../../utils/activityStyles';
import {
  M3Switch,
  PETAL_COLOR_STYLES,
  PETAL_PALETTE_OPTIONS,
  PetalColorStyleId,
  PetalFourQuadrantSwatch,
  getSavedAmoledBlack,
  getSavedExpressiveShapes,
  getSavedPetalColorStyle,
  setSavedAmoledBlack,
  setSavedExpressiveShapes,
  setSavedPetalColorStyle,
} from '../common/PetalExpressive';

interface AppearanceSettingsSectionProps {
  onExpressiveShapesChange?: (enabled: boolean) => void;
}

export const AppearanceSettingsSection: React.FC<AppearanceSettingsSectionProps> = ({
  onExpressiveShapesChange,
}) => {
  const { theme, setTheme, accentTone, setAccentTone } = useApp();

  const [paletteMode, setPaletteModeState] = useState<VisualPaletteMode>(() =>
    getVisualPaletteMode()
  );
  const [colorStyle, setColorStyleState] = useState<PetalColorStyleId>(() =>
    getSavedPetalColorStyle()
  );
  const [amoledBlack, setAmoledBlackState] = useState<boolean>(() => getSavedAmoledBlack());
  const [expressiveShapes, setExpressiveShapesState] = useState<boolean>(() =>
    getSavedExpressiveShapes()
  );

  const [isHarmonyExpanded, setIsHarmonyExpanded] = useState(false);

  const handleSelectPalette = (opt: (typeof PETAL_PALETTE_OPTIONS)[number]) => {
    if (opt.accentTone) setAccentTone(opt.accentTone);
    const nextMode: VisualPaletteMode = opt.paletteMode || 'colorful';
    setVisualPaletteMode(nextMode);
    setPaletteModeState(nextMode);
    try {
      soundEngine.playClick?.();
    } catch {}
  };

  const handleSelectColorStyle = (style: PetalColorStyleId) => {
    setColorStyleState(style);
    setSavedPetalColorStyle(style);
    try {
      soundEngine.playClick?.();
    } catch {}
  };

  const handleToggleAmoled = (enabled: boolean) => {
    setAmoledBlackState(enabled);
    setSavedAmoledBlack(enabled);
    try {
      soundEngine.playClick?.();
    } catch {}
  };

  const handleToggleExpressiveShapes = (enabled: boolean) => {
    setExpressiveShapesState(enabled);
    setSavedExpressiveShapes(enabled);
    onExpressiveShapesChange?.(enabled);
    try {
      soundEngine.playClick?.();
    } catch {}
  };

  const activeHarmonyLabel =
    PETAL_COLOR_STYLES.find((s) => s.id === colorStyle)?.label || 'Tonal Spot';

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Card 1: Visual Light / Dark Mode Phone Preview + Core Display Toggles */}
      <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
        {/* Visual Light / Dark Device Previews */}
        <div className="px-4 pt-5 pb-4 grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {/* Light Mode Preview */}
          <button
            type="button"
            onClick={() => {
              if (theme !== 'light') {
                setTheme('light');
                showAndroidToast('Light mode');
              }
            }}
            className="flex flex-col items-center gap-2.5 group cursor-pointer"
          >
            <div
              className={`w-[92px] h-[148px] rounded-[20px] p-2.5 border-2 transition flex flex-col justify-between bg-gradient-to-b from-sky-50 via-indigo-50/70 to-white ${
                theme === 'light'
                  ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20'
                  : 'border-slate-200 dark:border-zinc-700 opacity-80 group-hover:opacity-100'
              }`}
            >
              <div className="text-[12px] font-semibold text-slate-700 text-center pt-1 tabular-nums">
                10:30
              </div>
              <div className="space-y-1.5">
                <div className="h-5 rounded-lg bg-white shadow-2xs border border-slate-200/70 px-1.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                  <span className="h-1.5 w-8 rounded-full bg-slate-300" />
                </div>
                <div className="h-4 rounded-lg bg-white/90 border border-slate-200/50 px-1.5 flex items-center">
                  <span className="h-1.5 w-10 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="h-1 w-7 rounded-full bg-slate-300 mx-auto" />
            </div>

            <span
              className={`text-xs font-medium ${
                theme === 'light'
                  ? 'text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Light mode
            </span>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                theme === 'light'
                  ? 'border-[#4F46E5] bg-[#4F46E5]'
                  : 'border-slate-300 dark:border-zinc-600'
              }`}
            >
              {theme === 'light' && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          </button>

          {/* Dark Mode Preview */}
          <button
            type="button"
            onClick={() => {
              if (theme !== 'dark') {
                setTheme('dark');
                showAndroidToast('Dark mode');
              }
            }}
            className="flex flex-col items-center gap-2.5 group cursor-pointer"
          >
            <div
              className={`w-[92px] h-[148px] rounded-[20px] p-2.5 border-2 transition flex flex-col justify-between bg-gradient-to-b from-slate-900 via-zinc-900 to-black ${
                theme === 'dark'
                  ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/25'
                  : 'border-slate-200 dark:border-zinc-700 opacity-80 group-hover:opacity-100'
              }`}
            >
              <div className="text-[12px] font-semibold text-zinc-200 text-center pt-1 tabular-nums">
                10:30
              </div>
              <div className="space-y-1.5">
                <div className="h-5 rounded-lg bg-zinc-800 border border-zinc-700/80 px-1.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="h-1.5 w-8 rounded-full bg-zinc-500" />
                </div>
                <div className="h-4 rounded-lg bg-zinc-800/70 border border-zinc-700/50 px-1.5 flex items-center">
                  <span className="h-1.5 w-10 rounded-full bg-zinc-600" />
                </div>
              </div>
              <div className="h-1 w-7 rounded-full bg-zinc-600 mx-auto" />
            </div>

            <span
              className={`text-xs font-medium ${
                theme === 'dark'
                  ? 'text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Dark mode
            </span>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                theme === 'dark'
                  ? 'border-[#4F46E5] bg-[#4F46E5]'
                  : 'border-slate-300 dark:border-zinc-600'
              }`}
            >
              {theme === 'dark' && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          </button>
        </div>

        <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

        {/* AMOLED Pure Black Row */}
        <div
          onClick={() => handleToggleAmoled(!amoledBlack)}
          className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              AMOLED pure black
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              True #000000 canvas in dark mode
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <M3Switch checked={amoledBlack} onChange={handleToggleAmoled} />
          </div>
        </div>

        <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

        {/* Expressive Icon Shapes Row */}
        <div
          onClick={() => handleToggleExpressiveShapes(!expressiveShapes)}
          className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Expressive icon shapes
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Material 3 cookie, clover &amp; scallop containers
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <M3Switch checked={expressiveShapes} onChange={handleToggleExpressiveShapes} />
          </div>
        </div>
      </div>

      {/* Group 2: Color & Style */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-slate-500 dark:text-zinc-400 px-3">
          Color &amp; style
        </div>

        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          {/* Palette Swatches */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
                Color palette
              </span>
              <span className="text-[13px] text-slate-400 dark:text-zinc-500 capitalize">
                {paletteMode === 'mono_accent' ? 'Monochrome' : accentTone}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 justify-items-center">
              {PETAL_PALETTE_OPTIONS.map((opt) => {
                const isSelected =
                  (opt.id === 'mono_accent' && paletteMode === 'mono_accent') ||
                  (opt.accentTone && paletteMode === 'colorful' && accentTone === opt.accentTone);
                return (
                  <PetalFourQuadrantSwatch
                    key={opt.id}
                    option={opt}
                    selected={Boolean(isSelected)}
                    onSelect={() => handleSelectPalette(opt)}
                    size="sm"
                  />
                );
              })}
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Color Harmony (Compact Expandable Row) */}
          <button
            type="button"
            onClick={() => setIsHarmonyExpanded((prev) => !prev)}
            className="w-full min-h-[54px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100">
              Screen color mode
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500">
              <span>{activeHarmonyLabel}</span>
              {isHarmonyExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </button>

          {isHarmonyExpanded && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PETAL_COLOR_STYLES.map((st) => {
                const isActive = colorStyle === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectColorStyle(st.id)}
                    className={`min-h-[54px] p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-0.5 ${
                      isActive
                        ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                        : 'bg-slate-50 dark:bg-zinc-800/70 text-slate-900 dark:text-zinc-100 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate">{st.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                    <span
                      className={`text-[11px] leading-snug line-clamp-1 ${
                        isActive ? 'text-white/80' : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {st.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
