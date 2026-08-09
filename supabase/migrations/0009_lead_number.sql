-- Human-readable, constant sequential lead number — the UUID `id` stays the
-- primary key and route/param identifier, but is not human-friendly to scan
-- in a table. Identity columns backfill existing rows automatically and
-- can't be set from client inserts (no OVERRIDING SYSTEM VALUE anywhere in
-- app code), so this can't be spoofed like a normal client-writable column.

alter table leads
  add column if not exists lead_number bigint generated always as identity unique;
