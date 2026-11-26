import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  CloudDownload,
  HardDriveDownload,
  Loader2,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
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
  onBackupNow?: () => void;
  onOpenSyncOptions?: () => void;
  onOpenBackupOptions?: () => void;
  isActiveSyncProvider?: boolean;
  isBackupEnabled?: boolean;
  syncButtonId?: string;
  backupButtonId?: string;
  isSyncing?: boolean;
  isBackingUp?: boolean;
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

export const SyncProviderRow: React.FC<SyncProviderRowProps> = ({
  id,
  name,
  description,
  logo,
  logoBgClass = 'bg-slate-100 dark:bg-zinc-800',
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
  onBackupNow,
  onOpenSyncOptions,
  onOpenBackupOptions,
  isActiveSyncProvider = false,
  isBackupEnabled = false,
  syncButtonId,
  backupButtonId,
  isSyncing = false,
  isBackingUp = false,
  onRetry,
  onRestore,
  onDisconnect,
  disconnectLabel = 'Disconnect',
  extraMenuItems = [],
  errorMessage,
  expandedContent,
  isExpanded = false,
  highlightTint,
  isFirst = false,
  isLast = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const shouldTint = highlightTint ?? isConnected;
  const hasMenu = Boolean(
    onRestore ||
      onDisconnect ||
      onOpenSyncOptions ||
      onOpenBackupOptions ||
      extraMenuItems.length > 0
  );
  const cleanConnectLabel = connectLabel.replace(/\s*→$/, '');
  const hasActionButtons = Boolean(
    onSyncNow || onOpenSyncOptions || onBackupNow || onOpenBackupOptions
  );

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

  const renderStatusText = () => {
    if (status === 'syncing') {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0"
        >
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
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
          title="Tap to retry"
        >
          <X className="w-3.5 h-3.5" />
          <span>{statusLabel || 'Retry'}</span>
        </button>
      );
    }
    if (status === 'trial') {
      return (
        <span
          role="status"
          className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0"
        >
          {statusLabel || 'Trial'}
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span
          role="status"
          className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0"
        >
          {statusLabel || 'Expired'}
        </span>
      );
    }
    if (status === 'synced' || status === 'connected') {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{statusLabel || 'Connected'}</span>
        </span>
      );
    }
    return null;
  };

  const radiusClasses = `${isFirst ? 'rounded-t-2xl' : ''} ${isLast ? 'rounded-b-2xl' : ''}`;

  const handleRowSurfaceClick = () => {
    if (!isConnected && onConnect && !disconnectedActions) {
      onConnect();
    }
  };

  const handleSyncButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSyncNow) {
      onSyncNow();
    } else if (onOpenSyncOptions) {
      onOpenSyncOptions();
    }
  };

  const handleBackupButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBackupNow) {
      onBackupNow();
    } else if (onOpenBackupOptions) {
      onOpenBackupOptions();
    }
  };

  const renderSyncBackupButtons = (idPrefix: string) => (
    <>
      {(onSyncNow || onOpenSyncOptions) && (
        <button
          type="button"
          id={syncButtonId ? `${syncButtonId}${idPrefix}` : undefined}
          disabled={isSyncing}
          onClick={handleSyncButtonClick}
          title={`Sync ${name} now`}
          className={`h-7.5 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-60 ${
            isActiveSyncProvider
              ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/60'
              : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
          />
          <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
        </button>
      )}

      {(onBackupNow || onOpenBackupOptions) && (
        <button
          type="button"
          id={backupButtonId ? `${backupButtonId}${idPrefix}` : undefined}
          disabled={isBackingUp}
          onClick={handleBackupButtonClick}
          title={`Back up to ${name} now`}
          className={`h-7.5 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-60 ${
            isBackupEnabled
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60'
              : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          {isBackingUp ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <HardDriveDownload className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{isBackingUp ? 'Backing up…' : 'Backup'}</span>
        </button>
      )}
    </>
  );

  return (
    <motion.div
      id={id}
      layout="position"
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`relative transition-colors ${menuOpen ? 'z-50' : 'z-0'} ${radiusClasses} ${
        shouldTint
          ? 'bg-indigo-50/40 dark:bg-indigo-950/15'
          : 'bg-white dark:bg-zinc-900 hover:bg-slate-50/70 dark:hover:bg-zinc-800/35'
      }`}
    >
      <div
        onClick={handleRowSurfaceClick}
        className={`px-4 py-3 ${
          !isConnected && onConnect && !disconnectedActions ? 'cursor-pointer' : ''
        }`}
      >
        {!isConnected ? (
          /* DISCONNECTED: Clean single-line row — [Logo] Name / desc   [Connect] */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${logoBgClass}`}
                >
                  {logo}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[14px] font-semibold leading-tight text-slate-900 dark:text-zinc-100 truncate">
                      {name}
                    </span>
                    {badge}
                  </div>
                  <p className="text-[12px] leading-snug text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {description}
                  </p>
                  {extraLine && (
                    <p className="text-[11.5px] leading-snug text-slate-400 dark:text-zinc-500 truncate mt-0.5 tabular-nums">
                      {extraLine}
                    </p>
                  )}
                </div>
              </div>

              {!disconnectedActions && onConnect && (
                <div className="shrink-0">
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
                      className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
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
                      className="min-h-[36px] px-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-55 text-[12.5px] font-semibold text-slate-800 dark:text-zinc-100 inline-flex items-center justify-center transition cursor-pointer whitespace-nowrap"
                    >
                      {cleanConnectLabel}
                    </button>
                  )}
                </div>
              )}
            </div>

            {disconnectedActions && (
              <div
                className="flex flex-wrap items-center gap-1.5 sm:pl-12"
                onClick={(e) => e.stopPropagation()}
              >
                {disconnectedActions}
              </div>
            )}
          </div>
        ) : (
          /* CONNECTED: Responsive layout that never truncates provider name on mobile */
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2.5">
              {/* Left: Provider Logo + Full Name + Badge + Account/Sync Meta */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${logoBgClass}`}
                >
                  {logo}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[14px] font-semibold leading-tight text-slate-900 dark:text-zinc-100 truncate">
                      {name}
                    </span>
                    {badge}
                  </div>
                  {(accountLabel || metaLine) && (
                    <div className="text-[11.5px] leading-snug text-slate-500 dark:text-zinc-400 truncate mt-0.5 tabular-nums">
                      {accountLabel && metaLine
                        ? `${accountLabel} · ${metaLine}`
                        : accountLabel || metaLine}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Desktop inline [Sync] & [Backup] + Status + [···] */}
              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Inline on sm+ screens where there is plenty of horizontal space */}
                {hasActionButtons && (
                  <div className="hidden sm:flex items-center gap-1.5 mr-1">
                    {renderSyncBackupButtons('')}
                  </div>
                )}

                {renderStatusText()}

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
                      className="w-8 h-8 rounded-lg hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 inline-flex items-center justify-center transition cursor-pointer"
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
                          className="absolute right-0 top-9 z-[100] w-56 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1.5"
                        >
                          {onOpenSyncOptions && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                onOpenSyncOptions();
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span>Sync rules…</span>
                            </button>
                          )}

                          {onOpenBackupOptions && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpen(false);
                                onOpenBackupOptions();
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition cursor-pointer"
                            >
                              <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Backup rules…</span>
                            </button>
                          )}

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

                          {onDisconnect && (
                            <div
                              className={
                                onRestore ||
                                onOpenSyncOptions ||
                                onOpenBackupOptions ||
                                extraMenuItems.length > 0
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

            {/* Mobile compact [Sync] & [Backup] buttons aligned cleanly under provider title (never squishing Name or stretching full-width) */}
            {hasActionButtons && (
              <div
                className="flex sm:hidden items-center gap-2 pl-12"
                onClick={(e) => e.stopPropagation()}
              >
                {renderSyncBackupButtons('-mobile')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline error banner if present */}
      {errorMessage && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/70 px-3 py-2 text-[11.5px] text-rose-700 dark:text-rose-300 leading-snug">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Expandable inline panel (WebDAV form, MEGA login/resume, S3 form, etc.) */}
      <AnimatePresence initial={false}>
        {isExpanded && expandedContent && (
          <motion.div
            key="expanded-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 pt-0.5">{expandedContent}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
