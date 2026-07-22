import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { getPlayerGrossScoreStats } from "@/app/actions/players";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";
import { LogoutButton } from "@/components/logout-button";
import { GrossScoreStatsCard } from "@/components/gross-score-stats-card";

export default async function DashboardPage() {
  const session = await requireSession();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const [{ data: player }, settings, grossScoreStats] = await Promise.all([
    supabase
      .from("players")
      .select("first_name, last_name, current_handicap, role")
      .eq("id", session.playerId)
      .eq("society_id", societyId)
      .single(),
    getAppSettings(),
    getPlayerGrossScoreStats(session.playerId),
  ]);

  const isAdmin = player?.role === "admin";
  const canLogRounds = isAdmin || settings.playersCanLogOwnRounds;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <BrandEyebrow />
            <h1 className="font-display mt-1 text-3xl font-semibold">
              {player ? `${player.first_name} ${player.last_name}` : "Dashboard"}
            </h1>
          </div>
          <LogoutButton />
        </div>

        <nav className="mb-8 flex flex-wrap gap-2">
          {canLogRounds && (
            <Button asChild variant="accent" size="sm">
              <Link href="/rounds/new">Log a round</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/players/${session.playerId}`}>My profile</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/rounds">Rounds</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/players">Members</Link>
          </Button>
          {isAdmin && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/approvals">Approvals</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/courses">Courses</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/settings">Settings</Link>
              </Button>
            </>
          )}
        </nav>

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

        <GrossScoreStatsCard stats={grossScoreStats} />
      </div>
    </main>
  );
}
