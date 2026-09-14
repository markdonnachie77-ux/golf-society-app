"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import type { ActionResult } from "@/app/actions/auth";
import type { EventStatus, EventFormat } from "@/lib/database.types";

// ---------- Shared helpers ----------

/** "Today" as a plain YYYY-MM-DD string, matching events.event_date's
 * column type — used to block registering/de-registering for an event
 * that's already happened. String comparison works correctly here since
 * both sides are the same YYYY-MM-DD format, which sorts identically to
 * chronological order. */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Admin: create / edit / publish / delete ----------

const eventDetailsSchema = z.object({
  name: z.string().trim().min(1, "Event name is required").max(120),
  courseId: z.string().uuid("Select a course"),
  eventDate: z.string().min(1, "Select a date"),
  firstTeeTime: z.string().min(1, "Select a first tee time"),
  capacity: z
    .number({ invalid_type_error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(500, "That capacity looks too high"),
  selfRegistrationEnabled: z.boolean(),
  format: z.enum(["stroke_play", "stableford"], {
    errorMap: () => ({ message: "Select a scoring format" }),
  }),
  handicapCutForWinner: z
    .number({ invalid_type_error: "Handicap cut must be a number" })
    .int("Handicap cut must be a whole number")
    .min(0, "Handicap cut can't be negative")
    .max(54, "That handicap cut looks too high"),
  usesCompetitionHandicapIndex: z.boolean(),
});

function parseEventFormData(formData: FormData) {
  return eventDetailsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    eventDate: String(formData.get("eventDate") ?? ""),
    firstTeeTime: String(formData.get("firstTeeTime") ?? ""),
    capacity: Number(formData.get("capacity")),
    selfRegistrationEnabled: formData.get("selfRegistrationEnabled") === "true",
    format: String(formData.get("format") ?? ""),
    handicapCutForWinner: Number(formData.get("handicapCutForWinner") || 0),
    usesCompetitionHandicapIndex: formData.get("usesCompetitionHandicapIndex") === "true",
  });
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const societyId = await getCurrentSocietyId();

  const parsed = parseEventFormData(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name: data.name,
      course_id: data.courseId,
      event_date: data.eventDate,
      first_tee_time: data.firstTeeTime,
      capacity: data.capacity,
      self_registration_enabled: data.selfRegistrationEnabled,
      format: data.format,
      handicap_cut_for_winner: data.handicapCutForWinner,
      uses_competition_handicap_index: data.usesCompetitionHandicapIndex,
      status: "draft",
      created_by: session.playerId,
      society_id: societyId,
    })
    .select("id")
    .single();

  if (error || !event) {
    return { ok: false, error: "Could not create this event. Please try again." };
  }

  redirect(`/events/${event.id}`);
}

/**
 * Editing stays available after publishing, deliberately — an admin
 * needing to nudge a tee time or swap the course after publishing an
 * event is a normal, expected use case, not something worth locking
 * behind "unpublish first." Scoped by society_id in the update itself
 * (same pattern as courses.ts's updateCourse) — a single atomic
 * statement, so a mismatched society_id matches zero rows rather than
 * risking a check-then-act race.
 */
