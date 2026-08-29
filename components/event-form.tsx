"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/app/actions/auth";

export interface EventFormInitialData {
  name: string;
  courseId: string;
  eventDate: string;
  firstTeeTime: string;
  capacity: number;
  selfRegistrationEnabled: boolean;
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
