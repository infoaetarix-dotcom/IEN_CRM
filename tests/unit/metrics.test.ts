import { describe, it, expect } from 'vitest';
import {
  buildSourceData,
  buildPipelineData,
  buildVolumeData,
  computeResponseRate,
  type LeadRow,
} from '@/lib/leads/metrics';

const leads: LeadRow[] = [
  { status: 'new', utm_source: 'instagram', created_at: '2026-06-20T08:00:00Z' },
  { status: 'contacted', utm_source: 'instagram', created_at: '2026-06-20T09:00:00Z' },
  { status: 'accepted', utm_source: 'facebook', created_at: '2026-06-19T09:00:00Z' },
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
  it('includes all six statuses with zeros', () => {
    const d = buildPipelineData(leads);
    expect(d).toHaveLength(6);
    expect(d.find((x) => x.label === 'New')!.value).toBe(1);
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
