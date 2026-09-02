"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmEventLeaderboard } from "@/app/actions/events";

export function ConfirmLeaderboardButton({
  eventId,
  handicapCutForWinner,
}: {
  eventId: string;
  handicapCutForWinner: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await confirmEventLeaderboard(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not confirm this leaderboard.");
      setPending(false);
      setConfirming(false);
      return;
    }
    // Same reasoning as EventRegistrationButton's fix — router.refresh()
    // isn't awaitable, so pending stays true until the confirmed state
    // (leaderboardConfirmedAt) actually arrives via new props. This
    // component gets replaced entirely once that happens (see the
    // parent page), so there's no stale-state branch to worry about
    // resetting here the way the earlier bug required.
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium">Confirm the leaderboard?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is permanent and can&apos;t be undone. If there&apos;s a clear winner
          {handicapCutForWinner > 0 ? (
            <> and this is nonzero, their handicap will be cut by {handicapCutForWinner} immediately.</>
          ) : (
            <>, no handicap change applies since the cut is set to 0.</>
          )}{" "}
          A tie for first gets no automatic cut either way.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" variant="destructive" size="sm" onClick={handleConfirm} disabled={pending}>
            {pending ? "Confirming…" : "Yes, confirm permanently"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Confirm leaderboard
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
