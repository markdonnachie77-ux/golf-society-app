"use client";

import { EventForm } from "@/components/event-form";
import { createEvent } from "@/app/actions/events";

export function NewEventForm({ courses }: { courses: { id: string; name: string }[] }) {
  return <EventForm courses={courses} onSubmit={createEvent} submitLabel="Create draft" />;
}
