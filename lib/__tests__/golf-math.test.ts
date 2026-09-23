import { describe, it, expect } from "vitest";
import {
  computeCourseHandicap,
  roundHandicapForAllocation,
  strokesReceivedOnHole,
  netStrokesForHole,
  stablefordPointsForHole,
  computeHoleResult,
  summarizeRound,
  computeRound,
  targetStablefordPoints,
  proposedHandicapChange,
} from "@/lib/golf-math";

describe("computeCourseHandicap", () => {
  it("matches the standard WHS reference example", () => {
    // Handicap Index 10.5, Slope 130, Course Rating 71.5, Par 72
    expect(computeCourseHandicap(10.5, 130, 71.5, 72)).toBe(12);
  });

  it("gives 0 for a scratch golfer on an average-slope course where rating equals par", () => {
    expect(computeCourseHandicap(0, 113, 72, 72)).toBe(0);
  });

  it("leaves the handicap unchanged at average slope with rating=par", () => {
    expect(computeCourseHandicap(18, 113, 70, 70)).toBe(18);
  });

  it("increases the course handicap for a harder-than-average slope", () => {
    expect(computeCourseHandicap(18, 140, 70, 70)).toBeGreaterThan(18);
  });

  it("decreases the course handicap for an easier-than-average slope", () => {
    expect(computeCourseHandicap(18, 100, 70, 70)).toBeLessThan(18);
  });

  it("handles plus (negative) handicap players", () => {
    expect(computeCourseHandicap(-2, 113, 72, 72)).toBe(-2);
  });
});

describe("roundHandicapForAllocation", () => {
  it("rounds half-up", () => {
    expect(roundHandicapForAllocation(18.4)).toBe(18);
    expect(roundHandicapForAllocation(18.5)).toBe(19);
    expect(roundHandicapForAllocation(18.6)).toBe(19);
  });

  it("handles plus (negative) handicaps", () => {
    expect(roundHandicapForAllocation(-2.4)).toBe(-2);
  });
});

describe("strokesReceivedOnHole — 18-hole rounds", () => {
  it("gives zero strokes everywhere for H=0", () => {
    for (let si = 1; si <= 18; si++) {
      expect(strokesReceivedOnHole(0, si, "full_18")).toBe(0);
    }
  });

  it("gives exactly one stroke per hole when H is an exact multiple of 18", () => {
    for (let si = 1; si <= 18; si++) {
      expect(strokesReceivedOnHole(18, si, "full_18")).toBe(1);
    }
  });

  it("gives the base stroke plus one extra on the lowest-SI holes for H=19", () => {
    expect(strokesReceivedOnHole(19, 1, "full_18")).toBe(2); // SI 1 <= (19 % 18 = 1)
    expect(strokesReceivedOnHole(19, 2, "full_18")).toBe(1); // SI 2 > 1
    expect(strokesReceivedOnHole(19, 18, "full_18")).toBe(1);
  });

  it("gives two strokes per hole for H=36", () => {
    for (let si = 1; si <= 18; si++) {
      expect(strokesReceivedOnHole(36, si, "full_18")).toBe(2);
    }
  });

  it("splits strokes correctly for a mid-range handicap (H=10)", () => {
    // base = floor(10/18) = 0; extra on SI 1..10
    for (let si = 1; si <= 10; si++) {
      expect(strokesReceivedOnHole(10, si, "full_18")).toBe(1);
    }
    for (let si = 11; si <= 18; si++) {
      expect(strokesReceivedOnHole(10, si, "full_18")).toBe(0);
    }
  });

  it("handles a plus handicap (H=-2) by removing a stroke on the hardest holes", () => {
    // base = floor(-2/18) = -1; extra (+1) on SI <= mod(-2,18) = 16
    expect(strokesReceivedOnHole(-2, 1, "full_18")).toBe(0); // -1 + 1
    expect(strokesReceivedOnHole(-2, 16, "full_18")).toBe(0);
    expect(strokesReceivedOnHole(-2, 17, "full_18")).toBe(-1); // no extra
    expect(strokesReceivedOnHole(-2, 18, "full_18")).toBe(-1);
  });
});

