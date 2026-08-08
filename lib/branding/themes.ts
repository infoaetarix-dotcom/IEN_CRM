/**
 * Curated color themes for tenant-facing surfaces (admin panel, login,
 * forgot/change/update password). A consultancy picks one in /super; the app
 * falls back to 'aetarix-default' for anything unset or unrecognized.
 *
 * Adding a theme here is not enough by itself — also extend the
 * `organizations_theme_key_check` constraint in a new migration (see
 * 0016_org_theme.sql) so the database accepts the new key.
 *
 * Client-safe: no DB, no `server-only` — this is pure data.
 */

export type ThemeKey = 'aetarix-default' | 'classic-editorial';

export interface ThemeTokens {
  /** Deep dark chrome background — sidebar, hero, auth-page backdrop. */
  navy: string;
  /** Primary brand/action color — buttons, active nav state, links. */
  accent: string;
  /** Secondary accent — small tags, a second highlight color. */
  accent2: string;
  /** Light page background. */
  offwhite: string;
  /** Secondary light background (cards-on-a-section, subtle fills). */
  gray: string;
  /** Body text / borders on light surfaces. */
  ink: string;
  /** Which already-loaded display font this theme's headings use. */
  fontDisplay: 'playfair' | 'source-serif';
}

export interface Theme {
  key: ThemeKey;
  label: string;
  tokens: ThemeTokens;
}

export const DEFAULT_THEME_KEY: ThemeKey = 'aetarix-default';

export const THEMES: Record<ThemeKey, Theme> = {
  'aetarix-default': {
    key: 'aetarix-default',
    label: 'Aetarix (default) — Navy & Blue',
    tokens: {
      navy: '#0B1220',
      accent: '#2563EB',
      accent2: '#06B6D4',
      offwhite: '#F8F7F3',
      gray: '#F3F5F8',
      ink: '#111827',
      fontDisplay: 'playfair',
    },
  },
  'classic-editorial': {
    key: 'classic-editorial',
    label: 'Classic Editorial — Navy & Gold',
    tokens: {
      navy: '#0A1A2F',
      accent: '#C8872E',
      accent2: '#C8872E',
      offwhite: '#F5F1E8',
      gray: '#F2EBDD',
      ink: '#0B1F33',
      fontDisplay: 'source-serif',
    },
  },
};

export const THEME_LIST: Theme[] = Object.values(THEMES);

export function resolveTheme(key: string | null | undefined): Theme {
  return (key && THEMES[key as ThemeKey]) || THEMES[DEFAULT_THEME_KEY];
}
