"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

export interface PendingScorecardRow {
  id: string;
  played_at: string;
  tee_color: string;
  round_type: string;
  total_gross_stroke_play: number | null;
  total_net_stroke_play: number | null;
  total_stableford_points: number | null;
  proposed_handicap_change: number | null;
  created_at: string;
  player_name: string;
  course_name: string;
}

export async function listPendingScorecards(): Promise<PendingScorecardRow[]> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("scorecards")
    .select(
      "id, played_at, tee_color, round_type, total_gross_stroke_play, total_net_stroke_play, total_stableford_points, proposed_handicap_change, created_at, players(first_name, last_name), courses(name)"
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const player = row.players as unknown as { first_name: string; last_name: string } | null;
    const course = row.courses as unknown as { name: string } | null;
    return {
      id: row.id,
      played_at: row.played_at,
      tee_color: row.tee_color,
      round_type: row.round_type,
      total_gross_stroke_play: row.total_gross_stroke_play,
      total_net_stroke_play: row.total_net_stroke_play,
      total_stableford_points: row.total_stableford_points,
      proposed_handicap_change: row.proposed_handicap_change,
      created_at: row.created_at,
      player_name: player ? `${player.first_name} ${player.last_name}` : "Unknown player",
      course_name: course?.name ?? "Unknown course",
    };
  });
}

export async function approveScorecard(
  scorecardId: string,
  appliedChange: number
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.rpc("approve_scorecard", {
    p_scorecard_id: scorecardId,
    p_reviewer_id: session.playerId,
    p_applied_change: appliedChange,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not approve this scorecard. It may have already been reviewed.",
    };
  }

  revalidatePath("/admin/approvals");
  revalidatePath(`/rounds/${scorecardId}`);
  return { ok: true };
}

export async function rejectScorecard(scorecardId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.rpc("reject_scorecard", {
    p_scorecard_id: scorecardId,
    p_reviewer_id: session.playerId,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not reject this scorecard. It may have already been reviewed.",
    };
  }

  revalidatePath("/admin/approvals");
  revalidatePath(`/rounds/${scorecardId}`);
  return { ok: true };
}
