-- 0005_create_scores.sql
-- Hole-by-hole detail for a scorecard.

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references scorecards(id) on delete cascade,
  hole_id uuid not null references holes(id) on delete restrict,
  gross_strokes int not null check (gross_strokes > 0),
  net_strokes int not null,
  stableford_points int not null check (stableford_points >= 0),
  unique (scorecard_id, hole_id)
);

create index if not exists idx_scores_scorecard on scores (scorecard_id);

alter table scores enable row level security;
