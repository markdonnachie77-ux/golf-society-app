import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { GrossScoreStats, GrossScoreCategory } from "@/app/actions/players";

function CategoryBlock({ label, stats }: { label: string; stats: GrossScoreCategory }) {
  if (stats.roundCount === 0) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">No approved rounds yet</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-numeral text-3xl font-semibold text-primary">{stats.average}</p>
      <p className="text-xs text-muted-foreground">
        average over {stats.roundCount} round{stats.roundCount === 1 ? "" : "s"}
      </p>
      {stats.best && (
        <Link
          href={`/rounds/${stats.best.scorecardId}`}
          className="mt-3 block text-sm hover:underline"
        >
          Best:{" "}
          <span className="font-numeral font-semibold text-accent">{stats.best.grossScore}</span>{" "}
          at {stats.best.courseName}
          <span className="text-muted-foreground">
            {" "}
            ({new Date(stats.best.playedAt).toLocaleDateString()})
          </span>
        </Link>
      )}
    </div>
  );
}

export function GrossScoreStatsCard({ stats }: { stats: GrossScoreStats }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Your scoring</CardTitle>
        <CardDescription>
          Gross score from approved rounds only — rounds with any picked-up hole aren't counted,
          since their total isn't a complete score.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CategoryBlock label="9 holes" stats={stats.nineHole} />
        <CategoryBlock label="18 holes" stats={stats.eighteenHole} />
      </CardContent>
    </Card>
  );
}
