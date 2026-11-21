import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

/**
 * ============================================================================
 * 1. SMOOTH COLLAPSE (60/120FPS COMPOSITOR-FRIENDLY CSS GRID ACCORDION)
 * ============================================================================
 * Eliminates Framer Motion height='auto' layout thrashing and mount/unmount stalls
 * by using native CSS Grid 0fr <-> 1fr interpolation and lazy first-open mounting.
 */
interface SmoothCollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  eager?: boolean;
}

export const SmoothCollapse: React.FC<SmoothCollapseProps> = ({
  isOpen,
  children,
  className = '',
  innerClassName = '',
  onClick,
  eager = false,
}) => {
  const [hasMounted, setHasMounted] = useState(isOpen || eager);

  useEffect(() => {
    if (isOpen && !hasMounted) {
      setHasMounted(true);
    }
  }, [isOpen, hasMounted]);

  return (
    <div
      onClick={onClick}
      aria-hidden={!isOpen}
      className={`grid transition-[grid-template-rows,opacity] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? 'grid-rows-[1fr] opacity-100'
          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
      } ${className}`}
    >
      <div className={`overflow-hidden min-h-0 ${innerClassName}`}>
        {hasMounted ? children : null}
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * 2. OFFICIAL MATERIAL 3 EXPRESSIVE SHAPES (https://m3.material.io/)
 * ============================================================================
 * Canonical Material 3 Expressive (m3.material.io) shape library, corner scale,
 * tonal container roles, and spatial spring physics:
 * - Shapes: Circle, Squircle (Square), Cookie (9-sided & 12-sided), Flower,
 *   Sunny/Scallop, Clover4Leaf, Arch, Pill.
 * - Radii tokens: Extra Small (4px), Small (8px), Medium (12px),
 *   Large Expressive (20px), Extra Large (28px–32px), Full (9999px).
 * - Motion: Spatial spring cubic-bezier(0.34, 1.56, 0.64, 1) for shape/container
 *   transitions; Effects curve cubic-bezier(0.2, 0, 0, 1) for color/opacity.
 */
export type PetalExpressiveShape =
  | 'circle'   // M3 Circle
  | 'squircle' // M3 Rounded Square / Squircle
  | 'cookie9'  // M3 Cookie9Sided
  | 'cookie12' // M3 Cookie12Sided
  | 'flower'   // M3 Flower (6 plump petals)
  | 'scallop'  // M3 Sunny / 8-lobe Scallop
  | 'clover'   // M3 Clover4Leaf
  | 'arch'     // M3 Arch
  | 'pill';    // M3 Pill

/**
 * Generates an SVG path equivalent to Jetpack Compose's
 * `RoundedPolygon.star(...)` used by `MaterialShapes` on m3.material.io.
 * Smooth quadratic Bezier corners link rounded outer lobes and soft valleys.
 */
function buildRoundedStarPath(
  numLobes: number,
  outerRadius: number,
  innerRadius: number,
  outerRounding: number = 0.46,
  innerRounding: number = 0.36,
  rotationOffsetRad: number = -Math.PI / 2,
  cx: number = 50,
  cy: number = 50
): string {
  const totalVerts = numLobes * 2;
  const pts: { x: number; y: number; isOuter: boolean }[] = [];

  for (let i = 0; i < totalVerts; i++) {
    const theta = rotationOffsetRad + (i * Math.PI) / numLobes;
    const isOuter = i % 2 === 0;
    const r = isOuter ? outerRadius : innerRadius;
    pts.push({
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      isOuter,
    });
  }

  const commands: string[] = [];
  for (let i = 0; i < totalVerts; i++) {
    const prev = pts[(i - 1 + totalVerts) % totalVerts];
    const curr = pts[i];
    const next = pts[(i + 1) % totalVerts];
    const cut = curr.isOuter ? outerRounding : innerRounding;

    const ex = curr.x + (prev.x - curr.x) * cut;
    const ey = curr.y + (prev.y - curr.y) * cut;
    const xx = curr.x + (next.x - curr.x) * cut;
    const xy = curr.y + (next.y - curr.y) * cut;

    if (i === 0) {
      commands.push(`M ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    } else {
      commands.push(`L ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    }
    commands.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${xx.toFixed(2)} ${xy.toFixed(2)}`);
  }
  commands.push('Z');
  return commands.join(' ');
}

const COOKIE_12_PATH = buildRoundedStarPath(12, 47.5, 38.5, 0.46, 0.42);
const COOKIE_9_PATH = buildRoundedStarPath(9, 47.5, 36.5, 0.46, 0.42);
const SCALLOP_8_PATH = buildRoundedStarPath(8, 47.5, 34.5, 0.46, 0.34);
const FLOWER_6_PATH = buildRoundedStarPath(6, 48, 30.5, 0.48, 0.24);
const CLOVER_4_PATH = buildRoundedStarPath(4, 48.5, 28, 0.48, 0.18, -Math.PI / 4);

export const M3_EXPRESSIVE_ICON_SHAPES: PetalExpressiveShape[] = [
  'squircle',
  'cookie9',
  'flower',
  'circle',
  'cookie12',
  'clover',
];

export function getHabitExpressiveShape(
  habitIdOrKey: string,
  index?: number
): PetalExpressiveShape {
  if (typeof index === 'number' && index >= 0) {
    return M3_EXPRESSIVE_ICON_SHAPES[index % M3_EXPRESSIVE_ICON_SHAPES.length];
  }
  let hash = 0;
  for (let i = 0; i < habitIdOrKey.length; i++) {
    hash = habitIdOrKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  return M3_EXPRESSIVE_ICON_SHAPES[Math.abs(hash) % M3_EXPRESSIVE_ICON_SHAPES.length];
}

export function getPetalShapeSvgPath(shape: PetalExpressiveShape): string {
  switch (shape) {
    case 'circle':
      return 'M 50 4 A 46 46 0 1 0 50 96 A 46 46 0 1 0 50 4 Z';
    case 'cookie12':
      return COOKIE_12_PATH;
    case 'cookie9':
      return COOKIE_9_PATH;
    case 'flower':
      return FLOWER_6_PATH;
    case 'scallop':
      return SCALLOP_8_PATH;
    case 'clover':
      return CLOVER_4_PATH;
    case 'arch':
      return 'M 10 50 A 40 40 0 0 1 90 50 L 90 84 Q 90 92 82 92 L 18 92 Q 10 92 10 84 Z';
    case 'pill':
      return 'M 22 14 L 78 14 A 36 36 0 0 1 78 86 L 22 86 A 36 36 0 0 1 22 14 Z';
    case 'squircle':
    default:
      return 'M 50 5 C 83 5 95 17 95 50 C 95 83 83 95 50 95 C 17 95 5 83 5 50 C 5 17 17 5 50 5 Z';
  }
}

/**
 * Material 3 Expressive Gear Icon (m3.material.io Sunny/Cookie12 container)
 */
export const MaterialGearIcon: React.FC<{
  className?: string;
  spinning?: boolean;
}> = ({ className = 'w-4 h-4', spinning = false }) => {
  const gearOuterPath = buildRoundedStarPath(8, 45.5, 33.5, 0.42, 0.32);
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${spinning ? 'animate-spin' : ''}`}
    >
      <path
        d={gearOuterPath}
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <circle
        cx="50"
        cy="50"
        r="15"
        stroke="currentColor"
        strokeWidth="8.5"
        fill="none"
      />
    </svg>
  );
};

/**
 * PetalShapeBadge: Material 3 Expressive Shape Container (m3.material.io)
 * Supports Circle, Squircle, Cookie9, Cookie12, Flower, Scallop, Clover, Arch & Pill
 * with tonal container fill and M3 Expressive spatial spring hover physics.
 */
interface PetalShapeBadgeProps {
  shape?: PetalExpressiveShape;
  children: React.ReactNode;
  fillClass?: string;
  strokeClass?: string;
  fillColor?: string;
  strokeColor?: string;
  sizeClass?: string;
  className?: string;
}

export const PetalShapeBadge: React.FC<PetalShapeBadgeProps> = ({
  shape = 'cookie12',
  children,
  fillClass = 'text-indigo-100 dark:text-indigo-950/80',
  strokeClass = 'text-indigo-300/60 dark:text-indigo-800/60',
  fillColor,
  strokeColor,
  sizeClass = 'w-10 h-10',
  className = '',
}) => {
  const [expressiveEnabled, setExpressiveEnabled] = useState<boolean>(() =>
    getSavedExpressiveShapes()
  );

  useEffect(() => {
    const handleShapeToggle = (e: Event) => {
      const customEv = e as CustomEvent<boolean>;
      if (typeof customEv.detail === 'boolean') {
        setExpressiveEnabled(customEv.detail);
      } else {
        setExpressiveEnabled(getSavedExpressiveShapes());
      }
    };
    window.addEventListener('omni-expressive-shapes-change', handleShapeToggle);
    return () => window.removeEventListener('omni-expressive-shapes-change', handleShapeToggle);
  }, []);

  const effectiveShape: PetalExpressiveShape = expressiveEnabled ? shape : 'squircle';
  const pathData = getPetalShapeSvgPath(effectiveShape);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="
          absolute inset-0 w-full h-full pointer-events-none
          transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          group-hover:rotate-6 group-hover:scale-105
        "
      >
        <path
          d={pathData}
          className={fillColor ? undefined : `fill-current ${fillClass}`}
          style={fillColor ? { fill: fillColor } : undefined}
        />
        <path
          d={pathData}
          fill="none"
          strokeWidth="2.2"
          className={strokeColor ? undefined : `stroke-current ${strokeClass}`}
          style={strokeColor ? { stroke: strokeColor } : undefined}
        />
      </svg>
      <div className="relative z-10 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * 3. PETAL GROUPED CONTAINMENT CARDS (PetalContainment.kt)
 * ============================================================================
 * Connected Material 3 card geometry:
 * - SINGLE: 24px all corners
 * - TOP:    24px top corners, 6px bottom corners
 * - MIDDLE: 6px all corners
 * - BOTTOM: 6px top corners, 24px bottom corners
 * Separated by a crisp 3px vertical gap (space-y-[3px]).
 */
export type PetalGroupPosition = 'SINGLE' | 'TOP' | 'MIDDLE' | 'BOTTOM';

export function getPetalPosition(index: number, count: number): PetalGroupPosition {
  if (count <= 1) return 'SINGLE';
  if (index === 0) return 'TOP';
  if (index === count - 1) return 'BOTTOM';
  return 'MIDDLE';
}

export function getPetalGroupRadiusClass(index: number, count: number, compact: boolean = true): string {
  const pos = getPetalPosition(index, count);
  if (compact) {
    switch (pos) {
      case 'SINGLE':
        return 'rounded-[20px]';
      case 'TOP':
        return 'rounded-t-[20px] rounded-b-[5px]';
      case 'BOTTOM':
        return 'rounded-t-[5px] rounded-b-[20px]';
      case 'MIDDLE':
      default:
        return 'rounded-[5px]';
    }
  }
  switch (pos) {
    case 'SINGLE':
      return 'rounded-[24px]';
    case 'TOP':
      return 'rounded-t-[24px] rounded-b-[6px]';
    case 'BOTTOM':
      return 'rounded-t-[6px] rounded-b-[24px]';
    case 'MIDDLE':
    default:
      return 'rounded-[6px]';
  }
}

/**
 * ============================================================================
 * 4. PETAL MATERIAL YOU 4-QUADRANT COLOR SWATCHES & COLOR STYLES
 * ============================================================================
 * Ported from Petal v4.4 AppearanceSettingsScreen.kt & ColorStyles.kt
 */
export interface PetalPaletteOption {
  id: string;
  name: string;
  accentTone?: 'indigo' | 'emerald' | 'violet' | 'rose' | 'amber' | 'cyan';
  paletteMode?: 'colorful' | 'mono_accent';
  primary: string;
  secondaryContainer: string;
  tertiaryContainer: string;
  surface: string;
}

export const PETAL_PALETTE_OPTIONS: PetalPaletteOption[] = [
  {
    id: 'indigo',
    name: 'Indigo Pulse',
    accentTone: 'indigo',
    paletteMode: 'colorful',
    primary: '#4f46e5',
    secondaryContainer: '#c7d2fe',
    tertiaryContainer: '#818cf8',
    surface: '#eef2ff',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    accentTone: 'emerald',
    paletteMode: 'colorful',
    primary: '#059669',
    secondaryContainer: '#a7f3d0',
    tertiaryContainer: '#34d399',
    surface: '#ecfdf5',
  },
  {
    id: 'violet',
    name: 'Violet Nebula',
    accentTone: 'violet',
    paletteMode: 'colorful',
    primary: '#7c3aed',
    secondaryContainer: '#ddd6fe',
    tertiaryContainer: '#a78bfa',
    surface: '#f5f3ff',
  },
  {
    id: 'rose',
    name: 'Rose Blossom',
    accentTone: 'rose',
    paletteMode: 'colorful',
    primary: '#e11d48',
    secondaryContainer: '#fecdd3',
    tertiaryContainer: '#fb7185',
    surface: '#fff1f2',
  },
  {
    id: 'amber',
    name: 'Amber Solar',
    accentTone: 'amber',
    paletteMode: 'colorful',
    primary: '#d97706',
    secondaryContainer: '#fde68a',
    tertiaryContainer: '#fbbf24',
    surface: '#fffbeb',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    accentTone: 'cyan',
    paletteMode: 'colorful',
    primary: '#0284c7',
    secondaryContainer: '#bae6fd',
    tertiaryContainer: '#38bdf8',
    surface: '#f0f9ff',
  },
  {
    id: 'mono_accent',
    name: 'Mono + Multicolor',
    paletteMode: 'mono_accent',
    primary: '#18181b',
    secondaryContainer: '#6366f1',
    tertiaryContainer: '#10b981',
    surface: '#e4e4e7',
  },
];

export type PetalColorStyleId =
  | 'tonal_spot'
  | 'vibrant'
  | 'expressive'
  | 'fruit_salad'
  | 'neutral'
  | 'spritz';

export interface PetalColorStyleSpec {
  id: PetalColorStyleId;
  label: string;
  desc: string;
}

export const PETAL_COLOR_STYLES: PetalColorStyleSpec[] = [
  { id: 'tonal_spot', label: 'Tonal Spot', desc: 'Balanced default color harmony' },
  { id: 'vibrant', label: 'Vibrant', desc: 'Rich, high-chroma accents and lively containers' },
  { id: 'expressive', label: 'Expressive', desc: 'Bold tertiary shifts and playful contrast' },
  { id: 'fruit_salad', label: 'Fruit Salad', desc: 'Dual-tone energetic highlight harmony' },
  { id: 'neutral', label: 'Neutral', desc: 'Calm, low-saturation studio surfaces' },
  { id: 'spritz', label: 'Spritz', desc: 'Minimalist monochrome grayscale focus' },
];

const COLOR_STYLE_STORAGE_KEY = 'jivan_petal_color_style_v1';
const AMOLED_BLACK_STORAGE_KEY = 'jivan_petal_amoled_black_v1';
const EXPRESSIVE_SHAPES_STORAGE_KEY = 'jivan_petal_expressive_shapes_v1';

export function getSavedPetalColorStyle(): PetalColorStyleId {
  try {
    const saved = localStorage.getItem(COLOR_STYLE_STORAGE_KEY);
    if (
      saved === 'tonal_spot' ||
      saved === 'vibrant' ||
      saved === 'expressive' ||
      saved === 'fruit_salad' ||
      saved === 'neutral' ||
      saved === 'spritz'
    ) {
      return saved;
    }
    return 'tonal_spot';
  } catch {
    return 'tonal_spot';
  }
}

export function setSavedPetalColorStyle(style: PetalColorStyleId) {
  try {
    localStorage.setItem(COLOR_STYLE_STORAGE_KEY, style);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-color-style', style);
    }
    window.dispatchEvent(new CustomEvent('omni-petal-style-change', { detail: style }));
  } catch {}
}

export function getSavedAmoledBlack(): boolean {
  try {
    const val = localStorage.getItem(AMOLED_BLACK_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSavedAmoledBlack(enabled: boolean) {
  try {
    localStorage.setItem(AMOLED_BLACK_STORAGE_KEY, String(enabled));
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-amoled', enabled ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('omni-amoled-change', { detail: enabled }));
  } catch {}
}

export function getSavedExpressiveShapes(): boolean {
  try {
    const val = localStorage.getItem(EXPRESSIVE_SHAPES_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSavedExpressiveShapes(enabled: boolean) {
  try {
    localStorage.setItem(EXPRESSIVE_SHAPES_STORAGE_KEY, String(enabled));
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-expressive-shapes', enabled ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('omni-expressive-shapes-change', { detail: enabled }));
  } catch {}
}

/**
 * PetalFourQuadrantSwatch: Material 3 Expressive 4-quadrant circular palette picker
 */
export const PetalFourQuadrantSwatch: React.FC<{
  option: PetalPaletteOption;
  selected: boolean;
  onSelect: () => void;
  size?: 'sm' | 'md';
}> = ({ option, selected, onSelect, size = 'md' }) => {
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      onClick={onSelect}
      title={option.name}
      className={`group flex flex-col items-center gap-1.5 cursor-pointer select-none focus:outline-none ${
        isSm ? 'w-12' : 'w-15 sm:w-16'
      }`}
    >
      <div
        className={`relative rounded-2xl flex items-center justify-center transition-all duration-200 ${
          isSm ? 'w-11 h-11 p-1' : 'w-13 h-13 sm:w-14 sm:h-14 p-1.5'
        } ${
          selected
            ? 'bg-indigo-500/15 dark:bg-indigo-400/20 ring-2 ring-indigo-600 dark:ring-indigo-400 scale-105'
            : 'bg-slate-100/90 dark:bg-zinc-800/80 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 hover:scale-105'
        }`}
      >
        {/* 4-Quadrant Circle */}
        <div className="relative w-full h-full rounded-full overflow-hidden grid grid-cols-2 grid-rows-2 gap-[1.5px] bg-white/80 dark:bg-zinc-900/90 shadow-2xs">
          <div style={{ backgroundColor: option.primary }} />
          <div style={{ backgroundColor: option.secondaryContainer }} />
          <div style={{ backgroundColor: option.tertiaryContainer }} />
          <div style={{ backgroundColor: option.surface }} />
        </div>

        {/* Expressive Cookie/Gear Active Checkmark Overlay */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-nav-pill">
            <div className="w-6 h-6 relative flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-xs">
                <path d={COOKIE_12_PATH} fill={option.primary} />
              </svg>
              <Check className="w-3.5 h-3.5 text-white stroke-[3] relative z-10" />
            </div>
          </div>
        )}
      </div>

      <span
        className={`text-[10px] leading-tight text-center truncate w-full transition-colors ${
          selected
            ? 'font-extrabold text-indigo-600 dark:text-indigo-400'
            : 'font-medium text-slate-600 dark:text-zinc-400'
        }`}
      >
        {option.name.split(' ')[0]}
      </span>
    </button>
  );
};

/**
 * ============================================================================
 * 5. COMPACT MATERIAL 4 / MATERIAL YOU CONTROLS (SWITCH, SEGMENTED, FILTER CHIP)
 * ============================================================================
 * Inspired by Seal, Read You, Lawnchair 14 & Android 16 Pixel Settings
 */
export const M3Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
}> = ({ checked, onChange, disabled = false, size = 'md', id }) => {
  const isSm = size === 'sm';
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex items-center rounded-full shrink-0 cursor-pointer select-none transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
        isSm ? 'w-9 h-5' : 'w-11 h-6'
      } ${
        checked
          ? 'bg-indigo-600 border-2 border-indigo-600'
          : 'bg-slate-200 dark:bg-zinc-800 border-2 border-slate-400 dark:border-zinc-600'
      } ${disabled ? 'opacity-45 cursor-not-allowed' : ''}`}
    >
      <span
        className={`rounded-full flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
          checked
            ? isSm
              ? 'w-3.5 h-3.5 translate-x-4 bg-white text-indigo-700 shadow-2xs'
              : 'w-4.5 h-4.5 translate-x-5 bg-white text-indigo-700 shadow-2xs'
            : isSm
            ? 'w-2.5 h-2.5 translate-x-0.5 bg-slate-500 dark:bg-zinc-400'
            : 'w-3.5 h-3.5 translate-x-0.5 bg-slate-500 dark:bg-zinc-400'
        }`}
      >
        {checked && <Check className={isSm ? 'w-2.5 h-2.5 stroke-[3.5]' : 'w-3 h-3 stroke-[3.5]'} />}
      </span>
    </button>
  );
};

export interface M3SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export function M3SegmentedGroup<T extends string>({
  options,
  value,
  onChange,
  showCheck = false,
  className = '',
}: {
  options: M3SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  showCheck?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-[2px] p-0.5 rounded-full bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 ${className}`}
    >
      {options.map((opt, idx) => {
        const isActive = value === opt.id;
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;
        const shapeClass = isActive
          ? 'rounded-full'
          : isFirst
          ? 'rounded-l-full rounded-r-[6px]'
          : isLast
          ? 'rounded-r-full rounded-l-[6px]'
          : 'rounded-[6px]';

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`${shapeClass} px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer select-none ${
              isActive
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {isActive && showCheck ? (
              <Check className="w-3 h-3 stroke-[3] shrink-0" />
            ) : (
              opt.icon && <span className="shrink-0">{opt.icon}</span>
            )}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`text-[10px] px-1.2 py-0.1 rounded-full font-mono ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/90 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

