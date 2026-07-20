import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = createServiceClient();

  const { data: player } = await supabase
    .from("players")
    .select("first_name, last_name, current_handicap, role")
    .eq("id", session.playerId)
    .single();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-numeral text-xs uppercase tracking-widest text-accent">
              Society Handicap Register
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold">
              {player ? `${player.first_name} ${player.last_name}` : "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="accent" size="sm">
              <Link href="/rounds/new">Log a round</Link>
            </Button>
            {player?.role === "admin" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/courses">Courses</Link>
              </Button>
            )}
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current handicap</CardTitle>
            <CardDescription>Updated only via admin-approved scorecards.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="font-numeral text-5xl font-semibold text-primary">
              {player?.current_handicap ?? "—"}
            </span>
          </CardContent>
        </Card>

        <p className="mt-6 text-sm text-muted-foreground">
          Scorecard entry, the handicap timeline, and (for admins) the approval queue
          land in later phases of this build.
        </p>
      </div>
    </main>
  );
}
