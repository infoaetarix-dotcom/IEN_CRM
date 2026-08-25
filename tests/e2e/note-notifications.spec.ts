import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/);
}

async function openBell(page: Page) {
  await page.getByRole('button', { name: /notifications/i }).click();
}

test('adding a note on a lead notifies other staff (not the author) and links to the lead', async ({
  browser,
}) => {
  const authorCtx = await browser.newContext();
  const authorPage = await authorCtx.newPage();
  await login(authorPage, TEST_USERS.agentA.email);
  await authorPage.goto(`/leads/${state().leadA}`);
  await expect(authorPage.getByRole('heading', { name: /E2E Lead A/ })).toBeVisible();

  const noteBody = `E2E note check ${Date.now()}`;
  await authorPage.getByPlaceholder(/add a note/i).fill(noteBody);
  await authorPage.getByRole('button', { name: /^add note$/i }).click();
  await expect(authorPage.getByText(noteBody)).toBeVisible();

  // A different staff member sees an in-app notification for it.
  const viewerCtx = await browser.newContext();
  const viewerPage = await viewerCtx.newPage();
  await login(viewerPage, TEST_USERS.admin.email);
  await openBell(viewerPage);
  await expect(viewerPage.getByText(/E2E Agent A added a note on E2E Lead A/i)).toBeVisible();
  await viewerPage.getByText(/E2E Agent A added a note on E2E Lead A/i).click();
  await viewerPage.waitForURL(new RegExp(`/leads/${state().leadA}$`));
  await viewerCtx.close();

  // The author does not get a notification about their own note.
  await authorPage.reload();
  await openBell(authorPage);
  await expect(
    authorPage.getByText(/E2E Agent A added a note on E2E Lead A/i),
  ).toHaveCount(0);
  await authorCtx.close();
});

test('adding a note on an application notifies staff, and the application status set is unchanged (still 6 values)', async ({
  browser,
}) => {
  const svc = serviceClient();
  const { org, leadB } = state() as { org: string; leadB: string };
  const { data: app, error } = await svc
    .from('applications')
    .insert({ organization_id: org, lead_id: leadB, full_name: 'E2E Lead B' })
    .select('id')
    .single();
  if (error || !app) throw new Error(`seed application: ${error?.message}`);

  const authorCtx = await browser.newContext();
  const authorPage = await authorCtx.newPage();
  await login(authorPage, TEST_USERS.agentA.email);
  await authorPage.goto(`/applications/${app.id}`);

  // Status set is the original 6 values, untouched by the lead-status collapse.
  const statusSelect = authorPage.locator('select').first();
  const labels = await statusSelect.locator('option').allTextContents();
  expect(labels).toEqual(['New', 'Contacted', 'In progress', 'Accepted', 'Rejected', 'Follow-up']);
  // getByText('Contacted') would also match the (hidden) <option> itself,
  // so check the control's own value updated instead of hunting for text.
  await statusSelect.selectOption('contacted');
  await expect(statusSelect).toHaveValue('contacted');

  const noteBody = `E2E application note ${Date.now()}`;
  await authorPage.getByPlaceholder(/add a note/i).fill(noteBody);
  await authorPage.getByRole('button', { name: /^add note$/i }).click();
  await expect(authorPage.getByText(noteBody)).toBeVisible();
  await authorCtx.close();

  const viewerCtx = await browser.newContext();
  const viewerPage = await viewerCtx.newPage();
  await login(viewerPage, TEST_USERS.admin.email);
  await openBell(viewerPage);
  await expect(viewerPage.getByText(/E2E Agent A added a note on E2E Lead B/i)).toBeVisible();
  await viewerPage.getByText(/E2E Agent A added a note on E2E Lead B/i).click();
  await viewerPage.waitForURL(new RegExp(`/applications/${app.id}$`));
  await viewerCtx.close();

  await svc.from('applications').delete().eq('id', app.id);
});
