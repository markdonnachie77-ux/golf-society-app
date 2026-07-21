import { describe, it, expect } from "vitest";
import { extractSubdomain } from "@/lib/tenant-resolution";

describe("extractSubdomain — no root domain configured (single-tenant deployment)", () => {
  it("returns null for bare localhost — the no-config, single-tenant default", () => {
    expect(extractSubdomain("localhost:3000", undefined)).toBeNull();
    expect(extractSubdomain("localhost", undefined)).toBeNull();
  });

  it("returns null for 127.0.0.1", () => {
    expect(extractSubdomain("127.0.0.1:3000", undefined)).toBeNull();
  });

  it("still extracts a *.localhost subdomain even with no root domain configured", () => {
    // This is deliberate: *.localhost testing works before a platform
    // domain is even decided, let alone configured via env var.
    expect(extractSubdomain("evs-golf-society.localhost:3000", undefined)).toBe(
      "evs-golf-society"
    );
  });

  it("returns null for any other domain when no root domain is configured", () => {
    // No PLATFORM_ROOT_DOMAIN set means nothing outside localhost
    // resolves to a tenant — this is what makes the feature a no-op for
    // an unconfigured single-tenant deployment regardless of what
    // hostname it's actually served from.
    expect(extractSubdomain("evsgolfsociety.co.uk", undefined)).toBeNull();
    expect(extractSubdomain("anything.example.com", undefined)).toBeNull();
  });
});

describe("extractSubdomain — root domain configured", () => {
  const root = "localgolfsociety.co.uk";

  it("returns null for the bare apex domain", () => {
    expect(extractSubdomain("localgolfsociety.co.uk", root)).toBeNull();
  });

  it("returns null for www", () => {
    expect(extractSubdomain("www.localgolfsociety.co.uk", root)).toBeNull();
  });

  it("extracts a real tenant subdomain", () => {
    expect(extractSubdomain("evs.localgolfsociety.co.uk", root)).toBe("evs");
  });

  it("extracts a tenant subdomain with a port (local testing against a configured root)", () => {
    expect(extractSubdomain("evs.localgolfsociety.co.uk:3000", root)).toBe("evs");
  });

  it("is case-insensitive on both hostname and configured root domain", () => {
    expect(extractSubdomain("EVS.LocalGolfSociety.co.uk", root)).toBe("evs");
    expect(extractSubdomain("evs.localgolfsociety.co.uk", "LocalGolfSociety.co.uk")).toBe("evs");
  });

  it("returns null for an unrelated domain — e.g. a tenant's own custom domain", () => {
    // Critical case: this must NOT silently fall back to matching
    // anything. An unrelated domain (like a tenant's custom domain,
    // which isn't handled by this function at all) returns null, same
    // as "unrecognized" — the caller decides what null means, but this
    // function must never guess a tenant for a hostname it doesn't
    // actually recognize as belonging to the root domain.
    expect(extractSubdomain("evsgolfsociety.co.uk", root)).toBeNull();
  });

  it("does not treat a domain that merely CONTAINS the root as a match", () => {
    // e.g. "notlocalgolfsociety.co.uk" must not match root
    // "localgolfsociety.co.uk" just because it ends with similar
    // characters — only an exact "*.localgolfsociety.co.uk" suffix
    // (with the dot) counts.
    expect(extractSubdomain("notlocalgolfsociety.co.uk", root)).toBeNull();
  });

  it("handles a multi-label subdomain (e.g. a sub-tenant path some day)", () => {
    expect(extractSubdomain("docs.evs.localgolfsociety.co.uk", root)).toBe("docs.evs");
  });
});
