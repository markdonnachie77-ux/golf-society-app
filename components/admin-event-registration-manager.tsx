"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminRegisterPlayer, adminDeregisterPlayer } from "@/app/actions/events";

interface PlayerOption {
  id: string;
  first_name: string;
  last_name: string;
}

export function AdminEventRegistrationManager({
  eventId,
  players,
  registeredPlayerIds,
}: {
  eventId: string;
  players: PlayerOption[];
  registeredPlayerIds: Set<string>;
}) {
  const router = useRouter();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const unregisteredPlayers = players.filter((p) => !registeredPlayerIds.has(p.id));

  async function handleRegister() {
    if (!selectedPlayerId) return;
    setPending(true);
    setError(null);
    const result = await adminRegisterPlayer(eventId, selectedPlayerId);
    if (!result.ok) {
      setError(result.error ?? "Could not register this player.");
      setPending(false);
      return;
    }
    setSelectedPlayerId("");
    setPending(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Register a player (admin — bypasses capacity and the self-registration setting)
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          disabled={pending || unregisteredPlayers.length === 0}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {unregisteredPlayers.length === 0 ? "Everyone is already registered" : "Select a player"}
          </option>
          {unregisteredPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" onClick={handleRegister} disabled={pending || !selectedPlayerId}>
          {pending ? "Registering…" : "Register"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function AdminRemoveRegistrationButton({
  eventId,
  playerId,
}: {
  eventId: string;
  playerId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRemove() {
    setPending(true);
    setError(null);
    const result = await adminDeregisterPlayer(eventId, playerId);
    if (!result.ok) {
      setError(result.error ?? "Could not remove.");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
