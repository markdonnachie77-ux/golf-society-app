-- 0020_course_and_slope_rating.sql
--
-- First step toward competition handicap rules (World Handicap System
-- style Course Handicap calculations): capturing Course Rating and
-- Slope Rating per tee color. Course Handicap = Handicap Index × (Slope
-- Rating / 113) + (Course Rating − Par) is the standard formula this is
-- building toward, but that calculation itself is a separate, later
-- step — this migration is purely the data capture.
--
-- Per-tee-color column pairs on courses, not a new "tees" table —
-- matches the exact pattern 0003_create_holes.sql already established
-- for white_yards/yellow_yards. Course Rating and Slope Rating are
-- properties of a whole tee set, not per-hole, so they belong on
-- courses rather than holes.
--
-- Both nullable: an admin setting up a course may not have these
-- figures to hand yet (they come from the course's official rating
-- card, not something typed from memory), and nothing existing in this
-- app depends on them being set — leaving them null is a valid "not yet
-- captured" state, not an error.

alter table courses
  add column if not exists white_course_rating numeric(4, 1)
    check (white_course_rating is null or white_course_rating > 0);

alter table courses
  add column if not exists white_slope_rating int
    check (white_slope_rating is null or white_slope_rating between 55 and 155);

alter table courses
  add column if not exists yellow_course_rating numeric(4, 1)
    check (yellow_course_rating is null or yellow_course_rating > 0);

alter table courses
  add column if not exists yellow_slope_rating int
    check (yellow_slope_rating is null or yellow_slope_rating between 55 and 155);

comment on column courses.white_course_rating is
  'Course Rating from the white tees — the expected score for a scratch golfer. Nullable: not yet captured until an admin enters it from the course''s official rating card.';
comment on column courses.white_slope_rating is
  'Slope Rating from the white tees, 55-155 per World Handicap System standard (113 = average difficulty).';
comment on column courses.yellow_course_rating is
  'Course Rating from the yellow tees — see white_course_rating.';
comment on column courses.yellow_slope_rating is
  'Slope Rating from the yellow tees, 55-155 per World Handicap System standard.';
