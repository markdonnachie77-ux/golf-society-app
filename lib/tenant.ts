import "server-only";
import { headers } from "next/headers";

/**
 * Reads the society_id that middleware resolved for this request (see
 * middleware.ts's resolveSociety) from the request header it set.
 *
 * Not yet used anywhere in application code — this exists as the
 * foundation for Phase 3 of the multi-tenant plan (adding society_id
 * filters to every query), not because anything currently needs
 * per-request tenant scoping. Right now there's exactly one society, so
 * every request already resolves to it regardless.
 *
 * Throws rather than silently defaulting if the header is missing,
 * because that should only ever happen if middleware didn't run for this
 * request (a matcher misconfiguration, or code calling this from
 * somewhere middleware doesn't cover) — silently falling back to the
 * default society here would hide exactly the kind of bug that matters
 * most once a second tenant exists.
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
