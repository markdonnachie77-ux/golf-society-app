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
  searchParams: Promise<{
    page?: string;
    player?: string;
    course?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const {
    page: pageParam,
    player: playerId,
    course: courseId,
    from: dateFrom,
    to: dateTo,
    sort: sortParam,
  } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const sortByScore = sortParam === "asc" || sortParam === "desc" ? sortParam : undefined;
  const hasActiveFilter = Boolean(playerId || courseId || dateFrom || dateTo);

  const [{ rounds, totalPages, totalCount }, players, courses] = await Promise.all([
    listSocietyRounds(page, { playerId, courseId, dateFrom, dateTo }, sortByScore),
    listAllPlayers(),
    listCoursesForRound(),
  ]);

  const extraParams: Record<string, string> = {};
  if (playerId) extraParams.player = playerId;
  if (courseId) extraParams.course = courseId;
  if (dateFrom) extraParams.from = dateFrom;
  if (dateTo) extraParams.to = dateTo;
  if (sortByScore) extraParams.sort = sortByScore;

  // Clicking "Score" cycles unsorted -> highest first -> lowest first ->
  // unsorted. Page resets to 1 on every change, same reasoning as
  // changing a filter — a different order means different page contents.
  const scoreSortParams = new URLSearchParams(extraParams);
  scoreSortParams.delete("page");
  const nextSort = sortByScore === undefined ? "desc" : sortByScore === "desc" ? "asc" : undefined;
  if (nextSort) {
    scoreSortParams.set("sort", nextSort);
  } else {
    scoreSortParams.delete("sort");
  }
  const scoreHeaderHref = `/rounds${scoreSortParams.toString() ? `?${scoreSortParams.toString()}` : ""}`;
  const scoreIndicator = sortByScore === "desc" ? " ▼" : sortByScore === "asc" ? " ▲" : "";

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
                  hasActiveFilter ? " matching this filter" : " logged across the society"
                }, most recent first.`}
          </p>
        </div>

        <RoundsFilterBar
          players={players}
          courses={courses}
          selectedPlayerId={playerId}
          selectedCourseId={courseId}
          selectedDateFrom={dateFrom}
          selectedDateTo={dateTo}
          selectedSort={sortByScore}
        />

        {rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasActiveFilter ? "No rounds match this filter." : "No rounds logged yet."}
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-end px-1">
              <Link
                href={scoreHeaderHref}
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                Score{scoreIndicator}
              </Link>
            </div>

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
          </>
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
