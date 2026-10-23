import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem('omni_active_sessions', JSON.stringify(sessions));
      if (sessions.length > 0) {
        localStorage.setItem('omni_active_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('omni_active_session');
      }
    } catch {}
  }, [sessions, session]);

  // Keep active index within bounds
  useEffect(() => {
    if (sessions.length > 0 && activeSessionIndex >= sessions.length) {
      setActiveSessionIndex(sessions.length - 1);
    }
  }, [sessions.length, activeSessionIndex]);


  // Timer interval ticking all active sessions
  useEffect(() => {
    const hasRunning = sessions.some(s => s.isRunning && s.activeId);
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
  }, [sessions]);

  // Start or add session to stack
  const startSession = (
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
  };

  const pauseSession = (targetId?: string) => {
    setSessions(prev =>
      prev.map((s, idx) => {
        if (targetId ? s.activeId === targetId : idx === activeSessionIndex) {
          return { ...s, isRunning: false };
        }
        return s;
      })
    );
  };

  const resumeSession = (targetId?: string) => {
    setSessions(prev =>
      prev.map((s, idx) => {
        if (targetId ? s.activeId === targetId : idx === activeSessionIndex) {
          return { ...s, isRunning: true };
        }
        return s;
      })
    );
  };

  const stopSession = (targetId?: string) => {
    setSessions(prev => {
      let filtered: ActiveSessionState[];
      if (targetId) {
        filtered = prev.filter(s => s.activeId !== targetId);
      } else {
        filtered = prev.filter((_, idx) => idx !== activeSessionIndex);
      }

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
  };

  const nextSession = () => {
    setSessions(prev => {
      if (prev.length <= 1) return prev;
      setActiveSessionIndex(curr => (curr + 1) % prev.length);
      return prev;
    });
  };

  const prevSession = () => {
    setSessions(prev => {
      if (prev.length <= 1) return prev;
      setActiveSessionIndex(curr => (curr - 1 + prev.length) % prev.length);
      return prev;
    });
  };

  const updateTime = (updater: (prev: ActiveSessionState) => ActiveSessionState) => {
    setSessions(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[activeSessionIndex] = updater(next[activeSessionIndex]);
      return next;
    });
  };

  return (
    <ActiveSessionContext.Provider
      value={{
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
      }}
    >
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
