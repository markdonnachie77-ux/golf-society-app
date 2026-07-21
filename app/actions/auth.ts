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
} from "@/lib/auth";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/rate-limit";
import { getCurrentSocietyId } from "@/lib/tenant";

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

export async function registerPlayer(formData: FormData): Promise<ActionResult> {
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

  redirect("/dashboard");
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

  redirect("/dashboard");
}

// ---------- Logout ----------

export async function logout() {
  const societyId = await getCurrentSocietyId();
  console.log(`[logout] running with societyId=${societyId}`);
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Player list for the login page selector ----------

export async function listPlayersForLogin() {
  const societyId = await getCurrentSocietyId();
  console.log(`[listPlayersForLogin] getCurrentSocietyId() = ${societyId}`);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, society_id")
    .eq("society_id", societyId)
    .order("last_name", { ascending: true });

  console.log(
    `[listPlayersForLogin] query returned ${data?.length ?? 0} row(s), error=`,
    error,
    "rows:",
    data
  );

  if (error) return [];
  return data;
}
