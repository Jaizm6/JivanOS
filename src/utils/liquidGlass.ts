export interface LiquidGlassConfig {
  preset: 'default' | 'readable' | 'crystal' | 'performance' | 'custom';
  blur: number; // 0.00 to 4.00
  refractionHeight: number; // 0.00 to 3.00
  refractionAmount: number; // 0.00 to 3.00
  tint: number; // 0.00 to 3.00
  vibrancy: number; // 0.00 to 3.00
  brightness: number; // -1.00 to 1.00
  specularHighlight: number; // 0.00 to 2.00
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

export const LIQUID_GLASS_PRESETS: Record<Exclude<LiquidGlassConfig['preset'], 'custom'>, Omit<LiquidGlassConfig, 'preset'>> = {
  default: {
    blur: 1.00,
    refractionHeight: 1.00,
    refractionAmount: 1.00,
    tint: 1.00,
    vibrancy: 1.50,
    brightness: 0.00,
    specularHighlight: 1.00,
    cornerRadius: 1.00,
    depthEffect: false,
    chromaticAberration: false,
  },
  readable: {
    blur: 2.40,
    refractionHeight: 1.00,
    refractionAmount: 0.70,
    tint: 1.80,
    vibrancy: 1.30,
    brightness: 0.00,
    specularHighlight: 1.00,
    cornerRadius: 1.00,
    depthEffect: false,
    chromaticAberration: false,
  },
  crystal: {
    blur: 0.30,
    refractionHeight: 1.50,
    refractionAmount: 1.60,
    tint: 0.60,
    vibrancy: 1.70,
    brightness: 0.00,
    specularHighlight: 1.00,
    cornerRadius: 1.00,
    depthEffect: true,
    chromaticAberration: true,
  },
  performance: {
    blur: 0.00,
    refractionHeight: 0.00,
    refractionAmount: 0.00,
    tint: 1.40,
    vibrancy: 1.50,
    brightness: 0.00,
    specularHighlight: 1.00,
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
  try {
    const saved = localStorage.getItem(STORAGE_GLASS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return { preset: 'default', ...LIQUID_GLASS_PRESETS.default };
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

export function applyLiquidGlassAndMotionToCSS(glass: LiquidGlassConfig, motion: MotionConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Glass CSS variables
  root.style.setProperty('--glass-blur', `${glass.blur * 12}px`);
  root.style.setProperty('--glass-refraction-height', `${glass.refractionHeight}`);
  root.style.setProperty('--glass-refraction-amount', `${glass.refractionAmount}`);
  root.style.setProperty('--glass-tint-opacity', `${glass.tint * 0.15}`);
  root.style.setProperty('--glass-vibrancy-saturate', `${glass.vibrancy * 100}%`);
  root.style.setProperty('--glass-brightness', `${100 + glass.brightness * 25}%`);
  root.style.setProperty('--glass-specular', `${glass.specularHighlight}`);
  root.style.setProperty('--glass-radius', `${glass.cornerRadius * 1}rem`);

  // Motion CSS variables
  root.style.setProperty('--motion-bounce', `${motion.bounce}`);
  root.style.setProperty('--motion-speed', `${motion.speed}`);
  root.style.setProperty('--motion-press-scale', `${Math.max(0.85, 1 - motion.pressDepth * 0.06)}`);
  root.style.setProperty('--motion-jiggle-deg', `${motion.releaseJiggle * 3}deg`);

  try {
    localStorage.setItem(STORAGE_GLASS_KEY, JSON.stringify(glass));
    localStorage.setItem(STORAGE_MOTION_KEY, JSON.stringify(motion));
  } catch {
    // ignore storage errors
  }
}