describe("strokesReceivedOnHole — 9-hole rounds", () => {
  it("halves the handicap before applying the 9-hole formula (H=20 -> H9=10)", () => {
    // H9 = floor(20/2) = 10; base = floor(10/9) = 1; extra on SI <= mod(10,9) = 1
    expect(strokesReceivedOnHole(20, 1, "front_9")).toBe(2);
    expect(strokesReceivedOnHole(20, 2, "front_9")).toBe(1);
    expect(strokesReceivedOnHole(20, 9, "back_9")).toBe(1);
  });

  it("handles a low 9-hole handicap (H=9 -> H9=4)", () => {
    // base = floor(4/9) = 0; extra on SI <= 4
    for (let si = 1; si <= 4; si++) {
      expect(strokesReceivedOnHole(9, si, "front_9")).toBe(1);
    }
    for (let si = 5; si <= 9; si++) {
      expect(strokesReceivedOnHole(9, si, "front_9")).toBe(0);
    }
  });
});

describe("stablefordPointsForHole", () => {
  const par = 4;

  it.each([
    [1, 5], // net -3 (albatross or better)
    [2, 4], // eagle
    [3, 3], // birdie
    [4, 2], // par
    [5, 1], // bogey
    [6, 0], // double bogey
    [9, 0], // way worse — still floors at 0
  ])("net strokes %i against par 4 scores %i points", (netStrokes, expectedPoints) => {
    expect(stablefordPointsForHole(netStrokes, par)).toBe(expectedPoints);
  });

  it("treats better than albatross (condor) the same as albatross", () => {
    expect(stablefordPointsForHole(0, par)).toBe(5); // net -4
  });
});

describe("netStrokesForHole", () => {
  it("subtracts strokes received from gross", () => {
    expect(netStrokesForHole(5, 1)).toBe(4);
    expect(netStrokesForHole(5, 0)).toBe(5);
    expect(netStrokesForHole(5, -1)).toBe(6); // plus-handicap hole
  });
});

describe("computeHoleResult / summarizeRound / computeRound", () => {
  const holes = [
    { holeId: "h1", par: 4, strokeIndex: 1, grossStrokes: 5, pickedUp: false }, // H=10 -> 1 stroke -> net 4 -> 2pts
    { holeId: "h2", par: 3, strokeIndex: 15, grossStrokes: 3, pickedUp: false }, // H=10, SI15>10 -> 0 strokes -> net 3 -> 2pts
    { holeId: "h3", par: 5, strokeIndex: 5, grossStrokes: 5, pickedUp: false }, // H=10, SI5<=10 -> 1 stroke -> net 4 -> 3pts (birdie)
  ];

  it("computes each hole correctly and sums to the round total", () => {
    const { holeResults, summary } = computeRound(holes, 10, "full_18");

    expect(holeResults[0]).toMatchObject({ strokesReceived: 1, netStrokes: 4, stablefordPoints: 2 });
    expect(holeResults[1]).toMatchObject({ strokesReceived: 0, netStrokes: 3, stablefordPoints: 2 });
    expect(holeResults[2]).toMatchObject({ strokesReceived: 1, netStrokes: 4, stablefordPoints: 3 });

    expect(summary).toEqual({
      totalGrossStrokePlay: 13,
      totalNetStrokePlay: 11,
      totalStablefordPoints: 7,
      holesPickedUp: 0,
    });
  });

  it("summarizeRound matches computeRound's own summary for the same holes", () => {
    const holeResults = holes.map((h) => computeHoleResult(h, 10, "full_18"));
    expect(summarizeRound(holeResults)).toEqual(computeRound(holes, 10, "full_18").summary);
  });
});

