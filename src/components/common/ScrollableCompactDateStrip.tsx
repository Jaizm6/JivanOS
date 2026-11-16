import React, { useRef, useMemo, useEffect, useState, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/date';
import { soundEngine } from '../../utils/audio';
import { useApp } from '../../context/AppContext';
import { isScheduleItemOnDate } from '../../utils/scheduleRecurrence';
import { isHabitScheduledForDate } from '../../utils/habitSchedule';
import { SmoothCollapse } from './PetalExpressive';

interface ScrollableCompactDateStripProps {
  selectedDateStr: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  className?: string;
  showTodayJump?: boolean;
  /** Unique namespace key so each page/subpage retains independent shape, finish & color settings */
  storageKey?: string;
  defaultFinish?: StripFinish;
  defaultShape?: StripShapeId;
  defaultTheme?: string;
  /** Visual surface integration: standalone 'card' (default) or 'embedded' inside an outer workspace card */
  variant?: 'card' | 'embedded';
}

type StripFinish = 'clean' | 'dualtone' | 'tonal' | 'soft' | 'split';

type StripShapeId =
  | 'circle'
  | 'squircle'
  | 'cookie12'
  | 'scallop'
  | 'clover'
  | 'arch'
  | 'hexagon'
  | 'diamond'
  | 'octagon'
  | 'pentagon'
  | 'shield'
  | 'bevel';

interface SophisticatedPalette {
  primary: string;
  secondary: string;
  softBg: string;
  capsuleDeep: string;
  inkOnSoft: string;
  inkOnDeep?: string;
  tint: string;
  shadow: string;
  label: string;
  subtitle: string;
  onPrimary?: string;
}

const PALETTES: Record<string, SophisticatedPalette> = {
  cobalt: {
    primary: '#4338ca',
    secondary: '#312e81',
    softBg: '#e0e7ff',
    capsuleDeep: '#312e81',
    inkOnSoft: '#312e81',
    tint: 'rgba(67, 56, 202, 0.13)',
    shadow: 'rgba(49, 46, 129, 0.32)',
    label: 'Cobalt',
    subtitle: 'Deep Studio Indigo',
  },
  bordeaux: {
    primary: '#9f1239',
    secondary: '#500724',
    softBg: '#ffe4e6',
    capsuleDeep: '#6d0b28',
    inkOnSoft: '#881337',
    tint: 'rgba(159, 18, 57, 0.12)',
    shadow: 'rgba(136, 19, 55, 0.30)',
    label: 'Bordeaux',
    subtitle: 'Crimson Wine',
  },
  sage: {
    primary: '#2d6a4f',
    secondary: '#1b4332',
    softBg: '#dcfce7',
    capsuleDeep: '#1b4332',
    inkOnSoft: '#14532d',
    tint: 'rgba(45, 106, 79, 0.13)',
    shadow: 'rgba(27, 67, 50, 0.30)',
    label: 'Sage',
    subtitle: 'Forest Pine',
  },
  sienna: {
    primary: '#c2410c',
    secondary: '#7c2d12',
    softBg: '#ffedd5',
    capsuleDeep: '#9a3412',
    inkOnSoft: '#7c2d12',
    tint: 'rgba(194, 65, 12, 0.12)',
    shadow: 'rgba(124, 45, 18, 0.30)',
    label: 'Sienna',
    subtitle: 'Burnt Terracotta',
  },
  plum: {
    primary: '#6d28d9',
    secondary: '#3b0764',
    softBg: '#ede9fe',
    capsuleDeep: '#4c1d95',
    inkOnSoft: '#4c1d95',
    tint: 'rgba(109, 40, 217, 0.13)',
    shadow: 'rgba(91, 33, 182, 0.32)',
    label: 'Plum',
    subtitle: 'Velvet Amethyst',
  },
  mineral: {
    primary: '#0f766e',
    secondary: '#134e4a',
    softBg: '#ccfbf1',
    capsuleDeep: '#115e59',
    inkOnSoft: '#134e4a',
    tint: 'rgba(15, 118, 110, 0.13)',
    shadow: 'rgba(19, 78, 74, 0.30)',
    label: 'Mineral',
    subtitle: 'Slate Teal',
  },
  cerulean: {
    primary: '#0284c7',
    secondary: '#075985',
    softBg: '#e0f2fe',
    capsuleDeep: '#075985',
    inkOnSoft: '#0c4a6e',
    tint: 'rgba(2, 132, 199, 0.13)',
    shadow: 'rgba(7, 89, 133, 0.30)',
    label: 'Cerulean',
    subtitle: 'Pacific Azure',
  },
  espresso: {
    primary: '#6d4c41',
    secondary: '#3e2723',
    softBg: '#efebe9',
    capsuleDeep: '#4e342e',
    inkOnSoft: '#3e2723',
    tint: 'rgba(109, 76, 65, 0.13)',
    shadow: 'rgba(62, 39, 35, 0.30)',
    label: 'Espresso',
    subtitle: 'Umber Walnut',
  },
  graphite: {
    primary: '#3f3f46',
    secondary: '#18181b',
    softBg: '#f4f4f5',
    capsuleDeep: '#27272a',
    inkOnSoft: '#18181b',
    tint: 'rgba(63, 63, 70, 0.13)',
    shadow: 'rgba(24, 24, 27, 0.28)',
    label: 'Graphite',
    subtitle: 'Monochrome Ink',
  },
  sky_mist: {
    primary: '#bae6fd',
    secondary: '#7dd3fc',
    softBg: '#f0f9ff',
    capsuleDeep: '#0369a1',
    inkOnSoft: '#0c4a6e',
    tint: 'rgba(56, 189, 248, 0.14)',
    shadow: 'rgba(14, 165, 233, 0.22)',
    label: 'Sky Mist',
    subtitle: 'Light Airy Blue',
    onPrimary: '#0c4a6e',
  },
  blush: {
    primary: '#fecdd3',
    secondary: '#fda4af',
    softBg: '#fff1f2',
    capsuleDeep: '#be123c',
    inkOnSoft: '#881337',
    tint: 'rgba(244, 63, 94, 0.12)',
    shadow: 'rgba(225, 29, 72, 0.20)',
    label: 'Blush',
    subtitle: 'Light Petal Rose',
    onPrimary: '#881337',
  },
  mint_dew: {
    primary: '#bbf7d0',
    secondary: '#86efac',
    softBg: '#f0fdf4',
    capsuleDeep: '#15803d',
    inkOnSoft: '#14532d',
    tint: 'rgba(34, 197, 94, 0.12)',
    shadow: 'rgba(22, 163, 74, 0.20)',
    label: 'Mint Dew',
    subtitle: 'Light Botanical Mint',
    onPrimary: '#14532d',
  },
  lavender: {
    primary: '#ddd6fe',
    secondary: '#c4b5fd',
    softBg: '#f5f3ff',
    capsuleDeep: '#6d28d9',
    inkOnSoft: '#4c1d95',
    tint: 'rgba(139, 92, 246, 0.13)',
    shadow: 'rgba(109, 40, 217, 0.20)',
    label: 'Lavender',
    subtitle: 'Light Soft Lilac',
    onPrimary: '#4c1d95',
  },
  sunlight: {
    primary: '#fde68a',
    secondary: '#fcd34d',
    softBg: '#fefce8',
    capsuleDeep: '#b45309',
    inkOnSoft: '#78350f',
    tint: 'rgba(245, 158, 11, 0.14)',
    shadow: 'rgba(217, 119, 6, 0.22)',
    label: 'Sunlight',
    subtitle: 'Light Cream Gold',
    onPrimary: '#78350f',
  },
  apricot: {
    primary: '#fed7aa',
    secondary: '#fdba74',
    softBg: '#fff7ed',
    capsuleDeep: '#c2410c',
    inkOnSoft: '#7c2d12',
    tint: 'rgba(249, 115, 22, 0.12)',
    shadow: 'rgba(234, 88, 12, 0.20)',
    label: 'Apricot',
    subtitle: 'Light Warm Peach',
    onPrimary: '#7c2d12',
  },
  warm_sand: {
    primary: '#f3e5ab',
    secondary: '#e6ce83',
    softBg: '#fdf8e6',
    capsuleDeep: '#9a7b2c',
    inkOnSoft: '#5c4310',
    tint: 'rgba(217, 179, 86, 0.15)',
    shadow: 'rgba(154, 123, 44, 0.22)',
    label: 'Warm Sand',
    subtitle: 'Sandglass Linen',
    onPrimary: '#5c4310',
  },
  desert_dune: {
    primary: '#f6d8ae',
    secondary: '#eab875',
    softBg: '#fef5e7',
    capsuleDeep: '#a65e1e',
    inkOnSoft: '#633a12',
    tint: 'rgba(234, 184, 117, 0.16)',
    shadow: 'rgba(166, 94, 30, 0.22)',
    label: 'Desert Dune',
    subtitle: 'Sandglass Ochre',
    onPrimary: '#633a12',
  },
  alabaster_honey: {
    primary: '#fae5c8',
    secondary: '#f1c68e',
    softBg: '#fff8ee',
    capsuleDeep: '#b46924',
    inkOnSoft: '#693c11',
    tint: 'rgba(241, 198, 142, 0.15)',
    shadow: 'rgba(180, 105, 36, 0.22)',
    label: 'Alabaster Honey',
    subtitle: 'Sandglass Amber',
    onPrimary: '#693c11',
  },
  terracotta_mist: {
    primary: '#f7d6cc',
    secondary: '#edb3a1',
    softBg: '#fdf2ee',
    capsuleDeep: '#9e4736',
    inkOnSoft: '#6e261a',
    tint: 'rgba(237, 179, 161, 0.15)',
    shadow: 'rgba(158, 71, 54, 0.22)',
    label: 'Terracotta Mist',
    subtitle: 'Sandglass Rose Clay',
    onPrimary: '#6e261a',
  },
  driftwood: {
    primary: '#e6dcd1',
    secondary: '#cfc0ae',
    softBg: '#f7f3ee',
    capsuleDeep: '#6b5b4b',
    inkOnSoft: '#42382e',
    tint: 'rgba(207, 192, 174, 0.18)',
    shadow: 'rgba(107, 91, 75, 0.22)',
    label: 'Driftwood',
    subtitle: 'Sandglass Taupe',
    onPrimary: '#42382e',
  },
  pistachio_sand: {
    primary: '#dce8d5',
    secondary: '#bfd4b4',
    softBg: '#f3f8f0',
    capsuleDeep: '#486b42',
    inkOnSoft: '#264223',
    tint: 'rgba(191, 212, 180, 0.18)',
    shadow: 'rgba(72, 107, 66, 0.22)',
    label: 'Pistachio Sand',
    subtitle: 'Sandglass Sage Earth',
    onPrimary: '#264223',
  },
};

const LEGACY_THEME_MAP: Record<string, string> = {
  indigo: 'cobalt',
  rose: 'bordeaux',
  emerald: 'sage',
  amber: 'sienna',
  terracotta: 'sienna',
  rosewood: 'bordeaux',
  olive: 'sage',
  prussian: 'cobalt',
  violet: 'plum',
  slate: 'graphite',
};

/**
 * Builds smooth rounded SVG polygon paths in 0..100 coordinates for geometric shapes
 */
function buildRoundedPolygonPath(points: [number, number][], cornerRadius: number): string {
  const n = points.length;
  if (n < 3) return '';
  const segments: string[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const v1x = prev[0] - curr[0];
    const v1y = prev[1] - curr[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];

    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const d = Math.min(cornerRadius, len1 * 0.42, len2 * 0.42);

    const ax = curr[0] + (v1x / len1) * d;
    const ay = curr[1] + (v1y / len1) * d;
    const bx = curr[0] + (v2x / len2) * d;
    const by = curr[1] + (v2y / len2) * d;

    if (i === 0) {
      segments.push(`M ${ax.toFixed(2)} ${ay.toFixed(2)}`);
    } else {
      segments.push(`L ${ax.toFixed(2)} ${ay.toFixed(2)}`);
    }
    segments.push(`Q ${curr[0].toFixed(2)} ${curr[1].toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`);
  }

  segments.push('Z');
  return segments.join(' ');
}

function buildRegularPolygonVertices(
  sides: number,
  radius: number = 44,
  rotationDeg: number = -90,
  cx: number = 50,
  cy: number = 50
): [number, number][] {
  const pts: [number, number][] = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const angle = rotRad + (i * 2 * Math.PI) / sides;
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return pts;
}

function buildStripScallopPath(
  lobes: number,
  outerRadius: number,
  innerRadius: number,
  samples: number = 144
): string {
  const pts: string[] = [];
  const midR = (outerRadius + innerRadius) / 2;
  const amp = (outerRadius - innerRadius) / 2;

  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2 - Math.PI / 2;
    const r = midR + amp * Math.cos(lobes * theta);
    const x = 50 + r * Math.cos(theta);
    const y = 50 + r * Math.sin(theta);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  pts.push('Z');
  return pts.join(' ');
}

const STRIP_SHAPE_PATHS: Record<StripShapeId, string> = {
  circle: 'M 50 3 A 47 47 0 1 0 50 97 A 47 47 0 1 0 50 3 Z',
  squircle:
    'M 50 3 C 85 3 97 15 97 50 C 97 85 85 97 50 97 C 15 97 3 85 3 50 C 3 15 15 3 50 3 Z',
  cookie12: buildStripScallopPath(12, 49.5, 44),
  scallop: buildStripScallopPath(8, 49.5, 43),
  clover: buildStripScallopPath(4, 49.5, 42.5),
  arch: 'M 6 48 A 44 44 0 0 1 94 48 L 94 87 Q 94 96 85 96 L 15 96 Q 6 96 6 87 Z',
  hexagon: buildRoundedPolygonPath(buildRegularPolygonVertices(6, 49, -90), 10),
  // Cushioned broad diamond so full-size two-digit numerals sit comfortably clear of diagonal walls
  diamond: buildRoundedPolygonPath(
    [
      [50, 2],
      [98, 50],
      [50, 98],
      [2, 50],
    ],
    24
  ),
  octagon: buildRoundedPolygonPath(buildRegularPolygonVertices(8, 49, -67.5), 7),
  pentagon: buildRoundedPolygonPath(buildRegularPolygonVertices(5, 49.5, -90, 50, 52), 12),
  // Full-shoulder heraldic shield with broad chest cavity so numerals keep full uniform scale
  shield: buildRoundedPolygonPath(
    [
      [10, 5],
      [90, 5],
      [94, 56],
      [50, 96],
      [6, 56],
    ],
    10
  ),
  bevel: buildRoundedPolygonPath(
    [
      [26, 4],
      [74, 4],
      [96, 26],
      [96, 74],
      [74, 96],
      [26, 96],
      [4, 74],
      [4, 26],
    ],
    7
  ),
};

// Optical vertical centering tweaks for asymmetric shapes
const SHAPE_OPTICAL_OFFSET: Record<StripShapeId, string> = {
  circle: '',
  squircle: '',
  cookie12: '',
  scallop: '',
  clover: '',
  arch: 'translate-y-[1.5px] sm:translate-y-[2.5px]',
  hexagon: '',
  diamond: '',
  octagon: '',
  pentagon: 'translate-y-[2px] sm:translate-y-[2.5px]',
  shield: '-translate-y-[1.5px] sm:-translate-y-[2.5px]',
  bevel: '',
};

// Uniform large-scale numeral sizing across all 12 expanded shapes (M3 Expressive legibility)
const SHAPE_NUMERAL_SIZE: Record<StripShapeId, string> = {
  circle: 'text-base sm:text-lg tracking-tight',
  squircle: 'text-base sm:text-lg tracking-tight',
  cookie12: 'text-base sm:text-lg tracking-tight',
  scallop: 'text-base sm:text-lg tracking-tight',
  clover: 'text-base sm:text-lg tracking-tight',
  arch: 'text-base sm:text-lg tracking-tight',
  hexagon: 'text-base sm:text-lg tracking-tight',
  diamond: 'text-base sm:text-lg tracking-tight',
  octagon: 'text-base sm:text-lg tracking-tight',
  pentagon: 'text-base sm:text-lg tracking-tight',
  shield: 'text-base sm:text-lg tracking-tight',
  bevel: 'text-base sm:text-lg tracking-tight',
};

const ALL_SHAPES: { id: StripShapeId; label: string; groupLabel: string; group: 'm3' | 'geo' }[] = [
  { id: 'circle', label: 'Circle', groupLabel: 'Classic', group: 'm3' },
  { id: 'squircle', label: 'Squircle', groupLabel: 'Material 3', group: 'm3' },
  { id: 'cookie12', label: 'Cookie', groupLabel: 'Material 3', group: 'm3' },
  { id: 'scallop', label: 'Flower', groupLabel: 'Material 3', group: 'm3' },
  { id: 'clover', label: 'Clover', groupLabel: 'Material 3', group: 'm3' },
  { id: 'arch', label: 'Arch', groupLabel: 'Material 3', group: 'm3' },
  { id: 'hexagon', label: 'Hexagon', groupLabel: 'Geometric', group: 'geo' },
  { id: 'diamond', label: 'Diamond', groupLabel: 'Geometric', group: 'geo' },
  { id: 'octagon', label: 'Octagon', groupLabel: 'Geometric', group: 'geo' },
  { id: 'pentagon', label: 'Pentagon', groupLabel: 'Geometric', group: 'geo' },
  { id: 'shield', label: 'Shield', groupLabel: 'Geometric', group: 'geo' },
  { id: 'bevel', label: 'Bevel', groupLabel: 'Geometric', group: 'geo' },
];

function getShapePath(shape: StripShapeId): string {
  return STRIP_SHAPE_PATHS[shape] || STRIP_SHAPE_PATHS.circle;
}

const parseDateParts = (dateStr?: string): [number, number, number] | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return [parts[0], parts[1], parts[2]];
};

