'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (see public/sw.js). Production-only: a SW
 * registered under `next dev` can intercept requests in ways that fight
 * Fast Refresh, and there's no install/offline scenario worth testing there
 * that isn't better tested against a real production build.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Best-effort — a failed registration just means no install/offline
      // fallback this session, not a broken app.
    });
  }, []);

  return null;
}
