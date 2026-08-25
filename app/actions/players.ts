"use server";

import { requireSession, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import type { ActionResult } from "@/app/actions/auth";

export interface PlayerListRow {
  id: string;
  first_name: string;
  last_name: string;
  current_handicap: number;
  role: string;
}

/**
 * Default order is alphabetical by last name — sortByHandicap is
 * optional so every existing caller (the admin "log on behalf of"
 * picker, the rounds feed's player filter dropdown) keeps its current
 * behavior unchanged; only /players itself passes it.
 */
export async function listAllPlayers(sortByHandicap?: "asc" | "desc"): Promise<PlayerListRow[]> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  let query = supabase
    .from("players")
    .select("id, first_name, last_name, current_handicap, role")
    .eq("society_id", societyId);

  query = sortByHandicap
    ? query.order("current_handicap", { ascending: sortByHandicap === "asc" })
    : query.order("last_name", { ascending: true });

  const { data, error } = await query;

  if (error || !data) return [];
  return data;
}

export interface HandicapHistoryPoint {
  effectiveDate: string;
  handicapValue: number;
  adjustmentAmount: number;
  notes: string | null;
}

export interface RecentRoundRow {
  id: string;
  playedAt: string;
  courseName: string;
  status: string;
  totalStablefordPoints: number | null;
}

export async function getPlayerProfile(playerId: string) {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Scoping this by society_id is what makes /players/[id] safe to keep
  // open to any authenticated society member (same reasoning as
  // getScorecardDetail in scorecards.ts) — a playerId belonging to a
  // different tenant is treated as not found, not as "found, show their
  // profile too."
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_handicap, role, created_at")
    .eq("id", playerId)
    .eq("society_id", societyId)
    .single();

  if (playerError || !player) return null;

  const { data: historyRows } = await supabase
    .from("handicap_history")
    .select("handicap_value, adjustment_amount, effective_date, notes")
    .eq("player_id", playerId)
    .eq("society_id", societyId)
    .order("effective_date", { ascending: true });

  const history: HandicapHistoryPoint[] = (historyRows ?? []).map((h) => ({
    effectiveDate: h.effective_date,
    handicapValue: h.handicap_value,
    adjustmentAmount: h.adjustment_amount,
    notes: h.notes,
  }));

  const { data: roundRows } = await supabase
    .from("scorecards")
    .select("id, played_at, status, total_stableford_points, courses(name)")
    .eq("player_id", playerId)
    .eq("society_id", societyId)
    .order("played_at", { ascending: false })
    .limit(10);

  interface RawRoundRow {
    id: string;
    played_at: string;
    status: string;
    total_stableford_points: number | null;
    courses: { name: string } | null;
  }
  const rawRoundRows = (roundRows ?? []) as unknown as RawRoundRow[];

  const recentRounds: RecentRoundRow[] = rawRoundRows.map((r) => {
    const course = r.courses;
    return {
      id: r.id,
      playedAt: r.played_at,
      courseName: course?.name ?? "Unknown course",
      status: r.status,
      totalStablefordPoints: r.total_stableford_points,
    };
  });

  return { player, history, recentRounds };
}

export async function adjustPlayerHandicap(
  playerId: string,
  newHandicap: number,
  notes: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  const societyId = await getCurrentSocietyId();

  if (Number.isNaN(newHandicap)) {
    return { ok: false, error: "Enter a valid handicap." };
  }
  if (newHandicap < -10 || newHandicap > 54) {
    return { ok: false, error: "That handicap looks out of range (-10 to 54)." };
  }

  const supabase = createServiceClient();

  // manual_handicap_adjustment operates purely by player id, with no
  // tenant awareness of its own — so the ownership check happens here,
  // before calling it. Without this, an admin could adjust the handicap
  // of ANY player in ANY society just by knowing/guessing their id.
  const { data: target } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: "Player not found." };
  }

  // Cast bypasses TypeScript's .rpc() argument-shape check — see the
  // identical comment in app/actions/approvals.ts's approveScorecard for
  // why. No effect at runtime.
  const { error } = await (supabase.rpc as any)("manual_handicap_adjustment", {
    p_player_id: playerId,
    p_new_handicap: newHandicap,
    p_admin_id: session.playerId,
    p_notes: notes,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not update this player's handicap." };
  }

  return { ok: true };
}

