"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import { computeRound, proposedHandicapChange, type RoundType } from "@/lib/golf-math";
import { filterHolesForRoundType } from "@/lib/round-setup";
import type { ActionResult } from "@/app/actions/auth";
import { getAppSettings } from "@/lib/app-settings";

// ---------- Course/hole lookups used while building the scorecard form ----------

export async function listCoursesForRound() {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, location, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .eq("society_id", societyId)
    .order("name", { ascending: true });

  if (error) return [];
  return data;
}

export async function getHolesForRound(courseId: string, roundType: RoundType) {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Scoping by society_id here (not just course_id) matters: without it,
  // a courseId belonging to a different tenant would still return that
  // tenant's hole layout — leaking their course setup into this one.
  const { data: holes, error } = await supabase
    .from("holes")
    .select("id, hole_number, par, stroke_index")
    .eq("course_id", courseId)
    .eq("society_id", societyId)
    .order("hole_number", { ascending: true });

  if (error || !holes) return [];
  return filterHolesForRoundType(holes, roundType);
}

// ---------- Submission ----------

const scoreRowSchema = z
  .object({
    holeId: z.string().uuid(),
    grossStrokes: z.number().int().min(1).max(20).nullable(),
    pickedUp: z.boolean(),
  })
  .refine(
    (row) => (row.pickedUp && row.grossStrokes === null) || (!row.pickedUp && row.grossStrokes !== null),
    { message: "Each hole needs either a gross score (1-20) or to be marked picked up." }
  );

const submitSchema = z.object({
  courseId: z.string().uuid("Select a course"),
  teeColor: z.enum(["white", "yellow"]),
  roundType: z.enum(["full_18", "front_9", "back_9"]),
  playedAt: z.string().min(1, "Select the date you played"),
  playingHandicap: z.number({ invalid_type_error: "Enter your playing handicap" }),
});

