import type { CSSProperties } from 'react';
import type { ThemeTokens } from './themes';

/** "#2563EB" -> "37 99 235", for the rgb(var(--x) / <alpha-value>) pattern. */
function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Inline CSS custom properties for a theme, meant to be spread onto the
 * `style` prop of a page's root element — e.g.
 * `<div style={themeStyleVars(theme.tokens)}>`. Server-rendered, so there's
 * no flash of the wrong theme.
 */
export function themeStyleVars(tokens: ThemeTokens): CSSProperties {
  return {
    '--tenant-navy': hexToRgbTriplet(tokens.navy),
    '--tenant-accent': hexToRgbTriplet(tokens.accent),
    '--tenant-accent2': hexToRgbTriplet(tokens.accent2),
    '--tenant-offwhite': hexToRgbTriplet(tokens.offwhite),
    '--tenant-gray': hexToRgbTriplet(tokens.gray),
    '--tenant-ink': hexToRgbTriplet(tokens.ink),
    '--tenant-font-display':
      tokens.fontDisplay === 'source-serif' ? 'var(--font-serif)' : 'var(--font-display)',
  } as CSSProperties;
}
