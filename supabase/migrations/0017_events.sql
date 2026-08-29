-- 0017_events.sql
--
-- Event/competition management: admins draft an event (course, date, tee
-- time, capacity), publish it, and players register/de-register. Two
-- tables:
--
-- events            — one row per competition, draft or published
-- event_registrations — who's registered for which event, and who
--                        registered them (the player themselves, or an
--                        admin on their behalf)
--
-- Registration capacity is enforced by a Postgres function
-- (register_for_event below), not a plain application-level insert —
-- same reasoning as 0008_approval_functions.sql's approve_scorecard:
-- two players clicking "register" at the same moment, with exactly one
-- spot left, is a genuine race condition a check-then-insert from a
-- Server Action can't safely rule out. Locking the event row (FOR
-- UPDATE) serializes concurrent attempts so the second one sees the
-- first one's effect before deciding whether there's still room.

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null,
  name text not null,
  course_id uuid not null references courses(id),
  event_date date not null,
  first_tee_time time not null,
  capacity int not null check (capacity > 0),
  -- Per-event version of the app-wide players_can_self_register setting
  -- (0014/lib/app-settings.ts) — that one gates creating a player
  -- account at all; this one gates registering for THIS particular
  -- event once it's published. Deliberately separate settings, separate
  -- domains, not meant to share a name or a code path.
  self_registration_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column events.status is
  'draft: only visible/editable by admins, not registerable. published: visible to all society members, registerable subject to self_registration_enabled and capacity.';

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null,
  event_id uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id),
  registered_at timestamptz not null default now(),
  -- Who performed the registration — the player themselves (self-serve)
  -- or an admin registering on their behalf. Distinct from player_id so
  -- "admin registered someone" is a fact the row can show, not just
  -- inferred from the self_registration_enabled setting at read time
  -- (which could have changed since).
  registered_by uuid not null references players(id),
  unique (event_id, player_id)
);

-- Both tables get society_id as a direct column (not just derivable via
-- event_id -> events.society_id) — same defense-in-depth reasoning as
-- 0015_future_proof_multi_tenancy.sql: every row carries its own tenant
-- marker directly, so a query scoped by society_id is correct on its
-- own, not dependent on a join being right too.

revoke all on events, event_registrations from anon, authenticated;

alter table events enable row level security;
alter table event_registrations enable row level security;
-- Same blanket-deny stance as every other table (0007_rls_policies.sql)
-- — all access goes through the service-role client, which bypasses RLS
-- entirely. RLS here is a backstop against an anon/authenticated key
-- ever being exposed, not the mechanism actually protecting these
-- tables day to day.

create index if not exists idx_events_society_status on events(society_id, status);
create index if not exists idx_event_registrations_event on event_registrations(event_id);

-- p_skip_player_checks distinguishes an admin registering someone (true
-- — skip both the self_registration_enabled check and the capacity
-- check, an explicit product decision: admins can deliberately overbook)
-- from a player registering themselves (false — enforce both). It's one
-- flag controlling both checks because both are specifically about
-- SELF-service registration; an admin acting on someone's behalf isn't
-- "self" registration at all, so neither check is about them.
create or replace function register_for_event(
  p_event_id uuid,
  p_player_id uuid,
  p_registered_by uuid,
  p_skip_player_checks boolean default false
)
returns void as $$
declare
  v_status text;
  v_capacity int;
  v_self_registration_enabled boolean;
  v_current_count int;
  v_inserted uuid;
begin
  select status, capacity, self_registration_enabled
    into v_status, v_capacity, v_self_registration_enabled
  from events
  where id = p_event_id
  for update;

  if v_status is null then
    raise exception 'Event not found';
  end if;

  if v_status <> 'published' then
    raise exception 'This event is not open for registration';
  end if;

  if not p_skip_player_checks and not v_self_registration_enabled then
    raise exception 'Self-registration is not enabled for this event';
  end if;

  if not p_skip_player_checks then
    select count(*) into v_current_count from event_registrations where event_id = p_event_id;
    if v_current_count >= v_capacity then
      raise exception 'This event is full';
    end if;
  end if;

  insert into event_registrations (event_id, player_id, registered_by, society_id)
  select p_event_id, p_player_id, p_registered_by, society_id
  from events where id = p_event_id
  on conflict (event_id, player_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    raise exception 'Already registered for this event';
  end if;
end;
$$ language plpgsql;

revoke execute on function register_for_event(uuid, uuid, uuid, boolean) from public;