describe("picked-up (blob) holes", () => {
  it("scores 0 points and has null gross/net strokes when picked up", () => {
    const result = computeHoleResult(
      { holeId: "h1", par: 4, strokeIndex: 1, grossStrokes: null, pickedUp: true },
      10,
      "full_18"
    );
    expect(result).toMatchObject({
      grossStrokes: null,
      netStrokes: null,
      stablefordPoints: 0,
      pickedUp: true,
    });
    // strokesReceived is still computed (harmless, just unused for scoring)
    expect(result.strokesReceived).toBe(1);
  });

  it("throws if a hole is neither picked up nor has a gross score — a caller bug, not a valid state", () => {
    expect(() =>
      computeHoleResult(
        { holeId: "h1", par: 4, strokeIndex: 1, grossStrokes: null, pickedUp: false },
        10,
        "full_18"
      )
    ).toThrow();
  });

  it("excludes picked-up holes from gross/net totals but still counts 0 Stableford points, and tracks the pick-up count", () => {
    const holes = [
      { holeId: "h1", par: 4, strokeIndex: 1, grossStrokes: 5, pickedUp: false }, // completed: 2pts (see fixture above)
      { holeId: "h2", par: 3, strokeIndex: 15, grossStrokes: null, pickedUp: true }, // picked up: 0pts, no gross/net
      { holeId: "h3", par: 5, strokeIndex: 5, grossStrokes: 5, pickedUp: false }, // completed: 3pts (birdie, see fixture above)
    ];

    const { summary } = computeRound(holes, 10, "full_18");

    expect(summary).toEqual({
      totalGrossStrokePlay: 10, // only h1 (5) + h3 (5), h2 excluded
      totalNetStrokePlay: 8, // only h1 (4) + h3 (4), h2 excluded
      totalStablefordPoints: 5, // h1 (2) + h2 (0) + h3 (3)
      holesPickedUp: 1,
    });
  });

  it("a round entirely of pick-ups scores 0 points and 0 totals with the pick-up count matching hole count", () => {
    const holes = [
      { holeId: "h1", par: 4, strokeIndex: 1, grossStrokes: null, pickedUp: true },
      { holeId: "h2", par: 4, strokeIndex: 2, grossStrokes: null, pickedUp: true },
    ];
    const { summary } = computeRound(holes, 10, "full_18");
    expect(summary).toEqual({
      totalGrossStrokePlay: 0,
      totalNetStrokePlay: 0,
      totalStablefordPoints: 0,
      holesPickedUp: 2,
    });
  });
});

describe("targetStablefordPoints", () => {
  it("is 36 for a full 18-hole round and 18 for a 9-hole round", () => {
    expect(targetStablefordPoints("full_18")).toBe(36);
    expect(targetStablefordPoints("front_9")).toBe(18);
    expect(targetStablefordPoints("back_9")).toBe(18);
  });
});

describe("proposedHandicapChange", () => {
  const standardCourse = { handicapCutPerPoint: 0.2, handicapIncreasePerPoint: 0.1 };

  it("cuts the handicap when points beat the target (18-hole)", () => {
    // 40 points vs target 36 -> diff 4 -> -(4 * 0.2)
    expect(proposedHandicapChange(40, "full_18", standardCourse)).toBeCloseTo(-0.8);
  });

  it("increases the handicap when points fall short of the target", () => {
    // 30 points vs target 36 -> diff -6 -> 6 * 0.1
    expect(proposedHandicapChange(30, "full_18", standardCourse)).toBeCloseTo(0.6);
  });

  it("proposes no change when points exactly hit the target", () => {
    expect(proposedHandicapChange(36, "full_18", standardCourse)).toBe(0);
  });

  it("respects a course's custom (steeper) cut rate", () => {
    const steepCourse = { handicapCutPerPoint: 0.5, handicapIncreasePerPoint: 0.1 };
    // 40 points vs target 36 -> diff 4 -> -(4 * 0.5)
    expect(proposedHandicapChange(40, "full_18", steepCourse)).toBeCloseTo(-2.0);
  });

  it("respects a course with a buffered (zero) increase rate", () => {
    const bufferedCourse = { handicapCutPerPoint: 0.2, handicapIncreasePerPoint: 0 };
    expect(proposedHandicapChange(30, "full_18", bufferedCourse)).toBe(0);
  });

  it("scales correctly for 9-hole rounds against the 18-point target", () => {
    // 20 points vs target 18 -> diff 2 -> -(2 * 0.2)
    expect(proposedHandicapChange(20, "front_9", standardCourse)).toBeCloseTo(-0.4);
  });

  it("rounds to two decimal places", () => {
    const oddRateCourse = { handicapCutPerPoint: 0.15, handicapIncreasePerPoint: 0.1 };
    // 39 points vs target 36 -> diff 3 -> -(3 * 0.15) = -0.45
    expect(proposedHandicapChange(39, "full_18", oddRateCourse)).toBe(-0.45);
  });

});

