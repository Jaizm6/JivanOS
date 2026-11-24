export interface QuotePaletteEntry {
  key: string;
  label: string;
  bg: string;
  ink: string;
  metaInk: string;
  bgDark: string;
  inkDark: string;
  metaInkDark: string;
  hasBorder?: boolean;
}

export const QUOTE_PALETTES: Record<string, QuotePaletteEntry> = {
  white: {
    key: 'white',
    label: 'White',
    bg: '#FFFFFF',
    ink: '#1F1E24',
    metaInk: '#49454F',
    bgDark: '#1E2028',
    inkDark: '#F3F4F6',
    metaInkDark: '#C4C7D4',
    hasBorder: true,
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    bg: '#FAD6D6',
    ink: '#7D1E2C',
    metaInk: '#542A30',
    bgDark: '#3A1D22',
    inkDark: '#FFB8C0',
    metaInkDark: '#EBC6CB',
  },
  mint: {
    key: 'mint',
    label: 'Mint',
    bg: '#CAEAC7',
    ink: '#185A2B',
    metaInk: '#25472E',
    bgDark: '#1B3424',
    inkDark: '#A6E8B3',
    metaInkDark: '#C5E6CB',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    bg: '#F9DCA4',
    ink: '#6B4400',
    metaInk: '#4F3914',
    bgDark: '#382B11',
    inkDark: '#FFD98E',
    metaInkDark: '#EBD9B5',
  },
  sky: {
    key: 'sky',
    label: 'Sky',
    bg: '#CDE2FB',
    ink: '#164682',
    metaInk: '#243C5A',
    bgDark: '#1A2C45',
    inkDark: '#A8CEFF',
    metaInkDark: '#C6DAF4',
  },
  lavender: {
    key: 'lavender',
    label: 'Lavender',
    bg: '#DFD8FC',
    ink: '#38268C',
    metaInk: '#382E61',
    bgDark: '#262145',
    inkDark: '#CEC4FF',
    metaInkDark: '#D8D2F2',
  },
  orchid: {
    key: 'orchid',
    label: 'Orchid',
    bg: '#EED4F6',
    ink: '#5E1E78',
    metaInk: '#4B2A59',
    bgDark: '#361F40',
    inkDark: '#EBBDFC',
    metaInkDark: '#E4C9EE',
  },
  peach: {
    key: 'peach',
    label: 'Peach',
    bg: '#FCDCC6',
    ink: '#783309',
    metaInk: '#57331E',
    bgDark: '#3B251B',
    inkDark: '#FFC5A1',
    metaInkDark: '#ECD0BF',
  },
  teal: {
    key: 'teal',
    label: 'Teal',
    bg: '#C0ECE7',
    ink: '#09524B',
    metaInk: '#1F4743',
    bgDark: '#153634',
    inkDark: '#9BE8E0',
    metaInkDark: '#BEE6E2',
  },
  lime: {
    key: 'lime',
    label: 'Lime',
    bg: '#DCF0B2',
    ink: '#3A4F04',
    metaInk: '#364517',
    bgDark: '#293414',
    inkDark: '#D0ED8C',
    metaInkDark: '#D5E6B3',
  },
  sand: {
    key: 'sand',
    label: 'Sand',
    bg: '#EFE1C9',
    ink: '#594218',
    metaInk: '#4A3C24',
    bgDark: '#332B1E',
    inkDark: '#ECD5AE',
    metaInkDark: '#DFD2BC',
  },
  coral: {
    key: 'coral',
    label: 'Coral',
    bg: '#FFD2C4',
    ink: '#80250B',
    metaInk: '#5C2C1E',
    bgDark: '#3D221C',
    inkDark: '#FFBAA6',
    metaInkDark: '#ECCBC2',
  },
  pink: {
    key: 'pink',
    label: 'Pink',
    bg: '#FAD2E6',
    ink: '#7A184A',
    metaInk: '#572840',
    bgDark: '#3B1E2E',
    inkDark: '#FFB8DA',
    metaInkDark: '#ECC7D9',
  },
  cyan: {
    key: 'cyan',
    label: 'Cyan',
    bg: '#C3ECF8',
    ink: '#0B5063',
    metaInk: '#1F444F',
    bgDark: '#16333F',
    inkDark: '#9FE4FA',
    metaInkDark: '#C2E3EE',
  },
  indigo: {
    key: 'indigo',
    label: 'Indigo',
    bg: '#D6DCFF',
    ink: '#242F94',
    metaInk: '#2D3466',
    bgDark: '#20254D',
    inkDark: '#BFC8FF',
    metaInkDark: '#CFD5F5',
  },
  slate: {
    key: 'slate',
    label: 'Slate',
    bg: '#DCE2EC',
    ink: '#263447',
    metaInk: '#364152',
    bgDark: '#252C38',
    inkDark: '#CCD6E6',
    metaInkDark: '#CBD2DE',
  },
  gold: {
    key: 'gold',
    label: 'Gold',
    bg: '#F7E7AB',
    ink: '#5E4B00',
    metaInk: '#4A3F16',
    bgDark: '#363012',
    inkDark: '#FAE284',
    metaInkDark: '#E6DCBA',
  },
  sage: {
    key: 'sage',
    label: 'Sage',
    bg: '#D3E6D0',
    ink: '#244A29',
    metaInk: '#2E4531',
    bgDark: '#213324',
    inkDark: '#BCE3B8',
    metaInkDark: '#CBE0C9',
  },
};

export const QUOTE_PALETTE_ORDER: string[] = [
  'white',
  'rose',
  'mint',
  'amber',
  'sky',
  'lavender',
  'orchid',
  'peach',
  'teal',
  'lime',
  'sand',
  'coral',
  'pink',
  'cyan',
  'indigo',
  'slate',
  'gold',
  'sage',
];

export const PALETTE_KEYS_FOR_PICKER: string[] = [...QUOTE_PALETTE_ORDER];

export const EXTRA_PALETTE_KEYS: string[] = [
  'teal',
  'lime',
  'sand',
  'coral',
  'pink',
  'cyan',
  'indigo',
  'slate',
  'gold',
  'sage',
];

export const PALETTE_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  QUOTE_PALETTE_ORDER.map(k => [k, QUOTE_PALETTES[k].label])
);

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  discipline: 'rose',
  health: 'mint',
  wisdom: 'amber',
  focus: 'sky',
  mindset: 'lavender',
  stoicism: 'orchid',
  habits: 'peach',
};

export function getPaletteByKey(key: string): QuotePaletteEntry {
  const normalized = (key || '').toLowerCase().trim();
  return QUOTE_PALETTES[normalized] || QUOTE_PALETTES.white;
}

export function getQuotePalette(category: string): QuotePaletteEntry {
  const normalized = (category || '').toLowerCase().trim();
  const colorKey = DEFAULT_CATEGORY_COLORS[normalized];
  return colorKey ? getPaletteByKey(colorKey) : QUOTE_PALETTES.white;
}
