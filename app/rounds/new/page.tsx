import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { listCoursesForRound } from "@/app/actions/scorecards";
import { NewScorecardForm } from "@/components/new-scorecard-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function NewRoundPage() {
  const session = await requireSession();
  const supabase = createServiceClient();

  const [courses, { data: player }] = await Promise.all([
    listCoursesForRound(),
    supabase.from("players").select("current_handicap").eq("id", session.playerId).single(),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="font-numeral text-xs uppercase tracking-widest text-accent">
            Society Handicap Register
          </p>
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
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
