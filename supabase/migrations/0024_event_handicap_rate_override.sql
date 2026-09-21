-- 0024_event_handicap_rate_override.sql
--
-- Per-event override of the course's own handicap cut/increase rates
-- (courses.handicap_cut_per_point / handicap_increase_per_point, from
-- 0001-era course setup). A non-zero value here overrides the course's
-- rate specifically for rounds tied to this event; zero (the default)
-- falls back to the course's own rate — this is an explicit design
-- decision confirmed directly with the user, not the same "null means
-- not set" convention used elsewhere in this app (Course Rating,
-- deposit/balance). It means an event genuinely cannot set a rate to
-- exactly 0 while still overriding a course's non-zero rate — 0 always
-- means "use the course's rate", never "use zero as the rate" — a
-- real, accepted limitation of this design, not an oversight.
--
-- Same validation range as the course-level fields for consistency
-- (0 to 9.99).

alter table events
  add column if not exists handicap_cut_per_point numeric(4, 2) not null default 0
    check (handicap_cut_per_point >= 0 and handicap_cut_per_point <= 9.99);

alter table events
  add column if not exists handicap_increase_per_point numeric(4, 2) not null default 0
    check (handicap_increase_per_point >= 0 and handicap_increase_per_point <= 9.99);

comment on column events.handicap_cut_per_point is
  'Per-event override of the course''s handicap_cut_per_point for rounds tied to this event. 0 (default) means: use the course''s own rate, not "cut by zero" — an event cannot override to exactly 0.';
comment on column events.handicap_increase_per_point is
  'Per-event override of the course''s handicap_increase_per_point for rounds tied to this event. 0 (default) means: use the course''s own rate, not "increase by zero" — an event cannot override to exactly 0.';
