-- ============================================================
-- 0005_lead_archive.sql — soft-archive support for leads
-- ------------------------------------------------------------
-- Adds an archive state to leads so staff can hide a lead from the active list
-- and dashboard without permanently deleting it (recoverable). `archived_by`
-- records who archived it, giving admins an accountability trail.
--
-- SAFE ON A LIVE TABLE: both columns are nullable and additive. Existing rows
-- stay active (archived_at IS NULL); the running app is unaffected until the
-- new code that reads these columns is deployed. Run this BEFORE deploying that
-- code.
--
-- No RLS changes needed: archiving is an UPDATE (existing leads_update policy
-- already allows admin OR the assigned agent) and permanent delete uses the
-- existing leads_delete policy (admin only). Related rows (notes, status
-- history, messages) already cascade on a hard delete.
-- ============================================================

alter table leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references profiles(id) on delete set null;

-- Speeds up the "active vs archived" split on the leads list + dashboard.
create index if not exists idx_leads_archived_at on leads(archived_at);

-- Permanent delete: the authenticated role had UPDATE but not DELETE, so the
-- existing leads_delete RLS policy could never take effect (base privilege was
-- missing). Grant it — RLS still restricts the actual rows to admins in-org.
grant delete on leads to authenticated;
