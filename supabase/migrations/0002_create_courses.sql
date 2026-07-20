-- 0002_create_courses.sql
-- Courses carry their own difficulty/adjustment multipliers so different
-- society courses can cut or increase handicaps at different rates.

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  hole_count int not null default 18 check (hole_count in (9, 18)),
  handicap_cut_per_point numeric(4, 2) not null default 0.2
    check (handicap_cut_per_point >= 0),
  handicap_increase_per_point numeric(4, 2) not null default 0.1
    check (handicap_increase_per_point >= 0),
  created_at timestamptz not null default now()
);

comment on column courses.handicap_cut_per_point is
  'Handicap decrease applied per Stableford point ABOVE the target (36 for 18 holes, 18 for 9 holes).';
comment on column courses.handicap_increase_per_point is
  'Handicap increase applied per Stableford point BELOW the target. Set to 0 for a buffered zone (no increase).';

alter table courses enable row level security;
