/**
 * Office-or-remote by IP address (0052_attendance.sql). A super admin
 * stores each consultancy's office networks; at clock-in/out the request's
 * IP is checked against them. Pure — no I/O — so it's unit-tested directly.
 *
 * IPv4: an exact address (most office lines) or a range like /24.
 * IPv6: many connections give every device its own address, so a bare IPv6
 * address is stored as its /64 network — every device in the office shares
 * that part.
 */

export type IpFamily = 4 | 6;

interface ParsedIp {
  family: IpFamily;
  value: bigint;
}

export interface OfficeNetwork {
  family: IpFamily;
  base: bigint;
  prefix: number;
  /** Normalised text, as stored and shown. */
  canonical: string;
}

const BITS: Record<IpFamily, number> = { 4: 32, 6: 128 };

function parseV4(s: string): bigint | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let v = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    v = (v << 8n) | BigInt(n);
  }
  return v;
}

function parseV6(s: string): bigint | null {
  if (!/^[0-9a-f:.]+$/i.test(s) || s.split('::').length > 2) return null;
  // An embedded IPv4 tail ("::ffff:1.2.3.4") becomes two hextets.
  const lastColon = s.lastIndexOf(':');
  if (s.includes('.', lastColon)) {
    const v4 = parseV4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }
  const [head, tail] = s.split('::') as [string, string | undefined];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const missing = 8 - h.length - t.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...h, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...t];
  let v = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    v = (v << 16n) | BigInt(parseInt(g, 16));
  }
  return v;
}

/**
 * A client IP as it arrives in a header. Accepts IPv4, IPv6, bracketed
 * IPv6, a zone suffix, and IPv4-mapped IPv6 (treated as the IPv4 address).
 */
export function parseIp(raw: string | null | undefined): ParsedIp | null {
  if (!raw) return null;
  let s = raw.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (!s) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(s);
  if (mapped) s = mapped[1]!;
  if (s.includes(':')) {
    const v = parseV6(s);
    return v === null ? null : { family: 6, value: v };
  }
  const v = parseV4(s);
  return v === null ? null : { family: 4, value: v };
}

function mask(family: IpFamily, prefix: number): bigint {
  const bits = BigInt(BITS[family]);
  const all = (1n << bits) - 1n;
  return prefix === 0 ? 0n : (all >> (bits - BigInt(prefix))) << (bits - BigInt(prefix));
}

function formatV4(v: bigint): string {
  return [24n, 16n, 8n, 0n].map((sh) => ((v >> sh) & 0xffn).toString()).join('.');
}

/** RFC 5952 style: lowercase, longest run of zero groups as "::". */
function formatV6(v: bigint): string {
  const groups = Array.from({ length: 8 }, (_, i) => Number((v >> BigInt((7 - i) * 16)) & 0xffffn));
  let best = { start: -1, len: 0 };
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > best.len && j - i > 1) best = { start: i, len: j - i };
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best.start < 0) return hex.join(':');
  return `${hex.slice(0, best.start).join(':')}::${hex.slice(best.start + best.len).join(':')}`;
}

export function formatIp(ip: ParsedIp): string {
  return ip.family === 4 ? formatV4(ip.value) : formatV6(ip.value);
}

/**
 * What a super admin types: an address or "address/prefix". Bare IPv4 →
 * that one address; bare IPv6 → its /64. Returns an error message instead
 * when it isn't usable.
 */
export function parseOfficeNetwork(input: string): { ok: true; network: OfficeNetwork } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter an IP address.' };
  const [addr, prefixText, extra] = text.split('/');
  if (extra !== undefined) return { ok: false, error: 'That doesn’t look like an IP address.' };
  const ip = parseIp(addr);
  if (!ip) return { ok: false, error: 'That doesn’t look like an IP address, e.g. 203.0.113.7' };

  const max = BITS[ip.family];
  let prefix = ip.family === 4 ? 32 : 64;
  if (prefixText !== undefined) {
    if (!/^\d{1,3}$/.test(prefixText) || Number(prefixText) > max) {
      return { ok: false, error: `The part after "/" must be 0–${max}.` };
    }
    prefix = Number(prefixText);
  }
  // Anything this wide would count half the internet as "the office".
  const min = ip.family === 4 ? 16 : 32;
  if (prefix < min) return { ok: false, error: `That range is too wide — use /${min} or narrower.` };

  const base = ip.value & mask(ip.family, prefix);
  const addrText = formatIp({ family: ip.family, value: base });
  const canonical = prefix === max ? addrText : `${addrText}/${prefix}`;
  return { ok: true, network: { family: ip.family, base, prefix, canonical } };
}

export function ipInNetwork(ip: ParsedIp, net: OfficeNetwork): boolean {
  return ip.family === net.family && (ip.value & mask(net.family, net.prefix)) === net.base;
}

/** Is this client IP inside any of the stored office networks? */
export function isOfficeIp(rawIp: string | null | undefined, storedNetworks: string[]): boolean {
  const ip = parseIp(rawIp);
  if (!ip) return false;
  return storedNetworks.some((n) => {
    const parsed = parseOfficeNetwork(n);
    return parsed.ok && ipInNetwork(ip, parsed.network);
  });
}

export interface IpUsage {
  ip: string;
  checkIns: number;
  agents: number;
  lastUsed: string;
  isOffice: boolean;
}

/**
 * Super Admin's helper for finding an office IP without asking the client:
 * recent clock-in IPs, most used first. The office line is the one most
 * agents share on weekdays.
 */
export function summariseClockInIps(
  rows: { clock_in_ip: string | null; profile_id: string; clock_in_at: string }[],
  storedNetworks: string[],
): IpUsage[] {
  const byIp = new Map<string, { checkIns: number; agents: Set<string>; lastUsed: string }>();
  for (const r of rows) {
    if (!r.clock_in_ip) continue;
    const u = byIp.get(r.clock_in_ip) ?? { checkIns: 0, agents: new Set<string>(), lastUsed: r.clock_in_at };
    u.checkIns++;
    u.agents.add(r.profile_id);
    if (r.clock_in_at > u.lastUsed) u.lastUsed = r.clock_in_at;
    byIp.set(r.clock_in_ip, u);
  }
  return [...byIp.entries()]
    .map(([ip, u]) => ({
      ip,
      checkIns: u.checkIns,
      agents: u.agents.size,
      lastUsed: u.lastUsed,
      isOffice: isOfficeIp(ip, storedNetworks),
    }))
    .sort((a, b) => b.agents - a.agents || b.checkIns - a.checkIns || b.lastUsed.localeCompare(a.lastUsed));
}

/**
 * The caller's IP. On Vercel, x-real-ip / x-forwarded-for are set by the
 * platform itself (a client-sent value is overwritten), so they can be
 * trusted for this. Returned normalised, or null if missing/unparseable.
 */
export function clientIpFromHeaders(h: { get(name: string): string | null }): string | null {
  const candidates = [h.get('x-real-ip'), h.get('x-forwarded-for')?.split(',')[0]];
  for (const c of candidates) {
    const ip = parseIp(c);
    if (ip) return formatIp(ip);
  }
  return null;
}
