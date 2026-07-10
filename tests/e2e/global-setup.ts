import { writeFileSync } from 'node:fs';
import {
  serviceClient,
  TEST_USERS,
  TEST_PASSWORD,
  STATE_FILE,
} from './helpers';

/**
 * Creates ephemeral test users + two leads (assigned to agent A and agent B)
 * directly via the service role. Idempotent: removes any prior test users
 * first. IDs are written to .state.json for the specs and the teardown.
 */
async function findUserByEmail(svc: ReturnType<typeof serviceClient>, email: string) {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email === email);
}

const TEST_ORG_SLUG = 'e2e-test-org';

export default async function globalSetup() {
  const svc = serviceClient();
  const ids: Record<string, string> = {};

  // Dedicated test organization (isolated from real tenants).
  await svc.from('organizations').delete().eq('slug', TEST_ORG_SLUG);
  const { data: org, error: orgErr } = await svc
    .from('organizations')
    .insert({ name: 'E2E Test Org', slug: TEST_ORG_SLUG })
    .select('id')
    .single();
  if (orgErr || !org) throw new Error(`create org: ${orgErr?.message}`);
  const orgId = org.id as string;

  // Enable every module for the test org.
  const { data: modules } = await svc.from('modules').select('key');
  if (modules?.length) {
    await svc.from('organization_modules').insert(
      modules.map((m: { key: string }) => ({
        organization_id: orgId,
        module_key: m.key,
      })),
    );
  }

  for (const [key, u] of Object.entries(TEST_USERS)) {
    const existing = await findUserByEmail(svc, u.email);
    if (existing) await svc.auth.admin.deleteUser(existing.id);
    const { data, error } = await svc.auth.admin.createUser({
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (error || !data.user) throw new Error(`create ${u.email}: ${error?.message}`);
    ids[key] = data.user.id;
    await svc
      .from('profiles')
      .update({ role: u.role, full_name: u.name, organization_id: orgId })
      .eq('id', data.user.id);
  }

  // Two leads for the RLS isolation spec.
  const { data: leadA } = await svc
    .from('leads')
    .insert({
      organization_id: orgId,
      full_name: 'E2E Lead A',
      email: 'e2e_lead_a@example.com',
      phone: '+10000000001',
      consent_given: true,
      assigned_to: ids.agentA,
      utm_source: 'instagram',
    })
    .select('id')
    .single();
  const { data: leadB } = await svc
    .from('leads')
    .insert({
      organization_id: orgId,
      full_name: 'E2E Lead B',
      email: 'e2e_lead_b@example.com',
      phone: '+10000000002',
      consent_given: true,
      assigned_to: ids.agentB,
      utm_source: 'facebook',
    })
    .select('id')
    .single();

  writeFileSync(
    STATE_FILE,
    JSON.stringify(
      { org: orgId, users: ids, leadA: leadA?.id, leadB: leadB?.id },
      null,
      2,
    ),
  );
}