export async function updateEvent(eventId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();

  const parsed = parseEventFormData(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .from("events")
    .update({
      name: data.name,
      course_id: data.courseId,
      event_date: data.eventDate,
      first_tee_time: data.firstTeeTime,
      capacity: data.capacity,
      self_registration_enabled: data.selfRegistrationEnabled,
      format: data.format,
      handicap_cut_for_winner: data.handicapCutForWinner,
      uses_competition_handicap_index: data.usesCompetitionHandicapIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("society_id", societyId)
    .select("id");

  if (error) {
    return { ok: false, error: "Could not update this event. Please try again." };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Event not found." };
  }

  redirect(`/events/${eventId}`);
}

async function setEventStatus(eventId: string, status: EventStatus): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("society_id", societyId)
    .select("id");

  if (error) {
    return { ok: false, error: "Could not update this event's status." };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Event not found." };
  }

  return { ok: true };
}

export async function publishEvent(eventId: string): Promise<ActionResult> {
  return setEventStatus(eventId, "published");
}

/** Reverts a published event back to draft — e.g. published too early
 * by mistake. Existing registrations aren't touched or removed by this;
 * they'd simply become invisible to players again until re-published,
 * since draft events aren't shown outside admin views at all. */
export async function unpublishEvent(eventId: string): Promise<ActionResult> {
  return setEventStatus(eventId, "draft");
}

/**
 * Deletion is restricted to draft events only — a published event can
 * have real registrations, and silently discarding those via a delete
 * button felt like the wrong default rather than something worth adding
 * a whole "what happens to registrations" flow for. A draft event can
 * never have registrations in the first place (registration only opens
 * once published — see register_for_event's status check), so deleting
 * one is always safe.
 */
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("society_id", societyId)
    .eq("status", "draft")
    .select("id");

  if (error) {
    return { ok: false, error: "Could not delete this event." };
  }
  if (!deleted || deleted.length === 0) {
    return { ok: false, error: "Event not found, or it's already published — published events can't be deleted." };
  }

  return { ok: true };
}

// ---------- Listing and detail ----------

export interface EventListRow {
  id: string;
  name: string;
  event_date: string;
  first_tee_time: string;
  capacity: number;
  status: EventStatus;
  course_name: string;
  registered_count: number;
}

/**
 * Admins see every event, draft included — they're the ones who need to
 * find their way back to a draft to keep editing it. Non-admins only
 * ever see published events; a draft is invisible to them entirely, not
 * just unregisterable, matching how getEventDetail below treats a draft
 * as "not found" for a non-admin rather than showing it read-only.
 */
export async function listEvents(): Promise<EventListRow[]> {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  let query = supabase
    .from("events")
    .select("id, name, event_date, first_tee_time, capacity, status, courses(name)")
    .eq("society_id", societyId);

  if (session.role !== "admin") {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.order("event_date", { ascending: true });

  if (error || !data) return [];

  interface RawRow {
    id: string;
    name: string;
    event_date: string;
    first_tee_time: string;
    capacity: number;
    status: EventStatus;
    courses: { name: string } | null;
  }
  const rows = data as unknown as RawRow[];
  const eventIds = rows.map((r) => r.id);

  // One extra query for registration counts across every listed event,
  // rather than an embedded aggregate — PostgREST doesn't support a
  // count-of-related-rows in the same select the way a hand-written SQL
  // query could, so this mirrors the same "fetch ids, then a second
  // targeted query" pattern already used for the picked-up-hole check in
  // getPlayerGrossScoreStats.
  const counts = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: regRows } = await supabase
      .from("event_registrations")
      .select("event_id")
      .in("event_id", eventIds);
    for (const row of regRows ?? []) {
      counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    event_date: row.event_date,
    first_tee_time: row.first_tee_time,
    capacity: row.capacity,
    status: row.status,
    course_name: row.courses?.name ?? "Unknown course",
    registered_count: counts.get(row.id) ?? 0,
  }));
}

export interface EventDetail {
  id: string;
  name: string;
  eventDate: string;
  firstTeeTime: string;
  capacity: number;
  selfRegistrationEnabled: boolean;
  status: EventStatus;
  format: EventFormat;
  handicapCutForWinner: number;
  usesCompetitionHandicapIndex: boolean;
  leaderboardConfirmedAt: string | null;
  winnerPlayerId: string | null;
  winnerPlayerName: string | null;
  courseId: string;
  courseName: string;
  registrations: { playerId: string; playerName: string; registeredBy: string }[];
}

/**
 * Returns null for a draft event viewed by a non-admin — treated as not
 * found, not "found but you can't register." A draft isn't meant to be
 * visible to players at all yet, not just non-actionable.
 */
