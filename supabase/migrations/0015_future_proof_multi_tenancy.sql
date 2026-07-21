-- 0015_future_proof_multi_tenancy.sql
--
-- Adds a societies table and a society_id column to every existing table,
-- while there's exactly one society and one deployment — so that IF this
-- app is ever sold to multiple societies sharing one deployment, the
-- schema work is already done and only the application-layer work
-- (tenant resolution, query filtering, RLS policies keyed on it) remains.
--
-- This migration is deliberately schema-only and a complete no-op for
-- existing behavior:
-- - Every new society_id column has a DEFAULT pointing at the one society
--   seeded below, so every existing INSERT across the whole app — which
--   doesn't mention society_id at all — keeps working completely
--   unchanged. Nothing needs editing for this migration to be safe.
-- - No RLS policy here actually checks society_id yet. Doing that
--   properly needs a per-request session variable set by application
--   code (e.g. `set_config('app.current_society_id', ...)`), which
--   doesn't exist yet — that's real application development, not schema
--   work, and is explicitly NOT part of this migration.
-- - No tenant resolution (subdomains, a society picker, etc.), no
--   platform-admin layer for managing multiple societies, no changes to
--   any server action to filter by society_id. All of that is future
--   work this migration is making SMALLER, not doing now.
--
-- society_id is added to every table, including holes/scores/
-- handicap_history where it's technically derivable via a join through
-- their parent (a hole's society is its course's society). It's
-- duplicated directly onto every row anyway so that a future RLS policy
-- can check `society_id = current_setting(...)` directly on each table
-- without needing a join — simpler and faster than the alternative, at
-- the cost of trusting future insert code to set it consistently with
-- the parent (not a concern today: there's only one society, so every
-- row already gets the same value regardless).

create table if not exists societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- A fixed, well-known id for the one society that exists today, so this
-- migration — and anyone reading the database later — doesn't need to
-- look it up dynamically.
insert into societies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'EVs Golf Society', 'evs-golf-society')
on conflict (id) do nothing;

alter table players add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table courses add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table holes add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table scorecards add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table scores add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table handicap_history add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);

create index if not exists idx_players_society on players(society_id);
create index if not exists idx_courses_society on courses(society_id);
create index if not exists idx_holes_society on holes(society_id);
create index if not exists idx_scorecards_society on scorecards(society_id);
create index if not exists idx_scores_society on scores(society_id);
create index if not exists idx_handicap_history_society on handicap_history(society_id);

-- app_settings is a special case: it's currently keyed globally by `key`
-- alone (one row per setting, period), but settings need to be
-- PER-SOCIETY once there's more than one — society A might restrict
-- self-logging while society B doesn't. Re-keying the primary key now,
-- while there's exactly one row, avoids a much more painful primary-key
-- migration later once real per-society settings data exists.
alter table app_settings add column if not exists society_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references societies(id);
alter table app_settings drop constraint if exists app_settings_pkey;
alter table app_settings add primary key (society_id, key);

alter table societies enable row level security;
alter table societies force row level security;
revoke all on societies from anon, authenticated;
