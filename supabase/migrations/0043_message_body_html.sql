-- ============================================================
-- 0043_message_body_html.sql — rich text in the custom email compose box
-- ------------------------------------------------------------
-- The "write your own" email popup (leads table, applications, and the lead
-- detail page all share it) now composes with a rich text editor instead of
-- plain text. Its output is real HTML and must be sent/displayed as such —
-- everywhere else (saved templates, automated sends) is untouched and stays
-- plain text. body_is_html distinguishes the two when rendering message
-- history back.
-- ============================================================

alter table messages
  add column if not exists body_is_html boolean not null default false;

notify pgrst, 'reload schema';
