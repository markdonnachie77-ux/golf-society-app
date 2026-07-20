import type { RoundType } from "@/lib/golf-math";

/**
 * A 9-hole course only has holes numbered 1–9, so "front_9" is the only
 * round_type that makes sense for it (there's no back nine to play).
 * An 18-hole course supports all three.
 */
export function allowedRoundTypes(holeCount: 9 | 18): RoundType[] {
  return holeCount === 9 ? ["front_9"] : ["full_18", "front_9", "back_9"];
}

/** Which hole_number values belong to a given round type. */
export function holeNumbersForRoundType(roundType: RoundType): number[] {
  if (roundType === "front_9") return range(1, 9);
  if (roundType === "back_9") return range(10, 18);
  return range(1, 18); // full_18
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export interface HoleLike {
  hole_number: number;
}

/** Filters + sorts a course's holes down to just the ones for this round type. */
export function filterHolesForRoundType<T extends HoleLike>(
  holes: T[],
  roundType: RoundType
): T[] {
  const allowed = new Set(holeNumbersForRoundType(roundType));
  return holes
    .filter((h) => allowed.has(h.hole_number))
    .sort((a, b) => a.hole_number - b.hole_number);
}

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  full_18: "Full round (18 holes)",
  front_9: "Front 9",
  back_9: "Back 9",
};

/**
 * A 9-hole course's only playable round IS its front nine (there's no
 * back nine), so label it as a full round rather than "Front 9" — that
 * phrasing only makes sense in the context of an 18-hole course.
 */
export function roundTypeLabel(roundType: RoundType, holeCount: 9 | 18): string {
  if (holeCount === 9 && roundType === "front_9") return "Full round (9 holes)";
  return ROUND_TYPE_LABELS[roundType];
}
