import Link from "next/link";
import { Home } from "lucide-react";
import { getCurrentSocietyName } from "@/lib/tenant";

/**
 * Every page renders this at the top — making it a link back to /dashboard
 * gives every page a consistent "back to home" affordance in one place,
 * rather than needing a full nav bar added to each page individually.
 * The Home icon is deliberate: plain small-caps text reads as a label,
 * not a button, and early user feedback specifically flagged there being
 * no obvious way back to the home screen.
 *
 * An async Server Component (not a prop) deliberately — this component
 * has no client-side interactivity at all, so it can fetch the current
 * society's name itself rather than requiring every one of the ~12 pages
 * that render it to fetch and pass it down individually. That's also
 * what fixed the actual bug here: this used to import a single hardcoded
 * SOCIETY_NAME constant (see lib/branding.ts), so every tenant's "back to
 * home" link showed EVS's name regardless of which society was actually
 * being viewed.
 */
export async function BrandEyebrow() {
  const societyName = await getCurrentSocietyName();

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 font-numeral text-xs uppercase tracking-widest text-accent transition-opacity hover:opacity-75"
    >
      <Home className="h-3 w-3" />
      {societyName}
    </Link>
  );
}
