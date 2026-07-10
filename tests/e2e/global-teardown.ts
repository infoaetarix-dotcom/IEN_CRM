import { readFileSync, rmSync } from 'node:fs';
import { serviceClient, STATE_FILE } from './helpers';

/** Removes all ephemeral test users and leads created in global-setup. */
export default async function globalTeardown() {
  const svc = serviceClient();
  let state: {
    org?: string;
    users: Record<string, string>;
    leadA?: string;
    leadB?: string;
  };
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return;
  }

  for (const id of [state.leadA, state.leadB]) {
    if (id) await svc.from('leads').delete().eq('id', id);
  }
  // Profile FKs from audit_log/history/messages/notes are RESTRICT/no-action,
  // so clear them before deleting the auth user (else delete returns 500).
  for (const id of Object.values(state.users ?? {})) {
    await svc.from('audit_log').delete().eq('actor_id', id);
    await svc.from('lead_notes').delete().eq('author_id', id);
    await svc.from('lead_status_history').update({ changed_by: null }).eq('changed_by', id);
    await svc.from('messages').update({ sent_by: null }).eq('sent_by', id);
    await svc.auth.admin.deleteUser(id).catch(() => {});
  }
  // Remove the test org (cascades to organization_modules).
  if (state.org) await svc.from('organizations').delete().eq('id', state.org);
  try {
    rmSync(STATE_FILE);
  } catch {
    /* ignore */
  }
}
