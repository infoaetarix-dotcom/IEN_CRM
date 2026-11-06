'use client';

import { useEffect, useState } from 'react';
import { AETARIX, initialsFrom } from '@/lib/branding';

export interface SplashBrand {
  name: string;
  logoUrl: string | null;
  /** Background (the theme's navy). */
  bg: string;
  /** Loading bar / glow (the theme's accent). */
  accent: string;
}

// Long enough for the logo to finish popping in, short enough not to nag.
const MIN_SHOW_MS = 900;
const FADE_MS = 400;

/**
 * The opening screen of the CRM / installed app: the consultancy's own
 * logo on its brand colour, scaling in with a soft glow, its name and a
 * slim loading bar. Server-rendered inside the admin layout, so it paints
 * with the very first HTML and covers the page while React starts up;
 * then it fades away. The layout persists across in-app navigation, so
 * this only plays when the app is opened or reloaded.
 *
 * (Not a Suspense/loading.tsx fallback: on Next 15 a boundary above the
 * shell stalled client navigations, and one around pages reappears on
 * every filter change.) If JavaScript never runs, CSS hides it anyway.
 */
export function AppSplash({ brand }: { brand: SplashBrand }) {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');

  useEffect(() => {
    const fade = setTimeout(() => setPhase('fade'), MIN_SHOW_MS);
    const gone = setTimeout(() => setPhase('gone'), MIN_SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      role="status"
      aria-label={`Loading ${brand.name}`}
      data-phase={phase}
      className="app-splash fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: brand.bg, ['--splash-accent' as string]: brand.accent }}
    >
      {/* Soft brand-coloured glow behind the logo */}
      <div aria-hidden className="app-splash-glow absolute h-[420px] w-[420px] rounded-full" />

      <div className="app-splash-logo relative flex flex-col items-center">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] bg-white p-3 shadow-2xl sm:h-32 sm:w-32">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="font-display text-4xl font-bold" style={{ color: brand.bg }}>
              {initialsFrom(brand.name)}
            </span>
          )}
        </div>
        <p className="app-splash-name mt-6 max-w-[80vw] text-center font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {brand.name}
        </p>
      </div>

      <div aria-hidden className="app-splash-bar mt-8 h-1 w-40 overflow-hidden rounded-full bg-white/15">
        <div className="app-splash-bar-fill h-full w-1/3 rounded-full" />
      </div>

      <p className="app-splash-name absolute bottom-8 text-[11px] uppercase tracking-[0.2em] text-white/40">
        Powered by {AETARIX.name}
      </p>
    </div>
  );
}
