-- 0012_wipe_player_history.sql
--
-- Deletes everything a player has DONE (their submitted rounds and
-- handicap change log) without deleting the player THEMSELVES — they
-- keep their account, can still log in, and their current_handicap
-- number is deliberately left untouched (an admin can use the manual
-- handicap adjustment panel afterward if the number itself also needs
-- to change).
--
-- This only ever touches rows where player_id = the target player.
-- scorecards.reviewed_by (which player, if any, reviewed OTHER players'
-- rounds) is a completely separate column and is never touched here —
-- if this player has approved/rejected other members' rounds as an
-- admin, those records are untouched. That FK complication only matters
-- for deleting the player ROW itself, which this function does not do.

create or replace function wipe_player_history(
  p_player_id uuid
)
returns void as $$
begin
  if not exists (select 1 from players where id = p_player_id) then
    raise exception 'Player % not found', p_player_id;
  end if;

  -- Cascades to delete their scores automatically
  -- (scores.scorecard_id is ON DELETE CASCADE).
  delete from scorecards where player_id = p_player_id;

  -- handicap_history.scorecard_id is ON DELETE SET NULL, not CASCADE, so
  -- the scorecards delete above wouldn't have removed these rows on its
  -- own even for entries linked to now-deleted rounds — deleting by
  -- player_id here catches all of this player's history regardless.
  delete from handicap_history where player_id = p_player_id;

  -- players.current_handicap is deliberately NOT modified.
end;
$$ language plpgsql;

revoke execute on function wipe_player_history(uuid) from public;
