"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminResetPlayerPin } from "@/app/actions/auth";

export function AdminResetPinPanel({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newPin, setNewPin] = React.useState<string | null>(null);

  async function handleReset() {
    setPending(true);
    setError(null);
    const result = await adminResetPlayerPin(playerId);
    if (!result.ok || !result.player) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }
    setNewPin(result.player.pin);
    setPending(false);
  }

  if (newPin) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
        <p className="text-xs uppercase tracking-widest text-accent">PIN reset</p>
        <p className="mt-2 text-sm">
          Their old PIN no longer works. Share this new one with them — it won&apos;t be shown
          again.
        </p>
        <p className="font-numeral mt-3 text-4xl font-semibold tracking-widest text-primary">
          {newPin}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setNewPin(null);
            setConfirming(false);
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Reset PIN
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Reset PIN</p>
      <p className="mt-2 text-sm">
        Generates a new PIN and immediately invalidates their current one — they won't be able to
        log in with their old PIN once this is confirmed.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Button type="button" onClick={handleReset} disabled={pending}>
          {pending ? "Resetting…" : "Yes, reset their PIN"}
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
