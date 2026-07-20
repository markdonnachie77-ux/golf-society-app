import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PlayerRole } from "@/lib/database.types";

const SESSION_COOKIE_NAME = "gs_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PIN_REGEX = /^\d{4}$/;

export interface SessionPayload {
  playerId: string;
  role: PlayerRole;
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET env var must be set to a random string of at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------- PIN hashing ----------

/** Validates the raw PIN shape (exactly 4 digits) before it's ever hashed. */
export function isValidPinFormat(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  // Cost factor 12 — a 4-digit PIN has only 10,000 possible values, so the
  // hash cost matters less than rate-limiting the login endpoint (see
  // lib/rate-limit.ts). We still hash properly rather than relying on
  // rate-limiting alone.
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  return bcrypt.compare(pin, pinHash);
}

// ---------- Session JWT ----------

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ playerId: payload.playerId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (typeof payload.playerId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { playerId: payload.playerId, role: payload.role as PlayerRole };
  } catch {
    return null;
  }
}

// ---------- Cookie helpers (call only from Server Actions / Route Handlers) ----------

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/** Reads and verifies the session cookie. Returns null if absent/invalid/expired. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws if there's no valid session. Use in Server Actions / Route Handlers. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated.");
  }
  return session;
}

/** Throws if there's no valid session OR the session isn't an admin. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Admin role required.");
  }
  return session;
}

export { SESSION_COOKIE_NAME };
