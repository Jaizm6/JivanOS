import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RotateCcw,
  Sliders,
  Check,
  Layers,
  Rainbow,
  Zap,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  LiquidGlassConfig,
  MotionConfig,
  LIQUID_GLASS_PRESETS,
  MOTION_PRESETS,
  getInitialLiquidGlassConfig,
  getInitialMotionConfig,
  applyLiquidGlassAndMotionToCSS,
} from '../../utils/liquidGlass';

export const LiquidGlassStudio: React.FC = () => {
  const [glass, setGlass] = useState<LiquidGlassConfig>(getInitialLiquidGlassConfig);
  const [motion, setMotion] = useState<MotionConfig>(getInitialMotionConfig);
  const [isTryAnimActive, setIsTryAnimActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    applyLiquidGlassAndMotionToCSS(glass, motion);
  }, [glass, motion]);

  const updateGlass = (updates: Partial<LiquidGlassConfig>) => {
    setGlass((prev) => {
      const next = { ...prev, ...updates, preset: 'custom' as const };
      return next;
    });
  };

  const selectGlassPreset = (presetKey: Exclude<LiquidGlassConfig['preset'], 'custom'>) => {
    const presetValues = LIQUID_GLASS_PRESETS[presetKey];
    setGlass({ preset: presetKey, ...presetValues });
    showToast(`Applied ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)} Liquid Glass preset`);
  };

  const updateMotion = (updates: Partial<MotionConfig>) => {
    setMotion((prev) => {
      const next = { ...prev, ...updates, preset: 'custom' as const };
      return next;
    });
  };

  const selectMotionPreset = (presetKey: Exclude<MotionConfig['preset'], 'custom'>) => {
    const presetValues = MOTION_PRESETS[presetKey];
    setMotion({ preset: presetKey, ...presetValues });
    showToast(`Applied ${presetKey.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')} Motion preset`);
  };

  const handleResetGlass = () => {
    setGlass({ preset: 'default', ...LIQUID_GLASS_PRESETS.default });
    showToast('Liquid Glass settings reset to default');
  };

  const handleResetMotion = () => {
    setMotion({ preset: 'normal', ...MOTION_PRESETS.normal });
    showToast('Motion settings reset to default');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleTryMotion = () => {
    setIsTryAnimActive(true);
    setTimeout(() => setIsTryAnimActive(false), 900);
  };

  // Compute live glass style for preview
  const liveGlassStyle: React.CSSProperties = {
    backdropFilter: `blur(${glass.blur * 12}px) saturate(${glass.vibrancy * 100}%) brightness(${100 + glass.brightness * 25}%)`,
    WebkitBackdropFilter: `blur(${glass.blur * 12}px) saturate(${glass.vibrancy * 100}%) brightness(${100 + glass.brightness * 25}%)`,
    backgroundColor: `rgba(255, 255, 255, ${Math.min(0.85, 0.12 * glass.tint)})`,
    borderRadius: `${glass.cornerRadius * 1}rem`,
    borderWidth: `${Math.max(1, glass.specularHighlight * 1.5)}px`,
    borderColor: `rgba(255, 255, 255, ${0.35 * glass.specularHighlight})`,
    boxShadow: glass.depthEffect
      ? `inset 0 0 20px rgba(255,255,255,0.4), 0 10px 30px rgba(0,0,0,0.18)`
      : `0 8px 24px rgba(0,0,0,0.12)`,
  };

  // Chromatic aberration border inline glow
  const chromaticBorderClass = glass.chromaticAberration
    ? 'ring-2 ring-gradient-to-r ring-cyan-400/80 shadow-[0_0_15px_rgba(56,189,248,0.5),_0_0_25px_rgba(236,72,153,0.3)] animate-pulse'
    : '';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. LIQUID GLASS SECTION */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Liquid Glass Customization</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase font-mono">
                  Theme Studio
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Refraction, light dispersion, depth effects and glass optics customization
              </p>
            </div>
          </div>
        </div>

        {/* Live Glass Interactive Canvas Preview */}
        <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden p-4 flex items-center justify-center bg-gradient-to-tr from-amber-500 via-orange-500 via-emerald-400 to-indigo-600 shadow-inner select-none group">
          {/* Background pattern lines */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Sample Background Text */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 text-[11px] font-mono text-white/90 font-bold tracking-wide pointer-events-none">
            <div className="flex justify-between">
              <span>ClearPDF • Aa Bb Cc</span>
              <span>0123456789</span>
            </div>
            <div className="flex justify-between">
              <span>ClearPDF • Aa Bb Cc</span>
              <span>0123456789</span>
            </div>
            <div className="flex justify-between">
              <span>ClearPDF • Aa Bb Cc</span>
              <span>0123456789</span>
            </div>
          </div>

          {/* Main Floating Liquid Glass Lens */}
          <div
            style={liveGlassStyle}
            className={`relative px-8 py-4 sm:px-10 sm:py-5 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${chromaticAberrationClass(
              glass.chromaticAberration
            )} ${chromaticBorderClass}`}
          >
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight drop-shadow-xs">
              Liquid Glass
            </span>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 font-mono opacity-80 mt-0.5">
              Refraction: {glass.refractionAmount.toFixed(2)} • Blur: {glass.blur.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Liquid Glass Presets Bar */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
            Glass Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'default' as const, label: 'Default' },
              { id: 'readable' as const, label: 'Readable' },
              { id: 'crystal' as const, label: 'Crystal' },
              { id: 'performance' as const, label: 'Performance' },
            ].map((p) => {
              const isActive = glass.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectGlassPreset(p.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  {isActive && <Check className="w-3.5 h-3.5" />}
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Liquid Glass Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Blur */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Blur</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.blur.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="4.00"
              step="0.01"
              value={glass.blur}
              onChange={(e) => updateGlass({ blur: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Refraction height */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Refraction height</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.refractionHeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={glass.refractionHeight}
              onChange={(e) => updateGlass({ refractionHeight: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Refraction amount */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Refraction amount</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.refractionAmount.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={glass.refractionAmount}
              onChange={(e) => updateGlass({ refractionAmount: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Tint */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Tint</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.tint.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={glass.tint}
              onChange={(e) => updateGlass({ tint: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Vibrancy */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Vibrancy</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.vibrancy.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={glass.vibrancy}
              onChange={(e) => updateGlass({ vibrancy: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Brightness */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Brightness</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.brightness.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-1.00"
              max="1.00"
              step="0.01"
              value={glass.brightness}
              onChange={(e) => updateGlass({ brightness: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Specular highlight */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Specular highlight</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.specularHighlight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="2.00"
              step="0.01"
              value={glass.specularHighlight}
              onChange={(e) => updateGlass({ specularHighlight: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Corner radius */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Corner radius</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {glass.cornerRadius.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="2.00"
              step="0.01"
              value={glass.cornerRadius}
              onChange={(e) => updateGlass({ cornerRadius: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3 pt-2">
          {/* Depth effect Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Depth effect</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Thicker-looking glass that bends more toward the centre
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={glass.depthEffect}
                onChange={(e) => updateGlass({ depthEffect: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>

          {/* Chromatic aberration Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Rainbow className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Chromatic aberration</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Prism-coloured fringes on the glass edges
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={glass.chromaticAberration}
                onChange={(e) => updateGlass({ chromaticAberration: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
            </label>
          </div>
        </div>

        {/* Reset Glass Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleResetGlass}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to default</span>
          </button>
        </div>
      </div>

      {/* 2. MOTION DYNAMICS SECTION */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Motion</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How every glass button, slider and sheet springs. Pick a profile or tune each part, then press Try it to feel it.
              </p>
            </div>
          </div>
        </div>

        {/* Motion Presets Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'normal' as const, label: 'Normal' },
            { id: 'performance' as const, label: 'Performance' },
            { id: 'bouncy' as const, label: 'Bouncy' },
            { id: 'super_springy' as const, label: 'Super springy' },
          ].map((m) => {
            const isActive = motion.preset === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMotionPreset(m.id)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                }`}
              >
                {isActive && <Check className="w-3.5 h-3.5" />}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Try It Motion Tester Button */}
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleTryMotion}
            style={{
              transform: isTryAnimActive
                ? `scale(${Math.max(0.7, 1 - motion.pressDepth * 0.15)}) rotate(${motion.releaseJiggle * 2}deg)`
                : 'scale(1) rotate(0deg)',
              transitionDuration: `${Math.max(0.1, 0.4 / motion.speed)}s`,
              transitionTimingFunction: `cubic-bezier(0.34, ${1 + motion.bounce * 0.8}, 0.64, 1)`,
            }}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer select-none active:scale-90"
          >
            <span>Try it</span>
          </button>
          <span className="text-[11px] font-mono text-slate-400">
            Click to feel current spring kinematics (Bounce: {motion.bounce.toFixed(2)}, Speed: {motion.speed.toFixed(2)})
          </span>
        </div>

        {/* Motion Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bounce */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Bounce</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.bounce.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="1.00"
              step="0.01"
              value={motion.bounce}
              onChange={(e) => updateMotion({ bounce: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Speed</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.speed.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="3.00"
              step="0.01"
              value={motion.speed}
              onChange={(e) => updateMotion({ speed: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* Press depth */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Press depth</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.pressDepth.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="2.00"
              step="0.01"
              value={motion.pressDepth}
              onChange={(e) => updateMotion({ pressDepth: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* Release jiggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Release jiggle</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.releaseJiggle.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={motion.releaseJiggle}
              onChange={(e) => updateMotion({ releaseJiggle: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* Drag stretch */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Drag stretch</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.dragStretch.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={motion.dragStretch}
              onChange={(e) => updateMotion({ dragStretch: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          {/* Long-press bloom */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Long-press bloom</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {motion.longPressBloom.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="3.00"
              step="0.01"
              value={motion.longPressBloom}
              onChange={(e) => updateMotion({ longPressBloom: parseFloat(e.target.value) })}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Reset Motion Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleResetMotion}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset motion</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function chromaticAberrationClass(active: boolean) {
  if (!active) return '';
  return 'before:absolute before:inset-0 before:rounded-2xl before:border before:border-cyan-400/60 before:-translate-x-0.5 before:-translate-y-0.5 after:absolute after:inset-0 after:rounded-2xl after:border after:border-pink-500/60 after:translate-x-0.5 after:translate-y-0.5';
}
