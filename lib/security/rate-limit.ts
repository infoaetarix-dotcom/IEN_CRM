import 'server-only';

/**
 * IP-based rate limiting. Uses Upstash Redis when configured; otherwise falls
 * back to an in-memory sliding window (fine for local/single-instance, NOT for
 * multi-instance production — set Upstash env vars before scaling).
 */

type Result = { success: boolean; remaining: number };

const memory = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    memory.set(key, hits);
    return { success: false, remaining: 0 };
  }
  hits.push(now);
  memory.set(key, hits);
  return { success: true, remaining: limit - hits.length };
}

async function upstashLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<Result> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSec = Math.ceil(windowMs / 1000);
  // INCR then EXPIRE on first hit — simple fixed-window counter.
  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { result: count } = (await incr.json()) as { result: number };
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}

/**
 * @param identifier  usually the client IP, scoped by purpose e.g. `lead:1.2.3.4`
 * @param limit       max requests per window (default 5)
 * @param windowMs    window length in ms (default 10 min)
 */
export async function rateLimit(
  identifier: string,
  limit = 5,
  windowMs = 10 * 60 * 1000,
): Promise<Result> {
  const key = `rl:${identifier}`;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimit(key, limit, windowMs);
    } catch {
      return memoryLimit(key, limit, windowMs);
    }
  }
  return memoryLimit(key, limit, windowMs);
}
