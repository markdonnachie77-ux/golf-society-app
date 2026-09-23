"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TeeColorToggle } from "@/components/tee-color-toggle";
import type { ActionResult } from "@/app/actions/auth";

export interface EventFormInitialData {
  name: string;
  courseId: string;
  eventDate: string;
  firstTeeTime: string;
  capacity: number;
  selfRegistrationEnabled: boolean;
  format: "stroke_play" | "stableford";
  handicapCutForWinner: number;
  usesCompetitionHandicapIndex: boolean;
  teeColor: "white" | "yellow";
  depositGbp: number | null;
  remainingBalanceGbp: number | null;
  overrideHandicapRates: boolean;
  handicapCutPerPointOverride: number | null;
  handicapIncreasePerPointOverride: number | null;
  cutTargetOverride: number | null;
  increaseThresholdOverride: number | null;
}

interface EventFormProps {
  initial?: EventFormInitialData;
  courses: { id: string; name: string }[];
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

/**
 * Shared by the create and edit pages — same fields either way, the
 * only difference is which server action onSubmit calls and whether
 * initial pre-fills anything. Matches the same initial/onSubmit/
 * submitLabel pattern already used by CourseForm for the same reason.
 */
export function EventForm({ initial, courses, onSubmit, submitLabel }: EventFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [courseId, setCourseId] = React.useState(initial?.courseId ?? "");
  const [eventDate, setEventDate] = React.useState(initial?.eventDate ?? "");
  const [firstTeeTime, setFirstTeeTime] = React.useState(initial?.firstTeeTime ?? "");
  const [capacity, setCapacity] = React.useState(String(initial?.capacity ?? "20"));
  const [selfRegistrationEnabled, setSelfRegistrationEnabled] = React.useState(
    initial?.selfRegistrationEnabled ?? true
  );
  const [format, setFormat] = React.useState<"stroke_play" | "stableford">(
    initial?.format ?? "stableford"
  );
  const [handicapCutForWinner, setHandicapCutForWinner] = React.useState(
    String(initial?.handicapCutForWinner ?? "0")
  );
  const [usesCompetitionHandicapIndex, setUsesCompetitionHandicapIndex] = React.useState(
    initial?.usesCompetitionHandicapIndex ?? false
  );
  const [teeColor, setTeeColor] = React.useState<"white" | "yellow">(initial?.teeColor ?? "white");
  const [depositGbp, setDepositGbp] = React.useState(
    initial?.depositGbp != null ? String(initial.depositGbp) : ""
  );
  const [remainingBalanceGbp, setRemainingBalanceGbp] = React.useState(
    initial?.remainingBalanceGbp != null ? String(initial.remainingBalanceGbp) : ""
  );
  const [overrideHandicapRates, setOverrideHandicapRates] = React.useState(
    initial?.overrideHandicapRates ?? false
  );
  const [handicapCutPerPointOverride, setHandicapCutPerPointOverride] = React.useState(
    initial?.handicapCutPerPointOverride != null ? String(initial.handicapCutPerPointOverride) : ""
  );
  const [handicapIncreasePerPointOverride, setHandicapIncreasePerPointOverride] = React.useState(
    initial?.handicapIncreasePerPointOverride != null
      ? String(initial.handicapIncreasePerPointOverride)
      : ""
  );
  const [cutTargetOverride, setCutTargetOverride] = React.useState(
    initial?.cutTargetOverride != null ? String(initial.cutTargetOverride) : ""
  );
  const [increaseThresholdOverride, setIncreaseThresholdOverride] = React.useState(
    initial?.increaseThresholdOverride != null ? String(initial.increaseThresholdOverride) : ""
  );
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("courseId", courseId);
    formData.set("eventDate", eventDate);
    formData.set("firstTeeTime", firstTeeTime);
    formData.set("capacity", capacity);
    formData.set("selfRegistrationEnabled", String(selfRegistrationEnabled));
    formData.set("format", format);
    formData.set("handicapCutForWinner", handicapCutForWinner);
    formData.set("usesCompetitionHandicapIndex", String(usesCompetitionHandicapIndex));
    formData.set("teeColor", teeColor);
    formData.set("depositGbp", depositGbp);
    formData.set("remainingBalanceGbp", remainingBalanceGbp);
    formData.set("overrideHandicapRates", String(overrideHandicapRates));
    formData.set("handicapCutPerPointOverride", handicapCutPerPointOverride);
    formData.set("handicapIncreasePerPointOverride", handicapIncreasePerPointOverride);
    formData.set("cutTargetOverride", cutTargetOverride);
    formData.set("increaseThresholdOverride", increaseThresholdOverride);

    const result = await onSubmit(formData);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setFieldErrors(result.fieldErrors ?? {});
      setPending(false);
    }
    // On success, onSubmit (createEvent/updateEvent) redirects
    // server-side via next/navigation's redirect() — same pattern as
    // registerPlayer/createCourse — which throws rather than returning,
    // so there's no success state to render here, and pending
    // intentionally stays true until that navigation actually happens.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          placeholder="e.g. Summer Cup"
          required
        />
        {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="courseId">Course</Label>
        <select
          id="courseId"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={pending}
          required
          className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        >
          <option value="" disabled>
            Select a course
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldErrors.courseId && <p className="text-sm text-destructive">{fieldErrors.courseId}</p>}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="eventDate">Date</Label>
          <Input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            disabled={pending}
            required
          />
          {fieldErrors.eventDate && <p className="text-sm text-destructive">{fieldErrors.eventDate}</p>}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="firstTeeTime">First tee time</Label>
          <Input
            id="firstTeeTime"
            type="time"
            value={firstTeeTime}
            onChange={(e) => setFirstTeeTime(e.target.value)}
            disabled={pending}
            required
          />
          {fieldErrors.firstTeeTime && (
            <p className="text-sm text-destructive">{fieldErrors.firstTeeTime}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capacity">Available spaces</Label>
        {/* type="text" + inputMode="numeric" instead of type="number" —
            see the comment on the score input in new-scorecard-form.tsx
            for why. Digit-only filter replaces the min/max validation
            type="number" gave for free. */}
        <Input
          id="capacity"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
          disabled={pending}
          required
        />
        {fieldErrors.capacity && <p className="text-sm text-destructive">{fieldErrors.capacity}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="format">Scoring format</Label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value as "stroke_play" | "stableford")}
          disabled={pending}
          className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        >
          <option value="stableford">Stableford (highest points wins)</option>
          <option value="stroke_play">Stroke play (lowest net score wins)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Only governs how this event's leaderboard is ranked — handicap adjustments always use
          Stableford points regardless of this setting.
        </p>
        {fieldErrors.format && <p className="text-sm text-destructive">{fieldErrors.format}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="handicapCutForWinner">Handicap cut for winner</Label>
        {/* Same text+inputMode=numeric pattern as capacity above — this
            one can legitimately be 0 (no cut), so no min-1 assumption
            here the way capacity has. */}
        <Input
          id="handicapCutForWinner"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={handicapCutForWinner}
          onChange={(e) => setHandicapCutForWinner(e.target.value.replace(/[^0-9]/g, ""))}
          disabled={pending}
          required
        />
        <p className="text-xs text-muted-foreground">
          Taken off the winner's handicap once an admin confirms the leaderboard after the
          event. Use 0 for no cut.
        </p>
        {fieldErrors.handicapCutForWinner && (
          <p className="text-sm text-destructive">{fieldErrors.handicapCutForWinner}</p>
        )}
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={usesCompetitionHandicapIndex}
          onChange={(e) => setUsesCompetitionHandicapIndex(e.target.checked)}
          disabled={pending}
          className="mt-1 h-4 w-4 shrink-0 rounded border-input"
        />
        <span className="text-sm">
          <span className="font-medium">Use Competition Handicap Index</span>
          <br />
          <span className="text-muted-foreground">
            Based on Course Rating and Slope Rating rather than normal handicaps. Leave off to
            use each player's normal handicap for this event instead.
          </span>
        </span>
      </label>

      {usesCompetitionHandicapIndex && (
        <div className="space-y-1.5">
          <Label>Tee (for the Competition Handicap calculation)</Label>
          <div>
            <TeeColorToggle value={teeColor} onChange={setTeeColor} disabled={pending} />
          </div>
          <p className="text-xs text-muted-foreground">
            Uses that tee&apos;s Course Rating and Slope Rating for everyone registered.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selfRegistrationEnabled}
          onChange={(e) => setSelfRegistrationEnabled(e.target.checked)}
          disabled={pending}
          className="mt-1 h-4 w-4 shrink-0 rounded border-input"
        />
        <span className="text-sm">
          <span className="font-medium">Players can register themselves</span>
          <br />
          <span className="text-muted-foreground">
            Turn off to require every registration to go through an admin instead.
          </span>
        </span>
      </label>

      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="depositGbp">Deposit (£)</Label>
          {/* Optional — same text+inputMode=decimal pattern as Course
              Rating, no digit-only filter since pence need a decimal
              point. Empty means not set, not £0. */}
          <Input
            id="depositGbp"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 10.00"
            value={depositGbp}
            onChange={(e) => setDepositGbp(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="remainingBalanceGbp">Remaining balance (£)</Label>
          <Input
            id="remainingBalanceGbp"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 25.00"
            value={remainingBalanceGbp}
            onChange={(e) => setRemainingBalanceGbp(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Informational only — shown on the event page and sign-up sheet, not tied to
        registration or payment tracking.
      </p>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={overrideHandicapRates}
          onChange={(e) => setOverrideHandicapRates(e.target.checked)}
          disabled={pending}
          className="mt-1 h-4 w-4 shrink-0 rounded border-input"
        />
        <span className="text-sm">
          <span className="font-medium">Override handicap cut/increase rates for this event</span>
          <br />
          <span className="text-muted-foreground">
            Leave off to always use the course&apos;s own rates. Turn on for something like a fun
            day where no handicap adjustment — or a different rate entirely — should apply.
          </span>
        </span>
      </label>

      {overrideHandicapRates && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="handicapCutPerPointOverride">
              Handicap cut rate (per point over target)
            </Label>
            {/* Same text+inputMode=decimal pattern as the course-level
                cutRate field in CourseForm — but unlike that field,
                these only exist at all once the checkbox above is
                checked, so there's no "0 means something different
                than it looks like" ambiguity: a genuine 0 here means
                no cut at all for this event, exactly as typed. Both
                fields are mandatory the moment the checkbox is
                checked (required below, plus server-side validation
                in eventDetailsSchema's superRefine) — an admin
                turning the override on has to make a deliberate
                choice for both rates, not leave one at a stale or
                default value. */}
            <Input
              id="handicapCutPerPointOverride"
              type="text"
              inputMode="decimal"
              value={handicapCutPerPointOverride}
              onChange={(e) => setHandicapCutPerPointOverride(e.target.value)}
              disabled={pending}
              required
            />
            {fieldErrors.handicapCutPerPointOverride && (
              <p className="text-sm text-destructive">{fieldErrors.handicapCutPerPointOverride}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handicapIncreasePerPointOverride">
              Handicap increase rate (per point under target)
            </Label>
            <Input
              id="handicapIncreasePerPointOverride"
              type="text"
              inputMode="decimal"
              value={handicapIncreasePerPointOverride}
              onChange={(e) => setHandicapIncreasePerPointOverride(e.target.value)}
              disabled={pending}
              required
            />
            {fieldErrors.handicapIncreasePerPointOverride && (
              <p className="text-sm text-destructive">
                {fieldErrors.handicapIncreasePerPointOverride}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cutTargetOverride">Cut target override (Stableford points)</Label>
        {/* Independent of the checkbox above — this can be set whether
            or not the rate override is on, since it changes WHEN a cut
            applies, not the rate used once it does. Empty means "use
            the standard 36 (18 for a 9-hole round)". */}
        <Input
          id="cutTargetOverride"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 33 — leave blank for the standard 36"
          value={cutTargetOverride}
          onChange={(e) => setCutTargetOverride(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Cutting only — doesn&apos;t affect increasing (see the separate increase threshold
          below for that). If you lower this below 36, any score above it is cut instead of
          increased — for example, with 33 set, a score of 34 is cut, not increased, even
          though 34 is below 36.
        </p>
        {fieldErrors.cutTargetOverride && (
          <p className="text-sm text-destructive">{fieldErrors.cutTargetOverride}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="increaseThresholdOverride">Increase threshold override (Stableford points)</Label>
        {/* Same shape as cutTargetOverride above, entirely independent
            of it — GATE, not a cap. A score must be below this for the
            increase rate to apply at all. Empty means "use the
            course's own increase_threshold value". */}
        <Input
          id="increaseThresholdOverride"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 20 — leave blank to use the course's own setting"
          value={increaseThresholdOverride}
          onChange={(e) => setIncreaseThresholdOverride(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Increasing only — doesn&apos;t affect cutting. A score must be below this for a
          handicap to increase at all — scores at or above it get NO increase, not a smaller
          one. For example, with 20 set, a score of 30 gets no increase at all, even though
          it&apos;s well below the standard 36.
        </p>
        {fieldErrors.increaseThresholdOverride && (
          <p className="text-sm text-destructive">{fieldErrors.increaseThresholdOverride}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
