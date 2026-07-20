-- 0004_create_scorecards.sql
-- A submitted round. Calculated totals + proposed handicap change are stored
-- (not just derived) so the admin approval queue can inspect and, if needed,
-- override them without recomputing from scratch.

create table if not exists scorecards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  tee_color text not null check (tee_color in ('white', 'yellow')),
  round_type text not null check (round_type in ('full_18', 'front_9', 'back_9')),
  playing_handicap numeric(4, 1) not null,
  played_at date not null default current_date,

  total_gross_stroke_play int,
  total_net_stroke_play int,
  total_stableford_points int,
  proposed_handicap_change numeric(4, 2),

  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected')),
  reviewed_by uuid references players(id),
  reviewed_at timestamptz,

  created_at timestamptz not null default now()
);

comment on column scorecards.proposed_handicap_change is
  'Calculated by lib/golf-math.ts at submission time. Positive = handicap increases, negative = decreases. May be overridden by an admin at approval time (see handicap_history.adjustment_amount for the value actually applied).';

create index if not exists idx_scorecards_status on scorecards (status);
create index if not exists idx_scorecards_player on scorecards (player_id);

alter table scorecards enable row level security;
