import { describe, it, expect } from "vitest";
import { validateHoleSet, buildDefaultHoles, type HoleRowInput } from "@/lib/course-validation";

function validNineHoles(): HoleRowInput[] {
  return Array.from({ length: 9 }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    strokeIndex: 9 - i, // some permutation of 1..9
    whiteYards: 300,
    yellowYards: 280,
  }));
}

describe("validateHoleSet", () => {
  it("accepts a valid 9-hole set", () => {
    expect(validateHoleSet(validNineHoles(), 9)).toEqual([]);
  });

  it("rejects the wrong number of rows", () => {
    const holes = validNineHoles().slice(0, 8);
    expect(validateHoleSet(holes, 9)).toEqual(["Expected 9 holes, got 8."]);
  });

  it("rejects a duplicate stroke index", () => {
    const holes = validNineHoles();
    holes[1].strokeIndex = holes[0].strokeIndex; // duplicate
    const errors = validateHoleSet(holes, 9);
    expect(errors.some((e) => e.includes("Stroke indices"))).toBe(true);
  });

  it("rejects a stroke index out of range", () => {
    const holes = validNineHoles();
    holes[0].strokeIndex = 15; // out of 1..9 range
    const errors = validateHoleSet(holes, 9);
    expect(errors.some((e) => e.includes("Stroke indices"))).toBe(true);
  });

  it("rejects a duplicate hole number", () => {
    const holes = validNineHoles();
    holes[1].holeNumber = holes[0].holeNumber;
    const errors = validateHoleSet(holes, 9);
    expect(errors.some((e) => e.includes("Hole numbers"))).toBe(true);
  });

  it("rejects an invalid par", () => {
    const holes = validNineHoles();
    holes[0].par = 6;
    const errors = validateHoleSet(holes, 9);
    expect(errors.some((e) => e.includes("par must be 3, 4, or 5"))).toBe(true);
  });

  it("rejects non-positive yardage but allows null yardage", () => {
    const holes = validNineHoles();
    holes[0].whiteYards = 0;
    holes[1].yellowYards = null; // allowed — yardage is optional
    const errors = validateHoleSet(holes, 9);
    expect(errors.some((e) => e.includes("white yardage"))).toBe(true);
  });

  it("accepts a valid 18-hole set", () => {
    const holes: HoleRowInput[] = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      strokeIndex: 18 - i,
      whiteYards: null,
      yellowYards: null,
    }));
    expect(validateHoleSet(holes, 18)).toEqual([]);
  });
});

describe("buildDefaultHoles", () => {
  it("builds the right length with sequential hole numbers and invalid placeholder SI", () => {
    const holes = buildDefaultHoles(9);
    expect(holes).toHaveLength(9);
    expect(holes.map((h) => h.holeNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(holes.every((h) => h.strokeIndex === 0)).toBe(true);
    // the placeholder set should therefore fail validation until filled in
    expect(validateHoleSet(holes, 9).length).toBeGreaterThan(0);
  });
});
