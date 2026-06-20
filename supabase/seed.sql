-- =========================================================
-- SEED — run AFTER 0001_init.sql and AFTER creating the first auth user.
-- =========================================================

-- 1) Create your first staff user via Supabase Auth (Dashboard → Authentication
--    → Add user, or sign up through /login). A profile row is auto-created.
-- 2) Promote that user to admin (replace the UUID):
--
--    update profiles set role = 'admin' where id = '<that-user-uuid>';
--
--    Or by email:
--    update profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'you@example.com');

-- Email templates (idempotent).
insert into email_templates (key, name, subject, body, is_auto) values
('welcome','New Lead Welcome','We received your application — {{full_name}}',
 'Hi {{full_name}}, thank you for your interest in studying in {{target_country}}. Our team will review your details and reach out within 24 hours.', true),
('acceptance','Acceptance','Great news about your {{program}} application',
 'Hi {{full_name}}, we are pleased to share an update on your application. Here are your next steps...', false),
('rejection','Rejection (Compassionate)','An update on your application',
 'Hi {{full_name}}, thank you for trusting us. While this particular route did not work out, here are alternatives worth exploring...', false),
('follow_up','Follow-Up','Still here to help, {{full_name}}',
 'Hi {{full_name}}, just checking in on your study-abroad plans. Reply any time and we will pick up where we left off.', false),
('document_request','Document Request','Documents needed to proceed',
 'Hi {{full_name}}, to move your application forward we need the following documents...', false)
on conflict (key) do nothing;
