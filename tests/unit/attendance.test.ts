import { describe, it, expect } from 'vitest';
import {
  parseIp,
  formatIp,
  parseOfficeNetwork,
  isOfficeIp,
  clientIpFromHeaders,
  summariseClockInIps,
} from '@/lib/attendance/ip';
import {
  isWeekend,
  sessionSeconds,
  formatDuration,
  formatClock,
  datesBetween,
  buildDayRecords,
  type AttendanceSession,
  type AgentRef,
} from '@/lib/attendance/records';

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('attendance: IP parsing', () => {
  it('reads IPv4, IPv6, bracketed, zoned and IPv4-mapped addresses', () => {
    expect(formatIp(parseIp('203.0.113.7')!)).toBe('203.0.113.7');
    expect(formatIp(parseIp(' 2400:ADC1:0:0:0:0:0:1 ')!)).toBe('2400:adc1::1');
    expect(formatIp(parseIp('[::1]')!)).toBe('::1');
    expect(formatIp(parseIp('fe80::1%eth0')!)).toBe('fe80::1');
    expect(parseIp('::ffff:203.0.113.7')).toEqual(parseIp('203.0.113.7'));
  });

  it('rejects junk', () => {
    for (const bad of ['', 'abc', '256.1.1.1', '1.2.3', '1:2:3:4:5:6:7:8:9', '1::2::3', null, undefined]) {
      expect(parseIp(bad as string)).toBeNull();
    }
  });
});

describe('attendance: office networks', () => {
  it('stores a bare IPv4 as that one address and a bare IPv6 as its /64', () => {
    const v4 = parseOfficeNetwork('203.0.113.7');
    expect(v4.ok && v4.network.canonical).toBe('203.0.113.7');
    const v6 = parseOfficeNetwork('2400:adc1:1:2:aaaa:bbbb:cccc:dddd');
    expect(v6.ok && v6.network.canonical).toBe('2400:adc1:1:2::/64');
  });

  it('normalises a range to its network address', () => {
    const r = parseOfficeNetwork('203.0.113.77/24');
    expect(r.ok && r.network.canonical).toBe('203.0.113.0/24');
  });

  it('refuses ranges that would cover far too much, and bad input', () => {
    expect(parseOfficeNetwork('10.0.0.0/8').ok).toBe(false);
    expect(parseOfficeNetwork('2400::/16').ok).toBe(false);
    expect(parseOfficeNetwork('1.2.3.4/40').ok).toBe(false);
    expect(parseOfficeNetwork('nope').ok).toBe(false);
    expect(parseOfficeNetwork('').ok).toBe(false);
  });

  it('decides office vs remote', () => {
    const stored = ['203.0.113.7', '198.51.100.0/24', '2400:adc1:1:2::/64'];
    expect(isOfficeIp('203.0.113.7', stored)).toBe(true);
    expect(isOfficeIp('203.0.113.8', stored)).toBe(false);
    expect(isOfficeIp('198.51.100.250', stored)).toBe(true);
    // Every device on the office's IPv6 network has a different address.
    expect(isOfficeIp('2400:adc1:1:2:1111:2222:3333:4444', stored)).toBe(true);
    expect(isOfficeIp('2400:adc1:1:3::1', stored)).toBe(false);
    expect(isOfficeIp('::ffff:203.0.113.7', stored)).toBe(true);
    expect(isOfficeIp(null, stored)).toBe(false);
    expect(isOfficeIp('203.0.113.7', [])).toBe(false);
  });
});

describe('attendance: client IP from request headers', () => {
  it('prefers x-real-ip, then the first x-forwarded-for hop', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' }))).toBe('203.0.113.7');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '::ffff:127.0.0.1' }))).toBe('127.0.0.1');
    expect(clientIpFromHeaders(headers({}))).toBeNull();
  });
});

describe('attendance: recent clock-in IPs', () => {
  it('ranks the IP most agents share first and flags office ones', () => {
    const rows = [
      { clock_in_ip: '203.0.113.7', profile_id: 'a', clock_in_at: '2026-11-02T07:00:00Z' },
      { clock_in_ip: '203.0.113.7', profile_id: 'b', clock_in_at: '2026-11-03T07:00:00Z' },
      { clock_in_ip: '39.40.1.2', profile_id: 'a', clock_in_at: '2026-11-04T07:00:00Z' },
      { clock_in_ip: '39.40.1.2', profile_id: 'a', clock_in_at: '2026-11-05T07:00:00Z' },
      { clock_in_ip: '39.40.1.2', profile_id: 'a', clock_in_at: '2026-11-06T07:00:00Z' },
      { clock_in_ip: null, profile_id: 'c', clock_in_at: '2026-11-06T07:00:00Z' },
    ];
    const out = summariseClockInIps(rows, ['39.40.1.2']);
    expect(out.map((u) => [u.ip, u.agents, u.checkIns, u.isOffice])).toEqual([
      ['203.0.113.7', 2, 2, false],
      ['39.40.1.2', 1, 3, true],
    ]);
    expect(out[1]!.lastUsed).toBe('2026-11-06T07:00:00Z');
  });
});

