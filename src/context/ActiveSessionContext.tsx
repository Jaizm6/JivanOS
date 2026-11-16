import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';

export type ActiveSessionType = 'task' | 'habit' | null;
export type ActiveTimerMode = 'focus' | 'stopwatch' | null;

export interface ActiveSessionState {
  activeId: string | null;
  type: ActiveSessionType;
  title: string;
  timerMode: ActiveTimerMode;
  isRunning: boolean;
  timeRemaining: number; // For focus (seconds)
  timeElapsed: number; // For stopwatch (seconds)
  initialDuration: number;
}

interface ActiveSessionContextType {
  session: ActiveSessionState;
  sessions: ActiveSessionState[];
  activeSessionIndex: number;
  setActiveSessionIndex: (index: number) => void;
  isPiPVisible: boolean;
  setPiPVisible: (visible: boolean) => void;
  startSession: (id: string, type: ActiveSessionType, title: string, timerMode: ActiveTimerMode, duration?: number) => void;
  pauseSession: (targetId?: string) => void;
  resumeSession: (targetId?: string) => void;
  stopSession: (targetId?: string) => void;
  updateTime: (updater: (prev: ActiveSessionState) => ActiveSessionState) => void;
  nextSession: () => void;
  prevSession: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextType | undefined>(undefined);

const defaultEmptySession: ActiveSessionState = {
  activeId: null,
  type: null,
  title: '',
  timerMode: null,
  isRunning: false,
  timeRemaining: 25 * 60,
  timeElapsed: 0,
  initialDuration: 25 * 60,
};

export const ActiveSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<ActiveSessionState[]>(() => {
    try {
      const savedSessions = localStorage.getItem('omni_active_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: ActiveSessionState) => ({ ...s, isRunning: false }));
        }
      }
      const savedSingle = localStorage.getItem('omni_active_session');
      if (savedSingle) {
        const parsed = JSON.parse(savedSingle);
        if (parsed && parsed.activeId) {
          return [{ ...parsed, isRunning: false }];
        }
      }
    } catch {}
    return [];
  });

  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [isPiPVisible, setIsPiPVisible] = useState(false);

  // Active primary session (safe fallback)
  const session: ActiveSessionState =
    sessions[activeSessionIndex] || sessions[0] || defaultEmptySession;

  // Debounced persist sessions so 1s timer ticks don't call JSON.stringify every second
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('omni_active_sessions', JSON.stringify(sessions));
        if (sessions.length > 0) {
          localStorage.setItem('omni_active_session', JSON.stringify(session));
        } else {
          localStorage.removeItem('omni_active_session');
        }
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [sessions, session]);

  // Keep active index within bounds
  useEffect(() => {
    if (sessions.length > 0 && activeSessionIndex >= sessions.length) {
      setActiveSessionIndex(sessions.length - 1);
    }
  }, [sessions.length, activeSessionIndex]);

  const hasRunning = useMemo(() => sessions.some(s => s.isRunning && s.activeId), [sessions]);

  // Timer interval ticking all active sessions without recreating interval every second
  useEffect(() => {
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setSessions(prev =>
        prev.map(s => {
          if (!s.isRunning || !s.activeId) return s;
          if (s.timerMode === 'focus') {
            if (s.timeRemaining <= 1) {
              return { ...s, timeRemaining: 0, isRunning: false };
            }
            return { ...s, timeRemaining: s.timeRemaining - 1 };
          } else if (s.timerMode === 'stopwatch') {
            return { ...s, timeElapsed: s.timeElapsed + 1 };
          }
          return s;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [hasRunning]);

  const activeSessionIndexRef = React.useRef(activeSessionIndex);
  activeSessionIndexRef.current = activeSessionIndex;

  // Start or add session to stack
  const startSession = useCallback((
    id: string,
    type: ActiveSessionType,
    title: string,
    timerMode: ActiveTimerMode,
    duration: number = 25 * 60
  ) => {
    setSessions(prev => {
      const existingIdx = prev.findIndex(s => s.activeId === id);
      const newSession: ActiveSessionState = {
        activeId: id,
        type,
        title,
        timerMode,
        isRunning: true,
        timeRemaining: timerMode === 'focus' ? duration : 0,
        timeElapsed: 0,
        initialDuration: duration,
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          ...newSession,
          isRunning: true,
        };
        setActiveSessionIndex(existingIdx);
        return next;
      } else {
        const next = [...prev, newSession];
        setActiveSessionIndex(next.length - 1);
        return next;
      }
    });

    setIsPiPVisible(true);
  }, []);

  const pauseSession = useCallback((targetId?: string) => {
    const activeIdx = activeSessionIndexRef.current;
    setSessions(prev =>
      prev.map((s, idx) => {
        if (targetId ? s.activeId === targetId : idx === activeIdx) {
          return { ...s, isRunning: false };
        }
        return s;
      })
    );
  }, []);

  const resumeSession = useCallback((targetId?: string) => {
    const activeIdx = activeSessionIndexRef.current;
    setSessions(prev =>
      prev.map((s, idx) => {
        if (targetId ? s.activeId === targetId : idx === activeIdx) {
          return { ...s, isRunning: true };
        }
        return s;
      })
    );
  }, []);

  const stopSession = useCallback((targetId?: string) => {
    const activeIdx = activeSessionIndexRef.current;
    setSessions(prev => {
      const filtered = targetId
        ? prev.filter(s => s.activeId !== targetId)
        : prev.filter((_, idx) => idx !== activeIdx);

      if (filtered.length === 0) {
        setIsPiPVisible(false);
        setActiveSessionIndex(0);
        try {
          localStorage.removeItem('omni_active_sessions');
          localStorage.removeItem('omni_active_session');
        } catch {}
      } else {
        setActiveSessionIndex(curr => Math.min(curr, Math.max(0, filtered.length - 1)));
      }
      return filtered;
    });
  }, []);

  const nextSession = useCallback(() => {
    setSessions(prev => {
      if (prev.length <= 1) return prev;
      setActiveSessionIndex(curr => (curr + 1) % prev.length);
      return prev;
    });
  }, []);

  const prevSession = useCallback(() => {
    setSessions(prev => {
      if (prev.length <= 1) return prev;
      setActiveSessionIndex(curr => (curr - 1 + prev.length) % prev.length);
      return prev;
    });
  }, []);

  const updateTime = useCallback((updater: (prev: ActiveSessionState) => ActiveSessionState) => {
    const activeIdx = activeSessionIndexRef.current;
    setSessions(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      if (next[activeIdx]) {
        next[activeIdx] = updater(next[activeIdx]);
      }
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      session,
      sessions,
      activeSessionIndex,
      setActiveSessionIndex,
      isPiPVisible,
      setPiPVisible: setIsPiPVisible,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      updateTime,
      nextSession,
      prevSession,
    }),
    [
      session,
      sessions,
      activeSessionIndex,
      isPiPVisible,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      updateTime,
      nextSession,
      prevSession,
    ]
  );

  return (
    <ActiveSessionContext.Provider value={contextValue}>
      {children}
    </ActiveSessionContext.Provider>
  );
};

export const useActiveSession = () => {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error('useActiveSession must be used within an ActiveSessionProvider');
  }
  return context;
};
