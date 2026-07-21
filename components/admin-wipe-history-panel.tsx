"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { wipePlayerHistory } from "@/app/actions/players";

export function AdminWipeHistoryPanel({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleWipe() {
    setPending(true);
    setError(null);
    const result = await wipePlayerHistory(playerId);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }
    setPending(false);
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Wipe round history
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <p className="text-xs uppercase tracking-widest text-destructive">Wipe round history</p>
      <p className="mt-2 text-sm">
        This permanently deletes every round this player has submitted (any status) and their
        entire handicap change log. Their account stays active and their current handicap number
        is left as-is — adjust it separately afterward if needed. This can't be undone.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Button type="button" variant="destructive" onClick={handleWipe} disabled={pending}>
          {pending ? "Wiping…" : "Yes, wipe their history"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
