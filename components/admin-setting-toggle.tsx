"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { updateSetting, type SettingKey } from "@/app/actions/settings";

export function SettingToggle({
  settingKey,
  label,
  description,
  initialValue,
}: {
  settingKey: SettingKey;
  label: string;
  description: string;
  initialValue: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialValue);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleToggle() {
    const next = !value;
    setPending(true);
    setError(null);

    const result = await updateSetting(settingKey, next);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    setValue(next);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={handleToggle}
        disabled={pending}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
          value ? "bg-primary" : "bg-secondary"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-transform",
            value ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
