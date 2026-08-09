"use client";

import * as React from "react";
import Link from "next/link";
import { adminCreatePlayer } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreatePlayerForm() {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [initialHandicap, setInitialHandicap] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ firstName: string; lastName: string; pin: string } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("firstName", firstName.trim());
    formData.set("lastName", lastName.trim());
    formData.set("email", email.trim());
    formData.set("initialHandicap", initialHandicap);

    const result = await adminCreatePlayer(formData);
    if (!result.ok || !result.player) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    setCreated({ firstName: result.player.firstName, lastName: result.player.lastName, pin: result.player.pin });
    setPending(false);
  }

  if (created) {
    return (
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-6">
        <p className="text-sm text-muted-foreground">
          {created.firstName} {created.lastName} has been added. Share this PIN with them — it
          won&apos;t be shown again. If it's lost, reset it from their profile page instead.
        </p>
        <p className="font-numeral mt-4 text-5xl font-semibold tracking-widest text-primary">
          {created.pin}
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreated(null);
              setFirstName("");
              setLastName("");
              setEmail("");
              setInitialHandicap("");
            }}
          >
            Add another player
          </Button>
          <Button asChild>
            <Link href="/players">Done</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="initialHandicap">Initial handicap</Label>
        {/* type="text" + inputMode="decimal" instead of type="number" —
            see the comment on the playing handicap input in
            new-scorecard-form.tsx for why. */}
        <Input
          id="initialHandicap"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 18.4"
          value={initialHandicap}
          onChange={(e) => setInitialHandicap(e.target.value)}
          disabled={pending}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create player"}
      </Button>
    </form>
  );
}
