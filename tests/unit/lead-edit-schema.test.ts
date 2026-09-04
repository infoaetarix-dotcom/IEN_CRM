import { describe, it, expect } from 'vitest';
import { leadEditSchema } from '@/lib/validation/lead';

/** A complete, valid edit payload (form sends strings; numbers are coerced). */
const valid = {
  full_name: 'Asha Khan',
  email: 'Asha@Example.com',
  phone: '+923001234567',
  date_of_birth: '2000-05-01',
  city: 'Lahore',
  district: '',
  target_country: 'Canada',
  institution: '',
  program: '',
  intake_season: '',
  intake_year: '',
  highest_education: "Bachelor's degree",
  last_qualification: 'BSc',
  prior_institution: 'Punjab University',
  passing_year: '2022',
  grading_system: 'cgpa_4',
  grade_value: '3.5',
  work_experience_years: '',
  work_experience_detail: '',
  english_test: '',
  english_score: '',
  funding_source: '',
  prior_rejection: false,
  prior_rejection_detail: '',
};

describe('leadEditSchema', () => {
  it('accepts a valid edit payload and normalizes email to lowercase', () => {
    const r = leadEditSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('asha@example.com');
  });

  it('rejects an invalid email', () => {
    expect(leadEditSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(leadEditSchema.safeParse({ ...valid, full_name: '' }).success).toBe(false);
  });

  it('rejects a passing year before 1950', () => {
    expect(leadEditSchema.safeParse({ ...valid, passing_year: '1900' }).success).toBe(false);
  });

  it('enforces grade range for the grading system (cgpa_4 cannot exceed 4.0)', () => {
    expect(leadEditSchema.safeParse({ ...valid, grade_value: '5' }).success).toBe(false);
  });

  it('requires a rejection detail when prior_rejection is true', () => {
    expect(
      leadEditSchema.safeParse({ ...valid, prior_rejection: true, prior_rejection_detail: '' })
        .success,
    ).toBe(false);
    expect(
      leadEditSchema.safeParse({
        ...valid,
        prior_rejection: true,
        prior_rejection_detail: 'Refused UK visa in 2021',
      }).success,
    ).toBe(true);
  });

  it('strips non-editable keys (consent, status) instead of trusting them', () => {
    const r = leadEditSchema.safeParse({
      ...valid,
      consent_given: true,
      status: 'won',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect('consent_given' in r.data).toBe(false);
      expect('status' in r.data).toBe(false);
    }
  });

  it('accepts utm_source — staff may reassign a lead\'s source manually', () => {
    const r = leadEditSchema.safeParse({ ...valid, utm_source: 'personal_reference' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.utm_source).toBe('personal_reference');
  });

  it('accepts blanking every field except full name, email, and phone', () => {
    const r = leadEditSchema.safeParse({
      full_name: 'Asha Khan',
      email: 'asha@example.com',
      phone: '+923001234567',
      date_of_birth: '',
      city: '',
      district: '',
      target_country: '',
      institution: '',
      program: '',
      intake_season: '',
      intake_year: '',
      highest_education: '',
      last_qualification: '',
      prior_institution: '',
      passing_year: '',
      grading_system: '',
      grade_value: '',
      work_experience_years: '',
      work_experience_detail: '',
      english_test: '',
      english_score: '',
      funding_source: '',
      prior_rejection: false,
      prior_rejection_detail: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.city).toBeUndefined();
  });

  it('still rejects a blank name/email/phone with their normal message, not a generic one', () => {
    const blankName = leadEditSchema.safeParse({ ...valid, full_name: '' });
    expect(blankName.success).toBe(false);
    if (!blankName.success) {
      expect(blankName.error.issues[0]!.message).toBe('Please enter your full name');
    }
  });
});