describe("proposedHandicapChange — cutTargetOverride", () => {
  const standardCourse = { handicapCutPerPoint: 0.2, handicapIncreasePerPoint: 0.1 };

  it("undefined/null override behaves identically to no override at all", () => {
    const withUndefined = proposedHandicapChange(40, "full_18", standardCourse, undefined);
    const withNull = proposedHandicapChange(40, "full_18", standardCourse, null);
    const withoutParam = proposedHandicapChange(40, "full_18", standardCourse);
    expect(withUndefined).toBe(withoutParam);
    expect(withNull).toBe(withoutParam);
  });

  it("cut wins in the gap: a lowered override cuts a score that would otherwise have increased", () => {
    // Cut target 33, standard target 36. Score 34: above 33 (cut), but
    // also below 36 (would look increase-eligible under the old single-
    // target system) — cut must win, per the user's explicit, confirmed
    // decision, not increase.
    // diff = 34 - 33 = 1 -> -(1 * 0.2)
    expect(proposedHandicapChange(34, "full_18", standardCourse, 33)).toBeCloseTo(-0.2);
  });

  it("increase still anchors to the standard target (36), completely unaware of a lowered cut override", () => {
    // Score 30, well below both 33 and 36 -> increase, based on the
    // STANDARD target (36), not the override (33).
    // diff = 36 - 30 = 6 -> 6 * 0.1
    expect(proposedHandicapChange(30, "full_18", standardCourse, 33)).toBeCloseTo(0.6);
  });

  it("a lowered override changes the CUT basis too, not just which scores get cut", () => {
    // Score 40 with override 33 -> cut basis is 33, not 36.
    // diff = 40 - 33 = 7 -> -(7 * 0.2), NOT -(4 * 0.2) as it would be
    // without the override.
    expect(proposedHandicapChange(40, "full_18", standardCourse, 33)).toBeCloseTo(-1.4);
  });

  it("exactly at the lowered override falls through to the (still-standard) increase check", () => {
    // Score 33 exactly, override 33: 33 is NOT > 33 (strict inequality,
    // matching the pre-existing convention for exact-target scores), so
    // this doesn't cut. It IS < 36, so it increases, anchored to 36.
    // diff = 36 - 33 = 3 -> 3 * 0.1
    expect(proposedHandicapChange(33, "full_18", standardCourse, 33)).toBeCloseTo(0.3);
  });

  it("a raised override creates a dead zone between 36 and the override where nothing happens", () => {
    // Override 40. Score 38: not > 40 (no cut), not < 36 (no increase
    // either, since increase is unaffected by the raised cut override) -> 0.
    expect(proposedHandicapChange(38, "full_18", standardCourse, 40)).toBe(0);
  });

  it("a raised override still cuts once a score clears it, using the raised value as the basis", () => {
    // Override 40. Score 42: diff = 42 - 40 = 2 -> -(2 * 0.2)
    expect(proposedHandicapChange(42, "full_18", standardCourse, 40)).toBeCloseTo(-0.4);
  });

  it("a raised override leaves the increase side completely unchanged", () => {
    // Override 40. Score 30: still increases based on the standard 36,
    // exactly as if the override didn't exist.
    // diff = 36 - 30 = 6 -> 6 * 0.1
    expect(proposedHandicapChange(30, "full_18", standardCourse, 40)).toBeCloseTo(0.6);
  });

  it("scales the override proportionally for a 9-hole round, same ratio as the standard target's own 36->18 scaling", () => {
    // Override 33 expressed at the 18-hole scale -> effective cut target
    // for a 9-hole round is 33 * (18/36) = 16.5. Score 18 on the front 9:
    // diff = 18 - 16.5 = 1.5 -> -(1.5 * 0.2)
    expect(proposedHandicapChange(18, "front_9", standardCourse, 33)).toBeCloseTo(-0.3);
  });

  it("a 9-hole score below the scaled override but below the scaled standard target (18) still increases normally", () => {
    // Override 33 -> scaled cut target 16.5 for 9 holes. Score 14: not >
    // 16.5 (no cut), IS < 18 (standard 9-hole target) -> increase,
    // anchored to 18, not 16.5.
    // diff = 18 - 14 = 4 -> 4 * 0.1
    expect(proposedHandicapChange(14, "front_9", standardCourse, 33)).toBeCloseTo(0.4);
  });
});

