-- Two changes:
--
-- 1. notes_read / notes_insert (and history_read / messages_read, which had
--    the exact same gap) still used the pre-shared-visibility pattern from
--    before 0008 — admin OR the lead's assigned agent only. Extend them to
--    the same org-wide shared model already applied to leads_read/update/
--    delete, so any active org member can read and write notes (and see
--    status history / message logs) on any lead in their org.
--
-- 2. profiles has no email column — email lives only in auth.users, which
--    isn't queryable by regular authenticated clients, so there was no way
--    to show a note's author email to anyone but that author themself.
--    Add profiles.email (kept in sync at signup via handle_new_user()),
--    backfill existing rows, and open profiles_read to the org (previously
--    agents could only read their own profile row) so that email is visible
--    to whoever needs to display "written by".

alter table profiles add column if not exists email text;

update profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'agent', new.email);
  return new;
end; $$;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (
  id = auth.uid()
  or public.is_super_admin()
  or organization_id = public.current_org()
);

drop policy if exists notes_read on lead_notes;
create policy notes_read on lead_notes for select using (
  public.is_super_admin() or organization_id = public.current_org()
);

drop policy if exists notes_insert on lead_notes;
create policy notes_insert on lead_notes for insert with check (
  author_id = auth.uid() and organization_id = public.current_org()
);

drop policy if exists history_read on lead_status_history;
create policy history_read on lead_status_history for select using (
  public.is_super_admin() or organization_id = public.current_org()
);

drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (
  public.is_super_admin() or organization_id = public.current_org()
);
