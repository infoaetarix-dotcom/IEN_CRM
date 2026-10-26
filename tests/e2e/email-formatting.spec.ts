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
 * The compose box, the email history and the email as sent must look alike —
 * Tailwind's preflight used to strip bullets/spacing from the first two.
 * Nothing here sends an email: the compose box is filled but never sent, and
 * the history row is seeded directly.
 */
test('compose box shows lists and keeps text typed after toolbar clicks', async ({ page }) => {
  test.setTimeout(120000);
  const { leadA } = state() as { leadA: string };

  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${leadA}`);
  await page.getByRole('button', { name: 'Email' }).first().click();
  const dlg = page.getByRole('dialog');
  const ed = dlg.locator('.ProseMirror');
  await ed.click();

  await page.keyboard.type('Please send:');
  await page.keyboard.press('Enter');
  await dlg.getByTitle('Bullet list').click();
  await page.keyboard.type('Passport copy');
  await page.keyboard.press('Enter');
  await dlg.getByTitle('Bold').click();
  await page.keyboard.type('IELTS');
  await dlg.getByTitle('Bold').click();
  await page.keyboard.type(' score report');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Numbered steps:');
  await page.keyboard.press('Enter');
  await dlg.getByTitle('Numbered list').click();
  await page.keyboard.type('Fill the form');

  // Nothing typed after a toolbar click went missing.
  const html = await ed.innerHTML();
  expect(html).toContain('<strong>IELTS</strong> score report');
  expect(html).toContain('Numbered steps:');
  expect(html).toContain('Fill the form');

  // Lists look like lists while writing.
  expect(await ed.locator('ul').evaluate((el) => getComputedStyle(el).listStyleType)).toBe('disc');
  expect(await ed.locator('ol').evaluate((el) => getComputedStyle(el).listStyleType)).toBe('decimal');

  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('email history renders like the sent email, with its signature, on lead and application pages', async ({
  page,
}) => {
  test.setTimeout(120000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };

  const { data: sig, error: sigErr } = await svc
    .from('email_signatures')
    .insert({
      organization_id: org,
      title: 'E2E Signature',
      body_html: '<p><strong>E2E Admissions Desk</strong></p>',
    })
    .select('id')
    .single();
  if (sigErr || !sig) throw new Error(`seed signature: ${sigErr?.message}`);

  const { data: msg, error: msgErr } = await svc
    .from('messages')
    .insert({
      organization_id: org,
      lead_id: leadA,
      channel: 'email',
      status: 'sent',
      subject: 'E2E Formatting Check',
      body_is_html: true,
      signature_id: sig.id,
      body: '<p>Hello,</p><ul><li><p>Passport</p></li><li><p><strong>IELTS</strong> result</p></li></ul><ol><li><p>Fill the form</p></li></ol><p>Thanks</p>',
    })
    .select('id')
    .single();
  if (msgErr || !msg) throw new Error(`seed message: ${msgErr?.message}`);

  const { data: uni } = await svc
    .from('universities')
    .insert({ organization_id: org, name: 'E2E Email History Uni', country: 'Ireland' })
    .select('id')
    .single();
  const { data: app, error: appErr } = await svc
    .from('applications')
    .insert({ lead_id: leadA, organization_id: org, full_name: 'E2E Lead A', university_id: uni!.id })
    .select('id')
    .single();
  if (appErr || !app) throw new Error(`seed application: ${appErr?.message}`);

  try {
    await login(page, TEST_USERS.admin.email);

    for (const path of [`/leads/${leadA}`, `/applications/${app.id}`]) {
      await page.goto(path);
      await expect(page.getByText('E2E Formatting Check').first()).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /see previous email/i }).click();
      const dialog = page.getByRole('dialog');
      const entry = dialog.locator('div.rounded-lg', { hasText: 'E2E Formatting Check' });

      const ul = entry.locator('ul');
      expect(await ul.evaluate((el) => getComputedStyle(el).listStyleType)).toBe('disc');
      expect(await entry.locator('ol').evaluate((el) => getComputedStyle(el).listStyleType)).toBe('decimal');
      await expect(ul.locator('li')).toHaveCount(2);
      // Same 15px body text as the sent email (lib/email/brevo.ts wrapper).
      expect(await ul.evaluate((el) => getComputedStyle(el).fontSize)).toBe('15px');
      await expect(entry.getByText('E2E Admissions Desk')).toBeVisible();

      await page.keyboard.press('Escape');
    }
  } finally {
    await svc.from('applications').delete().eq('id', app.id);
    await svc.from('universities').delete().eq('id', uni!.id);
    await svc.from('messages').delete().eq('id', msg.id);
    await svc.from('email_signatures').delete().eq('id', sig.id);
  }
});
