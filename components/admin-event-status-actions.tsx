"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishEvent, unpublishEvent, deleteEvent } from "@/app/actions/events";
import type { EventStatus } from "@/lib/database.types";

export function AdminEventStatusActions({ eventId, status }: { eventId: string; status: EventStatus }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  async function handlePublish() {
    setPending(true);
    setError(null);
    const result = await publishEvent(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not publish this event.");
      setPending(false);
      return;
    }
    // Same reasoning as EventRegistrationButton's fix — status flips to
    // "published" here, switching which of Publish/Revert-to-draft
    // renders below, but it's the same component instance carrying its
    // own pending state across that. Without this, "Revert to draft"
    // would render stuck on "Reverting…", disabled, immediately after a
    // successful publish that never touched unpublish at all.
    setPending(false);
    router.refresh();
  }

  async function handleUnpublish() {
    setPending(true);
    setError(null);
    const result = await unpublishEvent(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not revert this event to draft.");
      setPending(false);
      return;
    }
    // Mirrors handlePublish above.
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteEvent(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not delete this event.");
      setPending(false);
      setConfirmingDelete(false);
      return;
    }
    router.push("/events");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/events/${eventId}/edit`}>Edit</Link>
      </Button>

      {status === "draft" ? (
        <Button type="button" size="sm" onClick={handlePublish} disabled={pending}>
          {pending ? "Publishing…" : "Publish"}
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={handleUnpublish} disabled={pending}>
          {pending ? "Reverting…" : "Revert to draft"}
        </Button>
      )}

      {status === "draft" &&
        (confirmingDelete ? (
          <>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        ))}

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}
