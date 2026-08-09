import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getPlayerProfile } from "@/app/actions/players";
import { HandicapTimelineChart } from "@/components/handicap-timeline-chart";
import { AdminHandicapPanel } from "@/components/admin-handicap-panel";
import { AdminWipeHistoryPanel } from "@/components/admin-wipe-history-panel";
import { AdminResetPinPanel } from "@/components/admin-reset-pin-panel";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SCORECARD_STATUS_LABEL, SCORECARD_STATUS_STYLE } from "@/lib/scorecard-status";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const result = await getPlayerProfile(id);

  if (!result) {
    notFound();
  }

  const { player, history, recentRounds } = result;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">
            {player.first_name} {player.last_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Member since {new Date(player.created_at).toLocaleDateString()}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Handicap</CardTitle>
            <CardDescription>
              Tracks approved rounds and any manual admin adjustments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 font-numeral text-4xl font-semibold text-primary">
              {player.current_handicap}
            </div>
            <HandicapTimelineChart
              history={history}
              registeredAt={player.created_at}
              currentHandicap={player.current_handicap}
            />
          </CardContent>
        </Card>

        {session.role === "admin" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminHandicapPanel playerId={player.id} currentHandicap={player.current_handicap} />
            <AdminWipeHistoryPanel playerId={player.id} />
            <AdminResetPinPanel playerId={player.id} />
          </div>
        )}

        <div className="mt-6">
          <h2 className="font-display mb-3 text-lg font-semibold">Recent rounds</h2>
          {recentRounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rounds logged yet.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              {recentRounds.map((round, i) => (
                <div key={round.id}>
                  {i > 0 && <div className="ledger-rule" />}
                  <Link
                    href={`/rounds/${round.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-secondary"
                  >
                    <div>
                      <p className="font-medium">{round.courseName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(round.playedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {round.totalStablefordPoints !== null && (
                        <span className="font-numeral text-sm text-muted-foreground">
                          {round.totalStablefordPoints} pts
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          SCORECARD_STATUS_STYLE[round.status]
                        )}
                      >
                        {SCORECARD_STATUS_LABEL[round.status]}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
