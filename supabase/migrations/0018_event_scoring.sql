-- 0018_event_scoring.sql
--
-- Adds a scoring format to events (stroke_play or stableford — this
-- governs how the event's leaderboard ranks entries, nothing else; it
-- has no bearing on how handicap adjustments are calculated, which
-- stays Stableford-based for every round regardless of which event, if
-- any, it's tagged to) and links scorecards to events optionally, so a
-- round can be submitted "as part of" a specific competition.

alter table events
  add column if not exists format text not null default 'stableford'
    check (format in ('stroke_play', 'stableford'));

comment on column events.format is
  'Governs leaderboard ranking only: stroke_play ranks by lowest total_net_stroke_play, stableford by highest total_stableford_points. Handicap adjustment always uses Stableford points regardless of this setting.';

-- Nullable — most rounds aren't played as part of an event at all. Set
-- at submission time (app/actions/scorecards.ts's createScorecard),
-- never editable afterward — same as every other scorecard field once
-- submitted.
alter table scorecards
  add column if not exists event_id uuid references events(id);

create index if not exists idx_scorecards_event on scorecards(event_id);
