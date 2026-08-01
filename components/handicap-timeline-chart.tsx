"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { HandicapHistoryPoint } from "@/app/actions/players";

// Matches the CSS custom properties in app/globals.css (--primary / --accent)
// as concrete hex values — recharts' SVG props don't resolve hsl(var(...)).
const FAIRWAY_GREEN = "#2c5f47";
const BRASS = "#b8874a";

interface ChartPoint {
  date: string;
  handicap: number;
  notes?: string | null;
}

export function HandicapTimelineChart({
  history,
  registeredAt,
  currentHandicap,
}: {
  history: HandicapHistoryPoint[];
  registeredAt: string;
  currentHandicap: number;
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No approved rounds yet — the timeline starts once a round is approved.
      </p>
    );
  }

  // Back-calculate the handicap before the first approved round, so the
  // chart has a sensible starting point rather than opening on a single dot.
  const first = history[0];
  const startingHandicap = first.handicapValue - first.adjustmentAmount;

  const points: ChartPoint[] = [
    { date: registeredAt, handicap: startingHandicap, notes: "Registered" },
    ...history.map((h) => ({
      date: h.effectiveDate,
      handicap: h.handicapValue,
      notes: h.notes,
    })),
  ];

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 22% 82%)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
            stroke="hsl(158 15% 38%)"
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
            stroke="hsl(158 15% 38%)"
          />
          <Tooltip
            formatter={(value: number) => [value, "Handicap"]}
            labelFormatter={(label: string) => formatDate(label)}
            contentStyle={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8rem",
              borderRadius: "0.4rem",
              border: "1px solid hsl(40 22% 82%)",
            }}
          />
          <Line
            type="monotone"
            dataKey="handicap"
            stroke={FAIRWAY_GREEN}
            strokeWidth={2}
            dot={{ r: 3, fill: BRASS, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right font-numeral text-xs text-muted-foreground">
        Current: {currentHandicap}
      </p>
    </div>
  );
}
