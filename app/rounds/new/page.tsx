import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { listCoursesForRound } from "@/app/actions/scorecards";
import { listAllPlayers } from "@/app/actions/players";
import { getAppSettings } from "@/app/actions/settings";
import { NewScorecardForm } from "@/components/new-scorecard-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function NewRoundPage() {
  const session = await requireSession();
  const supabase = createServiceClient();
  const isAdmin = session.role === "admin";

  const [courses, { data: player }, allPlayers, settings] = await Promise.all([
    listCoursesForRound(),
    supabase.from("players").select("current_handicap").eq("id", session.playerId).single(),
    // Only admins get the "log on behalf of" picker, so don't bother
    // fetching the whole player directory for everyone else.
    isAdmin ? listAllPlayers() : Promise.resolve([]),
    getAppSettings(),
  ]);

  // Defense in depth: the dashboard already hides the "Log a round" link
  // for non-admins when this setting is off, but that alone wouldn't stop
  // someone typing the URL directly. createScorecard enforces this too —
  // this is just what a blocked player sees instead of the form, not the
  // actual security boundary.
  const blocked = !isAdmin && !settings.playersCanLogOwnRounds;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Log a round</h1>
        </div>

        {blocked ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Round logging is currently restricted to admins — ask an admin to log this round
              for you.
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>
    </main>
  );
}
