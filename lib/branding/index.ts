/**
 * Branding for a white-label CRM.
 *
 * Two brands coexist: the platform (Aetarix, static — it ships with the app)
 * and the tenant (each consultancy, from their `organizations` row). Every
 * tenant-facing surface must read the org's name/logo from here rather than
 * hardcoding one client, so consultancy #2 never sees consultancy #1's name.
 *
 * Client-safe: no DB, no `server-only`. Data fetching lives in `./org.ts`.
 */

/**
 * The platform brand. Assets ship with the app in /public — to swap in final
 * artwork, replace those files (keep the names) or point these at the new
 * ones.
 */
export const AETARIX = {
  name: 'Aetarix',
  wordmark: '/aetarixcopy.webp',
  // Square icon-only mark (512×512) — also used as app/icon.png, the site favicon.
  mark: '/icon-512.png',
  url: 'https://aetarix.com',
} as const;

export interface OrgBrand {
  /** Short label used in the UI chrome, e.g. "IEN". */
  name: string;
  /** Full public-facing name for consent text and emails. Falls back to name. */
  legalName: string;
  /** Uploaded logo, or null → callers render the initials monogram. */
  logoUrl: string | null;
  /** 1–2 letter fallback monogram derived from the name. */
  initials: string;
  /** Which color theme (lib/branding/themes.ts) this org's surfaces use. */
  themeKey: string;
}

/** Neutral brand used before a tenant is known (e.g. the shared login page). */
export const FALLBACK_BRAND: OrgBrand = {
  name: 'CRM',
  legalName: 'this consultancy',
  logoUrl: null,
  initials: 'C',
  themeKey: 'aetarix-default',
};

/**
 * Up to two initials from an organization name: "International Education
 * Network" → "IE"; "IEN" → "IE"; empty → "C".
 */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return FALLBACK_BRAND.initials;
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Build a brand from a raw organization row. */
export function brandFromOrg(org: {
  name: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  theme_key?: string | null;
}): OrgBrand {
  const name = org.name?.trim() || FALLBACK_BRAND.name;
  return {
    name,
    legalName: org.legal_name?.trim() || name,
    logoUrl: org.logo_url?.trim() || null,
    initials: initialsFrom(name),
    themeKey: org.theme_key?.trim() || FALLBACK_BRAND.themeKey,
  };
}
