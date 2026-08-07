-- Drop lead-to-agent assignment entirely — leads are already org-shared
-- (0008), and assignment is no longer used for visibility or any other
-- purpose. Dropping the column also drops its index and FK automatically.

alter table leads drop column if exists assigned_to;
