import { test, expect } from '@playwright/test';

// The full email → reset-link → /update-password flow depends on Supabase Auth
// config (Site URL, redirect allowlist, SMTP) and a real inbox, so it's verified
// manually. This covers the request page + anti-enumeration confirmation.
test('forgot-password page submits a reset request and confirms generically', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await expect(page.getByText(/reset your password/i)).toBeVisible();

  await page
    .getByLabel('Email', { exact: true })
    .fill(`nobody_${Date.now()}@example.com`);
  await page.getByRole('button', { name: /send reset link/i }).click();

  // Always the same message, whether or not the account exists.
  await expect(page.getByText(/we.?ve sent a link/i)).toBeVisible();
});
