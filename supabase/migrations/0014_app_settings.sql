-- 0014_app_settings.sql
--
-- A general-purpose, extensible settings store — key/value rather than one
-- column per setting, specifically so adding the NEXT setting later is an
-- application-layer change (new key, new UI toggle) rather than a new
-- migration every time. Worth it here given the explicit goal of this
-- being reusable beyond one society.
--
-- value is jsonb rather than text/boolean so future settings aren't
-- constrained to booleans — a number, string, or small object all fit
-- without a schema change.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references players(id)
);

comment on table app_settings is
  'Extensible application settings, one row per setting key. Read by any authenticated session; written only by admins (enforced in app/actions/settings.ts, not by RLS — see the reasoning in 0007_rls_policies.sql for why this app does authorization in code rather than RLS policies).';

alter table app_settings enable row level security;
alter table app_settings force row level security;
revoke all on app_settings from anon, authenticated;

-- Seed the first setting with a default that preserves existing behavior
-- for any installation that hasn't touched settings yet — players CAN log
-- their own rounds by default, same as before this feature existed.
insert into app_settings (key, value)
values ('players_can_log_own_rounds', 'true'::jsonb)
on conflict (key) do nothing;
