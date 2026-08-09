-- Allow full_name/email/phone to be blank at the database level, so the
-- staff "Create Query" flow (app/(admin)/leads/new) can save a lead with
-- nothing filled in yet. The public /apply wizard is completely unaffected:
-- it still requires these fields via its own Zod validation (lib/validation/
-- lead.ts step1Schema), which runs before any insert — nothing about that
-- code path changed, so a public submission can never actually produce a
-- blank name/email/phone. Only the new staff quick-create path can.

alter table leads alter column full_name drop not null;
alter table leads alter column email drop not null;
alter table leads alter column phone drop not null;
