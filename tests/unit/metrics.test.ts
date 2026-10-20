import { describe, it, expect } from 'vitest';
import {
  buildSourceData,
  buildPipelineData,
  buildVolumeData,
  computeResponseRate,
  type LeadRow,
} from '@/lib/leads/metrics';

const leads: LeadRow[] = [
  { status: 'raw_lead', utm_source: 'instagram', created_at: '2026-06-20T08:00:00Z' },
  { status: 'document_processing', utm_source: 'instagram', created_at: '2026-06-20T09:00:00Z' },
  { status: 'application_generated', utm_source: 'facebook', created_at: '2026-06-19T09:00:00Z' },
];

describe('buildSourceData', () => {
  it('counts only sources present', () => {
    const d = buildSourceData(leads);
    expect(d).toEqual([
      { label: 'Instagram', value: 2 },
      { label: 'Facebook', value: 1 },
    ]);
  });
});

describe('buildPipelineData', () => {
  it('includes all four statuses with zeros', () => {
    const d = buildPipelineData(leads);
    expect(d).toHaveLength(4);
    expect(d.find((x) => x.label === 'Raw lead')!.value).toBe(1);
    expect(d.find((x) => x.label === 'Rejected')!.value).toBe(0);
  });
});

describe('buildVolumeData', () => {
  it('produces one bucket per day', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const d = buildVolumeData(leads, 7, now);
    expect(d).toHaveLength(7);
    // 20th has 2 leads, 19th has 1
    expect(d[d.length - 1]!.value).toBe(2);
    expect(d[d.length - 2]!.value).toBe(1);
  });

  it('covers a 30-day window across a month boundary', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const rows: LeadRow[] = [
      ...leads,
      // 29 days back = first bucket (22 May)
      { status: 'raw_lead', utm_source: 'website', created_at: '2026-05-22T10:00:00Z' },
      // 30 days back = just outside the window
      { status: 'raw_lead', utm_source: 'website', created_at: '2026-05-21T10:00:00Z' },
    ];
    const d = buildVolumeData(rows, 30, now);
    expect(d).toHaveLength(30);
    expect(d[0]!.label).toBe('22 May');
    expect(d[0]!.value).toBe(1);
    expect(d[d.length - 1]!.label).toBe('20 Jun');
    expect(d.reduce((sum, x) => sum + x.value, 0)).toBe(4);
  });
});

describe('computeResponseRate', () => {
  it('counts first contact within one hour', () => {
    const rows = [
      { id: 'a', created_at: '2026-06-20T08:00:00Z' }, // contacted +30m → fast
      { id: 'b', created_at: '2026-06-20T08:00:00Z' }, // contacted +3h → slow
      { id: 'c', created_at: '2026-06-20T08:00:00Z' }, // never contacted
    ];
    const firstContact = new Map([
      ['a', '2026-06-20T08:30:00Z'],
      ['b', '2026-06-20T11:00:00Z'],
    ]);
    const r = computeResponseRate(rows, firstContact);
    expect(r.within).toBe(1);
    expect(r.denom).toBe(3);
    expect(r.rate).toBe(33);
  });

  it('returns null rate with no leads', () => {
    expect(computeResponseRate([], new Map()).rate).toBeNull();
  });
});
