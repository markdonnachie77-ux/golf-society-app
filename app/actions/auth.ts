"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  hashPin,
  verifyPin,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
} from "@/lib/auth";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/rate-limit";
import { getCurrentSocietyId } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";

// ---------- Register ----------

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  initialHandicap: z
    .number({ invalid_type_error: "Handicap must be a number" })
    .min(-10, "Handicap looks too low")
    .max(54, "Handicap looks too high"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  pinConfirm: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Used by both loginPlayer and registerPlayer to decide where to send
 * someone after success, instead of always hardcoding "/dashboard" —
 * needed so scanning an event sign-up QR code while logged out actually
 * lands back on that event after authenticating, not just the dashboard.
 *
 * Never trusts the value outright — honoring an arbitrary "next" from a
 * query string is a classic open-redirect vulnerability: a link could
 * disguise itself as this app's own login page while quietly sending
 * someone elsewhere the moment they authenticate. Only a same-app
 * relative path is accepted; anything else (an absolute URL, a
 * protocol-relative "//evil.com" trick, a bare scheme) falls back to the
 * default. Also rejects /login or /register themselves as a next
 * target — redirecting a freshly-authenticated session straight back to
 * the login/register page makes no sense as a destination.
 */
function safeNextPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path === "/login" || path === "/register" || path.startsWith("/login?") || path.startsWith("/register?")) {
    return "/dashboard";
  }
  return path;
}

export async function registerPlayer(formData: FormData): Promise<ActionResult> {
  // The actual boundary for the players_can_self_register setting —
  // /register hiding its form when this is off is just UX. Checked
  // first, before any other validation, so a disabled registration
  // attempt is rejected the same way regardless of what else is (or
  // isn't) filled in on the submitted form.
  const settings = await getAppSettings();
  if (!settings.playersCanSelfRegister) {
    return {
      ok: false,
      error: "Registration is currently closed — contact an admin to be added.",
    };
  }

  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    initialHandicap: Number(formData.get("initialHandicap")),
    pin: String(formData.get("pin") ?? ""),
    pinConfirm: String(formData.get("pinConfirm") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;

  if (data.pin !== data.pinConfirm) {
    return {
      ok: false,
      error: "PINs don't match.",
      fieldErrors: { pinConfirm: "PINs don't match" },
    };
  }

  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();
  const pinHash = await hashPin(data.pin);

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email || null,
      current_handicap: data.initialHandicap,
      pin_hash: pinHash,
      role: "player",
      // Explicit, not left to the column's DB default — the default only
      // covers the one original society. A real registration must always
      // be stamped with whichever society this request actually resolved
      // to, so it's correct the moment a second tenant exists.
      society_id: societyId,
    })
    .select("id, role")
    .single();

  if (error || !player) {
    return { ok: false, error: "Could not create your player profile. Please try again." };
  }

  const token = await createSessionToken({ playerId: player.id, role: player.role, societyId });
  await setSessionCookie(token);

  redirect(safeNextPath(formData.get("next")));
}

// ---------- Admin-created players ----------

/** 4 digits, full 0000-9999 range (leading zero allowed) — same format
 * self-chosen PINs use, just generated rather than typed. */
function generateRandomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export interface CreatedPlayerResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Only present on success — the plaintext PIN, shown to the admin
   * exactly once. Nothing stores this anywhere; only the bcrypt hash is
   * persisted, same as every other PIN in this app. If it's lost before
   * being relayed to the player, the only recovery is resetting it again
   * via adminResetPlayerPin. */
  player?: { id: string; firstName: string; lastName: string; pin: string };
}

const adminCreatePlayerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  initialHandicap: z
    .number({ invalid_type_error: "Handicap must be a number" })
    .min(-10, "Handicap looks too low")
    .max(54, "Handicap looks too high"),
});

