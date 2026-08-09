import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

/** Minimal .env.local parser so e2e setup has the service credentials. */
export function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    // fall back to process.env (CI)
  }
  return { ...out, ...process.env } as Record<string, string>;
}

export function serviceClient() {
  const env = loadEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

/**
 * Fill and submit the sign-in form, waiting for the Turnstile widget to
 * actually produce a token first — submitting immediately after filling the
 * fields races the widget's own resolution and fails with "Bot verification
 * failed". Doesn't assert a destination URL: callers wait for whatever that
 * account should land on (/dashboard, /super, /change-password).
 */
export async function submitLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  // Two elements share this name: our own hidden field (state-driven, first
  // in DOM order — what formData.get() actually reads on submit) and one
  // Cloudflare's script injects into the widget container. .first() targets
  // ours specifically; the bare name selector is ambiguous (strict-mode
  // violation) once the widget renders.
  await expect(
    page.locator('input[name="cf-turnstile-response"]').first(),
  ).not.toHaveValue('', { timeout: 15000 });
  await page.getByRole('button', { name: /sign in/i }).click();
}

export const TEST_PASSWORD = 'E2eTestPass123!';

export const TEST_USERS = {
  admin: { email: 'e2e_admin@ientest.local', name: 'E2E Admin', role: 'admin' },
  agentA: { email: 'e2e_agent_a@ientest.local', name: 'E2E Agent A', role: 'agent' },
  agentB: { email: 'e2e_agent_b@ientest.local', name: 'E2E Agent B', role: 'agent' },
} as const;

export const STATE_FILE = resolve(process.cwd(), 'tests/e2e/.state.json');
