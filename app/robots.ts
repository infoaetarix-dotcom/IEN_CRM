import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Only the platform marketing page ("/") is public. Everything else is
 * tenant CRM chrome or auth flow — not meant to be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/leads',
        '/agents',
        '/templates',
        '/super',
        '/login',
        '/apply',
        '/change-password',
        '/update-password',
        '/api',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
