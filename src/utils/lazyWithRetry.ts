import React, { lazy } from 'react';

export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 3,
  interval = 350
): React.LazyExoticComponent<T> {
  return lazy(() => {
    const attempt = (remaining: number): Promise<{ default: T }> =>
      importer().catch(err => {
        if (remaining <= 0) throw err;
        return new Promise<{ default: T }>(resolve =>
          setTimeout(() => resolve(attempt(remaining - 1)), interval)
        );
      });
    return attempt(retries);
  });
}
