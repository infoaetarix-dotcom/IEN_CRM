import { describe, it, expect } from 'vitest';
import { buildIntakeReport } from '@/lib/reports/applications';
import { buildLeadReport, percentChange, rangeDateBounds } from '@/lib/reports/leads';
import { monthRange, dateKeysInRange } from '@/lib/reports/time';
import { resolveReportSelection } from '@/lib/reports/selection';

describe('buildIntakeReport', () => {
  const app = (status: string, university = 'Uni A', country = 'UK') => ({
    status,
    university_name: university,
    country,
  });
  const apps = [
    app('applied_processed'),
    app('conditional_offer'),
    app('deposit_1_paid'),
    app('visa_submitted'),
    app('visa_accepted', 'Uni B', 'Canada'),
    app('visa_rejected', 'Uni B', 'Canada'),
    app('enrolled'),
    app('app_rejected'),
  ];
  const r = buildIntakeReport(apps);
  const m = (key: string) => r.milestones.find((x) => x.key === key)!.count;

  it('counts milestones by what each application has reached', () => {
    expect(r.total).toBe(8);
    expect(m('generated')).toBe(8);
    expect(m('offer')).toBe(6); // conditional, deposit, 3 visa-stage, enrolled
    expect(m('deposit')).toBe(5); // deposit_1, 3 visa-stage, enrolled
    expect(m('visa_applied')).toBe(4); // submitted, accepted, rejected, enrolled
    expect(m('visa_accepted')).toBe(2); // accepted + enrolled
    expect(m('visa_rejected')).toBe(1);
    expect(m('enrolled')).toBe(1);
    expect(m('app_rejected')).toBe(1);
  });

  it('computes visa success as accepted ÷ decided', () => {
    expect(r.visaSuccessRate).toBe(67); // 2 accepted of 3 decided
    expect(buildIntakeReport([app('visa_submitted')]).visaSuccessRate).toBeNull();
  });

  it('breaks down by university and country', () => {
    const b = r.byCountry.find((x) => x.label === 'Canada')!;
    expect(b).toEqual({ label: 'Canada', total: 2, visaApplied: 2, visaAccepted: 1, visaRejected: 1 });
    expect(r.byUniversity[0]!.label).toBe('Uni A');
  });

  it('keeps every status in the per-status list', () => {
    expect(r.byStatus.find((s) => s.status === 'enrolled')!.count).toBe(1);
    expect(r.byStatus.find((s) => s.status === 'visa_refunded')!.count).toBe(0);
  });
});

describe('buildLeadReport', () => {
  const tz = 'Asia/Karachi';
  const range = monthRange(tz, 2026, 10);
  const leads = [
    // 1 Oct 02:00 Karachi = 30 Sep 21:00 UTC → belongs to October locally
    { id: 'a', status: 'raw_lead', utm_source: 'instagram', created_by: 'u1', created_at: '2026-09-30T21:00:00Z' },
    { id: 'b', status: 'application_generated', utm_source: 'instagram', created_by: 'u1', created_at: '2026-10-15T08:00:00Z' },
    { id: 'c', status: 'rejected', utm_source: 'facebook', created_by: null, created_at: '2026-10-31T10:00:00Z' },
  ];
  const r = buildLeadReport(leads, {
    tz,
    range,
    dayKeys: dateKeysInRange(range, tz),
    firstContact: new Map([
      ['a', '2026-09-30T21:30:00Z'], // +30m → fast
      ['b', '2026-10-15T12:00:00Z'], // +4h → slow
    ]),
    convertedIds: new Set(['b']),
    nameById: new Map([['u1', 'Sara']]),
  });

  it('totals, conversion and response rate', () => {
    expect(r.total).toBe(3);
    expect(r.converted).toBe(1);
    expect(r.responseRate).toBe(33);
  });

  it('buckets by local day, with empty days kept', () => {
    expect(r.daily).toHaveLength(31);
    expect(r.daily[0]).toMatchObject({ key: '2026-10-01', count: 1 });
    expect(r.daily[30]).toMatchObject({ key: '2026-10-31', count: 1 });
    expect(r.monthly).toEqual([{ key: '2026-10', label: 'October 2026', count: 3 }]);
  });

  it('groups by source, status and staff', () => {
    expect(r.bySource[0]).toEqual({ key: 'instagram', label: 'Instagram', count: 2 });
    expect(r.byStatus.find((s) => s.key === 'rejected')!.count).toBe(1);
    expect(r.byStaff).toEqual([
      { key: 'u1', label: 'Sara', count: 2, fastResponses: 1, converted: 1 },
      { key: 'none', label: 'Public form', count: 1, fastResponses: 0, converted: 0 },
    ]);
  });

  it('gives inclusive local date bounds for list links', () => {
    expect(rangeDateBounds(range, tz)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('percent change', () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe('resolveReportSelection', () => {
  const tz = 'Asia/Karachi';
  const now = new Date('2026-11-10T08:00:00Z');
  const periods = [
    { id: 'p1', name: 'Jan–Feb intake', start_month: 1, end_month: 2, report_month: 3 },
    { id: 'p3', name: 'Sep–Oct intake', start_month: 9, end_month: 10, report_month: 11 },
  ];
  const ctx = { tz, now, periods, intakes: [
    { season: 'spring', year: 2027, count: 15 },
    { season: 'fall', year: 2026, count: 1 },
  ] };

  it('defaults the monthly report to last month', () => {
    const s = resolveReportSelection({}, ctx);
    expect(s.type).toBe('monthly');
    if (s.type !== 'monthly') return;
    expect(s.title).toBe('October 2026');
    expect(s.previousLabel).toBe('September 2026');
  });

  it('reads an explicit month, rolling back across January', () => {
    const s = resolveReportSelection({ type: 'monthly', month: '2026-01' }, ctx);
    if (s.type !== 'monthly') throw new Error();
    expect(s.title).toBe('January 2026');
    expect(s.previousLabel).toBe('December 2025');
  });

  it('defaults to the most recently started period, final once its report month arrives', () => {
    const s = resolveReportSelection({ type: 'period' }, ctx);
    if (s.type !== 'period' || !s.period) throw new Error();
    expect(s.period.id).toBe('p3');
    expect(s.year).toBe(2026);
    expect(s.final).toBe(true); // 10 Nov is past 1 Nov
    expect(s.previousLabel).toBe('Sep–Oct 2025');
  });

  it('marks a period in progress before its report month', () => {
    const s = resolveReportSelection({ type: 'period', period: 'p3', year: '2026' }, {
      ...ctx,
      now: new Date('2026-10-15T08:00:00Z'),
    });
    if (s.type !== 'period' || !s.period) throw new Error();
    expect(s.final).toBe(false);
  });

  it('handles no periods configured', () => {
    const s = resolveReportSelection({ type: 'period' }, { ...ctx, periods: [] });
    expect(s.type === 'period' && s.period === null).toBe(true);
  });

  it('defaults the intake report to the latest intake with applications', () => {
    const s = resolveReportSelection({ type: 'intake' }, ctx);
    if (s.type !== 'intake') throw new Error();
    expect(s.title).toBe('Spring 2027 intake');
    expect(resolveReportSelection({ type: 'intake', season: 'fall', year: '2026' }, ctx).title).toBe(
      'Fall 2026 intake',
    );
  });
});
