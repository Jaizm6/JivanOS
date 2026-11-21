import React from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { formatRelativeSyncTime } from '../../utils/googleDriveSync';

export type SyncCardStatus = 'disconnected' | 'connected' | 'syncing' | 'synced' | 'error';

export interface SyncProviderCardProps {
  /** Provider display name */
  name: string;
  /** Short one-line description shown below the title */
  description: string;
  /** Optional subtitle badge (e.g. "Premium · ₹99/month") */
  metaBadge?: string;
  /** Provider logo / icon element */
  logo: React.ReactNode;
  /** Brand color hex used for the 3px left border when connected */
  brandColor: string;
  /** Real connection state — NEVER show connected UI when false */
  isConnected: boolean;
  /** Current sync state */
  status: SyncCardStatus;
  /** Connected user name / email / handle */
  accountLabel?: string;
  /** Secondary account detail (e.g. email or server host) */
  accountSublabel?: string;
  /** Real ISO timestamp from storage, or null if never synced */
  lastSyncedAt?: string | null;
  /** Optional error text shown below header */
  errorMessage?: string | null;
  /** Label for disconnected primary CTA ("Connect" or "Sign In") */
  connectLabel?: string;
  /** Disconnected primary action handler */
  onConnect?: () => void;
  /** Connected "Sync Now" handler */
  onSyncNow?: () => void;
  /** Connected "Disconnect" handler */
  onDisconnect?: () => void;
  /** Error chip retry handler */
  onRetry?: () => void;
  /** Optional expandable/custom body (e.g., WebDAV/S3 form or Restore action) */
  children?: React.ReactNode;
  /** Optional footer actions when connected (e.g. Restore button) */
  extraActions?: React.ReactNode;
  /** Disable actions while busy */
  busy?: boolean;
}

export const SyncProviderCard: React.FC<SyncProviderCardProps> = ({
  name,
  description,
  metaBadge,
  logo,
  brandColor,
  isConnected,
  status,
  accountLabel,
  accountSublabel,
  lastSyncedAt,
  errorMessage,
  connectLabel = 'Connect',
  onConnect,
  onSyncNow,
  onDisconnect,
  onRetry,
  children,
  extraActions,
  busy = false,
}) => {
  const isSyncing = status === 'syncing';
  const isError = status === 'error';
  const isSynced = isConnected && status === 'synced' && Boolean(lastSyncedAt);

  const renderStatusChip = () => {
    if (!isConnected && !isError) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 shrink-0">
          Not connected
        </span>
      );
    }

    if (isSyncing) {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white animate-pulse shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing…</span>
        </span>
      );
    }

    if (isError) {
      return (
        <button
          type="button"
          onClick={onRetry || onSyncNow}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shrink-0"
          title="Tap to retry"
        >
          <X className="w-3.5 h-3.5" />
          <span>Error ✗</span>
        </button>
      );
    }

    if (isSynced) {
      return (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Synced ✓</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 shrink-0">
        Connected
      </span>
    );
  };

  return (
    <article
      style={isConnected ? { borderLeftWidth: 3, borderLeftColor: brandColor } : undefined}
      className="rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3.5 w-full min-w-0 transition-colors"
    >
      {/* Header Row: Logo + Title + Status Chip */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            {logo}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
                {name}
              </h3>
              {metaBadge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  {metaBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {renderStatusChip()}
      </div>

      {/* Connected Account & Sync Info */}
      {isConnected && (
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-[#E5E7EB] dark:border-zinc-800 p-3 flex flex-col gap-2.5">
          <div className="min-w-0 space-y-0.5">
            {accountLabel && (
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 break-words">
                {accountLabel}
              </div>
            )}
            {accountSublabel && (
              <div className="text-xs text-slate-600 dark:text-zinc-400 break-all">
                {accountSublabel}
              </div>
            )}
            <div className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
              {lastSyncedAt
                ? `Last synced ${formatRelativeSyncTime(lastSyncedAt)}`
                : 'Never synced'}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-200/70 dark:border-zinc-800">
            <div className="flex items-center gap-2 flex-wrap">
              {onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={busy || isSyncing}
                  aria-label={`Sync ${name} now`}
                  className="min-h-[48px] px-4 py-2 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-xs font-semibold transition inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
                </button>
              )}
              {extraActions}
            </div>

            {onDisconnect && (
              <button
                type="button"
                onClick={onDisconnect}
                disabled={busy || isSyncing}
                className="min-h-[48px] px-3 py-2 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}

      {/* Disconnected CTA (single FilledButton) */}
      {!isConnected && onConnect && (
        <div>
          <button
            type="button"
            onClick={onConnect}
            disabled={busy || isSyncing}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold transition inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{connectLabel}</span>
          </button>
        </div>
      )}

      {/* Error feedback banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
          {errorMessage}
        </div>
      )}

      {/* Optional inline form / configuration body */}
      {children}
    </article>
  );
};
