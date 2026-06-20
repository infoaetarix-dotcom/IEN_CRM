import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure no Upstash env so the in-memory limiter is exercised.
beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
});

describe('rateLimit (in-memory)', () => {
  it('allows up to the limit then throttles (Security Test #3)', async () => {
    const { rateLimit } = await import('@/lib/security/rate-limit');
    const id = `test-${Math.random()}`;
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(await rateLimit(id, 5, 60_000));
    }
    // First 5 succeed, 6th and 7th are throttled.
    expect(results.slice(0, 5).every((r) => r.success)).toBe(true);
    expect(results[5]!.success).toBe(false);
    expect(results[6]!.success).toBe(false);
  });

  it('tracks identifiers independently', async () => {
    const { rateLimit } = await import('@/lib/security/rate-limit');
    const a = await rateLimit(`a-${Math.random()}`, 1, 60_000);
    const b = await rateLimit(`b-${Math.random()}`, 1, 60_000);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });
});
