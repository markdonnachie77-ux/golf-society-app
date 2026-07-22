import type { Metadata } from "next";
import { Fraunces, Work_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getCurrentSocietyName } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { buildBrandCssVariables } from "@/lib/color";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
});

/**
 * Async, not a static export — the browser tab title, the OG title/
 * description used for social link previews, and metadataBase all used
 * to be hardcoded to EVS specifically (name, and a literal
 * "evsgolfsociety.co.uk" URL). Every tenant's login page, when shared as
 * a link, would show "EVs Golf Society" and resolve relative asset paths
 * against EVS's own domain regardless of which society's link it
 * actually was.
 *
 * metadataBase is derived from the actual incoming request's Host header
 * rather than any stored per-society "domain" field — this correctly
 * handles every case (a *.localsociety.club subdomain, or a tenant's own
 * custom domain like evsgolfsociety.co.uk) with no extra configuration
 * needed per society.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [societyName, settings, headersList] = await Promise.all([
    getCurrentSocietyName(),
    getAppSettings(),
    headers(),
  ]);

  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);

  const description = `${societyName} handicap tracking & scorecards`;

  return {
    metadataBase,
    title: societyName,
    description,
    openGraph: {
      title: societyName,
      description,
      // Omitted entirely (rather than falling back to any hardcoded
      // asset) when this society hasn't uploaded a hero photo — a
      // missing/broken preview image is a smaller problem than showing
      // a photo of a completely different society's members.
      ...(settings.heroPhotoUrl ? { images: [settings.heroPhotoUrl] } : {}),
    },
  };
}

// Every page in this app reads live session state (who's logged in) and/or
// live database data (player lists, handicaps, pending approvals) via
// custom server actions — not via cookies()/headers() calls Next.js
// automatically detects as a "must be dynamic" signal. Without this,
// Next.js defaults to trying to statically pre-render pages at build time,
// which both breaks the build (the Supabase client's env vars aren't
// necessarily available at build time the way they are at request time)
// and would be wrong even if it succeeded — a statically-baked /login page
// would show whatever player list existed at the last deploy, not
// newly-registered members. Setting this in the root layout applies it to
// every route in the app in one place, rather than repeating it in every
// page.tsx.
export const dynamic = "force-dynamic";

/**
 * Per-society brand colors (Primary/Secondary/Accent, set at
 * /admin/settings) are applied here rather than in globals.css, since
 * globals.css is one static file shared by every tenant. Light-mode
 * values go on the <html> element's inline `style` so they win over the
 * stylesheet's :root defaults unconditionally (inline style always beats
 * an external/embedded stylesheet, regardless of load order). Dark-mode
 * values go in a `.dark`-scoped <style> tag instead, since there's no
 * single element to attach them to directly — harmless that this app has
 * no dark-mode toggle wired up yet (see globals.css's dormant `.dark`
 * rules): the override just sits inert alongside them until one exists.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getAppSettings();
  const brandCss = settings.brandColors ? buildBrandCssVariables(settings.brandColors) : null;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      style={brandCss?.light as React.CSSProperties}
    >
      {brandCss && (
        <head>
          <style
            dangerouslySetInnerHTML={{
              __html: `.dark{${Object.entries(brandCss.dark)
                .map(([prop, value]) => `${prop}:${value};`)
                .join("")}}`,
            }}
          />
        </head>
      )}
      <body>{children}</body>
    </html>
  );
}
