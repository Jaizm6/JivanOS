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

export function getFontSizeClass(size?: ActivityFontSize): string {
  if (!size) return 'text-[13.8px] sm:text-[14.8px]';
  const px = getFontSizePx(size);
  if (px <= 11) return 'text-[11.8px] sm:text-[12.8px]';
  if (px <= 13) return 'text-[13.8px] sm:text-[14.8px]';
  if (px <= 15) return 'text-[14.8px] sm:text-[16.8px]';
  if (px <= 17) return 'text-[16.8px] sm:text-[17.8px]';
  return 'text-[16.8px] sm:text-[18.8px]';
}

export function getFontSizeStyle(size?: ActivityFontSize): React.CSSProperties {
  if (!size) return { fontSize: '13.8px' };
  const px = getFontSizePx(size);
  return { fontSize: `${(px + 0.8).toFixed(1)}px` };
}

export function getFontTypeClass(type?: ActivityFontType): string {
  switch (type) {
    case 'mono':
      return 'font-mono';
    case 'serif':
      return 'font-serif';
    case 'rounded':
      return 'font-sans tracking-wide';
    case 'sans':
    default:
      return 'font-sans';
  }
}

export function getFontInlineStyle(options: TypographyOptions): React.CSSProperties {
  const { fontColor, isBold, fallbackColor } = options;
  const style: React.CSSProperties = {};

  if (isBold !== undefined) {
    style.fontWeight = isBold ? '700' : '500';
  }

  const resolvedColor = fontColor && fontColor.trim() !== '' ? fontColor : fallbackColor;
  if (resolvedColor && resolvedColor.trim() !== '') {
    style.color = resolvedColor;
    style.WebkitTextFillColor = resolvedColor;
  }

  return style;
}

export function getCardThemeStyles(accentColor?: string, _cardTheme?: string) {
  const color = accentColor || '#10b981';
  const isWhite = isWhiteColor(color);
  const isBlack = isBlackColor(color);

  // Border theme: crisp solid accent border framing as standard default
  const boldBorderColor = isWhite ? '#94a3b8' : isBlack ? '#64748b' : `${color}a0`;
  const accentLeftColor = isWhite ? '#cbd5e1' : isBlack ? '#94a3b8' : color;

  const borderLeftColor = accentLeftColor;
  const borderTopColor = boldBorderColor;
  const borderRightColor = boldBorderColor;
  const borderBottomColor = boldBorderColor;

  const borderLeftWidth = '4px';
  const borderTopWidth = '1.5px';
  const borderRightWidth = '1.5px';
  const borderBottomWidth = '1.5px';

  const background = 'transparent';
  const isTintedBg = false;

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
    background,
    isTintedBg,
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
