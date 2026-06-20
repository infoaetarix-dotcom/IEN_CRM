'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget. Renders the challenge and writes the token into
 * a hidden input named `cf-turnstile-response`, which the server action reads
 * and verifies. If no site key is configured, renders nothing (dev fallback —
 * the server verifier allows missing tokens only in development).
 */

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

export function Turnstile({
  onVerify,
}: {
  onVerify?: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;

    const render = () => {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // render once
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onVerify?.(''),
        'error-callback': () => onVerify?.(''),
      });
    };

    // If the script is already present/loaded, render immediately.
    if (window.turnstile) {
      render();
      return;
    }

    window.onTurnstileLoad = render;

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [siteKey, onVerify]);

  if (!siteKey) {
    return (
      <p className="text-xs text-muted-foreground">
        Bot protection is not configured in this environment.
      </p>
    );
  }

  return <div ref={containerRef} className="min-h-[65px]" />;
}
