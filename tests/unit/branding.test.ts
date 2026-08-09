import { describe, it, expect } from 'vitest';
import {
  initialsFrom,
  brandFromOrg,
  FALLBACK_BRAND,
} from '@/lib/branding';

describe('initialsFrom', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFrom('International Education Network')).toBe('IE');
    expect(initialsFrom('Bright Future Consultants')).toBe('BF');
  });

  it('takes two letters from a single word', () => {
    expect(initialsFrom('IEN')).toBe('IE');
    expect(initialsFrom('acme')).toBe('AC');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(initialsFrom('  global   study  ')).toBe('GS');
  });

  it('falls back for an empty name', () => {
    expect(initialsFrom('')).toBe(FALLBACK_BRAND.initials);
    expect(initialsFrom('   ')).toBe(FALLBACK_BRAND.initials);
  });
});

describe('brandFromOrg', () => {
  it('maps a fully populated org row', () => {
    const b = brandFromOrg({
      name: 'IEN',
      legal_name: 'International Education Network',
      logo_url: 'https://cdn.example.com/ien.png',
      theme_key: 'classic-editorial',
    });
    expect(b).toEqual({
      name: 'IEN',
      legalName: 'International Education Network',
      logoUrl: 'https://cdn.example.com/ien.png',
      initials: 'IE',
      themeKey: 'classic-editorial',
    });
  });

  it('falls back to the default theme when theme_key is missing/blank', () => {
    expect(brandFromOrg({ name: 'Acme' }).themeKey).toBe(FALLBACK_BRAND.themeKey);
    expect(brandFromOrg({ name: 'Acme', theme_key: '  ' }).themeKey).toBe(
      FALLBACK_BRAND.themeKey,
    );
  });

  it('falls back to name when legal_name is missing', () => {
    const b = brandFromOrg({ name: 'Acme Study', legal_name: null });
    expect(b.legalName).toBe('Acme Study');
  });

  it('treats blank/absent logo as no logo (monogram is rendered instead)', () => {
    expect(brandFromOrg({ name: 'Acme', logo_url: '   ' }).logoUrl).toBeNull();
    expect(brandFromOrg({ name: 'Acme' }).logoUrl).toBeNull();
  });

  it('never returns an empty name — a tenant surface always has something to show', () => {
    const b = brandFromOrg({ name: null });
    expect(b.name).toBe(FALLBACK_BRAND.name);
    // Monogram is derived from the fallback name, so it stays renderable.
    expect(b.initials).toBe('CR');
    expect(b.logoUrl).toBeNull();
  });
});
