-- Extend the shared-visibility model (0008) to delete: any active member of
-- an org can delete any lead in it, not just admins. organization_id stays
-- the tenant boundary.

drop policy if exists leads_delete on leads;
create policy leads_delete on leads for delete using (
  public.is_super_admin()
  or organization_id = public.current_org()
);
