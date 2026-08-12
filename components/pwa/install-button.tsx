'use client';

import { useEffect, useState } from 'react';
import { Download, Check, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Download Now" CTA for installing this site as a PWA. Chrome/Edge/Android
 * fire `beforeinstallprompt` once they've decided the page is installable —
 * capturing it lets a real button trigger the native install dialog instead
 * of visitors having to notice the small address-bar icon themselves.
 *
 * Safari (iOS/macOS) and Firefox never fire that event — there's no
 * programmatic install trigger on those browsers at all — so the button
 * falls back to a one-line instruction instead of silently doing nothing.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [hint, setHint] = useState<'ios' | 'unsupported' | null>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setHint(isIos ? 'ios' : 'unsupported');
  }

  if (installed) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-md bg-white/10 px-6 py-3 text-sm font-semibold text-marketing-offwhite',
          className,
        )}
      >
        <Check className="h-4 w-4 text-marketing-cyan" aria-hidden="true" />
        App installed
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-marketing-navy shadow-sm transition hover:bg-marketing-offwhite sm:text-base',
          className,
        )}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download Now
      </button>
      {hint === 'ios' && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-marketing-offwhite/70">
          <Share className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          On iPhone/iPad: tap the Share icon in Safari, then &ldquo;Add to Home
          Screen&rdquo;.
        </p>
      )}
      {hint === 'unsupported' && (
        <p className="mt-3 text-sm text-marketing-offwhite/70">
          Open this page in Chrome or Edge to install it as an app.
        </p>
      )}
    </div>
  );
}
