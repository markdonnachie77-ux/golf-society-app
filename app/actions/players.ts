"use server";

import { requireSession, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

export interface PlayerListRow {
  id: string;
  first_name: string;
  last_name: string;
  current_handicap: number;
  role: string;
}

export async function listAllPlayers(): Promise<PlayerListRow[]> {
  await requireSession();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_handicap, role")
    .order("last_name", { ascending: true });

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
  const supabase = createServiceClient();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, first_name, last_name, current_handicap, role, created_at")
    .eq("id", playerId)
    .single();

  if (playerError || !player) return null;

  const { data: historyRows } = await supabase
    .from("handicap_history")
    .select("handicap_value, adjustment_amount, effective_date, notes")
    .eq("player_id", playerId)
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

  if (Number.isNaN(newHandicap)) {
    return { ok: false, error: "Enter a valid handicap." };
  }
  if (newHandicap < -10 || newHandicap > 54) {
    return { ok: false, error: "That handicap looks out of range (-10 to 54)." };
  }

  const supabase = createServiceClient();

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
  const supabase = createServiceClient();

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
