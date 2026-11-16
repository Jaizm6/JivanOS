export interface ColorThemePreset {
  id: string;
  name: string;
  lightBg: string;
  darkBg: string;
  borderColor: string;
  darkBorderColor: string;
  swatch: string;
  accentColor: string;
}

export class ColorThemeService {
  private static presets: ColorThemePreset[] = [
    {
      id: 'default',
      name: 'Pure White',
      lightBg: '#ffffff',
      darkBg: '#121319',
      borderColor: '#cbd5e1',
      darkBorderColor: '#2e313f',
      swatch: '#ffffff',
      accentColor: '#4f46e5',
    },
    {
      id: 'warm',
      name: 'Warm Sand',
      lightBg: '#fdf6e7',
      darkBg: '#1d170e',
      borderColor: '#e4c78d',
      darkBorderColor: '#5c4319',
      swatch: '#f6dfae',
      accentColor: '#b45309',
    },
    {
      id: 'mint',
      name: 'Sage Mint',
      lightBg: '#eaf8f1',
      darkBg: '#0d1d17',
      borderColor: '#98dec0',
      darkBorderColor: '#1d543e',
      swatch: '#c2f0da',
      accentColor: '#059669',
    },
    {
      id: 'ocean',
      name: 'Sky Breeze',
      lightBg: '#e8f4fd',
      darkBg: '#0e1a26',
      borderColor: '#9cd1f7',
      darkBorderColor: '#1d4d73',
      swatch: '#c4e6fc',
      accentColor: '#0284c7',
    },
    {
      id: 'indigo',
      name: 'Periwinkle',
      lightBg: '#eef0ff',
      darkBg: '#131528',
      borderColor: '#b4bbfd',
      darkBorderColor: '#373b78',
      swatch: '#d5dafd',
      accentColor: '#4f46e5',
    },
    {
      id: 'dreamy-pastel',
      name: 'Soft Lilac',
      lightBg: '#f6ecfc',
      darkBg: '#1b1224',
      borderColor: '#d7b4f4',
      darkBorderColor: '#502d73',
      swatch: '#e8d0fa',
      accentColor: '#9333ea',
    },
    {
      id: 'rose',
      name: 'Rose Quartz',
      lightBg: '#fdecef',
      darkBg: '#201116',
      borderColor: '#f4b5c2',
      darkBorderColor: '#692638',
      swatch: '#fbd0d9',
      accentColor: '#be123c',
    },
    {
      id: 'slate',
      name: 'Cool Mist',
      lightBg: '#e9eff6',
      darkBg: '#141922',
      borderColor: '#b6c5d8',
      darkBorderColor: '#36455a',
      swatch: '#d3deec',
      accentColor: '#334155',
    },
  ];

  static getPresets(): ColorThemePreset[] {
    return this.presets;
  }

  static getPreset(id: string): ColorThemePreset | undefined {
    return this.presets.find(p => p.id === id);
  }

  static resolveColor(presetIdOrColor: string, isDark: boolean): string {
    if (!presetIdOrColor || presetIdOrColor === 'default') {
      return isDark ? '#121319' : '#ffffff';
    }
    const preset = this.presets.find(p => p.id === presetIdOrColor);
    if (preset) {
      return isDark ? preset.darkBg : preset.lightBg;
    }
    return presetIdOrColor;
  }

  static resolveBorderColor(presetIdOrColor: string, isDark: boolean): string {
    if (!presetIdOrColor || presetIdOrColor === 'default') {
      return isDark ? '#2e313f' : '#cbd5e1';
    }
    const preset = this.presets.find(p => p.id === presetIdOrColor);
    if (preset) {
      return isDark ? preset.darkBorderColor : preset.borderColor;
    }
    return isDark ? '#2e313f' : '#cbd5e1';
  }

  static resolveAccentColor(presetIdOrColor: string): string {
    const preset = this.presets.find(p => p.id === presetIdOrColor);
    return preset?.accentColor || '#4f46e5';
  }

  static resolveCardBackground(presetIdOrColor: string, isDark: boolean): string {
    return this.resolveColor(presetIdOrColor, isDark);
  }

  static applyTheme(presetIdOrColor: string, isDark: boolean) {
    const color = this.resolveColor(presetIdOrColor, isDark);
    const border = this.resolveBorderColor(presetIdOrColor, isDark);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--quote-card-bg', color);
      document.documentElement.style.setProperty('--quote-card-border', border);
    }
    return color;
  }
}
