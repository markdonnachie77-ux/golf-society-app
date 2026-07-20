"use client";

import { cn } from "@/lib/utils";

interface SegmentedToggleProps {
  value: 9 | 18;
  onChange: (value: 9 | 18) => void;
  disabled?: boolean;
}

export function HoleCountToggle({ value, onChange, disabled }: SegmentedToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Hole count"
      className="inline-flex rounded-md border border-border bg-card p-1"
    >
      {([9, 18] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-sm px-4 py-1.5 font-numeral text-sm transition-colors",
            value === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50"
          )}
        >
          {option} holes
        </button>
      ))}
    </div>
  );
}
