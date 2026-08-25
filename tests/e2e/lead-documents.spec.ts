import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/);
}

const TEST_FILE = resolve(process.cwd(), 'tests/e2e/fixtures/test-doc.png');

test('Create query captures passport + reference fields and attaches a document', async ({
  page,
}) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto('/leads');

  await page.getByRole('button', { name: /create query/i }).click();
  await expect(page.getByRole('heading', { name: /create query/i })).toBeVisible();

  const fullName = `E2E Query Lead ${Date.now()}`;
  await page.locator('#full_name').fill(fullName);
  await page.locator('#utm_source').selectOption('old_student_reference');
  await page.locator('#reference_name').fill('Old Student X');
  await page.locator('#reference_note').fill('Studied at Toronto, refers a lot.');
  await page.locator('#passport_number').fill('CD9876543');
  await page.locator('#document').setInputFiles(TEST_FILE);

  await page.getByRole('button', { name: /^save$/i }).click();

  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const createdLeadId = page.url().split('/leads/')[1];
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();

  try {
    // Persistent fields saved correctly.
    await expect(page.getByText('Old Student X')).toBeVisible();
    await expect(page.getByText('Studied at Toronto, refers a lot.')).toBeVisible();
    await expect(page.getByText('CD9876543')).toBeVisible();

    // Deferred document upload completed after the lead was created.
    await expect(page.getByText('test-doc.png')).toBeVisible();
  } finally {
    // This lead isn't one of global-setup's tracked fixtures, so clean it
    // up here rather than leaving it behind in the test org.
    await serviceClient().from('leads').delete().eq('id', createdLeadId);
  }
});

test("lead's document upload link works for an anonymous visitor and regenerating invalidates the old one", async ({
  page,
  browser,
}) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${state().leadB}`);
  await expect(page.getByRole('heading', { name: /E2E Lead B/ })).toBeVisible();

  const originalUrl = (await page.locator('code').textContent())?.trim();
  expect(originalUrl).toBeTruthy();

  // Anonymous visitor, separate context (no staff session).
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(originalUrl!);
  await expect(publicPage.getByRole('heading', { name: /upload your documents/i })).toBeVisible();
  await publicPage.locator('input[type="file"]').setInputFiles(TEST_FILE);
  await publicPage.getByRole('button', { name: /^upload$/i }).click();
  await expect(publicPage.getByText(/uploaded test-doc\.png/i)).toBeVisible();
  await publicContext.close();

  // Staff side sees it, tagged as coming from the lead.
  await page.reload();
  await expect(page.getByText('test-doc.png').first()).toBeVisible();
  await expect(page.getByText(/from lead/i)).toBeVisible();

  // Regenerating rotates the token — the old link stops resolving at all.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /regenerate/i }).click();

  let newUrl: string | undefined;
  await expect(async () => {
    newUrl = (await page.locator('code').textContent())?.trim();
    expect(newUrl).toBeTruthy();
    expect(newUrl).not.toEqual(originalUrl);
  }).toPass({ timeout: 10000 });

  const staleContext = await browser.newContext();
  const stalePage = await staleContext.newPage();
  const res = await stalePage.goto(originalUrl!);
  expect(res?.status()).toBe(404);
  await staleContext.close();
});
