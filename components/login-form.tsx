"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayerSelect } from "@/components/player-select";
import { PinKeypad } from "@/components/pin-keypad";
import { Button } from "@/components/ui/button";
import { loginPlayer } from "@/app/actions/auth";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
}

export function LoginForm({ players }: { players: Player[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [playerId, setPlayerId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerId || pin.length !== 4) return;

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("playerId", playerId);
    formData.set("pin", pin);

    const result = await loginPlayer(formData);
    // If loginPlayer succeeded it calls redirect() server-side and this
    // line is never reached; we only get a return value on failure.
    if (result && !result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPin("");
      setPending(false);
    }
  }

  // Auto-submit once 4 digits are entered and a player is selected.
  React.useEffect(() => {
    if (playerId && pin.length === 4 && !pending) {
      handleSubmit(new Event("submit") as unknown as React.FormEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, playerId]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
      <div className="w-full">
        <PlayerSelect players={players} value={playerId} onChange={setPlayerId} />
      </div>

      <PinKeypad
        value={pin}
        onChange={setPin}
        label={playerId ? "Enter your 4-digit PIN" : "Select your name first"}
        disabled={!playerId || pending}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        variant="accent"
        disabled={!playerId || pin.length !== 4 || pending}
        className="w-full"
      >
        {pending ? "Checking…" : "Log in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        New to the society?{" "}
        <a href="/register" className="font-medium text-primary underline underline-offset-2">
          Register here
        </a>
      </p>
    </form>
  );
}
