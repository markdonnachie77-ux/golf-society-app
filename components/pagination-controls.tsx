import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Deliberately real <Link>s to ?page=N URLs, not a client-side "load
 * more" button — pages stay directly navigable and shareable, work
 * without JS, and don't need any client component state at all. A
 * disabled-looking static span stands in for whichever direction isn't
 * available (page 1 has no Previous, the last page has no Next) — a
 * plain <a> has no native disabled state, so this avoids the awkward
 * combination of that with Radix's asChild/Slot pattern.
 */
export function PaginationControls({
  currentPage,
  totalPages,
  basePath,
  extraParams = {},
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  /** Any other active query params (filters, etc.) to carry over into
   * the Previous/Next links — without this, paging forward/back on a
   * filtered view would silently drop the filter. */
  extraParams?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const disabledClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50");
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  function hrefForPage(page: number) {
    const params = new URLSearchParams(extraParams);
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="mt-6 flex items-center justify-between">
      {currentPage <= 1 ? (
        <span className={disabledClass}>Previous</span>
      ) : (
        <Link href={hrefForPage(currentPage - 1)} className={linkClass}>
          Previous
        </Link>
      )}

      <p className="font-numeral text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>

      {currentPage >= totalPages ? (
        <span className={disabledClass}>Next</span>
      ) : (
        <Link href={hrefForPage(currentPage + 1)} className={linkClass}>
          Next
        </Link>
      )}
    </div>
  );
}