export async function createScorecard(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  if (session.role !== "admin") {
    const settings = await getAppSettings();
    if (!settings.playersCanLogOwnRounds) {
      return {
        ok: false,
        error: "Round logging is currently restricted to admins — ask an admin to log this round for you.",
      };
    }
  }

  // Admins can log a round on behalf of another player (e.g. a member
  // without a phone handy, or entering a paper scorecard). Everyone else
  // can only ever submit for themselves — this is enforced here, not just
  // hidden in the UI, so a non-admin can't submit a crafted request to
  // attribute a round to someone else.
  const onBehalfRaw = String(formData.get("onBehalfOfPlayerId") ?? "").trim();
  let targetPlayerId = session.playerId;

  if (onBehalfRaw && onBehalfRaw !== session.playerId) {
    if (session.role !== "admin") {
      return { ok: false, error: "Only admins can log a round on behalf of another player." };
    }
    if (!z.string().uuid().safeParse(onBehalfRaw).success) {
      return { ok: false, error: "Invalid player selected." };
    }
    // Confirm the target player actually belongs to THIS admin's own
    // society — without this check, an admin could log a round for a
    // player id belonging to a completely different tenant, if they
    // somehow obtained it (a leaked URL, a guessed id, etc.).
    const { data: targetPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("id", onBehalfRaw)
      .eq("society_id", societyId)
      .maybeSingle();
    if (!targetPlayer) {
      return { ok: false, error: "Invalid player selected." };
    }
    targetPlayerId = onBehalfRaw;
  }

  const parsed = submitSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    teeColor: String(formData.get("teeColor") ?? ""),
    roundType: String(formData.get("roundType") ?? ""),
    playedAt: String(formData.get("playedAt") ?? ""),
    playingHandicap: Number(formData.get("playingHandicap")),
  });

  if (!parsed.success) {
    return { ok: false, error: "Please fill in every field before submitting." };
  }

  let scoreRows: { holeId: string; grossStrokes: number | null; pickedUp: boolean }[] = [];
  try {
    const rawScores = JSON.parse(String(formData.get("scoresJson") ?? "[]"));
    const scoresParsed = z.array(scoreRowSchema).safeParse(rawScores);
    if (!scoresParsed.success) {
      return {
        ok: false,
        error: "Enter a valid gross score (1-20 strokes) or mark picked up for every hole.",
      };
    }
    scoreRows = scoresParsed.data;
  } catch {
    return { ok: false, error: "Enter a score for every hole before submitting." };
  }

  const { courseId, teeColor, roundType, playedAt, playingHandicap } = parsed.data;

  // Re-fetch the course + holes server-side — never trust totals computed
  // on the client. This is the authoritative calculation that gets
  // stored. Scoping by society_id here means a courseId belonging to a
  // different tenant is treated as not found, not as "found, and let's
  // use their rates/hole layout."
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .eq("id", courseId)
    .eq("society_id", societyId)
    .single();

  if (courseError || !course) {
    return { ok: false, error: "That course could not be found." };
  }

  const { data: allHoles, error: holesError } = await supabase
    .from("holes")
    .select("id, hole_number, par, stroke_index")
    .eq("course_id", courseId)
    .eq("society_id", societyId);

  if (holesError || !allHoles) {
    return { ok: false, error: "Could not load this course's holes." };
  }

  const expectedHoles = filterHolesForRoundType(allHoles, roundType);

  if (expectedHoles.length === 0) {
    return { ok: false, error: "This course doesn't support that round type." };
  }

  const expectedHoleIds = new Set(expectedHoles.map((h) => h.id));
  const submittedHoleIds = new Set(scoreRows.map((s) => s.holeId));

  if (
    expectedHoleIds.size !== submittedHoleIds.size ||
    ![...expectedHoleIds].every((id) => submittedHoleIds.has(id))
  ) {
    return { ok: false, error: "Scores don't match this round's holes. Please try again." };
  }

  const scoreByHoleId = new Map(scoreRows.map((s) => [s.holeId, s]));

  const holeInputs = expectedHoles.map((h) => {
    const score = scoreByHoleId.get(h.id)!;
    return {
      holeId: h.id,
      par: h.par,
      strokeIndex: h.stroke_index,
      grossStrokes: score.grossStrokes,
      pickedUp: score.pickedUp,
    };
  });

  const { holeResults, summary } = computeRound(holeInputs, playingHandicap, roundType);
  const change = proposedHandicapChange(summary.totalStablefordPoints, roundType, {
    handicapCutPerPoint: course.handicap_cut_per_point,
    handicapIncreasePerPoint: course.handicap_increase_per_point,
  });

  const { data: scorecard, error: scorecardError } = await supabase
    .from("scorecards")
    .insert({
      player_id: targetPlayerId,
      course_id: courseId,
      tee_color: teeColor,
      round_type: roundType,
      playing_handicap: playingHandicap,
      played_at: playedAt,
      total_gross_stroke_play: summary.totalGrossStrokePlay,
      total_net_stroke_play: summary.totalNetStrokePlay,
      total_stableford_points: summary.totalStablefordPoints,
      proposed_handicap_change: change,
      status: "pending_approval",
      society_id: societyId,
    })
    .select("id")
    .single();

  if (scorecardError || !scorecard) {
    return { ok: false, error: "Could not save your scorecard. Please try again." };
  }

  const { error: scoresError } = await supabase.from("scores").insert(
    holeResults.map((h) => ({
      scorecard_id: scorecard.id,
      hole_id: h.holeId,
      gross_strokes: h.grossStrokes,
      net_strokes: h.netStrokes,
      stableford_points: h.stablefordPoints,
      picked_up: h.pickedUp,
      society_id: societyId,
    }))
  );

  if (scoresError) {
    await supabase.from("scorecards").delete().eq("id", scorecard.id);
    return { ok: false, error: "Could not save your hole-by-hole scores. Please try again." };
  }

  redirect(`/rounds/${scorecard.id}`);
}

// ---------- Retrieval ----------

export async function getScorecardDetail(scorecardId: string) {
  await requireSession(); // just needs to be logged in — see note below
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Scoping this by society_id is the critical line in this function: an
  // authenticated player from ANY society can view ANY scorecard's detail
  // (see the Phase 7 note below) — but only within their OWN society.
  // Without this filter, that Phase 7 openness would leak across tenants
  // entirely, not just within one society.
  const { data: scorecard, error } = await supabase
    .from("scorecards")
    .select(
      "id, player_id, course_id, tee_color, round_type, playing_handicap, played_at, total_gross_stroke_play, total_net_stroke_play, total_stableford_points, proposed_handicap_change, status, reviewed_at"
    )
    .eq("id", scorecardId)
    .eq("society_id", societyId)
    .single();

  if (error || !scorecard) return null;

  // Phase 7 note: this used to be owner-or-admin only. Once /rounds became
  // a society-wide feed (see listSocietyRounds below), gating detail pages
  // to the owner would mean every non-owner click 404s — so this is now
  // open to any authenticated society member, matching how the rest of
  // the app already treats handicaps and results as shared/visible within
  // the society rather than private to each player. "Within the society"
  // is the operative phrase — see the society_id filter above.

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, location, hole_count")
    .eq("id", scorecard.course_id)
    .eq("society_id", societyId)
    .single();

  const { data: scores } = await supabase
    .from("scores")
    .select("id, hole_id, gross_strokes, net_strokes, stableford_points, picked_up, holes(hole_number, par, stroke_index)")
    .eq("scorecard_id", scorecardId)
    .eq("society_id", societyId);

  // See the comment in app/actions/approvals.ts's listPendingScorecards for
  // why this cast (of the whole array, before any property access) is
  // needed rather than casting row.holes after accessing it.
  interface RawScoreRow {
    id: string;
    hole_id: string;
    gross_strokes: number | null;
    net_strokes: number | null;
    stableford_points: number;
    picked_up: boolean;
    holes: { hole_number: number; par: number; stroke_index: number } | null;
  }
  const rawScores = (scores ?? []) as unknown as RawScoreRow[];

  const sortedScores = rawScores.slice().sort((a, b) => {
    const aNum = a.holes?.hole_number ?? 0;
    const bNum = b.holes?.hole_number ?? 0;
    return aNum - bNum;
  });

  // proposed_handicap_change on the scorecard itself is never mutated by an
  // admin override (see supabase/migrations/0008_approval_functions.sql) —
  // it's kept as the original calculated proposal for audit purposes. If
  // this round was approved, the actually-applied amount lives on the
  // handicap_history row the approval created instead.
  let appliedChange: number | null = null;
  if (scorecard.status === "approved") {
    const { data: historyRow } = await supabase
      .from("handicap_history")
      .select("adjustment_amount")
      .eq("scorecard_id", scorecardId)
      .eq("society_id", societyId)
      .maybeSingle();
    appliedChange = historyRow?.adjustment_amount ?? null;
  }

  return { scorecard, course, scores: sortedScores, appliedChange };
}

