import { describe, it, expect } from "vitest";
import {
  isValidHex,
  isValidBrandColors,
  hexToHsl,
  hslToCssValue,
  contrastForeground,
  deriveDarkVariant,
  buildBrandCssVariables,
} from "@/lib/color";

describe("isValidHex", () => {
  it("accepts a 6-digit hex color", () => {
    expect(isValidHex("#1b4d3e")).toBe(true);
    expect(isValidHex("#FFFFFF")).toBe(true);
  });

  it("rejects shorthand, missing #, and non-hex characters", () => {
    expect(isValidHex("#fff")).toBe(false);
    expect(isValidHex("1b4d3e")).toBe(false);
    expect(isValidHex("#gggggg")).toBe(false);
    expect(isValidHex("#1b4d3")).toBe(false);
  });
});

describe("isValidBrandColors", () => {
  it("accepts an object with all three valid hex keys", () => {
    expect(isValidBrandColors({ primary: "#1b4d3e", secondary: "#e5decf", accent: "#b6862c" })).toBe(true);
  });

  it("rejects a missing key or an invalid hex value", () => {
    expect(isValidBrandColors({ primary: "#1b4d3e", secondary: "#e5decf" })).toBe(false);
    expect(isValidBrandColors({ primary: "not-a-color", secondary: "#e5decf", accent: "#b6862c" })).toBe(false);
    expect(isValidBrandColors(null)).toBe(false);
  });
});

describe("hexToHsl", () => {
  it("converts pure black, white, and red", () => {
    expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
  });

  it("throws on an invalid hex value", () => {
    expect(() => hexToHsl("not-a-color")).toThrow();
  });
});

describe("hslToCssValue", () => {
  it("formats as the H S% L% string globals.css expects", () => {
    expect(hslToCssValue({ h: 158, s: 45, l: 22 })).toBe("158 45% 22%");
  });
});

describe("contrastForeground", () => {
  it("picks near-black text on a light color", () => {
    expect(contrastForeground("#ffffff")).toEqual({ h: 0, s: 0, l: 4 });
  });

  it("picks near-white text on a dark color", () => {
    expect(contrastForeground("#0a1f17")).toEqual({ h: 0, s: 0, l: 100 });
  });
});

describe("deriveDarkVariant", () => {
  it("lightens a color that is too dark for a dark background", () => {
    const result = deriveDarkVariant({ h: 158, s: 45, l: 10 });
    expect(result.l).toBe(45);
    expect(result.h).toBe(158);
    expect(result.s).toBe(45);
  });

  it("caps a color that is already very light", () => {
    expect(deriveDarkVariant({ h: 38, s: 55, l: 95 }).l).toBe(80);
  });

  it("leaves a color already in the safe band untouched", () => {
    expect(deriveDarkVariant({ h: 38, s: 55, l: 60 }).l).toBe(60);
  });
});

describe("buildBrandCssVariables", () => {
  const colors = { primary: "#1b4d3e", secondary: "#e5decf", accent: "#b6862c" };

  it("produces a base + foreground pair for each color in both modes", () => {
    const { light, dark } = buildBrandCssVariables(colors);

    for (const key of ["primary", "secondary", "accent"]) {
      expect(light[`--${key}`]).toBeDefined();
      expect(light[`--${key}-foreground`]).toBeDefined();
      expect(dark[`--${key}`]).toBeDefined();
      expect(dark[`--${key}-foreground`]).toBeDefined();
    }
  });

  it("dark variants keep the same hue as their light counterpart", () => {
    const { light, dark } = buildBrandCssVariables(colors);
    const lightHue = light["--primary"].split(" ")[0];
    const darkHue = dark["--primary"].split(" ")[0];
    expect(darkHue).toBe(lightHue);
  });
});
