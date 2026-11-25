import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  CloudDownload,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  X,
} from 'lucide-react';
import type { AutoSyncIntervalMinutes } from '../../utils/googleDriveSync';

export type SyncRowStatus =
  | 'disconnected'
  | 'connected'
  | 'synced'
  | 'syncing'
  | 'error'
  | 'trial'
  | 'expired';

export interface SyncProviderMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  href?: string;
}

export interface SyncProviderRowProps {
  id?: string;
  name: string;
  description: string;
  logo: React.ReactNode;
  logoBgClass?: string;
  brandColor: string;
  isConnected: boolean;
  status: SyncRowStatus;
  statusLabel?: string;
  badge?: React.ReactNode;
  accountLabel?: string;
  metaLine?: string;
  extraLine?: string;
  connectLabel?: string;
  connectVariant?: 'outlined' | 'chevron';
  connectDisabled?: boolean;
  connectButtonId?: string;
  onConnect?: () => void;
  disconnectedActions?: React.ReactNode;
  onSyncNow?: () => void;
  syncButtonId?: string;
  isSyncing?: boolean;
  onRetry?: () => void;
  autoSyncInterval?: AutoSyncIntervalMinutes;
  onSelectInterval?: (interval: AutoSyncIntervalMinutes) => void;
  onRestore?: () => void;
  onDisconnect?: () => void;
  disconnectLabel?: string;
  extraMenuItems?: SyncProviderMenuItem[];
  errorMessage?: string | null;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  highlightTint?: boolean;
  prominent?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const DROPDOWN_INTERVALS: { label: string; value: AutoSyncIntervalMinutes }[] = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: 'Manual', value: 0 },
];

