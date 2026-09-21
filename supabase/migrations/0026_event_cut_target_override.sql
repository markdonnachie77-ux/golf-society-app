-- 0026_event_cut_target_override.sql
--
-- A per-event override of the standard Stableford target (36 for 18
-- holes, 18 for 9) used to decide when a CUT applies — confirmed
-- directly with the user to apply only to the cut side, never the
-- increase side, which always uses the standard target regardless of
-- this setting.
--
-- Nullable, no default: null means "use the standard target", matching
-- this app's established convention for optional fields (Course
-- Rating, deposit, balance) rather than a numeric sentinel like 0,
-- which would never be a plausible real threshold value here anyway
-- (unlike the earlier handicap-rate-override feature, where 0 WAS a
-- plausible genuine rate and needed its own explicit checkbox instead
-- of a sentinel).
--
-- Expressed at the full-18-hole scale (e.g. 33, directly comparable to
-- the standard 36) — lib/golf-math.ts's proposedHandicapChange scales
-- it proportionally for 9-hole rounds at calculation time, the column
-- itself always stores the 18-hole-scale value an admin actually typed.

alter table events
  add column if not exists cut_target_override int
    check (cut_target_override is null or cut_target_override between 0 and 99);

comment on column events.cut_target_override is
  'Per-event override of the standard Stableford target (36/18), CUT SIDE ONLY — increase always uses the standard target regardless of this value. Null means use the standard target. Expressed at the full-18-hole scale; scaled proportionally for 9-hole rounds at calculation time. When a score clears this (possibly lowered) threshold, it is always cut, even if it would otherwise have been below the standard target and looked increase-eligible — cut takes priority over increase in that gap, confirmed directly with the user.';
