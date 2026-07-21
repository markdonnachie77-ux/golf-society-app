-- 0010_defer_stroke_index_uniqueness.sql
--
-- Switching course edits from delete+reinsert to upsert (see
-- app/actions/courses.ts's updateCourse) fixed a real bug — deleting a
-- course's holes failed once any round had been recorded against it,
-- because scores.hole_id has ON DELETE RESTRICT. But upsert introduces a
-- different problem: a multi-row INSERT ... ON CONFLICT DO UPDATE checks
-- a NOT DEFERRABLE unique constraint after each row, not once at the end
-- of the statement. So swapping two holes' stroke indices (hole 1: 5→3,
-- hole 2: 3→5) can transiently collide with itself mid-batch and fail,
-- even though the final state is perfectly valid.
--
-- The fix is to make (course_id, stroke_index) a DEFERRABLE INITIALLY
-- DEFERRED constraint, so Postgres only checks it once, at the end of the
-- transaction — after every row in the upsert has been applied. This does
-- NOT touch the (course_id, hole_number) constraint, which is the target
-- of the upsert's ON CONFLICT clause and needs to stay an immediately-
-- checked constraint for ON CONFLICT resolution to work correctly.

alter table holes drop constraint holes_course_id_stroke_index_key;

alter table holes
  add constraint holes_course_id_stroke_index_key
  unique (course_id, stroke_index)
  deferrable initially deferred;
