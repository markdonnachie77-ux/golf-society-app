"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustPlayerHandicap } from "@/app/actions/players";

export function AdminHandicapPanel({
  playerId,
  currentHandicap,
}: {
  playerId: string;
  currentHandicap: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newHandicap, setNewHandicap] = React.useState(String(currentHandicap));
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const parsedValue = Number(newHandicap);
  const delta = Number.isNaN(parsedValue) ? null : Math.round((parsedValue - currentHandicap) * 10) / 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (Number.isNaN(parsedValue)) {
      setError("Enter a valid number.");
      return;
    }

    setPending(true);
    const result = await adjustPlayerHandicap(playerId, parsedValue, notes.trim());
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Adjust handicap
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-accent/40 bg-accent/5 p-5"
    >
      <p className="text-xs uppercase tracking-widest text-accent">Manual adjustment (admin)</p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="newHandicap">New handicap</Label>
          <Input
            id="newHandicap"
            type="number"
            step="0.1"
            value={newHandicap}
            onChange={(e) => setNewHandicap(e.target.value)}
            disabled={pending}
            className="font-numeral w-28"
          />
        </div>
        <p className="pb-2 font-numeral text-sm text-muted-foreground">
          {delta !== null && (delta > 0 ? "+" : "") + delta} from current {currentHandicap}
        </p>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="notes">Reason (optional, but shown in their handicap history)</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. correcting migration from old system"
          disabled={pending}
        />
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-3">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
            setNewHandicap(String(currentHandicap));
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
