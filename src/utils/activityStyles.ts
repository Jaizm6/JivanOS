import React from 'react';

export type ActivityFontSize = number | string;
export type ActivityFontType = 'sans' | 'serif' | 'mono' | 'rounded';

export interface TypographyOptions {
  fontColor?: string;
  accentColor?: string;
  isBold?: boolean;
  fallbackColor?: string;
  isDone?: boolean;
  fontSize?: ActivityFontSize;
  fontType?: ActivityFontType;
}

export const COLOR_PALETTE = [
  { hex: '#000000', label: 'Pitch Black' },
  { hex: '#ffffff', label: 'Pure White' },
  { hex: '#10b981', label: 'Emerald Mint' },
  { hex: '#06b6d4', label: 'Cyan Water' },
  { hex: '#3b82f6', label: 'Indigo Blue' },
  { hex: '#6366f1', label: 'Classic Indigo' },
  { hex: '#8b5cf6', label: 'Purple Lavender' },
  { hex: '#ec4899', label: 'Vibrant Pink' },
  { hex: '#ef4444', label: 'Coral Rose' },
  { hex: '#f59e0b', label: 'Amber Gold' },
  { hex: '#14b8a6', label: 'Teal' },
];

export const CARD_THEMES = [
  { value: 'clean', label: 'Border', sample: 'Clean card backdrop with solid accent border framing' },
] as const;

export const FONT_TYPES: { value: 'sans' | 'serif'; label: string; sample: string; className: string }[] = [
  { value: 'sans', label: 'Sans', sample: 'Modern Sans', className: 'font-sans' },
  { value: 'serif', label: 'Serif', sample: 'Editorial Serif', className: 'font-serif' },
];

export function isWhiteColor(c?: string): boolean {
  if (!c) return false;
  const l = c.toLowerCase().trim();
  return l === '#ffffff' || l === '#fff' || l === 'white' || l === 'rgb(255,255,255)';
}

export function isBlackColor(c?: string): boolean {
  if (!c) return false;
  const l = c.toLowerCase().trim();
  return l === '#000000' || l === '#000' || l === '#09090b' || l === '#0f172a' || l === 'black';
}

/**
 * Resolves a safe font color for the current theme:
 * Text color should not be dark in dark mode and not white in light mode.
 */
export function getSafeFontColor(fontColor?: string, isDarkMode: boolean = false): string | undefined {
  if (!fontColor || fontColor.trim() === '') return undefined;
  if (isDarkMode && isBlackColor(fontColor)) return undefined;
  if (!isDarkMode && isWhiteColor(fontColor)) return undefined;
  return fontColor;
}

/**
 * Returns available font colors:
 * In dark mode: includes White (#ffffff), excludes dark/black colors.
 * In light mode: includes Black (#09090b), excludes white colors.
 */
export function getAvailableFontColors(isDarkMode: boolean) {
  return [
    isDarkMode ? { hex: '#ffffff', label: 'White' } : { hex: '#09090b', label: 'Black' },
    { hex: '#10b981', label: 'Emerald' },
    { hex: '#3b82f6', label: 'Blue' },
    { hex: '#8b5cf6', label: 'Purple' },
    { hex: '#ec4899', label: 'Pink' },
    { hex: '#f43f5e', label: 'Rose' },
    { hex: '#f59e0b', label: 'Amber' },
    { hex: '#06b6d4', label: 'Cyan' },
  ];
}

/**
 * Returns available accent theme colors:
 * In dark mode: includes White (#ffffff), excludes dark/black colors.
 * In light mode: includes Black (#09090b), excludes white colors.
 */
export function getAvailableAccentColors(isDarkMode: boolean) {
  return [
    ...(isDarkMode ? ['#ffffff'] : ['#09090b']),
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f59e0b',
    '#06b6d4',
    '#6366f1',
    '#14b8a6',
  ];
}

export function getFontSizePx(size?: ActivityFontSize): number {
  if (typeof size === 'number') {
    return Math.min(20, Math.max(10, size));
  }
  if (!size) return 14;
  const parsed = parseInt(String(size), 10);
  if (!isNaN(parsed) && parsed > 0) {
    return Math.min(20, Math.max(10, parsed));
  }
  switch (size) {
    case 'xs': return 12;
    case 'sm': return 13;
    case 'base': return 15;
    case 'lg': return 18;
    case 'xl': return 21;
    default: return 15;
  }
}

export function getFontSizeClass(_size?: ActivityFontSize): string {
  return 'text-[13.5px] sm:text-[14px]';
}

