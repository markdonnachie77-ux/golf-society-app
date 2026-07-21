"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TeeColorToggle } from "@/components/tee-color-toggle";
import { RoundTypeToggle } from "@/components/round-type-toggle";
import { PlayerSelect } from "@/components/player-select";
import { computeRound, proposedHandicapChange, type RoundType } from "@/lib/golf-math";
import { allowedRoundTypes } from "@/lib/round-setup";
import { getHolesForRound, createScorecard } from "@/app/actions/scorecards";
import type { ActionResult } from "@/app/actions/auth";

interface Course {
  id: string;
  name: string;
  location: string | null;
  hole_count: 9 | 18;
  handicap_cut_per_point: number;
  handicap_increase_per_point: number;
}

interface PlayerOption {
  id: string;
  first_name: string;
  last_name: string;
  current_handicap: number;
}

interface HoleRow {
  id: string;
  hole_number: number;
  par: number;
  stroke_index: number;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewScorecardForm({
  courses,
  defaultHandicap,
  viewerPlayerId,
  isAdmin = false,
  allPlayers = [],
}: {
  courses: Course[];
  defaultHandicap: number;
  viewerPlayerId: string;
  isAdmin?: boolean;
  allPlayers?: PlayerOption[];
}) {
  const [courseId, setCourseId] = React.useState<string | null>(
    courses.length === 1 ? courses[0].id : null
  );
  const [onBehalfOfPlayerId, setOnBehalfOfPlayerId] = React.useState<string>(viewerPlayerId);
  const [teeColor, setTeeColor] = React.useState<"white" | "yellow">("white");
  const [roundType, setRoundType] = React.useState<RoundType | null>(null);
  const [playedAt, setPlayedAt] = React.useState(todayIsoDate());
  const [playingHandicap, setPlayingHandicap] = React.useState(String(defaultHandicap));
  const [holes, setHoles] = React.useState<HoleRow[]>([]);
  const [loadingHoles, setLoadingHoles] = React.useState(false);
  const [grossByHole, setGrossByHole] = React.useState<Record<string, string>>({});
  const [pickedUpByHole, setPickedUpByHole] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  /** When an admin switches who they're logging for, default the playing
   * handicap to THAT player's current handicap rather than leaving
   * whatever was there before (still editable either way). */
  function handleOnBehalfOfChange(playerId: string) {
    setOnBehalfOfPlayerId(playerId);
    const target = allPlayers.find((p) => p.id === playerId);
    if (target) {
      setPlayingHandicap(String(target.current_handicap));
    }
  }

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;
  const roundTypeOptions = selectedCourse ? allowedRoundTypes(selectedCourse.hole_count) : [];

  function handleCourseChange(id: string) {
    setCourseId(id);
    setRoundType(null);
    setHoles([]);
    setGrossByHole({});
    setPickedUpByHole({});
  }

  // A 9-hole course has exactly one valid round type — pick it automatically
  // rather than making the admin click a single-option toggle.
  React.useEffect(() => {
    if (selectedCourse && roundTypeOptions.length === 1 && roundType === null) {
      setRoundType(roundTypeOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id]);

  React.useEffect(() => {
    if (!courseId || !roundType) return;
    let cancelled = false;
    setLoadingHoles(true);
    getHolesForRound(courseId, roundType).then((result) => {
      if (cancelled) return;
      setHoles(result);
      setGrossByHole(Object.fromEntries(result.map((h) => [h.id, ""])));
      setPickedUpByHole(Object.fromEntries(result.map((h) => [h.id, false])));
      setLoadingHoles(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, roundType]);

  /** Toggling "picked up" on clears any entered gross score for that hole
   * — they're mutually exclusive, so leaving a stale number behind would
   * be misleading if the toggle were flipped back off later. */
  function togglePickedUp(holeId: string) {
    setPickedUpByHole((prev) => ({ ...prev, [holeId]: !prev[holeId] }));
    setGrossByHole((prev) => ({ ...prev, [holeId]: "" }));
  }

  const allScoresEntered =
    holes.length > 0 &&
    holes.every((h) => {
      if (pickedUpByHole[h.id]) return true;
      const v = Number(grossByHole[h.id]);
      return Number.isInteger(v) && v >= 1;
    });

  const preview = React.useMemo(() => {
    if (!allScoresEntered || !roundType || !selectedCourse) return null;
    const H = Number(playingHandicap);
    if (Number.isNaN(H)) return null;

    const holeInputs = holes.map((h) => ({
      holeId: h.id,
      par: h.par,
      strokeIndex: h.stroke_index,
      grossStrokes: pickedUpByHole[h.id] ? null : Number(grossByHole[h.id]),
      pickedUp: !!pickedUpByHole[h.id],
    }));

    const { summary } = computeRound(holeInputs, H, roundType);
    const change = proposedHandicapChange(summary.totalStablefordPoints, roundType, {
      handicapCutPerPoint: selectedCourse.handicap_cut_per_point,
      handicapIncreasePerPoint: selectedCourse.handicap_increase_per_point,
    });

    return { summary, change };
  }, [allScoresEntered, holes, grossByHole, pickedUpByHole, playingHandicap, roundType, selectedCourse]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!courseId || !roundType || !allScoresEntered) {
      setError("Fill in every hole's score before submitting.");
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("onBehalfOfPlayerId", onBehalfOfPlayerId);
    formData.set("teeColor", teeColor);
    formData.set("roundType", roundType);
    formData.set("playedAt", playedAt);
    formData.set("playingHandicap", playingHandicap);
    formData.set(
      "scoresJson",
      JSON.stringify(
        holes.map((h) => ({
          holeId: h.id,
          grossStrokes: pickedUpByHole[h.id] ? null : Number(grossByHole[h.id]),
          pickedUp: !!pickedUpByHole[h.id],
        }))
      )
    );

    const result: ActionResult | undefined = await createScorecard(formData);
    if (result && !result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
    }
  }

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses have been set up yet — ask an admin to add your society's course before
        logging a round.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {isAdmin && (
        <div className="space-y-1.5">
          <Label>Log this round for</Label>
          <PlayerSelect
            players={allPlayers}
            value={onBehalfOfPlayerId}
            onChange={handleOnBehalfOfChange}
            placeholder="Find a player…"
          />
          {onBehalfOfPlayerId !== viewerPlayerId && (
            <p className="text-xs text-muted-foreground">
              Logging on behalf of another member — playing handicap defaulted to their current
              handicap, still editable below.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Course</Label>
        <div className="flex flex-col gap-2">
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => handleCourseChange(course.id)}
              className={cn(
                "flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors",
                courseId === course.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary"
              )}
            >
              <span>
                <span className="font-medium">{course.name}</span>
                {course.location && (
                  <span className="ml-2 text-sm text-muted-foreground">{course.location}</span>
                )}
              </span>
              <span className="font-numeral text-sm text-muted-foreground">
                {course.hole_count} holes
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Round type</Label>
              <RoundTypeToggle
                options={roundTypeOptions}
                holeCount={selectedCourse.hole_count}
                value={roundType}
                onChange={setRoundType}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tees played</Label>
              <TeeColorToggle value={teeColor} onChange={setTeeColor} disabled={pending} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="playedAt">Date played</Label>
              <Input
                id="playedAt"
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                max={todayIsoDate()}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="playingHandicap">Playing handicap</Label>
              <Input
                id="playingHandicap"
                type="number"
                step="0.1"
                value={playingHandicap}
                onChange={(e) => setPlayingHandicap(e.target.value)}
                required
              />
            </div>
          </div>
        </>
      )}

      {roundType && loadingHoles && (
        <p className="text-sm text-muted-foreground">Loading holes…</p>
      )}

      {roundType && !loadingHoles && holes.length > 0 && (
        <div>
          <Label>Scores</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Can't score at least 1 point on a hole? Pick up rather than holing out.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[3rem_3rem_4rem_1fr] gap-2 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Hole</span>
              <span>Par</span>
              <span>SI</span>
              <span>Your score</span>
            </div>
            {holes.map((hole, i) => (
              <React.Fragment key={hole.id}>
                {i > 0 && <div className="ledger-rule" />}
                <div className="grid grid-cols-[3rem_3rem_4rem_1fr] items-center gap-2 px-4 py-2">
                  <span className="font-numeral text-sm text-muted-foreground">
                    {hole.hole_number}
                  </span>
                  <span className="font-numeral text-sm text-muted-foreground">{hole.par}</span>
                  <span className="font-numeral text-sm text-muted-foreground">
                    {hole.stroke_index}
                  </span>
                  <div className="flex items-center gap-2">
                    {pickedUpByHole[hole.id] ? (
                      <button
                        type="button"
                        onClick={() => togglePickedUp(hole.id)}
                        disabled={pending}
                        className="flex h-11 flex-1 items-center justify-center rounded-md border border-accent bg-accent/10 font-numeral text-sm text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                      >
                        Picked up — tap to undo
                      </button>
                    ) : (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          inputMode="numeric"
                          value={grossByHole[hole.id] ?? ""}
                          onChange={(e) =>
                            setGrossByHole((prev) => ({ ...prev, [hole.id]: e.target.value }))
                          }
                          disabled={pending}
                          className="font-numeral w-full min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => togglePickedUp(hole.id)}
                          disabled={pending}
                          className="shrink-0 whitespace-nowrap text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                        >
                          Pick up
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
          <p className="text-xs uppercase tracking-widest text-accent">Estimated result</p>
          <div className="mt-3 grid grid-cols-3 gap-4 font-numeral">
            <div>
              <p className="text-2xl font-semibold">{preview.summary.totalGrossStrokePlay}</p>
              <p className="text-xs text-muted-foreground">Gross</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{preview.summary.totalNetStrokePlay}</p>
              <p className="text-xs text-muted-foreground">Net</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{preview.summary.totalStablefordPoints}</p>
              <p className="text-xs text-muted-foreground">Stableford pts</p>
            </div>
          </div>
          <p className="mt-4 text-sm">
            If approved, your handicap will change by{" "}
            <span className="font-numeral font-semibold">
              {preview.change > 0 ? "+" : ""}
              {preview.change}
            </span>
            .
          </p>
          {preview.summary.holesPickedUp > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Gross/Net totals exclude {preview.summary.holesPickedUp} picked-up hole
              {preview.summary.holesPickedUp === 1 ? "" : "s"} — Stableford points still count
              them as 0.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {holes.length > 0 && (
        <div className="flex justify-end">
          <Button type="submit" variant="accent" size="lg" disabled={pending || !allScoresEntered}>
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      )}
    </form>
  );
}
