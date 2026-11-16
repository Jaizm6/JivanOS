export interface LiquidGlassConfig {
  enabled: boolean; // Master Liquid Glass Chrome toggle (Petal v4.4)
  applyToCards: boolean;
  applyToNav: boolean;
  applyToHeader: boolean;
  preset: 'default' | 'readable' | 'crystal' | 'performance' | 'custom';
  blur: number; // 0.00 to 4.00
  refractionHeight: number; // 0.00 to 3.00
  refractionAmount: number; // 0.00 to 3.00
  tint: number; // 0.00 to 3.00 (Glass Translucency / Alpha)
  vibrancy: number; // 0.00 to 3.00
  brightness: number; // -1.00 to 1.00
  specularHighlight: number; // 0.00 to 2.00 (Specular Rim Sheen)
  cornerRadius: number; // 0.00 to 2.00
  depthEffect: boolean;
  chromaticAberration: boolean;
}

export interface MotionConfig {
  preset: 'normal' | 'performance' | 'bouncy' | 'super_springy' | 'custom';
  bounce: number; // 0.00 to 1.00
  speed: number; // 0.10 to 3.00
  pressDepth: number; // 0.00 to 2.00
  releaseJiggle: number; // 0.00 to 3.00
  dragStretch: number; // 0.00 to 3.00
  longPressBloom: number; // 0.00 to 3.00
}

export const LIQUID_GLASS_PRESETS: Record<
  Exclude<LiquidGlassConfig['preset'], 'custom'>,
  Omit<LiquidGlassConfig, 'preset' | 'enabled' | 'applyToCards' | 'applyToNav' | 'applyToHeader'>
> = {
  default: {
    blur: 1.25,
    refractionHeight: 1.00,
    refractionAmount: 1.00,
    tint: 1.15,
    vibrancy: 1.50,
    brightness: 0.04,
    specularHighlight: 1.10,
    cornerRadius: 1.00,
    depthEffect: true,
    chromaticAberration: false,
  },
  readable: {
    blur: 2.40,
    refractionHeight: 1.00,
    refractionAmount: 0.70,
    tint: 1.85,
    vibrancy: 1.30,
    brightness: 0.00,
    specularHighlight: 0.90,
    cornerRadius: 1.00,
    depthEffect: false,
    chromaticAberration: false,
  },
  crystal: {
    blur: 0.55,
    refractionHeight: 1.50,
    refractionAmount: 1.65,
    tint: 0.65,
    vibrancy: 1.85,
    brightness: 0.08,
    specularHighlight: 1.45,
    cornerRadius: 1.15,
    depthEffect: true,
    chromaticAberration: true,
  },
  performance: {
    blur: 0.00,
    refractionHeight: 0.00,
    refractionAmount: 0.00,
    tint: 1.50,
    vibrancy: 1.20,
    brightness: 0.00,
    specularHighlight: 0.80,
    cornerRadius: 1.00,
    depthEffect: false,
    chromaticAberration: false,
  },
};

export const MOTION_PRESETS: Record<Exclude<MotionConfig['preset'], 'custom'>, Omit<MotionConfig, 'preset'>> = {
  normal: {
    bounce: 0.50,
    speed: 1.00,
    pressDepth: 1.00,
    releaseJiggle: 1.00,
    dragStretch: 1.00,
    longPressBloom: 1.00,
  },
  performance: {
    bounce: 0.20,
    speed: 1.45,
    pressDepth: 0.60,
    releaseJiggle: 0.00,
    dragStretch: 0.50,
    longPressBloom: 0.50,
  },
  bouncy: {
    bounce: 0.75,
    speed: 0.92,
    pressDepth: 1.30,
    releaseJiggle: 1.60,
    dragStretch: 1.20,
    longPressBloom: 1.20,
  },
  super_springy: {
    bounce: 0.95,
    speed: 0.82,
    pressDepth: 1.60,
    releaseJiggle: 2.20,
    dragStretch: 1.50,
    longPressBloom: 1.50,
  },
};

const STORAGE_GLASS_KEY = 'jivan_liquid_glass_config_v1';
const STORAGE_MOTION_KEY = 'jivan_motion_config_v1';

export function getInitialLiquidGlassConfig(): LiquidGlassConfig {
  return {
    enabled: false,
    applyToCards: false,
    applyToNav: false,
    applyToHeader: false,
    preset: 'performance',
    ...LIQUID_GLASS_PRESETS.performance,
  };
}

export function getInitialMotionConfig(): MotionConfig {
  try {
    const saved = localStorage.getItem(STORAGE_MOTION_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return { preset: 'normal', ...MOTION_PRESETS.normal };
}

export function applyLiquidGlassAndMotionToCSS(_glass: LiquidGlassConfig, motion: MotionConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Permanently disable heavy glass/backdrop-blur attributes
  root.classList.remove('theme-glass');
  root.removeAttribute('data-liquid-glass');
  root.removeAttribute('data-glass-cards');
  root.removeAttribute('data-glass-nav');
  root.removeAttribute('data-glass-header');
  root.style.removeProperty('--glass-blur');

  // Lightweight 60/120fps compositor motion CSS variables
  root.style.setProperty('--motion-bounce', `${motion.bounce}`);
  root.style.setProperty('--motion-speed', `${motion.speed}`);
  root.style.setProperty('--motion-press-scale', `${Math.max(0.88, 1 - motion.pressDepth * 0.04)}`);
  root.style.setProperty('--motion-jiggle-deg', `${motion.releaseJiggle * 3}deg`);

  try {
    localStorage.removeItem(STORAGE_GLASS_KEY);
    localStorage.setItem(STORAGE_MOTION_KEY, JSON.stringify(motion));
  } catch {
    // ignore storage errors
  }
}
