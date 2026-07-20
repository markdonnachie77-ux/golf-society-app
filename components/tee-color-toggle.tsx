"use client";

import { cn } from "@/lib/utils";

export function TeeColorToggle({
  value,
  onChange,
  disabled,
}: {
  value: "white" | "yellow";
  onChange: (value: "white" | "yellow") => void;
  disabled?: boolean;
}) {
  const options: { value: "white" | "yellow"; label: string; dot: string }[] = [
    { value: "white", label: "White tees", dot: "bg-neutral-100 border border-neutral-300" },
    { value: "yellow", label: "Yellow tees", dot: "bg-yellow-400" },
  ];

  return (
    <div role="radiogroup" aria-label="Tee color" className="inline-flex rounded-md border border-border bg-card p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50"
          )}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", opt.dot)} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
