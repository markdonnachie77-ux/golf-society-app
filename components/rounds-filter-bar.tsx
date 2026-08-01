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

/**
 * Plain native <select>s rather than the searchable PlayerSelect combobox
 * used on the login page — that component was built for "find your own
 * name to log in," a different job than "quickly filter or clear a
 * filter," where a native select's built-in "no selection" option and
 * familiar dropdown behavior are the better fit.
 *
 * Changing a filter navigates to a new URL rather than managing filter
 * state client-side, matching the same URL-is-the-source-of-truth
 * approach as pagination — filters stay bookmarkable/shareable, and
 * PaginationControls' extraParams carries them across Previous/Next.
 * Changing a filter always resets to page 1, since a different filter
 * means a different total page count.
 */
export function RoundsFilterBar({
  players,
  courses,
  selectedPlayerId,
  selectedCourseId,
}: {
  players: PlayerOption[];
  courses: CourseOption[];
  selectedPlayerId?: string;
  selectedCourseId?: string;
}) {
  const router = useRouter();

  function navigate(playerId: string, courseId: string) {
    const params = new URLSearchParams();
    if (playerId) params.set("player", playerId);
    if (courseId) params.set("course", courseId);
    const query = params.toString();
    router.push(query ? `/rounds?${query}` : "/rounds");
  }

  const hasActiveFilter = Boolean(selectedPlayerId || selectedCourseId);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <select
        value={selectedPlayerId ?? ""}
        onChange={(e) => navigate(e.target.value, selectedCourseId ?? "")}
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
        value={selectedCourseId ?? ""}
        onChange={(e) => navigate(selectedPlayerId ?? "", e.target.value)}
        className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => router.push("/rounds")}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
