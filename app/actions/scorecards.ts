"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { computeRound, proposedHandicapChange, type RoundType } from "@/lib/golf-math";
import { filterHolesForRoundType } from "@/lib/round-setup";
import type { ActionResult } from "@/app/actions/auth";

// ---------- Course/hole lookups used while building the scorecard form ----------

export async function listCoursesForRound() {
  await requireSession();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, location, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .order("name", { ascending: true });

  if (error) return [];
  return data;
}

export async function getHolesForRound(courseId: string, roundType: RoundType) {
  await requireSession();
  const supabase = createServiceClient();

  const { data: holes, error } = await supabase
    .from("holes")
    .select("id, hole_number, par, stroke_index")
    .eq("course_id", courseId)
    .order("hole_number", { ascending: true });

  if (error || !holes) return [];
  return filterHolesForRoundType(holes, roundType);
}

// ---------- Submission ----------

const scoreRowSchema = z.object({
  holeId: z.string().uuid(),
  grossStrokes: z.number().int().min(1).max(20),
});

const submitSchema = z.object({
  courseId: z.string().uuid("Select a course"),
  teeColor: z.enum(["white", "yellow"]),
  roundType: z.enum(["full_18", "front_9", "back_9"]),
  playedAt: z.string().min(1, "Select the date you played"),
  playingHandicap: z.number({ invalid_type_error: "Enter your playing handicap" }),
});

export async function createScorecard(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

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

  let scoreRows: { holeId: string; grossStrokes: number }[] = [];
  try {
    const rawScores = JSON.parse(String(formData.get("scoresJson") ?? "[]"));
    const scoresParsed = z.array(scoreRowSchema).safeParse(rawScores);
    if (!scoresParsed.success) {
      return { ok: false, error: "Enter a valid gross score (1-20 strokes) for every hole." };
    }
    scoreRows = scoresParsed.data;
  } catch {
    return { ok: false, error: "Enter a score for every hole before submitting." };
  }

  const { courseId, teeColor, roundType, playedAt, playingHandicap } = parsed.data;

  const supabase = createServiceClient();

  // Re-fetch the course + holes server-side — never trust totals computed
  // on the client. This is the authoritative calculation that gets stored.
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return { ok: false, error: "That course could not be found." };
  }

  const { data: allHoles, error: holesError } = await supabase
    .from("holes")
    .select("id, hole_number, par, stroke_index")
    .eq("course_id", courseId);

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

  const grossByHoleId = new Map(scoreRows.map((s) => [s.holeId, s.grossStrokes]));

  const holeInputs = expectedHoles.map((h) => ({
    holeId: h.id,
    par: h.par,
    strokeIndex: h.stroke_index,
    grossStrokes: grossByHoleId.get(h.id)!,
  }));

  const { holeResults, summary } = computeRound(holeInputs, playingHandicap, roundType);
  const change = proposedHandicapChange(summary.totalStablefordPoints, roundType, {
    handicapCutPerPoint: course.handicap_cut_per_point,
    handicapIncreasePerPoint: course.handicap_increase_per_point,
  });

  const { data: scorecard, error: scorecardError } = await supabase
    .from("scorecards")
    .insert({
      player_id: session.playerId,
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
  const supabase = createServiceClient();

  const { data: scorecard, error } = await supabase
    .from("scorecards")
    .select(
      "id, player_id, course_id, tee_color, round_type, playing_handicap, played_at, total_gross_stroke_play, total_net_stroke_play, total_stableford_points, proposed_handicap_change, status, reviewed_at"
    )
    .eq("id", scorecardId)
    .single();

  if (error || !scorecard) return null;

  // Phase 7 note: this used to be owner-or-admin only. Once /rounds became
  // a society-wide feed (see listSocietyRounds below), gating detail pages
  // to the owner would mean every non-owner click 404s — so this is now
  // open to any authenticated society member, matching how the rest of
  // the app already treats handicaps and results as shared/visible within
  // the society rather than private to each player.

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, location, hole_count")
    .eq("id", scorecard.course_id)
    .single();

  const { data: scores } = await supabase
    .from("scores")
    .select("id, hole_id, gross_strokes, net_strokes, stableford_points, holes(hole_number, par, stroke_index)")
    .eq("scorecard_id", scorecardId);

  // See the comment in app/actions/approvals.ts's listPendingScorecards for
  // why this cast (of the whole array, before any property access) is
  // needed rather than casting row.holes after accessing it.
  interface RawScoreRow {
    id: string;
    hole_id: string;
    gross_strokes: number;
    net_strokes: number;
    stableford_points: number;
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

const SOCIETY_FEED_LIMIT = 50;

/** Most recent rounds across the whole society, any status — this is a
 * shared feed, not a per-player one, so it isn't filtered to "my rounds"
 * or "approved only". Capped rather than paginated for now; revisit if a
 * society's round volume ever makes 50 feel too short. */
export async function listSocietyRounds(): Promise<SocietyRoundRow[]> {
  await requireSession();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("scorecards")
    .select(
      "id, played_at, status, total_stableford_points, proposed_handicap_change, players!scorecards_player_id_fkey(first_name, last_name), courses(name)"
    )
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SOCIETY_FEED_LIMIT);

  if (error) {
    console.error("listSocietyRounds query failed:", error);
    return [];
  }
  if (!data) return [];

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

  return rows.map((row) => {
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
}
