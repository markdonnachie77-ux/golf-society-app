import { describe, it, expect } from "vitest";
import {
  allowedRoundTypes,
  holeNumbersForRoundType,
  filterHolesForRoundType,
  roundTypeLabel,
} from "@/lib/round-setup";

describe("allowedRoundTypes", () => {
  it("only allows front_9 for a 9-hole course", () => {
    expect(allowedRoundTypes(9)).toEqual(["front_9"]);
  });

  it("allows all three round types for an 18-hole course", () => {
    expect(allowedRoundTypes(18)).toEqual(["full_18", "front_9", "back_9"]);
  });
});

describe("holeNumbersForRoundType", () => {
  it("returns 1-9 for front_9", () => {
    expect(holeNumbersForRoundType("front_9")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("returns 10-18 for back_9", () => {
    expect(holeNumbersForRoundType("back_9")).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("returns 1-18 for full_18", () => {
    expect(holeNumbersForRoundType("full_18")).toHaveLength(18);
    expect(holeNumbersForRoundType("full_18")[0]).toBe(1);
    expect(holeNumbersForRoundType("full_18")[17]).toBe(18);
  });
});

describe("filterHolesForRoundType", () => {
  const holes = Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, label: `h${i + 1}` }));

  it("filters down to just the back nine, sorted", () => {
    const shuffled = [...holes].reverse();
    const result = filterHolesForRoundType(shuffled, "back_9");
    expect(result.map((h) => h.hole_number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("returns all 18 for full_18", () => {
    expect(filterHolesForRoundType(holes, "full_18")).toHaveLength(18);
  });
});

describe("roundTypeLabel", () => {
  it("labels a 9-hole course's only round as a full round, not 'Front 9'", () => {
    expect(roundTypeLabel("front_9", 9)).toBe("Full round (9 holes)");
  });

  it("labels front_9/back_9 normally for an 18-hole course", () => {
    expect(roundTypeLabel("front_9", 18)).toBe("Front 9");
    expect(roundTypeLabel("back_9", 18)).toBe("Back 9");
    expect(roundTypeLabel("full_18", 18)).toBe("Full round (18 holes)");
  });
});