/**
 * Admin-initiated player creation — the PIN is generated, not chosen, and
 * shown once in the result for the admin to relay. Always creates as
 * role "player"; promoting to admin is still a deliberate manual step in
 * Supabase Studio, not something this form offers (an explicit choice —
 * see README).
 *
 * Deliberately doesn't log the admin in as the new player or touch their
 * own session at all — unlike registerPlayer, which is a person creating
 * and immediately logging into their own account, this is one person
 * (the admin) acting on someone else's behalf, staying logged in as
 * themselves throughout.
 */
export async function adminCreatePlayer(formData: FormData): Promise<CreatedPlayerResult> {
  await requireAdmin();

  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    initialHandicap: Number(formData.get("initialHandicap")),
  };

  const parsed = adminCreatePlayerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const pin = generateRandomPin();
  const pinHash = await hashPin(pin);

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email || null,
      current_handicap: data.initialHandicap,
      pin_hash: pinHash,
      role: "player",
      society_id: societyId,
    })
    .select("id, first_name, last_name")
    .single();

  if (error || !player) {
    return { ok: false, error: "Could not create this player. Please try again." };
  }

  return {
    ok: true,
    player: { id: player.id, firstName: player.first_name, lastName: player.last_name, pin },
  };
}

/**
 * Generates a fresh PIN for an existing player and overwrites their
 * pin_hash — e.g. they've forgotten it, lost the device it was on, or an
 * admin-generated PIN never made it to them. Scoped by society_id in the
 * update itself (same pattern as updateCourse in app/actions/courses.ts)
 * rather than a separate check-then-act: if playerId belongs to a
 * different tenant, this matches zero rows and .select() detects that,
 * rather than a race window between checking and updating.
 */
export async function adminResetPlayerPin(playerId: string): Promise<CreatedPlayerResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const pin = generateRandomPin();
  const pinHash = await hashPin(pin);

  const { data: updated, error } = await supabase
    .from("players")
    .update({ pin_hash: pinHash })
    .eq("id", playerId)
    .eq("society_id", societyId)
    .select("id, first_name, last_name")
    .single();

  if (error || !updated) {
    return { ok: false, error: "Could not reset this player's PIN." };
  }

  return {
    ok: true,
    player: { id: updated.id, firstName: updated.first_name, lastName: updated.last_name, pin },
  };
}

// ---------- Login ----------

const loginSchema = z.object({
  playerId: z.string().uuid("Select a player"),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export async function loginPlayer(formData: FormData): Promise<ActionResult> {
  const raw = {
    playerId: String(formData.get("playerId") ?? ""),
    pin: String(formData.get("pin") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Select your name and enter your 4-digit PIN." };
  }

  const { playerId, pin } = parsed.data;

  const limit = checkLoginRateLimit(playerId);
  if (!limit.allowed) {
    const minutes = Math.ceil((limit.retryAfterMs ?? 0) / 60000);
    return {
      ok: false,
      error: `Too many incorrect attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const supabase = createServiceClient();
  const societyId = await getCurrentSocietyId();

  const { data: player, error } = await supabase
    .from("players")
    .select("id, pin_hash, role, society_id")
    .eq("id", playerId)
    .single();

  if (error || !player) {
    return { ok: false, error: "Player not found." };
  }

  // Same error message as "doesn't exist at all" rather than something
  // more specific — a player belonging to a different society shouldn't
  // learn that their id exists elsewhere just by trying to log in with it
  // on the wrong tenant's subdomain.
  if (player.society_id !== societyId) {
    return { ok: false, error: "Player not found." };
  }

  const valid = await verifyPin(pin, player.pin_hash);
  if (!valid) {
    return { ok: false, error: "Incorrect PIN." };
  }

  resetLoginRateLimit(playerId);

  const token = await createSessionToken({ playerId: player.id, role: player.role, societyId });
  await setSessionCookie(token);

  redirect(safeNextPath(formData.get("next")));
}

// ---------- Logout ----------

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Player list for the login page selector ----------

export async function listPlayersForLogin() {
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("society_id", societyId)
    .order("last_name", { ascending: true });

  if (error) return [];
  return data;
}
