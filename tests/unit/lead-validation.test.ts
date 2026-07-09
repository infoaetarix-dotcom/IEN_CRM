import { describe, it, expect } from 'vitest';
import { leadSchema, normalizeSource } from '@/lib/validation/lead';
import { ageFromDob } from '@/lib/utils';

const base = {
  full_name: 'Asha Khan',
  email: 'Asha@Example.com',
  phone: '+923001234567', // valid E.164 (PK mobile)
  date_of_birth: '2000-05-01',
  city: 'Lahore', // required
  target_country: 'United Kingdom', // required
  highest_education: "Bachelor's degree", // required
  last_qualification: 'BSc Computer Science', // required
  prior_institution: 'University of the Punjab', // required
  passing_year: '2021', // required (form sends string)
  grading_system: 'cgpa_4', // required
  grade_value: '3.5', // required
  prior_rejection: false,
  consent_given: true as const,
};

describe('leadSchema', () => {
  it('accepts a valid lead and lowercases email', () => {
    const r = leadSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('asha@example.com');
  });

  it('rejects an invalid phone number (wrong length for country)', () => {
    const r = leadSchema.safeParse({ ...base, phone: '+9230012' });
    expect(r.success).toBe(false);
  });

  it('rejects missing consent', () => {
    const r = leadSchema.safeParse({ ...base, consent_given: false });
    expect(r.success).toBe(false);
  });

  it('requires target country and highest education', () => {
    expect(leadSchema.safeParse({ ...base, target_country: '' }).success).toBe(
      false,
    );
    expect(
      leadSchema.safeParse({ ...base, highest_education: '' }).success,
    ).toBe(false);
  });

  it('rejects a future date of birth', () => {
    const r = leadSchema.safeParse({ ...base, date_of_birth: '2999-01-01' });
    expect(r.success).toBe(false);
  });

  it('rejects an under-age applicant', () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 5);
    const r = leadSchema.safeParse({
      ...base,
      date_of_birth: recent.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(false);
  });

  it('requires detail when prior_rejection is true', () => {
    const r = leadSchema.safeParse({ ...base, prior_rejection: true });
    expect(r.success).toBe(false);
  });

  it('blocks a filled honeypot', () => {
    const r = leadSchema.safeParse({ ...base, company: 'spam' });
    expect(r.success).toBe(false);
  });
});

describe('normalizeSource', () => {
  it('maps known sources', () => {
    expect(normalizeSource('instagram')).toBe('instagram');
    expect(normalizeSource('Facebook')).toBe('facebook');
  });
  it('maps unknown to other and empty to direct', () => {
    expect(normalizeSource('tiktok')).toBe('other');
    expect(normalizeSource('')).toBe('direct');
    expect(normalizeSource(null)).toBe('direct');
  });
});

describe('ageFromDob', () => {
  it('computes a plausible age', () => {
    expect(ageFromDob('2000-01-01')).toBeGreaterThanOrEqual(24);
    expect(ageFromDob(null)).toBeNull();
  });
});
