-- 0021_event_competition_handicap_toggle.sql
--
-- Lets an admin indicate, per event, whether Competition Handicap Index
-- calculations apply (built on the Course Rating / Slope Rating capture
-- from 0020_course_and_slope_rating.sql) or whether the event just uses
-- normal handicaps — this app's existing, simpler current_handicap
-- system, unaffected either way.
--
-- This is the toggle/decision only, not the calculation itself — same
-- incremental scope as 0020: capture the setting first, wire the actual
-- Course Handicap formula into round-logging and leaderboards as a
-- separate, later step.
--
-- Defaults to false so every existing event keeps behaving exactly as
-- it does today (normal handicaps) — this is an opt-in addition, not a
-- retroactive change to how any event already set up is scored.

alter table events
  add column if not exists uses_competition_handicap_index boolean not null default false;

comment on column events.uses_competition_handicap_index is
  'true: this event uses Competition Handicap Index (Course Rating / Slope Rating based) calculations once that logic is wired in. false (default): normal handicaps, this app''s existing current_handicap system, unaffected.';
