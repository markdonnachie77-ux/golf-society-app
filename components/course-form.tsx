"use client";

import * as React from "react";
import { HoleCountToggle } from "@/components/hole-count-toggle";
import { ParToggle } from "@/components/par-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validateHoleSet, buildDefaultHoles, type HoleRowInput } from "@/lib/course-validation";
import type { ActionResult } from "@/app/actions/auth";

export interface CourseFormInitialData {
  name: string;
  location: string;
  holeCount: 9 | 18;
  handicapCutPerPoint: number;
  handicapIncreasePerPoint: number;
  increaseThreshold: number;
  whiteCourseRating: number | null;
  whiteSlopeRating: number | null;
  yellowCourseRating: number | null;
  yellowSlopeRating: number | null;
  holes: HoleRowInput[];
}

interface CourseFormProps {
  initial?: CourseFormInitialData;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

export function CourseForm({ initial, onSubmit, submitLabel }: CourseFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [location, setLocation] = React.useState(initial?.location ?? "");
  const [holeCount, setHoleCount] = React.useState<9 | 18>(initial?.holeCount ?? 18);
  const [cutRate, setCutRate] = React.useState(String(initial?.handicapCutPerPoint ?? "0.2"));
  const [increaseRate, setIncreaseRate] = React.useState(
    String(initial?.handicapIncreasePerPoint ?? "0.1")
  );
  const [increaseThreshold, setIncreaseThreshold] = React.useState(
    String(initial?.increaseThreshold ?? "36")
  );
  const [whiteCourseRating, setWhiteCourseRating] = React.useState(
    initial?.whiteCourseRating != null ? String(initial.whiteCourseRating) : ""
  );
  const [whiteSlopeRating, setWhiteSlopeRating] = React.useState(
    initial?.whiteSlopeRating != null ? String(initial.whiteSlopeRating) : ""
  );
  const [yellowCourseRating, setYellowCourseRating] = React.useState(
    initial?.yellowCourseRating != null ? String(initial.yellowCourseRating) : ""
  );
  const [yellowSlopeRating, setYellowSlopeRating] = React.useState(
    initial?.yellowSlopeRating != null ? String(initial.yellowSlopeRating) : ""
  );
  const [holes, setHoles] = React.useState<HoleRowInput[]>(
    initial?.holes ?? buildDefaultHoles(18)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function handleHoleCountChange(next: 9 | 18) {
    setHoleCount(next);
    setHoles(buildDefaultHoles(next));
  }

  function updateHole(index: number, patch: Partial<HoleRowInput>) {
    setHoles((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  const holeErrors = React.useMemo(() => validateHoleSet(holes, holeCount), [holes, holeCount]);

  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  const frontNine = holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0);
  const backNine = holes.slice(9, 18).reduce((sum, h) => sum + h.par, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Course name is required.");
      return;
    }
    if (holeErrors.length > 0) {
      setError(holeErrors.join(" "));
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("location", location.trim());
    formData.set("holeCount", String(holeCount));
    formData.set("handicapCutPerPoint", cutRate);
    formData.set("handicapIncreasePerPoint", increaseRate);
    formData.set("increaseThreshold", increaseThreshold);
    formData.set("whiteCourseRating", whiteCourseRating);
    formData.set("whiteSlopeRating", whiteSlopeRating);
    formData.set("yellowCourseRating", yellowCourseRating);
    formData.set("yellowSlopeRating", yellowSlopeRating);
    formData.set("holesJson", JSON.stringify(holes));

    const result = await onSubmit(formData);
    if (result && !result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Course name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Hole count</Label>
        <div>
          <HoleCountToggle value={holeCount} onChange={handleHoleCountChange} disabled={pending} />
        </div>
        {initial && (
          <p className="text-xs text-muted-foreground">
            Changing hole count resets the grid below.
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cutRate">Handicap cut rate (per point over target)</Label>
          {/* type="text" + inputMode="decimal" instead of type="number" —
              see the comment on the playing handicap input in
              new-scorecard-form.tsx for why. */}
          <Input
            id="cutRate"
            type="text"
            inputMode="decimal"
            value={cutRate}
            onChange={(e) => setCutRate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="increaseRate">Handicap increase rate (per point under target)</Label>
          <Input
            id="increaseRate"
            type="text"
            inputMode="decimal"
            value={increaseRate}
            onChange={(e) => setIncreaseRate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Set to 0 for a buffered zone.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="increaseThreshold">
          Increase threshold (Stableford points, GATE not a cap)
        </Label>
        {/* Same text+inputMode=decimal pattern as cutRate/increaseRate
            above. A score must be BELOW this for the increase rate to
            apply at all — scores at or above it get no increase, not a
            smaller one. Defaults to 36 (today's standard target).
            Always entered/stored at the full-18-hole scale — scaled
            proportionally at calculation time for 9-hole rounds (see
            lib/golf-math.ts). Shown dynamically below when holeCount is
            9, since "36" on a 9-hole course's own settings page reads
            as confusing/wrong without it — the number typed here is
            never what actually gets compared against a 9-hole score. */}
        <Input
          id="increaseThreshold"
          type="text"
          inputMode="numeric"
          value={increaseThreshold}
          onChange={(e) => setIncreaseThreshold(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Standard is 36. Lowering this means a bad round (e.g. 30 points) may no longer
          increase a handicap at all — only scores below this threshold do, and only by the
          gap to the threshold itself, not to 36. Can be overridden per event.
          {holeCount === 9 && Number.isFinite(Number(increaseThreshold)) && (
            <>
              {" "}
              For this 9-hole course, that&apos;s an effective threshold of{" "}
              {Number(increaseThreshold) / 2}.
            </>
          )}
        </p>
      </div>

      <div>
        <Label>Course Rating &amp; Slope Rating (optional)</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          From the course&apos;s official rating card, per tee. First step toward competition
          handicap calculations — leave blank if not yet known.
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">White tees</p>
            <div className="space-y-1.5">
              <Label htmlFor="whiteCourseRating">Course Rating</Label>
              {/* type="text" + inputMode="decimal" — same pattern as
                  cutRate/increaseRate above. Course Rating is a decimal
                  (e.g. 71.2), unlike Slope Rating which is a whole
                  number. */}
              <Input
                id="whiteCourseRating"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 71.2"
                value={whiteCourseRating}
                onChange={(e) => setWhiteCourseRating(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whiteSlopeRating">Slope Rating</Label>
              <Input
                id="whiteSlopeRating"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 128"
                value={whiteSlopeRating}
                onChange={(e) => setWhiteSlopeRating(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">Yellow tees</p>
            <div className="space-y-1.5">
              <Label htmlFor="yellowCourseRating">Course Rating</Label>
              <Input
                id="yellowCourseRating"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 69.5"
                value={yellowCourseRating}
                onChange={(e) => setYellowCourseRating(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yellowSlopeRating">Slope Rating</Label>
              <Input
                id="yellowSlopeRating"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 122"
                value={yellowSlopeRating}
                onChange={(e) => setYellowSlopeRating(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={pending}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <Label>Hole details</Label>
          <span className="font-numeral text-sm text-muted-foreground">
            Par {parTotal}
            {holeCount === 18 && ` (front ${frontNine} / back ${backNine})`}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Hole</span>
            <span>Par</span>
            <span>Stroke idx</span>
            <span>White yds</span>
            <span>Yellow yds</span>
          </div>
          {holes.map((hole, index) => (
            <React.Fragment key={hole.holeNumber}>
              <div className="ledger-rule" />
              <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] items-center gap-2 px-4 py-2">
                <span className="font-numeral text-sm text-muted-foreground">
                  {hole.holeNumber}
                </span>
                <ParToggle
                  value={hole.par}
                  onChange={(par) => updateHole(index, { par })}
                  disabled={pending}
                />
                {/* type="text" + inputMode="numeric" + pattern instead
                    of type="number" — see the comment on the score
                    input in new-scorecard-form.tsx for why. Digit-only
                    filter replaces the min/max validation type="number"
                    gave for free. */}
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={hole.strokeIndex || ""}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                    updateHole(index, { strokeIndex: Number(digitsOnly) || 0 });
                  }}
                  className="font-numeral"
                  disabled={pending}
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={hole.whiteYards ?? ""}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                    updateHole(index, { whiteYards: digitsOnly ? Number(digitsOnly) : null });
                  }}
                  className="font-numeral"
                  disabled={pending}
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={hole.yellowYards ?? ""}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                    updateHole(index, { yellowYards: digitsOnly ? Number(digitsOnly) : null });
                  }}
                  className="font-numeral"
                  disabled={pending}
                />
              </div>
            </React.Fragment>
          ))}
        </div>

        {holeErrors.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-destructive">
            {holeErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={pending || holeErrors.length > 0 || !name.trim()}
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
