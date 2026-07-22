import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { extractSubdomain } from "@/lib/tenant-resolution";

// Middleware runs in the Edge runtime, which can't import "server-only"
// code (lib/auth.ts pulls in bcryptjs/next-headers helpers not edge-safe
// in all deploy targets), so session verification is re-implemented here
// against the same SESSION_SECRET / cookie name.

const SESSION_COOKIE_NAME = "gs_session";

const PUBLIC_PATHS = ["/login", "/register"];
const ADMIN_PATH_PREFIXES = ["/admin", "/courses"];

// ---------------------------------------------------------------------------
// Multi-tenant resolution
// ---------------------------------------------------------------------------
//
// This is Phase 1 of moving toward a shared multi-tenant deployment (see
// README's "Future-proofing for multi-tenancy" section) — resolving WHICH
// society a request is for, from its hostname. Nothing downstream is
// scoped by this yet (that's Phase 3: adding society_id filters to every
// query) — this phase only establishes, correctly and testably, which
// society_id a request should eventually be scoped to.
//
// PLATFORM_ROOT_DOMAIN unset (the common case today — a single-tenant
// deployment) means every request resolves to the one default society
// below, unconditionally. That's what makes this entire feature a no-op
// until that env var is actually configured — an existing single-tenant
// deployment needs zero changes to keep working exactly as it does today.

const DEFAULT_SOCIETY_ID = "00000000-0000-0000-0000-000000000001";
const SOCIETY_HEADER = "x-society-id";
const SOCIETY_NAME_HEADER = "x-society-name";

interface ResolvedSociety {
  id: string;
  slug: string;
  name: string;
}

// Tiny in-memory cache so repeated requests hitting the same Edge
// instance don't re-query Supabase every time. Edge instances are
// distributed and short-lived, so this is a best-effort optimization, not
// a correctness requirement — every cache miss just does a real lookup.
// Worth replacing with Vercel Edge Config if/when there are enough
// tenants or enough traffic for this to matter.
const societyCache = new Map<string, { society: ResolvedSociety | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function fetchSociety(filterColumn: "slug" | "id", filterValue: string): Promise<ResolvedSociety | null> {
  const cacheKey = `${filterColumn}:${filterValue}`;
  const cached = societyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.society;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(
      `${url}/rest/v1/societies?${filterColumn}=eq.${encodeURIComponent(filterValue)}&select=id,slug,name`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!response.ok) return null;

    const rows = (await response.json()) as ResolvedSociety[];
    const found = rows[0] ?? null;
    societyCache.set(cacheKey, { society: found, expiresAt: Date.now() + CACHE_TTL_MS });
    return found;
  } catch {
    return null;
  }
}

/**
 * Resolves which society a request's hostname belongs to.
 *
 * A real, recognized tenant subdomain (e.g. ktown.localsociety.club)
 * resolves by SLUG — that's genuinely the only identifier available for
 * it. But a bare/apex/www/custom-domain hostname (evsgolfsociety.co.uk,
 * plain localhost, etc.) resolves by the FIXED, HARDCODED default
 * society ID instead of by slug — deliberately, not as a shortcut for
 * "avoid one extra query". Looking that case up by slug instead (as an
 * earlier version of this function did, purely so the name came from
 * the same code path as the id) turned a slug mismatch/typo into the
 * WHOLE SITE 404ing for every hostname that isn't a recognized
 * subdomain — including the one production domain most likely to be
 * hit constantly. The fixed UUID can't drift or typo the way a free-text
 * slug column can, so it's the more resilient thing to depend on for
 * "this is the fallback path every non-subdomain request takes."
 *
 * Returns null only when a REAL subdomain was present but didn't match
 * any known society — the caller must reject that request rather than
 * silently falling back to a different tenant's data. That's a
 * different failure mode from the default-society lookup ever failing:
 * an unrecognized subdomain not resolving is expected and safe to reject;
 * the fallback path not resolving would take down every hostname that
 * isn't a subdomain at all, which is why it doesn't share the same
 * "fail closed" behavior — it fails toward the one fixed, known-correct
 * id instead.
 */
async function resolveSociety(hostname: string): Promise<ResolvedSociety | null> {
  const subdomain = extractSubdomain(hostname, process.env.PLATFORM_ROOT_DOMAIN);
  if (!subdomain) {
    return fetchSociety("id", DEFAULT_SOCIETY_ID);
  }
  return fetchSociety("slug", subdomain);
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set.");
  }
  return new TextEncoder().encode(secret);
}

async function readSession(token: string | undefined, expectedSocietyId: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (
      typeof payload.playerId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.societyId !== "string"
    ) {
      return null;
    }
    // A session issued for a different society is treated exactly like
    // no session at all — never honored just because the token itself is
    // otherwise valid and unexpired. Same check as lib/auth.ts's
    // getSession(), duplicated here for the same reason session
    // verification itself is duplicated in this file (Edge runtime can't
    // import that server-only module).
    if (payload.societyId !== expectedSocietyId) {
      return null;
    }
    return { playerId: payload.playerId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hostHeader = request.headers.get("host") ?? "";
  const resolved = await resolveSociety(hostHeader);
  if (resolved === null) {
    return new NextResponse("Society not found", { status: 404 });
  }

  // Forwarded to every downstream Server Component/Action as request
  // headers. Using .set() (not .append()) unconditionally overwrites
  // anything a client tried to send under these names — the resolved
  // values always win, a client can't spoof its own tenant by sending
  // either header directly. The name is URL-encoded since society names
  // are free-text (set by whoever creates the row) and HTTP header
  // values don't safely support arbitrary characters.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SOCIETY_HEADER, resolved.id);
  requestHeaders.set(SOCIETY_NAME_HEADER, encodeURIComponent(resolved.name));
  const withTenantHeader = { request: { headers: requestHeaders } };

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(token, resolved.id);

  if (isPublic) {
    // Already logged in? Bounce away from login/register to the dashboard.
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next(withTenantHeader);
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (ADMIN_PATH_PREFIXES.some((p) => pathname.startsWith(p)) && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next(withTenantHeader);
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - static files / _next internals
     * - favicon, images
     * - the root marketing/landing route ("/") if you add one later
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
