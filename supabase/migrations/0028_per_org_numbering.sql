-- ============================================================
-- 0028_per_org_numbering.sql — Scope lead_number / application_number to
-- each organization instead of one global counter.
-- ------------------------------------------------------------
-- BUG: both `set_lead_number()` (0010) and `set_application_number()`
-- (0022) compute `max(...) + 1` with a bare `select ... from leads` /
-- `select ... from applications` — no organization_id filter. Neither
-- function is SECURITY DEFINER, so that subquery runs under the calling
-- user's own RLS. For `leads` this never showed up because the public
-- apply form always inserts through the service-role client, which
-- bypasses RLS. For `applications`, admins/agents insert through their own
-- authenticated session, so the RLS policy (`organization_id =
-- current_org()`) silently limits the MAX() to that org's own rows.
--
-- IEN has been the platform's only real org so far, so IEN's own max has
-- always equaled the true table-wide max — the bug was invisible. The
-- moment a second org inserts its first row, its RLS-scoped max comes back
-- 0/NULL, the trigger computes application_number = 1 (or lead_number = 1),
-- and that collides with the *global* unique constraint against an
-- unrelated org's existing row #1 — a deterministic 23505 on every second
-- tenant's first insert.
--
-- FIX: make numbering genuinely per-organization, which is also the
-- correct product behavior for a multi-tenant SaaS — a new consultancy
-- should see their own Application #1 / Lead #1, not a number reflecting
-- total platform-wide volume across unrelated tenants. Scoping the
-- trigger's MAX() by organization_id also fixes the RLS gap without
-- needing SECURITY DEFINER: a row's own org is always visible to the user
-- inserting it (that's what the `with check` on the RLS policy enforces).
--
-- SAFE ON A LIVE TABLE: renumbers existing rows in place (per org, in their
-- existing order — same technique 0010 used), then narrows both unique
-- constraints to (organization_id, number). No data loss; only the numeric
-- values of pre-existing lead/application numbers change, re-packed
-- per-org starting at 1.
-- ============================================================

-- ---- leads.lead_number ----------------------------------------------

alter table leads drop constraint if exists leads_lead_number_key;

with ordered as (
  select id, row_number() over (partition by organization_id order by lead_number) as rn
  from leads
)
update leads set lead_number = ordered.rn
from ordered
where leads.id = ordered.id;

alter table leads add constraint leads_org_lead_number_key unique (organization_id, lead_number);

create or replace function public.set_lead_number() returns trigger
language plpgsql as $$
begin
  if new.lead_number is null then
    new.lead_number := coalesce(
      (select max(lead_number) from leads where organization_id = new.organization_id),
      0
    ) + 1;
  end if;
  return new;
end;
$$;

-- ---- applications.application_number ---------------------------------

alter table applications drop constraint if exists applications_application_number_key;

with ordered as (
  select id, row_number() over (partition by organization_id order by application_number) as rn
  from applications
)
update applications set application_number = ordered.rn
from ordered
where applications.id = ordered.id;

alter table applications add constraint applications_org_application_number_key unique (organization_id, application_number);

create or replace function public.set_application_number() returns trigger
language plpgsql as $$
begin
  if new.application_number is null then
    new.application_number := coalesce(
      (select max(application_number) from applications where organization_id = new.organization_id),
      0
    ) + 1;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
