import { describe, it, expect } from 'vitest';
import { normalizeHost, isFormPath } from '@/lib/routing/form-host';

describe('normalizeHost', () => {
  it('strips the port and lowercases', () => {
    expect(normalizeHost('Apply.Example.COM:3000')).toBe('apply.example.com');
  });
  it('handles null/undefined', () => {
    expect(normalizeHost(null)).toBe('');
    expect(normalizeHost(undefined)).toBe('');
  });
});

describe('isFormPath', () => {
  it('allows the public form pages', () => {
    expect(isFormPath('/apply')).toBe(true);
    expect(isFormPath('/thank-you')).toBe(true);
  });
  it('allows the per-consultancy /{slug}/apply route', () => {
    expect(isFormPath('/ien/apply')).toBe(true);
    expect(isFormPath('/acme-study/apply')).toBe(true);
    expect(isFormPath('/ien/apply/anything')).toBe(true);
  });
  it('does not treat a bare slug or a non-apply subpath as a form path', () => {
    expect(isFormPath('/ien')).toBe(false);
    expect(isFormPath('/ien/dashboard')).toBe(false);
    expect(isFormPath('/Ien/apply')).toBe(false); // slugs are lowercase-only
  });
  it('does NOT allow the marketing root (it redirects to /apply on the form host)', () => {
    expect(isFormPath('/')).toBe(false);
  });
  it('blocks every CRM path', () => {
    for (const p of ['/login', '/dashboard', '/leads', '/leads/123', '/agents', '/templates', '/super', '/api/health']) {
      expect(isFormPath(p)).toBe(false);
    }
  });
  it('root does not over-match other paths', () => {
    expect(isFormPath('/dashboard')).toBe(false);
    expect(isFormPath('/apply-now')).toBe(false); // not a subpath of /apply
  });
});