export async function wipePlayerHistory(playerId: string): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Same reasoning as adjustPlayerHandicap above — wipe_player_history
  // has no tenant awareness of its own, so the ownership check happens
  // here, before calling it.
  const { data: target } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: "Player not found." };
  }

  // Cast bypasses TypeScript's .rpc() argument-shape check — see the
  // identical comment in app/actions/approvals.ts's approveScorecard for
  // why. No effect at runtime.
  const { error } = await (supabase.rpc as any)("wipe_player_history", {
    p_player_id: playerId,
  });

  if (error) {
    return { ok: false, error: error.message || "Could not wipe this player's history." };
  }

  return { ok: true };
}

// ---------- Gross score stats (dashboard) ----------

export interface BestRound {
  scorecardId: string;
  grossScore: number;
  courseName: string;
  playedAt: string;
}

export interface GrossScoreCategory {
  average: number | null;
  best: BestRound | null;
  roundCount: number;
}

export interface GrossScoreStats {
  nineHole: GrossScoreCategory;
  eighteenHole: GrossScoreCategory;
}

const EMPTY_CATEGORY: GrossScoreCategory = { average: null, best: null, roundCount: 0 };

interface RawScorecardRow {
  id: string;
  round_type: string;
  total_gross_stroke_play: number | null;
  played_at: string;
  courses: { name: string } | null;
}

function summarizeGrossScores(rows: RawScorecardRow[]): GrossScoreCategory {
  if (rows.length === 0) return { ...EMPTY_CATEGORY };

  const total = rows.reduce((sum, r) => sum + (r.total_gross_stroke_play ?? 0), 0);
  const average = Math.round((total / rows.length) * 10) / 10;

  const best = rows.reduce((lowest, r) =>
    (r.total_gross_stroke_play ?? Infinity) < (lowest.total_gross_stroke_play ?? Infinity) ? r : lowest
  );

  return {
    average,
    roundCount: rows.length,
    best: {
      scorecardId: best.id,
      grossScore: best.total_gross_stroke_play!,
      courseName: best.courses?.name ?? "Unknown course",
      playedAt: best.played_at,
    },
  };
}

/**
 * Gross-score average and best round, split by 9 vs 18 holes (a 9-hole
 * total and an 18-hole total aren't comparable, so lumping them together
 * would be meaningless). Only approved rounds count — pending/rejected
 * aren't a real, verified score yet. Rounds with ANY picked-up hole are
 * excluded entirely: a picked-up hole means total_gross_stroke_play only
 * sums the completed holes (see lib/golf-math.ts's summarizeRound), so
 * it's a partial total, not a real comparable score — including it could
 * make an incomplete round look like someone's best round.
 */
export async function getPlayerGrossScoreStats(playerId: string): Promise<GrossScoreStats> {
  await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: scorecards } = await supabase
    .from("scorecards")
    .select("id, round_type, total_gross_stroke_play, played_at, courses(name)")
    .eq("player_id", playerId)
    .eq("society_id", societyId)
    .eq("status", "approved");

  if (!scorecards || scorecards.length === 0) {
    return { nineHole: { ...EMPTY_CATEGORY }, eighteenHole: { ...EMPTY_CATEGORY } };
  }

  const rows = scorecards as unknown as RawScorecardRow[];
  const scorecardIds = rows.map((r) => r.id);

  const { data: pickedUpRows } = await supabase
    .from("scores")
    .select("scorecard_id")
    .in("scorecard_id", scorecardIds)
    .eq("picked_up", true);

  const excludedIds = new Set((pickedUpRows ?? []).map((r) => r.scorecard_id));

  const complete = rows.filter((r) => !excludedIds.has(r.id) && r.total_gross_stroke_play !== null);

  const nineHoleRows = complete.filter((r) => r.round_type === "front_9" || r.round_type === "back_9");
  const eighteenHoleRows = complete.filter((r) => r.round_type === "full_18");

  return {
    nineHole: summarizeGrossScores(nineHoleRows),
    eighteenHole: summarizeGrossScores(eighteenHoleRows),
  };
}