export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, name, event_date, first_tee_time, capacity, self_registration_enabled, status, format, handicap_cut_for_winner, uses_competition_handicap_index, leaderboard_confirmed_at, winner_player_id, course_id, courses(name), winner:players!events_winner_player_id_fkey(first_name, last_name)"
    )
    .eq("id", eventId)
    .eq("society_id", societyId)
    .single();

  if (error || !event) return null;
  if (event.status === "draft" && session.role !== "admin") return null;

  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("player_id, registered_by, players!event_registrations_player_id_fkey(first_name, last_name)")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: true });

  interface RawRegRow {
    player_id: string;
    registered_by: string;
    players: { first_name: string; last_name: string } | null;
  }
  const rawRegRows = (regRows ?? []) as unknown as RawRegRow[];

  const course = event.courses as unknown as { name: string } | null;
  const winner = event.winner as unknown as { first_name: string; last_name: string } | null;

  return {
    id: event.id,
    name: event.name,
    eventDate: event.event_date,
    firstTeeTime: event.first_tee_time,
    capacity: event.capacity,
    selfRegistrationEnabled: event.self_registration_enabled,
    status: event.status,
    format: event.format,
    handicapCutForWinner: event.handicap_cut_for_winner,
    usesCompetitionHandicapIndex: event.uses_competition_handicap_index,
    leaderboardConfirmedAt: event.leaderboard_confirmed_at,
    winnerPlayerId: event.winner_player_id,
    winnerPlayerName: winner ? `${winner.first_name} ${winner.last_name}` : null,
    courseId: event.course_id,
    courseName: course?.name ?? "Unknown course",
    registrations: rawRegRows.map((r) => ({
      playerId: r.player_id,
      playerName: r.players ? `${r.players.first_name} ${r.players.last_name}` : "Unknown player",
      registeredBy: r.registered_by,
    })),
  };
}

// ---------- Registration ----------

/**
 * Calls register_for_event with p_skip_player_checks=false, so this is
 * the path where the self_registration_enabled and capacity checks
 * genuinely apply. The event's own society_id is verified via the
 * getEventDetail-style lookup below before ever calling the RPC — the
 * function itself has no tenant awareness (same class of gap as
 * approve_scorecard/manual_handicap_adjustment, closed the same way:
 * an ownership check immediately before the call, not inside it).
 */
export async function registerForEvent(eventId: string): Promise<ActionResult> {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, event_date")
    .eq("id", eventId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: "Event not found." };
  }
  if (event.event_date < todayDateString()) {
    return { ok: false, error: "This event has already taken place." };
  }

  const { error } = await (supabase.rpc as any)("register_for_event", {
    p_event_id: eventId,
    p_player_id: session.playerId,
    p_registered_by: session.playerId,
    p_skip_player_checks: false,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not register for this event." };
  }

  return { ok: true };
}

/** A player removing their own registration — always available
 * regardless of self_registration_enabled, which only gates NEW
 * registrations, not withdrawing an existing one. No capacity/atomicity
 * concerns here (removing a row can't create a race condition the way
 * adding one under a capacity limit can), so this is a plain scoped
 * delete, not an RPC call. */
export async function deregisterFromEvent(eventId: string): Promise<ActionResult> {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, event_date")
    .eq("id", eventId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: "Event not found." };
  }
  if (event.event_date < todayDateString()) {
    return { ok: false, error: "This event has already taken place." };
  }

  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("player_id", session.playerId)
    .eq("society_id", societyId);

  if (error) {
    return { ok: false, error: "Could not remove your registration." };
  }

  return { ok: true };
}

/** Admin registering a player on their behalf — p_skip_player_checks is
 * true here specifically, so this bypasses both self_registration_enabled
 * (irrelevant to an admin acting directly, not a "self" registration at
 * all) and the capacity limit (an explicit product decision: admins can
 * deliberately overbook an event). */
export async function adminRegisterPlayer(eventId: string, playerId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: "Event not found." };
  }

  // Confirm the target player belongs to this admin's own society too —
  // without this, an admin could register a player id from a different
  // tenant if they somehow obtained it (same reasoning as
  // createScorecard's onBehalfOfPlayerId check in app/actions/scorecards.ts).
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!player) {
    return { ok: false, error: "Player not found." };
  }

  const { error } = await (supabase.rpc as any)("register_for_event", {
    p_event_id: eventId,
    p_player_id: playerId,
    p_registered_by: session.playerId,
    p_skip_player_checks: true,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not register this player." };
  }

  return { ok: true };
}

/** Admin removing any player's registration — the "override all
 * registrations" capability. Same reasoning as deregisterFromEvent for
 * why this is a plain delete rather than an RPC: removing a row has no
 * capacity race condition to guard against. */
export async function adminDeregisterPlayer(eventId: string, playerId: string): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .eq("society_id", societyId);

  if (error) {
    return { ok: false, error: "Could not remove this player's registration." };
  }

  return { ok: true };
}

// ---------- Leaderboard ----------

export interface LeaderboardEntry {
  scorecardId: string;
  playerId: string;
  playerName: string;
  score: number;
  playedAt: string;
}

