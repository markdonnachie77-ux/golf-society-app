"use client";

import { cn } from "@/lib/utils";
import type { RoundType } from "@/lib/golf-math";
import { roundTypeLabel } from "@/lib/round-setup";

export function RoundTypeToggle({
  options,
  holeCount,
  value,
  onChange,
  disabled,
}: {
  options: RoundType[];
  holeCount: 9 | 18;
  value: RoundType | null;
  onChange: (value: RoundType) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Round type" className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            value === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
            disabled && "opacity-50"
          )}
        >
          {roundTypeLabel(opt, holeCount)}
        </button>
      ))}
    </div>
  );
}
