import Link from "next/link";
import { Home } from "lucide-react";
import { SOCIETY_NAME } from "@/lib/branding";

/**
 * Every page renders this at the top — making it a link back to /dashboard
 * gives every page a consistent "back to home" affordance in one place,
 * rather than needing a full nav bar added to each page individually.
 * The Home icon is deliberate: plain small-caps text reads as a label,
 * not a button, and early user feedback specifically flagged there being
 * no obvious way back to the home screen.
 */
export function BrandEyebrow() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 font-numeral text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-75"
    >
      <Home className="h-3 w-3" />
      {SOCIETY_NAME}
    </Link>
  );
}
