-- 0013_add_picked_up_to_scores.sql
--
-- Supports the "pick up and blob" Stableford rule: once a player has taken
-- enough strokes on a hole that they can no longer score at least 1 point,
-- they pick up rather than holing out — speeding up play. That hole scores
-- 0 Stableford points, and has no real gross/net stroke count (they didn't
-- finish it), so those columns need to become optional rather than
-- inventing a placeholder number that looks like a real completed score.

alter table scores
  add column picked_up boolean not null default false;

alter table scores
  alter column gross_strokes drop not null,
  alter column net_strokes drop not null;

-- A picked-up hole has no gross/net strokes and always scores 0. A
-- completed hole must have both. This also means a round with any
-- picked-up holes has an inherently PARTIAL total_gross_stroke_play /
-- total_net_stroke_play on the parent scorecard — those totals only ever
-- summed completed holes to begin with (see computeRound in
-- lib/golf-math.ts), so no scorecards-table change is needed for that.
alter table scores
  add constraint scores_picked_up_consistency check (
    (picked_up = true and gross_strokes is null and net_strokes is null and stableford_points = 0)
    or
    (picked_up = false and gross_strokes is not null and net_strokes is not null)
  );
