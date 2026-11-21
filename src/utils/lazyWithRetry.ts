import React, { lazy } from 'react';

const CHUNK_RELOAD_GUARD_KEY = 'jivanos_lazy_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15000;

function isDynamicImportFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk')
  );
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 3,
  baseInterval = 400
): React.LazyExoticComponent<T> {
  return lazy(() => {
    const attempt = (remaining: number, attemptIndex: number): Promise<{ default: T }> =>
      importer().catch(err => {
        if (remaining > 0) {
          const delay = baseInterval * Math.pow(2, attemptIndex);
          return new Promise<{ default: T }>(resolve =>
            setTimeout(() => resolve(attempt(remaining - 1, attemptIndex + 1)), delay)
          );
        }

        // If a stale Vite chunk / dev-server restart caused a dynamic import failure,
        // perform a single guarded reload so fresh module URLs load cleanly.
        if (isDynamicImportFetchError(err) && typeof window !== 'undefined') {
          try {
            const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || '0');
            if (Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
              sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()));
              window.location.reload();
              return new Promise<{ default: T }>(() => {});
            }
          } catch {
            // Fall through to throw original error
          }
        }

        throw err;
      });

    return attempt(retries, 0);
  });
}