// ---------- Society-wide feed ----------

export interface SocietyRoundRow {
  id: string;
  played_at: string;
  status: string;
  total_stableford_points: number | null;
  proposed_handicap_change: number | null;
  player_name: string;
  course_name: string;
}

export interface PaginatedRounds {
  rounds: SocietyRoundRow[];
  page: number;
  totalPages: number;
  totalCount: number;
}

const ROUNDS_PER_PAGE = 20;

/** Most recent rounds across the whole society, any status — this is a
 * shared feed, not a per-player one, so it isn't filtered to "my rounds"
 * or "approved only". Was a flat cap-at-50 with no way to see anything
 * older; now genuinely paginated via Supabase's .range(), 20 per page,
 * with an exact total count so the UI knows how many pages exist. */
export async function listSocietyRounds(page = 1): Promise<PaginatedRounds> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Guard against a garbage/negative/non-integer page value reaching the
  // query — e.g. someone hand-editing the URL's ?page= param.
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * ROUNDS_PER_PAGE;
  const to = from + ROUNDS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from("scorecards")
    .select(
      "id, played_at, status, total_stableford_points, proposed_handicap_change, players!scorecards_player_id_fkey(first_name, last_name), courses(name)",
      { count: "exact" }
    )
    .eq("society_id", societyId)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const empty: PaginatedRounds = { rounds: [], page: safePage, totalPages: 1, totalCount: 0 };

  if (error) {
    console.error("listSocietyRounds query failed:", error);
    return empty;
  }
  if (!data) return empty;

  interface RawRow {
    id: string;
    played_at: string;
    status: string;
    total_stableford_points: number | null;
    proposed_handicap_change: number | null;
    players: { first_name: string; last_name: string } | null;
    courses: { name: string } | null;
  }
  const rows = data as unknown as RawRow[];

  const rounds = rows.map((row) => {
    const player = row.players;
    const course = row.courses;
    return {
      id: row.id,
      played_at: row.played_at,
      status: row.status,
      total_stableford_points: row.total_stableford_points,
      proposed_handicap_change: row.proposed_handicap_change,
      player_name: player ? `${player.first_name} ${player.last_name}` : "Unknown player",
      course_name: course?.name ?? "Unknown course",
    };
  });

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ROUNDS_PER_PAGE));

  return { rounds, page: safePage, totalPages, totalCount };
}

// ---------- Deletion (admin only) ----------

export async function deleteRound(scorecardId: string): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // The delete_round RPC operates purely by scorecard id, with no
  // tenant awareness of its own — so the ownership check has to happen
  // here, before calling it. Without this, an admin could delete ANY
  // scorecard in ANY society just by knowing/guessing its id, since the
  // RPC itself would happily act on it.
  const { data: target } = await supabase
    .from("scorecards")
    .select("id")
    .eq("id", scorecardId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: "Round not found." };
  }

  // Cast bypasses TypeScript's .rpc() argument-shape check — see the
  // identical comment in app/actions/approvals.ts's approveScorecard for
  // why. No effect at runtime.
  const { error } = await (supabase.rpc as any)("delete_round", {
    p_scorecard_id: scorecardId,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not delete this round." };
  }

  return { ok: true };
}
