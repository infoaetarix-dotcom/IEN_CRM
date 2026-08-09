import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, serviceClient, submitLogin } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/);
}

test('admin can archive, restore, then permanently delete a lead', async ({
  page,
}) => {
  const svc = serviceClient();
  const { data: lead } = await svc
    .from('leads')
    .insert({
      organization_id: state().org,
      full_name: 'Archive Test Lead',
      email: `archive_${Date.now()}@example.com`,
      phone: '+923004445566',
      consent_given: true,
      utm_source: 'instagram',
    })
    .select('id')
    .single();
  const leadId = lead!.id as string;

  try {
    await login(page, TEST_USERS.admin.email);

    // Archive from the detail page.
    await page.goto(`/leads/${leadId}`);
    await expect(
      page.getByRole('heading', { name: /Archive Test Lead/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: /archive lead/i }).click();
    await expect(page.getByText(/^Archived$/).first()).toBeVisible();

    // Hidden from the active list, present in the archived list.
    await page.goto('/leads');
    await expect(page.getByText('Archive Test Lead')).toHaveCount(0);
    await page.goto('/leads?archived=1');
    await expect(page.getByText('Archive Test Lead')).toBeVisible();

    // Restore from the detail page → the Archive button returns.
    await page.goto(`/leads/${leadId}`);
    await page.getByRole('button', { name: /restore lead/i }).click();
    await expect(
      page.getByRole('button', { name: /archive lead/i }),
    ).toBeVisible();

    // Permanently delete (with confirmation) → bounced back to /leads.
    await page.getByRole('button', { name: /delete permanently/i }).click();
    await page.getByRole('button', { name: /yes, delete/i }).click();
    await page.waitForURL(/\/leads(\?|$)/);

    // Row is gone from the database.
    const { data: gone } = await svc
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .maybeSingle();
    expect(gone).toBeNull();
  } finally {
    // Safety net if the test failed before the delete step ran.
    await svc.from('leads').delete().eq('id', leadId);
  }
});
