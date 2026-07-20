/**
 * Pure, side-effect-free golf scoring math. No Supabase, no I/O — every
 * function here takes plain values in and returns plain values out, so it's
 * fully unit-testable (see golf-math.test.ts) and safe to reuse for both the
 * live scorecard preview (client) and the final calculation on submit
 * (server action), from the same source of truth.
 *
 * Formulas follow SPEC.md section 4 exactly, with two assumptions the spec
 * doesn't pin down explicitly — flagged inline below with ASSUMPTION.
 */

export type RoundType = "full_18" | "front_9" | "back_9";

// ---------------------------------------------------------------------------
// Stroke allocation
// ---------------------------------------------------------------------------

/**
 * ASSUMPTION: the spec's floor()/mod formulas only make sense for an integer
 * handicap, but `playing_handicap` is stored as a decimal (matches
 * `current_handicap`, e.g. 18.4). Standard handicap allocation rounds to the
 * nearest whole number first (round-half-up, matching WHS convention) — so
 * that's what this does. If your society's rules round differently
 * (round-half-to-even, always-down, etc.), change only this function.
 */
export function roundHandicapForAllocation(handicap: number): number {
  return Math.round(handicap);
}

/**
 * Extra strokes received on a single hole, given the (rounded) Playing
 * Handicap and that hole's Stroke Index. Implements SPEC.md section 4's
 * 18-hole and 9-hole formulas.
 */
export function strokesReceivedOnHole(
  playingHandicap: number,
  strokeIndex: number,
  roundType: RoundType
): number {
  const H = roundHandicapForAllocation(playingHandicap);

  if (roundType === "full_18") {
    const base = Math.floor(H / 18);
    const extra = strokeIndex <= mod(H, 18) ? 1 : 0;
    return base + extra;
  }

  // front_9 / back_9
  const H9 = Math.floor(H / 2);
  const base = Math.floor(H9 / 9);
  const extra = strokeIndex <= mod(H9, 9) ? 1 : 0;
  return base + extra;
}

/** JS's `%` returns negative results for negative inputs; golf handicaps can
 * legitimately be negative ("plus" handicaps), so this normalizes to the
 * mathematical modulo the spec's formulas assume. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ---------------------------------------------------------------------------
// Net score & Stableford points
// ---------------------------------------------------------------------------

export function netStrokesForHole(grossStrokes: number, strokesReceived: number): number {
  return grossStrokes - strokesReceived;
}

/**
 * ASSUMPTION: the spec's table stops at "Net Albatross (-3) = 5 points" and
 * doesn't say what happens below that (a net condor, -4, is vanishingly
 * rare but not impossible on a par 5 with strokes). This treats anything
 * -3 or better as 5 points — i.e. extends the top of the table flat rather
 * than continuing +1 point per stroke, since the spec gives no rate for it.
 * Change the `<= -3` branch if your society wants points to keep climbing.
 */
export function stablefordPointsForHole(netStrokes: number, par: number): number {
  const netToPar = netStrokes - par;

  if (netToPar <= -3) return 5; // albatross or better
  if (netToPar === -2) return 4; // eagle
  if (netToPar === -1) return 3; // birdie
  if (netToPar === 0) return 2; // par
  if (netToPar === 1) return 1; // bogey
  return 0; // double bogey or worse
}

export interface HoleInput {
  holeId: string;
  par: number;
  strokeIndex: number;
  grossStrokes: number;
}

export interface HoleResult {
  holeId: string;
  grossStrokes: number;
  strokesReceived: number;
  netStrokes: number;
  stablefordPoints: number;
}

/** Computes the full per-hole breakdown for one hole of a round. */
export function computeHoleResult(
  hole: HoleInput,
  playingHandicap: number,
  roundType: RoundType
): HoleResult {
  const strokesReceived = strokesReceivedOnHole(playingHandicap, hole.strokeIndex, roundType);
  const netStrokes = netStrokesForHole(hole.grossStrokes, strokesReceived);
  const stablefordPoints = stablefordPointsForHole(netStrokes, hole.par);

  return {
    holeId: hole.holeId,
    grossStrokes: hole.grossStrokes,
    strokesReceived,
    netStrokes,
    stablefordPoints,
  };
}

export interface RoundSummary {
  totalGrossStrokePlay: number;
  totalNetStrokePlay: number;
  totalStablefordPoints: number;
}

/** Sums a full set of per-hole results into the scorecard-level totals. */
export function summarizeRound(holeResults: HoleResult[]): RoundSummary {
  return holeResults.reduce<RoundSummary>(
    (acc, h) => ({
      totalGrossStrokePlay: acc.totalGrossStrokePlay + h.grossStrokes,
      totalNetStrokePlay: acc.totalNetStrokePlay + h.netStrokes,
      totalStablefordPoints: acc.totalStablefordPoints + h.stablefordPoints,
    }),
    { totalGrossStrokePlay: 0, totalNetStrokePlay: 0, totalStablefordPoints: 0 }
  );
}

/** Computes every hole result plus the round summary in one call — this is
 * what both the live preview and the submit action should use. */
export function computeRound(
  holes: HoleInput[],
  playingHandicap: number,
  roundType: RoundType
): { holeResults: HoleResult[]; summary: RoundSummary } {
  const holeResults = holes.map((h) => computeHoleResult(h, playingHandicap, roundType));
  return { holeResults, summary: summarizeRound(holeResults) };
}

// ---------------------------------------------------------------------------
// Course-specific handicap adjustment
// ---------------------------------------------------------------------------

/** 36 for a full 18-hole round, 18 for a 9-hole round (front or back). */
export function targetStablefordPoints(roundType: RoundType): number {
  return roundType === "full_18" ? 36 : 18;
}

export interface CourseRates {
  handicapCutPerPoint: number;
  handicapIncreasePerPoint: number;
}

/**
 * Proposed handicap change from a round's Stableford total, using the
 * course's own cut/increase rates. Negative = handicap decreases (player
 * beat the course), positive = handicap increases.
 *
 * Rounded to 2 decimal places (matches the `numeric(4,2)` column) using
 * round-half-away-from-zero on cents to avoid binary float artifacts like
 * 0.1 + 0.2 !== 0.3.
 */
export function proposedHandicapChange(
  totalStablefordPoints: number,
  roundType: RoundType,
  course: CourseRates
): number {
  const target = targetStablefordPoints(roundType);
  const pointDifference = totalStablefordPoints - target;

  let change: number;
  if (pointDifference > 0) {
    change = -(pointDifference * course.handicapCutPerPoint);
  } else if (pointDifference < 0) {
    change = Math.abs(pointDifference) * course.handicapIncreasePerPoint;
  } else {
    change = 0;
  }

  return roundToTwoDecimals(change);
}

function roundToTwoDecimals(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