const getWeekOffsetFromToday = (targetDateStr: string, todayDateStr: string): number => {
  const targetParts = parseDateParts(targetDateStr);
  const todayParts = parseDateParts(todayDateStr);
  if (!targetParts || !todayParts) return 0;

  const targetLocal = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
  const todayLocal = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

  const targetSundayUTC = Date.UTC(
    targetLocal.getFullYear(),
    targetLocal.getMonth(),
    targetLocal.getDate() - targetLocal.getDay()
  );
  const todaySundayUTC = Date.UTC(
    todayLocal.getFullYear(),
    todayLocal.getMonth(),
    todayLocal.getDate() - todayLocal.getDay()
  );

  return Math.round((targetSundayUTC - todaySundayUTC) / (7 * 24 * 60 * 60 * 1000));
};

interface StripPrefs {
  finish: StripFinish;
  shape: StripShapeId;
  theme: string;
}

const getPrefKeys = (storageKey: string) => ({
  finish: `omni_date_strip_finish_${storageKey}`,
  shape: `omni_date_strip_shape_id_${storageKey}`,
  theme: `omni_date_strip_theme_${storageKey}`,
});

const readStripPrefs = (
  storageKey: string,
  defaultFinish: StripFinish,
  defaultShape: StripShapeId,
  defaultTheme: string
): StripPrefs => {
  const keys = getPrefKeys(storageKey);
  const allowLegacyFallback = storageKey === 'default' || storageKey === 'tasks_list';
  const safeDefaultTheme = PALETTES[defaultTheme] ? defaultTheme : 'cobalt';

  let finish: StripFinish = defaultFinish;
  let shape: StripShapeId = defaultShape;
  let theme: string = safeDefaultTheme;

  try {
    const savedFinish =
      localStorage.getItem(keys.finish) ??
      (allowLegacyFallback ? localStorage.getItem('omni_date_strip_shape') : null);
    if (savedFinish === 'dualtone' || savedFinish === 'expressive') finish = 'dualtone';
    else if (savedFinish === 'tonal' || savedFinish === 'soft' || savedFinish === 'split') finish = savedFinish;
    else if (savedFinish === 'clean') finish = 'clean';

    const savedShape = (localStorage.getItem(keys.shape) ??
      (allowLegacyFallback ? localStorage.getItem('omni_date_strip_geo_shape') : null)) as StripShapeId | null;
    if (savedShape && ALL_SHAPES.some(s => s.id === savedShape)) {
      shape = savedShape;
    }

    const savedTheme =
      localStorage.getItem(keys.theme) ??
      (allowLegacyFallback ? localStorage.getItem('omni_date_strip_theme') : null);
    if (savedTheme && PALETTES[savedTheme]) {
      theme = savedTheme;
    } else if (savedTheme && LEGACY_THEME_MAP[savedTheme]) {
      theme = LEGACY_THEME_MAP[savedTheme];
    }
  } catch {}

  return { finish, shape, theme };
};

