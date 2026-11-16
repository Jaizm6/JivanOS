import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RotateCcw,
  Check,
  Layers,
  Rainbow,
  Activity,
  LayoutGrid,
  Navigation,
  PanelTop,
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
import {
  PetalShapeBadge,
  getPetalGroupRadiusClass,
} from '../common/PetalExpressive';

export const LiquidGlassStudio: React.FC = () => {
  const [glass, setGlass] = useState<LiquidGlassConfig>(getInitialLiquidGlassConfig);
  const [motion, setMotion] = useState<MotionConfig>(getInitialMotionConfig);
  const [isTryAnimActive, setIsTryAnimActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    applyLiquidGlassAndMotionToCSS(glass, motion);
  }, [glass, motion]);

  const updateGlass = (updates: Partial<LiquidGlassConfig>) => {
    setGlass((prev) => ({
      ...prev,
      ...updates,
      preset: updates.preset ?? ('custom' as const),
    }));
  };

  const selectGlassPreset = (presetKey: Exclude<LiquidGlassConfig['preset'], 'custom'>) => {
    const presetValues = LIQUID_GLASS_PRESETS[presetKey];
    setGlass((prev) => ({
      ...prev,
      enabled: true,
      preset: presetKey,
      ...presetValues,
    }));
    showToast(`Applied ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)} Liquid Glass preset`);
  };

  const updateMotion = (updates: Partial<MotionConfig>) => {
    setMotion((prev) => ({
      ...prev,
      ...updates,
      preset: 'custom' as const,
    }));
  };

  const selectMotionPreset = (presetKey: Exclude<MotionConfig['preset'], 'custom'>) => {
    const presetValues = MOTION_PRESETS[presetKey];
    setMotion({ preset: presetKey, ...presetValues });
    showToast(`Applied ${presetKey.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')} Motion preset`);
  };

  const handleResetGlass = () => {
    setGlass({
      enabled: false,
      applyToCards: true,
      applyToNav: true,
      applyToHeader: true,
      preset: 'default',
      ...LIQUID_GLASS_PRESETS.default,
    });
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

  // Compute live glass style for the PetalGlassLab preview lens
  const liveGlassStyle: React.CSSProperties = {
    backdropFilter: `blur(${Math.max(2, glass.blur * 14)}px) saturate(${glass.vibrancy * 110}%) brightness(${100 + glass.brightness * 22}%)`,
    WebkitBackdropFilter: `blur(${Math.max(2, glass.blur * 14)}px) saturate(${glass.vibrancy * 110}%) brightness(${100 + glass.brightness * 22}%)`,
    background: `linear-gradient(135deg, rgba(255,255,255,${Math.min(0.82, 0.22 * glass.tint + glass.specularHighlight * 0.14)}) 0%, rgba(255,255,255,${Math.min(0.65, 0.12 * glass.tint)}) 55%, rgba(255,255,255,${Math.min(0.75, 0.18 * glass.tint)}) 100%)`,
    borderRadius: `${Math.max(0.75, glass.cornerRadius * 1.35)}rem`,
    borderWidth: `${Math.max(1, glass.specularHighlight * 1.25)}px`,
    borderColor: `rgba(255, 255, 255, ${Math.min(0.85, 0.35 * glass.specularHighlight)})`,
    boxShadow: glass.depthEffect
      ? `inset 0 1px 22px rgba(255,255,255,${Math.min(0.65, 0.32 * glass.specularHighlight)}), 0 14px 34px rgba(0,0,0,0.22)`
      : `0 8px 24px rgba(0,0,0,0.14)`,
  };

  const chromaticBorderClass = glass.chromaticAberration
    ? 'ring-2 ring-cyan-400/75 shadow-[0_0_16px_rgba(56,189,248,0.45),_0_0_26px_rgba(236,72,153,0.32)]'
    : '';

  const surfaceTargets = [
    {
      key: 'applyToCards' as const,
      title: 'Containment Cards & Lists',
      desc: 'Apply translucent glass & top specular rim to task, habit & settings cards',
      icon: <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      shape: 'cookie9' as const,
    },
    {
      key: 'applyToNav' as const,
      title: 'Bottom Navigation Dock',
      desc: 'Frosted floating glass dock with live background refraction',
      icon: <Navigation className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
      shape: 'scallop' as const,
    },
    {
      key: 'applyToHeader' as const,
      title: 'Top App Bar & Header',
      desc: 'Translucent header chrome with subtle bottom specular border',
      icon: <PanelTop className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      shape: 'clover' as const,
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden animate-view-enter">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-16 right-4 z-50 px-3.5 py-2 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-lg border border-slate-700 flex items-center gap-2 max-w-[90vw]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* 1. PETAL LIQUID GLASS CHROME LAB */}
      <div className="space-y-2 w-full min-w-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 block">
          Petal Liquid Glass Lab
        </span>

        {/* Master Toggle Hero Card (TOP of group) */}
        <div className="space-y-[3px] w-full min-w-0">
          <div className="w-full min-w-0 overflow-hidden rounded-t-[20px] rounded-b-[6px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 flex items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <PetalShapeBadge
                shape="cookie12"
                fillClass="text-cyan-100 dark:text-cyan-950/90"
                strokeClass="text-cyan-300 dark:text-cyan-800"
                sizeClass="w-9 h-9"
              >
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </PetalShapeBadge>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    Enable Liquid Glass Chrome
                  </h2>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25 uppercase font-mono shrink-0">
                    Petal v4.4
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-snug">
                  Translucent frosted surfaces with top specular sheen &amp; dual-angle chromatic rim
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={glass.enabled}
                onChange={(e) => {
                  const nextEnabled = e.target.checked;
                  updateGlass({ enabled: nextEnabled });
                  showToast(nextEnabled ? 'Liquid Glass Chrome Enabled' : 'Solid Material Surfaces Restored');
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {/* Interactive Live Glass Lab Preview Canvas (MIDDLE of group) */}
          <div className="w-full min-w-0 overflow-hidden rounded-[6px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 space-y-3 shadow-2xs">
            <div className="relative w-full h-36 sm:h-44 rounded-[18px] overflow-hidden p-3 flex items-center justify-center bg-slate-950 shadow-inner select-none group">
              {/* Animated Petal Colour Blobs */}
              <div className="absolute -top-10 -left-8 w-36 h-36 rounded-full bg-indigo-500/85 blur-2xl animate-pulse pointer-events-none" />
              <div className="absolute -bottom-12 left-1/4 w-40 h-40 rounded-full bg-rose-500/80 blur-2xl pointer-events-none" />
              <div className="absolute -top-6 right-4 w-32 h-32 rounded-full bg-cyan-400/80 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 right-6 w-28 h-28 rounded-full bg-amber-400/75 blur-2xl pointer-events-none" />

              {/* Subtle Dot Grid Pattern */}
              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />

              {/* Background Reference Typography */}
              <div className="absolute inset-0 flex flex-col justify-between p-2.5 sm:p-3 text-[9.5px] font-mono text-white/85 font-bold tracking-tight pointer-events-none">
                <div className="flex justify-between gap-2 min-w-0">
                  <span className="truncate">PETAL GLASS • v4.4</span>
                  <span className="shrink-0">SPECULAR {(glass.specularHighlight * 50).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between gap-2 min-w-0">
                  <span className="truncate">REFRACTION {(glass.refractionAmount * 33).toFixed(0)}%</span>
                  <span className="shrink-0">ALPHA {(glass.tint * 33).toFixed(0)}%</span>
                </div>
              </div>

              {/* Floating Frosted Liquid Glass Lens */}
              <div
                style={liveGlassStyle}
                className={`relative max-w-[92%] px-4 py-2.5 sm:px-6 sm:py-3.5 flex flex-col items-center justify-center text-center transition-transform duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${chromaticAberrationClass(
                  glass.chromaticAberration
                )} ${chromaticBorderClass}`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-white drop-shadow-xs shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight drop-shadow-xs truncate">
                    Petal Liquid Glass
                  </span>
                </div>
                <span className="text-[9.5px] font-semibold text-white/90 font-mono mt-0.5 drop-shadow-2xs truncate max-w-full">
                  Blur {(glass.blur * 14).toFixed(0)}px • Sheen {(glass.specularHighlight * 50).toFixed(0)}% • Alpha {(glass.tint * 33).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Quick Optical Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-mono">
                Optical Glass Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'default' as const, label: 'Default' },
                  { id: 'readable' as const, label: 'Readable' },
                  { id: 'crystal' as const, label: 'Crystal' },
                  { id: 'performance' as const, label: 'Solid / Fast' },
                ].map((p) => {
                  const isActive = glass.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectGlassPreset(p.id)}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sliders Card (BOTTOM of group) */}
          <div className="w-full min-w-0 overflow-hidden rounded-t-[6px] rounded-b-[20px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 space-y-3.5 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Glass Translucency / Tint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Glass Translucency (Alpha)</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {Math.round((glass.tint / 3) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="2.50"
                  step="0.05"
                  value={glass.tint}
                  onChange={(e) => updateGlass({ tint: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Specular Sheen */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Specular Rim Sheen</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {Math.round((glass.specularHighlight / 2) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="2.00"
                  step="0.05"
                  value={glass.specularHighlight}
                  onChange={(e) => updateGlass({ specularHighlight: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Frosted Blur */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Frosted Backdrop Blur</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {Math.round(glass.blur * 14)}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="3.00"
                  step="0.05"
                  value={glass.blur}
                  onChange={(e) => updateGlass({ blur: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Edge Refraction */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Edge Refraction</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {Math.round((glass.refractionAmount / 3) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="3.00"
                  step="0.05"
                  value={glass.refractionAmount}
                  onChange={(e) => updateGlass({ refractionAmount: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Vibrancy */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Color Vibrancy</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {Math.round(glass.vibrancy * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="2.50"
                  step="0.05"
                  value={glass.vibrancy}
                  onChange={(e) => updateGlass({ vibrancy: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Corner Radius */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Containment Curvature</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {glass.cornerRadius.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="1.75"
                  step="0.05"
                  value={glass.cornerRadius}
                  onChange={(e) => updateGlass({ cornerRadius: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Optical Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">3D Inner Depth</h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                      Concave inner luminance
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={glass.depthEffect}
                  onChange={(e) => updateGlass({ depthEffect: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Rainbow className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Chromatic Rim</h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                      Prism cyan/magenta edge glow
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={glass.chromaticAberration}
                  onChange={(e) => updateGlass({ chromaticAberration: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleResetGlass}
                className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Glass Defaults</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SURFACE CONTAINMENT TARGETS (Petal Grouped Cards) */}
      <div className="space-y-1.5 w-full min-w-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 block">
          Glass Chrome Surfaces
        </span>
        <div className="space-y-[3px] w-full min-w-0">
          {surfaceTargets.map((surf, idx) => {
            const radiusClass = getPetalGroupRadiusClass(idx, surfaceTargets.length);
            const isChecked = glass[surf.key];
            return (
              <div
                key={surf.key}
                onClick={() => updateGlass({ [surf.key]: !isChecked })}
                className={`${radiusClass} w-full min-w-0 overflow-hidden border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 transition select-none group`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <PetalShapeBadge
                    shape={surf.shape}
                    fillClass="text-indigo-50 dark:text-indigo-950/70"
                    strokeClass="text-indigo-200 dark:text-indigo-800/70"
                    sizeClass="w-9 h-9"
                  >
                    {surf.icon}
                  </PetalShapeBadge>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {surf.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {surf.desc}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-4 h-4 accent-indigo-600 rounded pointer-events-none shrink-0"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PETAL SPATIAL MOTION & SPRING PHYSICS */}
      <div className="space-y-1.5 w-full min-w-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 block">
          Petal Spatial Motion Physics
        </span>
        <div className="w-full min-w-0 overflow-hidden rounded-[20px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <PetalShapeBadge
                shape="scallop"
                fillClass="text-purple-100 dark:text-purple-950/80"
                strokeClass="text-purple-300 dark:text-purple-800"
                sizeClass="w-9 h-9"
              >
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </PetalShapeBadge>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Spring Kinematics &amp; Tactile Press
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  Tune how every card, button, and sheet responds to touch
                </p>
              </div>
            </div>
          </div>

          {/* Motion Presets Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'normal' as const, label: 'Petal Balanced' },
              { id: 'performance' as const, label: 'Snappy 120Hz' },
              { id: 'bouncy' as const, label: 'Expressive' },
              { id: 'super_springy' as const, label: 'Super Springy' },
            ].map((m) => {
              const isActive = motion.preset === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMotionPreset(m.id)}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700/80'
                  }`}
                >
                  {isActive && <Check className="w-3.5 h-3.5" />}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Try It Motion Tester */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Interactive Spring Test Pad
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Bounce: {motion.bounce.toFixed(2)} • Speed: {motion.speed.toFixed(2)}x • Press Depth: {motion.pressDepth.toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTryMotion}
              style={{
                transform: isTryAnimActive
                  ? `scale(${Math.max(0.75, 1 - motion.pressDepth * 0.14)}) rotate(${motion.releaseJiggle * 2}deg)`
                  : 'scale(1) rotate(0deg)',
                transitionDuration: `${Math.max(0.1, 0.36 / motion.speed)}s`,
                transitionTimingFunction: `cubic-bezier(0.34, ${1 + motion.bounce * 0.8}, 0.64, 1)`,
              }}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-sm hover:shadow-md transition cursor-pointer select-none shrink-0"
            >
              Tap to Feel Spring
            </button>
          </div>

          {/* Motion Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Bounce Damping</span>
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

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Animation Speed</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {motion.speed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.40"
                max="2.50"
                step="0.05"
                value={motion.speed}
                onChange={(e) => updateMotion({ speed: parseFloat(e.target.value) })}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Tactile Press Depth</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {motion.pressDepth.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.00"
                max="2.00"
                step="0.05"
                value={motion.pressDepth}
                onChange={(e) => updateMotion({ pressDepth: parseFloat(e.target.value) })}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <span>Release Jiggle</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {motion.releaseJiggle.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.00"
                max="2.50"
                step="0.05"
                value={motion.releaseJiggle}
                onChange={(e) => updateMotion({ releaseJiggle: parseFloat(e.target.value) })}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleResetMotion}
              className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Motion</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function chromaticAberrationClass(active: boolean) {
  if (!active) return '';
  return 'before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-cyan-400/60 before:-translate-x-0.5 before:-translate-y-0.5 after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-pink-500/60 after:translate-x-0.5 after:translate-y-0.5';
}
