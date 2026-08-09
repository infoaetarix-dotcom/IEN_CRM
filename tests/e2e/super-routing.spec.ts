import { test, expect } from '@playwright/test';
import { serviceClient, TEST_PASSWORD, submitLogin } from './helpers';

/**
 * A super admin has cross-org RLS access, so if they land in the org CRM they
 * see every consultancy's data at once. Their console is /super — this pins
 * that routing.
 */
test('a super admin is kept out of the org CRM and routed to /super', async ({
  page,
}) => {
  const svc = serviceClient();
  const email = `e2e_super_${Date.now()}@ientest.local`;

  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Super Admin' },
  });
  if (error || !created.user) throw new Error(`create user: ${error?.message}`);
  const uid = created.user.id;

  await svc
    .from('profiles')
    .update({
      role: 'admin',
      full_name: 'E2E Super Admin',
      is_super_admin: true,
      organization_id: null,
    })
    .eq('id', uid);

  try {
    await submitLogin(page, email, TEST_PASSWORD);

    // Sign-in lands on the platform console, not a tenant dashboard.
    await page.waitForURL(/\/super/);

    // Direct navigation into the org CRM bounces back to /super.
    for (const path of ['/dashboard', '/leads']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/super/);
    }

    // Revisiting /login while signed in must not drop them into the CRM.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/super/);
  } finally {
    await svc.from('audit_log').delete().eq('actor_id', uid);
    await svc.auth.admin.deleteUser(uid).catch(() => {});
  }
});
