-- 0028_course_cut_target.sql
--
-- Brings the CUT side into the same shape as increase_threshold
-- (0027): course-level base, event-level override on top — confirmed
-- directly with the user as the intended follow-up, explicitly to
-- bring this in line with the increase threshold rather than leave the
-- two asymmetric. events.cut_target_override (0026) already exists and
-- needs no schema change — only its MEANING when null shifts, from "use
-- the standard 36" to "use the course's own cut_target" (which itself
-- defaults to 36, so an untouched course behaves identically either
-- way). See app/actions/scorecards.ts for where that resolution
-- actually happens — proposedHandicapChange itself needs no changes at
-- all, exactly as when increase_threshold was added: the function has
-- always taken an already-resolved value, agnostic to whether it came
-- from an event override or a course default.
--
-- Same validation range and default as increase_threshold, for
-- consistency: 0-99, defaulting to 36 so every existing course keeps
-- behaving exactly as it does today until an admin deliberately
-- changes it.

alter table courses
  add column if not exists cut_target int not null default 36
    check (cut_target between 0 and 99);

comment on column courses.cut_target is
  'Stableford points above which the cut rate applies — defaults to 36 (todays standard target), same scale/meaning as increase_threshold. Expressed at the full-18-hole scale; scaled proportionally for 9-hole rounds at calculation time. events.cut_target_override falls back to this when null, not straight to the standard 36.';
