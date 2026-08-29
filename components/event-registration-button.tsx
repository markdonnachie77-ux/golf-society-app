"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { registerForEvent, deregisterFromEvent } from "@/app/actions/events";

export function EventRegistrationButton({
  eventId,
  isRegistered,
  isFull,
  selfRegistrationEnabled,
}: {
  eventId: string;
  isRegistered: boolean;
  isFull: boolean;
  selfRegistrationEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRegister() {
    setPending(true);
    setError(null);
    const result = await registerForEvent(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not register.");
      setPending(false);
      return;
    }
    router.refresh();
  }

  async function handleDeregister() {
    setPending(true);
    setError(null);
    const result = await deregisterFromEvent(eventId);
    if (!result.ok) {
      setError(result.error ?? "Could not remove your registration.");
      setPending(false);
      return;
    }
    router.refresh();
  }

  if (isRegistered) {
    // Withdrawing your own registration is always available regardless
    // of selfRegistrationEnabled — that setting only gates NEW
    // registrations, not removing one you already have.
    return (
      <div>
        <Button type="button" variant="outline" onClick={handleDeregister} disabled={pending}>
          {pending ? "Removing…" : "Withdraw my registration"}
        </Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (!selfRegistrationEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Registration for this event is admin-only — contact an admin to be added.
      </p>
    );
  }

  if (isFull) {
    return <p className="text-sm text-muted-foreground">This event is full.</p>;
  }

  return (
    <div>
      <Button type="button" variant="accent" onClick={handleRegister} disabled={pending}>
        {pending ? "Registering…" : "Register"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
