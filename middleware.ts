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

interface ResolvedSociety {
  id: string;
  slug: string;
}

// Tiny in-memory cache so repeated requests hitting the same Edge
// instance don't re-query Supabase every time. Edge instances are
// distributed and short-lived, so this is a best-effort optimization, not
// a correctness requirement — every cache miss just does a real lookup.
// Worth replacing with Vercel Edge Config if/when there are enough
// tenants or enough traffic for this to matter.
const societyCache = new Map<string, { society: ResolvedSociety | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function lookupSocietyBySlug(slug: string): Promise<ResolvedSociety | null> {
  const cached = societyCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[tenant] "${slug}" -> cache hit:`, cached.society);
    return cached.society;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(`[tenant] "${slug}" -> SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in middleware env`);
    return null;
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/societies?slug=eq.${encodeURIComponent(slug)}&select=id,slug`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!response.ok) {
      console.log(`[tenant] "${slug}" -> lookup HTTP ${response.status}:`, await response.text());
      return null;
    }

    const rows = (await response.json()) as ResolvedSociety[];
    console.log(`[tenant] "${slug}" -> query returned ${rows.length} row(s):`, rows);
    const found = rows[0] ?? null;
    societyCache.set(slug, { society: found, expiresAt: Date.now() + CACHE_TTL_MS });
    return found;
  } catch (err) {
    console.log(`[tenant] "${slug}" -> lookup threw:`, err);
    return null;
  }
}

/** Resolves which society a request's hostname belongs to.
 * - "default" — no subdomain present, use the one seeded society
 * - a ResolvedSociety — a real, matched tenant
 * - null — a subdomain WAS present but didn't match any known society;
 *   the caller should reject the request rather than silently falling
 *   back to the default tenant's data. Falling back silently here would
 *   be a real cross-tenant bug waiting to happen — a typo'd or
 *   not-yet-provisioned subdomain must never quietly show someone else's
 *   society instead. */
async function resolveSociety(hostname: string): Promise<ResolvedSociety | "default" | null> {
  const subdomain = extractSubdomain(hostname, process.env.PLATFORM_ROOT_DOMAIN);
  if (!subdomain) return "default";
  return lookupSocietyBySlug(subdomain);
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
  console.log(`[tenant] host="${hostHeader}" path="${pathname}" -> resolved=`, resolved);
  if (resolved === null) {
    return new NextResponse("Society not found", { status: 404 });
  }
  const societyId = resolved === "default" ? DEFAULT_SOCIETY_ID : resolved.id;
  console.log(`[tenant] -> using societyId=${societyId}`);

  // Forwarded to every downstream Server Component/Action as a request
  // header. Using .set() (not .append()) unconditionally overwrites
  // anything a client tried to send under this name — the resolved value
  // always wins, a client can't spoof its own tenant by sending this
  // header directly.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SOCIETY_HEADER, societyId);
  const withTenantHeader = { request: { headers: requestHeaders } };

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(token, societyId);

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
