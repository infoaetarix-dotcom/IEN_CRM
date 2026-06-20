import 'server-only';

/**
 * Verify a Cloudflare Turnstile token server-side. Returns true only when
 * Cloudflare confirms the token. Never trust the client's word for it.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // If no secret is configured (e.g. very first local run), fail closed in
  // production but allow in development so the form is testable.
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!token) return false;

  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
