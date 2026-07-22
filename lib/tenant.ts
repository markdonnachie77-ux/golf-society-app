import "server-only";
import { headers } from "next/headers";

/**
 * Reads the society_id that middleware resolved for this request (see
 * middleware.ts's resolveSociety) from the request header it set. Used
 * throughout the app's server actions to scope every query by tenant.
 *
 * Throws rather than silently defaulting if the header is missing,
 * because that should only ever happen if middleware didn't run for this
 * request (a matcher misconfiguration, or code calling this from
 * somewhere middleware doesn't cover) — silently falling back to the
 * default society here would hide exactly the kind of bug that matters
 * most with more than one tenant in the database.
 */
export async function getCurrentSocietyId(): Promise<string> {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    throw new Error(
      "No society_id header found on this request — middleware may not have run for this route."
    );
  }

  return societyId;
}

/**
 * Reads the current society's display NAME (societies.name), set by the
 * same middleware resolution as getCurrentSocietyId above. URL-decoded
 * here to match the encodeURIComponent() middleware applies when setting
 * the header — society names are free text and HTTP header values don't
 * safely support arbitrary characters otherwise.
 *
 * Used by components/brand-eyebrow.tsx, components/auth-hero-photo.tsx,
 * and app/layout.tsx's generateMetadata — all three used to read a
 * single hardcoded SOCIETY_NAME constant (see lib/branding.ts), which
 * meant every tenant's login page, "back to home" link, and browser tab
 * title all showed EVS's name regardless of which society was actually
 * being viewed.
 */
export async function getCurrentSocietyName(): Promise<string> {
  const headersList = await headers();
  const encoded = headersList.get("x-society-name");

  if (!encoded) {
    throw new Error(
      "No society name header found on this request — middleware may not have run for this route."
    );
  }

  return decodeURIComponent(encoded);
}
