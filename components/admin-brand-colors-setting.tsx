"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateBrandColors } from "@/app/actions/settings";
import { BRAND_COLOR_KEYS, isValidHex, type BrandColors } from "@/lib/color";

// The app's built-in "clubhouse ledger" colors (globals.css's :root
// defaults), converted from HSL to hex so the pickers start out showing
// the current theme rather than an arbitrary color when nothing's been
// customized yet.
const BUILT_IN_DEFAULTS: BrandColors = {
  primary: "#1f513f",
  secondary: "#eae2d7",
  accent: "#be8c37",
};

const LABELS: Record<keyof BrandColors, { label: string; description: string }> = {
  primary: { label: "Primary", description: "Buttons, links, and the main accent throughout the app." },
  secondary: { label: "Secondary", description: "Subtler backgrounds — inactive toggles, secondary buttons." },
  accent: { label: "Accent", description: "Small highlights — the society name, badges, chart lines." },
};

export function AdminBrandColorsSetting({ currentColors }: { currentColors: BrandColors | null }) {
  const router = useRouter();
  const [colors, setColors] = React.useState<BrandColors>(currentColors ?? BUILT_IN_DEFAULTS);
  const [isCustomized, setIsCustomized] = React.useState(currentColors !== null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleColorChange(key: keyof BrandColors, hex: string) {
    setColors((prev) => ({ ...prev, [key]: hex }));
  }

  async function handleSave() {
    setError(null);

    for (const key of BRAND_COLOR_KEYS) {
      if (!isValidHex(colors[key])) {
        setError("Something's wrong with one of those colors — try picking it again.");
        return;
      }
    }

    setPending(true);
    const result = await updateBrandColors(colors);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    setIsCustomized(true);
    setPending(false);
    router.refresh();
  }

  async function handleReset() {
    setPending(true);
    setError(null);

    const result = await updateBrandColors(null);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    setColors(BUILT_IN_DEFAULTS);
    setIsCustomized(false);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="px-5 py-4">
      <p className="font-medium">Brand colors</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Customize the Primary, Secondary, and Accent colors used throughout the app. Text color is
        picked automatically to stay readable against whatever you choose.
      </p>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 space-y-3">
        {BRAND_COLOR_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <label className="relative shrink-0 cursor-pointer">
              <span
                className="block h-9 w-9 rounded-md border border-border"
                style={{ backgroundColor: colors[key] }}
              />
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => handleColorChange(key, e.target.value)}
                disabled={pending}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`${LABELS[key].label} color`}
              />
            </label>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{LABELS[key].label}</p>
              <p className="truncate text-xs text-muted-foreground">{LABELS[key].description}</p>
            </div>
            <span className="font-numeral shrink-0 text-xs uppercase text-muted-foreground">
              {colors[key]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
          {pending ? "Saving…" : "Save colors"}
        </Button>
        {isCustomized && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleReset}>
            Reset to default
          </Button>
        )}
      </div>
    </div>
  );
}
