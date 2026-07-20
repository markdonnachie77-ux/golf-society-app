"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
}

interface PlayerSelectProps {
  players: Player[];
  value: string | null;
  onChange: (playerId: string) => void;
}

export function PlayerSelect({ players, value, onChange }: PlayerSelectProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const selected = players.find((p) => p.id === value) ?? null;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    );
  }, [players, query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={open ? query : selected ? `${selected.first_name} ${selected.last_name}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find your name…"
          className="flex h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No players found</li>
          )}
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-secondary",
                  p.id === value && "bg-secondary font-medium"
                )}
              >
                {p.first_name} {p.last_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