describe("proposedHandicapChange — increaseTarget (gate, not cap)", () => {
  const standardCourse = { handicapCutPerPoint: 0.2, handicapIncreasePerPoint: 0.1 };

  it("undefined/null increaseTarget behaves identically to no override at all", () => {
    const withUndefined = proposedHandicapChange(9, "full_18", standardCourse, null, undefined);
    const withNull = proposedHandicapChange(9, "full_18", standardCourse, null, null);
    const withoutParam = proposedHandicapChange(9, "full_18", standardCourse);
    expect(withUndefined).toBe(withoutParam);
    expect(withNull).toBe(withoutParam);
  });

  it("the exact motivating case: a very low score (9) increases by the full gap to 36 with no threshold set", () => {
    // Confirms the ORIGINAL problem this feature addresses is still the
    // default, unmodified behavior when no threshold is configured —
    // 36 - 9 = 27 -> 27 * 0.1
    expect(proposedHandicapChange(9, "full_18", standardCourse)).toBeCloseTo(2.7);
  });

  it("with a threshold of 20, that same score of 9 increases by the smaller gap to 20, not to 36", () => {
    // 20 - 9 = 11 -> 11 * 0.1, not 27 * 0.1
    expect(proposedHandicapChange(9, "full_18", standardCourse, null, 20)).toBeCloseTo(1.1);
  });

  it("GATE confirmed directly with the user: a mediocre-but-not-extreme score (30) gets NO increase at all once the threshold is 20 — not a smaller increase, none", () => {
    // 30 is not < 20, so no increase fires at all. Without the
    // threshold this would have been (36-30)*0.1 = 0.6 — confirming the
    // gate actually changes behavior here, not just for extreme scores.
    expect(proposedHandicapChange(30, "full_18", standardCourse, null, 20)).toBe(0);
  });

  it("exactly at the threshold does not increase (strict inequality, same convention as the standard target)", () => {
    expect(proposedHandicapChange(20, "full_18", standardCourse, null, 20)).toBe(0);
  });

  it("a score just below the threshold does increase, by the small gap to the threshold", () => {
    // 19 < 20 -> (20-19)*0.1
    expect(proposedHandicapChange(19, "full_18", standardCourse, null, 20)).toBeCloseTo(0.1);
  });

  it("is completely independent of cutTargetOverride — setting one does not affect the other's behavior", () => {
    // Cut target lowered to 33 AND increase threshold lowered to 20,
    // together. Score 25: not > 33 (no cut), not < 20 (no increase
    // either, gated) -> 0. Neither override interferes with the other.
    expect(proposedHandicapChange(25, "full_18", standardCourse, 33, 20)).toBe(0);
    // Score 40 with both overrides set -> still cut normally, using
    // cutTarget=33, completely unaffected by increaseTarget=20 being set.
    // diff = 40-33=7 -> -(7*0.2)
    expect(proposedHandicapChange(40, "full_18", standardCourse, 33, 20)).toBeCloseTo(-1.4);
    // Score 15 with both set -> still increases normally using
    // increaseTarget=20, completely unaffected by cutTarget=33 being set.
    // diff = 20-15=5 -> 5*0.1
    expect(proposedHandicapChange(15, "full_18", standardCourse, 33, 20)).toBeCloseTo(0.5);
  });

  it("scales the threshold proportionally for a 9-hole round, same ratio as cutTargetOverride's own scaling", () => {
    // Threshold 20 at 18-hole scale -> scaled to 10 for a 9-hole round.
    // Score 8 on the front 9: 8 < 10 -> (10-8)*0.1
    expect(proposedHandicapChange(8, "front_9", standardCourse, null, 20)).toBeCloseTo(0.2);
  });

  it("a 9-hole score between the scaled threshold and the scaled standard target (18) gets no increase, matching the gate behavior at full scale", () => {
    // Threshold 20 -> scaled to 10 for 9 holes. Score 14: not < 10 (no
    // increase, gated) even though 14 < 18 (the standard 9-hole target).
    expect(proposedHandicapChange(14, "front_9", standardCourse, null, 20)).toBe(0);
  });

  it("raising the threshold above 36 alone has NO effect on any score, since the cut check (still at standard 36) intercepts everything above 36 first", () => {
    // Threshold raised to 40, but cutTargetOverride is null so the cut
    // target stays at the standard 36. Score 38 is above 36, so the CUT
    // check fires first and the increase check (which would have used
    // the raised 40) never even runs. This is a real, non-obvious
    // consequence of "cut checked first" — raising increaseTarget only
    // has an effect if cutTarget is ALSO raised to match, otherwise the
    // gap between 36 and the raised threshold is unreachable, always
    // claimed by the cut side first.
    // diff = 38-36=2 -> -(2*0.2), the ordinary cut, unaffected by the
    // increase threshold having been raised.
    expect(proposedHandicapChange(38, "full_18", standardCourse, null, 40)).toBeCloseTo(-0.4);
  });

  it("raising BOTH thresholds together does let a score in the new gap increase, confirming the interception above is about the cut target specifically, not a general limitation", () => {
    // Both cutTarget and increaseTarget raised to 40 together. Score 38
    // is no longer above the (now-raised) cut target, so it reaches the
    // increase check, which uses the equally-raised 40.
    // diff = 40-38=2 -> 2*0.1
    expect(proposedHandicapChange(38, "full_18", standardCourse, 40, 40)).toBeCloseTo(0.2);
  });
});

