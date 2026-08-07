-- Drop per-agent lead privacy: every active member of an organization (admin
-- or agent) can now read and update any lead in that organization, not just
-- leads assigned to them. organization_id stays the tenant boundary — cross-
-- org isolation is unchanged. Admin-vs-agent role assignment is enforced in
-- application code only (app/(admin)/agents/actions.ts no longer accepts a
-- client-supplied role; admins are created exclusively by the super admin at
-- org signup), so no profiles policy change is needed here.

drop policy if exists leads_read on leads;
create policy leads_read on leads for select using (
  public.is_super_admin()
  or organization_id = public.current_org()
);

drop policy if exists leads_update on leads;
create policy leads_update on leads for update using (
  public.is_super_admin()
  or organization_id = public.current_org()
) with check (
  public.is_super_admin()
  or organization_id = public.current_org()
);

-- leads_delete is unchanged: admins (and super admin) only.
