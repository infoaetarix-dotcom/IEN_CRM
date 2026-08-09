/**
 * Remembers which org's portal this browser last signed into, purely so the
 * shared /login page — which runs before any session exists — can show that
 * org's theme and logo instead of the generic default. Never used for access
 * control: it's just a slug, looked up through the same public-brand-fields
 * lookup the application form already uses (see getPublicOrgBrand). Set in
 * lib/auth/actions.ts on successful sign-in; read wherever a pre-auth page
 * wants to guess the org.
 */
export const LAST_ORG_COOKIE = 'last_org';
