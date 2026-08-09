-- ============================================================
-- 0018_org_domains.sql — per-tenant custom domains (Phase 2)
-- ------------------------------------------------------------
-- Each consultancy can be given its own dedicated domain for the public
-- application form (form_domain, e.g. form.ieneducation.com) and/or the
-- whole staff portal (portal_domain, e.g. portal.ieneducation.com).
-- Configured exclusively in Super Admin — never tenant self-service — and
-- resolved at request time by middleware (see lib/routing/domain-lookup.ts).
--
-- Adding a domain here is NOT enough by itself: it must also be added to the
-- Vercel project (Settings → Domains) with its DNS CNAME pointed at Vercel,
-- or requests to it will never reach this app. See docs/FORM_SUBDOMAIN.md.
--
-- SAFE ON A LIVE TABLE: additive and nullable. Existing orgs (including IEN)
-- keep resolving on the base app domain exactly as before until a Super
-- Admin sets one of these.
-- ============================================================

alter table organizations
  add column if not exists form_domain   text,
  add column if not exists portal_domain text;

-- Hostname only — lowercase letters/digits/hyphens/dots, at least one dot,
-- no scheme/path/port (e.g. "form.ieneducation.com", not
-- "https://form.ieneducation.com/apply").
alter table organizations
  drop constraint if exists organizations_form_domain_check;
alter table organizations
  add constraint organizations_form_domain_check
  check (form_domain is null or form_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$');

alter table organizations
  drop constraint if exists organizations_portal_domain_check;
alter table organizations
  add constraint organizations_portal_domain_check
  check (portal_domain is null or portal_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$');

-- A single org can't point both roles at the same host.
alter table organizations
  drop constraint if exists organizations_domains_distinct_check;
alter table organizations
  add constraint organizations_domains_distinct_check
  check (form_domain is null or portal_domain is null or form_domain <> portal_domain);

-- One consultancy per domain. (This alone doesn't stop org A's form_domain
-- colliding with org B's portal_domain — the setOrgDomains action checks
-- across both columns before saving.)
alter table organizations
  drop constraint if exists organizations_form_domain_key;
alter table organizations
  add constraint organizations_form_domain_key unique (form_domain);
alter table organizations
  drop constraint if exists organizations_portal_domain_key;
alter table organizations
  add constraint organizations_portal_domain_key unique (portal_domain);

notify pgrst, 'reload schema';
