-- 0025_event_handicap_override_checkbox.sql
--
-- Replaces the 0024 "0 means fall back to the course" scheme with an
-- explicit boolean checkbox — confirmed directly with the user, in
-- direct response to a real limitation of the previous design: there
-- was no way to override a course's nonzero rate down to exactly 0
-- (a genuine need — a "fun day" event where no handicap adjustment
-- should happen at all, regardless of what the course's own rate is).
-- An explicit flag removes the ambiguity entirely rather than working
-- around it with a sentinel value.

alter table events
  add column if not exists override_handicap_rates boolean not null default false;

comment on column events.override_handicap_rates is
  'When true, handicap_cut_per_point/handicap_increase_per_point on this event override the course''s own rates for rounds tied to this event (both become mandatory on the form when this is checked). When false (default), the course''s rates always apply, regardless of whatever these two columns happen to contain.';

-- Preserves intent from the 0024 scheme for any event that already set
-- a genuine override under it: a nonzero rate there meant "this event
-- overrides", so those events should keep overriding under the new
-- explicit scheme too, not silently revert to the course's rate.
update events
set override_handicap_rates = true
where handicap_cut_per_point <> 0 or handicap_increase_per_point <> 0;

-- Now that the checkbox is the single source of truth for whether an
-- override applies, the rate columns can be null when it doesn't —
-- matching this app's established "null means not applicable"
-- convention (Course Rating, deposit, balance) rather than a stored 0
-- that no longer has any meaning to carry. The existing 0-9.99 check
-- constraints on both columns already permit null without
-- modification — Postgres treats a null operand in a check constraint
-- as satisfying it, not violating it.
alter table events alter column handicap_cut_per_point drop not null;
alter table events alter column handicap_cut_per_point drop default;
alter table events alter column handicap_increase_per_point drop not null;
alter table events alter column handicap_increase_per_point drop default;

update events
set handicap_cut_per_point = null, handicap_increase_per_point = null
where override_handicap_rates = false;

comment on column events.handicap_cut_per_point is
  'Per-event override of the course''s handicap_cut_per_point, only applied when override_handicap_rates is true. Null when not overriding — mandatory (never null) on the form whenever the checkbox is checked.';
comment on column events.handicap_increase_per_point is
  'Per-event override of the course''s handicap_increase_per_point, only applied when override_handicap_rates is true. Null when not overriding — mandatory (never null) on the form whenever the checkbox is checked.';
