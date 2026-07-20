import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 *
 * This bypasses RLS entirely — see supabase/migrations/0007_rls_policies.sql
 * for why: auth is a custom PIN system, not Supabase Auth, so RLS can't be
 * keyed on player identity. Authorization instead happens in code, in
 * lib/auth.ts's `requireSession()` / `requireAdmin()`, BEFORE this client
 * is ever used. Never import this file from a "use client" component and
 * never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
