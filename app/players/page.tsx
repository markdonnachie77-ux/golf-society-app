import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listAllPlayers } from "@/app/actions/players";
import { Button } from "@/components/ui/button";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await requireSession();
  const { sort: sortParam } = await searchParams;
  const sortByHandicap = sortParam === "asc" || sortParam === "desc" ? sortParam : undefined;

  const players = await listAllPlayers(sortByHandicap);

  // Clicking "Handicap" cycles unsorted -> lowest (best) first -> highest
  // first -> unsorted, back to alphabetical by last name. Mirrors the
  // rounds feed's Score sort — same 3-state cycle, same URL-param
  // approach — but simpler here since there's no pagination or other
  // filter state on this page to preserve alongside it yet.
  const nextSort = sortByHandicap === undefined ? "asc" : sortByHandicap === "asc" ? "desc" : undefined;
  const handicapHeaderHref = nextSort ? `/players?sort=${nextSort}` : "/players";
  const handicapIndicator = sortByHandicap === "asc" ? " ▲" : sortByHandicap === "desc" ? " ▼" : "";

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <BrandEyebrow />
            <h1 className="font-display mt-1 text-3xl font-semibold">Members</h1>
          </div>
          {session.role === "admin" && (
            <Button asChild size="sm">
              <Link href="/players/new">Add player</Link>
            </Button>
          )}
        </div>

        <div className="mb-2 flex items-center justify-end px-1">
          <Link
            href={handicapHeaderHref}
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Handicap{handicapIndicator}
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {players.map((player, i) => (
            <div key={player.id}>
              {i > 0 && <div className="ledger-rule" />}
              <Link
                href={`/players/${player.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-secondary"
              >
                <span className="font-medium">
                  {player.first_name} {player.last_name}
                  {player.role === "admin" && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">admin</span>
                  )}
                </span>
                <span className="font-numeral text-sm text-muted-foreground">
                  {player.current_handicap}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
