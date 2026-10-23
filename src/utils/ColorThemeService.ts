export interface ColorThemePreset {
  id: string;
  name: string;
  lightBg: string;
  darkBg: string;
  borderColor: string;
  darkBorderColor: string;
  swatch: string;
}

export class ColorThemeService {
  private static presets: ColorThemePreset[] = [
    { 
      id: 'default', 
      name: 'Default White', 
      lightBg: '#ffffff', 
      darkBg: '#0f172a', 
      borderColor: '#e2e8f0',
      darkBorderColor: '#334155',
      swatch: '#ffffff' 
    },
    { 
      id: 'warm', 
      name: 'Warm Amber', 
      lightBg: '#fef3c7', 
      darkBg: '#38230f', 
      borderColor: '#fde047',
      darkBorderColor: '#d97706',
      swatch: '#fde68a' 
    },
    { 
      id: 'mint', 
      name: 'Soft Mint', 
      lightBg: '#d1fae5', 
      darkBg: '#064e3b', 
      borderColor: '#86efac',
      darkBorderColor: '#059669',
      swatch: '#a7f3d0' 
    },
    { 
      id: 'rose', 
      name: 'Delicate Rose', 
      lightBg: '#ffe4e6', 
      darkBg: '#4c0519', 
      borderColor: '#fca5a5',
      darkBorderColor: '#e11d48',
      swatch: '#fecdd3' 
    },
    { 
      id: 'indigo', 
      name: 'Soft Lavender', 
      lightBg: '#ede9fe', 
      darkBg: '#2e1065', 
      borderColor: '#c4b5fd',
      darkBorderColor: '#7c3aed',
      swatch: '#c7d2fe' 
    },
    { 
      id: 'slate', 
      name: 'Cool Slate', 
      lightBg: '#f1f5f9', 
      darkBg: '#1e293b', 
      borderColor: '#cbd5e1',
      darkBorderColor: '#475569',
      swatch: '#cbd5e1' 
    },
    { 
      id: 'dreamy-pastel', 
      name: 'Dreamy Pastel', 
      lightBg: '#FEF7F7', 
      darkBg: '#2a2424', 
      borderColor: '#FCE8E8',
      darkBorderColor: '#554949',
      swatch: '#E3DCE8' 
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
      return isDark ? '#0f172a' : '#ffffff';
    }
    const preset = this.presets.find(p => p.id === presetIdOrColor);
    if (preset) {
      return isDark ? preset.darkBg : preset.lightBg;
    }
    // If it's already a color code or custom value
    return presetIdOrColor;
  }

  static resolveBorderColor(presetIdOrColor: string, isDark: boolean): string {
    if (!presetIdOrColor || presetIdOrColor === 'default') {
      return isDark ? '#334155' : '#e2e8f0';
    }
    const preset = this.presets.find(p => p.id === presetIdOrColor);
    if (preset) {
      return isDark ? preset.darkBorderColor : preset.borderColor;
    }
    return isDark ? '#334155' : '#e2e8f0';
  }

  static resolveCardBackground(presetIdOrColor: string, isDark: boolean): string {
    return this.resolveColor(presetIdOrColor, isDark);
  }

  static applyTheme(presetIdOrColor: string, isDark: boolean) {
    const color = this.resolveColor(presetIdOrColor, isDark);
    const border = this.resolveBorderColor(presetIdOrColor, isDark);
    if (typeof document !== 'undefined') {
      if (presetIdOrColor && presetIdOrColor !== 'default') {
        document.documentElement.style.setProperty('--quote-card-bg', color);
        document.documentElement.style.setProperty('--quote-card-border', border);
      } else {
        document.documentElement.style.removeProperty('--quote-card-bg');
        document.documentElement.style.removeProperty('--quote-card-border');
      }
    }
    return color;
  }
}
