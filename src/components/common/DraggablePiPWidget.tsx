import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { useApp } from '../../context/AppContext';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  GripHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  Settings,
  ExternalLink,
} from 'lucide-react';

type PiPMode = 'extended' | 'compact' | 'mini';

type PiPTheme =
  | 'dark'
  | 'github_dark'
  | 'dracula'
  | 'catppuccin_mocha'
  | 'tokyo_night'
  | 'monokai_pro'
  | 'dual_light'
  | 'github_light'
  | 'solarized_light'
  | 'catppuccin_latte'
  | 'nord_light'
  | 'pastel_mint'
  | 'dual_rainbow'
  | 'sunset_glow'
  | 'planner_date';

interface ThemeOption {
  id: PiPTheme;
  name: string;
  shortName: string;
  emoji: string;
}

const DARK_THEMES: ThemeOption[] = [
  { id: 'dark', name: 'Dark Obsidian', shortName: 'Obsidian', emoji: '🌑' },
  { id: 'github_dark', name: 'GitHub Dark Pro', shortName: 'GitHub', emoji: '🐙' },
  { id: 'dracula', name: 'Dracula Pro', shortName: 'Dracula', emoji: '🧛' },
  { id: 'catppuccin_mocha', name: 'Catppuccin Mocha', shortName: 'Catppuccin', emoji: '☕' },
  { id: 'tokyo_night', name: 'Tokyo Night', shortName: 'Tokyo', emoji: '🌃' },
  { id: 'monokai_pro', name: 'Monokai Pro', shortName: 'Monokai', emoji: '🎨' },
];

const LIGHT_THEMES: ThemeOption[] = [
  { id: 'dual_light', name: 'Modern Clean Light', shortName: 'Clean', emoji: '☀️' },
  { id: 'github_light', name: 'GitHub Light Pro', shortName: 'GitHub', emoji: '📄' },
  { id: 'solarized_light', name: 'Solarized Light', shortName: 'Solarized', emoji: '📜' },
  { id: 'catppuccin_latte', name: 'Catppuccin Latte', shortName: 'Latte', emoji: '🥛' },
  { id: 'nord_light', name: 'Nord Light', shortName: 'Nord', emoji: '❄️' },
  { id: 'pastel_mint', name: 'Pastel Mint', shortName: 'Mint', emoji: '🍃' },
];

const VIBRANT_THEMES: ThemeOption[] = [
  { id: 'dual_rainbow', name: 'Rainbow Prism Dual', shortName: 'Rainbow', emoji: '🌈' },
  { id: 'sunset_glow', name: 'Sunset Glow Dual', shortName: 'Sunset', emoji: '🌅' },
  { id: 'planner_date', name: 'Planner Date Dual', shortName: 'Planner', emoji: '📅' },
];

const ALL_THEMES = [...DARK_THEMES, ...LIGHT_THEMES, ...VIBRANT_THEMES];

interface PiPTimerItem {
  id: string;
  source: 'session' | 'pomodoro';
  activeId: string | null;
  type: 'task' | 'habit' | 'pomodoro' | 'stopwatch';
  title: string;
  modeLabel: string;
  isRunning: boolean;
  timeRemaining: number;
  timeElapsed: number;
  initialDuration: number;
  isStopwatch: boolean;
  onTogglePlayPause: () => void;
  onReset?: () => void;
  onJump: () => void;
  onClose: () => void;
  onComplete?: () => void;
}

