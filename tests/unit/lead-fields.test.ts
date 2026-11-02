import { describe, it, expect } from 'vitest';
import { step2Schema, step3Schema, quickLeadSchema, leadEditSchema } from '@/lib/validation/lead';
import { applicationEditSchema } from '@/lib/validation/application';
import { CODE_LABELS, INTAKE_SEASONS } from '@/lib/form-options';
import {
  parseApplicationListFilters,
  matchesApplicationListFilters,
  applicationSearchText,
  hasApplicationListFilters,
  type FilterableApplication,
} from '@/lib/applications/list-filters';

const step2Base = {
  date_of_birth: '2000-05-01',
  city: 'Lahore',
  highest_education: 'bachelors',
  last_qualification: 'BSc CS',
  prior_institution: 'PU',
  passing_year: '2022',
  grading_system: 'percentage',
  grade_value: '80',
};

describe('marital status', () => {
  it('is required on the public form (step 2)', () => {
    const r = step2Schema.safeParse(step2Base);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === 'marital_status')?.message).toBe(
      'Please select your marital status',
    );
    expect(step2Schema.safeParse({ ...step2Base, marital_status: 'married' }).success).toBe(true);
    expect(step2Schema.safeParse({ ...step2Base, marital_status: 'divorced' }).success).toBe(false);
  });

  it('is optional in Create query, the lead editor and applications', () => {
    expect(quickLeadSchema.safeParse({ full_name: 'Ali' }).success).toBe(true);
    expect(quickLeadSchema.safeParse({ full_name: 'Ali', marital_status: '' }).success).toBe(true);
    expect(leadEditSchema.safeParse({ marital_status: 'prefer_not_to_say' }).success).toBe(true);
    expect(applicationEditSchema.safeParse({ university_id: crypto.randomUUID() }).success).toBe(true);
  });
});

describe('budget range', () => {
  it('is optional and only accepts the defined ranges', () => {
    expect(step3Schema.safeParse({}).success).toBe(true);
    expect(step3Schema.safeParse({ budget_range: 'below_10l' }).success).toBe(true);
    expect(step3Schema.safeParse({ budget_range: '5 lac' }).success).toBe(false);
    expect(CODE_LABELS['50l_1cr']).toBe('50 lac – 1 crore');
  });
});

describe('intakes', () => {
  it('offers Jan–Feb, Apr–May, Sep–Oct and rejects the old seasons', () => {
    expect(INTAKE_SEASONS.map((s) => s.label)).toEqual(['Jan – Feb', 'Apr – May', 'Sep – Oct']);
    expect(step3Schema.safeParse({ intake_season: 'sep_oct', intake_year: '2027' }).success).toBe(true);
    expect(step3Schema.safeParse({ intake_season: 'fall' }).success).toBe(false);
  });

  it('still labels an old season if one turns up during the switch-over', () => {
    expect(CODE_LABELS.fall).toBe('Fall');
    expect(CODE_LABELS.sep_oct).toBe('Sep – Oct');
  });
});

describe('applications list filters', () => {
  const app = (over: Partial<FilterableApplication> = {}): FilterableApplication => ({
    status: 'applied_processed',
    intake_season: 'sep_oct',
    intake_year: 2027,
    university_name: 'University of Leeds',
    country: 'United Kingdom',
    created_by: 'staff-1',
    created_date: '2026-10-15',
    search_text: applicationSearchText(['Sara Ahmed', null, 'sara@example.com', '+923001112233', 'AB1234567', 12, 34]),
    ...over,
  });
  const f = (sp: Record<string, string>) => parseApplicationListFilters(sp);

  it('searches names, email, phone, passport and numbers (all words must match)', () => {
    expect(matchesApplicationListFilters(app(), f({ q: 'sara' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ q: 'Sara Ahmed' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ q: 'ab1234567' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ q: '#12' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ q: 'sara khan' }))).toBe(false);
  });

  it('filters by status, university, country, intake, staff and created dates', () => {
    expect(matchesApplicationListFilters(app(), f({ statuses: 'visa_accepted' }))).toBe(false);
    expect(matchesApplicationListFilters(app(), f({ university: 'University of Leeds' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ country: 'Canada' }))).toBe(false);
    expect(matchesApplicationListFilters(app(), f({ season: 'sep_oct', year: '2027' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ season: 'jan_feb' }))).toBe(false);
    expect(matchesApplicationListFilters(app({ intake_season: null }), f({ season: '__none' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ staff: 'staff-2' }))).toBe(false);
    expect(matchesApplicationListFilters(app(), f({ from: '2026-10-01', to: '2026-10-31' }))).toBe(true);
    expect(matchesApplicationListFilters(app(), f({ from: '2026-10-16' }))).toBe(false);
  });

  it('ignores junk values and treats a label alone as no filter', () => {
    expect(f({ season: 'fall', from: '15/10/2026', statuses: 'nope' })).toMatchObject({
      season: '',
      from: '',
      statuses: [],
    });
    expect(hasApplicationListFilters(f({ label: 'From the report' }))).toBe(false);
  });
});

describe('applications carry every student field from the lead', () => {
  it('copies marital status, budget, intake and a letter-grade result', async () => {
    const { leadToApplicationDefaults } = await import('@/lib/applications/types');
    const v = leadToApplicationDefaults({
      full_name: 'Sara',
      marital_status: 'married',
      budget_range: '30l_50l',
      intake_season: 'apr_may',
      intake_year: 2027,
      grading_system: 'grade',
      grade_letter: 'A-',
    });
    expect(v).toMatchObject({
      marital_status: 'married',
      budget_range: '30l_50l',
      intake_season: 'apr_may',
      intake_year: '2027',
      grading_system: 'grade',
      grade_letter: 'A-',
    });
  });

  it('accepts a letter-grade result on an application', () => {
    const r = applicationEditSchema.safeParse({
      university_id: crypto.randomUUID(),
      grading_system: 'grade',
      grade_letter: 'First Division',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.grade_letter).toBe('First Division');
  });
});

describe('public form messages', () => {
  it('an unpicked date of birth says so plainly', () => {
    const r = step2Schema.safeParse({ ...step2Base, marital_status: 'single', date_of_birth: null });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === 'date_of_birth')?.message).toBe('Please select your date of birth');
    }
  });
});
