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
    })
    .select("id, role")
    .single();

  if (error || !player) {
    return { ok: false, error: "Could not create your player profile. Please try again." };
  }

  const token = await createSessionToken({ playerId: player.id, role: player.role });
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
  const { data: player, error } = await supabase
    .from("players")
    .select("id, pin_hash, role")
    .eq("id", playerId)
    .single();

  if (error || !player) {
    return { ok: false, error: "Player not found." };
  }

  const valid = await verifyPin(pin, player.pin_hash);
  if (!valid) {
    return { ok: false, error: "Incorrect PIN." };
  }

  resetLoginRateLimit(playerId);

  const token = await createSessionToken({ playerId: player.id, role: player.role });
  await setSessionCookie(token);

  redirect("/dashboard");
}

// ---------- Logout ----------

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Player list for the login page selector ----------

export async function listPlayersForLogin() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true });

  if (error) return [];
  return data;
}