export function getFontSizeStyle(_size?: ActivityFontSize): React.CSSProperties {
  return { fontSize: '13.8px' };
}

export function getFontTypeClass(_type?: ActivityFontType): string {
  return 'font-sans';
}

export function getFontInlineStyle(_options: TypographyOptions, _isDarkMode?: boolean): React.CSSProperties {
  return {};
}

export type VisualPaletteMode = 'colorful' | 'mono_accent';

const PALETTE_STORAGE_KEY = 'omni_visual_palette_mode';

export function getVisualPaletteMode(): VisualPaletteMode {
  if (typeof window === 'undefined') return 'colorful';
  try {
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (saved === 'colorful' || saved === 'mono_accent') {
      return saved;
    }
  } catch {}
  return 'colorful';
}

export function setVisualPaletteMode(mode: VisualPaletteMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, mode);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-visual-palette', mode);
      document.body?.setAttribute('data-visual-palette', mode);
      if (document.documentElement.getAttribute('data-color-style') === 'monochrome') {
        document.documentElement.setAttribute('data-color-style', 'tonal_spot');
      }
    }
    window.dispatchEvent(new CustomEvent('omni-palette-change', { detail: mode }));
  } catch {}
}

export function getCardThemeStyles(accentColor?: string, _cardTheme?: string, paletteOverride?: VisualPaletteMode) {
  const mode = paletteOverride || getVisualPaletteMode();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const color = accentColor || '#10b981';
  const isWhite = isWhiteColor(color);
  const isBlack = isBlackColor(color);

  if (mode === 'mono_accent') {
    // Clean monochrome card surface with subtle border, but vibrant multicolor left accent & icon box!
    const neutralBorder = isDark ? '#27272a' : '#e2e8f0';
    const accentLeftColor = isWhite ? '#cbd5e1' : isBlack ? '#94a3b8' : color;
    return {
      accentColor: color,
      cardTheme: 'clean' as const,
      borderLeftColor: accentLeftColor,
      borderLeftWidth: '3.5px',
      borderTopColor: neutralBorder,
      borderRightColor: neutralBorder,
      borderBottomColor: neutralBorder,
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      background: 'transparent',
      isTintedBg: false,
      cardStyle: {
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '3.5px',
        borderTopColor: neutralBorder,
        borderRightColor: neutralBorder,
        borderBottomColor: neutralBorder,
        borderLeftColor: accentLeftColor,
        borderStyle: 'solid',
        background: undefined,
      } as React.CSSProperties,
      iconBox: {
        backgroundColor: isWhite ? '#0f172a' : isBlack ? undefined : `${color}18`,
        borderColor: isWhite ? '#334155' : isBlack ? undefined : `${color}45`,
        color: isWhite ? '#ffffff' : isBlack ? undefined : color,
      },
      buttonDone: {
        backgroundColor: color,
        color: isWhite ? '#0f172a' : '#ffffff',
      },
    };
  }

  // Default 'colorful' mode: crisp solid accent border framing
  const boldBorderColor = isWhite ? '#94a3b8' : isBlack ? '#64748b' : `${color}85`;
  const accentLeftColor = isWhite ? '#cbd5e1' : isBlack ? '#94a3b8' : color;

  const borderLeftColor = accentLeftColor;
  const borderTopColor = boldBorderColor;
  const borderRightColor = boldBorderColor;
  const borderBottomColor = boldBorderColor;

  const borderLeftWidth = '4px';
  const borderTopWidth = '1.25px';
  const borderRightWidth = '1.25px';
  const borderBottomWidth = '1.25px';

  const cardStyle: React.CSSProperties = {
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    borderLeftWidth,
    borderTopColor,
    borderRightColor,
    borderBottomColor,
    borderLeftColor,
    borderStyle: 'solid',
    background: undefined,
  };

  return {
    accentColor: color,
    cardTheme: 'clean' as const,
    borderLeftColor,
    borderLeftWidth,
    borderTopColor,
    borderRightColor,
    borderBottomColor,
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    background: 'transparent',
    isTintedBg: false,
    cardStyle,
    iconBox: {
      backgroundColor: isWhite ? '#0f172a' : isBlack ? undefined : `${color}18`,
      borderColor: isWhite ? '#334155' : isBlack ? undefined : `${color}50`,
      color: isWhite ? '#ffffff' : isBlack ? undefined : color,
    },
    buttonDone: {
      backgroundColor: color,
      color: isWhite ? '#0f172a' : '#ffffff',
    },
  };
}

