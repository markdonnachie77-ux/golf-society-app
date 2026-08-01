import Link from "next/link";
import { listSocietyRounds, listCoursesForRound } from "@/app/actions/scorecards";
import { listAllPlayers } from "@/app/actions/players";
import { cn } from "@/lib/utils";
import { SCORECARD_STATUS_LABEL, SCORECARD_STATUS_STYLE } from "@/lib/scorecard-status";
import { BrandEyebrow } from "@/components/brand-eyebrow";
import { PaginationControls } from "@/components/pagination-controls";
import { RoundsFilterBar } from "@/components/rounds-filter-bar";

export default async function RoundsFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; player?: string; course?: string }>;
}) {
  const { page: pageParam, player: playerId, course: courseId } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ rounds, totalPages, totalCount }, players, courses] = await Promise.all([
    listSocietyRounds(page, { playerId, courseId }),
    listAllPlayers(),
    listCoursesForRound(),
  ]);

  const extraParams: Record<string, string> = {};
  if (playerId) extraParams.player = playerId;
  if (courseId) extraParams.course = courseId;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Rounds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount === 0
              ? "Every round logged across the society, most recent first."
              : `${totalCount} round${totalCount === 1 ? "" : "s"}${
                  playerId || courseId ? " matching this filter" : " logged across the society"
                }, most recent first.`}
          </p>
        </div>

        <RoundsFilterBar
          players={players}
          courses={courses}
          selectedPlayerId={playerId}
          selectedCourseId={courseId}
        />

        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {playerId || courseId ? "No rounds match this filter." : "No rounds logged yet."}
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            {rounds.map((round, i) => (
              <div key={round.id}>
                {i > 0 && <div className="ledger-rule" />}
                <Link
                  href={`/rounds/${round.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-secondary"
                >
                  <div>
                    <p className="font-medium">{round.player_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {round.course_name} · {new Date(round.played_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {round.total_stableford_points !== null && (
                      <span className="font-numeral text-sm text-muted-foreground">
                        {round.total_stableford_points} pts
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

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          basePath="/rounds"
          extraParams={extraParams}
        />
      </div>
    </main>
  );
}
