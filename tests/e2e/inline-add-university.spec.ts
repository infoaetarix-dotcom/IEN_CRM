import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

/**
 * A university missing from the list can be added from inside the Create
 * application popup — it's created, selected, and the flow carries on — and
 * the same name + country can't be added twice.
 */
test('Create application: add a missing university in place, then continue', async ({ page }) => {
  test.setTimeout(120000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };
  const uniName = `E2E Inline Uni ${Date.now()}`;

  try {
    await login(page, TEST_USERS.admin.email);
    await page.goto(`/leads/${leadA}`);
    await page.getByRole('button', { name: /create application/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Which university is this application for?')).toBeVisible();

    // Search for it, then use the picker's "Add … as a new university" action.
    await dialog.getByRole('combobox').click();
    await page.getByPlaceholder('Search universities…').fill(uniName);
    await page.getByRole('button', { name: `Add “${uniName}” as a new university` }).click();

    // Inline form opens pre-filled with the search text; country defaults to UK.
    await expect(dialog.getByText('Add a new university')).toBeVisible();
    await expect(dialog.getByLabel('University name')).toHaveValue(uniName);
    await dialog.getByRole('button', { name: /^add university$/i }).click();

    // Back on the picker with the new university already selected.
    await expect(dialog.getByRole('combobox')).toHaveText(`${uniName} (United Kingdom)`, {
      timeout: 30000,
    });

    const { data: rows } = await svc
      .from('universities')
      .select('id, organization_id, country')
      .eq('name', uniName);
    expect(rows).toHaveLength(1);
    expect(rows![0]!.organization_id).toBe(org);
    expect(rows![0]!.country).toBe('United Kingdom');

    // Adding the same one again (different case) is refused.
    await dialog.getByRole('button', { name: /university not listed\? add it here/i }).click();
    await dialog.getByLabel('University name').fill(uniName.toUpperCase());
    await dialog.getByRole('button', { name: /^add university$/i }).click();
    await expect(dialog.getByText(/already added/i)).toBeVisible({ timeout: 30000 });
    await dialog.getByRole('button', { name: /^cancel$/i }).first().click();

    // Selection survived, and the flow continues to the application form.
    await expect(dialog.getByRole('combobox')).toHaveText(`${uniName} (United Kingdom)`);
    await dialog.getByRole('button', { name: /^continue$/i }).click();
    await expect(dialog.getByText(/pre-filled from the lead/i)).toBeVisible({ timeout: 30000 });
  } finally {
    await svc.from('universities').delete().eq('organization_id', org).ilike('name', uniName);
  }
});
