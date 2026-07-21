import { describe, it, expect } from "vitest";
import {
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
