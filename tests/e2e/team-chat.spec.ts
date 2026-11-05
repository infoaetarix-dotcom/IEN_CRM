import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient, loadEnv } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { org: string; users: Record<string, string> };
}

/** A logged-in page in its own browser context (separate cookies = separate person). */
async function loginAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  return page;
}

async function asUser(email: string) {
  const env = loadEnv();
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  return c;
}

const lastBubble = (page: Page) => page.getByRole('log', { name: 'Messages' }).getByRole('button').last();

async function cleanChats(org: string) {
  const svc = serviceClient();
  await svc.from('chat_conversations').delete().eq('organization_id', org);
  await svc.from('notifications').delete().eq('organization_id', org).eq('type', 'chat_message');
  await svc.from('chat_presence').delete().eq('organization_id', org);
}

test.describe.serial('team chat', () => {
  test.afterAll(async () => {
    await cleanChats(state().org);
  });

  test('direct chat: one tick, two ticks, blue ticks; one bell notification without the message; unread badge', async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const { org, users } = state();
    const svc = serviceClient();
    await cleanChats(org);

    const admin = await loginAs(browser, TEST_USERS.admin.email);
    await admin.goto('/messages');
    await admin.getByRole('button', { name: /new chat/i }).click();
    await admin.getByRole('dialog').getByRole('button', { name: /E2E Agent A/ }).click();
    const box = admin.getByLabel('Type a message');

    // Agent A is offline (never opened the CRM) → one grey tick.
    await box.fill('First message');
    await box.press('Enter');
    await expect(lastBubble(admin).getByLabel('Sent')).toBeVisible({ timeout: 30000 });

    // Agent A opens the CRM (dashboard, not the chat) → delivered: two grey ticks.
    const agent = await loginAs(browser, TEST_USERS.agentA.email);
    await expect(lastBubble(admin).getByLabel('Delivered')).toBeVisible({ timeout: 45000 });

    // Agent A's bell says who, never what; the sidebar badge counts messages.
    for (const text of ['Second message', 'Third message']) {
      await box.fill(text);
      await box.press('Enter');
    }
    await expect(agent.getByRole('link', { name: 'Messages' }).getByLabel('3 unread')).toBeVisible({ timeout: 45000 });
    await agent.getByRole('button', { name: 'Notifications' }).click();
    await expect(agent.getByText('You have a new message from E2E Admin')).toHaveCount(1);
    await expect(agent.getByText('Second message')).toHaveCount(0);
    await agent.keyboard.press('Escape');
    const { data: notes } = await svc
      .from('notifications')
      .select('title, body')
      .eq('profile_id', users.agentA)
      .eq('type', 'chat_message');
    expect(notes).toEqual([{ title: 'You have a new message from E2E Admin', body: null }]);

    // Agent A opens the chat → admin's ticks turn blue, badge and notification clear.
    await agent.getByRole('link', { name: 'Messages' }).click();
    await agent.getByRole('button', { name: /E2E Admin/ }).click();
    await expect(agent.getByText('Third message')).toBeVisible();
    await expect(lastBubble(admin).getByLabel('Seen')).toBeVisible({ timeout: 45000 });
    await expect(agent.getByRole('link', { name: 'Messages' }).getByLabel(/unread/)).toHaveCount(0);
    const { data: after } = await svc
      .from('notifications')
      .select('read_at')
      .eq('profile_id', users.agentA)
      .eq('type', 'chat_message');
    expect(after?.[0]?.read_at).not.toBeNull();

    // A reply shows up live for the admin.
    const agentBox = agent.getByLabel('Type a message');
    await agentBox.fill('Reply from agent');
    await agentBox.press('Enter');
    await expect(admin.getByRole('log', { name: 'Messages' }).getByText('Reply from agent')).toBeVisible({ timeout: 30000 });

    await admin.context().close();
    await agent.context().close();
  });

  test('email: once per unread streak, only while offline', async ({ browser }) => {
    test.setTimeout(180000);
    const { users } = state();
    const svc = serviceClient();
    // Agent B has never had the CRM open → offline.
    await svc.from('chat_presence').delete().eq('profile_id', users.agentB);

    const admin = await loginAs(browser, TEST_USERS.admin.email);
    await admin.goto('/messages');
    await admin.getByRole('button', { name: /new chat/i }).click();
    await admin.getByRole('dialog').getByRole('button', { name: /E2E Agent B/ }).click();
    const box = admin.getByLabel('Type a message');
    await box.fill('one');
    await box.press('Enter');
    await expect(lastBubble(admin).getByLabel('Sent')).toBeVisible({ timeout: 30000 });

    const emailedAt = async () =>
      (
        await svc
          .from('chat_members')
          .select('last_emailed_at, chat_conversations!inner(kind)')
          .eq('profile_id', users.agentB)
          .eq('chat_conversations.kind', 'direct')
          .single()
      ).data?.last_emailed_at ?? null;

    // The bell + email step runs just after the send; it records the email.
    await expect.poll(emailedAt, { timeout: 30000 }).not.toBeNull();
    const first = await emailedAt();

    // Still unread → a second message doesn't email again.
    await box.fill('two');
    await box.press('Enter');
    await expect(lastBubble(admin).getByLabel('Sent')).toBeVisible({ timeout: 30000 });
    await admin.waitForTimeout(5000);
    expect(await emailedAt()).toBe(first);

    await admin.context().close();
  });

  test('groups: admins only create them; members see "who has seen it"; privacy holds', async ({ browser }) => {
    test.setTimeout(240000);
    const { org, users } = state();

    // Agents can't create groups — no button, and the database refuses.
    const asAgentA = await asUser(TEST_USERS.agentA.email);
    const { error: agentGroupErr } = await asAgentA.rpc('chat_create_group', { group_name: 'Nope', member_ids: [users.agentB] });
    expect(agentGroupErr?.message).toMatch(/only admins/i);

    const admin = await loginAs(browser, TEST_USERS.admin.email);
    await admin.goto('/messages');
    await admin.getByRole('button', { name: /new group/i }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByLabel('Group name').fill('Admissions team');
    await dialog.getByRole('checkbox').nth(0).check();
    await dialog.getByRole('checkbox').nth(1).check();
    await dialog.getByRole('button', { name: /create group/i }).click();
    await expect(admin.getByRole('button', { name: /Admissions team/ })).toBeVisible({ timeout: 30000 });
    const box = admin.getByLabel('Type a message');
    await box.fill('Hello team');
    await box.press('Enter');
    await expect(lastBubble(admin).getByLabel(/Sent|Delivered/)).toBeVisible({ timeout: 30000 });
    await lastBubble(admin).click();
    await expect(admin.getByRole('list', { name: 'Message info' })).toBeVisible();

    // A group notification names the group, not the message.
    const svc = serviceClient();
    await expect
      .poll(async () => (await svc.from('notifications').select('title').eq('profile_id', users.agentA).eq('type', 'chat_message').order('created_at', { ascending: false }).limit(1)).data?.[0]?.title, { timeout: 30000 })
      .toBe('E2E Admin sent a message in Admissions team');

    // Agent B isn't in the admin ↔ Agent A chat: can't read it.
    const asAgentB = await asUser(TEST_USERS.agentB.email);
    const { data: direct } = await svc.from('chat_conversations').select('id').eq('organization_id', org).eq('kind', 'direct').like('direct_key', `%${users.agentA}%`).like('direct_key', `%${users.admin}%`).single();
    const { data: peek } = await asAgentB.from('chat_messages').select('id').eq('conversation_id', direct!.id);
    expect(peek ?? []).toHaveLength(0);
    const { error: sneak } = await asAgentB.from('chat_messages').insert({ organization_id: org, conversation_id: direct!.id, sender_id: users.agentB, body: 'sneak' });
    expect(sneak).not.toBeNull();

    await admin.context().close();
  });

  test('super admins can see the org’s leads but not its chats; module off hides and blocks chat', async ({ browser }) => {
    test.setTimeout(180000);
    const { org } = state();
    const svc = serviceClient();
    const email = `e2e_super_chat_${Date.now()}@ientest.local`;
    const { data: created } = await svc.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    const uid = created.user!.id;
    await svc.from('profiles').update({ role: 'admin', full_name: 'E2E Super Chat', is_super_admin: true, organization_id: null }).eq('id', uid);

    try {
      const asSuper = await asUser(email);
      const { data: leads } = await asSuper.from('leads').select('id').eq('organization_id', org);
      expect((leads ?? []).length).toBeGreaterThan(0); // normal cross-org access
      const { data: msgs } = await asSuper.from('chat_messages').select('id').eq('organization_id', org);
      expect(msgs ?? []).toHaveLength(0); // but never chats
      const { data: convs } = await asSuper.from('chat_conversations').select('id').eq('organization_id', org);
      expect(convs ?? []).toHaveLength(0);
    } finally {
      await svc.from('profiles').delete().eq('id', uid);
      await svc.auth.admin.deleteUser(uid);
    }

    // Module off: no Messages link, page redirects, database refuses.
    await svc.from('organization_modules').update({ enabled: false }).eq('organization_id', org).eq('module_key', 'team_chat');
    try {
      const admin = await loginAs(browser, TEST_USERS.admin.email);
      await expect(admin.getByRole('link', { name: 'Messages' })).toHaveCount(0);
      await admin.goto('/messages');
      await admin.waitForURL(/\/dashboard/);
      const asAdmin = await asUser(TEST_USERS.admin.email);
      const { data: hidden } = await asAdmin.from('chat_messages').select('id').eq('organization_id', org);
      expect(hidden ?? []).toHaveLength(0);
      await admin.context().close();
    } finally {
      await svc.from('organization_modules').update({ enabled: true }).eq('organization_id', org).eq('module_key', 'team_chat');
    }
    // Messages survive the switch-off.
    const { count } = await svc.from('chat_messages').select('id', { count: 'exact', head: true }).eq('organization_id', org);
    expect(count).toBeGreaterThan(0);
  });
});
