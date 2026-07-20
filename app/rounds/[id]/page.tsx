import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getScorecardDetail } from "@/app/actions/scorecards";
import { AdminApprovalPanel } from "@/components/admin-approval-panel";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<string, string> = {
  pending_approval: "bg-accent/15 text-accent",
  approved: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
};

interface ScoreRow {
  id: string;
  hole_id: string;
  gross_strokes: number;
  net_strokes: number;
  stableford_points: number;
  holes: { hole_number: number; par: number; stroke_index: number } | null;
}

export default async function ScorecardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const result = await getScorecardDetail(id);

  if (!result) {
    notFound();
  }

  const { scorecard, course, scores, appliedChange } = result;
  const rows = scores as unknown as ScoreRow[];

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-numeral text-xs uppercase tracking-widest text-accent">
              Society Handicap Register
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold">
              {course?.name ?? "Round"}
            </h1>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              STATUS_STYLE[scorecard.status]
            )}
          >
            {STATUS_LABEL[scorecard.status]}
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Result</CardTitle>
            <CardDescription>
              Played {new Date(scorecard.played_at).toLocaleDateString()} · {scorecard.tee_color}{" "}
              tees · playing handicap {scorecard.playing_handicap}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 font-numeral">
              <div>
                <p className="text-2xl font-semibold">{scorecard.total_gross_stroke_play}</p>
                <p className="text-xs text-muted-foreground">Gross</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{scorecard.total_net_stroke_play}</p>
                <p className="text-xs text-muted-foreground">Net</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{scorecard.total_stableford_points}</p>
                <p className="text-xs text-muted-foreground">Stableford pts</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {scorecard.status === "pending_approval" &&
                `Proposed handicap change (pending admin approval): ${
                  scorecard.proposed_handicap_change! > 0 ? "+" : ""
                }${scorecard.proposed_handicap_change}`}
              {scorecard.status === "approved" &&
                `Applied handicap change: ${appliedChange! > 0 ? "+" : ""}${appliedChange}`}
              {scorecard.status === "rejected" && "This round was rejected — no handicap change was applied."}
            </p>
          </CardContent>
        </Card>

        {session.role === "admin" && scorecard.status === "pending_approval" && (
          <div className="mt-6">
            <AdminApprovalPanel
              scorecardId={scorecard.id}
              proposedChange={scorecard.proposed_handicap_change ?? 0}
            />
          </div>
        )}

        <div className="mt-6 rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[3rem_3rem_3rem_3rem_3rem_1fr] gap-2 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Hole</span>
            <span>Par</span>
            <span>SI</span>
            <span>Gross</span>
            <span>Net</span>
            <span>Pts</span>
          </div>
          {rows.map((row, i) => (
            <div key={row.id}>
              {i > 0 && <div className="ledger-rule" />}
              <div className="grid grid-cols-[3rem_3rem_3rem_3rem_3rem_1fr] items-center gap-2 px-4 py-2 font-numeral text-sm">
                <span>{row.holes?.hole_number}</span>
                <span className="text-muted-foreground">{row.holes?.par}</span>
                <span className="text-muted-foreground">{row.holes?.stroke_index}</span>
                <span>{row.gross_strokes}</span>
                <span className="text-muted-foreground">{row.net_strokes}</span>
                <span className="font-semibold">{row.stableford_points}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
