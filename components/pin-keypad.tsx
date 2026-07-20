"use client";

import * as React from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/**
 * Renders four ledger-style score boxes (echoing a scorecard's hole boxes)
 * above a numeric keypad. No native number input — this is a deliberate,
 * tactile PIN-entry pattern rather than a generic <input type="password">.
 */
export function PinKeypad({ value, onChange, label, disabled, autoFocus }: PinKeypadProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [autoFocus]);

  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "" || value.length >= 4) return;
    onChange(value + key);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (/^\d$/.test(e.key)) press(e.key);
    if (e.key === "Backspace") press("back");
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex flex-col items-center gap-6 outline-none"
    >
      {label && <span className="text-sm text-muted-foreground">{label}</span>}

      <div className="flex gap-3" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex h-14 w-11 items-center justify-center rounded-md border-2 font-numeral text-2xl",
              i < value.length ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            {i < value.length ? "•" : ""}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, idx) =>
          key === "" ? (
            <div key={idx} />
          ) : key === "back" ? (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => press("back")}
              aria-label="Delete digit"
              className="flex h-14 w-14 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
            >
              <Delete className="h-5 w-5" />
            </button>
          ) : (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              className="flex h-14 w-14 items-center justify-center rounded-full font-numeral text-xl transition-colors hover:bg-secondary active:bg-accent/20 disabled:opacity-40"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  );
}
