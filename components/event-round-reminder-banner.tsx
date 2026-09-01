"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PendingEventReminder } from "@/app/actions/events";

const DISMISS_KEY_PREFIX = "dismissed-event-reminder-";

/**
 * Dismissal is stored in localStorage, per event id — a lightweight,
 * per-device UI preference, not something that needs database backing.
 * It's also naturally superseded the moment a round actually gets
 * logged for that event: listPendingEventRoundReminders stops returning
 * it at all once a scorecard exists, regardless of dismissal state, so
 * "dismissed" only ever means "not right now," never "never remind me
 * about this again even after I still haven't logged it."
 */
export function EventRoundReminderBanner({ reminders }: { reminders: PendingEventReminder[] }) {
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // Reading localStorage has to wait until after mount — it doesn't
    // exist during server rendering, so reading it any earlier would
    // mismatch between the server-rendered and client-rendered output
    // and trigger a hydration warning. Rendering nothing until this
    // runs means the banner briefly doesn't show on first paint rather
    // than flashing and then disappearing, which is the safer of the
    // two directions to get this wrong in.
    const dismissed = new Set<string>();
    for (const r of reminders) {
      if (localStorage.getItem(DISMISS_KEY_PREFIX + r.id) === "true") {
        dismissed.add(r.id);
      }
    }
    setDismissedIds(dismissed);
    setHydrated(true);
  }, [reminders]);

  function handleDismiss(eventId: string) {
    localStorage.setItem(DISMISS_KEY_PREFIX + eventId, "true");
    setDismissedIds((prev) => new Set(prev).add(eventId));
  }

  if (!hydrated) return null;

  const visible = reminders.filter((r) => !dismissedIds.has(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-2">
      {visible.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3"
        >
          <p className="text-sm">
            Played <span className="font-medium">{r.name}</span>? Log your round to have it count
            toward the leaderboard.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Button asChild size="sm">
              <Link href="/rounds/new">Log round</Link>
            </Button>
            <button
              type="button"
              onClick={() => handleDismiss(r.id)}
              aria-label={`Dismiss reminder for ${r.name}`}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
