"use client";

import { EventForm, type EventFormInitialData } from "@/components/event-form";
import { updateEvent } from "@/app/actions/events";

export function EditEventForm({
  eventId,
  initial,
  courses,
}: {
  eventId: string;
  initial: EventFormInitialData;
  courses: { id: string; name: string }[];
}) {
  return (
    <EventForm
      initial={initial}
      courses={courses}
      submitLabel="Save changes"
      onSubmit={(formData) => updateEvent(eventId, formData)}
    />
  );
}
