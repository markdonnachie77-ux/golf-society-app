"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteRound } from "@/app/actions/scorecards";

export function AdminDeleteRoundPanel({
  scorecardId,
  status,
}: {
  scorecardId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteRound(scorecardId);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }
    router.push("/rounds");
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete round
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <p className="text-xs uppercase tracking-widest text-destructive">Delete round</p>
      <p className="mt-2 text-sm">
        {status === "approved"
          ? "This round was approved — deleting it will reverse the handicap change it applied. This can't be undone."
          : "This can't be undone."}
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
          {pending ? "Deleting…" : "Yes, delete this round"}
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