export const ScrollableCompactDateStrip: React.FC<ScrollableCompactDateStripProps> = ({
  selectedDateStr,
  onSelectDate,
  className = '',
  showTodayJump = true,
  storageKey = 'default',
  defaultFinish = 'clean',
  defaultShape = 'circle',
  defaultTheme = 'cobalt',
  variant = 'card',
}) => {
  const { tasks, scheduleItems, habits } = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  const todayStr = formatLocalDate();

  const [dateOffset, setDateOffset] = useState(() =>
    getWeekOffsetFromToday(selectedDateStr, todayStr)
  );

  // Sync dateOffset to the Sun–Sat week containing selectedDateStr
  useEffect(() => {
    if (selectedDateStr) {
      setDateOffset(getWeekOffsetFromToday(selectedDateStr, todayStr));
    }
  }, [selectedDateStr, todayStr]);

  const [prefs, setPrefs] = useState<StripPrefs>(() =>
    readStripPrefs(storageKey, defaultFinish, defaultShape, defaultTheme)
  );

  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    const parts = parseDateParts(selectedDateStr);
    return parts ? new Date(parts[0], parts[1] - 1, 1) : new Date();
  });
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);

  // Reload independent preferences immediately whenever switching between pages/subpages
  useEffect(() => {
    setPrefs(readStripPrefs(storageKey, defaultFinish, defaultShape, defaultTheme));
    setIsStudioOpen(false);
    setIsCalendarOpen(false);
    setHoveredInfo(null);
  }, [storageKey, defaultFinish, defaultShape, defaultTheme]);

  // Keep calendarViewMonth synced when selectedDateStr changes externally
  useEffect(() => {
    const parts = parseDateParts(selectedDateStr);
    if (parts) {
      setCalendarViewMonth(new Date(parts[0], parts[1] - 1, 1));
    }
  }, [selectedDateStr]);

  const stripFinish = prefs.finish;
  const stripShape = prefs.shape;
  const stripTheme = prefs.theme;

  const setStripFinish = (finish: StripFinish) => {
    setPrefs(prev => ({ ...prev, finish }));
    try {
      const keys = getPrefKeys(storageKey);
      localStorage.setItem(keys.finish, finish);
    } catch {}
  };

  const setStripShape = (shape: StripShapeId) => {
    setPrefs(prev => ({ ...prev, shape }));
    try {
      const keys = getPrefKeys(storageKey);
      localStorage.setItem(keys.shape, shape);
    } catch {}
  };

  const setStripTheme = (theme: string) => {
    setPrefs(prev => ({ ...prev, theme }));
    try {
      const keys = getPrefKeys(storageKey);
      localStorage.setItem(keys.theme, theme);
    } catch {}
  };

  const calendarTriggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 12,
    width: 320,
  });

  const updatePopoverCoords = useCallback(() => {
    if (typeof window === 'undefined' || !calendarTriggerRef.current) return;
    const rect = calendarTriggerRef.current.getBoundingClientRect();
    const width = Math.min(324, Math.max(276, window.innerWidth - 24));
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const left = Math.max(12, Math.min(rect.left, maxLeft));
    // Clamp top so popover stays visible even if trigger is scrolled near top/bottom
    const estimatedHeight = 356;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow >= estimatedHeight || rect.top < estimatedHeight
        ? Math.max(12, rect.bottom + 8)
        : Math.max(12, rect.top - estimatedHeight - 8);
    setPopoverCoords({ top, left, width });
  }, []);

  useEffect(() => {
    if (!isCalendarOpen) return;
    updatePopoverCoords();
    const handleReposition = () => updatePopoverCoords();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCalendarOpen(false);
    };
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarOpen, updatePopoverCoords]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideRoot && !insidePopover) {
        setIsStudioOpen(false);
        setIsCalendarOpen(false);
      }
    };
    if (isStudioOpen || isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStudioOpen, isCalendarOpen]);

  const activePalette = PALETTES[stripTheme] || PALETTES.cobalt;
  const activeShapePath = useMemo(() => getShapePath(stripShape), [stripShape]);
  const activeShapeMeta = useMemo(
    () => ALL_SHAPES.find(s => s.id === stripShape) || ALL_SHAPES[0],
    [stripShape]
  );
  const opticalOffsetClass = SHAPE_OPTICAL_OFFSET[stripShape];
  const numeralSizeClass = SHAPE_NUMERAL_SIZE[stripShape];

  const activeHabits = useMemo(() => habits.filter(h => !h.archived), [habits]);

  const getDateDensity = useCallback(
    (dateStr: string) => {
      const eventCount = scheduleItems.reduce(
        (acc, s) => (isScheduleItemOnDate(s, dateStr) ? acc + 1 : acc),
        0
      );

      let taskCount = 0;
      for (const t of tasks) {
        if (t.completed) continue;
        let matches = false;
        if (t.dueDate === dateStr) matches = true;
        else if (Array.isArray(t.dates) && t.dates.includes(dateStr)) matches = true;
        else if (Array.isArray(t.dateSchedules) && t.dateSchedules.some(ds => ds.date === dateStr)) {
          matches = true;
        } else {
          const rep = t.repeatType && t.repeatType !== 'none' ? t.repeatType : t.recurring;
          if (rep && rep !== 'none' && t.dueDate) {
            matches = isScheduleItemOnDate(
              { date: t.dueDate, repeatType: rep as any, repeatUntil: t.repeatUntil } as any,
              dateStr
            );
          }
        }
        if (matches) taskCount++;
      }

      let habitCount = 0;
      let habitCompletedCount = 0;
      for (const h of activeHabits) {
        const done = Boolean(h.completionHistory?.[dateStr]);
        const scheduled = isHabitScheduledForDate(h, dateStr);
        if (done || scheduled) {
          habitCount++;
          if (done) habitCompletedCount++;
        }
      }

      return { eventCount, taskCount, habitCount, habitCompletedCount };
    },
    [scheduleItems, tasks, activeHabits]
  );

  // Generate 7 days (Sun–Sat) for the active week + real Dots & Lines density indicators
  const weekDays = useMemo(() => {
    const todayParts = parseDateParts(todayStr);
    const todayLocal = todayParts
      ? new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
      : new Date();
    const todaySunday = new Date(
      todayLocal.getFullYear(),
      todayLocal.getMonth(),
      todayLocal.getDate() - todayLocal.getDay()
    );
    const weekSunday = new Date(
      todaySunday.getFullYear(),
      todaySunday.getMonth(),
      todaySunday.getDate() + dateOffset * 7
    );

    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(
        weekSunday.getFullYear(),
        weekSunday.getMonth(),
        weekSunday.getDate() + i
      );
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const density = getDateDensity(dateStr);

      list.push({
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullLabel: d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        dayNumber: d.getDate(),
        isSunday: d.getDay() === 0,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        ...density,
      });
    }
    return list;
  }, [dateOffset, todayStr, selectedDateStr, getDateDensity]);

  // Compute monthly grid cells only when the compact monthly popover is open
  const calendarMonthCells = useMemo(() => {
    if (!isCalendarOpen) return [];
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const cells: {
      dateStr: string;
      dayNum: number;
      inMonth: boolean;
      isSunday: boolean;
      isToday: boolean;
      isSelected: boolean;
      eventCount: number;
      taskCount: number;
      habitCount: number;
      habitCompletedCount: number;
    }[] = [];

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      const cy = d.getFullYear();
      const cm = String(d.getMonth() + 1).padStart(2, '0');
      const cd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${cy}-${cm}-${cd}`;
      const inMonth = d.getMonth() === month;
      const density = inMonth
        ? getDateDensity(dateStr)
        : { eventCount: 0, taskCount: 0, habitCount: 0, habitCompletedCount: 0 };

      cells.push({
        dateStr,
        dayNum: d.getDate(),
        inMonth,
        isSunday: d.getDay() === 0,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        ...density,
      });
    }
    return cells;
  }, [isCalendarOpen, calendarViewMonth, todayStr, selectedDateStr, getDateDensity]);

  const { headerDateLabel, headerWeekday } = useMemo(() => {
    const parts = parseDateParts(selectedDateStr);
    const d = parts ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
    return {
      headerDateLabel: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      headerWeekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  }, [selectedDateStr]);

  const handleSelect = (dateStr: string) => {
    if (dateStr !== selectedDateStr) {
      try {
        soundEngine?.playPill?.();
      } catch {}
      onSelectDate(dateStr);
    }
  };

  const handleJumpToday = () => {
    setDateOffset(0);
    setIsCalendarOpen(false);
    handleSelect(todayStr);
  };

  const isViewingToday = selectedDateStr === todayStr && dateOffset === 0;
  const cleanGradId = `strip-clean-grad-${uid}`;
  const finishLabel =
    stripFinish === 'dualtone'
      ? 'Cutout'
      : stripFinish === 'tonal'
      ? 'Tonal'
      : stripFinish === 'soft'
      ? 'Soft'
      : stripFinish === 'split'
      ? 'Split'
      : 'Minimal';
  const defaultReadout = `${activeShapeMeta.label} (${activeShapeMeta.groupLabel}) · ${activePalette.label} · ${finishLabel}`;

  const renderDotCombination = (item: {
    isToday: boolean;
    eventCount: number;
    taskCount: number;
    habitCount: number;
    habitCompletedCount: number;
  }) => {
    const dots: { key: string; colorClass?: string; customColor?: string; sizeClass: string; title: string }[] = [];

    if (item.isToday) {
      dots.push({
        key: 'today',
        customColor: activePalette.primary,
        sizeClass: 'w-1.5 h-1.5',
        title: 'Today',
      });
    }
    if (item.eventCount > 0) {
      dots.push({
        key: 'ev-1',
        colorClass: 'bg-amber-500',
        sizeClass: 'w-1 h-1',
        title: `${item.eventCount} scheduled block${item.eventCount > 1 ? 's' : ''}`,
      });
    }
    if (item.taskCount > 0) {
      dots.push({
        key: 'tk-1',
        colorClass: 'bg-indigo-500',
        sizeClass: 'w-1 h-1',
        title: `${item.taskCount} task${item.taskCount > 1 ? 's' : ''}`,
      });
    }
    if (item.habitCount > 0) {
      dots.push({
        key: 'hb-1',
        colorClass: 'bg-emerald-500',
        sizeClass: 'w-1 h-1',
        title: `${item.habitCompletedCount}/${item.habitCount} habits`,
      });
    }

    // Add second density dots cleanly up to 5 total marks so cells never overflow
    if (dots.length < 5 && item.eventCount >= 2) {
      dots.push({
        key: 'ev-2',
        colorClass: 'bg-amber-400',
        sizeClass: 'w-1 h-1',
        title: `${item.eventCount} scheduled blocks`,
      });
    }
    if (dots.length < 5 && item.taskCount >= 2) {
      dots.push({
        key: 'tk-2',
        colorClass: 'bg-indigo-400',
        sizeClass: 'w-1 h-1',
        title: `${item.taskCount} tasks`,
      });
    }
    if (dots.length < 5 && item.habitCount >= 2) {
      dots.push({
        key: 'hb-2',
        colorClass: 'bg-emerald-400',
        sizeClass: 'w-1 h-1',
        title: `${item.habitCompletedCount}/${item.habitCount} habits`,
      });
    }

    return (
      <span className="h-1.5 flex items-center justify-center gap-[2.5px]">
        {dots.map(dot => (
          <span
            key={dot.key}
            className={`${dot.sizeClass} rounded-full shrink-0 ${dot.colorClass || ''}`}
            style={dot.customColor ? { backgroundColor: dot.customColor } : undefined}
            title={dot.title}
          />
        ))}
      </span>
    );
  };

  return (
    <div
      ref={rootRef}
      className={
        variant === 'embedded'
          ? `px-1 pt-0.5 pb-1 space-y-2 select-none ${className}`
          : `bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 p-2.5 sm:p-3 shadow-2xs space-y-2 select-none ${className}`
      }
    >
      {/* Hidden SVG gradient definition for Clean mode depth */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id={cleanGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activePalette.primary} />
            <stop offset="100%" stopColor={activePalette.secondary} />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Navigation & Minimal Glance Control */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap">
        {/* Left: Anchored Monthly Calendar Date Jump + Week Stepper */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <button
            ref={calendarTriggerRef}
            type="button"
            onClick={() => {
              setIsCalendarOpen(prev => {
                const next = !prev;
                if (next) {
                  setIsStudioOpen(false);
                  const parts = parseDateParts(selectedDateStr);
                  if (parts) setCalendarViewMonth(new Date(parts[0], parts[1] - 1, 1));
                }
                return next;
              });
            }}
            aria-expanded={isCalendarOpen}
            aria-label="Open monthly calendar picker"
            title="Pick any date from monthly calendar"
            className={`h-8 inline-flex items-center gap-1.5 cursor-pointer group min-w-0 px-2 sm:px-2.5 rounded-xl border transition-all duration-150 ${
              isCalendarOpen
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 shadow-2xs'
                : 'border-slate-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
            }`}
          >
            <CalendarIcon
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
              style={{ color: activePalette.primary }}
            />
            <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-[14px] tracking-tight truncate tabular-nums">
              {headerDateLabel}
            </span>
            <span className="hidden md:inline text-xs font-medium text-slate-400 dark:text-zinc-500 whitespace-nowrap">
              · {headerWeekday}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-transform duration-200 shrink-0 ${
                isCalendarOpen ? 'rotate-180 text-slate-700 dark:text-zinc-200' : ''
              }`}
            />
          </button>

          <div className="h-8 inline-flex items-center rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setDateOffset(prev => prev - 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Previous Week"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.4]" />
            </button>
            <button
              type="button"
              onClick={() => setDateOffset(prev => prev + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Next Week"
              aria-label="Next week"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.4]" />
            </button>
          </div>
        </div>

        {/* Right: Minimal Shape+Color Glance Trigger + Today Jump */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsStudioOpen(prev => {
                const next = !prev;
                if (next) setIsCalendarOpen(false);
                return next;
              });
            }}
            className={`group/trig h-8 px-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              isStudioOpen
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                : 'border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/70'
            }`}
            title={`Style: ${defaultReadout} — Click to customize`}
            aria-expanded={isStudioOpen}
            aria-label="Customize calendar shape and color"
          >
            {/* Active Shape + Dual-Tone Color Emblem */}
            <svg viewBox="-3 -3 106 106" className="w-4 h-4 shrink-0 overflow-visible transition-transform duration-200 group-hover/trig:scale-110">
              <path
                d={activeShapePath}
                fill={activePalette.primary}
                stroke={activePalette.secondary}
                strokeWidth="7"
              />
            </svg>

            {/* Hover / Open Detail Reveal (Desktop sm+ only so mobile date header is never squeezed) */}
            <span
              className={`hidden sm:flex overflow-hidden transition-all duration-200 text-[11.5px] font-semibold items-center gap-1 ${
                isStudioOpen
                  ? 'max-w-[150px] opacity-100'
                  : 'max-w-0 opacity-0 group-hover/trig:max-w-[150px] group-hover/trig:opacity-100'
              }`}
            >
              <span>{activeShapeMeta.label}</span>
              <span className="text-slate-400 dark:text-zinc-500">·</span>
              <span className="text-slate-500 dark:text-zinc-400">{activePalette.label}</span>
            </span>

            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0 ${
                isStudioOpen ? 'rotate-180 text-slate-700 dark:text-zinc-200' : ''
              }`}
            />
          </button>

          {showTodayJump && (
            <button
              type="button"
              onClick={handleJumpToday}
              disabled={isViewingToday}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-semibold transition flex items-center whitespace-nowrap ${
                isViewingToday
                  ? 'bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 cursor-default'
                  : 'shadow-xs hover:opacity-95 active:scale-[0.98] cursor-pointer'
              }`}
              style={
                isViewingToday
                  ? undefined
                  : {
                      background: `linear-gradient(180deg, ${activePalette.primary} 0%, ${activePalette.secondary} 100%)`,
                      color: activePalette.onPrimary || '#ffffff',
                    }
              }
              title={isViewingToday ? 'Viewing Today' : 'Jump to Today'}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Compact Anchored Floating Monthly Calendar Popover (Fixed compact width on all screens; never stretches or shifts layout) */}
      {isCalendarOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Monthly calendar"
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              width: `${popoverCoords.width}px`,
              zIndex: 140,
            }}
            className="rounded-[24px] bg-white dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 shadow-[0_22px_52px_-12px_rgba(15,23,42,0.24)] dark:shadow-[0_22px_52px_-12px_rgba(0,0,0,0.68)] p-3.5 space-y-2.5 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Compact Popover Header: Month Year > + Arrows + Today + Circular Close (x) */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-0.5 min-w-0">
                <select
                  value={calendarViewMonth.getMonth()}
                  onChange={e =>
                    setCalendarViewMonth(
                      prev => new Date(prev.getFullYear(), Number(e.target.value), 1)
                    )
                  }
                  aria-label="Select month"
                  className="bg-transparent text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white cursor-pointer focus:outline-none py-0.5 px-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((mName, idx) => (
                    <option key={mName} value={idx} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
                      {mName}
                    </option>
                  ))}
                </select>

                <select
                  value={calendarViewMonth.getFullYear()}
                  onChange={e =>
                    setCalendarViewMonth(
                      prev => new Date(Number(e.target.value), prev.getMonth(), 1)
                    )
                  }
                  aria-label="Select year"
                  style={{ color: activePalette.primary }}
                  className="bg-transparent text-[15px] font-extrabold tracking-tight cursor-pointer focus:outline-none py-0.5 px-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 tabular-nums"
                >
                  {Array.from({ length: 15 }, (_, idx) => new Date().getFullYear() - 5 + idx).map(yr => (
                    <option key={yr} value={yr} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
                      {yr}
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center ml-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    className="w-6 h-6 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 flex items-center justify-center transition cursor-pointer"
                    aria-label="Previous month"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 stroke-[2.3]" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                    className="w-6 h-6 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 flex items-center justify-center transition cursor-pointer"
                    aria-label="Next month"
                    title="Next month"
                  >
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.3]" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const parts = parseDateParts(todayStr);
                    if (parts) setCalendarViewMonth(new Date(parts[0], parts[1] - 1, 1));
                    handleJumpToday();
                  }}
                  className="px-2 py-1 rounded-full text-[11px] font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-300 flex items-center justify-center transition cursor-pointer"
                  aria-label="Close calendar"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 text-center pt-0.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wk, idx) => (
                <span
                  key={wk}
                  className={`text-[10.5px] font-semibold py-0.5 ${
                    idx === 0 ? 'text-rose-500/85 dark:text-rose-400' : 'text-slate-400 dark:text-zinc-500'
                  }`}
                >
                  {wk}
                </span>
              ))}
            </div>

            {/* Compact 7-Column Date Grid with Shaped Badges + System Dots & Lines */}
            <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
              {calendarMonthCells.map(cell => (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    handleSelect(cell.dateStr);
                    setIsCalendarOpen(false);
                  }}
                  className={`group/cell py-0.5 rounded-xl flex flex-col items-center justify-start transition cursor-pointer ${
                    !cell.inMonth
                      ? 'opacity-30 hover:opacity-70'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-900/70'
                  }`}
                >
                  {/* Compact Fixed-Size Shaped Date Badge (Never Stretches Wide) */}
                  <span className="relative w-8 h-8 flex items-center justify-center">
                    {(cell.isSelected || cell.isToday) && (
                      <svg
                        viewBox="-3 -3 106 106"
                        className="absolute inset-0 w-full h-full overflow-visible"
                      >
                        <path
                          d={activeShapePath}
                          fill={
                            cell.isSelected
                              ? `url(#${cleanGradId})`
                              : activePalette.tint
                          }
                          stroke={activePalette.primary}
                          strokeWidth={cell.isSelected ? 2 : 3.5}
                        />
                      </svg>
                    )}
                    <span
                      className={`relative z-10 text-[13.5px] font-bold tabular-nums tracking-tight leading-none ${opticalOffsetClass} ${
                        cell.isSelected
                          ? ''
                          : cell.isToday
                          ? 'font-extrabold'
                          : cell.isSunday
                          ? 'text-rose-500 dark:text-rose-400'
                          : 'text-slate-800 dark:text-zinc-200'
                      }`}
                      style={
                        cell.isSelected
                          ? { color: activePalette.onPrimary || '#ffffff' }
                          : cell.isToday
                          ? { color: activePalette.onPrimary || activePalette.primary }
                          : undefined
                      }
                    >
                      {cell.dayNum}
                    </span>
                  </span>

                  {/* Consistent Multi-Dot Combination Track Directly Below Badge */}
                  <div className="mt-0.5 h-1.5 flex items-center justify-center">
                    {cell.inMonth && renderDotCombination(cell)}
                  </div>
                </button>
              ))}
            </div>

            {/* Subtle Unboxed Key for Multi-Dot Indicators */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Events</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>Tasks</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Habits</span>
                </span>
              </div>
              <span className="inline-flex items-center gap-1 tabular-nums opacity-80">
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                <span>= 2+</span>
              </span>
            </div>
          </div>,
          document.body
        )}

      {/* Inline Expandable Appearance Studio (Zero bottom-nav clipping, zero text truncation, live hover readout) */}
      <SmoothCollapse isOpen={isStudioOpen}>
        <div
          onMouseLeave={() => setHoveredInfo(null)}
          className="rounded-xl bg-slate-50/90 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/90 px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-2"
        >
          {/* Studio Row 1: Tone Finish Segmented Toggle + 8 Minimal Color Orbs + Hover/Active Detail Readout */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Style Finish Modes: Minimal, Cutout, Tonal, Soft, Split */}
              <div className="inline-flex items-center flex-wrap gap-0.5 p-0.5 rounded-lg bg-slate-200/75 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/70 text-[10.5px] sm:text-[11px]">
                {(
                  [
                    { id: 'clean', label: 'Minimal', desc: 'Minimal · Clean shape badge without outer pill' },
                    { id: 'dualtone', label: 'Cutout', desc: 'Cutout · Rich capsule + crisp white shape' },
                    { id: 'tonal', label: 'Tonal', desc: 'Tonal · Rich capsule + matched tinted shape' },
                    { id: 'soft', label: 'Soft', desc: 'Soft · Pastel capsule + deep inner shape' },
                    { id: 'split', label: 'Split', desc: 'Split · Two-tone split capsule + warm cutout' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => setStripFinish(opt.id)}
                    onMouseEnter={() => setHoveredInfo(opt.desc)}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      stripFinish === opt.id
                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Subtle Vertical Divider */}
              <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-zinc-700" />

              {/* Split-Tone Color Orbs (Shows two-tone pairing dynamically per selected style) */}
              <div className="flex items-center flex-wrap gap-1.5" role="group" aria-label="Color palettes">
                {Object.entries(PALETTES).map(([id, pal]) => {
                  const active = stripTheme === id;
                  const useTonalSwatch = stripFinish === 'tonal' || stripFinish === 'soft' || stripFinish === 'split';
                  const swatchLeft = useTonalSwatch ? pal.capsuleDeep : pal.primary;
                  const swatchRight = useTonalSwatch ? pal.softBg : pal.secondary;
                  const swatchCheckColor = useTonalSwatch
                    ? '#ffffff'
                    : pal.onPrimary || '#ffffff';
                  return (
                    <button
                      key={id}
                      type="button"
                      data-no-press-scale="true"
                      onClick={() => setStripTheme(id)}
                      onMouseEnter={() => setHoveredInfo(`${pal.label} · ${pal.subtitle}`)}
                      aria-label={`${pal.label} — ${pal.subtitle}`}
                      aria-pressed={active}
                      title={`${pal.label} (${pal.subtitle})`}
                      className={`relative w-5 h-5 rounded-full overflow-hidden flex items-center justify-center transition-shadow duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        active
                          ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-zinc-900'
                          : 'ring-1 ring-black/15 dark:ring-white/15 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <span className="w-1/2 h-full" style={{ backgroundColor: swatchLeft }} />
                      <span className="w-1/2 h-full" style={{ backgroundColor: swatchRight }} />
                      {active && (
                        <Check
                          className="w-2.5 h-2.5 stroke-[3] absolute drop-shadow-xs"
                          style={{ color: swatchCheckColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Live Hover Detail Readout + Close */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                {hoveredInfo || defaultReadout}
              </span>
              <button
                type="button"
                onClick={() => setIsStudioOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                aria-label="Close appearance bar"
                title="Done"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Studio Row 2: All 12 Compact Minimal Shape Icons (No clipped edges, clean 2-row grid on mobile, 1 row on desktop) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 pt-1.5 border-t border-slate-200/70 dark:border-zinc-800">
            <div className="grid grid-cols-6 sm:flex sm:items-center gap-1" role="group" aria-label="Classic and Material 3 shapes">
              {ALL_SHAPES.filter(s => s.group === 'm3').map(shape => {
                const active = stripShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => setStripShape(shape.id)}
                    onMouseEnter={() => setHoveredInfo(`${shape.label} · ${shape.groupLabel}`)}
                    aria-label={`${shape.label} (${shape.groupLabel})`}
                    aria-pressed={active}
                    title={`${shape.label} · ${shape.groupLabel}`}
                    className={`w-full sm:w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-zinc-800 shadow-2xs'
                        : 'hover:bg-white/80 dark:hover:bg-zinc-800/70 text-slate-500 dark:text-zinc-400'
                    }`}
                    style={
                      active
                        ? { boxShadow: `inset 0 0 0 1.5px ${activePalette.primary}` }
                        : undefined
                    }
                  >
                    <svg viewBox="-3 -3 106 106" className="w-4 h-4 overflow-visible">
                      <path
                        d={getShapePath(shape.id)}
                        fill={active ? activePalette.primary : 'currentColor'}
                        fillOpacity={active ? 1 : 0.16}
                        stroke={active ? activePalette.secondary : 'currentColor'}
                        strokeWidth="6.5"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-0.5 shrink-0" />

            <div className="grid grid-cols-6 sm:flex sm:items-center gap-1" role="group" aria-label="Geometric shapes">
              {ALL_SHAPES.filter(s => s.group === 'geo').map(shape => {
                const active = stripShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    data-no-press-scale="true"
                    onClick={() => setStripShape(shape.id)}
                    onMouseEnter={() => setHoveredInfo(`${shape.label} · ${shape.groupLabel}`)}
                    aria-label={`${shape.label} (${shape.groupLabel})`}
                    aria-pressed={active}
                    title={`${shape.label} · ${shape.groupLabel}`}
                    className={`w-full sm:w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-zinc-800 shadow-2xs'
                        : 'hover:bg-white/80 dark:hover:bg-zinc-800/70 text-slate-500 dark:text-zinc-400'
                    }`}
                    style={
                      active
                        ? { boxShadow: `inset 0 0 0 1.5px ${activePalette.primary}` }
                        : undefined
                    }
                  >
                    <svg viewBox="-3 -3 106 106" className="w-4 h-4 overflow-visible">
                      <path
                        d={getShapePath(shape.id)}
                        fill={active ? activePalette.primary : 'currentColor'}
                        fillOpacity={active ? 1 : 0.16}
                        stroke={active ? activePalette.secondary : 'currentColor'}
                        strokeWidth="6.5"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SmoothCollapse>

      {/* 7-Day Unified Shape Strip (Supports Minimal, Cutout, Tonal, Soft & Split across all 12 expanded shapes) */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-2 pt-0.5">
        {weekDays.map(day => {
          const isSelected = day.isSelected;
          const isToday = day.isToday;
          const isCapsuleMode = stripFinish !== 'clean';

          const capsuleStyle = (() => {
            if (!isCapsuleMode) return undefined;
            if (isSelected) {
              if (stripFinish === 'soft') {
                return {
                  backgroundColor: activePalette.softBg,
                  boxShadow: `inset 0 0 0 1.5px ${activePalette.capsuleDeep}44, 0 4px 12px -5px ${activePalette.shadow}`,
                };
              }
              if (stripFinish === 'split') {
                return {
                  background: `linear-gradient(180deg, ${activePalette.primary} 0%, ${activePalette.primary} 48%, ${activePalette.capsuleDeep} 48%, ${activePalette.capsuleDeep} 100%)`,
                  boxShadow: `0 6px 14px -5px ${activePalette.shadow}`,
                };
              }
              if (stripFinish === 'tonal') {
                return {
                  background: `linear-gradient(180deg, ${activePalette.capsuleDeep} 0%, ${
                    activePalette.onPrimary ? activePalette.capsuleDeep : activePalette.secondary
                  } 100%)`,
                  boxShadow: `0 6px 14px -5px ${activePalette.shadow}`,
                };
              }
              // Default 'dualtone' (Cutout - preserved crisp approach)
              return {
                background: `linear-gradient(180deg, ${activePalette.primary} 0%, ${activePalette.secondary} 100%)`,
                boxShadow: `0 6px 14px -5px ${activePalette.shadow}`,
              };
            }
            if (isToday) {
              return {
                backgroundColor: activePalette.tint,
                boxShadow: `inset 0 0 0 1.5px ${activePalette.primary}66`,
              };
            }
            return undefined;
          })();

          const weekdayTextColor = (() => {
            if (!isCapsuleMode || !isSelected) return undefined;
            if (stripFinish === 'soft') return activePalette.inkOnSoft;
            if (stripFinish === 'tonal') return activePalette.inkOnDeep || '#ffffff';
            return activePalette.onPrimary || '#ffffff';
          })();

          const shapeFill = (() => {
            if (!isCapsuleMode) {
              return isSelected
                ? `url(#${cleanGradId})`
                : isToday
                ? activePalette.tint
                : undefined;
            }
            if (isSelected) {
              if (stripFinish === 'soft') return activePalette.capsuleDeep;
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.softBg;
              return '#ffffff'; // 'dualtone' Cutout
            }
            if (isToday) {
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.softBg;
              return activePalette.primary;
            }
            return undefined;
          })();

          const shapeStroke = (() => {
            if (!isCapsuleMode) {
              return isSelected
                ? activePalette.secondary
                : isToday
                ? activePalette.primary
                : undefined;
            }
            if (isSelected) {
              if (stripFinish === 'soft') return activePalette.softBg;
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.capsuleDeep;
              return activePalette.onPrimary || activePalette.secondary;
            }
            if (isToday) {
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.capsuleDeep;
              return activePalette.secondary;
            }
            return undefined;
          })();

          const numeralColor = (() => {
            if (!isCapsuleMode) {
              return isSelected ? activePalette.onPrimary || '#ffffff' : undefined;
            }
            if (isSelected) {
              if (stripFinish === 'soft') return activePalette.inkOnDeep || '#ffffff';
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.inkOnSoft;
              return activePalette.onPrimary || activePalette.primary;
            }
            if (isToday) {
              if (stripFinish === 'tonal' || stripFinish === 'split') return activePalette.inkOnSoft;
              return activePalette.onPrimary || '#ffffff';
            }
            return undefined;
          })();

          return (
            <button
              key={day.dateStr}
              type="button"
              data-no-press-scale="true"
              onClick={() => handleSelect(day.dateStr)}
              aria-label={day.fullLabel}
              aria-pressed={isSelected}
              className={`flex flex-col items-center min-w-0 rounded-xl transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isCapsuleMode ? 'py-0.5' : 'py-1 hover:bg-slate-50/90 dark:hover:bg-zinc-900/70'
              }`}
            >
              {/* Inner Column Container (Uses ring instead of border so width never shifts 2px on selection) */}
              <span
                className={`flex flex-col items-center transition-colors duration-150 ${
                  isCapsuleMode
                    ? `w-full max-w-[52px] sm:max-w-[60px] px-0.5 py-1 sm:px-1.5 sm:py-1.5 rounded-[14px] ${
                        isSelected
                          ? 'shadow-sm'
                          : isToday
                          ? ''
                          : 'bg-slate-100/75 dark:bg-zinc-900/75 ring-1 ring-slate-200/70 dark:ring-zinc-800/80 group-hover:bg-slate-100 dark:group-hover:bg-zinc-900'
                      }`
                    : 'w-full'
                }`}
                style={capsuleStyle}
              >
                {/* Weekday Header */}
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold leading-none mb-1 sm:mb-1.5 transition-colors ${
                    isCapsuleMode && isSelected
                      ? 'font-bold'
                      : isSelected || (isCapsuleMode && isToday)
                      ? 'text-slate-900 dark:text-white font-bold'
                      : day.isSunday
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300'
                  }`}
                  style={weekdayTextColor ? { color: weekdayTextColor } : undefined}
                >
                  {day.dayName}
                </span>

                {/* SVG Shape Badge with Generous Mobile Cavity & Crisp Dual-Tone Contrasts */}
                <span
                  className={`relative flex items-center justify-center ${
                    isCapsuleMode
                      ? 'w-[38px] h-[38px] sm:w-11 sm:h-11'
                      : 'w-10 h-10 sm:w-12 sm:h-12'
                  }`}
                >
                  <svg
                    viewBox="-2 -2 104 104"
                    className={`absolute inset-0 w-full h-full overflow-visible transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      !isCapsuleMode && isSelected ? 'scale-[1.05]' : 'group-hover:scale-105'
                    }`}
                    style={
                      isCapsuleMode && isSelected
                        ? { filter: 'drop-shadow(0 2px 5px rgba(15, 23, 42, 0.20))' }
                        : !isCapsuleMode && isSelected
                        ? { filter: `drop-shadow(0 4px 8px ${activePalette.shadow})` }
                        : undefined
                    }
                  >
                    <path
                      d={activeShapePath}
                      fill={shapeFill}
                      stroke={shapeStroke}
                      strokeWidth={
                        isCapsuleMode
                          ? isSelected
                            ? 2.8
                            : isToday
                            ? 3.2
                            : 3
                          : isSelected
                          ? 2.5
                          : isToday
                          ? 3.5
                          : 2.5
                      }
                      className={
                        isSelected || isToday
                          ? ''
                          : isCapsuleMode
                          ? 'fill-white dark:fill-zinc-800 stroke-slate-300/90 dark:stroke-zinc-600 group-hover:stroke-slate-400 dark:group-hover:stroke-zinc-500'
                          : stripShape === 'circle'
                          ? 'fill-transparent stroke-transparent group-hover:fill-slate-100/90 dark:group-hover:fill-zinc-900 group-hover:stroke-slate-200/80 dark:group-hover:stroke-zinc-800'
                          : 'fill-slate-100/80 dark:fill-zinc-900/85 stroke-slate-300/80 dark:stroke-zinc-700/85 group-hover:fill-slate-200/75 dark:group-hover:fill-zinc-800'
                      }
                    />
                  </svg>

                  <span
                    className={`relative z-10 ${numeralSizeClass} font-extrabold tabular-nums leading-none transition-colors ${opticalOffsetClass} ${
                      isSelected || (isCapsuleMode && isToday)
                        ? ''
                        : isToday
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-800 dark:text-zinc-200'
                    }`}
                    style={numeralColor ? { color: numeralColor } : undefined}
                  >
                    {day.dayNumber}
                  </span>
                </span>
              </span>

              {/* Clean Fixed-Height Dot Combination Track */}
              <div className="mt-1">
                {renderDotCombination(day)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
