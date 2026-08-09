import { describe, it, expect } from 'vitest';
import { formDomainDecision, portalDomainDecision } from '@/lib/routing/domain-routing';

describe('formDomainDecision', () => {
  it('allows the org\'s own /{slug}/apply path', () => {
    expect(formDomainDecision('ien', '/ien/apply')).toEqual({ action: 'allow' });
    expect(formDomainDecision('ien', '/ien/apply/step-2')).toEqual({ action: 'allow' });
  });

  it('allows /thank-you', () => {
    expect(formDomainDecision('ien', '/thank-you')).toEqual({ action: 'allow' });
  });

  it('redirects a bare /apply to the org\'s own apply path', () => {
    expect(formDomainDecision('ien', '/apply')).toEqual({
      action: 'redirect',
      to: '/ien/apply',
    });
  });

  it('redirects a *different* org\'s slug to this domain\'s own org', () => {
    expect(formDomainDecision('ien', '/other-org/apply')).toEqual({
      action: 'redirect',
      to: '/ien/apply',
    });
  });

  it('redirects the marketing root, login, dashboard, and /super — no CRM or console reachable here', () => {
    for (const p of ['/', '/login', '/dashboard', '/leads', '/super']) {
      expect(formDomainDecision('ien', p)).toEqual({ action: 'redirect', to: '/ien/apply' });
    }
  });
});

describe('portalDomainDecision', () => {
  const orgId = 'org-a';
  const appUrl = 'https://app.aetarix.com';

  it('redirects /super to /login even before checking auth', () => {
    expect(
      portalDomainDecision({ orgId, pathname: '/super', user: null, appUrl }),
    ).toEqual({ action: 'redirect', to: '/login' });
  });

  it('redirects the marketing root to /login', () => {
    expect(
      portalDomainDecision({ orgId, pathname: '/', user: null, appUrl }),
    ).toEqual({ action: 'redirect', to: '/login' });
  });

  it('allows normal CRM paths when unauthenticated (existing isProtected logic handles the bounce)', () => {
    expect(
      portalDomainDecision({ orgId, pathname: '/dashboard', user: null, appUrl }),
    ).toEqual({ action: 'allow' });
    expect(
      portalDomainDecision({ orgId, pathname: '/login', user: null, appUrl }),
    ).toEqual({ action: 'allow' });
  });

  it('allows a signed-in user whose org matches this portal domain', () => {
    expect(
      portalDomainDecision({
        orgId,
        pathname: '/dashboard',
        user: { organizationId: orgId, isSuperAdmin: false },
        appUrl,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('signs out and bounces a different org\'s staff to the base app domain', () => {
    expect(
      portalDomainDecision({
        orgId,
        pathname: '/dashboard',
        user: { organizationId: 'org-b', isSuperAdmin: false },
        appUrl,
      }),
    ).toEqual({
      action: 'redirect',
      to: 'https://app.aetarix.com/login',
      absolute: true,
      signOut: true,
    });
  });

  it('signs out and bounces a super admin — the platform console never lives on a tenant domain', () => {
    expect(
      portalDomainDecision({
        orgId,
        pathname: '/dashboard',
        user: { organizationId: null, isSuperAdmin: true },
        appUrl,
      }),
    ).toEqual({
      action: 'redirect',
      to: 'https://app.aetarix.com/login',
      absolute: true,
      signOut: true,
    });
  });

  it('falls back to a relative same-domain redirect when NEXT_PUBLIC_APP_URL is unset', () => {
    expect(
      portalDomainDecision({
        orgId,
        pathname: '/dashboard',
        user: { organizationId: 'org-b', isSuperAdmin: false },
        appUrl: '',
      }),
    ).toEqual({ action: 'redirect', to: '/login', signOut: true });
  });
});
