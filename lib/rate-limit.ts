import "server-only";

/**
 * A 4-digit PIN has only 10,000 possible values, so hashing alone isn't
 * enough protection — the login endpoint itself must be rate-limited.
 *
 * This is an in-memory, per-process limiter: fine for a single-instance
 * deployment (e.g. one Vercel/Node process backing a small society), but it
 * resets on redeploy and won't share state across multiple instances. If
 * you scale beyond one instance, move this to a shared store (a Supabase
 * table with a last-attempt timestamp + count, or Redis) instead.
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/** Key by playerId (so one player's bad PIN attempts don't lock out others). */
export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    attempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: null });
    return { allowed: true };
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, retryAfterMs: record.lockedUntil - now };
  }

  if (now - record.firstAttemptAt > WINDOW_MS) {
    // window expired, reset
    attempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: null });
    return { allowed: true };
  }

  record.count += 1;

  if (record.count > MAX_ATTEMPTS_PER_WINDOW) {
    record.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }

  return { allowed: true };
}

/** Call after a successful login to clear the counter for this key. */
export function resetLoginRateLimit(key: string) {
  attempts.delete(key);
}
