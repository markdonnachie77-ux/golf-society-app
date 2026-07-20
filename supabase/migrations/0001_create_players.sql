-- 0001_create_players.sql
-- Players self-register with a 4-digit PIN (stored hashed). Role gates admin actions.

create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  current_handicap numeric(4, 1) not null,
  pin_hash text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

comment on column players.current_handicap is
  'Latest APPROVED handicap. Only updated via the admin approval workflow, never directly by a player.';
comment on column players.pin_hash is
  'bcrypt hash of the 4-digit PIN. Never store the raw PIN.';

create index if not exists idx_players_name on players (last_name, first_name);

alter table players enable row level security;
