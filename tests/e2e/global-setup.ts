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

export default async function globalSetup() {
  const svc = serviceClient();
  const ids: Record<string, string> = {};

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
      .update({ role: u.role, full_name: u.name })
      .eq('id', data.user.id);
  }

  // Two leads for the RLS isolation spec.
  const { data: leadA } = await svc
    .from('leads')
    .insert({
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
    JSON.stringify({ users: ids, leadA: leadA?.id, leadB: leadB?.id }, null, 2),
  );
}
