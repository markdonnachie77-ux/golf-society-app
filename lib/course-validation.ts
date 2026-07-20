/**
 * Pure validation for a course's hole grid. Kept separate from Zod's
 * per-field checks because these are cross-row invariants (the whole set of
 * hole numbers must be exactly {1..N}, same for stroke indices) rather than
 * single-field rules — easier to unit test and to reuse from both the
 * client-side live-validation and the server action.
 *
 * The DB (see supabase/migrations/0003_create_holes.sql) also enforces the
 * range and uniqueness constraints via a trigger + unique indexes, so this
 * isn't the only line of defense — but catching it here gives a much
 * friendlier error message than a raw Postgres constraint violation.
 */

export interface HoleRowInput {
  holeNumber: number;
  par: number;
  strokeIndex: number;
  whiteYards: number | null;
  yellowYards: number | null;
}

export function validateHoleSet(holes: HoleRowInput[], holeCount: 9 | 18): string[] {
  const errors: string[] = [];

  if (holes.length !== holeCount) {
    errors.push(`Expected ${holeCount} holes, got ${holes.length}.`);
    return errors; // further checks assume the right row count
  }

  const expected = new Set(Array.from({ length: holeCount }, (_, i) => i + 1));

  const holeNumbers = holes.map((h) => h.holeNumber);
  if (!setsEqual(new Set(holeNumbers), expected)) {
    errors.push(`Hole numbers must be exactly 1–${holeCount}, each used once.`);
  }

  const strokeIndices = holes.map((h) => h.strokeIndex);
  if (!setsEqual(new Set(strokeIndices), expected)) {
    errors.push(
      `Stroke indices must be exactly 1–${holeCount}, each used once (no repeats, none skipped).`
    );
  }

  holes.forEach((h) => {
    if (![3, 4, 5].includes(h.par)) {
      errors.push(`Hole ${h.holeNumber}: par must be 3, 4, or 5.`);
    }
    if (h.whiteYards !== null && h.whiteYards <= 0) {
      errors.push(`Hole ${h.holeNumber}: white yardage must be positive.`);
    }
    if (h.yellowYards !== null && h.yellowYards <= 0) {
      errors.push(`Hole ${h.holeNumber}: yellow yardage must be positive.`);
    }
  });

  return errors;
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Builds a fresh default hole grid when hole count changes or on first render. */
export function buildDefaultHoles(holeCount: 9 | 18): HoleRowInput[] {
  return Array.from({ length: holeCount }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    strokeIndex: 0, // 0 is intentionally invalid — forces the admin to fill it in
    whiteYards: null,
    yellowYards: null,
  }));
}
