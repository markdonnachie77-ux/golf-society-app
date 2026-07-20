"use client";

import { cn } from "@/lib/utils";

export function ParToggle({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Par" className="inline-flex gap-1">
      {[3, 4, 5].map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full font-numeral text-sm transition-colors",
            value === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary",
            disabled && "opacity-50"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
