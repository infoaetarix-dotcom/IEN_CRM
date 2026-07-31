import { describe, it, expect } from 'vitest';
import { normalizeHost, isFormPath, formHostAction } from '@/lib/routing/form-host';

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
    expect(isFormPath('/')).toBe(true);
    expect(isFormPath('/apply')).toBe(true);
    expect(isFormPath('/thank-you')).toBe(true);
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

describe('formHostAction', () => {
  const FH = 'apply.ien.com';

  it('is a no-op when FORM_HOST is unset (single-domain today + local dev)', () => {
    expect(formHostAction('apply.ien.com', undefined, '/dashboard')).toBe('not-form-host');
    expect(formHostAction('apply.ien.com', '', '/dashboard')).toBe('not-form-host');
  });

  it('ignores requests arriving on the CRM host', () => {
    expect(formHostAction('app.ien.com', FH, '/dashboard')).toBe('not-form-host');
    expect(formHostAction('ien-crm.vercel.app', FH, '/login')).toBe('not-form-host');
  });

  it('allows the public form pages on the form host (case/port-insensitive)', () => {
    expect(formHostAction('apply.ien.com', FH, '/apply')).toBe('allow');
    expect(formHostAction('APPLY.IEN.COM:443', FH, '/thank-you')).toBe('allow');
    expect(formHostAction('apply.ien.com', FH, '/')).toBe('allow');
  });

  it('redirects any CRM path to /apply on the form host', () => {
    for (const p of ['/login', '/dashboard', '/leads', '/super', '/api/health']) {
      expect(formHostAction('apply.ien.com', FH, p)).toBe('redirect-apply');
    }
  });
});
