-- 0027_increase_threshold.sql
--
-- Addresses a real problem observed in actual use: a very low, possibly
-- deliberate Stableford score (e.g. 9 points) increases a handicap by
-- the full gap to the standard 36 target, which can be a large,
-- exploitable jump. Confirmed directly with the user, through two
-- explicit questions, exactly how this should work:
--
-- 1. GATE, not cap: once set below 36, scores between the new
--    threshold and 36 get NO increase at all — not a smaller increase,
--    none. Only scores below the threshold itself increase, and only
--    by the gap to the threshold, not to 36. A course/event setting
--    this to 20 means a 30-point round (mediocre but not extreme) no
--    longer increases a handicap at all, where it used to increase a
--    little.
-- 2. Course-level base, event-level override on top — the exact same
--    shape as handicap_cut_per_point/handicap_increase_per_point
--    themselves, not event-only the way cut_target_override (0026)
--    is. Every course gets its own value, defaulting to 36 (today's
--    behavior, unchanged) so nothing shifts for a course an admin
--    hasn't touched.
--
-- The CUT side is entirely unaffected by this migration — this is
-- purely the increase side's own equivalent, added separately from
-- (and composing correctly with, see proposedHandicapChange) the
-- cut_target_override event field from 0026.

alter table courses
  add column if not exists increase_threshold int not null default 36
    check (increase_threshold between 0 and 99);

comment on column courses.increase_threshold is
  'Stableford points a score must be below for the increase rate to apply at all (GATE, not a cap) — defaults to 36 (todays standard target), same scale/meaning as the existing target. Expressed at the full-18-hole scale; scaled proportionally for 9-hole rounds at calculation time, same as cut_target_override.';

alter table events
  add column if not exists increase_threshold_override int
    check (increase_threshold_override is null or increase_threshold_override between 0 and 99);

comment on column events.increase_threshold_override is
  'Per-event override of the course''s own increase_threshold. Null means use the course''s value — no separate checkbox needed, since no plausible real threshold value could be confused with "not set" here, same reasoning as events.cut_target_override.';
