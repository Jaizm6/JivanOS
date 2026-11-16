import React from 'react';

export type FontSizeOption = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
export type FontTypeOption = 'sans' | 'mono' | 'serif' | 'rounded';

export interface TypographyResult {
  className: string;
  style: React.CSSProperties;
  effectiveFontColor: string;
  isWhite: boolean;
  isBlack: boolean;
}

export const getTypographyStyles = (
  accentColor: string = '#6366f1',
  fontColor?: string,
  fontSize: FontSizeOption = 'base',
  fontType: FontTypeOption = 'sans'
): TypographyResult => {
  const effectiveFontColor = fontColor && fontColor !== 'auto' ? fontColor : accentColor;
  const isWhite = effectiveFontColor?.toLowerCase() === '#ffffff' || effectiveFontColor?.toLowerCase() === '#fff';
  const isBlack = effectiveFontColor?.toLowerCase() === '#000000' || effectiveFontColor?.toLowerCase() === '#000' || effectiveFontColor?.toLowerCase() === '#09090b';

  let fontClass = 'font-sans';
  if (fontType === 'mono') fontClass = 'font-mono';
  else if (fontType === 'serif') fontClass = 'font-serif';
  else if (fontType === 'rounded') fontClass = 'font-sans tracking-tight';

  let sizeClass = 'text-sm sm:text-base';
  if (fontSize === 'xs') sizeClass = 'text-xs';
  else if (fontSize === 'sm') sizeClass = 'text-xs sm:text-sm';
  else if (fontSize === 'base') sizeClass = 'text-sm sm:text-base';
  else if (fontSize === 'lg') sizeClass = 'text-base sm:text-lg';
  else if (fontSize === 'xl') sizeClass = 'text-lg sm:text-xl font-black';

  let style: React.CSSProperties = {};
  if (isWhite) {
    style = {
      color: '#ffffff',
      WebkitTextStroke: '0.65px #0f172a',
      paintOrder: 'stroke fill',
      textShadow: '0 1px 2px rgba(15, 23, 42, 0.75)',
    };
  } else if (isBlack) {
    style = {};
  } else {
    style = { color: effectiveFontColor };
  }

  const className = `${fontClass} ${sizeClass} ${isBlack ? 'text-slate-950 dark:text-zinc-100' : ''}`;

  return {
    className,
    style,
    effectiveFontColor,
    isWhite,
    isBlack,
  };
};
