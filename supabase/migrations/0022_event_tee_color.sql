-- 0022_event_tee_color.sql
--
-- Third step toward competition handicap rules: the Course Handicap
-- formula (Handicap Index × Slope Rating / 113 + (Course Rating − Par))
-- needs a specific tee's Slope Rating and Course Rating, but this app
-- had no notion of which tee an event uses before a round gets played
-- and its own scorecard.tee_color gets set — registration happens
-- before that, so the "Who's registered" list had nothing to compute
-- from. This is that missing setting: one tee color per event, same
-- column definition scorecards.tee_color already uses
-- (0004_create_scorecards.sql), applying to everyone registered.
--
-- Only meaningful when uses_competition_handicap_index is true
-- (0021_event_competition_handicap_toggle.sql) — defaulting to 'white'
-- keeps every existing event's column populated (not null) even though
-- the value is unused for an event with the toggle off.

alter table events
  add column if not exists tee_color text not null default 'white'
    check (tee_color in ('white', 'yellow'));

comment on column events.tee_color is
  'Which tee''s Course Rating / Slope Rating to use for the Competition Handicap calculation. Only meaningful when uses_competition_handicap_index is true.';
