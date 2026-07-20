-- 0007_rls_policies.sql
--
-- IMPORTANT — read this before assuming RLS enforces per-player access here.
--
-- This app uses a custom 4-digit PIN login, NOT Supabase Auth. There is no
-- Supabase `auth.uid()` for these players, so RLS policies cannot be written
-- against player identity the way they could with Supabase Auth users.
--
-- The actual authorization boundary is application-level: every read/write
-- happens through Next.js Server Actions running on the server, using the
-- Supabase SERVICE ROLE key (see lib/supabase/server.ts). Server Actions
-- check the signed session cookie (see lib/auth.ts) for the current
-- player's id and role before running any query. The service role key
-- bypasses RLS entirely by design.
--
-- RLS is still enabled here as defense-in-depth: it guarantees that if the
-- public anon key were ever used directly from a browser (which this app
-- does not do, but a future contributor might try), it gets ZERO access —
-- not read, not write — to any table. Default-deny, no exceptions.
--
-- If you later migrate to Supabase Auth (e.g. to support OAuth alongside
-- PINs), replace these blanket denies with policies keyed on auth.uid().

revoke all on players, courses, holes, scorecards, scores, handicap_history
  from anon, authenticated;

-- Enabling RLS with no policies defined = default deny for every role
-- except the table owner / service role. Explicit for clarity and to
-- survive a `revoke` being accidentally undone later.
alter table players enable row level security;
alter table courses enable row level security;
alter table holes enable row level security;
alter table scorecards enable row level security;
alter table scores enable row level security;
alter table handicap_history enable row level security;

alter table players force row level security;
alter table courses force row level security;
alter table holes force row level security;
alter table scorecards force row level security;
alter table scores force row level security;
alter table handicap_history force row level security;