/**
 * Ranks approved rounds tagged to this event by its format:
 * stroke_play by lowest total_net_stroke_play, stableford by highest
 * total_stableford_points. Only approved rounds count, same as
 * everywhere else scores are aggregated in this app.
 *
 * Stroke play additionally excludes any round with a picked-up hole —
 * total_net_stroke_play is only a partial sum for one of those (see
 * lib/golf-math.ts's summarizeRound), an incomplete score that can't
 * fairly compete. Stableford doesn't have this problem: a picked-up
 * hole scores 0 points, which is itself a valid, complete outcome by
 * Stableford's own design, so no exclusion applies there — same
 * reasoning as getPlayerGrossScoreStats in app/actions/players.ts,
 * which excludes picked-up rounds from gross-score stats for the same
 * underlying reason but never needed a Stableford equivalent.
 */
export async function getEventLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("format")
    .eq("id", eventId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!event) return [];

  const { data, error } = await supabase
    .from("scorecards")
    .select(
      "id, player_id, played_at, total_net_stroke_play, total_stableford_points, players!scorecards_player_id_fkey(first_name, last_name)"
    )
    .eq("event_id", eventId)
    .eq("society_id", societyId)
    .eq("status", "approved");

  if (error || !data || data.length === 0) return [];

  interface RawRow {
    id: string;
    player_id: string;
    played_at: string;
    total_net_stroke_play: number | null;
    total_stableford_points: number | null;
    players: { first_name: string; last_name: string } | null;
  }
  const rows = data as unknown as RawRow[];

  let excludedIds = new Set<string>();
  if (event.format === "stroke_play") {
    const scorecardIds = rows.map((r) => r.id);
    const { data: pickedUpRows } = await supabase
      .from("scores")
      .select("scorecard_id")
      .in("scorecard_id", scorecardIds)
      .eq("picked_up", true);
    excludedIds = new Set((pickedUpRows ?? []).map((r) => r.scorecard_id));
  }

  const entries: LeaderboardEntry[] = [];
  for (const r of rows) {
    if (excludedIds.has(r.id)) continue;
    const score = event.format === "stroke_play" ? r.total_net_stroke_play : r.total_stableford_points;
    if (score === null) continue;
    entries.push({
      scorecardId: r.id,
      playerId: r.player_id,
      playerName: r.players ? `${r.players.first_name} ${r.players.last_name}` : "Unknown player",
      score,
      playedAt: r.played_at,
    });
  }

  entries.sort((a, b) => (event.format === "stroke_play" ? a.score - b.score : b.score - a.score));

  return entries;
}

/**
 * Locks in the winner and, if there is a clear one (not a tie, per a
 * decision made directly with the user rather than assumed) and the
 * event's handicap_cut_for_winner is nonzero, applies that cut to their
 * handicap — all in one atomic database transaction (see
 * confirm_event_leaderboard in 0019_event_handicap_cut.sql). This action
 * only determines WHO the winner is, using the exact same
 * getEventLeaderboard the page itself displays, so what gets confirmed
 * always matches what an admin actually saw on screen — it never
 * re-derives rankings from raw data independently, which could
 * disagree with the displayed leaderboard if the two implementations
 * ever drifted apart.
 *
 * Confirming is permanent — confirmed directly with the user, not
 * assumed: there is no unconfirm or re-confirm. A late scorecard that
 * would have changed the result after confirming is a manual
 * correction via adjustPlayerHandicap, not something this reopens.
 */
