'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget. Renders the challenge and writes the token into
 * a hidden input named `cf-turnstile-response`, which the server action reads
 * and verifies. If no site key is configured, renders nothing (dev fallback —
 * the server verifier allows missing tokens only in development).
 */

export interface TurnstileHandle {
  /**
   * Request a fresh token. Turnstile tokens are single-use — Cloudflare
   * rejects a token on its second verify attempt, success or not. The
   * server checks Turnstile before anything else, so even a submission that
   * failed for an unrelated reason (a missing field) already consumed the
   * token. Call this after any failed submission so a retry isn't silently
   * doomed to fail the bot check on a token that's already spent.
   */
  reset: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
// How long to wait for the Cloudflare script/widget before offering a manual
// retry — a stuck spinner with no way out is what actually frustrates
// applicants, not a slow network on its own.
const STALL_TIMEOUT_MS = 8000;

export const Turnstile = forwardRef<TurnstileHandle, { onVerify?: (token: string) => void }>(
  function Turnstile({ onVerify }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [stalled, setStalled] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }), []);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    setStalled(false);

    const stallTimer = setTimeout(() => {
      if (!cancelled) setStalled(true);
    }, STALL_TIMEOUT_MS);

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      clearTimeout(stallTimer);
      if (widgetIdRef.current) {
        // Already rendered once — a manual retry re-runs the challenge in
        // place instead of forcing a full page reload.
        window.turnstile.reset(widgetIdRef.current);
        setStalled(false);
        return;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => {
          setStalled(false);
          onVerify?.(token);
        },
        'expired-callback': () => {
          onVerify?.('');
          // Silently re-challenge — an expired token shouldn't force the
          // applicant to notice or act.
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
        'error-callback': () => {
          onVerify?.('');
          setStalled(true);
        },
      });
    };

    if (window.turnstile) {
      render();
    } else {
      window.onTurnstileLoad = render;
      // A manual retry removes any previous (possibly failed) script tag
      // first, so it's a genuine fresh network attempt rather than a no-op
      // against a tag that already failed to load.
      document.querySelector('script[data-turnstile-loader]')?.remove();
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileLoader = 'true';
      script.onerror = () => {
        if (!cancelled) setStalled(true);
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
    };
  }, [siteKey, onVerify, retryTick]);

  if (!siteKey) {
    return (
      <p className="text-xs text-muted-foreground">
        Bot protection is not configured in this environment.
      </p>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" />
      {stalled && (
        <button
          type="button"
          onClick={() => {
            setStalled(false);
            if (window.turnstile && widgetIdRef.current) {
              window.turnstile.reset(widgetIdRef.current);
            } else {
              // The script itself never loaded — re-run the effect to try
              // loading it again, still without a full page reload.
              setRetryTick((n) => n + 1);
            }
          }}
          className="mt-1.5 text-xs font-medium text-tenant-accent underline underline-offset-2"
        >
          Verification is taking longer than expected — tap to retry
        </button>
      )}
    </div>
  );
  },
);
