"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

// Older browsers and non-secure contexts have no navigator.clipboard, so
// fall back to a hidden textarea + execCommand("copy").
function legacyCopy(text: string): boolean {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copies this event's public URL to the clipboard so it can be pasted into a
 * text message. The URL is built from the browser's current origin, so it is
 * automatically correct for whichever society/domain the admin is on.
 */
export function CopyEventLinkButton({ eventId }: { eventId: string }) {
  const [state, setState] = React.useState<CopyState>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    const url = `${window.location.origin}/events/${eventId}`;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = legacyCopy(url);

    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {state === "copied" ? "Link copied ✓" : "Copy Link"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Event link copied to clipboard" : ""}
      </span>
      {state === "failed" && (
        <span role="alert" className="text-sm text-destructive">
          Couldn&apos;t copy — copy the address from your browser instead.
        </span>
      )}
    </>
  );
}
