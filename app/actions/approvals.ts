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
      "id, played_at, tee_color, round_type, total_gross_stroke_play, total_net_stroke_play, total_stableford_points, proposed_handicap_change, created_at, players!scorecards_player_id_fkey(first_name, last_name), courses(name)"
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  if (error) {
    // scorecards has TWO foreign keys into players (player_id AND
    // reviewed_by) — an unqualified `players(...)` embed is ambiguous to
    // PostgREST and errors. Logging here rather than silently returning []
    // is deliberate: that's exactly the bug this comment is fixing (the
    // approval queue looked empty because this error was being swallowed).
    console.error("listPendingScorecards query failed:", error);
    return [];
  }
  if (!data) return [];

  // The hand-written Database type (lib/database.types.ts) doesn't declare
  // foreign-key Relationships metadata, so supabase-js can't infer the
  // shape of embedded columns like players(...) / courses(...) at all —
  // TypeScript sees them as not existing on the row, and errors on the
  // property access itself (a build-only failure `tsx` never caught here,
  // since it needs full `next build` type-checking with node_modules
  // present to surface). Casting the whole array to the shape we know the
  // query actually returns, before touching any property, sidesteps that.
  interface RawRow {
    id: string;
    played_at: string;
    tee_color: string;
    round_type: string;
    total_gross_stroke_play: number | null;
    total_net_stroke_play: number | null;
    total_stableford_points: number | null;
    proposed_handicap_change: number | null;
    created_at: string;
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
