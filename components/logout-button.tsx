"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";

/**
 * Deliberately NOT a <form action={logout}> — that native form-action
 * binding triggers Next.js's server-side redirect handling (a real HTTP
 * 303 response), which has a known issue on custom/subdomain hostnames:
 * the redirect Location can fall back to the server's default origin
 * instead of preserving the actual request's host. Every other action in
 * this app already avoids this by calling the server action directly
 * from client-side code (see components/login-form.tsx) — logout() still
 * calls redirect("/login") internally, same as before, it just needs to
 * be invoked this way rather than via a native form action for that
 * redirect to correctly stay on the current tenant's hostname.
 */
export function LogoutButton() {
  const [pending, setPending] = React.useState(false);

  async function handleLogout() {
    setPending(true);
    await logout();
    // logout() redirects internally on success — this line is never
    // reached in that case, same pattern as loginPlayer's callers.
    setPending(false);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={pending}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
