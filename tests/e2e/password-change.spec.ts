import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { serviceClient, STATE_FILE } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

test('new staff are forced to change their temporary password on first login', async ({
  page,
}) => {
  const svc = serviceClient();
  const email = `pwtest_${Date.now()}@ientest.local`;
  const tempPassword = 'TempPass123!';
  const newPassword = 'MyChosenPass456!';

  // Create a staff user with the force-change flag set (as createAgent does).
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: 'PW Test User' },
  });
  if (error || !created.user) throw new Error(`create user: ${error?.message}`);
  const uid = created.user.id;
  await svc
    .from('profiles')
    .update({
      role: 'agent',
      full_name: 'PW Test User',
      organization_id: state().org,
      must_change_password: true,
    })
    .eq('id', uid);

  try {
    // Sign in with the temporary password.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(tempPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Forced onto /change-password — the CRM is blocked until they set one.
    await page.waitForURL(/\/change-password/);
    await expect(
      page.getByRole('heading', { name: /set your password/i }),
    ).toBeVisible();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/change-password/);

    // Set a new password → lands on the dashboard; flag is cleared.
    await page.getByLabel('New password').fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: /update password/i }).click();
    await page.waitForURL(/\/dashboard/);

    const { data: prof } = await svc
      .from('profiles')
      .select('must_change_password')
      .eq('id', uid)
      .single();
    expect(prof!.must_change_password).toBe(false);
  } finally {
    // audit_log FK is RESTRICT — clear it before deleting the auth user.
    await svc.from('audit_log').delete().eq('actor_id', uid);
    await svc.auth.admin.deleteUser(uid).catch(() => {});
  }
});
