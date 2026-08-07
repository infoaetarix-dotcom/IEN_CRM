-- Who created a lead. Nullable — public-form submissions have no session to
-- attribute to (see startLead), only staff-created ones (via the new
-- /leads/new "Create Query" flow) get stamped. No RLS change needed: leads
-- are already org-shared (0008), and this column carries no access meaning
-- of its own — it's informational, same as assigned_to.

alter table leads
  add column if not exists created_by uuid references profiles(id) on delete set null;

create index if not exists idx_leads_created_by on leads(created_by);
