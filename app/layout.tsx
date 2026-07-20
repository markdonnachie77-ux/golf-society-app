import type { Metadata } from "next";
import { Fraunces, Work_Sans, JetBrains_Mono } from "next/font/google";
import { SOCIETY_NAME } from "@/lib/branding";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://evsgolfsociety.co.uk"),
  title: SOCIETY_NAME,
  description: `${SOCIETY_NAME} handicap tracking & scorecards`,
  openGraph: {
    title: SOCIETY_NAME,
    description: `${SOCIETY_NAME} handicap tracking & scorecards`,
    images: ["/branding/society-photo.png"],
  },
};

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
