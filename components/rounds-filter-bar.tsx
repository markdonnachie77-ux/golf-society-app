"use client";

import { useRouter } from "next/navigation";

interface PlayerOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface CourseOption {
  id: string;
  name: string;
}

interface FilterState {
  playerId: string;
  courseId: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
}

/**
 * Plain native <select>s and <input type="date">s rather than a custom
 * combobox/date-picker component — this is a quick filter/clear job, not
 * something that needs more than what the browser already provides well.
 *
 * Changing a filter navigates to a new URL rather than managing filter
 * state client-side, matching the same URL-is-the-source-of-truth
 * approach as pagination — filters stay bookmarkable/shareable, and
 * PaginationControls' extraParams carries them across Previous/Next.
 * Changing a filter always resets to page 1, since a different filter
 * means a different total page count.
 *
 * navigate() takes a partial update and merges it with the OTHER
 * currently-active filters/sort, rather than each filter rebuilding the
 * URL from scratch — the earlier version did that per-filter, which meant
 * changing the player filter silently dropped an active score sort (and
 * vice versa), since neither filter's handler knew the other's current
 * state. Passing every current value in as props and always working from
 * the full current state fixes that class of bug generally, not just for
 * this one filter/sort combination.
 */
export function RoundsFilterBar({
  players,
  courses,
  selectedPlayerId,
  selectedCourseId,
  selectedDateFrom,
  selectedDateTo,
  selectedSort,
}: {
  players: PlayerOption[];
  courses: CourseOption[];
  selectedPlayerId?: string;
  selectedCourseId?: string;
  selectedDateFrom?: string;
  selectedDateTo?: string;
  selectedSort?: string;
}) {
  const router = useRouter();

  const current: FilterState = {
    playerId: selectedPlayerId ?? "",
    courseId: selectedCourseId ?? "",
    dateFrom: selectedDateFrom ?? "",
    dateTo: selectedDateTo ?? "",
    sort: selectedSort ?? "",
  };

  function navigate(update: Partial<FilterState>) {
    const next = { ...current, ...update };
    const params = new URLSearchParams();
    if (next.playerId) params.set("player", next.playerId);
    if (next.courseId) params.set("course", next.courseId);
    if (next.dateFrom) params.set("from", next.dateFrom);
    if (next.dateTo) params.set("to", next.dateTo);
    if (next.sort) params.set("sort", next.sort);
    const query = params.toString();
    router.push(query ? `/rounds?${query}` : "/rounds");
  }

  const hasActiveFilter = Boolean(
    current.playerId || current.courseId || current.dateFrom || current.dateTo
  );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <select
        value={current.playerId}
        onChange={(e) => navigate({ playerId: e.target.value })}
        className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.first_name} {p.last_name}
          </option>
        ))}
      </select>

      <select
        value={current.courseId}
        onChange={(e) => navigate({ courseId: e.target.value })}
        className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <label htmlFor="rounds-date-from" className="text-sm text-muted-foreground">
          From
        </label>
        <input
          id="rounds-date-from"
          type="date"
          value={current.dateFrom}
          max={current.dateTo || undefined}
          onChange={(e) => navigate({ dateFrom: e.target.value })}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="rounds-date-to" className="text-sm text-muted-foreground">
          To
        </label>
        <input
          id="rounds-date-to"
          type="date"
          value={current.dateTo}
          min={current.dateFrom || undefined}
          onChange={(e) => navigate({ dateTo: e.target.value })}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => navigate({ playerId: "", courseId: "", dateFrom: "", dateTo: "" })}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