export async function confirmEventLeaderboard(eventId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, leaderboard_confirmed_at")
    .eq("id", eventId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!event) {
    return { ok: false, error: "Event not found." };
  }
  if (event.status !== "published") {
    return { ok: false, error: "Publish this event before confirming its leaderboard." };
  }
  if (event.leaderboard_confirmed_at) {
    return { ok: false, error: "This event's leaderboard has already been confirmed." };
  }

  const leaderboard = await getEventLeaderboard(eventId);
  // No single winner when the leaderboard is empty (nobody's submitted
  // an approved round yet) or when the top two entries are tied — a tie
  // for first gets no automatic cut at all (confirmed directly with the
  // user), left for an admin to resolve manually via the handicap
  // override on the player's profile.
  const isTie = leaderboard.length >= 2 && leaderboard[0].score === leaderboard[1].score;
  let winnerPlayerId = leaderboard.length > 0 && !isTie ? leaderboard[0].playerId : null;

  // Defense-in-depth, matching the pattern used everywhere else a
  // cross-entity id gets passed into a mutating RPC (e.g. createScorecard's
  // onBehalfOfPlayerId check) — winnerPlayerId is already inherently
  // society-scoped in practice (it comes from an approved scorecard,
  // which can only belong to a player in this same society), but this
  // confirms it explicitly rather than relying on that being true by
  // construction, since this RPC mutates a real handicap.
  if (winnerPlayerId) {
    const { data: winnerPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("id", winnerPlayerId)
      .eq("society_id", societyId)
      .maybeSingle();
    if (!winnerPlayer) {
      winnerPlayerId = null;
    }
  }

  const { error } = await (supabase.rpc as any)("confirm_event_leaderboard", {
    p_event_id: eventId,
    p_confirmed_by: session.playerId,
    p_winner_player_id: winnerPlayerId,
    p_event_name: event.name,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not confirm this leaderboard." };
  }

  return { ok: true };
}

// ---------- Linking a round to an event at submission time ----------

export interface RegisteredEventOption {
  id: string;
  name: string;
  eventDate: string;
  courseId: string;
}

/**
 * Events the given player is registered for, published, within a
 * window of the last 7 days through any future date — used by the
 * round-logging form to decide whether it's even worth offering "link
 * this round to an event" at all. The form itself further narrows this
 * down client-side to whichever of these actually match the round's
 * selected course and date, so the dropdown only ever shows genuinely
 * plausible matches, not every event the player happens to be signed up
 * for.
 *
 * Not restricted to the caller's own id — event registrations are
 * already visible to any logged-in society member on the event detail
 * page itself (the "Who's registered" list shows everyone), so this
 * isn't exposing anything more private than what's already shown there;
 * an admin logging a round on behalf of another player needs exactly
 * this same lookup for the target player, not just themselves.
 */
export async function listRegisteredEventsForRoundLogging(
  playerId: string
): Promise<RegisteredEventOption[]> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("event_id")
    .eq("player_id", playerId)
    .eq("society_id", societyId);

  const eventIds = (regRows ?? []).map((r) => r.event_id);
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, course_id")
    .in("id", eventIds)
    .eq("society_id", societyId)
    .eq("status", "published")
    .gte("event_date", cutoff);

  if (error || !data) return [];

  return data.map((e) => ({
    id: e.id,
    name: e.name,
    eventDate: e.event_date,
    courseId: e.course_id,
  }));
}

// ---------- Dashboard "log your round" reminder ----------

export interface PendingEventReminder {
  id: string;
  name: string;
  eventDate: string;
}

/**
 * Events the player is registered for, published, dated today or up to
 * 7 days in the past — same window listRegisteredEventsForRoundLogging
 * uses for the round-linking dropdown itself, deliberately: a round
 * genuinely can't be tagged to anything older than that window anyway
 * (the dropdown wouldn't offer it), so there's no point reminding about
 * something that's no longer linkable. Excludes any event the player
 * has already submitted a round for, regardless of that round's
 * approval status — once they've logged something, they've done their
 * part; a still-pending or even rejected round isn't a reason to keep
 * nagging them to log it again.
 */
export async function listPendingEventRoundReminders(playerId: string): Promise<PendingEventReminder[]> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("event_id")
    .eq("player_id", playerId)
    .eq("society_id", societyId);

  const eventIds = (regRows ?? []).map((r) => r.event_id);
  if (eventIds.length === 0) return [];

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date")
    .in("id", eventIds)
    .eq("society_id", societyId)
    .eq("status", "published")
    .gte("event_date", cutoff)
    .lte("event_date", today);

  if (error || !events || events.length === 0) return [];

  const { data: existingRounds } = await supabase
    .from("scorecards")
    .select("event_id")
    .eq("player_id", playerId)
    .eq("society_id", societyId)
    .in(
      "event_id",
      events.map((e) => e.id)
    );

  const alreadyLoggedEventIds = new Set((existingRounds ?? []).map((r) => r.event_id));

  return events
    .filter((e) => !alreadyLoggedEventIds.has(e.id))
    .map((e) => ({ id: e.id, name: e.name, eventDate: e.event_date }));
}