describe('attendance: durations and days', () => {
  it('knows the weekend', () => {
    expect(isWeekend('2026-11-07')).toBe(true); // Saturday
    expect(isWeekend('2026-11-08')).toBe(true); // Sunday
    expect(isWeekend('2026-11-09')).toBe(false); // Monday
  });

  it('measures sessions, an open one up to now', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    expect(sessionSeconds({ clock_in_at: '2026-11-09T07:00:00Z', clock_out_at: '2026-11-09T08:30:00Z' }, now)).toBe(5400);
    expect(sessionSeconds({ clock_in_at: '2026-11-09T09:15:00Z', clock_out_at: null }, now)).toBe(2700);
  });

  it('formats', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45 * 60)).toBe('45m');
    expect(formatDuration(5 * 3600 + 25 * 60 + 59)).toBe('5h 25m');
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe('3h 05m');
    expect(formatClock(5050)).toBe('01:24:10');
    expect(formatClock(-3)).toBe('00:00:00');
  });

  it('lists dates newest first', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30']);
  });
});

describe('attendance: day records', () => {
  const agents: AgentRef[] = [
    { id: 'ali', name: 'Ali', isActive: true, joinedDate: '2026-01-01' },
    { id: 'sara', name: 'Sara', isActive: true, joinedDate: '2026-11-06' },
    { id: 'old', name: 'Gone', isActive: false, joinedDate: '2025-01-01' },
  ];
  const s = (over: Partial<AttendanceSession>): AttendanceSession => ({
    id: Math.random().toString(36),
    profile_id: 'ali',
    work_date: '2026-11-05',
    clock_in_at: '2026-11-05T07:00:00Z',
    clock_in_place: 'office',
    clock_out_at: '2026-11-05T10:40:00Z',
    clock_out_place: 'office',
    clock_out_method: 'auto',
    ...over,
  });
  const now = new Date('2026-11-09T09:00:00Z');

  it('adds up several sessions in a day, oldest first', () => {
    const records = buildDayRecords({
      sessions: [
        s({ clock_in_at: '2026-11-05T11:30:00Z', clock_out_at: '2026-11-05T13:15:00Z', clock_in_place: 'remote', clock_out_place: 'remote', clock_out_method: 'manual' }),
        s({}),
      ],
      agents: [agents[0]!],
      from: '2026-11-05',
      to: '2026-11-05',
      todayKey: '2026-11-09',
      now,
    });
    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe('present');
    expect(records[0]!.totalSeconds).toBe((3 * 60 + 40 + 60 + 45) * 60); // 5h 25m
    expect(records[0]!.sessions[0]!.clock_in_place).toBe('office');
  });

  it('marks weekday absences, skips empty weekends, joins and inactive staff', () => {
    const records = buildDayRecords({
      sessions: [s({ work_date: '2026-11-07', clock_in_at: '2026-11-07T07:00:00Z', clock_out_at: '2026-11-07T08:00:00Z' })],
      agents,
      from: '2026-11-05',
      to: '2026-11-09',
      todayKey: '2026-11-09',
      now,
    });
    const view = records.map((r) => `${r.date} ${r.agentName} ${r.status}${r.weekend ? ' (weekend)' : ''}`);
    expect(view).toEqual([
      '2026-11-09 Ali not_in_yet',
      '2026-11-09 Sara not_in_yet',
      // Sunday 8th: nobody worked → not listed.
      '2026-11-07 Ali present (weekend)',
      '2026-11-06 Ali absent',
      '2026-11-06 Sara absent',
      // Sara joined on the 6th; "Gone" is inactive.
      '2026-11-05 Ali absent',
    ]);
  });

  it('shows someone still clocked in as working, and never lists future days', () => {
    const records = buildDayRecords({
      sessions: [s({ work_date: '2026-11-09', clock_in_at: '2026-11-09T07:00:00Z', clock_out_at: null, clock_out_place: null, clock_out_method: null })],
      agents: [agents[0]!],
      from: '2026-11-09',
      to: '2026-11-12',
      todayKey: '2026-11-09',
      now,
    });
    expect(records.map((r) => [r.date, r.status, r.totalSeconds])).toEqual([['2026-11-09', 'working', 7200]]);
  });

  it('still lists the past sessions of an agent who has since left', () => {
    const records = buildDayRecords({
      sessions: [s({ profile_id: 'old' })],
      agents,
      from: '2026-11-05',
      to: '2026-11-05',
      todayKey: '2026-11-09',
      now,
    });
    expect(records.find((r) => r.agentId === 'old')?.status).toBe('present');
  });
});
