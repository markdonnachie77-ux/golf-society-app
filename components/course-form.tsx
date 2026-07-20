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
          <Input
            id="cutRate"
            type="number"
            step="0.01"
            min="0"
            value={cutRate}
            onChange={(e) => setCutRate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="increaseRate">Handicap increase rate (per point under target)</Label>
          <Input
            id="increaseRate"
            type="number"
            step="0.01"
            min="0"
            value={increaseRate}
            onChange={(e) => setIncreaseRate(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Set to 0 for a buffered zone.</p>
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
                <Input
                  type="number"
                  min={1}
                  max={holeCount}
                  value={hole.strokeIndex || ""}
                  onChange={(e) =>
                    updateHole(index, { strokeIndex: Number(e.target.value) || 0 })
                  }
                  className="font-numeral"
                  disabled={pending}
                />
                <Input
                  type="number"
                  min={1}
                  value={hole.whiteYards ?? ""}
                  onChange={(e) =>
                    updateHole(index, {
                      whiteYards: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="font-numeral"
                  disabled={pending}
                />
                <Input
                  type="number"
                  min={1}
                  value={hole.yellowYards ?? ""}
                  onChange={(e) =>
                    updateHole(index, {
                      yellowYards: e.target.value ? Number(e.target.value) : null,
                    })
                  }
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
