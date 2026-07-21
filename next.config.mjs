import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Origins this dev/prod server trusts for cross-origin requests and
// Server Action redirects. Without this, Next.js's Server Action redirect
// handling falls back to the server's default origin (localhost:3000)
// instead of preserving whichever tenant subdomain the request actually
// came in on — this is what was causing logout to land on plain
// localhost:3000 instead of staying on e.g. test-society.localhost:3000.
// (Next.js tightened this deliberately as a security fix for a real SSRF
// vulnerability where Server Actions used to trust the Host header
// blindly — the fix requires an explicit allowlist instead.)
const allowedOrigins = [
  "localhost:3000",
  "*.localhost:3000",
];

if (process.env.PLATFORM_ROOT_DOMAIN) {
  allowedOrigins.push(process.env.PLATFORM_ROOT_DOMAIN);
  allowedOrigins.push(`*.${process.env.PLATFORM_ROOT_DOMAIN}`);
}

// EVS's own production domain — hardcoded here the same way it's
// hardcoded in app/layout.tsx's metadataBase, for consistency.
allowedOrigins.push("evsgolfsociety.co.uk", "www.evsgolfsociety.co.uk");

// next/image refuses to load any remote image whose domain isn't
// explicitly allowlisted — needed now that uploaded hero photos (see
// app/actions/settings.ts's uploadHeroPhoto) are served from Supabase
// Storage's public URL rather than a local /public asset. Derived from
// SUPABASE_URL rather than hardcoded, so this works automatically for
// both the local Docker stack (http://127.0.0.1:54321) and the hosted
// production project (https://<ref>.supabase.co) without needing a
// separate config value to keep in sync.
const remotePatterns = [];
if (process.env.SUPABASE_URL) {
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  remotePatterns.push({
    protocol: supabaseUrl.protocol.replace(":", ""),
    hostname: supabaseUrl.hostname,
    port: supabaseUrl.port || undefined,
    pathname: "/storage/v1/object/public/**",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: allowedOrigins,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  images: {
    remotePatterns,
  },
};

export default nextConfig;