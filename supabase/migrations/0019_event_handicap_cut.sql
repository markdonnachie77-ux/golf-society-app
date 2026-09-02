-- 0019_event_handicap_cut.sql
--
-- Adds a per-event "handicap cut for winner" setting and an admin
-- "confirm leaderboard" action. Confirming is deliberately final and
-- permanent (no undo/redo) — a decision made directly with the user,
-- not assumed: if a late scorecard would have changed the result after
-- confirming, that's a manual correction via the existing
-- manual_handicap_adjustment path, not something this feature re-opens.

alter table events
  add column if not exists handicap_cut_for_winner int not null default 0
    check (handicap_cut_for_winner >= 0);

alter table events
  add column if not exists leaderboard_confirmed_at timestamptz;

alter table events
  add column if not exists leaderboard_confirmed_by uuid references players(id);

-- Recorded even when no cut applies (a tie, or an empty leaderboard) so
-- confirmation always reflects what was actually decided, not just
-- whether a cut happened to be nonzero. Null specifically means "no
-- single winner was determined" (a tie, or nobody had an approved round
-- yet) — set once at confirmation time, exactly like the other two
-- confirmation columns, and never touched again since confirming is
-- permanent.
alter table events
  add column if not exists winner_player_id uuid references players(id);

comment on column events.winner_player_id is
  'Set once, at confirmation. Null means no single winner was determined (a tie for first, or an empty leaderboard) — see confirm_event_leaderboard.';

/**
 * Ties are handled by the CALLER, not this function: getEventLeaderboard
 * (app/actions/events.ts) is what actually ranks entries, and
 * confirmEventLeaderboard decides there whether the top two scores are
 * equal — if so, it passes p_winner_player_id as null, and this
 * function applies no handicap change at all (confirmed directly with
 * the user: a tie means no automatic cut, resolved manually). This
 * function only needs to know WHO the winner is, if there is one — not
 * re-derive it from raw data, which would risk disagreeing with what
 * the leaderboard actually displayed.
 *
 * Combines the confirmation itself with the handicap adjustment in one
 * atomic transaction, rather than calling manual_handicap_adjustment as
 * a separate step — two separate RPC calls could leave an event marked
 * confirmed with the cut never actually applied if the second call
 * failed. Locks the event row first (FOR UPDATE) specifically to make
 * double-confirmation (a double-click, or two admins racing) fail
 * safely: the second call sees leaderboard_confirmed_at already set and
 * raises rather than applying the cut twice.
 */
create or replace function confirm_event_leaderboard(
  p_event_id uuid,
  p_confirmed_by uuid,
  p_winner_player_id uuid,
  p_event_name text
)
returns void as $$
declare
  v_already_confirmed timestamptz;
  v_cut int;
  v_current_handicap numeric;
  v_new_handicap numeric;
begin
  select leaderboard_confirmed_at, handicap_cut_for_winner
    into v_already_confirmed, v_cut
  from events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_already_confirmed is not null then
    raise exception 'This event''s leaderboard has already been confirmed';
  end if;

  update events
  set leaderboard_confirmed_at = now(),
      leaderboard_confirmed_by = p_confirmed_by,
      winner_player_id = p_winner_player_id
  where id = p_event_id;

  if p_winner_player_id is not null and v_cut > 0 then
    select current_handicap into v_current_handicap
    from players
    where id = p_winner_player_id
    for update;

    -- Defensive only — the caller already validated the winner is a
    -- real, current-society player before calling this function, same
    -- as every other cross-entity check in this app (ownership verified
    -- in application code immediately before the RPC call, not inside
    -- it). Silently skipping rather than raising here means a
    -- corrupted/missing player id can't block the confirmation itself
    -- from going through.
    if v_current_handicap is not null then
      v_new_handicap := round((v_current_handicap - v_cut)::numeric, 1);

      update players
      set current_handicap = v_new_handicap
      where id = p_winner_player_id;

      insert into handicap_history (player_id, scorecard_id, handicap_value, adjustment_amount, effective_date, notes)
      values (
        p_winner_player_id,
        null,
        v_new_handicap,
        -v_cut,
        now(),
        'Winner''s handicap cut: ' || p_event_name
      );
    end if;
  end if;
end;
$$ language plpgsql;

revoke execute on function confirm_event_leaderboard(uuid, uuid, uuid, text) from public;
