-- 0006_create_handicap_history.sql
-- Append-only ledger of every handicap change (round-driven or manual admin
-- adjustment). players.current_handicap is a denormalized "latest" pointer;
-- this table is the source of truth for the timeline chart.

create table if not exists handicap_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  scorecard_id uuid references scorecards(id) on delete set null,
  handicap_value numeric(4, 1) not null,
  adjustment_amount numeric(4, 2) not null,
  effective_date timestamptz not null default now(),
  notes text
);

create index if not exists idx_handicap_history_player on handicap_history (player_id, effective_date desc);

alter table handicap_history enable row level security;