export const SyncProviderRow: React.FC<SyncProviderRowProps> = ({
  id,
  name,
  description,
  logo,
  logoBgClass = 'bg-slate-100 dark:bg-zinc-800',
  brandColor,
  isConnected,
  status,
  statusLabel,
  badge,
  accountLabel,
  metaLine,
  extraLine,
  connectLabel = 'Connect',
  connectVariant = 'outlined',
  connectDisabled = false,
  connectButtonId,
  onConnect,
  disconnectedActions,
  onSyncNow,
  syncButtonId,
  isSyncing = false,
  onRetry,
  autoSyncInterval,
  onSelectInterval,
  onRestore,
  onDisconnect,
  disconnectLabel = 'Disconnect',
  extraMenuItems = [],
  errorMessage,
  expandedContent,
  isExpanded = false,
  highlightTint,
  prominent = false,
  isFirst = false,
  isLast = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const shouldTint = highlightTint ?? isConnected;
  const hasMenu = Boolean(
    onSelectInterval || onRestore || onDisconnect || extraMenuItems.length > 0
  );

  // Close floating overflow menu on outside tap, Escape, or when another SyncProviderRow opens its menu
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handleOtherMenuOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ source: HTMLDivElement | null }>).detail;
      if (detail?.source !== menuRef.current) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('jivanos:sync-row-menu-open', handleOtherMenuOpen);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('jivanos:sync-row-menu-open', handleOtherMenuOpen);
    };
  }, [menuOpen]);

  const triggerRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    setRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key: Date.now(),
    });
    window.setTimeout(() => setRipple(null), 420);
  };

  const renderStatusChip = () => {
    const baseChip =
      'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap shrink-0 leading-none';

    if (status === 'syncing') {
      return (
        <span role="status" className={`${baseChip} bg-blue-600 text-white animate-pulse`}>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>{statusLabel || 'Syncing…'}</span>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onRetry) onRetry();
            else if (onSyncNow) onSyncNow();
            else if (onConnect) onConnect();
          }}
          className={`${baseChip} bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition`}
          title="Tap to retry"
        >
          <X className="w-3 h-3" />
          <span>{statusLabel || 'Error'}</span>
        </button>
      );
    }
    if (status === 'trial') {
      return (
        <span
          role="status"
          className={`${baseChip} bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70`}
        >
          <span>{statusLabel || 'Trial'}</span>
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span role="status" className={`${baseChip} bg-rose-600 text-white`}>
          <span>{statusLabel || 'Expired'}</span>
        </span>
      );
    }
    if (status === 'synced') {
      return (
        <span role="status" className={`${baseChip} bg-emerald-600 text-white`}>
          <Check className="w-3 h-3" />
          <span>{statusLabel || 'Synced ✓'}</span>
        </span>
      );
    }
    if (status === 'connected') {
      return (
        <span
          role="status"
          className={`${baseChip} bg-[#4F46E5] text-white`}
        >
          <Check className="w-3 h-3" />
          <span>{statusLabel || 'Active'}</span>
        </span>
      );
    }
    return null;
  };

  const radiusClasses = `${isFirst ? 'rounded-t-xl' : ''} ${isLast ? 'rounded-b-xl' : ''}`;

  const handleRowSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    triggerRipple(e);
    if (!isConnected && onConnect && !disconnectedActions) {
      onConnect();
    }
  };

  return (
    <motion.div
      id={id}
      layout="position"
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={
        shouldTint
          ? { borderLeftWidth: 3, borderLeftColor: brandColor }
          : undefined
      }
      className={`relative transition-colors ${menuOpen ? 'z-50' : 'z-0'} ${radiusClasses} ${
        shouldTint
          ? 'bg-[#E8E7FF]/45 dark:bg-indigo-950/25'
          : 'bg-white dark:bg-zinc-900 hover:bg-slate-50/75 dark:hover:bg-zinc-800/40'
      }`}
    >
      {/* Main Compact Row Surface */}
      <div
        ref={rowRef}
        onClick={handleRowSurfaceClick}
        className={`relative px-4 transition-colors ${
          isConnected
            ? 'min-h-[80px] py-2.5'
            : prominent
              ? 'min-h-[76px] py-2.5'
              : 'min-h-[64px] py-2'
        } flex items-center gap-3 ${
          !isConnected && onConnect && !disconnectedActions ? 'cursor-pointer' : ''
        }`}
      >
        {/* Subtle Material touch ripple clipped cleanly inside row surface */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 overflow-hidden ${radiusClasses}`}
        >
          {ripple && (
            <motion.span
              key={ripple.key}
              initial={{ opacity: 0.22, scale: 0 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                left: ripple.x - 48,
                top: ripple.y - 48,
                width: 96,
                height: 96,
              }}
              className="absolute rounded-full bg-indigo-500/25 dark:bg-indigo-400/25"
            />
          )}
        </span>

        {/* 32×32dp Logo Badge */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative z-10 ${logoBgClass}`}
        >
          {logo}
        </div>

        {/* Center Info Column */}
        {!isConnected ? (
          <div className="min-w-0 flex-1 relative z-10">
            <div className="flex items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[14px] font-medium leading-tight text-slate-900 dark:text-zinc-100 truncate">
                    {name}
                  </span>
                  {badge}
                </div>
                <p className="text-[12px] leading-snug text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                  {description}
                </p>
                {extraLine && (
                  <p className="text-[11.5px] leading-snug text-slate-500 dark:text-zinc-400 truncate mt-0.5 tabular-nums">
                    {extraLine}
                  </p>
                )}
              </div>

              {/* Right CTA (Disconnected) */}
              {!disconnectedActions && onConnect && (
                <div className="shrink-0 relative z-10">
                  {connectVariant === 'chevron' ? (
                    <button
                      type="button"
                      id={connectButtonId}
                      disabled={connectDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnect();
                      }}
                      aria-label={`Connect ${name}`}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      id={connectButtonId}
                      disabled={connectDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnect();
                      }}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-55 text-[12px] font-medium text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                    >
                      <span>{connectLabel}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Custom compact disconnected actions row (e.g., JivanOS Cloud Start Free Trial + Sign In) */}
            {disconnectedActions && (
              <div
                className="flex items-center gap-2 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                {disconnectedActions}
              </div>
            )}
          </div>
        ) : (
          /* CONNECTED STATE (~80dp compact layout) */
          <div className="min-w-0 flex-1 relative z-10 space-y-1">
            {/* Top row: Provider Name + Status Chip */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[14px] font-medium leading-tight text-slate-900 dark:text-zinc-100 truncate">
                  {name}
                </span>
                {badge}
              </div>
              {renderStatusChip()}
            </div>

            {/* Bottom row: Account + Last Synced on left, [Sync] [···] 32dp icon buttons on right */}
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0 flex-1">
                {accountLabel && (
                  <div className="text-[12px] leading-snug text-slate-700 dark:text-zinc-300 truncate">
                    {accountLabel}
                  </div>
                )}
                {metaLine && (
                  <div className="text-[11.5px] leading-snug text-slate-500 dark:text-zinc-400 truncate tabular-nums">
                    {metaLine}
                  </div>
                )}
              </div>

              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {onSyncNow && (
                  <button
                    type="button"
                    id={syncButtonId}
                    onClick={onSyncNow}
                    disabled={isSyncing}
                    title={`Sync ${name} now`}
                    aria-label={`Sync ${name} now`}
                    className="w-8 h-8 rounded-lg bg-white/85 dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-zinc-200 disabled:opacity-55 inline-flex items-center justify-center transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}

                {hasMenu && (
                  <div ref={menuRef} className="relative z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen((prev) => {
                          const next = !prev;
                          if (next) {
                            window.dispatchEvent(
                              new CustomEvent('jivanos:sync-row-menu-open', {
                                detail: { source: menuRef.current },
                              })
                            );
                          }
                          return next;
                        });
                      }}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label={`More options for ${name}`}
                      title="More options"
                      className="w-8 h-8 rounded-lg bg-white/85 dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 inline-flex items-center justify-center transition cursor-pointer"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {menuOpen && (
                        <motion.div
                          role="menu"
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.14 }}
                          className="absolute right-0 top-9 z-[100] w-56 rounded-xl border border-[#E5E7EB] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1.5"
                        >
                          {/* Extra custom menu items */}
                          {extraMenuItems.map((item) =>
                            item.href ? (
                              <a
                                key={item.id}
                                role="menuitem"
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setMenuOpen(false)}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition"
                              >
                                {item.icon}
                                <span className="truncate flex-1">{item.label}</span>
                              </a>
                            ) : (
                              <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuOpen(false);
                                  item.onClick();
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer ${
                                  item.danger
                                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {item.icon}
                                  <span className="truncate">{item.label}</span>
                                </span>
                                {item.sublabel && (
                                  <span className="text-[10.5px] font-semibold text-slate-400 dark:text-zinc-500 shrink-0">
                                    {item.sublabel}
                                  </span>
                                )}
                              </button>
                            )
                          )}

                          {/* Optional Restore from Cloud */}
                          {onRestore && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                onRestore();
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
                            >
                              <CloudDownload className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                              <span>Restore from cloud</span>
                            </button>
                          )}

                          {/* Red Disconnect Action */}
                          {onDisconnect && (
                            <div
                              className={
                                onRestore || extraMenuItems.length > 0
                                  ? 'mt-1 pt-1 border-t border-slate-100 dark:border-zinc-800'
                                  : ''
                              }
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuOpen(false);
                                  onDisconnect();
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition cursor-pointer"
                              >
                                <LogOut className="w-3.5 h-3.5 shrink-0" />
                                <span>{disconnectLabel}</span>
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact inline error banner if present */}
      {errorMessage && (
        <div className="px-4 pb-2.5">
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/70 px-3 py-1.5 text-[11.5px] text-rose-700 dark:text-rose-300 leading-snug">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Smoothly expandable inline panel (WebDAV form, MEGA login/resume, S3 form, JivanOS Cloud verify/expired/history) */}
      <AnimatePresence initial={false}>
        {isExpanded && expandedContent && (
          <motion.div
            key="expanded-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 pt-0.5">{expandedContent}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
