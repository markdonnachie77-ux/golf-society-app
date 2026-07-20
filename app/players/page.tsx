import Link from "next/link";
import { listAllPlayers } from "@/app/actions/players";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function PlayersPage() {
  const players = await listAllPlayers();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Members</h1>
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
