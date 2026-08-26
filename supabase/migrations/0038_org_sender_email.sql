-- ============================================================
-- 0038_org_sender_email.sql — per-tenant outbound sender email
-- ------------------------------------------------------------
-- Each consultancy can set its own "From" address for outbound email (lead
-- mail, staff notifications, password resets) instead of sharing the
-- platform default (BREVO_SENDER_EMAIL). Configured exclusively in Super
-- Admin — never tenant self-service.
--
-- The address itself must ALSO be domain-verified in Brevo (SPF/DKIM) by
-- the client outside this app, or Brevo will reject sends from it — this
-- column only stores the value; see lib/email/brevo.ts.
--
-- No uniqueness constraint: unlike form_domain/portal_domain (which route
-- incoming requests by Host header and so must resolve to exactly one org),
-- nothing looks sender_email up for routing — two orgs sharing a value
-- cannot collide here. No format CHECK either: this column has a single
-- write path (setOrgSenderEmail in app/super/actions.ts) already gated by
-- Zod's .email() validator, matching every other email column in this
-- schema (admin_email has no DB-level check either); a malformed value's
-- only consequence is a rejected Brevo API call, not a routing/security issue.
--
-- SAFE ON A LIVE TABLE: additive and nullable. Existing orgs (including IEN)
-- keep sending from BREVO_SENDER_EMAIL exactly as before until a Super
-- Admin sets one.
-- ============================================================

alter table organizations
  add column if not exists sender_email text;

notify pgrst, 'reload schema';
