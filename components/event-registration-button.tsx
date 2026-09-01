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

  // router.refresh() isn't awaitable (it returns void, confirmed against
  // this Next.js version's own type definitions) — there's no way to
  // know from the call site alone when the re-fetch has actually landed.
  // Resetting pending immediately after the action succeeds, before that
  // refresh completes, causes a real, visible bug: the button briefly
  // flashes back to its OLD, pre-action state (confirmed via a recorded
  // repro — clicking Register showed "Registering…", then flashed back
  // to "Register" for about a second, before finally landing on "Withdraw
  // my registration" once the refreshed data arrived). Watching the
  // server-provided isRegistered prop itself and resetting only when it
  // actually changes ties the reset to when the UI genuinely has correct
  // data, avoiding both that flash and the original bug this replaced
  // (never resetting at all, which left the new button stuck disabled
  // forever). Also covers the initial mount, but setting an already-false
  // value to false again is a no-op.
  React.useEffect(() => {
    setPending(false);
  }, [isRegistered]);

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
