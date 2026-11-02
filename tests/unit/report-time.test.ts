import { describe, it, expect } from 'vitest';
import { zonedDateKey, startOfDayInZone, monthRange, dateKeysInRange } from '@/lib/reports/time';

const KHI = 'Asia/Karachi'; // UTC+5, no DST
const LON = 'Europe/London'; // has DST

describe('zoned dates', () => {
  it('puts a 2am Karachi lead on the Karachi date, not the UTC one', () => {
    // 21:00 UTC on 31 Oct = 02:00 on 1 Nov in Karachi
    expect(zonedDateKey(new Date('2026-10-31T21:00:00Z'), KHI)).toBe('2026-11-01');
    expect(zonedDateKey(new Date('2026-10-31T21:00:00Z'), 'UTC')).toBe('2026-10-31');
  });

  it('finds local midnight as a UTC instant', () => {
    expect(startOfDayInZone(KHI, 2026, 11, 1).toISOString()).toBe('2026-10-31T19:00:00.000Z');
    // London is on GMT in January and BST in July
    expect(startOfDayInZone(LON, 2026, 1, 15).toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(startOfDayInZone(LON, 2026, 7, 15).toISOString()).toBe('2026-07-14T23:00:00.000Z');
  });

  it('normalises month overflow into the next year', () => {
    expect(startOfDayInZone(KHI, 2026, 13, 1).toISOString()).toBe('2026-12-31T19:00:00.000Z');
  });

  it('builds a month range and its day keys', () => {
    const r = monthRange(KHI, 2026, 2);
    expect(r.start.toISOString()).toBe('2026-01-31T19:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-02-28T19:00:00.000Z');
    const keys = dateKeysInRange(r, KHI);
    expect(keys).toHaveLength(28);
    expect(keys[0]).toBe('2026-02-01');
    expect(keys[27]).toBe('2026-02-28');
  });

  it('handles a DST month without dropping or doubling a day', () => {
    // Clocks go forward in London on 29 Mar 2026
    expect(dateKeysInRange(monthRange(LON, 2026, 3), LON)).toHaveLength(31);
  });
});