export const DraggablePiPWidget: React.FC = () => {
  const {
    session,
    sessions,
    pauseSession,
    resumeSession,
    stopSession,
    setPiPVisible,
  } = useActiveSession();

  const {
    pomodoro,
    tasks,
    habits,
    pausePomodoro,
    startPomodoro,
    resetPomodoro,
    stopPomodoro,
    completePomodoroSession,
    setActiveTab,
  } = useApp();

  const [currentTimerIndex, setCurrentTimerIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // PiP Color Theme State
  const [pipTheme, setPipTheme] = useState<PiPTheme>(() => {
    try {
      const saved = localStorage.getItem('omni_pip_theme') as PiPTheme;
      if (ALL_THEMES.some(t => t.id === saved)) {
        return saved;
      }
    } catch {}
    return 'dark';
  });

  const handleSetPipTheme = (theme: PiPTheme) => {
    setPipTheme(theme);
    try {
      localStorage.setItem('omni_pip_theme', theme);
    } catch {}
  };

  const isLightTheme =
    pipTheme === 'dual_light' ||
    pipTheme === 'github_light' ||
    pipTheme === 'solarized_light' ||
    pipTheme === 'catppuccin_latte' ||
    pipTheme === 'nord_light' ||
    pipTheme === 'pastel_mint';

  const isRainbowOrVibrant = pipTheme === 'dual_rainbow' || pipTheme === 'sunset_glow' || pipTheme === 'planner_date';

  const timerTextColor = isRainbowOrVibrant && pipTheme !== 'planner_date'
    ? 'text-indigo-950 font-black'
    : pipTheme === 'planner_date'
    ? 'text-indigo-200 font-black'
    : isLightTheme
    ? 'text-slate-950 font-black'
    : 'text-emerald-400 font-bold';

  // Outer container frame theme with subtle thin border line
  const containerThemeClasses = {
    dark: 'bg-slate-900/95 dark:bg-slate-950/95 border border-slate-600/70 text-white shadow-2xl',
    github_dark: 'bg-[#161b22] border border-[#30363d] text-[#c9d1d9] shadow-2xl',
    dracula: 'bg-[#282a36] border border-[#6272a4] text-[#f8f8f2] shadow-2xl',
    catppuccin_mocha: 'bg-[#1e1e2e] border border-[#585b70] text-[#cdd6f4] shadow-2xl',
    tokyo_night: 'bg-[#1a1b26] border border-[#565f89] text-[#c0caf5] shadow-2xl',
    monokai_pro: 'bg-[#2d2c2e] border border-[#787878] text-[#fcfcfa] shadow-2xl',
    dual_light: 'bg-white border border-slate-300 text-slate-950 shadow-2xl ring-1 ring-slate-300/60',
    github_light: 'bg-[#f6f8fa] border border-[#d0d7de] text-[#24292f] shadow-2xl',
    solarized_light: 'bg-[#eee8d5] border border-[#93a1a1] text-[#073642] shadow-2xl',
    catppuccin_latte: 'bg-[#e6e9ef] border border-[#bcc0cc] text-[#4c4f69] shadow-2xl',
    nord_light: 'bg-[#e5e9f0] border border-[#d8dee9] text-[#2e3440] shadow-2xl',
    pastel_mint: 'bg-[#f0fdf4] border border-[#86efac] text-[#064e3b] shadow-2xl',
    dual_rainbow: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 border border-yellow-300 text-slate-950 shadow-2xl',
    sunset_glow: 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 border border-amber-200 text-slate-950 shadow-2xl',
    planner_date: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 border border-indigo-200 text-white shadow-2xl',
  }[pipTheme];

  // True Dual-Tone section shade classes with crisp thin dividing border line
  const topSectionClasses = {
    dark: 'bg-slate-800 border-b border-slate-600/80 text-slate-100 font-bold',
    github_dark: 'bg-[#21262d] border-b border-[#30363d] text-[#f0f6fc] font-bold',
    dracula: 'bg-[#44475a] border-b border-[#6272a4] text-[#50fa7b] font-bold',
    catppuccin_mocha: 'bg-[#313244] border-b border-[#585b70] text-[#b4befe] font-bold',
    tokyo_night: 'bg-[#24283b] border-b border-[#565f89] text-[#7aa2f7] font-bold',
    monokai_pro: 'bg-[#363537] border-b border-[#787878] text-[#ffd866] font-bold',
    dual_light: 'bg-slate-100 border-b border-slate-300 text-slate-950 font-bold',
    github_light: 'bg-[#ffffff] border-b border-[#d0d7de] text-[#24292f] font-bold',
    solarized_light: 'bg-[#fdf6e3] border-b border-[#93a1a1] text-[#002b36] font-bold',
    catppuccin_latte: 'bg-[#eff1f5] border-b border-[#bcc0cc] text-[#1e66f5] font-bold',
    nord_light: 'bg-[#eceff4] border-b border-[#d8dee9] text-[#5e81ac] font-bold',
    pastel_mint: 'bg-[#ffffff] border-b border-[#86efac] text-[#065f46] font-bold',
    dual_rainbow: 'bg-gradient-to-r from-pink-100 via-purple-100 to-indigo-100 border-b border-indigo-300 text-slate-950 font-black',
    sunset_glow: 'bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 border-b border-orange-300 text-slate-950 font-black',
    planner_date: 'bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 border-b border-indigo-300 text-slate-950 font-black',
  }[pipTheme];

  const bottomSectionClasses = {
    dark: 'bg-slate-950 border-t border-slate-800 text-slate-100',
    github_dark: 'bg-[#0d1117] border-t border-[#30363d] text-[#c9d1d9]',
    dracula: 'bg-[#1e1f29] border-t border-[#6272a4] text-[#f8f8f2]',
    catppuccin_mocha: 'bg-[#181825] border-t border-[#45475a] text-[#cdd6f4]',
    tokyo_night: 'bg-[#1a1b26] border-t border-[#414868] text-[#c0caf5]',
    monokai_pro: 'bg-[#2d2c2e] border-t border-[#787878] text-[#fcfcfa]',
    dual_light: 'bg-white border-t border-slate-200 text-slate-900',
    github_light: 'bg-[#f0f3f6] border-t border-[#d0d7de] text-[#24292f]',
    solarized_light: 'bg-[#eee8d5] border-t border-[#93a1a1] text-[#073642]',
    catppuccin_latte: 'bg-[#e6e9ef] border-t border-[#ccd0da] text-[#4c4f69]',
    nord_light: 'bg-[#e5e9f0] border-t border-[#d8dee9] text-[#2e3440]',
    pastel_mint: 'bg-[#f0fdf4] border-t border-[#bbf7d0] text-[#064e3b]',
    dual_rainbow: 'bg-gradient-to-r from-sky-100 via-violet-100 to-rose-100 border-t border-indigo-200 text-slate-900 font-bold',
    sunset_glow: 'bg-gradient-to-r from-orange-50 via-rose-50 to-amber-50 border-t border-amber-200 text-slate-900 font-bold',
    planner_date: 'bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 border-t border-indigo-500/30 text-indigo-200 font-bold',
  }[pipTheme];

  // Jump to specific active item and trigger highlight blink & routing state (Open Source behavior)
  const handleJumpToTimer = useCallback(
    (targetId: string | null, type: 'task' | 'habit' | 'pomodoro' | 'stopwatch', title?: string) => {
      let resolvedId = targetId;
      let isHabit = type === 'habit';

      if (!resolvedId && title) {
        const foundHabit = habits?.find(h => h.name.toLowerCase() === title.toLowerCase());
        if (foundHabit) {
          resolvedId = foundHabit.id;
          isHabit = true;
        } else {
          const foundTask = tasks?.find(t => t.title.toLowerCase() === title.toLowerCase());
          if (foundTask) {
            resolvedId = foundTask.id;
            isHabit = false;
          }
        }
      }

      if (!resolvedId) return;

      if (isHabit) {
        setActiveTab('habits');
        window.dispatchEvent(new CustomEvent('omni-jump-to-habit', { detail: { habitId: resolvedId } }));
      } else {
        setActiveTab('tasks');
        window.dispatchEvent(new CustomEvent('omni-jump-to-task', { detail: { taskId: resolvedId } }));
      }

      const triggerBlink = (el: HTMLElement) => {
        el.classList.remove('pip-highlight-blink');
        void el.offsetWidth;
        el.classList.add('pip-highlight-blink');

        const existingBadge = el.querySelector('.pip-active-target-badge');
        if (existingBadge) {
          existingBadge.remove();
        }
        const badge = document.createElement('div');
        badge.className =
          'pip-active-target-badge pointer-events-none absolute -top-3.5 right-4 z-50 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wide shadow-xl flex items-center gap-1 border border-amber-300 animate-bounce';
        badge.innerHTML = '<span>⏱ RUNNING IN PIP TIMER</span>';
        el.style.position = 'relative';
        el.appendChild(badge);

        setTimeout(() => {
          badge.remove();
          el.classList.remove('pip-highlight-blink');
        }, 3500);
      };

      const selectors = isHabit
        ? [`#habit-${resolvedId}`, `[data-habit-id="${resolvedId}"]`, `[data-id="${resolvedId}"]`]
        : [`#task-${resolvedId}`, `[data-task-id="${resolvedId}"]`, `[data-id="${resolvedId}"]`];

      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        for (const sel of selectors) {
          const found = document.querySelector(sel) as HTMLElement | null;
          if (found) {
            clearInterval(interval);
            triggerBlink(found);
            return;
          }
        }
        if (attempts >= 15) {
          clearInterval(interval);
        }
      }, 80);
    },
    [habits, tasks, setActiveTab]
  );

  // Construct unified timer items list across sessions and pomodoro
  const timerList: PiPTimerItem[] = useMemo(() => {
    const list: PiPTimerItem[] = [];

    // 1. All active sessions from ActiveSessionContext
    sessions.forEach(s => {
      if (!s.activeId && !s.title) return;
      const isHabit = s.type === 'habit';
      const isSw = s.timerMode === 'stopwatch';
      const activeTask = tasks?.find(t => t.id === s.activeId);
      const activeHabit = habits?.find(h => h.id === s.activeId);
      const title = s.title || (isHabit ? activeHabit?.name : activeTask?.title) || (isSw ? 'Stopwatch' : 'Focus Session');

      list.push({
        id: `session_${s.activeId || s.title}`,
        source: 'session',
        activeId: s.activeId,
        type: isHabit ? 'habit' : isSw ? 'stopwatch' : 'task',
        title,
        modeLabel: isSw ? 'Stopwatch' : isHabit ? 'Habit' : 'Focus',
        isRunning: s.isRunning,
        timeRemaining: s.timeRemaining,
        timeElapsed: s.timeElapsed,
        initialDuration: s.initialDuration,
        isStopwatch: isSw,
        onTogglePlayPause: () => {
          if (s.isRunning) {
            pauseSession(s.activeId || undefined);
          } else {
            resumeSession(s.activeId || undefined);
          }
        },
        onReset: () => {},
        onJump: () => handleJumpToTimer(s.activeId, isHabit ? 'habit' : 'task', title),
        onClose: () => stopSession(s.activeId || undefined),
      });
    });

    // 2. Pomodoro timer from AppContext (if active and not already included in sessions)
    const isPomodoroActive = Boolean(pomodoro.taskId || pomodoro.isRunning);
    if (isPomodoroActive) {
      const alreadyIncluded = list.some(item => item.activeId === pomodoro.taskId && item.activeId !== null);
      if (!alreadyIncluded) {
        const pTask = tasks?.find(t => t.id === pomodoro.taskId);
        const title = pTask?.title || 'Pomodoro Sprint';

        list.push({
          id: `pomodoro_${pomodoro.taskId || 'general'}`,
          source: 'pomodoro',
          activeId: pomodoro.taskId,
          type: 'pomodoro',
          title,
          modeLabel: pomodoro.mode === 'break' ? 'Break' : 'Focus',
          isRunning: pomodoro.isRunning,
          timeRemaining: pomodoro.timeRemaining,
          timeElapsed: 0,
          initialDuration: pomodoro.initialDuration,
          isStopwatch: false,
          onTogglePlayPause: () => {
            if (pomodoro.isRunning) {
              pausePomodoro();
            } else {
              startPomodoro(pomodoro.taskId || undefined);
            }
          },
          onReset: resetPomodoro,
          onJump: () => handleJumpToTimer(pomodoro.taskId, 'task', title),
          onClose: () => {
            stopPomodoro();
            if (list.length === 1) {
              setPiPVisible(false);
            }
          },
          onComplete: completePomodoroSession,
        });
      }
    }

    return list;
  }, [
    sessions,
    pomodoro,
    tasks,
    habits,
    pauseSession,
    resumeSession,
    stopSession,
    pausePomodoro,
    startPomodoro,
    resetPomodoro,
    stopPomodoro,
    completePomodoroSession,
    setPiPVisible,
    handleJumpToTimer,
  ]);

  const totalTimers = timerList.length;
  const isAnyTimerActive = totalTimers > 0;

  // Clamped active timer
  const safeIndex = totalTimers > 0 ? Math.min(Math.max(0, currentTimerIndex), totalTimers - 1) : 0;
  const currentTimer = timerList[safeIndex];

  // Mode state: 'extended' | 'compact' | 'mini'
  const [pipMode, setPipMode] = useState<PiPMode>(() => {
    try {
      const saved = localStorage.getItem('omni_pip_mode') as PiPMode;
      if (saved === 'compact' || saved === 'extended' || saved === 'mini') {
        return saved;
      }
    } catch {}
    return 'extended';
  });

  // Position state (defaults to accessible bottom-right with strict 24px padding)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const widgetWidth = pipMode === 'mini' ? 180 : Math.min(315, window.innerWidth - 24);
      const initX = Math.max(12, window.innerWidth - widgetWidth - 24);
      const initY = Math.max(12, window.innerHeight - 95);
      return { x: initX, y: initY };
    }
    return { x: 16, y: 300 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(position);
  posRef.current = position;
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor visibility and mount lifecycle of PiP widget
  useEffect(() => {
    setPiPVisible(isAnyTimerActive);
  }, [isAnyTimerActive, setPiPVisible]);

  // Keep strictly inside viewport on window resize with 24px padding
  useEffect(() => {
    const handleResize = () => {
      const widgetWidth = pipMode === 'mini' ? 180 : Math.min(315, window.innerWidth - 24);
      const widgetHeight = pipMode === 'extended' ? 70 : pipMode === 'mini' ? 36 : 44;
      setPosition(prev => ({
        x: Math.max(12, Math.min(window.innerWidth - widgetWidth - 24, prev.x)),
        y: Math.max(12, Math.min(window.innerHeight - widgetHeight - 24, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pipMode]);

  // Track active scrolling on window or nested containers to activate translucent mode
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 850);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Universal pointer-based drag handler (mouse, touch, stylus)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest?.('button, input, select, textarea, a')) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = true;
    setIsDragging(true);

    const currentX = posRef.current.x;
    const currentY = posRef.current.y;

    dragOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      moveEv.preventDefault();

      const widgetWidth = pipMode === 'mini' ? 180 : Math.min(315, window.innerWidth - 24);
      const widgetHeight = pipMode === 'extended' ? 70 : pipMode === 'mini' ? 36 : 44;

      const minX = 12;
      const maxX = Math.max(12, window.innerWidth - widgetWidth - 24);
      const minY = 12;
      const maxY = Math.max(12, window.innerHeight - widgetHeight - 24);

      const nextX = moveEv.clientX - dragOffsetRef.current.x;
      const nextY = moveEv.clientY - dragOffsetRef.current.y;

      const clampedX = Math.min(maxX, Math.max(minX, nextX));
      const clampedY = Math.min(maxY, Math.max(minY, nextY));

      posRef.current = { x: clampedX, y: clampedY };
      setPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = (upEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      try {
        if (target && 'releasePointerCapture' in target) {
          (target as HTMLElement).releasePointerCapture(upEv.pointerId);
        }
      } catch {}

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [pipMode]);

  // Touch Swipe Gesture for switching between stacked timers
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - (touchStartYRef.current || 0));

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      if (deltaX < 0) {
        handleNextTimer();
      } else {
        handlePrevTimer();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleNextTimer = useCallback(() => {
    if (totalTimers <= 1) return;
    setSlideDirection('left');
    setCurrentTimerIndex(prev => (prev + 1) % totalTimers);
    setTimeout(() => setSlideDirection(null), 250);
  }, [totalTimers]);

  const handlePrevTimer = useCallback(() => {
    if (totalTimers <= 1) return;
    setSlideDirection('right');
    setCurrentTimerIndex(prev => (prev - 1 + totalTimers) % totalTimers);
    setTimeout(() => setSlideDirection(null), 250);
  }, [totalTimers]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!isAnyTimerActive || !currentTimer || typeof document === 'undefined') return null;

  const displayTime = currentTimer.isStopwatch
    ? formatTime(currentTimer.timeElapsed)
    : formatTime(currentTimer.timeRemaining);

  const isCurrentRunning = currentTimer.isRunning;

  const renderStackingLayers = (isCapsule: boolean) => {
    if (totalTimers <= 1) return null;

    return (
      <>
        <div
          className={`absolute inset-0 ${
            isCapsule ? 'rounded-full' : 'rounded-2xl'
          } bg-slate-800/90 dark:bg-slate-900/90 border border-slate-700/60 shadow-lg -z-10 pointer-events-none transition-transform duration-200`}
          style={{
            transform: 'translateY(3px) translateX(3px) scale(0.98)',
            opacity: 0.85,
          }}
        />
        {totalTimers > 2 && (
          <div
            className={`absolute inset-0 ${
              isCapsule ? 'rounded-full' : 'rounded-2xl'
            } bg-slate-850/75 dark:bg-slate-950/75 border border-slate-800/50 shadow-md -z-20 pointer-events-none transition-transform duration-200`}
            style={{
              transform: 'translateY(6px) translateX(6px) scale(0.95)',
              opacity: 0.6,
            }}
          />
        )}
      </>
    );
  };

  const renderStackPager = (isMini = false) => {
    if (totalTimers <= 1) return null;

    if (isMini) {
      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleNextTimer();
          }}
          className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono font-bold shrink-0 hover:bg-indigo-500/30 transition cursor-pointer"
          title="Multiple timers active. Tap or swipe to switch"
        >
          <Layers className="w-2.5 h-2.5" />
          <span>{safeIndex + 1}/{totalTimers}</span>
        </button>
      );
    }

    return (
      <div
        className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/70 shrink-0 text-slate-400 select-none"
        onClick={e => e.stopPropagation()}
        title="Swipe or click arrows to switch between stacked timers"
      >
        <button
          type="button"
          onClick={handlePrevTimer}
          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition cursor-pointer"
          title="Previous timer"
        >
          <ChevronLeft className="w-3 h-3 stroke-[2.5]" />
        </button>
        <span className="text-[10px] font-mono font-black text-indigo-300 px-0.5">
          {safeIndex + 1}/{totalTimers}
        </span>
        <button
          type="button"
          onClick={handleNextTimer}
          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition cursor-pointer"
          title="Next timer"
        >
          <ChevronRight className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>
    );
  };

  // PiP Settings Menu Popover with 3-column compact grids for themes
  const renderSettingsPortal = () => {
    if (!isSettingsOpen) return null;

    const popoverLeft = Math.max(12, Math.min(window.innerWidth - 320, position.x));
    const isNearBottom = position.y > window.innerHeight / 2;
    const popoverStyle: React.CSSProperties = {
      left: `${popoverLeft}px`,
      ...(isNearBottom
        ? { bottom: `${Math.max(12, window.innerHeight - position.y + 10)}px` }
        : { top: `${Math.max(12, position.y + 60)}px` }),
    };

    return createPortal(
      <div
        className="fixed z-[100000] w-80 rounded-2xl bg-slate-900/98 dark:bg-slate-950/98 border border-slate-700/90 shadow-2xl backdrop-blur-xl p-3 text-white space-y-3 animate-in fade-in zoom-in-95 duration-150 select-none max-h-[82vh] overflow-y-auto [scrollbar-width:thin]"
        style={popoverStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>PiP Themes & Settings</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="w-5 h-5 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* 1. Open Source Action Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              setIsSettingsOpen(false);
              currentTimer.onJump();
            }}
            className="w-full py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
            title="Navigate main app view to the source task or habit"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Source (Go to Task/Habit)</span>
          </button>
        </div>

        {/* 2. Dark Based Themes (3-Column Grid) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <span>🌙</span>
            <span>Dark Based ({DARK_THEMES.length})</span>
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {DARK_THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSetPipTheme(t.id)}
                className={`p-1.5 rounded-xl text-[10px] font-bold text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer border ${
                  pipTheme === t.id
                    ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400 border-indigo-300'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                }`}
                title={t.name}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="truncate w-full">{t.shortName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Light Based Themes (3-Column Grid) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <span>☀️</span>
            <span>Light Based ({LIGHT_THEMES.length})</span>
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {LIGHT_THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSetPipTheme(t.id)}
                className={`p-1.5 rounded-xl text-[10px] font-bold text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer border ${
                  pipTheme === t.id
                    ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400 border-indigo-300'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                }`}
                title={t.name}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="truncate w-full">{t.shortName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Vibrant, Rainbow & Planner Date Themes (3-Column Grid) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
            <span>🌈</span>
            <span>Planner & Vibrant</span>
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {VIBRANT_THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSetPipTheme(t.id)}
                className={`p-1.5 rounded-xl text-[10px] font-bold text-center flex flex-col items-center justify-center gap-0.5 transition cursor-pointer border ${
                  pipTheme === t.id
                    ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400 border-indigo-300'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                }`}
                title={t.name}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="truncate w-full">{t.shortName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 1. Ultra-Mini Floating Pill Mode (Single Row, 34px height)
  if (pipMode === 'mini') {
    return createPortal(
      <>
        <div
          ref={widgetRef}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            height: '34px',
            maxHeight: '34px',
            minHeight: '34px',
          }}
          className={`fixed z-[99999] touch-none select-none flex items-center gap-1.5 backdrop-blur-xl rounded-full shadow-2xl border px-2.5 py-1 transition-opacity duration-200 cursor-grab active:cursor-grabbing ${containerThemeClasses} ${
            isDragging ? 'ring-2 ring-indigo-500/50 cursor-grabbing' : ''
          } ${isScrolling ? 'opacity-35 hover:opacity-100' : 'opacity-100'}`}
          title="Draggable Mini Timer"
        >
          {renderStackingLayers(true)}

          <GripHorizontal className="w-3 h-3 text-current opacity-70 shrink-0" />
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              isCurrentRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className={`text-xs font-mono font-bold tabular-nums shrink-0 ${timerTextColor}`}>
            {displayTime}
          </span>

          {renderStackPager(true)}

          <button
            type="button"
            onClick={currentTimer.onTogglePlayPause}
            className={`w-5.5 h-5.5 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
              isCurrentRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title={isCurrentRunning ? 'Pause' : 'Start'}
          >
            {isCurrentRunning ? <Pause className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current ml-0.5" />}
          </button>

          {/* Settings / Theme Menu Button */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsSettingsOpen(prev => !prev);
            }}
            className="p-0.5 rounded-full hover:bg-black/10 opacity-80 hover:opacity-100 transition cursor-pointer shrink-0"
            title="PiP Settings & Theme Menu"
          >
            <Settings className="w-3 h-3" />
          </button>

          {/* Open Source Button */}
          <button
            type="button"
            onClick={currentTimer.onJump}
            className="p-0.5 rounded-full hover:bg-black/10 transition cursor-pointer shrink-0 opacity-80 hover:opacity-100"
            title="Open Source: Go to task or habit"
          >
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={currentTimer.onClose}
            className="p-0.5 rounded-full hover:bg-black/10 transition cursor-pointer shrink-0 opacity-80 hover:opacity-100"
            title="Stop & Close Timer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {renderSettingsPortal()}
      </>,
      document.body
    );
  }

  // 2. Extended Mode: True Dual-Tone with crisp thin dividing border line & high visibility
  if (pipMode === 'extended') {
    return createPortal(
      <>
        <div
          ref={widgetRef}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            height: '68px',
            maxHeight: '68px',
            minHeight: '68px',
          }}
          className={`fixed z-[99999] touch-none select-none max-w-[calc(100vw-24px)] w-[285px] sm:w-[315px] backdrop-blur-xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col justify-between transition-opacity duration-200 cursor-grab active:cursor-grabbing ${containerThemeClasses} ${
            isDragging ? 'ring-2 ring-indigo-500/50 cursor-grabbing' : ''
          } ${isScrolling ? 'opacity-35 hover:opacity-100' : 'opacity-100'}`}
        >
          {renderStackingLayers(false)}

          {/* Row 1: Top Lighter Dual-Tone Section (Task/Habit Title + Mode Badge) */}
          <div
            className={`flex items-center justify-between gap-1.5 min-w-0 cursor-pointer px-2.5 py-1.5 transition-transform duration-200 ${topSectionClasses} ${
              slideDirection === 'left' ? '-translate-x-1' : slideDirection === 'right' ? 'translate-x-1' : ''
            }`}
            onClick={currentTimer.onJump}
            title={`Open Source: Click to jump to: ${currentTimer.title}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <GripHorizontal className="w-3 h-3 opacity-70 shrink-0" />
              <span className="font-bold text-xs hover:underline transition truncate max-w-[150px] sm:max-w-[170px]">
                {currentTimer.title}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {renderStackPager(false)}
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-black/15 text-current border border-current/25 shrink-0 leading-none">
                {currentTimer.modeLabel}
              </span>
            </div>
          </div>

          {/* Row 2: Bottom Darker Dual-Tone Section (Time Display + Action Controls) */}
          <div className={`flex items-center justify-between gap-1 min-w-0 px-2.5 py-1 ${bottomSectionClasses}`}>
            <div className="flex items-center gap-1.5 shrink-0 pl-0.5">
              <span className="relative flex h-2 w-2 shrink-0">
                {isCurrentRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isCurrentRunning ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                />
              </span>
              <span className={`text-sm font-mono font-black tabular-nums leading-none ${timerTextColor}`}>
                {displayTime}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Play / Pause Button */}
              <button
                type="button"
                onClick={currentTimer.onTogglePlayPause}
                className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition shadow-md cursor-pointer shrink-0 ${
                  isCurrentRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                title={isCurrentRunning ? 'Pause' : 'Start'}
              >
                {isCurrentRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
              </button>

              {/* Pomodoro Sprint Log (+1 🍅) Button */}
              {currentTimer.onComplete && (
                <button
                  type="button"
                  onClick={currentTimer.onComplete}
                  className="h-6.5 px-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white text-[10px] font-extrabold shadow-xs transition flex items-center gap-0.5 cursor-pointer shrink-0"
                  title="Log completed session (+1 🍅)"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>+1🍅</span>
                </button>
              )}

              {/* Reset Button */}
              {currentTimer.onReset && (
                <button
                  type="button"
                  onClick={currentTimer.onReset}
                  className="w-6 h-6 rounded-full hover:bg-black/10 opacity-80 hover:opacity-100 transition flex items-center justify-center cursor-pointer shrink-0"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}

              {/* Settings & Theme Menu Button */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsSettingsOpen(prev => !prev);
                }}
                className="w-6 h-6 rounded-full hover:bg-black/10 opacity-80 hover:opacity-100 transition flex items-center justify-center cursor-pointer shrink-0"
                title="PiP Settings & Color Themes"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Open Source Button */}
              <button
                type="button"
                onClick={currentTimer.onJump}
                className="w-6.5 h-6.5 rounded-full hover:bg-black/10 transition flex items-center justify-center cursor-pointer shrink-0 opacity-85 hover:opacity-100"
                title="Open Source: Go to task or habit"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Close & Stop 'X' Button */}
              <button
                type="button"
                onClick={currentTimer.onClose}
                className="w-6 h-6 rounded-full hover:bg-rose-500/25 transition flex items-center justify-center cursor-pointer shrink-0 opacity-80 hover:opacity-100"
                title="Stop & Close Timer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        {renderSettingsPortal()}
      </>,
      document.body
    );
  }

  // 3. Compact Mode: Single-line 42px capsule
  return createPortal(
    <>
      <div
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          height: '42px',
          maxHeight: '42px',
          minHeight: '42px',
        }}
        className={`fixed z-[99999] touch-none select-none max-w-[calc(100vw-24px)] w-auto backdrop-blur-xl rounded-full shadow-2xl border px-2.5 flex items-center gap-2 transition-opacity duration-200 cursor-grab active:cursor-grabbing ${containerThemeClasses} ${
          isDragging ? 'ring-2 ring-indigo-500/50 cursor-grabbing' : ''
        } ${isScrolling ? 'opacity-35 hover:opacity-100' : 'opacity-100'}`}
        title={totalTimers > 1 ? 'Stacked PiP Timer (Swipe left/right to switch)' : 'PiP Timer'}
      >
        {renderStackingLayers(true)}

        <div className="flex items-center gap-1.5 shrink-0 pl-0.5">
          <GripHorizontal className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <span className="relative flex h-2 w-2 shrink-0">
            {isCurrentRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isCurrentRunning ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
          </span>
        </div>

        <span className={`text-sm font-mono font-black tabular-nums shrink-0 leading-none ${timerTextColor}`}>
          {displayTime}
        </span>

        {/* Clickable Title + Mode Badge */}
        <div
          className={`min-w-0 flex items-center gap-1 cursor-pointer overflow-hidden max-w-[75px] sm:max-w-[105px] transition-transform duration-200 ${
            slideDirection === 'left' ? '-translate-x-1' : slideDirection === 'right' ? 'translate-x-1' : ''
          }`}
          onClick={currentTimer.onJump}
          title={`Open Source: Click to jump to: ${currentTimer.title}`}
        >
          <span className="font-semibold text-xs hover:underline transition truncate leading-none">
            {currentTimer.title}
          </span>
          <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-black/15 text-current border border-current/25 shrink-0 leading-none">
            {currentTimer.modeLabel}
          </span>
        </div>

        {renderStackPager(false)}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={currentTimer.onTogglePlayPause}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-md cursor-pointer shrink-0 ${
              isCurrentRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title={isCurrentRunning ? 'Pause' : 'Start'}
          >
            {isCurrentRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          {currentTimer.onComplete && (
            <button
              type="button"
              onClick={currentTimer.onComplete}
              className="h-7 px-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white text-[10px] font-extrabold shadow-xs transition flex items-center gap-0.5 cursor-pointer shrink-0"
              title="Log completed session (+1 🍅)"
            >
              <Check className="w-3 h-3 stroke-[3]" />
              <span>+1🍅</span>
            </button>
          )}

          {currentTimer.onReset && (
            <button
              type="button"
              onClick={currentTimer.onReset}
              className="w-6 h-6 rounded-full hover:bg-black/10 opacity-80 transition flex items-center justify-center cursor-pointer shrink-0"
              title="Reset Timer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {/* Settings & Theme Menu Button */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsSettingsOpen(prev => !prev);
            }}
            className="w-6 h-6 rounded-full hover:bg-black/10 opacity-80 hover:opacity-100 transition flex items-center justify-center cursor-pointer shrink-0"
            title="PiP Settings & Color Themes"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Open Source Button */}
          <button
            type="button"
            onClick={currentTimer.onJump}
            className="w-6 h-6 rounded-full hover:bg-black/10 transition flex items-center justify-center cursor-pointer shrink-0 opacity-85 hover:opacity-100"
            title="Open Source: Go to task or habit"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={currentTimer.onClose}
            className="w-6 h-6 rounded-full hover:bg-rose-500/25 transition flex items-center justify-center cursor-pointer shrink-0 opacity-80 hover:opacity-100"
            title="Stop & Close Timer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {renderSettingsPortal()}
    </>,
    document.body
  );
};
