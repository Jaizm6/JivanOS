import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface AndroidToastPayload {
  id: number;
  message: string;
  durationMs?: number;
  variant?: 'default' | 'success' | 'error';
}

const ANDROID_TOAST_EVENT = 'jivan_android_toast';

export function showAndroidToast(
  message: string,
  durationMs = 1350,
  variant: 'default' | 'success' | 'error' = 'default'
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AndroidToastPayload>(ANDROID_TOAST_EVENT, {
      detail: {
        id: Date.now() + Math.random(),
        message,
        durationMs,
        variant,
      },
    })
  );
}

export const AndroidToastContainer: React.FC = () => {
  const [toast, setToast] = useState<AndroidToastPayload | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dismissTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (unmountTimerRef.current !== null) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  }, []);

  const dismissNow = useCallback(() => {
    clearTimers();
    setIsLeaving(true);
    unmountTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setIsLeaving(false);
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
    }, 140);
  }, [clearTimers]);

  const scheduleAutoDismiss = useCallback(
    (durationMs: number) => {
      clearTimers();
      dismissTimerRef.current = window.setTimeout(() => {
        dismissNow();
      }, durationMs);
    },
    [clearTimers, dismissNow]
  );

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const custom = e as CustomEvent<AndroidToastPayload>;
      if (!custom.detail?.message) return;
      clearTimers();
      setIsLeaving(false);
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
      setToast(custom.detail);
      scheduleAutoDismiss(custom.detail.durationMs ?? 1350);
    };

    window.addEventListener(ANDROID_TOAST_EVENT, handleEvent);
    return () => {
      window.removeEventListener(ANDROID_TOAST_EVENT, handleEvent);
      clearTimers();
    };
  }, [clearTimers, scheduleAutoDismiss]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (clientX: number, clientY: number) => {
      if (!dragStartRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = Math.max(-12, clientY - dragStartRef.current.y);
      setDragX(dx);
      setDragY(dy);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onEnd = () => {
      dragStartRef.current = null;
      setIsDragging(false);
      setDragX(prevX => {
        setDragY(prevY => {
          if (Math.abs(prevX) >= 34 || prevY >= 20) {
            dismissNow();
            return prevY;
          }
          if (toast) {
            scheduleAutoDismiss(900);
          }
          return 0;
        });
        return Math.abs(prevX) >= 34 ? prevX : 0;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [isDragging, dismissNow, scheduleAutoDismiss, toast]);

  if (!toast) return null;

  const dragDistance = Math.max(Math.abs(dragX), Math.max(0, dragY));
  const dragOpacity = isLeaving ? 0 : Math.max(0.15, 1 - dragDistance / 90);

  return (
    <div
      data-no-drawer-swipe="true"
      className="fixed bottom-[76px] sm:bottom-6 left-1/2 -translate-x-1/2 z-[100000] pointer-events-none flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        onTouchStart={e => {
          if (e.touches.length !== 1) return;
          e.stopPropagation();
          clearTimers();
          dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          setIsDragging(true);
        }}
        onMouseDown={e => {
          if (e.button !== 0) return;
          e.stopPropagation();
          clearTimers();
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          setIsDragging(true);
        }}
        style={{
          transform: `translate3d(${dragX}px, ${isLeaving ? dragY + 8 : dragY}px, 0) scale(${isLeaving ? 0.94 : 1})`,
          opacity: dragOpacity,
          transition: isDragging
            ? 'none'
            : 'transform 160ms cubic-bezier(0.2, 0, 0, 1), opacity 140ms ease-out',
        }}
        className={`pointer-events-auto select-none touch-none cursor-grab active:cursor-grabbing px-4 py-2 rounded-full text-[12px] font-semibold tracking-tight shadow-[0_6px_20px_rgba(0,0,0,0.22)] border backdrop-blur-md max-w-[86vw] truncate animate-in fade-in slide-in-from-bottom-2 duration-150 ${
          toast.variant === 'error'
            ? 'bg-rose-600 text-white border-rose-500/40'
            : toast.variant === 'success'
            ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-500/30'
            : 'bg-zinc-900/92 dark:bg-zinc-100/95 text-white dark:text-zinc-950 border-white/10 dark:border-black/10'
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
};
