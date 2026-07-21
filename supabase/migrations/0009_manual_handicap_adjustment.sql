-- 0009_manual_handicap_adjustment.sql
--
-- Lets an admin set a player's handicap directly, independent of the
-- round-approval workflow — e.g. correcting a migration error from another
-- system, or a society committee decision outside of a specific round.
-- handicap_history.scorecard_id has been nullable since Phase 1
-- specifically for this case ("linked if changed by round" implies it's
-- optional when the change ISN'T from a round); this is the first thing
-- that actually inserts a null-scorecard_id row.
--
-- Same atomicity reasoning as approve_scorecard/reject_scorecard in
-- 0008_approval_functions.sql: updating players.current_handicap and
-- inserting the handicap_history row must succeed or fail together.

create or replace function manual_handicap_adjustment(
  p_player_id uuid,
  p_new_handicap numeric,
  p_admin_id uuid,
  p_notes text
)
returns table (adjustment_amount numeric) as $$
declare
  v_current_handicap numeric;
  v_adjustment numeric;
  v_new_handicap numeric;
  v_notes text;
begin
  select current_handicap into v_current_handicap
  from players
  where id = p_player_id
  for update;

  if v_current_handicap is null then
    raise exception 'Player % not found', p_player_id;
  end if;

  v_new_handicap := round(p_new_handicap::numeric, 1);
  v_adjustment := round((v_new_handicap - v_current_handicap)::numeric, 1);
  v_notes := coalesce(nullif(trim(p_notes), ''), 'Manual adjustment by admin');

  update players
  set current_handicap = v_new_handicap
  where id = p_player_id;

  insert into handicap_history (player_id, scorecard_id, handicap_value, adjustment_amount, effective_date, notes)
  values (p_player_id, null, v_new_handicap, v_adjustment, now(), v_notes);

  return query select v_adjustment;
end;
$$ language plpgsql;

-- Same reasoning as 0008: Postgres grants EXECUTE to PUBLIC by default on
-- new functions, and only the service role (server-side only) should ever
-- call this.
revoke execute on function manual_handicap_adjustment(uuid, numeric, uuid, text) from public;
