/**
 * Pure hostname/subdomain parsing for multi-tenant resolution. No I/O —
 * the actual database lookup (slug -> society) lives in middleware.ts,
 * which needs Edge-runtime-safe fetch rather than importing anything
 * from lib/supabase/server.ts (see the comment at the top of
 * middleware.ts for why). This file is just the string logic, which is
 * exactly the kind of thing worth getting right and testing thoroughly —
 * a parsing bug here is a tenant-isolation bug, not just a cosmetic one.
 */

/**
 * Extracts the tenant subdomain from a request's hostname, or null if
 * there isn't one (apex domain, www, bare localhost/127.0.0.1 — all mean
 * "use the default society"). Deliberately simple exact-suffix matching
 * against ONE configured root domain, not a general-purpose public-
 * suffix-list parser — correct for "one known platform domain", which is
 * exactly what this needs, not for arbitrary domains.
 *
 * Returns null (not the root domain's own tenant) for anything that
 * doesn't match a recognized pattern — including what's likely a
 * tenant's own custom domain (e.g. evsgolfsociety.co.uk), since custom-
 * domain-to-society mapping isn't built yet. The caller decides what
 * "null" means (fall back to default vs. reject) — this function only
 * parses, it doesn't decide policy.
 */
export function extractSubdomain(hostname: string, rootDomain: string | undefined): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  // Local dev: "something.localhost:3000" resolves to 127.0.0.1 in every
  // modern browser with zero /etc/hosts editing, letting you test
  // subdomain resolution before PLATFORM_ROOT_DOMAIN is configured or a
  // real platform domain even exists yet.
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return sub === "" ? null : sub;
  }
  if (host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  if (!rootDomain) return null;

  const root = rootDomain.toLowerCase();
  if (host === root || host === `www.${root}`) return null;
  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(`.${root}`.length));
    return sub === "" ? null : sub;
  }

  return null;
}
