import type { MetadataRoute } from 'next';
import { resolveVisitorBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';

/**
 * Installable-app manifest, served at /manifest.webmanifest. Branded per
 * visitor the same way the login page is: a consultancy's own
 * form_domain/portal_domain resolves via middleware's x-tenant-slug header,
 * otherwise the "last org" cookie from a previous sign-in — so a staff
 * member installing this sees their own consultancy's name/colors, not
 * Aetarix's, on their home screen. Falls back to the Aetarix default when
 * neither is available (e.g. a first-ever visit on the base domain).
 *
 * Icon is the one static Aetarix mark for now — a tenant's uploaded logo can
 * be any aspect ratio, and using it as an app icon without proper square
 * cropping/maskable padding would look broken on real home screens. Revisit
 * if per-tenant icons are ever worth the image-processing work.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await resolveVisitorBrand();
  const theme = resolveTheme(brand?.themeKey);

  return {
    id: '/',
    name: brand ? `${brand.legalName} CRM` : 'Aetarix CRM',
    short_name: brand?.name ?? 'Aetarix CRM',
    description: brand
      ? `Manage leads and applications for ${brand.name}.`
      : 'Study-abroad consultancy CRM.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: theme.tokens.offwhite,
    theme_color: theme.tokens.navy,
    icons: [
      { src: '/icon-512.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
