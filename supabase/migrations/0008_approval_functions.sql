-- 0008_approval_functions.sql
--
-- Approving a scorecard touches three things that must succeed or fail
-- together: the scorecard's status, the player's current_handicap, and a
-- new handicap_history row. Doing this as three separate supabase-js calls
-- from a Server Action has no real rollback if the second or third call
-- fails — a Postgres function is a single transaction by default, so this
-- is the correct place for one rather than hand-rolled compensating
-- deletes (which is what we settled for in courses/scorecards inserts,
-- where a partial failure just means "delete what we already inserted").
--
-- Both functions lock the scorecard row (FOR UPDATE) and re-check its
-- status before acting, so two admins clicking "approve" on the same
-- pending scorecard at the same moment can't double-apply a handicap
-- change — the second call will simply fail with "not pending approval."

create or replace function approve_scorecard(
  p_scorecard_id uuid,
  p_reviewer_id uuid,
  p_applied_change numeric
)
returns table (new_handicap numeric) as $$
declare
  v_status text;
  v_player_id uuid;
  v_course_id uuid;
  v_proposed_change numeric;
  v_course_name text;
  v_current_handicap numeric;
  v_new_handicap numeric;
  v_notes text;
begin
  select status, player_id, course_id, proposed_handicap_change
    into v_status, v_player_id, v_course_id, v_proposed_change
  from scorecards
  where id = p_scorecard_id
  for update;

  if v_status is null then
    raise exception 'Scorecard % not found', p_scorecard_id;
  end if;

  if v_status <> 'pending_approval' then
    raise exception 'Scorecard % is not pending approval (status: %)', p_scorecard_id, v_status;
  end if;

  select current_handicap into v_current_handicap
  from players
  where id = v_player_id
  for update;

  select name into v_course_name from courses where id = v_course_id;

  v_new_handicap := round((v_current_handicap + p_applied_change)::numeric, 1);

  if p_applied_change is distinct from v_proposed_change then
    v_notes := format(
      'Round at %s — approved with override (proposed %s, applied %s)',
      coalesce(v_course_name, 'unknown course'), v_proposed_change, p_applied_change
    );
  else
    v_notes := format('Round at %s — approved', coalesce(v_course_name, 'unknown course'));
  end if;

  update players
  set current_handicap = v_new_handicap
  where id = v_player_id;

  update scorecards
  set status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = now()
  where id = p_scorecard_id;

  insert into handicap_history (player_id, scorecard_id, handicap_value, adjustment_amount, effective_date, notes)
  values (v_player_id, p_scorecard_id, v_new_handicap, p_applied_change, now(), v_notes);

  return query select v_new_handicap;
end;
$$ language plpgsql;

create or replace function reject_scorecard(
  p_scorecard_id uuid,
  p_reviewer_id uuid
)
returns void as $$
declare
  v_status text;
begin
  select status into v_status from scorecards where id = p_scorecard_id for update;

  if v_status is null then
    raise exception 'Scorecard % not found', p_scorecard_id;
  end if;

  if v_status <> 'pending_approval' then
    raise exception 'Scorecard % is not pending approval (status: %)', p_scorecard_id, v_status;
  end if;

  update scorecards
  set status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = now()
  where id = p_scorecard_id;
end;
$$ language plpgsql;

-- Postgres grants EXECUTE on new functions to PUBLIC by default — unlike
-- the table grants in 0007, this isn't something the RLS revoke already
-- covers, so it needs its own explicit revoke. Only the service role
-- (used exclusively server-side, see lib/supabase/server.ts) ever calls
-- these.
revoke execute on function approve_scorecard(uuid, uuid, numeric) from public;
revoke execute on function reject_scorecard(uuid, uuid) from public;
