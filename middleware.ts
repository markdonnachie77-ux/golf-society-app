import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Middleware runs in the Edge runtime, which can't import "server-only"
// code (lib/auth.ts pulls in bcryptjs/next-headers helpers not edge-safe
// in all deploy targets), so session verification is re-implemented here
// against the same SESSION_SECRET / cookie name.

const SESSION_COOKIE_NAME = "gs_session";

const PUBLIC_PATHS = ["/login", "/register"];
const ADMIN_PATH_PREFIXES = ["/admin", "/courses"];

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set.");
  }
  return new TextEncoder().encode(secret);
}

async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (typeof payload.playerId !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { playerId: payload.playerId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(token);

  if (isPublic) {
    // Already logged in? Bounce away from login/register to the dashboard.
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (ADMIN_PATH_PREFIXES.some((p) => pathname.startsWith(p)) && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
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
