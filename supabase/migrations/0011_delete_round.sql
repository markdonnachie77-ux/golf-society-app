-- 0011_delete_round.sql
--
-- Lets an admin delete a round outright. If it was pending or rejected,
-- deleting it has no handicap impact (those statuses never touched
-- players.current_handicap). If it was approved, this reverses exactly
-- the adjustment that approval applied.
--
-- Design choice: this fully removes the round's trace — the scorecard,
-- its scores (cascade via scores.scorecard_id ON DELETE CASCADE), and the
-- handicap_history row the approval created — rather than leaving the
-- original entry in place alongside a separate "reversal" entry. That's
-- a real tradeoff: an audit-log purist would keep both and let them net
-- to zero, preserving a visible trail that a correction happened. This
-- instead makes it look as though the round never existed, which matches
-- "delete a round" more literally. If you'd rather keep the audit trail,
-- this function is the one place that decision lives — swap the delete
-- of the handicap_history row for an insert of a compensating one.
--
-- Known limitation: players.current_handicap always ends up
-- mathematically correct after this runs, regardless of whether the
-- deleted round was the player's most recent one (it's a straightforward
-- subtraction against whatever the current value is). What does NOT get
-- corrected is the handicap_value stored on any OTHER handicap_history
-- rows between the deleted round and now — those remain stale snapshots
-- of what the handicap was at the time, under the old (soon-to-be-wrong)
-- trajectory. Fully correcting those would mean rewriting every
-- subsequent history row, which is a materially bigger change than what
-- was asked for here. In practice this only matters if you delete a round
-- that ISN'T the player's most recent approved one.

create or replace function delete_round(
  p_scorecard_id uuid
)
returns void as $$
declare
  v_status text;
  v_player_id uuid;
  v_history_id uuid;
  v_adjustment numeric;
  v_current_handicap numeric;
  v_new_handicap numeric;
begin
  select status, player_id into v_status, v_player_id
  from scorecards
  where id = p_scorecard_id
  for update;

  if v_player_id is null then
    raise exception 'Scorecard % not found', p_scorecard_id;
  end if;

  if v_status = 'approved' then
    select id, adjustment_amount into v_history_id, v_adjustment
    from handicap_history
    where scorecard_id = p_scorecard_id
    order by effective_date desc
    limit 1
    for update;

    if v_history_id is not null then
      select current_handicap into v_current_handicap
      from players
      where id = v_player_id
      for update;

      v_new_handicap := round((v_current_handicap - v_adjustment)::numeric, 1);

      update players
      set current_handicap = v_new_handicap
      where id = v_player_id;

      delete from handicap_history where id = v_history_id;
    end if;
  end if;

  delete from scorecards where id = p_scorecard_id;
end;
$$ language plpgsql;

revoke execute on function delete_round(uuid) from public;
