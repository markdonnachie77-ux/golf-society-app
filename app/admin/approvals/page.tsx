import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listPendingScorecards } from "@/app/actions/approvals";
import { Card, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function AdminApprovalsPage() {
  await requireAdmin();
  const pending = await listPendingScorecards();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Approval queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending.length === 0
              ? "Nothing waiting on you."
              : `${pending.length} scorecard${pending.length === 1 ? "" : "s"} awaiting review, oldest first.`}
          </p>
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              All caught up.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            {pending.map((row, i) => (
              <div key={row.id}>
                {i > 0 && <div className="ledger-rule" />}
                <Link
                  href={`/rounds/${row.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-secondary"
                >
                  <div>
                    <p className="font-medium">{row.player_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.course_name} · {new Date(row.played_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right font-numeral text-sm">
                    <p>{row.total_stableford_points} pts</p>
                    <p className="text-muted-foreground">
                      {row.proposed_handicap_change! > 0 ? "+" : ""}
                      {row.proposed_handicap_change}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
