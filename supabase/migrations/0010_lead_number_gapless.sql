-- A plain identity/sequence never reuses a value once consumed — even by a
-- row that's later deleted or a transaction that rolled back — so numbers
-- can jump ahead of the visible row count. Replace it with a trigger that
-- computes MAX(lead_number)+1 at insert time, which stays tight under normal
-- delete usage. Existing rows are renumbered first, in their current order,
-- so today's data starts clean instead of carrying the old gap forward.
--
-- Trade-off: this doesn't lock against concurrent inserts, so two leads
-- created in the same instant could race for the same number — the unique
-- constraint (kept from 0009) makes the second one fail rather than silently
-- duplicate. Acceptable at this app's scale (staff-driven CRM writes, not
-- high-concurrency).

alter table leads alter column lead_number drop identity if exists;

with ordered as (
  select id, row_number() over (order by lead_number) as rn
  from leads
)
update leads set lead_number = ordered.rn
from ordered
where leads.id = ordered.id;

create or replace function public.set_lead_number() returns trigger
language plpgsql as $$
begin
  if new.lead_number is null then
    new.lead_number := coalesce((select max(lead_number) from leads), 0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_lead_number on leads;
create trigger trg_set_lead_number
before insert on leads
for each row
execute function public.set_lead_number();
