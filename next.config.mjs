import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Silences the "multiple lockfiles" workspace-root warning by pinning
  // the root explicitly rather than letting Next.js infer it by walking
  // up looking for lockfiles.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
