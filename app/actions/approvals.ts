"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
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
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("scorecards")
    .select(
      "id, played_at, tee_color, round_type, total_gross_stroke_play, total_net_stroke_play, total_stableford_points, proposed_handicap_change, created_at, players!scorecards_player_id_fkey(first_name, last_name), courses(name)"
    )
    .eq("status", "pending_approval")
    .eq("society_id", societyId)
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
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // approve_scorecard operates purely by scorecard id, with no tenant
  // awareness of its own — so the ownership check has to happen here,
  // before calling it. Without this, an admin could approve (and apply a
  // real handicap change to) ANY scorecard in ANY society just by
  // knowing/guessing its id.
  const { data: target } = await supabase
    .from("scorecards")
    .select("id")
    .eq("id", scorecardId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: "Round not found." };
  }

  // Cast bypasses TypeScript's .rpc() argument-shape check specifically —
  // the hand-written `Functions` type in lib/database.types.ts (no
  // generated Relationships/overload metadata, since it wasn't produced
  // by `supabase gen types`) doesn't line up with what this installed
  // supabase-js version's .rpc() generics expect, and previous attempts
  // to match it exactly kept surfacing new mismatches at build time. This
  // has zero effect at runtime — .rpc() just sends the function name and
  // JSON args over the wire regardless of how TypeScript typed the call.
  const { error } = await (supabase.rpc as any)("approve_scorecard", {
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
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // Same reasoning as approveScorecard above — reject_scorecard has no
  // tenant awareness of its own, so the ownership check happens here.
  const { data: target } = await supabase
    .from("scorecards")
    .select("id")
    .eq("id", scorecardId)
    .eq("society_id", societyId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: "Round not found." };
  }

  const { error } = await (supabase.rpc as any)("reject_scorecard", {
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
