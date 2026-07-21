import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { listCoursesForRound } from "@/app/actions/scorecards";
import { listAllPlayers } from "@/app/actions/players";
import { NewScorecardForm } from "@/components/new-scorecard-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function NewRoundPage() {
  const session = await requireSession();
  const supabase = createServiceClient();
  const isAdmin = session.role === "admin";

  const [courses, { data: player }, allPlayers] = await Promise.all([
    listCoursesForRound(),
    supabase.from("players").select("current_handicap").eq("id", session.playerId).single(),
    // Only admins get the "log on behalf of" picker, so don't bother
    // fetching the whole player directory for everyone else.
    isAdmin ? listAllPlayers() : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Log a round</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scorecard</CardTitle>
            <CardDescription>
              Enter your gross score for each hole — your estimated result updates as you go.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewScorecardForm
              courses={courses}
              defaultHandicap={player?.current_handicap ?? 0}
              viewerPlayerId={session.playerId}
              isAdmin={isAdmin}
              allPlayers={allPlayers}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
