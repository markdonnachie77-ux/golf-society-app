"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveScorecard, rejectScorecard } from "@/app/actions/approvals";

export function AdminApprovalPanel({
  scorecardId,
  proposedChange,
}: {
  scorecardId: string;
  proposedChange: number;
}) {
  const router = useRouter();
  const [appliedChange, setAppliedChange] = React.useState(String(proposedChange));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"approve" | "reject" | null>(null);

  const isOverride = Number(appliedChange) !== proposedChange;

  async function handleApprove() {
    setError(null);
    const value = Number(appliedChange);
    if (Number.isNaN(value)) {
      setError("Enter a valid number for the handicap change.");
      return;
    }
    setPending("approve");
    const result = await approveScorecard(scorecardId, value);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(null);
      return;
    }
    router.push("/admin/approvals");
  }

  async function handleReject() {
    setError(null);
    setPending("reject");
    const result = await rejectScorecard(scorecardId);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(null);
      return;
    }
    router.push("/admin/approvals");
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <p className="text-xs uppercase tracking-widest text-accent">Admin review</p>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="appliedChange">Handicap change to apply</Label>
        {/* type="text" + inputMode="decimal" instead of type="number" —
            see the comment on the playing handicap input in
            new-scorecard-form.tsx for why. Can be negative (a cut) or
            positive (an increase), so no digit-only filter. */}
        <Input
          id="appliedChange"
          type="text"
          inputMode="decimal"
          value={appliedChange}
          onChange={(e) => setAppliedChange(e.target.value)}
          disabled={pending !== null}
          className="font-numeral w-32"
        />
        <p className="text-xs text-muted-foreground">
          Proposed: {proposedChange > 0 ? "+" : ""}
          {proposedChange}
          {isOverride && " — editing this overrides the proposed amount"}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-3">
        <Button
          type="button"
          variant="accent"
          onClick={handleApprove}
          disabled={pending !== null}
        >
          {pending === "approve" ? "Approving…" : isOverride ? "Override & approve" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleReject}
          disabled={pending !== null}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
